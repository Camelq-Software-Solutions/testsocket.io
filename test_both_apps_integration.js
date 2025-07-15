const io = require('socket.io-client');

// Test configuration - use local server
const SERVER_URL = 'http://localhost:9092';
const TEST_USER_ID = 'test_user_' + Date.now();
const TEST_DRIVER_ID = 'test_driver_' + Date.now();

console.log('🧪 Starting comprehensive integration test for both apps...');
console.log('📋 Test Configuration:');
console.log(`   Server: ${SERVER_URL}`);
console.log(`   User ID: ${TEST_USER_ID}`);
console.log(`   Driver ID: ${TEST_DRIVER_ID}`);

// Test results tracking
let testResults = {
  // Connection tests
  userConnected: false,
  driverConnected: false,
  
  // User app tests
  rideBooked: false,
  userNotifiedOfAcceptance: false,
  userReceivedLocationUpdate: false,
  userReceivedStatusUpdate: false,
  userReceivedTimeout: false,
  
  // Driver app tests
  driverReceivedRideRequest: false,
  driverAcceptedRide: false,
  driverReceivedAcceptanceConfirmation: false,
  driverCompletedRide: false,
  
  // Flow tests
  completeRideFlow: false,
  errorHandling: false,
  
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

// Create user socket (testinguser app simulation)
const userSocket = io(SERVER_URL, {
  transports: ['polling'],
  query: {
    type: 'customer',
    id: TEST_USER_ID
  }
});

// Create driver socket (ridersony app simulation)
const driverSocket = io(SERVER_URL, {
  transports: ['polling'],
  query: {
    type: 'driver',
    id: TEST_DRIVER_ID
  }
});

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

// ===== USER APP EVENT HANDLERS (testinguser simulation) =====

userSocket.on('connect', () => {
  logTest('USER_CONNECTED', { socketId: userSocket.id });
  testResults.userConnected = true;
});

userSocket.on('ride_booked', (data) => {
  logTest('USER_RIDE_BOOKED', data);
  testResults.rideBooked = true;
  rideId = data.rideId;
});

userSocket.on('ride_accepted', (data) => {
  logTest('USER_RIDE_ACCEPTED', data);
  testResults.userNotifiedOfAcceptance = true;
});

userSocket.on('driver_location_update', (data) => {
  logTest('USER_LOCATION_UPDATE', data);
  testResults.userReceivedLocationUpdate = true;
});

userSocket.on('ride_status_update', (data) => {
  logTest('USER_STATUS_UPDATE', data);
  testResults.userReceivedStatusUpdate = true;
});

userSocket.on('ride_timeout', (data) => {
  logTest('USER_RIDE_TIMEOUT', data);
  testResults.userReceivedTimeout = true;
});

userSocket.on('driver_offline', (data) => {
  logTest('USER_DRIVER_OFFLINE', data);
});

userSocket.on('driver_disconnected', (data) => {
  logTest('USER_DRIVER_DISCONNECTED', data);
});

userSocket.on('disconnect', () => {
  logTest('USER_DISCONNECTED');
});

userSocket.on('connect_error', (error) => {
  logError('USER_CONNECT_ERROR', error);
});

userSocket.on('ride_response_error', (data) => {
  logError('USER_RIDE_RESPONSE_ERROR', data);
});

// ===== DRIVER APP EVENT HANDLERS (ridersony simulation) =====

driverSocket.on('connect', () => {
  logTest('DRIVER_CONNECTED', { socketId: driverSocket.id });
  testResults.driverConnected = true;
});

driverSocket.on('new_ride_request', (data) => {
  logTest('DRIVER_NEW_RIDE_REQUEST', data);
  testResults.driverReceivedRideRequest = true;
  
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
  }, 1000);
});

driverSocket.on('active_ride_requests', (data) => {
  logTest('DRIVER_ACTIVE_RIDE_REQUESTS', data);
});

driverSocket.on('ride_accepted_with_details', (data) => {
  logTest('DRIVER_RIDE_ACCEPTED_WITH_DETAILS', data);
  testResults.driverAcceptedRide = true;
  testResults.driverReceivedAcceptanceConfirmation = true;
  
  // Send location update
  setTimeout(() => {
    console.log('📍 Driver sending location update...');
    driverSocket.emit('driver_location', {
      driverId: TEST_DRIVER_ID,
      userId: data.userId,
      latitude: 28.6139,
      longitude: 77.2090
    });
  }, 1000);
  
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
  logTest('DRIVER_RIDE_COMPLETED', data);
  testResults.driverCompletedRide = true;
});

driverSocket.on('ride_taken', (data) => {
  logTest('DRIVER_RIDE_TAKEN', data);
});

driverSocket.on('driver_status_reset', (data) => {
  logTest('DRIVER_STATUS_RESET', data);
});

driverSocket.on('ride_status_update', (data) => {
  logTest('DRIVER_STATUS_UPDATE', data);
});

driverSocket.on('ride_response_error', (data) => {
  logError('DRIVER_RIDE_RESPONSE_ERROR', data);
});

driverSocket.on('ride_response_confirmed', (data) => {
  logTest('DRIVER_RIDE_RESPONSE_CONFIRMED', data);
});

driverSocket.on('disconnect', () => {
  logTest('DRIVER_DISCONNECTED');
});

driverSocket.on('connect_error', (error) => {
  logError('DRIVER_CONNECT_ERROR', error);
});

// ===== TEST FLOW =====

// Test timeout handler
setTimeout(() => {
  console.log('\n📊 Integration Test Results Summary:');
  console.log('=====================================');
  
  // Connection tests
  console.log('\n🔗 Connection Tests:');
  console.log(`   User Connected: ${testResults.userConnected ? '✅' : '❌'}`);
  console.log(`   Driver Connected: ${testResults.driverConnected ? '✅' : '❌'}`);
  
  // User app tests
  console.log('\n📱 User App Tests (testinguser):');
  console.log(`   Ride Booked: ${testResults.rideBooked ? '✅' : '❌'}`);
  console.log(`   Notified of Acceptance: ${testResults.userNotifiedOfAcceptance ? '✅' : '❌'}`);
  console.log(`   Received Location Update: ${testResults.userReceivedLocationUpdate ? '✅' : '❌'}`);
  console.log(`   Received Status Update: ${testResults.userReceivedStatusUpdate ? '✅' : '❌'}`);
  
  // Driver app tests
  console.log('\n🚗 Driver App Tests (ridersony):');
  console.log(`   Received Ride Request: ${testResults.driverReceivedRideRequest ? '✅' : '❌'}`);
  console.log(`   Accepted Ride: ${testResults.driverAcceptedRide ? '✅' : '❌'}`);
  console.log(`   Received Acceptance Confirmation: ${testResults.driverReceivedAcceptanceConfirmation ? '✅' : '❌'}`);
  console.log(`   Completed Ride: ${testResults.driverCompletedRide ? '✅' : '❌'}`);
  
  // Flow completion
  const flowComplete = testResults.rideBooked && 
                      testResults.driverReceivedRideRequest && 
                      testResults.driverAcceptedRide && 
                      testResults.userNotifiedOfAcceptance && 
                      testResults.userReceivedLocationUpdate && 
                      testResults.driverCompletedRide && 
                      testResults.userReceivedStatusUpdate;
  
  console.log('\n🔄 Flow Tests:');
  console.log(`   Complete Ride Flow: ${flowComplete ? '✅' : '❌'}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.event}: ${error.error}`);
    });
  }
  
  // Calculate success rate
  const coreTests = [
    'userConnected', 'driverConnected', 'rideBooked', 'driverReceivedRideRequest',
    'driverAcceptedRide', 'userNotifiedOfAcceptance', 'userReceivedLocationUpdate',
    'driverCompletedRide', 'userReceivedStatusUpdate'
  ];
  const passedCoreTests = coreTests.filter(test => testResults[test]).length;
  const successRate = (passedCoreTests / coreTests.length) * 100;
  
  console.log(`\n📈 Integration Success Rate: ${successRate.toFixed(1)}% (${passedCoreTests}/${coreTests.length})`);
  
  if (successRate >= 90) {
    console.log('🎉 Integration Test PASSED! Both apps work correctly with the server.');
  } else {
    console.log('⚠️ Integration Test FAILED! There are issues with the app integration.');
  }
  
  console.log('\n🧹 Cleaning up connections...');
  userSocket.disconnect();
  driverSocket.disconnect();
  
  // Exit after cleanup
  setTimeout(() => {
    process.exit(0);
  }, 1000);
  
}, 20000); // 20 second timeout

// Start the test
console.log('\n🚀 Starting integration test...');

// Book a ride after both connections are established
setTimeout(() => {
  if (testResults.userConnected && testResults.driverConnected) {
    console.log('📱 User booking ride...');
    userSocket.emit('book_ride', testRideData);
  } else {
    console.log('⚠️ Connections not ready, skipping ride booking');
  }
}, 2000); 