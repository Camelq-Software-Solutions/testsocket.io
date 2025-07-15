const io = require('socket.io-client');

const SOCKET_URL = 'https://testsocketio-roqet.up.railway.app';
const TEST_USER_ID = 'test_user_' + Date.now();
const TEST_DRIVER_ID = 'test_driver_' + Date.now();

let userSocket, driverSocket;
let testResults = {
  userConnected: false,
  driverConnected: false,
  rideBooked: false,
  rideReceived: false,
  rideAccepted: false,
  rideCompleted: false,
  errors: []
};

console.log('🧪 Starting comprehensive ride flow test...');

// Connect user
userSocket = io(SOCKET_URL, {
  query: { type: 'user', id: TEST_USER_ID },
  transports: ['polling']
});

userSocket.on('connect', () => {
  console.log('✅ User connected:', userSocket.id);
  testResults.userConnected = true;
});

userSocket.on('ride_booked', (data) => {
  console.log('✅ User received ride_booked:', data);
  testResults.rideBooked = true;
  global.testRideId = data.rideId;
});

userSocket.on('ride_accepted', (data) => {
  console.log('✅ User received ride_accepted:', data);
  testResults.rideAccepted = true;
});

userSocket.on('ride_status_update', (data) => {
  console.log('🔄 User received ride_status_update:', data);
});

// Connect driver
driverSocket = io(SOCKET_URL, {
  query: { type: 'driver', id: TEST_DRIVER_ID },
  transports: ['polling']
});

driverSocket.on('connect', () => {
  console.log('✅ Driver connected:', driverSocket.id);
  testResults.driverConnected = true;
});

driverSocket.on('new_ride_request', (data) => {
  console.log('🚗 Driver received new_ride_request:', data);
  testResults.rideReceived = true;
  
  // Accept the ride after a short delay
  setTimeout(() => {
    console.log('✅ Driver accepting ride...');
    driverSocket.emit('ride_response', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID,
      response: 'accept',
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 2000);
});

driverSocket.on('ride_accepted_with_details', (data) => {
  console.log('✅ Driver received ride_accepted_with_details:', data);
  
  // Complete the ride after a short delay
  setTimeout(() => {
    console.log('✅ Driver completing ride...');
    driverSocket.emit('complete_ride', {
      rideId: data.rideId,
      driverId: TEST_DRIVER_ID
    });
  }, 2000);
});

driverSocket.on('ride_completed', (data) => {
  console.log('✅ Driver received ride_completed:', data);
  testResults.rideCompleted = true;
});

driverSocket.on('ride_response_error', (data) => {
  console.log('❌ Driver received ride_response_error:', data);
  testResults.errors.push(data.message);
});

// Test function
function runTest() {
  console.log('\n🚀 Starting comprehensive test sequence...');
  
  // Wait for connections
  setTimeout(() => {
    if (!testResults.userConnected || !testResults.driverConnected) {
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

function runTestResults() {
  console.log('\n📊 Test Results:');
  console.log('User Connected:', testResults.userConnected ? '✅' : '❌');
  console.log('Driver Connected:', testResults.driverConnected ? '✅' : '❌');
  console.log('Ride Booked:', testResults.rideBooked ? '✅' : '❌');
  console.log('Ride Received by Driver:', testResults.rideReceived ? '✅' : '❌');
  console.log('Ride Accepted:', testResults.rideAccepted ? '✅' : '❌');
  console.log('Ride Completed:', testResults.rideCompleted ? '✅' : '❌');
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    testResults.errors.forEach(error => console.log('-', error));
  }
  
  const success = testResults.userConnected && 
                  testResults.driverConnected && 
                  testResults.rideBooked && 
                  testResults.rideReceived && 
                  testResults.rideAccepted && 
                  testResults.rideCompleted;
  
  console.log('\n🎯 Overall Result:', success ? '✅ PASSED' : '❌ FAILED');
  
  // Cleanup
  if (userSocket) userSocket.disconnect();
  if (driverSocket) driverSocket.disconnect();
  
  process.exit(success ? 0 : 1);
}

// Run test after 5 seconds
setTimeout(runTest, 5000);

// Auto-cleanup after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout, cleaning up...');
  runTestResults();
}, 30000); 