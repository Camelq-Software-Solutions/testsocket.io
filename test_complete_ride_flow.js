const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'user_2zv6uUEVerLOtFV1A3ZfMuOo05o';
const TEST_DRIVER_ID = 'user_2zmThgmdF5YItg7OoypHCaDt3KH';

// Test results tracking
const testResults = {
  customerConnected: false,
  driverConnected: false,
  rideRequested: false,
  rideAccepted: false,
  driverArrived: false,
  rideStarted: false,
  rideCompleted: false,
  customerReceivedDriverArrived: false,
  customerReceivedRideStarted: false,
  customerReceivedRideCompleted: false
};

// Helper function to log test events
const logTest = (event, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🧪 ${event}:`, JSON.stringify(data, null, 2));
};

// Helper function to check test completion
const checkTestCompletion = () => {
  const allPassed = Object.values(testResults).every(result => result === true);
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Complete ride flow is working correctly.');
    console.log('\n📋 Test Summary:');
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${test}`);
    });
    process.exit(0);
  }
};

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

// Customer socket event listeners
customerSocket.on('connect', () => {
  logTest('CUSTOMER_CONNECTED', { socketId: customerSocket.id });
  testResults.customerConnected = true;
  
  // Request a ride after connection
  setTimeout(() => {
    logTest('CUSTOMER_REQUESTING_RIDE');
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

customerSocket.on('ride_request_created', (data) => {
  logTest('CUSTOMER_RIDE_REQUEST_CREATED', data);
  testResults.rideRequested = true;
});

customerSocket.on('ride_accepted', (data) => {
  logTest('CUSTOMER_RIDE_ACCEPTED', data);
  testResults.rideAccepted = true;
});

customerSocket.on('driver_arrived', (data) => {
  logTest('CUSTOMER_DRIVER_ARRIVED', data);
  testResults.customerReceivedDriverArrived = true;
  checkTestCompletion();
});

customerSocket.on('ride_started', (data) => {
  logTest('CUSTOMER_RIDE_STARTED', data);
  testResults.customerReceivedRideStarted = true;
  checkTestCompletion();
});

customerSocket.on('ride_completed', (data) => {
  logTest('CUSTOMER_RIDE_COMPLETED', data);
  testResults.customerReceivedRideCompleted = true;
  checkTestCompletion();
});

// Driver socket event listeners
driverSocket.on('connect', () => {
  logTest('DRIVER_CONNECTED', { socketId: driverSocket.id });
  testResults.driverConnected = true;
});

driverSocket.on('new_ride_request', (data) => {
  logTest('DRIVER_RECEIVED_RIDE_REQUEST', data);
  
  // Accept the ride after a short delay
  setTimeout(() => {
    logTest('DRIVER_ACCEPTING_RIDE');
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
  logTest('DRIVER_RIDE_ACCEPTED_WITH_DETAILS', data);
  testResults.rideAccepted = true;
  
  // Simulate driver arriving at pickup after 3 seconds
  setTimeout(() => {
    logTest('DRIVER_ARRIVING_AT_PICKUP');
    driverSocket.emit('driver_arrived', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 3000);
});

driverSocket.on('ride_status_updated', (data) => {
  logTest('DRIVER_RIDE_STATUS_UPDATED', data);
  
  if (data.status === 'arrived') {
    testResults.driverArrived = true;
    
    // Simulate starting the ride after 2 seconds (after MPIN entry)
    setTimeout(() => {
      logTest('DRIVER_STARTING_RIDE');
      driverSocket.emit('start_ride', {
        rideId: data.rideId,
        driverId: TEST_DRIVER_ID
      });
    }, 2000);
  }
  
  if (data.status === 'started') {
    testResults.rideStarted = true;
    
    // Simulate completing the ride after 3 seconds
    setTimeout(() => {
      logTest('DRIVER_COMPLETING_RIDE');
      driverSocket.emit('complete_ride', {
        rideId: data.rideId,
        driverId: TEST_DRIVER_ID
      });
    }, 3000);
  }
  
  if (data.status === 'completed') {
    testResults.rideCompleted = true;
    checkTestCompletion();
  }
});

// Error handling
customerSocket.on('connect_error', (error) => {
  console.error('❌ Customer connection error:', error.message);
});

driverSocket.on('connect_error', (error) => {
  console.error('❌ Driver connection error:', error.message);
});

customerSocket.on('disconnect', (reason) => {
  console.log('🔴 Customer disconnected:', reason);
});

driverSocket.on('disconnect', (reason) => {
  console.log('🔴 Driver disconnected:', reason);
});

// Timeout to prevent hanging
setTimeout(() => {
  console.log('\n⏰ Test timeout reached. Current results:');
  Object.entries(testResults).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
  });
  process.exit(1);
}, 30000); // 30 second timeout

console.log('🚀 Starting complete ride flow test...');
console.log('📋 Testing: Customer Request → Driver Accept → Driver Arrive → MPIN Entry → Ride Start → Ride Complete');
console.log('⏱️  Test will timeout after 30 seconds\n'); 