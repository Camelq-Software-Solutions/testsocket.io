const io = require('socket.io-client');

// Test configuration
const SOCKET_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'test_user_' + Date.now();
const TEST_DRIVER_ID_1 = 'test_driver_1_' + Date.now();
const TEST_DRIVER_ID_2 = 'test_driver_2_' + Date.now();

console.log('🧪 Starting Enhanced Ride Booking Flow Test...');
console.log('Test User ID:', TEST_USER_ID);
console.log('Test Driver 1 ID:', TEST_DRIVER_ID_1);
console.log('Test Driver 2 ID:', TEST_DRIVER_ID_2);

// Test results
let testResults = {
  // Connection tests
  userConnected: false,
  driver1Connected: false,
  driver2Connected: false,
  
  // Ride booking tests
  rideBooked: false,
  driver1ReceivedRequest: false,
  driver2ReceivedRequest: false,
  
  // Acceptance tests
  driver1Accepted: false,
  driver2ReceivedTaken: false,
  userReceivedAcceptance: false,
  
  // Duplicate prevention tests
  driver1DuplicateAttemptBlocked: false,
  userDuplicateBookingBlocked: false,
  
  // Socket reconnection tests
  userReconnectionSuccessful: false,
  
  errors: []
};

// Create user socket
const userSocket = io(SOCKET_URL, {
  query: {
    type: 'customer',
    id: TEST_USER_ID
  },
  transports: ['polling']
});

// Create driver 1 socket
const driver1Socket = io(SOCKET_URL, {
  query: {
    type: 'driver',
    id: TEST_DRIVER_ID_1
  },
  transports: ['polling']
});

// Create driver 2 socket
const driver2Socket = io(SOCKET_URL, {
  query: {
    type: 'driver',
    id: TEST_DRIVER_ID_2
  },
  transports: ['polling']
});

// User socket event handlers
userSocket.on('connect', () => {
  console.log('✅ User connected');
  testResults.userConnected = true;
});

userSocket.on('ride_booked', (data) => {
  console.log('✅ User received ride_booked:', data);
  testResults.rideBooked = true;
  
  // Store ride ID for driver acceptance test
  global.testRideId = data.rideId;
  
  // Test duplicate booking prevention
  setTimeout(() => {
    console.log('🧪 Testing duplicate booking prevention...');
    userSocket.emit('book_ride', {
      userId: TEST_USER_ID,
      pickup: {
        latitude: 17.444,
        longitude: 78.382,
        address: 'Test Pickup 2',
        name: 'Test Pickup 2'
      },
      drop: {
        id: 'test_drop_2',
        name: 'Test Drop 2',
        address: 'Test Drop Address 2',
        latitude: 17.4418,
        longitude: 78.38,
        type: 'test'
      },
      rideType: 'Bike',
      price: 50
    });
  }, 2000);
});

userSocket.on('ride_accepted', (data) => {
  console.log('✅ User received ride_accepted:', data);
  testResults.userReceivedAcceptance = true;
  
  // Test socket reconnection
  setTimeout(() => {
    console.log('🧪 Testing socket reconnection...');
    userSocket.disconnect();
    setTimeout(() => {
      userSocket.connect();
    }, 1000);
  }, 1000);
});

userSocket.on('ride_response_error', (data) => {
  console.log('❌ User received error:', data);
  if (data.message.includes('already have an active ride request')) {
    console.log('✅ Duplicate booking correctly blocked');
    testResults.userDuplicateBookingBlocked = true;
  } else {
    testResults.errors.push(`User error: ${data.message}`);
  }
});

userSocket.on('reconnect', () => {
  console.log('✅ User reconnected successfully');
  testResults.userReconnectionSuccessful = true;
});

// Driver 1 socket event handlers
driver1Socket.on('connect', () => {
  console.log('✅ Driver 1 connected');
  testResults.driver1Connected = true;
});

driver1Socket.on('new_ride_request', (data) => {
  console.log('✅ Driver 1 received ride request:', data);
  testResults.driver1ReceivedRequest = true;
  
  // Driver 1 accepts the ride
  setTimeout(() => {
    console.log('🚗 Driver 1 accepting ride...');
    driver1Socket.emit('ride_response', {
      rideId: data.rideId,
      response: 'accept',
      driverId: TEST_DRIVER_ID_1,
      driverName: 'Test Driver 1',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
    
    // Test duplicate acceptance attempt
    setTimeout(() => {
      console.log('🧪 Testing duplicate acceptance prevention...');
      driver1Socket.emit('ride_response', {
        rideId: data.rideId,
        response: 'accept',
        driverId: TEST_DRIVER_ID_1,
        driverName: 'Test Driver 1',
        driverPhone: '+1234567890',
        estimatedArrival: '5 minutes'
      });
    }, 1000);
  }, 1000);
});

driver1Socket.on('ride_accepted_with_details', (data) => {
  console.log('✅ Driver 1 received acceptance confirmation:', data);
  testResults.driver1Accepted = true;
});

driver1Socket.on('ride_response_error', (data) => {
  console.log('❌ Driver 1 received error:', data);
  if (data.message.includes('already attempted to accept this ride')) {
    console.log('✅ Duplicate acceptance correctly blocked');
    testResults.driver1DuplicateAttemptBlocked = true;
  } else {
    testResults.errors.push(`Driver 1 error: ${data.message}`);
  }
});

// Driver 2 socket event handlers
driver2Socket.on('connect', () => {
  console.log('✅ Driver 2 connected');
  testResults.driver2Connected = true;
});

driver2Socket.on('new_ride_request', (data) => {
  console.log('✅ Driver 2 received ride request:', data);
  testResults.driver2ReceivedRequest = true;
  
  // Driver 2 tries to accept the same ride (should fail)
  setTimeout(() => {
    console.log('🚗 Driver 2 attempting to accept ride (should fail)...');
    driver2Socket.emit('ride_response', {
      rideId: data.rideId,
      response: 'accept',
      driverId: TEST_DRIVER_ID_2,
      driverName: 'Test Driver 2',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 2000);
});

driver2Socket.on('ride_taken', (data) => {
  console.log('✅ Driver 2 received ride_taken notification:', data);
  testResults.driver2ReceivedTaken = true;
});

driver2Socket.on('ride_response_error', (data) => {
  console.log('❌ Driver 2 received error (expected):', data);
  // This error is expected for driver 2
});

// Test function
function runTest() {
  console.log('\n🚀 Starting enhanced test sequence...');
  
  // Wait for all connections
  setTimeout(() => {
    if (!testResults.userConnected || !testResults.driver1Connected || !testResults.driver2Connected) {
      console.log('❌ Connection test failed');
      runTestResults();
      return;
    }
    
    console.log('✅ All connections established, booking ride...');
    
    // Book a ride
    userSocket.emit('book_ride', {
      userId: TEST_USER_ID,
      pickup: {
        latitude: 17.444,
        longitude: 78.382,
        address: 'Test Pickup',
        name: 'Test Pickup'
      },
      drop: {
        id: 'test_drop_1',
        name: 'Test Drop',
        address: 'Test Drop Address',
        latitude: 17.4418,
        longitude: 78.38,
        type: 'test'
      },
      rideType: 'Bike',
      price: 50
    });
    
  }, 3000);
}

// Test results function
function runTestResults() {
  console.log('\n📊 Enhanced Test Results:');
  console.log('========================');
  
  // Connection tests
  console.log('\n🔗 Connection Tests:');
  console.log('User Connected:', testResults.userConnected ? '✅' : '❌');
  console.log('Driver 1 Connected:', testResults.driver1Connected ? '✅' : '❌');
  console.log('Driver 2 Connected:', testResults.driver2Connected ? '✅' : '❌');
  
  // Ride booking tests
  console.log('\n🚗 Ride Booking Tests:');
  console.log('Ride Booked:', testResults.rideBooked ? '✅' : '❌');
  console.log('Driver 1 Received Request:', testResults.driver1ReceivedRequest ? '✅' : '❌');
  console.log('Driver 2 Received Request:', testResults.driver2ReceivedRequest ? '✅' : '❌');
  
  // Acceptance tests
  console.log('\n✅ Acceptance Tests:');
  console.log('Driver 1 Accepted:', testResults.driver1Accepted ? '✅' : '❌');
  console.log('Driver 2 Received Taken Notification:', testResults.driver2ReceivedTaken ? '✅' : '❌');
  console.log('User Received Acceptance:', testResults.userReceivedAcceptance ? '✅' : '❌');
  
  // Duplicate prevention tests
  console.log('\n🚫 Duplicate Prevention Tests:');
  console.log('Driver 1 Duplicate Attempt Blocked:', testResults.driver1DuplicateAttemptBlocked ? '✅' : '❌');
  console.log('User Duplicate Booking Blocked:', testResults.userDuplicateBookingBlocked ? '✅' : '❌');
  
  // Socket reconnection tests
  console.log('\n🔄 Socket Reconnection Tests:');
  console.log('User Reconnection Successful:', testResults.userReconnectionSuccessful ? '✅' : '❌');
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach(error => console.log('-', error));
  }
  
  // Overall test result
  const allPassed = testResults.userConnected && 
                   testResults.driver1Connected && 
                   testResults.driver2Connected &&
                   testResults.rideBooked &&
                   testResults.driver1ReceivedRequest &&
                   testResults.driver2ReceivedRequest &&
                   testResults.driver1Accepted &&
                   testResults.driver2ReceivedTaken &&
                   testResults.userReceivedAcceptance &&
                   testResults.driver1DuplicateAttemptBlocked &&
                   testResults.userDuplicateBookingBlocked &&
                   testResults.userReconnectionSuccessful;
  
  console.log('\n🎯 Overall Test Result:', allPassed ? '✅ PASSED' : '❌ FAILED');
  
  // Cleanup
  userSocket.disconnect();
  driver1Socket.disconnect();
  driver2Socket.disconnect();
  
  process.exit(allPassed ? 0 : 1);
}

// Start test
runTest();

// Timeout after 45 seconds (increased for enhanced tests)
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  runTestResults();
}, 45000); 