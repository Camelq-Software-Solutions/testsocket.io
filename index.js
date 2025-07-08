const { Server } = require("socket.io");

const PORT = process.env.PORT || 9092;

const io = new Server({
  cors: {
    origin: "*", // allow all origins for dev; restrict in prod
  },
});

io.on("connection", (socket) => {
  const { type, id } = socket.handshake.query;
  console.log(`🟢 Client connected: type=${type}, id=${id}`);

  if (type === "driver") {
    socket.join(`driver:${id}`);
  } else if (type === "user") {
    socket.join(`user:${id}`);
  }

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: id=${id}`);
  });
});

io.listen(PORT);
console.log(`✅ Socket.IO server listening on port ${PORT}`);
