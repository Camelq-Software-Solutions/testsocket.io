const { io } = require('socket.io-client');

// Test script to simulate a driver connecting and receiving ride requests
async function testDriverConnection() {
  console.log('🚗 Testing driver connection and ride request reception...');
  
  // Connect as a driver
  const driverSocket = io('http://localhost:9092', {
    query: {
      type: 'driver',
      id: 'driver_001'
    }
  });

  driverSocket.on('connect', () => {
    console.log('✅ Driver connected to socket server');
    console.log('🔄 Waiting for ride requests...');
  });

  driverSocket.on('new_ride_request', (data) => {
    console.log('🚗 New ride request received by driver:', data);
  });

  driverSocket.on('disconnect', () => {
    console.log('🔴 Driver disconnected');
  });

  // Keep the connection alive for testing
  console.log('⏰ Driver will stay connected for 30 seconds...');
  setTimeout(() => {
    console.log('🔄 Closing driver connection...');
    driverSocket.disconnect();
    process.exit(0);
  }, 30000);
}

testDriverConnection().catch(console.error); 