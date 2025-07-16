const { io } = require('socket.io-client');

const SOCKET_URL = 'http://192.168.1.9:3000';

// Test data
const testRideId = 'test_ride_' + Date.now();
const testUserId = 'test_user_' + Date.now();
const testDriverId = 'test_driver_' + Date.now();
const testOtp = '1234';

console.log('🧪 Testing Complete MPIN Verification Flow');
console.log('==========================================');
console.log('Socket URL:', SOCKET_URL);
console.log('Test Ride ID:', testRideId);
console.log('Test User ID:', testUserId);
console.log('Test Driver ID:', testDriverId);
console.log('Test OTP:', testOtp);
console.log('');

// Create customer socket
const customerSocket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  query: {
    type: 'customer',
    id: testUserId
  },
  timeout: 10000,
  forceNew: true
});

// Create driver socket
const driverSocket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  query: {
    type: 'driver',
    id: testDriverId
  },
  timeout: 10000,
  forceNew: true
});

let testStep = 0;
const totalSteps = 8;

const logTest = (step, message, data = null) => {
  testStep++;
  console.log(`\n${testStep}/${totalSteps} ${message}`);
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
  console.log('─'.repeat(50));
};

// Customer event listeners
customerSocket.on('connect', () => {
  logTest(testStep, '✅ CUSTOMER connected to server');
  
  // Step 1: Customer requests ride
  setTimeout(() => {
    logTest(testStep, '🚗 CUSTOMER requesting ride...');
    customerSocket.emit('request_ride', {
      pickup: {
        latitude: 17.4448,
        longitude: 78.3498,
        address: 'Hyderabad, India',
        name: 'Pickup Location'
      },
      drop: {
        latitude: 17.3850,
        longitude: 78.4867,
        address: 'Destination, Hyderabad',
        name: 'Drop Location'
      },
      rideType: 'Mini',
      price: 150,
      userId: testUserId
    });
  }, 1000);
});

customerSocket.on('ride_booked', (data) => {
  logTest(testStep, '✅ CUSTOMER ride booked successfully', data);
});

customerSocket.on('ride_accepted', (data) => {
  logTest(testStep, '✅ CUSTOMER received ride acceptance', data);
  
  // Step 2: Wait for driver to arrive
  setTimeout(() => {
    logTest(testStep, '⏳ Waiting for driver to arrive...');
  }, 1000);
});

customerSocket.on('driver_arrived', (data) => {
  logTest(testStep, '🚗 CUSTOMER received driver_arrived event', data);
  
  // Step 3: Customer enters MPIN
  setTimeout(() => {
    logTest(testStep, '🔐 CUSTOMER entering MPIN...');
    customerSocket.emit('verify_mpin', {
      rideId: testRideId,
      mpin: testOtp,
      userId: testUserId
    });
  }, 1000);
});

customerSocket.on('mpin_verified', (data) => {
  logTest(testStep, '✅ CUSTOMER MPIN verified successfully', data);
});

customerSocket.on('mpin_error', (data) => {
  logTest(testStep, '❌ CUSTOMER MPIN verification failed', data);
});

customerSocket.on('ride_started', (data) => {
  logTest(testStep, '🚀 CUSTOMER ride started', data);
});

// Driver event listeners
driverSocket.on('connect', () => {
  logTest(testStep, '✅ DRIVER connected to server');
  
  // Wait for ride request
  setTimeout(() => {
    logTest(testStep, '⏳ DRIVER waiting for ride request...');
  }, 1000);
});

driverSocket.on('ride_request', (data) => {
  logTest(testStep, '🚗 DRIVER received ride request', data);
  
  // Step 4: Driver accepts ride
  setTimeout(() => {
    logTest(testStep, '✅ DRIVER accepting ride...');
    driverSocket.emit('accept_ride', {
      rideId: data.rideId,
      driverId: testDriverId,
      driverName: 'Test Driver',
      driverPhone: '+1234567890',
      estimatedArrival: '5 minutes'
    });
  }, 1000);
});

driverSocket.on('ride_accepted', (data) => {
  logTest(testStep, '✅ DRIVER ride acceptance confirmed', data);
  
  // Step 5: Driver arrives at pickup
  setTimeout(() => {
    logTest(testStep, '🚗 DRIVER arriving at pickup...');
    driverSocket.emit('driver_arrived', {
      rideId: testRideId,
      driverId: testDriverId
    });
  }, 1000);
});

driverSocket.on('ride_status_updated', (data) => {
  logTest(testStep, '🔄 DRIVER received status update', data);
  
  if (data.status === 'arrived') {
    // Step 6: Driver sends OTP
    setTimeout(() => {
      logTest(testStep, '🔐 DRIVER sending OTP...');
      driverSocket.emit('send_otp', {
        rideId: testRideId,
        driverId: testDriverId,
        otp: testOtp
      });
    }, 1000);
  }
});

driverSocket.on('otp_sent', (data) => {
  logTest(testStep, '✅ DRIVER OTP sent successfully', data);
});

driverSocket.on('otp_error', (data) => {
  logTest(testStep, '❌ DRIVER OTP error', data);
});

driverSocket.on('mpin_verified', (data) => {
  logTest(testStep, '✅ DRIVER received MPIN verification', data);
  
  // Step 7: Driver can now start the ride
  setTimeout(() => {
    logTest(testStep, '🚀 DRIVER ride started via MPIN verification');
  }, 1000);
});

// Error handling
customerSocket.on('connect_error', (error) => {
  console.error('❌ CUSTOMER connection error:', error.message);
});

driverSocket.on('connect_error', (error) => {
  console.error('❌ DRIVER connection error:', error.message);
});

customerSocket.on('disconnect', (reason) => {
  console.log('🔌 CUSTOMER disconnected:', reason);
});

driverSocket.on('disconnect', (reason) => {
  console.log('🔌 DRIVER disconnected:', reason);
});

// Cleanup after test
setTimeout(() => {
  logTest(testStep, '🧹 Cleaning up test connections...');
  customerSocket.disconnect();
  driverSocket.disconnect();
  console.log('\n✅ MPIN Flow Test Complete!');
  process.exit(0);
}, 15000);

console.log('🚀 Starting MPIN verification flow test...\n'); 