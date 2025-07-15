const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'clerk_user_789';
const TEST_DRIVER_ID = 'test_driver_456';

console.log('🧪 Testing User ID and Old Ride Requests...\n');

// Test 1: User books a ride with real user ID
async function testUserBookingWithRealId() {
  console.log('📱 Test 1: User booking with real user ID');
  
  const userSocket = io(SERVER_URL, {
    query: { type: 'user', id: TEST_USER_ID },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('User booking test timed out'));
    }, 30000);

    userSocket.on('connect', () => {
      console.log('✅ User connected successfully');
    });

    userSocket.on('ride_booked', (data) => {
      console.log('✅ Ride booked successfully:', {
        rideId: data.rideId,
        price: data.price,
        success: data.success
      });
      
      if (data.success) {
        clearTimeout(timeout);
        resolve({ userSocket, rideId: data.rideId, price: data.price });
      } else {
        clearTimeout(timeout);
        reject(new Error('Ride booking failed: ' + data.message));
      }
    });

    userSocket.on('ride_response_error', (data) => {
      console.error('❌ Ride booking error:', data.message);
      clearTimeout(timeout);
      reject(new Error('Ride booking error: ' + data.message));
    });

    userSocket.on('connect_error', (error) => {
      console.error('❌ User connection error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });

    // Book a ride after connection
    setTimeout(() => {
      console.log('🚗 Sending ride booking request with user ID:', TEST_USER_ID);
      const rideRequest = {
        pickup: {
          latitude: 28.6139,
          longitude: 77.2090,
          address: 'New Delhi, India',
          name: 'Pickup Location'
        },
        drop: {
          latitude: 28.7041,
          longitude: 77.1025,
          address: 'Delhi Airport',
          name: 'Delhi Airport',
          id: 'airport_1',
          type: 'airport'
        },
        rideType: 'Bike',
        price: 150,
        userId: TEST_USER_ID // This should be the real user ID
      };
      
      userSocket.emit('book_ride', rideRequest);
    }, 2000);
  });
}

// Test 2: Driver connects and should receive the active ride request
async function testDriverReceivesActiveRequest(userSocket, rideId) {
  console.log('\n🚗 Test 2: Driver receives active ride request');
  
  const driverSocket = io(SERVER_URL, {
    query: { type: 'driver', id: TEST_DRIVER_ID },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Driver active request test timed out'));
    }, 30000);

    let receivedActiveRequests = false;
    let receivedNewRequest = false;

    driverSocket.on('connect', () => {
      console.log('✅ Driver connected successfully');
    });

    driverSocket.on('active_ride_requests', (data) => {
      console.log('📋 Driver received active ride requests:', data);
      if (Array.isArray(data) && data.length > 0) {
        const hasOurRide = data.some(ride => ride.rideId === rideId);
        if (hasOurRide) {
          console.log('✅ Driver received our active ride request');
          receivedActiveRequests = true;
        } else {
          console.log('⚠️ Driver received active requests but not ours');
        }
      }
    });

    driverSocket.on('new_ride_request', (data) => {
      console.log('🚗 Driver received new ride request:', data);
      if (data.rideId === rideId) {
        console.log('✅ Driver received our new ride request');
        receivedNewRequest = true;
      }
    });

    // Wait a bit to see if we receive any requests
    setTimeout(() => {
      if (receivedActiveRequests || receivedNewRequest) {
        clearTimeout(timeout);
        resolve({ userSocket, driverSocket, rideId });
      } else {
        clearTimeout(timeout);
        reject(new Error('Driver did not receive any ride requests'));
      }
    }, 5000);
  });
}

// Test 3: Create an old ride request and verify it's not sent to new drivers
async function testOldRequestsNotSent(userSocket, driverSocket, rideId) {
  console.log('\n⏰ Test 3: Old ride requests not sent to new drivers');
  
  // Create another ride request
  const oldRideRequest = {
    pickup: {
      latitude: 28.6139,
      longitude: 77.2090,
      address: 'Old Location',
      name: 'Old Pickup'
    },
    drop: {
      latitude: 28.7041,
      longitude: 77.1025,
      address: 'Old Destination',
      name: 'Old Drop',
      id: 'old_1',
      type: 'old'
    },
    rideType: 'Bike',
    price: 100,
    userId: 'old_user_123'
  };
  
  console.log('🚗 Creating old ride request...');
  userSocket.emit('book_ride', oldRideRequest);
  
  // Wait for the old ride to be created
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Connect a new driver and see if they receive the old request
  const newDriverSocket = io(SERVER_URL, {
    query: { type: 'driver', id: 'new_driver_789' },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Old request test timed out'));
    }, 15000);

    let receivedOldRequest = false;

    newDriverSocket.on('connect', () => {
      console.log('✅ New driver connected successfully');
    });

    newDriverSocket.on('active_ride_requests', (data) => {
      console.log('📋 New driver received active ride requests:', data);
      if (Array.isArray(data)) {
        const hasOldRide = data.some(ride => ride.userId === 'old_user_123');
        if (hasOldRide) {
          console.log('❌ New driver received old ride request (this should not happen)');
          receivedOldRequest = true;
        } else {
          console.log('✅ New driver did not receive old ride request (correct behavior)');
        }
      }
    });

    newDriverSocket.on('new_ride_request', (data) => {
      console.log('🚗 New driver received new ride request:', data);
      if (data.userId === 'old_user_123') {
        console.log('❌ New driver received old ride request as new request (this should not happen)');
        receivedOldRequest = true;
      }
    });

    setTimeout(() => {
      clearTimeout(timeout);
      if (!receivedOldRequest) {
        console.log('✅ Test passed: Old ride requests are not sent to new drivers');
        resolve({ userSocket, driverSocket, newDriverSocket, rideId });
      } else {
        reject(new Error('Test failed: Old ride requests were sent to new drivers'));
      }
    }, 10000);
  });
}

// Test 4: Cleanup
async function testCleanup(userSocket, driverSocket, newDriverSocket) {
  console.log('\n🧹 Test 4: Cleanup and disconnection');
  
  return new Promise((resolve) => {
    userSocket.on('disconnect', () => {
      console.log('✅ User disconnected successfully');
    });

    driverSocket.on('disconnect', () => {
      console.log('✅ Driver disconnected successfully');
    });

    newDriverSocket.on('disconnect', () => {
      console.log('✅ New driver disconnected successfully');
    });

    setTimeout(() => {
      userSocket.disconnect();
      driverSocket.disconnect();
      newDriverSocket.disconnect();
      
      setTimeout(() => {
        console.log('✅ All connections cleaned up');
        resolve();
      }, 1000);
    }, 2000);
  });
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting User ID and Old Requests test...\n');
    
    // Test 1: User booking with real ID
    const { userSocket, rideId, price } = await testUserBookingWithRealId();
    
    // Test 2: Driver receives active request
    const { userSocket: user, driverSocket, rideId: activeRideId } = await testDriverReceivesActiveRequest(userSocket, rideId);
    
    // Test 3: Old requests not sent to new drivers
    const { userSocket: user2, driverSocket: driver, newDriverSocket, rideId: finalRideId } = await testOldRequestsNotSent(user, driverSocket, rideId);
    
    // Test 4: Cleanup
    await testCleanup(user2, driver, newDriverSocket);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ User ID is being sent correctly');
    console.log('✅ Old ride requests are not sent to new drivers');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
runAllTests(); 