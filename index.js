const { Server } = require("socket.io");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 9092;

// Basic middleware
app.use(express.json());

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

  if (type === "driver") {
    socket.join(`driver:${id}`);
    socket.join("drivers"); // All drivers join a shared room
  } else if (type === "user") {
    socket.join(`user:${id}`);
  }

  // Handle ride booking
  socket.on("book_ride", (data) => {
    console.log("🚗 Ride booking request:", data);
    
    // Simulate ride booking process
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Emit back to the user that ride is booked
    socket.emit("ride_booked", {
      success: true,
      rideId: rideId,
      price: data.price,
      message: "Ride booked successfully!"
    });
    
    // Broadcast to all drivers (in a real app, you'd filter by location)
    io.to("drivers").emit("new_ride_request", {
      rideId: rideId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      userId: data.userId
    });
  });

  // Handle driver location updates
  socket.on("driver_location", (data) => {
    console.log("📍 Driver location update:", data);
    // Broadcast to the specific user
    socket.to(`user:${data.userId}`).emit("driver_location_update", data);
  });

  // Handle ride status updates
  socket.on("ride_status_update", (data) => {
    console.log("🔄 Ride status update:", data);
    socket.to(`user:${data.userId}`).emit("ride_status_update", data);
  });

  // Handle test events
  socket.on("test_event", (data) => {
    console.log("🧪 Test event received:", data);
    socket.emit("test_response", {
      message: "Hello from Railway server!",
      timestamp: new Date().toISOString(),
      received: data
    });
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: id=${id}`);
  });
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Socket.IO server is running",
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Express server listening on port ${PORT}`);
});

io.attach(server);
console.log(`✅ Socket.IO server attached to Express server`);
