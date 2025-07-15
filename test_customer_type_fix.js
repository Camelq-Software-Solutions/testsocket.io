const io = require('socket.io-client');

const SERVER_URL = 'https://testsocketio-roqet.up.railway.app';

// Test customer type connection
async function testCustomerTypeConnection() {
  console.log('🧪 Testing customer type connection...');
  
  const customerSocket = io(SERVER_URL, {
    query: {
      type: 'customer',
      id: 'test_customer_123'
    },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Customer connection test timed out'));
    }, 10000);

    customerSocket.on('connect', () => {
      console.log('✅ Customer connected successfully');
      
      // Test ride booking
      const rideData = {
        pickup: {
          latitude: 17.4520062,
          longitude: 78.3934734,
          address: 'Current Location',
          name: 'Current Location'
        },
        drop: {
          latitude: 17.4369,
          longitude: 78.4031,
          address: 'Hitech City Road, Sri Sai Nagar, Madhapur…',
          name: 'Durgam Cheruvu Metro Station',
          id: '2',
          type: 'recent'
        },
        rideType: 'Bike',
        price: 33,
        userId: 'test_customer_123'
      };

      console.log('🚗 Booking ride as customer...');
      customerSocket.emit('book_ride', rideData);
    });

    customerSocket.on('ride_booked', (data) => {
      console.log('✅ Customer ride booked:', data);
      clearTimeout(timeout);
      resolve({ customerSocket, rideId: data.rideId });
    });

    customerSocket.on('ride_accepted', (data) => {
      console.log('🎉 Customer received ride_accepted:', data);
    });

    customerSocket.on('connect_error', (error) => {
      console.error('❌ Customer connection error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Test driver accepting the ride
async function testDriverAcceptance(rideId) {
  console.log('🚗 Testing driver acceptance...');
  
  const driverSocket = io(SERVER_URL, {
    query: {
      type: 'driver',
      id: 'test_driver_456'
    },
    transports: ['polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Driver acceptance test timed out'));
    }, 10000);

    driverSocket.on('connect', () => {
      console.log('✅ Driver connected successfully');
    });

    driverSocket.on('new_ride_request', (data) => {
      console.log('🚗 Driver received new ride request:', data.rideId);
      
      if (data.rideId === rideId) {
        console.log('✅ Accepting ride...');
        driverSocket.emit('ride_response', {
          rideId: data.rideId,
          response: 'accept',
          driverId: 'test_driver_456',
          driverName: 'Test Driver',
          driverPhone: '+1234567890',
          estimatedArrival: '5 minutes'
        });
      }
    });

    driverSocket.on('ride_response_confirmed', (data) => {
      console.log('✅ Driver ride response confirmed:', data);
      clearTimeout(timeout);
      resolve();
    });

    driverSocket.on('connect_error', (error) => {
      console.error('❌ Driver connection error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Run the complete test
async function runTest() {
  try {
    console.log('🚀 Starting customer type fix test...');
    
    // Step 1: Customer connects and books ride
    const { customerSocket, rideId } = await testCustomerTypeConnection();
    
    // Step 2: Driver connects and accepts ride
    await testDriverAcceptance(rideId);
    
    console.log('✅ Test completed successfully! Customer type fix is working.');
    
    // Clean up
    customerSocket.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest(); 