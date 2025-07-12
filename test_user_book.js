const io = require('socket.io-client');

// Connect as a user
const userSocket = io('https://testsocketio-roqet.up.railway.app', {
  query: {
    type: 'user',
    id: 'user123'
  }
});

userSocket.on('connect', () => {
  console.log('👤 User connected');
  
  // Listen for ride booked confirmation
  userSocket.on('ride_booked', (data) => {
    console.log('✅ Ride booked:', data);
  });
  
  // Listen for ride acceptance
  userSocket.on('ride_accepted', (data) => {
    console.log('🎉 Driver accepted ride:', data);
  });
  
  // Listen for ride status updates
  userSocket.on('ride_status_update', (data) => {
    console.log('🔄 Ride status update:', data);
  });
  
  // Book a ride after 1 second
  setTimeout(() => {
    console.log('🚗 Booking ride...');
    userSocket.emit('book_ride', {
      pickup: 'Current Location',
      drop: 'Destination Address',
      rideType: 'Bike',
      price: 50,
      userId: 'user123'
    });
  }, 1000);
});

userSocket.on('disconnect', () => {
  console.log('🔴 User disconnected');
});

userSocket.on('connect_error', (error) => {
  console.error('❌ User connection error:', error);
});

console.log('🧪 Test user script started. Will book a ride in 1 second...'); 