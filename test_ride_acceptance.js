const io = require('socket.io-client');

// Test ride acceptance notification
async function testRideAcceptance() {
  console.log('🧪 Testing ride acceptance notification...');
  
  // Connect as a user
  const userSocket = io('https://testsocketio-roqet.up.railway.app', {
    transports: ['polling'],
    query: {
      type: 'user',
      id: 'test_user_123'
    }
  });
  
  userSocket.on('connect', () => {
    console.log('✅ User connected:', userSocket.id);
    
    // Listen for ride acceptance
    userSocket.on('ride_accepted', (data) => {
      console.log('🎉 User received ride_accepted notification:', data);
    });
    
    // Book a ride
    const rideData = {
      pickup: {
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Test Pickup',
        name: 'Test Pickup'
      },
      drop: {
        latitude: 28.7041,
        longitude: 77.1025,
        address: 'Test Drop',
        name: 'Test Drop'
      },
      rideType: 'Bike',
      price: 50,
      userId: 'test_user_123'
    };
    
    console.log('🚗 Booking ride...');
    userSocket.emit('book_ride', rideData);
  });
  
  userSocket.on('ride_booked', (data) => {
    console.log('✅ Ride booked:', data);
    
    // Connect as a driver to accept the ride
    const driverSocket = io('https://testsocketio-roqet.up.railway.app', {
      transports: ['polling'],
      query: {
        type: 'driver',
        id: 'test_driver_123'
      }
    });
    
    driverSocket.on('connect', () => {
      console.log('✅ Driver connected:', driverSocket.id);
      
      driverSocket.on('new_ride_request', (rideRequest) => {
        console.log('📨 Driver received ride request:', rideRequest);
        
        // Accept the ride
        const acceptData = {
          rideId: rideRequest.rideId,
          driverId: 'test_driver_123',
          response: 'accept',
          driverName: 'Test Driver',
          driverPhone: '+1234567890',
          estimatedArrival: '5 minutes'
        };
        
        console.log('✅ Driver accepting ride...');
        driverSocket.emit('ride_response', acceptData);
      });
      
      driverSocket.on('disconnect', () => {
        console.log('🔴 Driver disconnected');
      });
    });
  });
  
  userSocket.on('disconnect', () => {
    console.log('🔴 User disconnected');
  });
}

// Run the test
testRideAcceptance().catch(console.error); 