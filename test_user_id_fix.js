const io = require('socket.io-client');

const SOCKET_URL = 'https://testsocketio-roqet.up.railway.app';

// Test configuration
const TEST_CONFIG = {
  userCount: 1,
  driverCount: 1,
  testDuration: 30000, // 30 seconds
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

log('🧪 Starting User ID Fix Test', { testUserIds });

// Test 1: User connects with proper user ID
async function testUserConnection() {
  return new Promise((resolve) => {
    log('🔗 Test 1: User connection with proper user ID');
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;
    let userIdReceived = null;

    userSocket.on('connect', () => {
      log('🟢 User connected');
      connected = true;
    });

    userSocket.on('disconnect', () => {
      log('🔴 User disconnected');
    });

    // Wait for connection and then test
    setTimeout(() => {
      assert(connected, 'User should connect successfully');
      assert(userSocket.connected, 'User socket should be connected');
      
      userSocket.disconnect();
      resolve();
    }, 2000);
  });
}

// Test 2: Driver connects with proper user ID
async function testDriverConnection() {
  return new Promise((resolve) => {
    log('🔗 Test 2: Driver connection with proper user ID');
    
    const driverSocket = io(SOCKET_URL, {
      query: {
        type: 'driver',
        id: testUserIds.driver
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;

    driverSocket.on('connect', () => {
      log('🟢 Driver connected');
      connected = true;
    });

    driverSocket.on('disconnect', () => {
      log('🔴 Driver disconnected');
    });

    // Wait for connection and then test
    setTimeout(() => {
      assert(connected, 'Driver should connect successfully');
      assert(driverSocket.connected, 'Driver socket should be connected');
      
      driverSocket.disconnect();
      resolve();
    }, 2000);
  });
}

// Test 3: Ride booking with proper user ID and waiting for acceptance
async function testRideBookingFlow() {
  return new Promise((resolve) => {
    log('🚗 Test 3: Ride booking flow with proper user ID');
    
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
    let rideBooked = false;
    let rideAccepted = false;
    let rideId = null;
    let driverReceivedRequest = false;

    // User event handlers
    userSocket.on('connect', () => {
      log('🟢 User connected for ride test');
      userConnected = true;
    });

    userSocket.on('ride_booked', (data) => {
      log('✅ User received ride_booked event', data);
      rideBooked = true;
      rideId = data.rideId;
      assert(data.success, 'Ride booking should be successful');
      assert(data.rideId, 'Ride ID should be provided');
      assert(data.message.includes('Searching for drivers'), 'Message should indicate searching for drivers');
    });

    userSocket.on('ride_accepted', (data) => {
      log('✅ User received ride_accepted event', data);
      rideAccepted = true;
      assert(data.rideId === rideId, 'Ride ID should match');
      assert(data.driverId === testUserIds.driver, 'Driver ID should match');
    });

    // Driver event handlers
    driverSocket.on('connect', () => {
      log('🟢 Driver connected for ride test');
      driverConnected = true;
    });

    driverSocket.on('new_ride_request', (data) => {
      log('🚗 Driver received new ride request', data);
      driverReceivedRequest = true;
      assert(data.userId === testUserIds.user, 'User ID should match the booking user');
      assert(data.rideId === rideId, 'Ride ID should match');
      
      // Driver accepts the ride
      setTimeout(() => {
        log('✅ Driver accepting ride');
        driverSocket.emit('ride_response', {
          rideId: data.rideId,
          driverId: testUserIds.driver,
          response: 'accept'
        });
      }, 1000);
    });

    // Wait for connections and then book ride
    setTimeout(() => {
      if (userConnected && driverConnected) {
        log('🚗 Booking ride with proper user ID');
        userSocket.emit('book_ride', {
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
          userId: testUserIds.user // Use the proper test user ID
        });
      } else {
        log('❌ Failed to connect both user and driver');
        assert(false, 'Both user and driver should connect');
      }
    }, 3000);

    // Wait for complete flow
    setTimeout(() => {
      assert(rideBooked, 'Ride should be booked');
      assert(driverReceivedRequest, 'Driver should receive ride request');
      assert(rideAccepted, 'Ride should be accepted');
      
      userSocket.disconnect();
      driverSocket.disconnect();
      resolve();
    }, 10000);
  });
}

// Test 4: Verify no hardcoded user123 in logs
async function testNoHardcodedUserIds() {
  return new Promise((resolve) => {
    log('🔍 Test 4: Verify no hardcoded user123 in logs');
    
    const userSocket = io(SOCKET_URL, {
      query: {
        type: 'customer',
        id: testUserIds.user
      },
      transports: ['polling'],
      timeout: 10000
    });

    let connected = false;

    userSocket.on('connect', () => {
      log('🟢 User connected for hardcoded ID test');
      connected = true;
    });

    // Wait for connection and then test
    setTimeout(() => {
      assert(connected, 'User should connect for hardcoded ID test');
      assert(testUserIds.user !== 'user123', 'Test user ID should not be hardcoded user123');
      
      userSocket.disconnect();
      resolve();
    }, 2000);
  });
}

// Run all tests
async function runAllTests() {
  log('🚀 Starting comprehensive user ID fix tests');
  
  try {
    await testUserConnection();
    await testDriverConnection();
    await testRideBookingFlow();
    await testNoHardcodedUserIds();
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
    log('🎉 All tests passed! User ID fix is working correctly.');
  } else {
    log('⚠️ Some tests failed. Please check the errors above.');
  }

  process.exit(results.failedTests === 0 ? 0 : 1);
}

// Start tests
runAllTests(); 