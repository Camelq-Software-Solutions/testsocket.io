const { io } = require("socket.io-client");

// Test the complete flow: user books ride, driver accepts, driver receives details
async function testCompleteFlow() {
  console.log("🧪 Testing complete ride flow with pickup/drop details...");

  // Connect user
  const userSocket = io("https://testsocketio-roqet.up.railway.app", {
    query: {
      type: "user",
      id: "user123"
    },
    transports: ["polling"]
  });

  // Connect driver
  const driverSocket = io("https://testsocketio-roqet.up.railway.app", {
    query: {
      type: "driver",
      id: "driver123"
    },
    transports: ["polling"]
  });

  let rideId = null;

  // User event listeners
  userSocket.on("connect", () => {
    console.log("✅ User connected");
  });

  userSocket.on("ride_booked", (data) => {
    console.log("✅ User received ride_booked:", data);
    rideId = data.rideId;
  });

  userSocket.on("ride_accepted", (data) => {
    console.log("✅ User received ride_accepted:", data);
  });

  // Driver event listeners
  driverSocket.on("connect", () => {
    console.log("✅ Driver connected");
  });

  driverSocket.on("new_ride_request", (data) => {
    console.log("✅ Driver received new_ride_request:", data);
    console.log("📍 Pickup:", data.pickup);
    console.log("📍 Drop:", data.drop);
    
    // Driver accepts the ride
    setTimeout(() => {
      console.log("🚗 Driver accepting ride...");
      driverSocket.emit("ride_response", {
        rideId: data.rideId,
        response: "accept",
        driverId: "driver123",
        driverName: "John Driver",
        driverPhone: "+1234567890",
        estimatedArrival: "5 minutes"
      });
    }, 1000);
  });

  driverSocket.on("ride_accepted_with_details", (data) => {
    console.log("✅ Driver received ride_accepted_with_details:", data);
    console.log("📍 Pickup location:", data.pickup);
    console.log("📍 Drop location:", data.drop);
    console.log("💰 Price:", data.price);
    console.log("🚗 Ride type:", data.rideType);
    console.log("👤 User ID:", data.userId);
    
    if (data.pickup && data.drop) {
      console.log("🎉 SUCCESS: Driver received pickup and drop locations!");
    } else {
      console.log("❌ FAILURE: Driver did not receive pickup/drop locations");
    }
  });

  driverSocket.on("ride_taken", (data) => {
    console.log("✅ Driver received ride_taken:", data);
  });

  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 2000));

  // User books a ride
  console.log("🚗 User booking ride...");
  userSocket.emit("book_ride", {
    pickup: "123 Main Street, City",
    drop: "456 Oak Avenue, Downtown",
    rideType: "standard",
    price: 25.50,
    userId: "user123"
  });

  // Wait for the complete flow
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("🏁 Test completed");
  
  // Cleanup
  userSocket.disconnect();
  driverSocket.disconnect();
}

// Run the test
testCompleteFlow().catch(console.error); 