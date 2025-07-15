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

// Add a Set to track locked rides
const rideLocks = new Set();

// Track which drivers have already received each ride request
const rideRequestRecipients = new Map();

// Track user's active ride requests to prevent duplicates
const userActiveRides = new Map();

// Add cleanup interval for stale rides and locks
setInterval(() => {
  const now = Date.now();
  
  // Clean up stale ride locks (older than 30 seconds)
  for (const rideId of rideLocks) {
    const ride = activeRides.get(rideId);
    if (ride && (now - ride.createdAt) > 30000) {
      console.log(`🧹 Cleaning up stale ride lock: ${rideId}`);
      rideLocks.delete(rideId);
    }
  }
  
  // Clean up old pending rides (older than 5 minutes)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === "pending" && (now - ride.createdAt) > 300000) {
      console.log(`🧹 Cleaning up old pending ride: ${rideId}`);
      activeRides.delete(rideId);
      rideRequestRecipients.delete(rideId);
      rideLocks.delete(rideId);
      userActiveRides.delete(ride.userId); // Clean up user's active ride request
      
      // Notify user that ride request expired
      io.to(`user:${ride.userId}`).emit("ride_timeout", {
        rideId: rideId,
        message: "Ride request expired. Please try again."
      });
    }
  }
  
  // Clean up stale user active rides entries
  for (const [userId, rideId] of userActiveRides.entries()) {
    if (!activeRides.has(rideId)) {
      console.log(`🧹 Cleaning up stale user active ride entry: ${userId} -> ${rideId}`);
      userActiveRides.delete(userId);
    }
  }
}, 30000); // Run every 30 seconds

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Add debug endpoint to check socket connections
app.get('/debug/sockets', (req, res) => {
  const debugInfo = {
    connectedUsers: Array.from(connectedUsers.entries()),
    connectedDrivers: Array.from(connectedDrivers.entries()),
    activeRides: Array.from(activeRides.entries()),
    userActiveRides: Array.from(userActiveRides.entries()),
    rideLocks: Array.from(rideLocks),
    rideRequestRecipients: Array.from(rideRequestRecipients.entries()).map(([rideId, recipients]) => ({
      rideId,
      recipientCount: recipients.size,
      recipients: Array.from(recipients)
    })),
    rooms: Array.from(io.sockets.adapter.rooms.entries()).map(([room, sockets]) => ({
      room,
      socketCount: sockets.size,
      sockets: Array.from(sockets)
    }))
  };
  res.json(debugInfo);
});

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

// Helper function to validate ride data
const validateRideData = (data) => {
  const required = ['pickup', 'drop', 'rideType', 'price', 'userId'];
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  
  if (!data.pickup.latitude || !data.pickup.longitude) {
    return { valid: false, error: 'Invalid pickup location' };
  }
  
  if (!data.drop.latitude || !data.drop.longitude) {
    return { valid: false, error: 'Invalid drop location' };
  }
  
  if (typeof data.price !== 'number' || data.price <= 0) {
    return { valid: false, error: 'Invalid price' };
  }
  
  return { valid: true };
};

// Helper function to log ride events
const logRideEvent = (event, rideId, data = {}) => {
  console.log(`📋 [${event}] Ride ${rideId}:`, {
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Helper function to get user type display name
const getUserTypeDisplay = (type) => {
  switch (type) {
    case 'customer':
      return 'Customer';
    case 'user':
      return 'Customer';
    case 'driver':
      return 'Driver';
    default:
      return type;
  }
};

// Helper function to log server state
const logServerState = () => {
  console.log(`📊 Server State:`, {
    activeRides: activeRides.size,
    connectedDrivers: connectedDrivers.size,
    connectedUsers: connectedUsers.size,
    rideLocks: rideLocks.size,
    rideRequestRecipients: rideRequestRecipients.size,
    userActiveRides: userActiveRides.size,
    timestamp: new Date().toISOString()
  });
};

// Log server state every 30 seconds
setInterval(logServerState, 30000);

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
  const userTypeDisplay = getUserTypeDisplay(type);
  console.log(`🟢 ${userTypeDisplay} connected: type=${type}, id=${id}`);

  // Store connection info
  if (type === "driver") {
    socket.join(`driver:${id}`);
    socket.join("drivers");
    connectedDrivers.set(id, {
      socketId: socket.id,
      status: "online",
      lastSeen: Date.now(),
      location: null
    });
    console.log(`🚗 Driver ${id} connected. Total drivers: ${connectedDrivers.size}`);
    
    // Send only active (pending) ride requests to newly connected driver
    const activeRideRequests = Array.from(activeRides.entries())
      .filter(([rideId, ride]) => ride.status === "pending")
      .map(([rideId, ride]) => ({
        rideId: rideId,
        pickup: ride.pickup,
        drop: ride.drop,
        rideType: ride.rideType,
        price: ride.price,
        userId: ride.userId,
        timestamp: ride.createdAt
      }));
    
    if (activeRideRequests.length > 0) {
      console.log(`📢 Sending ${activeRideRequests.length} active ride requests to newly connected driver ${id}`);
      socket.emit("active_ride_requests", activeRideRequests);
    }
  } else if (type === "user" || type === "customer") {
    socket.join(`user:${id}`);
    connectedUsers.set(id, {
      socketId: socket.id,
      status: "online",
      lastSeen: Date.now()
    });
    console.log(`👤 ${userTypeDisplay} ${id} connected and joined room user:${id}. Total users: ${connectedUsers.size}`);
    
    // Verify room joining
    const userRoom = io.sockets.adapter.rooms.get(`user:${id}`);
    console.log(`🔍 User room user:${id} created:`, !!userRoom);
    if (userRoom) {
      console.log(`👥 Users in room user:${id}:`, Array.from(userRoom));
    }
  }

  // Handle ride booking
  socket.on("book_ride", (data) => {
    console.log("🚗 Ride booking request received:", {
      userId: data.userId,
      pickup: data.pickup?.address,
      drop: data.drop?.address,
      price: data.price
    });
    
    // Check if user already has an active ride request
    const existingRide = userActiveRides.get(data.userId);
    if (existingRide) {
      const ride = activeRides.get(existingRide);
      if (ride && ride.status === "pending") {
        console.log("❌ User already has an active ride request:", data.userId);
        socket.emit("ride_response_error", {
          message: "You already have an active ride request. Please wait or cancel the existing request."
        });
        return;
      } else {
        // Clean up stale entry
        userActiveRides.delete(data.userId);
      }
    }
    
    // Validate ride data
    const validation = validateRideData(data);
    if (!validation.valid) {
      console.error("❌ Invalid ride data:", validation.error);
      socket.emit("ride_response_error", {
        message: validation.error
      });
      return;
    }
    
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
      driverId: null,
      attempts: 0,
      maxAttempts: 3
    };
    
    activeRides.set(rideId, rideData);
    userActiveRides.set(data.userId, rideId);
    logRideEvent('CREATED', rideId, { userId: data.userId, price: data.price });
    
    // Emit back to the user that ride is booked
    console.log(`📤 Emitting ride_booked to user ${data.userId} with rideId: ${rideId}`);
    socket.emit("ride_booked", {
      success: true,
      rideId: rideId,
      price: data.price,
      message: "Ride booked successfully! Searching for drivers..."
    });
    
    // Only send to currently connected drivers (not future drivers)
    const currentDriverIds = Array.from(connectedDrivers.keys());
    rideRequestRecipients.set(rideId, new Set(currentDriverIds));
    
    // Broadcast to currently connected drivers only
    const rideRequest = {
      rideId: rideId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      userId: data.userId,
      timestamp: Date.now()
    };
    
    if (currentDriverIds.length > 0) {
      io.to("drivers").emit("new_ride_request", rideRequest);
      console.log(`📢 Ride request ${rideId} broadcasted to ${currentDriverIds.length} currently connected drivers:`, currentDriverIds);
    } else {
      console.log(`⚠️ No drivers currently connected. Ride request ${rideId} will be sent when drivers connect.`);
    }
    
    // Set a timeout to clean up the ride request if no one accepts it
    setTimeout(() => {
      const ride = activeRides.get(rideId);
      if (ride && ride.status === "pending") {
        console.log(`⏰ Ride request ${rideId} timed out, cleaning up`);
        logRideEvent('TIMEOUT', rideId);
        
        activeRides.delete(rideId);
        rideRequestRecipients.delete(rideId);
        
        // Notify user that no drivers were found
        io.to(`user:${data.userId}`).emit("ride_timeout", {
          rideId: rideId,
          message: "No drivers found. Please try again."
        });
      }
    }, 60000); // 1 minute timeout

    // Additional cleanup: Remove ride requests older than 5 minutes
    setTimeout(() => {
      const ride = activeRides.get(rideId);
      if (ride && ride.status === "pending") {
        const age = Date.now() - ride.createdAt;
        if (age > 300000) { // 5 minutes
          console.log(`🧹 Cleaning up old ride request ${rideId} (age: ${Math.round(age/1000)}s)`);
          logRideEvent('CLEANUP', rideId, { age: Math.round(age/1000) });
          
          activeRides.delete(rideId);
          rideRequestRecipients.delete(rideId);
        }
      }
    }, 300000); // 5 minutes
  });

  // Handle driver ride acceptance/rejection
  socket.on("ride_response", (data) => {
    console.log("🚗 Driver ride response:", {
      driverId: data.driverId,
      rideId: data.rideId,
      response: data.response
    });

    const ride = activeRides.get(data.rideId);
    if (!ride) {
      console.error("❌ Ride not found:", data.rideId);
      socket.emit("ride_response_error", { 
        message: "Ride not found or already processed" 
      });
      return;
    }

    // Locking logic to prevent race conditions
    if (data.response === "accept") {
      // Check if ride is already locked or accepted
      if (rideLocks.has(data.rideId)) {
        console.log("🚫 Ride is being processed by another driver:", data.rideId);
        socket.emit("ride_response_error", {
          message: "Ride is being processed by another driver. Please try another ride."
        });
        return;
      }
      
      // Check if ride is already accepted
      if (ride.status !== "pending") {
        console.log("❌ Ride already accepted by another driver:", data.rideId);
        socket.emit("ride_response_error", {
          message: "Ride already accepted by another driver"
        });
        return;
      }
      
      // Add lock before processing
      rideLocks.add(data.rideId);
      
      try {
        // Double-check ride status after acquiring lock
        if (ride.status === "pending") {
          ride.status = "accepted";
          ride.acceptedBy = data.driverId;
          ride.driverId = data.driverId;
          ride.acceptedAt = Date.now();

          logRideEvent('ACCEPTED', data.rideId, { 
            driverId: data.driverId,
            driverName: data.driverName 
          });

          // Notify user
          console.log(`📢 Emitting ride_accepted to user:${ride.userId}`);
          const notificationData = {
            rideId: data.rideId,
            driverId: data.driverId,
            driverName: data.driverName || "Driver",
            driverPhone: data.driverPhone || "+1234567890",
            estimatedArrival: data.estimatedArrival || "5 minutes"
          };
          console.log(`📤 Notification data being sent:`, JSON.stringify(notificationData, null, 2));
          io.to(`user:${ride.userId}`).emit("ride_accepted", notificationData);
          
          // Check if user room exists
          const userRoom = io.sockets.adapter.rooms.get(`user:${ride.userId}`);
          console.log(`🔍 User room user:${ride.userId} exists:`, !!userRoom);
          if (userRoom) {
            console.log(`👥 Users in room user:${ride.userId}:`, Array.from(userRoom));
          }

          // Send complete ride details to the accepting driver
          console.log(`📢 Emitting ride_accepted_with_details to driver:${data.driverId}`);
          // Ensure pickup and drop have address and name
          const safePickup = {
            latitude: ride.pickup.latitude,
            longitude: ride.pickup.longitude,
            address: ride.pickup.address || ride.pickup.name || 'Unknown Address',
            name: ride.pickup.name || ride.pickup.address || 'Unknown Name',
          };
          const safeDrop = {
            id: ride.drop.id || 'dest_1',
            name: ride.drop.name || ride.drop.address || 'Unknown Name',
            address: ride.drop.address || ride.drop.name || 'Unknown Address',
            latitude: ride.drop.latitude,
            longitude: ride.drop.longitude,
            type: ride.drop.type || '',
          };
          socket.emit("ride_accepted_with_details", {
            rideId: data.rideId,
            userId: ride.userId,
            pickup: safePickup,
            drop: safeDrop,
            rideType: ride.rideType,
            price: ride.price,
            driverId: data.driverId,
            driverName: data.driverName || "Driver",
            driverPhone: data.driverPhone || "+1234567890",
            estimatedArrival: data.estimatedArrival || "5 minutes",
            status: ride.status,
            createdAt: ride.createdAt
          });

          // Notify all drivers that ride is taken
          io.to("drivers").emit("ride_taken", {
            rideId: data.rideId,
            driverId: data.driverId
          });

          // Clean up ride request tracking
          rideRequestRecipients.delete(data.rideId);

          console.log(`✅ Ride ${data.rideId} accepted by driver ${data.driverId}`);
        } else {
          console.log("❌ Ride status changed while processing:", data.rideId);
          socket.emit("ride_response_error", {
            message: "Ride already accepted by another driver"
          });
        }
      } finally {
        // Always remove lock after processing
        rideLocks.delete(data.rideId);
      }
    } else if (data.response === "reject") {
      // Log rejection (could be used for analytics)
      console.log(`❌ Driver ${data.driverId} rejected ride ${data.rideId}`);
      logRideEvent('REJECTED', data.rideId, { driverId: data.driverId });
      
      socket.emit("ride_response_confirmed", {
        rideId: data.rideId,
        response: "rejected"
      });
      
      // Remove this driver from the recipients list for this ride
      const recipients = rideRequestRecipients.get(data.rideId);
      if (recipients) {
        recipients.delete(data.driverId);
        if (recipients.size === 0) {
          rideRequestRecipients.delete(data.rideId);
        }
      }
    }
  });

  // Handle ride cancellation
  socket.on("cancel_ride", (data) => {
    console.log("🚫 Ride cancellation request:", data);
    
    const ride = activeRides.get(data.rideId);
    if (!ride) {
      console.log("❌ Ride not found for cancellation:", data.rideId);
      return;
    }
    
    logRideEvent('CANCELLED', data.rideId, { 
      cancelledBy: ride.userId,
      status: ride.status 
    });
    
    // Update ride status
    ride.status = "cancelled";
    ride.cancelledAt = Date.now();
    
    // Notify user
    io.to(`user:${ride.userId}`).emit("ride_status_update", {
      rideId: data.rideId,
      status: "cancelled",
      message: "Ride cancelled successfully",
      timestamp: Date.now()
    });
    
    // Notify driver if ride was accepted
    if (ride.driverId) {
      io.to(`driver:${ride.driverId}`).emit("ride_status_update", {
        rideId: data.rideId,
        status: "cancelled",
        message: "Ride cancelled by user",
        timestamp: Date.now()
      });
    }
    
    // Clean up
    activeRides.delete(data.rideId);
    rideRequestRecipients.delete(data.rideId);
    rideLocks.delete(data.rideId);
    userActiveRides.delete(ride.userId); // Clean up user's active ride request
    
    console.log(`✅ Ride ${data.rideId} cancelled successfully`);
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
        rideRequestRecipients.delete(data.rideId);
        userActiveRides.delete(ride.userId); // Clean up user's active ride request
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
    console.log(`🔴 ${userTypeDisplay} disconnected: type=${type}, id=${id}`);
    
    // Clean up connections
    if (type === "driver") {
      socket.leave("drivers");
      connectedDrivers.delete(id);
      
      // Remove this driver from all ride request recipients
      for (const [rideId, recipients] of rideRequestRecipients.entries()) {
        recipients.delete(id);
        if (recipients.size === 0) {
          rideRequestRecipients.delete(rideId);
        }
      }
      
      console.log(`🚗 Driver ${id} disconnected. Total drivers: ${connectedDrivers.size}`);
    } else if (type === "user" || type === "customer") {
      socket.leave(`user:${id}`);
      connectedUsers.delete(id);
      userActiveRides.delete(id); // Clean up user's active ride request on disconnect
      console.log(`👤 ${userTypeDisplay} ${id} disconnected. Total users: ${connectedUsers.size}`);
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
