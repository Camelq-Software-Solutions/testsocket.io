const io = require('socket.io-client');

// Test configuration - LOCAL SERVER
const SERVER_URL = 'http://192.168.1.27:9092';
const TEST_USER_ID = 'user_2zv6uUEVerLOtFV1A3ZfMuOo05o';
const TEST_DRIVER_ID = 'user_2zmThgmdF5YItg7OoypHCaDt3KH';

console.log('🚀 Starting LOCAL debug test to track all events...\n');

// Create customer socket
const customerSocket = io(SERVER_URL, {
  transports: ['websocket'],
  query: {
    type: 'customer',
    id: TEST_USER_ID
  }
});

// Create driver socket
const driverSocket = io(SERVER_URL, {
  transports: ['websocket'],
  query: {
    type: 'driver',
    id: TEST_DRIVER_ID
  }
});

// Customer socket event listeners - log ALL events
customerSocket.onAny((eventName, ...args) => {
  console.log(`📱 CUSTOMER received: ${eventName}`, JSON.stringify(args, null, 2));
});

customerSocket.on('connect', () => {
  console.log('📱 CUSTOMER connected:', customerSocket.id);
  
  // Request a ride after connection
  setTimeout(() => {
    console.log('📱 CUSTOMER requesting ride...');
    customerSocket.emit('request_ride', {
      pickup: {
        latitude: 17.4514543,
        longitude: 78.3885335,
        address: 'Current Location',
        name: 'Current Location'
      },
      drop: {
        latitude: 17.3457176,
        longitude: 78.55222959999999,
        address: 'L. B. Nagar, Hyderabad, Telangana, India',
        name: 'L. B. Nagar',
        id: '1',
        type: 'recent'
      },
      rideType: 'Bike',
      price: 200,
      userId: TEST_USER_ID
    });
  }, 1000);
});

// Driver socket event listeners - log ALL events
driverSocket.onAny((eventName, ...args) => {
  console.log(`🚗 DRIVER received: ${eventName}`, JSON.stringify(args, null, 2));
});

driverSocket.on('connect', () => {
  console.log('🚗 DRIVER connected:', driverSocket.id);
});

driverSocket.on('new_ride_request', (data) => {
  console.log('🚗 DRIVER received ride request, accepting in 2 seconds...');
  
  setTimeout(() => {
    console.log('🚗 DRIVER accepting ride...');
    driverSocket.emit('accept_ride', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID,
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 2000);
});

driverSocket.on('ride_accepted_with_details', (data) => {
  console.log('🚗 DRIVER ride accepted, arriving in 3 seconds...');
  
  setTimeout(() => {
    console.log('🚗 DRIVER sending driver_arrived...');
    driverSocket.emit('driver_arrived', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 3000);
});

driverSocket.on('ride_status_updated', (data) => {
  if (data.status === 'arrived') {
    console.log('🚗 DRIVER arrived confirmed, starting ride in 2 seconds...');
    
    setTimeout(() => {
      console.log('🚗 DRIVER sending start_ride...');
      driverSocket.emit('start_ride', {
        rideId: data.rideId,
        driverId: TEST_DRIVER_ID
      });
    }, 2000);
  }
});

// Error handling
customerSocket.on('connect_error', (error) => {
  console.error('❌ Customer connection error:', error.message);
});

driverSocket.on('connect_error', (error) => {
  console.error('❌ Driver connection error:', error.message);
});

// Timeout to prevent hanging
setTimeout(() => {
  console.log('\n⏰ Debug test completed');
  process.exit(0);
}, 15000); // 15 second timeout 