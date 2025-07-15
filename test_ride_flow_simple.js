const io = require('socket.io-client');

// Test configuration
const SOCKET_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'test_user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const TEST_DRIVER_ID = 'test_driver_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

console.log('🧪 Starting Simple Ride Booking Flow Test...');
console.log('Test User ID:', TEST_USER_ID);
console.log('Test Driver ID:', TEST_DRIVER_ID);

// Test results
let testResults = {
  userConnected: false,
  driverConnected: false,
  rideBooked: false,
  driverReceivedRequest: false,
  driverAccepted: false,
  userReceivedAcceptance: false,
  driverMarkedBusy: false,
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

// Create driver socket
const driverSocket = io(SOCKET_URL, {
  query: {
    type: 'driver',
    id: TEST_DRIVER_ID
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
  global.testRideId = data.rideId;
});

userSocket.on('ride_accepted', (data) => {
  console.log('✅ User received ride_accepted:', data);
  testResults.userReceivedAcceptance = true;
});

userSocket.on('ride_response_error', (data) => {
  console.log('❌ User received error:', data);
  testResults.errors.push(`User error: ${data.message}`);
});

// Driver socket event handlers
driverSocket.on('connect', () => {
  console.log('✅ Driver connected');
  testResults.driverConnected = true;
});

driverSocket.on('new_ride_request', (data) => {
  console.log('✅ Driver received ride request:', data);
  testResults.driverReceivedRequest = true;
  
  // Driver accepts the ride
  setTimeout(() => {
    console.log('🚗 Driver accepting ride...');
    driverSocket.emit('ride_response', {
      rideId: data.rideId,
      response: 'accept',
      driverId: TEST_DRIVER_ID,
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 1000);
});

driverSocket.on('ride_accepted_with_details', (data) => {
  console.log('✅ Driver received acceptance confirmation:', data);
  testResults.driverAccepted = true;
  
  // Test that driver is now busy and cannot accept another ride
  setTimeout(() => {
    console.log('🧪 Testing that driver is now busy and cannot accept another ride...');
    driverSocket.emit('ride_response', {
      rideId: 'test_ride_2',
      response: 'accept',
      driverId: TEST_DRIVER_ID,
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 1000);
});

driverSocket.on('ride_response_error', (data) => {
  console.log('❌ Driver received error:', data);
  if (data.message.includes('already busy with another ride')) {
    console.log('✅ Driver correctly blocked from accepting when busy');
    testResults.driverMarkedBusy = true;
  } else {
    testResults.errors.push(`Driver error: ${data.message}`);
  }
});

// Test function
function runTest() {
  console.log('\n🚀 Starting simple test sequence...');
  
  // Wait for all connections
  setTimeout(() => {
    if (!testResults.userConnected || !testResults.driverConnected) {
      console.log('❌ Connection test failed');
      runTestResults();
      return;
    }
    
    console.log('✅ All connections established, waiting 2 seconds for any other drivers to disconnect...');
    
    // Wait a bit to ensure no other drivers are interfering
    setTimeout(() => {
      console.log('🚗 Booking ride...');
      
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
    }, 2000);
    
  }, 3000);
}

// Test results function
function runTestResults() {
  console.log('\n📊 Simple Test Results:');
  console.log('=======================');
  
  // Connection tests
  console.log('\n🔗 Connection Tests:');
  console.log('User Connected:', testResults.userConnected ? '✅' : '❌');
  console.log('Driver Connected:', testResults.driverConnected ? '✅' : '❌');
  
  // Ride booking tests
  console.log('\n🚗 Ride Booking Tests:');
  console.log('Ride Booked:', testResults.rideBooked ? '✅' : '❌');
  console.log('Driver Received Request:', testResults.driverReceivedRequest ? '✅' : '❌');
  
  // Acceptance tests
  console.log('\n✅ Acceptance Tests:');
  console.log('Driver Accepted:', testResults.driverAccepted ? '✅' : '❌');
  console.log('User Received Acceptance:', testResults.userReceivedAcceptance ? '✅' : '❌');
  
  // Driver status tests
  console.log('\n🚗 Driver Status Tests:');
  console.log('Driver Marked Busy After Acceptance:', testResults.driverMarkedBusy ? '✅' : '❌');
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach(error => console.log('-', error));
  }
  
  // Overall test result
  const allPassed = testResults.userConnected && 
                   testResults.driverConnected &&
                   testResults.rideBooked &&
                   testResults.driverReceivedRequest &&
                   testResults.driverAccepted &&
                   testResults.userReceivedAcceptance &&
                   testResults.driverMarkedBusy;
  
  console.log('\n🎯 Overall Test Result:', allPassed ? '✅ PASSED' : '❌ FAILED');
  
  // Cleanup
  userSocket.disconnect();
  driverSocket.disconnect();
  
  process.exit(allPassed ? 0 : 1);
}

// Start test
runTest();

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  runTestResults();
}, 30000); 