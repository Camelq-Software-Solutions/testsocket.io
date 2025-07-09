const { io } = require("socket.io-client");

const SOCKET_URL = "https://testsocketio-roqet.up.railway.app";

console.log("🧪 Testing Socket.IO connection to:", SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ["polling"],
  query: {
    type: "user",
    id: "test-user-123",
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 30000,
});

socket.on("connect", () => {
  console.log("✅ Connected to server!");
  console.log("📡 Transport:", socket.io.engine.transport.name);
  console.log("🔗 Socket ID:", socket.id);
  
  // Send a test event
  socket.emit("test_event", { message: "Hello from test script!" });
});

socket.on("disconnect", (reason) => {
  console.log("🔴 Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error.message);
});

socket.on("test_response", (data) => {
  console.log("📨 Received test response:", data);
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log("⏰ Test timeout - no response received");
  process.exit(1);
}, 10000); 