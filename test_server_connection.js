const io = require('socket.io-client');

const SOCKET_URL = "https://testsocketio-roqet.up.railway.app";

console.log('Testing server connection...');

// Test HTTP health check
fetch(`${SOCKET_URL}/health`)
  .then(response => response.json())
  .then(data => {
    console.log('✅ Health check successful:', data);
  })
  .catch(error => {
    console.error('❌ Health check failed:', error.message);
  });

// Test Socket.IO connection
const socket = io(SOCKET_URL, {
  transports: ['polling'],
  timeout: 10000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Socket.IO connection successful');
  console.log('Socket ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  socket.disconnect();
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO connection failed:', error.message);
  console.error('Error details:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  process.exit(0);
}, 15000); 