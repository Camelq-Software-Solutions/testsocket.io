const io = require('socket.io-client');

// Test configuration - use localhost for testing
const SERVER_URL = 'http://localhost:9092';
const TEST_USER_ID = 'test_user_' + Date.now();
const TEST_DRIVER_ID = 'test_driver_' + Date.now();

console.log('🧪 Testing ride flow fixes locally...');
console.log('📋 Test Configuration:');
console.log(`   Server: ${SERVER_URL}`);
console.log(`   User ID: ${TEST_USER_ID}`);
console.log(`   Driver ID: ${TEST_DRIVER_ID}`);

// Test results tracking
let testResults = {
  userConnected: false,
  driverConnected: false,
  rideBooked: false,
  rideRequestReceived: false,
  rideAccepted: false,
  rideCompleted: false,
  errors: []
};

// Helper function to log test events
const logTest = (event, data = {}) => {
  console.log(`✅ [${event}]`, data);
};

// Helper function to log errors
const logError = (event, error) => {
  console.error(`❌ [${event}]`, error);
  testResults.errors.push({ event, error: error.message || error });
};

// Test ride data
const testRideData = {
  pickup: {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'Test Pickup Location',
    name: 'Test Pickup'
  },
  drop: {
    id: 'test_drop_1',
    name: 'Test Drop Location',
    address: 'Test Drop Address',
    latitude: 28.6149,
    longitude: 77.2100,
    type: 'test'
  },
  rideType: 'Bike',
  price: 50,
  userId: TEST_USER_ID
};

let rideId = null;

// Create user socket
const userSocket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  query: {
    type: 'customer',
    id: TEST_USER_ID
  }
});

// Create driver socket
const driverSocket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  query: {
    type: 'driver',
    id: TEST_DRIVER_ID
  }
});

// User socket event handlers
userSocket.on('connect', () => {
  logTest('USER_CONNECTED', { socketId: userSocket.id });
  testResults.userConnected = true;
});

userSocket.on('ride_booked', (data) => {
  logTest('RIDE_BOOKED', data);
  testResults.rideBooked = true;
  rideId = data.rideId;
});

userSocket.on('ride_accepted', (data) => {
  logTest('RIDE_ACCEPTED', data);
  testResults.rideAccepted = true;
});

userSocket.on('ride_timeout', (data) => {
  logTest('RIDE_TIMEOUT', data);
});

userSocket.on('ride_status_update', (data) => {
  logTest('RIDE_STATUS_UPDATE', data);
});

userSocket.on('connect_error', (error) => {
  logError('USER_CONNECT_ERROR', error);
});

// Driver socket event handlers
driverSocket.on('connect', () => {
  logTest('DRIVER_CONNECTED', { socketId: driverSocket.id });
  testResults.driverConnected = true;
});

driverSocket.on('new_ride_request', (data) => {
  logTest('NEW_RIDE_REQUEST', data);
  testResults.rideRequestReceived = true;
  
  // Accept the ride after a short delay
  setTimeout(() => {
    console.log('🚗 Driver accepting ride...');
    driverSocket.emit('ride_response', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID,
      response: 'accept',
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 2000);
});

driverSocket.on('ride_accepted_with_details', (data) => {
  logTest('RIDE_ACCEPTED_WITH_DETAILS', data);
  
  // Complete the ride after a short delay
  setTimeout(() => {
    console.log('✅ Driver completing ride...');
    driverSocket.emit('complete_ride', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 3000);
});

driverSocket.on('ride_completed', (data) => {
  logTest('RIDE_COMPLETED', data);
  testResults.rideCompleted = true;
});

driverSocket.on('ride_response_error', (data) => {
  logError('RIDE_RESPONSE_ERROR', data);
});

driverSocket.on('connect_error', (error) => {
  logError('DRIVER_CONNECT_ERROR', error);
});

// Test timeout handler
setTimeout(() => {
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`User Connected: ${testResults.userConnected ? '✅' : '❌'}`);
  console.log(`Driver Connected: ${testResults.driverConnected ? '✅' : '❌'}`);
  console.log(`Ride Booked: ${testResults.rideBooked ? '✅' : '❌'}`);
  console.log(`Ride Request Received: ${testResults.rideRequestReceived ? '✅' : '❌'}`);
  console.log(`Ride Accepted: ${testResults.rideAccepted ? '✅' : '❌'}`);
  console.log(`Ride Completed: ${testResults.rideCompleted ? '✅' : '❌'}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.event}: ${error.error}`);
    });
  }
  
  console.log('\n🧹 Cleaning up connections...');
  userSocket.disconnect();
  driverSocket.disconnect();
  
  // Exit after cleanup
  setTimeout(() => {
    process.exit(0);
  }, 1000);
  
}, 15000); // 15 second timeout

// Start the test
console.log('\n🚀 Starting ride flow test...');

// Wait for connections to establish
setTimeout(() => {
  if (testResults.userConnected && testResults.driverConnected) {
    console.log('📤 User booking ride...');
    userSocket.emit('book_ride', testRideData);
  } else {
    logError('CONNECTION_TIMEOUT', 'Failed to establish connections within timeout');
  }
}, 3000); 