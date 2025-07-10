const { Server } = require("socket.io");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 9092;

// Basic middleware
app.use(express.json());

// In-memory storage for active rides (in production, use Redis or database)
const activeRides = new Map();
const connectedDrivers = new Map();
const connectedUsers = new Map();

const io = new Server({
  cors: {
    origin: "*", // allow all origins for dev; restrict in prod
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
  path: "/socket.io/",
  serveClient: false,
  pingTimeout: 60000,
  pingInterval: 25000,
});

console.log("🚀 Socket.IO server starting up...");

io.on("connection", (socket) => {
  // Log socket id and handshake details
  console.log("🔗 New connection:", {
    socketId: socket.id,
    handshake: socket.handshake
  });

  // Catch-all event logger for debugging
  socket.onAny((event, ...args) => {
    console.log("📥 Received event from socket:", socket.id, "event:", event, "data:", args);
  });

  const { type, id } = socket.handshake.query;
  console.log(`🟢 Client connected: type=${type}, id=${id}`);

  // Store connection info
  if (type === "driver") {
    socket.join(`driver:${id}`);
    socket.join("drivers");
    connectedDrivers.set(id, {
      socketId: socket.id,
      status: "online",
      lastSeen: Date.now()
    });
    console.log(`🚗 Driver ${id} connected. Total drivers: ${connectedDrivers.size}`);
  } else if (type === "user") {
    socket.join(`user:${id}`);
    connectedUsers.set(id, {
      socketId: socket.id,
      status: "online",
      lastSeen: Date.now()
    });
    console.log(`👤 User ${id} connected. Total users: ${connectedUsers.size}`);
  }

  // Handle ride booking
  socket.on("book_ride", (data) => {
    console.log("🚗 Ride booking request:", data);
    
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create ride entry
    const rideData = {
      rideId,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      status: "pending",
      createdAt: Date.now(),
      acceptedBy: null,
      driverId: null
    };
    
    activeRides.set(rideId, rideData);
    
    // Emit back to the user that ride is booked
    socket.emit("ride_booked", {
      success: true,
      rideId: rideId,
      price: data.price,
      message: "Ride booked successfully! Searching for drivers..."
    });
    
    // Broadcast to all drivers
    io.to("drivers").emit("new_ride_request", {
      rideId: rideId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      userId: data.userId,
      timestamp: Date.now()
    });
    
    console.log(`📢 Ride request ${rideId} broadcasted to ${connectedDrivers.size} drivers`);
  });

  // Handle driver ride acceptance/rejection
  socket.on("ride_response", (data) => {
    console.log("🚗 Driver ride response:", data);
    
    const ride = activeRides.get(data.rideId);
    if (!ride) {
      socket.emit("error", { message: "Ride not found" });
      return;
    }
    
    if (data.response === "accept") {
      // Check if ride is still available
      if (ride.status === "pending") {
        ride.status = "accepted";
        ride.acceptedBy = data.driverId;
        ride.driverId = data.driverId;
        
        // Notify user
        io.to(`user:${ride.userId}`).emit("ride_accepted", {
          rideId: data.rideId,
          driverId: data.driverId,
          driverName: data.driverName,
          driverPhone: data.driverPhone,
          estimatedArrival: data.estimatedArrival
        });
        
        // Notify all drivers that ride is taken
        io.to("drivers").emit("ride_taken", {
          rideId: data.rideId,
          driverId: data.driverId
        });
        
        console.log(`✅ Ride ${data.rideId} accepted by driver ${data.driverId}`);
      } else {
        socket.emit("ride_response_error", {
          message: "Ride already accepted by another driver"
        });
      }
    } else if (data.response === "reject") {
      // Log rejection (could be used for analytics)
      console.log(`❌ Driver ${data.driverId} rejected ride ${data.rideId}`);
      socket.emit("ride_response_confirmed", {
        rideId: data.rideId,
        response: "rejected"
      });
    }
  });

  // Handle driver location updates
  socket.on("driver_location", (data) => {
    console.log("📍 Driver location update:", data);
    
    // Update driver location in memory
    const driver = connectedDrivers.get(data.driverId);
    if (driver) {
      driver.location = {
        latitude: data.latitude,
        longitude: data.longitude
      };
      driver.lastSeen = Date.now();
    }
    
    // Broadcast to the specific user
    io.to(`user:${data.userId}`).emit("driver_location_update", {
      driverId: data.driverId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: Date.now()
    });
  });

  // Handle ride status updates
  socket.on("ride_status_update", (data) => {
    console.log("🔄 Ride status update:", data);
    
    const ride = activeRides.get(data.rideId);
    if (ride) {
      ride.status = data.status;
      ride.lastUpdated = Date.now();
      
      // Notify user
      io.to(`user:${data.userId}`).emit("ride_status_update", {
        rideId: data.rideId,
        status: data.status,
        message: data.message,
        timestamp: Date.now()
      });
      
      // If ride is completed or cancelled, clean up
      if (data.status === "completed" || data.status === "cancelled") {
        activeRides.delete(data.rideId);
        console.log(`🧹 Cleaned up ride ${data.rideId}`);
      }
    }
  });

  // Handle driver status updates
  socket.on("driver_status", (data) => {
    console.log("🚗 Driver status update:", data);
    
    const driver = connectedDrivers.get(data.driverId);
    if (driver) {
      driver.status = data.status; // "online", "busy", "offline"
      driver.lastSeen = Date.now();
      
      // Broadcast to users if needed
      if (data.status === "offline") {
        // Notify any users with active rides from this driver
        for (const [rideId, ride] of activeRides) {
          if (ride.driverId === data.driverId && ride.status === "accepted") {
            io.to(`user:${ride.userId}`).emit("driver_offline", {
              rideId: rideId,
              driverId: data.driverId
            });
          }
        }
      }
    }
  });

  // Handle test events
  socket.on("test_event", (data) => {
    console.log("🧪 Test event received:", data);
    socket.emit("test_response", {
      message: "Hello from Railway server!",
      timestamp: new Date().toISOString(),
      received: data,
      activeRides: activeRides.size,
      connectedDrivers: connectedDrivers.size,
      connectedUsers: connectedUsers.size
    });
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: type=${type}, id=${id}`);
    
    // Clean up connections
    if (type === "driver") {
      connectedDrivers.delete(id);
      console.log(`🚗 Driver ${id} disconnected. Total drivers: ${connectedDrivers.size}`);
    } else if (type === "user") {
      connectedUsers.delete(id);
      console.log(`👤 User ${id} disconnected. Total users: ${connectedUsers.size}`);
    }
  });
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Socket.IO server is running",
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    activeRides: activeRides.size,
    connectedDrivers: connectedDrivers.size,
    connectedUsers: connectedUsers.size
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    activeRides: activeRides.size,
    connectedDrivers: connectedDrivers.size,
    connectedUsers: connectedUsers.size
  });
});

// API endpoint to get server stats
app.get("/stats", (req, res) => {
  res.json({
    activeRides: Array.from(activeRides.entries()),
    connectedDrivers: Array.from(connectedDrivers.entries()),
    connectedUsers: Array.from(connectedUsers.entries())
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Express server listening on port ${PORT}`);
});

io.attach(server);
console.log(`✅ Socket.IO server attached to Express server`);
