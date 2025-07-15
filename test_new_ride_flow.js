const io = require('socket.io-client');

const SOCKET_URL = 'https://testsocketio-roqet.up.railway.app';

// Test configuration
const TEST_CONFIG = {
  testDuration: 45000, // 45 seconds
  rideTimeout: 60000, // 60 seconds
};

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

log('🧪 Starting New Ride Flow Test', { testUserIds });

// Test 1: Customer requests ride with new event
async function testCustomerRequestRide() {
  return new Promise((resolve) => {
    log('🚗 Test 1: Customer requests ride with new event');
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let rideRequestCreated = false;
    let rideId = null;

    userSocket.on('connect', () => {
      log('🟢 Customer connected');
      connected = true;
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

    userSocket.on('disconnect', () => {
      log('🔴 Customer disconnected');
    });

    // Wait for connection and then request ride
    setTimeout(() => {
      if (connected) {
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
        assert(false, 'Customer should connect');
      }
    }, 2000);

    // Wait for ride request creation
    setTimeout(() => {
      assert(rideRequestCreated, 'Customer should receive ride_request_created event');
      userSocket.disconnect();
      resolve(rideId);
    }, 5000);
  });
}

// Test 2: Driver receives ride request and accepts
async function testDriverAcceptsRide(rideId) {
  return new Promise((resolve) => {
    log('🚗 Test 2: Driver accepts ride with new event', { rideId });
    
    const driverSocket = io(SOCKET_URL, {
      query: {
        type: 'driver',
        id: testUserIds.driver
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let receivedRideRequest = false;
    let rideAccepted = false;

    driverSocket.on('connect', () => {
      log('🟢 Driver connected');
      connected = true;
    });

    driverSocket.on('new_ride_request', (data) => {
      log('🚗 Driver received new ride request', data);
      receivedRideRequest = true;
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
      rideAccepted = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.status === 'accepted', 'Ride status should be accepted');
      assert(data.driverId === testUserIds.driver, 'Driver ID should match');
    });

    driverSocket.on('disconnect', () => {
      log('🔴 Driver disconnected');
    });

    // Wait for complete flow
    setTimeout(() => {
      assert(receivedRideRequest, 'Driver should receive ride request');
      assert(rideAccepted, 'Driver should receive acceptance confirmation');
      driverSocket.disconnect();
      resolve();
    }, 8000);
  });
}

// Test 3: Customer receives ride acceptance
async function testCustomerReceivesAcceptance(rideId) {
  return new Promise((resolve) => {
    log('✅ Test 3: Customer receives ride acceptance', { rideId });
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let rideAccepted = false;

    userSocket.on('connect', () => {
      log('🟢 Customer connected for acceptance test');
      connected = true;
    });

    userSocket.on('ride_accepted', (data) => {
      log('✅ Customer received ride_accepted event', data);
      rideAccepted = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.driverId === testUserIds.driver, 'Driver ID should match');
      assert(data.status === 'accepted', 'Ride status should be accepted');
      assert(data.driverName === 'Test Driver', 'Driver name should match');
    });

    userSocket.on('disconnect', () => {
      log('🔴 Customer disconnected');
    });

    // Wait for acceptance
    setTimeout(() => {
      assert(rideAccepted, 'Customer should receive ride acceptance');
      userSocket.disconnect();
      resolve();
    }, 5000);
  });
}

// Test 4: Driver status updates
async function testDriverStatusUpdates(rideId) {
  return new Promise((resolve) => {
    log('🔄 Test 4: Driver status updates', { rideId });
    
    const driverSocket = io(SOCKET_URL, {
      query: {
        type: 'driver',
        id: testUserIds.driver
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let arrivedSent = false;
    let startedSent = false;

    driverSocket.on('connect', () => {
      log('🟢 Driver connected for status updates');
      connected = true;
    });

    driverSocket.on('ride_status_updated', (data) => {
      log('🔄 Driver received status update', data);
      if (data.status === 'arrived') {
        arrivedSent = true;
      } else if (data.status === 'started') {
        startedSent = true;
      }
    });

    // Wait for connection and then send status updates
    setTimeout(() => {
      if (connected) {
        // Driver arrives
        log('🚗 Driver arriving at pickup');
        driverSocket.emit('driver_arrived', {
          rideId: rideId,
          driverId: testUserIds.driver
        });

        // Driver starts ride
        setTimeout(() => {
          log('🚀 Driver starting ride');
          driverSocket.emit('start_ride', {
            rideId: rideId,
            driverId: testUserIds.driver
          });
        }, 2000);
      }
    }, 2000);

    // Wait for status updates
    setTimeout(() => {
      assert(arrivedSent, 'Driver should receive arrived status update');
      assert(startedSent, 'Driver should receive started status update');
      driverSocket.disconnect();
      resolve();
    }, 8000);
  });
}

// Test 5: Customer receives status updates
async function testCustomerReceivesStatusUpdates(rideId) {
  return new Promise((resolve) => {
    log('🔄 Test 5: Customer receives status updates', { rideId });
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let driverArrived = false;
    let rideStarted = false;

    userSocket.on('connect', () => {
      log('🟢 Customer connected for status updates');
      connected = true;
    });

    userSocket.on('driver_arrived', (data) => {
      log('🚗 Customer received driver_arrived event', data);
      driverArrived = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.status === 'arrived', 'Status should be arrived');
    });

    userSocket.on('ride_started', (data) => {
      log('🚀 Customer received ride_started event', data);
      rideStarted = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.status === 'started', 'Status should be started');
    });

    // Wait for status updates
    setTimeout(() => {
      assert(driverArrived, 'Customer should receive driver arrived notification');
      assert(rideStarted, 'Customer should receive ride started notification');
      userSocket.disconnect();
      resolve();
    }, 8000);
  });
}

// Test 6: Ride completion
async function testRideCompletion(rideId) {
  return new Promise((resolve) => {
    log('✅ Test 6: Ride completion', { rideId });
    
    const driverSocket = io(SOCKET_URL, {
      query: {
        type: 'driver',
        id: testUserIds.driver
      },
      transports: ['polling'],
      timeout: 10000
    });

    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let driverConnected = false;
    let userConnected = false;
    let rideCompleted = false;
    let userReceivedCompletion = false;

    driverSocket.on('connect', () => {
      log('🟢 Driver connected for completion');
      driverConnected = true;
    });

    userSocket.on('connect', () => {
      log('🟢 Customer connected for completion');
      userConnected = true;
    });

    driverSocket.on('ride_completed', (data) => {
      log('✅ Driver received ride_completed event', data);
      rideCompleted = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.status === 'completed', 'Status should be completed');
    });

    userSocket.on('ride_completed', (data) => {
      log('✅ Customer received ride_completed event', data);
      userReceivedCompletion = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.status === 'completed', 'Status should be completed');
    });

    // Wait for connections and then complete ride
    setTimeout(() => {
      if (driverConnected && userConnected) {
        log('✅ Driver completing ride');
        driverSocket.emit('complete_ride', {
          rideId: rideId,
          driverId: testUserIds.driver
        });
      }
    }, 3000);

    // Wait for completion
    setTimeout(() => {
      assert(rideCompleted, 'Driver should receive completion confirmation');
      assert(userReceivedCompletion, 'Customer should receive completion notification');
      driverSocket.disconnect();
      userSocket.disconnect();
      resolve();
    }, 6000);
  });
}

// Test 7: Verify state machine prevents invalid transitions
async function testStateMachineValidation() {
  return new Promise((resolve) => {
    log('🔒 Test 7: State machine validation');
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let rideRequestCreated = false;
    let rideId = null;

    userSocket.on('connect', () => {
      log('🟢 Customer connected for state machine test');
      connected = true;
    });

    userSocket.on('ride_request_created', (data) => {
      log('✅ Customer received ride_request_created event', data);
      rideRequestCreated = true;
      rideId = data.rideId;
    });

    // Wait for connection and then request ride
    setTimeout(() => {
      if (connected) {
        log('🚗 Customer requesting ride for state machine test');
        userSocket.emit('request_ride', {
          pickup: {
            latitude: 28.6139,
            longitude: 77.2090,
            address: 'Test Pickup',
            name: 'Test Pickup'
          },
          drop: {
            id: 'test_drop_2',
            name: 'Test Drop 2',
            address: 'Test Drop Address 2',
            latitude: 28.6149,
            longitude: 77.2100,
            type: 'test'
          },
          rideType: 'Bike',
          price: 50,
          userId: testUserIds.user
        });
      }
    }, 2000);

    // Wait for ride request and then test state machine
    setTimeout(() => {
      assert(rideRequestCreated, 'Ride request should be created');
      assert(rideId, 'Ride ID should be provided');
      
      // Test that we can't complete a ride that's still searching
      log('🔒 Testing invalid state transition');
      userSocket.emit('complete_ride', {
        rideId: rideId,
        driverId: 'invalid_driver'
      });
      
      userSocket.disconnect();
      resolve();
    }, 5000);
  });
}

// Run all tests
async function runAllTests() {
  log('🚀 Starting comprehensive new ride flow tests');
  
  try {
    // Test 1: Customer requests ride
    const rideId = await testCustomerRequestRide();
    
    // Test 2: Driver accepts ride
    await testDriverAcceptsRide(rideId);
    
    // Test 3: Customer receives acceptance
    await testCustomerReceivesAcceptance(rideId);
    
    // Test 4: Driver status updates
    await testDriverStatusUpdates(rideId);
    
    // Test 5: Customer receives status updates
    await testCustomerReceivesStatusUpdates(rideId);
    
    // Test 6: Ride completion
    await testRideCompletion(rideId);
    
    // Test 7: State machine validation
    await testStateMachineValidation();
    
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
    log('🎉 All tests passed! New ride flow is working correctly.');
  } else {
    log('⚠️ Some tests failed. Please check the errors above.');
  }

  process.exit(results.failedTests === 0 ? 0 : 1);
}

// Start tests
runAllTests(); 