const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'clerk_user_789';
const TEST_DRIVER_ID = 'test_driver_456';

console.log('🧪 Testing Complete Ride Flow...\n');

// Test 1: User books a ride
async function testUserBooking() {
  console.log('📱 Test 1: User booking ride');
  
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
async function testDriverAcceptance(userSocket, rideId) {
  console.log('\n🚗 Test 2: Driver accepts ride');
  
  const driverSocket = io(SERVER_URL, {
    query: { type: 'driver', id: TEST_DRIVER_ID },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Driver acceptance test timed out'));
    }, 30000);

    let userReceivedAcceptance = false;
    let driverReceivedDetails = false;

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

    driverSocket.on('active_ride_requests', (requests) => {
      console.log('✅ Driver received active ride requests:', requests.length);
      
      if (requests.length > 0) {
        const rideRequest = requests[0]; // Take the first available ride
        console.log('✅ Driver accepting ride from active requests:', {
          rideId: rideRequest.rideId,
          pickup: rideRequest.pickup.address,
          drop: rideRequest.drop.address,
          price: rideRequest.price
        });
        
        // Accept the ride
        setTimeout(() => {
          console.log('✅ Driver accepting ride...');
          driverSocket.emit('ride_response', {
            rideId: rideRequest.rideId,
            driverId: TEST_DRIVER_ID,
            driverName: 'Test Driver',
            driverPhone: '+91-9876543210',
            estimatedArrival: '5 minutes',
            response: 'accept'
          });
        }, 1000);
      }
    });

    driverSocket.on('ride_accepted_with_details', (data) => {
      console.log('✅ Driver received acceptance confirmation:', {
        rideId: data.rideId,
        userId: data.userId,
        status: data.status,
        pickup: data.pickup.address,
        drop: data.drop.address
      });
      driverReceivedDetails = true;
    });

    userSocket.on('ride_accepted', (data) => {
      console.log('✅ User received driver acceptance notification:', {
        rideId: data.rideId,
        driverId: data.driverId,
        driverName: data.driverName,
        estimatedArrival: data.estimatedArrival
      });
      userReceivedAcceptance = true;
    });

    // Wait for both user and driver to receive notifications
    setTimeout(() => {
      if (userReceivedAcceptance && driverReceivedDetails) {
        clearTimeout(timeout);
        resolve({ userSocket, driverSocket, rideId });
      } else {
        clearTimeout(timeout);
        reject(new Error('User or driver did not receive acceptance notification'));
      }
    }, 10000);
  });
}

// Test 3: Driver location updates
async function testDriverLocationUpdates(userSocket, driverSocket, rideId) {
  console.log('\n📍 Test 3: Driver location updates');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Driver location test timed out'));
    }, 20000);

    let userReceivedLocation = false;

    userSocket.on('driver_location_update', (data) => {
      console.log('✅ User received driver location update:', {
        driverId: data.driverId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date(data.timestamp).toISOString()
      });
      userReceivedLocation = true;
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
        setTimeout(() => {
          clearTimeout(timeout);
          if (userReceivedLocation) {
            resolve({ userSocket, driverSocket, rideId });
          } else {
            reject(new Error('User did not receive driver location updates'));
          }
        }, 2000);
      }
    }, 2000);
  });
}

// Test 4: Ride status updates (arriving -> picked_up -> in_progress -> completed)
async function testRideStatusUpdates(userSocket, driverSocket, rideId) {
  console.log('\n🔄 Test 4: Ride status updates');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Ride status test timed out'));
    }, 25000);

    let statusUpdates = [];
    let userReceivedAllStatuses = false;

    userSocket.on('ride_status_update', (data) => {
      console.log('✅ User received ride status update:', {
        rideId: data.rideId,
        status: data.status,
        message: data.message,
        timestamp: new Date(data.timestamp).toISOString()
      });
      statusUpdates.push(data.status);
      
      // Check if we received all expected statuses
      if (statusUpdates.includes('arriving') && 
          statusUpdates.includes('picked_up') && 
          statusUpdates.includes('in_progress') && 
          statusUpdates.includes('completed')) {
        userReceivedAllStatuses = true;
      }
    });

    driverSocket.on('ride_status_update', (data) => {
      console.log('✅ Driver received ride status update:', {
        rideId: data.rideId,
        status: data.status,
        message: data.message
      });
    });

    // Simulate ride progression
    setTimeout(() => {
      console.log('🚗 Driver arriving at pickup...');
      driverSocket.emit('ride_status_update', {
        rideId: rideId,
        userId: TEST_USER_ID,
        status: 'arriving',
        message: 'Driver is arriving at pickup location'
      });
    }, 2000);

    setTimeout(() => {
      console.log('🚗 Driver picked up passenger...');
      driverSocket.emit('ride_status_update', {
        rideId: rideId,
        userId: TEST_USER_ID,
        status: 'picked_up',
        message: 'Passenger picked up, ride started'
      });
    }, 6000);

    setTimeout(() => {
      console.log('🚗 Ride in progress...');
      driverSocket.emit('ride_status_update', {
        rideId: rideId,
        userId: TEST_USER_ID,
        status: 'in_progress',
        message: 'Ride in progress to destination'
      });
    }, 10000);

    setTimeout(() => {
      console.log('✅ Ride completed...');
      driverSocket.emit('ride_status_update', {
        rideId: rideId,
        userId: TEST_USER_ID,
        status: 'completed',
        message: 'Ride completed successfully'
      });
    }, 15000);

    // Wait for completion
    setTimeout(() => {
      clearTimeout(timeout);
      if (userReceivedAllStatuses) {
        console.log('✅ All ride status updates received successfully');
        resolve({ userSocket, driverSocket, rideId });
      } else {
        reject(new Error('User did not receive all expected status updates'));
      }
    }, 20000);
  });
}

// Test 5: Verify ride cleanup
async function testRideCleanup(userSocket, driverSocket, rideId) {
  console.log('\n🧹 Test 5: Ride cleanup verification');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Ride cleanup test timed out'));
    }, 10000);

    // Check server stats to verify cleanup
    setTimeout(async () => {
      try {
        const response = await fetch(`${SERVER_URL}/stats`);
        const stats = await response.json();
        
        console.log('📊 Server stats after ride completion:', {
          activeRides: stats.activeRides.length,
          connectedDrivers: stats.connectedDrivers.length,
          connectedUsers: stats.connectedUsers.length
        });

        // Check if the ride was cleaned up
        const rideStillExists = stats.activeRides.some(ride => ride[0] === rideId);
        if (!rideStillExists) {
          console.log('✅ Ride was properly cleaned up from server');
          clearTimeout(timeout);
          resolve({ userSocket, driverSocket, rideId });
        } else {
          clearTimeout(timeout);
          reject(new Error('Ride was not cleaned up from server'));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error('Failed to check server stats: ' + error.message));
      }
    }, 5000);
  });
}

// Test 6: Cleanup connections
async function testCleanup(userSocket, driverSocket) {
  console.log('\n🔌 Test 6: Connection cleanup');
  
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
    console.log('🚀 Starting Complete Ride Flow Test...\n');
    
    // Test 1: User booking
    const { userSocket, rideId, price } = await testUserBooking();
    
    // Test 2: Driver acceptance
    const { userSocket: user, driverSocket, rideId: acceptedRideId } = await testDriverAcceptance(userSocket, rideId);
    
    // Test 3: Driver location updates
    const { userSocket: user2, driverSocket: driver, rideId: locationRideId } = await testDriverLocationUpdates(user, driverSocket, acceptedRideId);
    
    // Test 4: Ride status updates
    const { userSocket: user3, driverSocket: driver2, rideId: statusRideId } = await testRideStatusUpdates(user2, driver, locationRideId);
    
    // Test 5: Ride cleanup
    const { userSocket: user4, driverSocket: driver3, rideId: finalRideId } = await testRideCleanup(user3, driver2, statusRideId);
    
    // Test 6: Cleanup
    await testCleanup(user4, driver3);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ User gets notified when driver accepts ride');
    console.log('✅ Driver and user stay connected throughout ride');
    console.log('✅ Complete ride flow works: booking → acceptance → location updates → status updates → completion');
    console.log('✅ Ride is properly cleaned up after completion');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
runAllTests(); 