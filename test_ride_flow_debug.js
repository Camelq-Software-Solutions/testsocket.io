const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:9092';
const CUSTOMER_ID = 'user_2zv6uUEVerLOtFV1A3ZfMuOo05o';
const DRIVER_ID = 'user_2zmThgmdF5YItg7OoypHCaDt3KH';

console.log('🧪 Starting ride flow debug test...');

// Connect customer
const customerSocket = io(SERVER_URL, {
  query: {
    type: 'customer',
    id: CUSTOMER_ID
  },
  transports: ['websocket', 'polling']
});

// Connect driver
const driverSocket = io(SERVER_URL, {
  query: {
    type: 'driver',
    id: DRIVER_ID
  },
  transports: ['websocket', 'polling']
});

// Customer event listeners
customerSocket.on('connect', () => {
  console.log('✅ Customer connected:', customerSocket.id);
});

customerSocket.on('ride_request_created', (data) => {
  console.log('✅ Customer: Ride request created:', data);
});

customerSocket.on('ride_accepted', (data) => {
  console.log('✅ Customer: Ride accepted:', data);
});

customerSocket.on('ride_expired', (data) => {
  console.log('⏰ Customer: Ride expired:', data);
});

// Driver event listeners
driverSocket.on('connect', () => {
  console.log('✅ Driver connected:', driverSocket.id);
});

driverSocket.on('new_ride_request', (data) => {
  console.log('🚗 Driver: New ride request received:', data);
  
  // Accept the ride after a short delay
  setTimeout(() => {
    console.log('✅ Driver: Accepting ride...');
    driverSocket.emit('accept_ride', {
      rideId: data.rideId,
      driverId: DRIVER_ID,
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 2000);
});

driverSocket.on('ride_accepted_with_details', (data) => {
  console.log('✅ Driver: Ride accepted with details:', data);
});

driverSocket.on('ride_accept_error', (data) => {
  console.log('❌ Driver: Ride accept error:', data);
});

// Wait for both to connect, then send ride request
Promise.all([
  new Promise(resolve => customerSocket.on('connect', resolve)),
  new Promise(resolve => driverSocket.on('connect', resolve))
]).then(() => {
  console.log('🚀 Both connected, sending ride request...');
  
  // Send ride request
  customerSocket.emit('request_ride', {
    pickup: {
      latitude: 17.4513907,
      longitude: 78.388556,
      address: 'Current Location',
      name: 'Current Location'
    },
    drop: {
      latitude: 17.3858323,
      longitude: 78.47942739999999,
      address: 'Koti, Hyderabad, Telangana, India',
      name: 'Koti',
      id: '1',
      type: 'recent'
    },
    rideType: 'Electric Scooty',
    price: 199,
    userId: CUSTOMER_ID
  });
});

// Cleanup after 30 seconds
setTimeout(() => {
  console.log('🧹 Cleaning up test...');
  customerSocket.disconnect();
  driverSocket.disconnect();
  process.exit(0);
}, 30000); 