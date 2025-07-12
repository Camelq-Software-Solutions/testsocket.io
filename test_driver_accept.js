const io = require('socket.io-client');

// Connect as a driver
const driverSocket = io('https://testsocketio-roqet.up.railway.app', {
  query: {
    type: 'driver',
    id: 'driver123'
  }
});

driverSocket.on('connect', () => {
  console.log('🚗 Driver connected');
  
  // Listen for new ride requests
  driverSocket.on('new_ride_request', (data) => {
    console.log('📱 New ride request received:', data);
    
    // Simulate driver accepting the ride after 2 seconds
    setTimeout(() => {
      console.log('✅ Driver accepting ride:', data.rideId);
      driverSocket.emit('ride_response', {
        rideId: data.rideId,
        driverId: 'driver123',
        driverName: 'John Driver',
        driverPhone: '+1234567890',
        estimatedArrival: '5 mins',
        response: 'accept'
      });
    }, 2000);
  });
  
  driverSocket.on('ride_taken', (data) => {
    console.log('🚫 Ride taken by another driver:', data);
  });
  
  driverSocket.on('ride_response_error', (data) => {
    console.log('❌ Ride response error:', data);
  });
});

driverSocket.on('disconnect', () => {
  console.log('🔴 Driver disconnected');
});

driverSocket.on('connect_error', (error) => {
  console.error('❌ Driver connection error:', error);
});

console.log('🧪 Test driver script started. Waiting for ride requests...'); 