const io = require('socket.io-client');

// Test against local server
const SOCKET_URL = 'http://localhost:9092';

// Test results
const results = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: []
};

// Helper function to log with timestamp
const log = (message, data = {}) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
};

// Helper function to assert
const assert = (condition, message) => {
  results.totalTests++;
  if (condition) {
    results.passedTests++;
    log(`✅ PASS: ${message}`);
  } else {
    results.failedTests++;
    log(`❌ FAIL: ${message}`);
    results.errors.push(message);
  }
};

// Test user IDs
const testUserIds = {
  user: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  driver: `test_driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};

log('🧪 Starting Local New Ride Flow Test', { testUserIds });

// Test the new ride flow
async function testNewRideFlow() {
  return new Promise((resolve) => {
    log('🚗 Testing new ride flow with updated server');
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    const driverSocket = io(SOCKET_URL, {
      query: {
        type: 'driver',
        id: testUserIds.driver
      },
      transports: ['polling'],
      timeout: 10000
    });

    let userConnected = false;
    let driverConnected = false;
    let rideRequestCreated = false;
    let driverReceivedRequest = false;
    let rideAccepted = false;
    let rideId = null;

    // User event handlers
    userSocket.on('connect', () => {
      log('🟢 Customer connected');
      userConnected = true;
    });

    userSocket.on('ride_request_created', (data) => {
      log('✅ Customer received ride_request_created event', data);
      rideRequestCreated = true;
      rideId = data.rideId;
      assert(data.success, 'Ride request should be successful');
      assert(data.rideId, 'Ride ID should be provided');
      assert(data.status === 'searching', 'Ride status should be searching');
      assert(data.message.includes('Searching for drivers'), 'Message should indicate searching for drivers');
    });

    userSocket.on('ride_accepted', (data) => {
      log('✅ Customer received ride_accepted event', data);
      rideAccepted = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.driverId === testUserIds.driver, 'Driver ID should match');
      assert(data.status === 'accepted', 'Ride status should be accepted');
    });

    // Driver event handlers
    driverSocket.on('connect', () => {
      log('🟢 Driver connected');
      driverConnected = true;
    });

    driverSocket.on('new_ride_request', (data) => {
      log('🚗 Driver received new ride request', data);
      driverReceivedRequest = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.userId === testUserIds.user, 'User ID should match');
      
      // Driver accepts the ride
      setTimeout(() => {
        log('✅ Driver accepting ride with new event');
        driverSocket.emit('accept_ride', {
          rideId: data.rideId,
          driverId: testUserIds.driver,
          driverName: 'Test Driver',
          driverPhone: '+1234567890',
          estimatedArrival: '5 minutes'
        });
      }, 1000);
    });

    driverSocket.on('ride_accepted_with_details', (data) => {
      log('✅ Driver received ride_accepted_with_details event', data);
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.status === 'accepted', 'Ride status should be accepted');
      assert(data.driverId === testUserIds.driver, 'Driver ID should match');
    });

    // Wait for connections and then request ride
    setTimeout(() => {
      if (userConnected && driverConnected) {
        log('🚗 Customer requesting ride with new event');
        userSocket.emit('request_ride', {
          pickup: {
            latitude: 28.6139,
            longitude: 77.2090,
            address: 'Test Pickup',
            name: 'Test Pickup'
          },
          drop: {
            id: 'test_drop_1',
            name: 'Test Drop',
            address: 'Test Drop Address',
            latitude: 28.6149,
            longitude: 77.2100,
            type: 'test'
          },
          rideType: 'Bike',
          price: 50,
          userId: testUserIds.user
        });
      } else {
        assert(false, 'Both user and driver should connect');
      }
    }, 3000);

    // Wait for complete flow
    setTimeout(() => {
      assert(rideRequestCreated, 'Customer should receive ride_request_created event');
      assert(driverReceivedRequest, 'Driver should receive ride request');
      assert(rideAccepted, 'Customer should receive ride acceptance');
      
      userSocket.disconnect();
      driverSocket.disconnect();
      resolve();
    }, 10000);
  });
}

// Run the test
async function runTest() {
  log('🚀 Starting local new ride flow test');
  
  try {
    await testNewRideFlow();
  } catch (error) {
    log('❌ Test error:', error);
    results.errors.push(error.message);
  }

  // Print results
  log('📊 Test Results', {
    total: results.totalTests,
    passed: results.passedTests,
    failed: results.failedTests,
    successRate: `${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`
  });

  if (results.errors.length > 0) {
    log('❌ Test Errors:', results.errors);
  }

  if (results.failedTests === 0) {
    log('🎉 All tests passed! New ride flow is working locally.');
  } else {
    log('⚠️ Some tests failed. Please check the errors above.');
  }

  process.exit(results.failedTests === 0 ? 0 : 1);
}

// Start test
runTest(); 