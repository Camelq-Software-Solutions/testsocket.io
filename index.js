const { Server } = require("socket.io");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 9092;

// Basic middleware
app.use(express.json());

// In-memory storage for active rides (in production, use Redis or database)
const activeRides = new Map();
const connectedDrivers = new Map();
const connectedUsers = new Map();

// Track ride states and prevent race conditions
const rideLocks = new Set();
const rideRequestRecipients = new Map();
const userActiveRides = new Map();
const rideAcceptanceAttempts = new Map();

// Enhanced logging with timestamps
const logEvent = (event, data = {}) => {
  console.log(`[${new Date().toISOString()}] ${event}:`, data);
};

// Helper function to validate ride data
const validateRideData = (data) => {
  const required = ['pickup', 'drop', 'rideType', 'price', 'userId'];
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  
  if (!data.pickup.latitude || !data.pickup.longitude) {
    return { valid: false, error: 'Invalid pickup location' };
  }
  
  if (!data.drop.latitude || !data.drop.longitude) {
    return { valid: false, error: 'Invalid drop location' };
  }
  
  if (typeof data.price !== 'number' || data.price <= 0) {
    return { valid: false, error: 'Invalid price' };
  }
  
  return { valid: true };
};

// Helper function to clean up ride data
const cleanupRide = (rideId, userId) => {
  logEvent('CLEANUP_RIDE', { rideId, userId });
  activeRides.delete(rideId);
  rideRequestRecipients.delete(rideId);
  rideLocks.delete(rideId);
  rideAcceptanceAttempts.delete(rideId);
  if (userId) {
    userActiveRides.delete(userId);
  }
};

// Helper function to reset driver status
const resetDriverStatus = (driverId) => {
  const driver = connectedDrivers.get(driverId);
  if (driver && driver.status === 'busy') {
    // Check if driver actually has any active rides
    const hasActiveRide = Array.from(activeRides.entries()).some(([_, ride]) => 
      ride.driverId === driverId && (ride.status === 'accepted' || ride.status === 'pending')
    );
    
    if (!hasActiveRide) {
      logEvent('RESET_DRIVER_STATUS', { driverId, from: 'busy', to: 'online' });
      driver.status = 'online';
      return true;
    }
  }
  return false;
};

// Cleanup interval for stale data
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Clean up stale ride locks (older than 30 seconds)
  for (const rideId of rideLocks) {
    const ride = activeRides.get(rideId);
    if (ride && (now - ride.createdAt) > 30000) {
      logEvent('CLEANUP_STALE_LOCK', { rideId });
      rideLocks.delete(rideId);
    }
  }
  
  // Clean up old pending rides (older than 5 minutes)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === 'pending' && (now - ride.createdAt) > 300000) {
      logEvent('CLEANUP_OLD_PENDING_RIDE', { rideId, age: Math.round((now - ride.createdAt)/1000) });
      cleanupRide(rideId, ride.userId);
      
      // Notify user that ride request expired
      io.to(`user:${ride.userId}`).emit("ride_timeout", {
        rideId: rideId,
        message: "Ride request expired. Please try again."
      });
      cleanedCount++;
    }
  }
  
  // Clean up stale user active rides entries
  for (const [userId, rideId] of userActiveRides.entries()) {
    if (!activeRides.has(rideId)) {
      logEvent('CLEANUP_STALE_USER_RIDE', { userId, rideId });
      userActiveRides.delete(userId);
    }
  }
  
  // Reset stuck drivers
  for (const [driverId, driver] of connectedDrivers.entries()) {
    if (driver.status === 'busy') {
      resetDriverStatus(driverId);
    }
  }
  
  // Clean up stale ride acceptance attempts
  for (const [rideId, attempts] of rideAcceptanceAttempts.entries()) {
    if (!activeRides.has(rideId)) {
      logEvent('CLEANUP_STALE_ATTEMPTS', { rideId });
      rideAcceptanceAttempts.delete(rideId);
    }
  }
  
  if (cleanedCount > 0) {
    logEvent('CLEANUP_SUMMARY', { cleanedCount });
  }
}, 30000); // Run every 30 seconds

// Add request logging middleware
app.use((req, res, next) => {
  logEvent('HTTP_REQUEST', { method: req.method, path: req.path });
  next();
});

// Debug endpoint
app.get('/debug/sockets', (req, res) => {
  const debugInfo = {
    connectedUsers: Array.from(connectedUsers.entries()),
    connectedDrivers: Array.from(connectedDrivers.entries()),
    activeRides: Array.from(activeRides.entries()),
    userActiveRides: Array.from(userActiveRides.entries()),
    rideLocks: Array.from(rideLocks),
    rideRequestRecipients: Array.from(rideRequestRecipients.entries()).map(([rideId, recipients]) => ({
      rideId,
      recipientCount: recipients.size,
      recipients: Array.from(recipients)
    })),
    rideAcceptanceAttempts: Array.from(rideAcceptanceAttempts.entries()).map(([rideId, attempts]) => ({
      rideId,
      attemptCount: attempts.size,
      attempts: Array.from(attempts)
    }))
  };
  res.json(debugInfo);
});

const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
  path: "/socket.io/",
  serveClient: false,
  pingTimeout: 60000,
  pingInterval: 25000,
});

logEvent('SERVER_START', { port: PORT });

io.on("connection", (socket) => {
  const { type, id } = socket.handshake.query;
  logEvent('NEW_CONNECTION', { socketId: socket.id, type, id });

  // Store connection info
  if (type === "driver") {
    socket.join(`driver:${id}`);
    socket.join("drivers");
    connectedDrivers.set(id, {
      socketId: socket.id,
      status: "online",
      lastSeen: Date.now(),
      location: null
    });
    logEvent('DRIVER_CONNECTED', { driverId: id, totalDrivers: connectedDrivers.size });
    
    // Send active ride requests to newly connected driver
    const driver = connectedDrivers.get(id);
    if (driver && driver.status === "online") {
      const activeRideRequests = Array.from(activeRides.entries())
        .filter(([rideId, ride]) => {
          if (ride.status !== "pending") return false;
          
          const recipients = rideRequestRecipients.get(rideId);
          if (recipients && recipients.has(id)) {
            return false;
          }
          
          return true;
        })
        .map(([rideId, ride]) => ({
          rideId: rideId,
          pickup: ride.pickup,
          drop: ride.drop,
          rideType: ride.rideType,
          price: ride.price,
          userId: ride.userId,
          timestamp: ride.createdAt
        }));
      
      if (activeRideRequests.length > 0) {
        logEvent('SEND_ACTIVE_REQUESTS', { driverId: id, count: activeRideRequests.length });
        socket.emit("active_ride_requests", activeRideRequests);
        
        // Add this driver to the recipients list for these rides
        activeRideRequests.forEach(rideRequest => {
          const recipients = rideRequestRecipients.get(rideRequest.rideId) || new Set();
          recipients.add(id);
          rideRequestRecipients.set(rideRequest.rideId, recipients);
        });
      }
    }
  } else if (type === "user" || type === "customer") {
    socket.join(`user:${id}`);
    connectedUsers.set(id, {
      socketId: socket.id,
      status: "online",
      lastSeen: Date.now()
    });
    logEvent('USER_CONNECTED', { userId: id, totalUsers: connectedUsers.size });
  }

  // Handle ride booking
  socket.on("book_ride", (data) => {
    logEvent('BOOK_RIDE_REQUEST', { userId: data.userId, price: data.price });
    
    // Check if user already has an active ride request
    const existingRide = userActiveRides.get(data.userId);
    if (existingRide) {
      const ride = activeRides.get(existingRide);
      if (ride && (ride.status === "pending" || ride.status === "accepted")) {
        logEvent('USER_HAS_ACTIVE_RIDE', { userId: data.userId, status: ride.status });
        socket.emit("ride_response_error", {
          message: ride.status === "pending" 
            ? "You already have an active ride request. Please wait or cancel the existing request."
            : "You already have an active ride in progress. Please complete your current ride first."
        });
        return;
      } else {
        // Clean up stale entry
        userActiveRides.delete(data.userId);
      }
    }
    
    // Validate ride data
    const validation = validateRideData(data);
    if (!validation.valid) {
      logEvent('INVALID_RIDE_DATA', { error: validation.error });
      socket.emit("ride_response_error", {
        message: validation.error
      });
      return;
    }
    
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create ride entry
    const rideData = {
      rideId,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      status: "pending",
      createdAt: Date.now(),
      acceptedBy: null,
      driverId: null
    };
    
    activeRides.set(rideId, rideData);
    userActiveRides.set(data.userId, rideId);
    logEvent('RIDE_CREATED', { rideId, userId: data.userId, price: data.price });
    
    // Emit back to the user that ride is booked
    socket.emit("ride_booked", {
      success: true,
      rideId: rideId,
      price: data.price,
      message: "Ride booked successfully! Searching for drivers..."
    });
    
    // Send to currently connected drivers
    const currentDriverIds = Array.from(connectedDrivers.entries())
      .filter(([driverId, driver]) => driver.status === "online")
      .map(([driverId, driver]) => driverId);
    
    rideRequestRecipients.set(rideId, new Set(currentDriverIds));
    
    const rideRequest = {
      rideId: rideId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      userId: data.userId,
      timestamp: Date.now()
    };
    
    if (currentDriverIds.length > 0) {
      io.to("drivers").emit("new_ride_request", rideRequest);
      logEvent('RIDE_REQUEST_BROADCAST', { rideId, driverCount: currentDriverIds.length });
    } else {
      logEvent('NO_AVAILABLE_DRIVERS', { rideId });
    }
    
    // Set timeout to clean up the ride request
    setTimeout(() => {
      const ride = activeRides.get(rideId);
      if (ride && ride.status === "pending") {
        logEvent('RIDE_TIMEOUT', { rideId });
        cleanupRide(rideId, data.userId);
        
        // Notify user that no drivers were found
        io.to(`user:${data.userId}`).emit("ride_timeout", {
          rideId: rideId,
          message: "No drivers found. Please try again."
        });
      }
    }, 60000); // 1 minute timeout
  });

  // Handle driver ride acceptance/rejection
  socket.on("ride_response", async (data) => {
    logEvent('DRIVER_RIDE_RESPONSE', { driverId: data.driverId, rideId: data.rideId, response: data.response });

    const ride = activeRides.get(data.rideId);
    if (!ride) {
      logEvent('RIDE_NOT_FOUND', { rideId: data.rideId });
      socket.emit("ride_response_error", { 
        message: "This ride request has expired. Please look for new ride requests." 
      });
      return;
    }

    if (data.response === "accept") {
      // Check if driver is already busy
      const driver = connectedDrivers.get(data.driverId);
      if (driver && driver.status === "busy") {
        logEvent('DRIVER_BUSY', { driverId: data.driverId });
        socket.emit("ride_response_error", {
          message: "You are already busy with another ride. Please complete your current ride first."
        });
        return;
      }
      
      // Check if ride is already accepted
      if (ride.status === "accepted") {
        logEvent('RIDE_ALREADY_ACCEPTED', { rideId: data.rideId, acceptedBy: ride.driverId });
        socket.emit("ride_response_error", {
          message: "This ride has already been accepted by another driver."
        });
        return;
      }
      
      // Check if ride is locked
      if (rideLocks.has(data.rideId)) {
        logEvent('RIDE_LOCKED', { rideId: data.rideId });
        socket.emit("ride_response_error", {
          message: "Ride is being processed by another driver. Please try another ride."
        });
        return;
      }
      
      // Check if ride is not pending
      if (ride.status !== "pending") {
        logEvent('RIDE_NOT_PENDING', { rideId: data.rideId, status: ride.status });
        socket.emit("ride_response_error", {
          message: `Ride already ${ride.status}`
        });
        return;
      }
      
      // Add lock and process acceptance
      rideLocks.add(data.rideId);
      
      try {
        // Double-check ride status after acquiring lock
        const currentRide = activeRides.get(data.rideId);
        if (!currentRide || currentRide.status !== "pending") {
          logEvent('RIDE_STATUS_CHANGED', { rideId: data.rideId, status: currentRide?.status });
          socket.emit("ride_response_error", {
            message: currentRide ? `Ride already ${currentRide.status}` : "Ride was cancelled during processing"
          });
          return;
        }
        
        // Update ride status
        currentRide.status = "accepted";
        currentRide.acceptedBy = data.driverId;
        currentRide.driverId = data.driverId;
        currentRide.acceptedAt = Date.now();

        // Mark driver as busy
        const acceptingDriver = connectedDrivers.get(data.driverId);
        if (acceptingDriver) {
          acceptingDriver.status = "busy";
          logEvent('DRIVER_MARKED_BUSY', { driverId: data.driverId });
        }

        logEvent('RIDE_ACCEPTED', { rideId: data.rideId, driverId: data.driverId });

        // Notify user
        const notificationData = {
          rideId: data.rideId,
          driverId: data.driverId,
          driverName: data.driverName || "Driver",
          driverPhone: data.driverPhone || "+1234567890",
          estimatedArrival: data.estimatedArrival || "5 minutes"
        };
        
        logEvent('NOTIFY_USER_ACCEPTED', { userId: currentRide.userId, rideId: data.rideId });
        io.to(`user:${currentRide.userId}`).emit("ride_accepted", notificationData);

        // Send complete ride details to the accepting driver
        const safePickup = {
          latitude: currentRide.pickup.latitude,
          longitude: currentRide.pickup.longitude,
          address: currentRide.pickup.address || currentRide.pickup.name || 'Unknown Address',
          name: currentRide.pickup.name || currentRide.pickup.address || 'Unknown Name',
        };
        const safeDrop = {
          id: currentRide.drop.id || 'dest_1',
          name: currentRide.drop.name || currentRide.drop.address || 'Unknown Name',
          address: currentRide.drop.address || currentRide.drop.name || 'Unknown Address',
          latitude: currentRide.drop.latitude,
          longitude: currentRide.drop.longitude,
          type: currentRide.drop.type || '',
        };
        
        socket.emit("ride_accepted_with_details", {
          rideId: data.rideId,
          userId: currentRide.userId,
          pickup: safePickup,
          drop: safeDrop,
          rideType: currentRide.rideType,
          price: currentRide.price,
          driverId: data.driverId,
          driverName: data.driverName || "Driver",
          driverPhone: data.driverPhone || "+1234567890",
          estimatedArrival: data.estimatedArrival || "5 minutes",
          status: currentRide.status,
          createdAt: currentRide.createdAt
        });

        // Notify all drivers that ride is taken
        io.to("drivers").emit("ride_taken", {
          rideId: data.rideId,
          driverId: data.driverId
        });

        // Clean up ride request tracking
        rideRequestRecipients.delete(data.rideId);
        rideAcceptanceAttempts.delete(data.rideId);

        logEvent('RIDE_ACCEPTANCE_COMPLETE', { rideId: data.rideId, driverId: data.driverId });
      } finally {
        // Always remove lock after processing
        rideLocks.delete(data.rideId);
      }
    } else if (data.response === "reject") {
      logEvent('RIDE_REJECTED', { rideId: data.rideId, driverId: data.driverId });
      
      socket.emit("ride_response_confirmed", {
        rideId: data.rideId,
        response: "rejected"
      });
      
      // Remove this driver from the recipients list for this ride
      const recipients = rideRequestRecipients.get(data.rideId);
      if (recipients) {
        recipients.delete(data.driverId);
        if (recipients.size === 0) {
          rideRequestRecipients.delete(data.rideId);
        }
      }
    }
  });

  // Handle ride cancellation
  socket.on("cancel_ride", (data) => {
    logEvent('CANCEL_RIDE_REQUEST', data);
    
    const ride = activeRides.get(data.rideId);
    if (!ride) {
      logEvent('RIDE_NOT_FOUND_CANCEL', { rideId: data.rideId });
      socket.emit("ride_cancellation_error", {
        message: "Ride not found or already cancelled"
      });
      return;
    }
    
    // Check if ride is locked
    if (rideLocks.has(data.rideId)) {
      logEvent('RIDE_LOCKED_CANCEL', { rideId: data.rideId });
      socket.emit("ride_cancellation_error", {
        message: "Ride is currently being processed by a driver. Please wait a moment."
      });
      return;
    }
    
    // Check if ride is already cancelled
    if (ride.status === "cancelled") {
      logEvent('RIDE_ALREADY_CANCELLED', { rideId: data.rideId });
      socket.emit("ride_cancellation_error", {
        message: "Ride is already cancelled"
      });
      return;
    }
    
    logEvent('RIDE_CANCELLED', { rideId: data.rideId, cancelledBy: ride.userId });
    
    // Update ride status
    ride.status = "cancelled";
    ride.cancelledAt = Date.now();
    
    // Notify user
    io.to(`user:${ride.userId}`).emit("ride_status_update", {
      rideId: data.rideId,
      status: "cancelled",
      message: "Ride cancelled successfully",
      timestamp: Date.now()
    });
    
    // Notify driver if ride was accepted and reset their status
    if (ride.driverId) {
      resetDriverStatus(ride.driverId);
      
      io.to(`driver:${ride.driverId}`).emit("ride_status_update", {
        rideId: data.rideId,
        status: "cancelled",
        message: "Ride cancelled by user",
        timestamp: Date.now()
      });
      
      io.to(`driver:${ride.driverId}`).emit("driver_status_reset", {
        message: "Your status has been reset to available",
        timestamp: Date.now()
      });
    }
    
    // Clean up
    cleanupRide(data.rideId, ride.userId);
    logEvent('RIDE_CANCELLATION_COMPLETE', { rideId: data.rideId });
  });

  // Handle ride completion
  socket.on("complete_ride", (data) => {
    logEvent('COMPLETE_RIDE_REQUEST', data);
    
    const ride = activeRides.get(data.rideId);
    if (!ride) {
      logEvent('RIDE_NOT_FOUND_COMPLETE', { rideId: data.rideId });
      socket.emit("ride_completion_error", {
        message: "Ride not found or already completed"
      });
      return;
    }
    
    if (ride.status === "accepted" && ride.driverId === data.driverId) {
      logEvent('RIDE_COMPLETED', { rideId: data.rideId, driverId: data.driverId });
      
      // Mark driver as available again
      resetDriverStatus(data.driverId);
      
      // Clean up ride data
      cleanupRide(data.rideId, ride.userId);
      
      // Notify user and driver
      io.to(`user:${ride.userId}`).emit("ride_status_update", {
        rideId: data.rideId,
        status: "completed",
        message: "Ride completed successfully",
        timestamp: Date.now()
      });
      
      socket.emit("ride_completed", {
        rideId: data.rideId,
        message: "Ride completed successfully",
        timestamp: Date.now()
      });
      
      logEvent('RIDE_COMPLETION_COMPLETE', { rideId: data.rideId });
    } else {
      logEvent('CANNOT_COMPLETE_RIDE', { rideId: data.rideId, status: ride.status, driverId: ride.driverId });
      socket.emit("ride_completion_error", {
        message: "Cannot complete this ride"
      });
    }
  });

  // Handle driver location updates
  socket.on("driver_location", (data) => {
    logEvent('DRIVER_LOCATION_UPDATE', { driverId: data.driverId, userId: data.userId });
    
    // Update driver location in memory
    const driver = connectedDrivers.get(data.driverId);
    if (driver) {
      driver.location = {
        latitude: data.latitude,
        longitude: data.longitude
      };
      driver.lastSeen = Date.now();
    }
    
    // Broadcast to the specific user
    io.to(`user:${data.userId}`).emit("driver_location_update", {
      driverId: data.driverId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: Date.now()
    });
  });

  // Handle ride status updates
  socket.on("ride_status_update", (data) => {
    logEvent('RIDE_STATUS_UPDATE', data);
    
    const ride = activeRides.get(data.rideId);
    if (ride) {
      ride.status = data.status;
      ride.lastUpdated = Date.now();
      
      // Notify user
      io.to(`user:${data.userId}`).emit("ride_status_update", {
        rideId: data.rideId,
        status: data.status,
        message: data.message,
        timestamp: Date.now()
      });
      
      // If ride is completed or cancelled, clean up
      if (data.status === "completed" || data.status === "cancelled") {
        cleanupRide(data.rideId, ride.userId);
        logEvent('RIDE_CLEANUP_AFTER_STATUS', { rideId: data.rideId, status: data.status });
      }
    }
  });

  // Handle driver status updates
  socket.on("driver_status", (data) => {
    logEvent('DRIVER_STATUS_UPDATE', data);
    
    const driver = connectedDrivers.get(data.driverId);
    if (driver) {
      const previousStatus = driver.status;
      driver.status = data.status;
      driver.lastSeen = Date.now();
      
      logEvent('DRIVER_STATUS_CHANGED', { driverId: data.driverId, from: previousStatus, to: data.status });
      
      // If driver becomes busy, remove them from all pending ride request recipients
      if (data.status === "busy") {
        for (const [rideId, recipients] of rideRequestRecipients.entries()) {
          const ride = activeRides.get(rideId);
          if (ride && ride.status === "pending") {
            recipients.delete(data.driverId);
            if (recipients.size === 0) {
              rideRequestRecipients.delete(rideId);
              logEvent('NO_MORE_DRIVERS_FOR_RIDE', { rideId });
            }
          }
        }
      }
      
      // Broadcast to users if needed
      if (data.status === "offline") {
        // Notify any users with active rides from this driver
        for (const [rideId, ride] of activeRides) {
          if (ride.driverId === data.driverId && ride.status === "accepted") {
            io.to(`user:${ride.userId}`).emit("driver_offline", {
              rideId: rideId,
              driverId: data.driverId
            });
          }
        }
        
        // Remove driver from all ride request recipients when they go offline
        for (const [rideId, recipients] of rideRequestRecipients.entries()) {
          recipients.delete(data.driverId);
          if (recipients.size === 0) {
            rideRequestRecipients.delete(rideId);
          }
        }
      }
    }
  });

  // Handle test events
  socket.on("test_event", (data) => {
    logEvent('TEST_EVENT', data);
    socket.emit("test_response", {
      message: "Hello from Socket.IO server!",
      timestamp: new Date().toISOString(),
      received: data,
      activeRides: activeRides.size,
      connectedDrivers: connectedDrivers.size,
      connectedUsers: connectedUsers.size
    });
  });

  socket.on("disconnect", () => {
    logEvent('DISCONNECT', { socketId: socket.id, type, id });
    
    // Clean up connections
    if (type === "driver") {
      socket.leave("drivers");
      
      // Check if driver had an active ride and notify the user
      for (const [rideId, ride] of activeRides.entries()) {
        if (ride.driverId === id && ride.status === "accepted") {
          logEvent('DRIVER_DISCONNECTED_WITH_ACTIVE_RIDE', { driverId: id, rideId });
          io.to(`user:${ride.userId}`).emit("driver_disconnected", {
            rideId: rideId,
            driverId: id
          });
          
          // Reset ride status to pending so another driver can accept it
          ride.status = "pending";
          ride.driverId = null;
          ride.acceptedBy = null;
          
          // Reset driver status to online in case they reconnect
          const driver = connectedDrivers.get(id);
          if (driver) {
            driver.status = "online";
          }
        }
      }
      
      connectedDrivers.delete(id);
      
      // Remove this driver from all ride request recipients
      for (const [rideId, recipients] of rideRequestRecipients.entries()) {
        recipients.delete(id);
        if (recipients.size === 0) {
          rideRequestRecipients.delete(rideId);
        }
      }
      
      logEvent('DRIVER_DISCONNECTED', { driverId: id, totalDrivers: connectedDrivers.size });
    } else if (type === "user" || type === "customer") {
      socket.leave(`user:${id}`);
      connectedUsers.delete(id);
      
      // Check if user had an active ride and notify the driver
      const activeRideId = userActiveRides.get(id);
      if (activeRideId) {
        const ride = activeRides.get(activeRideId);
        if (ride && ride.status === "accepted" && ride.driverId) {
          logEvent('USER_DISCONNECTED_WITH_ACTIVE_RIDE', { userId: id, rideId: activeRideId });
          io.to(`driver:${ride.driverId}`).emit("user_disconnected", {
            rideId: activeRideId,
            userId: id
          });
        }
        userActiveRides.delete(id);
      }
      
      logEvent('USER_DISCONNECTED', { userId: id, totalUsers: connectedUsers.size });
    }
  });
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Socket.IO server is running",
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    activeRides: activeRides.size,
    connectedDrivers: connectedDrivers.size,
    connectedUsers: connectedUsers.size
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    activeRides: activeRides.size,
    connectedDrivers: connectedDrivers.size,
    connectedUsers: connectedUsers.size
  });
});

// API endpoint to get server stats
app.get("/stats", (req, res) => {
  res.json({
    activeRides: Array.from(activeRides.entries()),
    connectedDrivers: Array.from(connectedDrivers.entries()),
    connectedUsers: Array.from(connectedUsers.entries())
  });
});

const server = app.listen(PORT, () => {
  logEvent('SERVER_LISTENING', { port: PORT });
});

io.attach(server);
logEvent('SOCKET_IO_ATTACHED', { port: PORT });
