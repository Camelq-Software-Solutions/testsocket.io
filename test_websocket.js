const { io } = require('socket.io-client');

const SOCKET_URL = 'http://192.168.1.9:3000';

console.log('Testing WebSocket connection to:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  forceNew: true,
  query: {
    type: 'driver',
    id: 'test_driver_123'
  }
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('Socket ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  
  // Test sending a message
  socket.emit('test_event', { message: 'Hello from test script' });
});

socket.on('connect_error', (error) => {
  console.log('❌ WebSocket connection error:', error.message);
  console.log('Error details:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔴 WebSocket disconnected:', reason);
});

socket.on('test_response', (data) => {
  console.log('✅ Received test response:', data);
});

// Test HTTP connection first
const http = require('http');
const req = http.get('http://192.168.1.9:3000/debug/state', (res) => {
  console.log('✅ HTTP connection works - Status:', res.statusCode);
});

req.on('error', (err) => {
  console.log('❌ HTTP connection failed:', err.message);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - closing connection');
  socket.disconnect();
  process.exit(0);
}, 10000); 