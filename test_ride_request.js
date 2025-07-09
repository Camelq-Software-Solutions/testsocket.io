const { io } = require('socket.io-client');

// Test script to simulate a user sending a ride request
async function testRideRequest() {
  console.log('🧪 Testing ride request from user to driver...');
  
  // Connect as a user
  const userSocket = io('http://localhost:9092', {
    query: {
      type: 'user',
      id: 'user_001'
    }
  });

  userSocket.on('connect', () => {
    console.log('✅ User connected to socket server');
    
    // Send a test ride request
    const rideRequest = {
      pickup: 'Hitech City, Hyderabad, Telangana',
      drop: 'Charminar, Hyderabad, Telangana',
      rideType: 'Mini',
      price: 120,
      userId: 'user_001'
    };
    
    console.log('🚗 Sending ride request:', rideRequest);
    userSocket.emit('book_ride', rideRequest);
  });

  userSocket.on('ride_booked', (data) => {
    console.log('✅ Ride booked response received:', data);
  });

  userSocket.on('disconnect', () => {
    console.log('🔴 User disconnected');
  });

  // Keep the connection alive for a few seconds
  setTimeout(() => {
    console.log('🔄 Closing test connection...');
    userSocket.disconnect();
    process.exit(0);
  }, 5000);
}

testRideRequest().catch(console.error); 