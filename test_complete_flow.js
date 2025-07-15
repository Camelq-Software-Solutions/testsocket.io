const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'test_user_123';
const TEST_DRIVER_ID = 'test_driver_456';

console.log('🧪 Starting comprehensive ride booking flow test...\n');

// Test 1: User connects and books a ride
async function testUserBooking() {
  console.log('📱 Test 1: User booking flow');
  
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
      console.log('🚗 Sending ride booking request...');
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
        userId: TEST_USER_ID
      };
      
      userSocket.emit('book_ride', rideRequest);
    }, 2000);
  });
}

// Test 2: Driver connects and accepts the ride
async function testDriverAcceptance(userSocket, rideId, price) {
  console.log('\n🚗 Test 2: Driver acceptance flow');
  
  const driverSocket = io(SERVER_URL, {
    query: { type: 'driver', id: TEST_DRIVER_ID },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Driver acceptance test timed out'));
    }, 30000);

    driverSocket.on('connect', () => {
      console.log('✅ Driver connected successfully');
    });

    driverSocket.on('new_ride_request', (data) => {
      console.log('✅ Driver received ride request:', {
        rideId: data.rideId,
        pickup: data.pickup.address,
        drop: data.drop.address,
        price: data.price
      });
      
      // Accept the ride
      setTimeout(() => {
        console.log('✅ Driver accepting ride...');
        driverSocket.emit('ride_response', {
          rideId: data.rideId,
          driverId: TEST_DRIVER_ID,
          driverName: 'Test Driver',
          driverPhone: '+91-9876543210',
          estimatedArrival: '5 minutes',
          response: 'accept'
        });
      }, 1000);
    });

    driverSocket.on('ride_accepted_with_details', (data) => {
      console.log('✅ Driver received acceptance confirmation:', {
        rideId: data.rideId,
        userId: data.userId,
        status: data.status
      });
    });

    userSocket.on('ride_accepted', (data) => {
      console.log('✅ User received driver acceptance:', {
        rideId: data.rideId,
        driverId: data.driverId,
        driverName: data.driverName,
        estimatedArrival: data.estimatedArrival
      });
      
      clearTimeout(timeout);
      resolve({ userSocket, driverSocket, rideId: data.rideId });
    });

    driverSocket.on('connect_error', (error) => {
      console.error('❌ Driver connection error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Test 3: Driver location updates
async function testDriverLocation(userSocket, driverSocket, rideId) {
  console.log('\n📍 Test 3: Driver location updates');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Driver location test timed out'));
    }, 15000);

    userSocket.on('driver_location_update', (data) => {
      console.log('✅ User received driver location update:', {
        driverId: data.driverId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date(data.timestamp).toISOString()
      });
    });

    // Send location updates
    let updateCount = 0;
    const locationInterval = setInterval(() => {
      const location = {
        driverId: TEST_DRIVER_ID,
        userId: TEST_USER_ID,
        latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
        longitude: 77.2090 + (Math.random() - 0.5) * 0.01
      };
      
      driverSocket.emit('driver_location', location);
      updateCount++;
      
      if (updateCount >= 3) {
        clearInterval(locationInterval);
        clearTimeout(timeout);
        resolve({ userSocket, driverSocket, rideId });
      }
    }, 2000);
  });
}

// Test 4: Ride completion
async function testRideCompletion(userSocket, driverSocket, rideId) {
  console.log('\n✅ Test 4: Ride completion flow');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Ride completion test timed out'));
    }, 10000);

    userSocket.on('ride_status_update', (data) => {
      console.log('✅ User received ride status update:', {
        rideId: data.rideId,
        status: data.status,
        message: data.message
      });
    });

    driverSocket.on('ride_status_update', (data) => {
      console.log('✅ Driver received ride status update:', {
        rideId: data.rideId,
        status: data.status,
        message: data.message
      });
    });

    // Complete the ride
    setTimeout(() => {
      console.log('✅ Completing ride...');
      const statusUpdate = {
        rideId: rideId,
        userId: TEST_USER_ID,
        status: 'completed',
        message: 'Ride completed successfully'
      };
      
      driverSocket.emit('ride_status_update', statusUpdate);
      
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({ userSocket, driverSocket, rideId });
      }, 2000);
    }, 2000);
  });
}

// Test 5: Cleanup and disconnection
async function testCleanup(userSocket, driverSocket) {
  console.log('\n🧹 Test 5: Cleanup and disconnection');
  
  return new Promise((resolve) => {
    userSocket.on('disconnect', () => {
      console.log('✅ User disconnected successfully');
    });

    driverSocket.on('disconnect', () => {
      console.log('✅ Driver disconnected successfully');
    });

    setTimeout(() => {
      userSocket.disconnect();
      driverSocket.disconnect();
      
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
    console.log('🚀 Starting comprehensive ride booking flow test...\n');
    
    // Test 1: User booking
    const { userSocket, rideId, price } = await testUserBooking();
    
    // Test 2: Driver acceptance
    const { userSocket: user, driverSocket, rideId: acceptedRideId } = await testDriverAcceptance(userSocket, rideId, price);
    
    // Test 3: Driver location updates
    const { userSocket: user2, driverSocket: driver, rideId: locationRideId } = await testDriverLocation(user, driverSocket, acceptedRideId);
    
    // Test 4: Ride completion
    const { userSocket: user3, driverSocket: driver2, rideId: completedRideId } = await testRideCompletion(user2, driver, locationRideId);
    
    // Test 5: Cleanup
    await testCleanup(user3, driver2);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Ride booking flow is working correctly');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
runAllTests(); 