const { Server } = require("socket.io");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS middleware for React Native
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin');
  res.header('Access-Control-Allow-Credentials', true);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: {
      users: connectedUsers.size,
      drivers: connectedDrivers.size,
      activeRides: activeRides.size
    }
  });
});

// Socket.IO endpoint info
app.get('/socket-info', (req, res) => {
  res.json({
    socketPath: '/socket.io/',
    transports: ['polling', 'websocket'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    },
    serverTime: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// React Native connection test endpoint
app.get('/test-connection', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is reachable from React Native',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    userAgent: req.headers['user-agent']
  });
});

// Socket.IO connection test endpoint
app.get('/socket-test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Socket.IO server is running',
    socketPath: '/socket.io/',
    transports: ['websocket', 'polling'],
    serverTime: new Date().toISOString(),
    activeConnections: {
      users: connectedUsers.size,
      drivers: connectedDrivers.size,
      total: connectedUsers.size + connectedDrivers.size
    }
  });
});

// React Native specific test endpoint
app.get('/react-native-test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'React Native Socket.IO test endpoint',
    recommendedConfig: {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      extraHeaders: {
        'User-Agent': 'ReactNative'
      }
    },
    serverTime: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown'
  });
});

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

// Ride State Machine
const RIDE_STATES = {
  SEARCHING: 'searching',      // Initial state when ride is created
  ACCEPTED: 'accepted',        // Driver has accepted the ride
  ARRIVED: 'arrived',          // Driver has arrived at pickup
  STARTED: 'started',          // Ride has started (driver picked up passenger)
  COMPLETED: 'completed',      // Ride has been completed
  CANCELLED: 'cancelled',      // Ride was cancelled
  EXPIRED: 'expired'           // Ride request expired without acceptance
};

// State transition validation
const isValidStateTransition = (fromState, toState) => {
  const validTransitions = {
    [RIDE_STATES.SEARCHING]: [RIDE_STATES.ACCEPTED, RIDE_STATES.CANCELLED, RIDE_STATES.EXPIRED],
    [RIDE_STATES.ACCEPTED]: [RIDE_STATES.ARRIVED, RIDE_STATES.CANCELLED],
    [RIDE_STATES.ARRIVED]: [RIDE_STATES.STARTED, RIDE_STATES.CANCELLED],
    [RIDE_STATES.STARTED]: [RIDE_STATES.COMPLETED, RIDE_STATES.CANCELLED],
    [RIDE_STATES.COMPLETED]: [], // Terminal state
    [RIDE_STATES.CANCELLED]: [], // Terminal state
    [RIDE_STATES.EXPIRED]: []    // Terminal state
  };
  
  return validTransitions[fromState]?.includes(toState) || false;
};

// Helper function to validate ride dataaaaa
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
      ride.driverId === driverId && (ride.status === RIDE_STATES.ACCEPTED || ride.status === RIDE_STATES.ARRIVED || ride.status === RIDE_STATES.STARTED)
    );
    
    if (!hasActiveRide) {
      logEvent('RESET_DRIVER_STATUS', { driverId, from: 'busy', to: 'online' });
      driver.status = 'online';
      return true;
    }
  }
  return false;
};

// Helper function to update ride state
const updateRideState = (rideId, newState, additionalData = {}) => {
  const ride = activeRides.get(rideId);
  if (!ride) {
    return { success: false, error: 'Ride not found' };
  }
  
  if (!isValidStateTransition(ride.status, newState)) {
    return { success: false, error: `Invalid state transition from ${ride.status} to ${newState}` };
  }
  
  const oldState = ride.status;
  ride.status = newState;
  ride.lastUpdated = Date.now();
  
  // Add additional data
  Object.assign(ride, additionalData);
  
  logEvent('RIDE_STATE_CHANGED', { 
    rideId, 
    from: oldState, 
    to: newState, 
    userId: ride.userId,
    driverId: ride.driverId 
  });
  
  return { success: true, ride };
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
  
  // Clean up old searching rides (older than 5 minutes)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === RIDE_STATES.SEARCHING && (now - ride.createdAt) > 300000) {
      logEvent('CLEANUP_OLD_SEARCHING_RIDE', { rideId, age: Math.round((now - ride.createdAt)/1000) });
      
      // Update state to expired
      updateRideState(rideId, RIDE_STATES.EXPIRED);
      
      // Notify user that ride request expired
      io.to(`user:${ride.userId}`).emit("ride_expired", {
        rideId: rideId,
        message: "Ride request expired. Please try again."
      });
      
      cleanupRide(rideId, ride.userId);
      cleanedCount++;
    }
    
    // Clean up old accepted rides (older than 10 minutes) - these might be stuck
    if (ride.status === RIDE_STATES.ACCEPTED && (now - ride.lastUpdated) > 600000) {
      logEvent('CLEANUP_OLD_ACCEPTED_RIDE', { rideId, age: Math.round((now - ride.lastUpdated)/1000) });
      
      // Update state to completed (force completion)
      updateRideState(rideId, RIDE_STATES.COMPLETED);
      
      // Notify user that ride was auto-completed
      io.to(`user:${ride.userId}`).emit("ride_completed", {
        rideId: rideId,
        message: "Ride auto-completed due to inactivity",
        status: RIDE_STATES.COMPLETED,
        timestamp: Date.now()
      });
      
      // Notify driver
      if (ride.driverId) {
        io.to(`driver:${ride.driverId}`).emit("ride_completed", {
          rideId: rideId,
          message: "Ride auto-completed due to inactivity",
          status: RIDE_STATES.COMPLETED,
          timestamp: Date.now()
        });
        
        // Reset driver status
        resetDriverStatus(ride.driverId);
      }
      
      cleanupRide(rideId, ride.userId);
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      users: connectedUsers.size,
      drivers: connectedDrivers.size,
      activeRides: activeRides.size
    }
  });
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

// Manual cleanup endpoint
app.post('/debug/cleanup-user/:userId', (req, res) => {
  const { userId } = req.params;
  
  const activeRideId = userActiveRides.get(userId);
  if (activeRideId) {
    logEvent('MANUAL_CLEANUP_USER', { userId, rideId: activeRideId });
    cleanupRide(activeRideId, userId);
    res.json({ 
      success: true, 
      message: `Cleaned up active ride for user ${userId}`,
      cleanedRideId: activeRideId
    });
  } else {
    res.json({ 
      success: false, 
      message: `No active ride found for user ${userId}` 
    });
  }
});

let io;
try {
  io = new Server({
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin", "X-Requested-With", "Accept", "Origin", "User-Agent"]
    },
    allowEIO3: true,
    allowEIO4: true,
    transports: ["websocket", "polling"], // WebSocket first for React Native
    path: "/socket.io/",
    serveClient: false,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e8,
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: true
  });
  logEvent('SOCKET_IO_CREATED', { success: true });
} catch (error) {
  logEvent('SOCKET_IO_CREATION_ERROR', { error: error.message });
  // Create a minimal server without Socket.IO if it fails
  io = null;
}

logEvent('SERVER_START', { port: PORT });

// Add connection error handling
if (io && io.engine) {
  io.engine.on("connection_error", (err) => {
    logEvent('CONNECTION_ERROR', {
      type: err.type,
      message: err.message,
      context: err.context,
      req: {
        headers: err.req?.headers,
        url: err.req?.url,
        method: err.req?.method,
        userAgent: err.req?.headers['user-agent']
      }
    });
    
    // Special handling for React Native XHR errors
    if (err.message.includes('xhr poll error')) {
      logEvent('REACT_NATIVE_XHR_ERROR', {
        message: 'React Native XHR polling error detected',
        suggestion: 'Client should use WebSocket transport'
      });
    }
  });
}

if (io) {
  io.on("connection", (socket) => {
  try {
    const { type, id } = socket.handshake.query;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    const origin = socket.handshake.headers.origin || 'Unknown';
  
  logEvent('NEW_CONNECTION', { 
    socketId: socket.id, 
    type, 
    id, 
    userAgent: userAgent.substring(0, 100), // Truncate for logging
    origin,
    transport: socket.conn.transport.name,
    remoteAddress: socket.handshake.address
  });

  // Test event handler
  socket.on("test_event", (data) => {
    logEvent('TEST_EVENT', { socketId: socket.id, data });
    socket.emit("test_response", {
      message: "Hello from server!",
      received: data,
      timestamp: Date.now()
    });
  });

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
          if (ride.status !== RIDE_STATES.SEARCHING) return false;
          
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
    
    // Debug: Log room joining
    logEvent('USER_JOINED_ROOM', { 
      userId: id, 
      socketId: socket.id, 
      room: `user:${id}`,
      allRooms: Array.from(socket.rooms)
    });
  }

  // ========================================
  // RIDE BOOKING FLOW - CUSTOMER EVENTS
  // ========================================

  // Event: Customer requests a new ride
  socket.on("request_ride", (data) => {
    logEvent('REQUEST_RIDE', { userId: data.userId, price: data.price });
    
    // Check if user already has an active ride request
    const existingRide = userActiveRides.get(data.userId);
    if (existingRide) {
      const ride = activeRides.get(existingRide);
      if (ride && (ride.status === RIDE_STATES.SEARCHING || ride.status === RIDE_STATES.ACCEPTED || ride.status === RIDE_STATES.ARRIVED || ride.status === RIDE_STATES.STARTED)) {
        logEvent('USER_HAS_ACTIVE_RIDE', { userId: data.userId, status: ride.status });
        socket.emit("ride_request_error", {
          message: ride.status === RIDE_STATES.SEARCHING 
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
      socket.emit("ride_request_error", {
        message: validation.error
      });
      return;
    }
    
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create ride entry with SEARCHING state
    const rideData = {
      rideId,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      rideType: data.rideType,
      price: data.price,
      status: RIDE_STATES.SEARCHING,
      createdAt: Date.now(),
      acceptedBy: null,
      driverId: null,
      distance: data.distance || null, // Accept from client if provided
      duration: data.duration || null  // Accept from client if provided
    };
    
    activeRides.set(rideId, rideData);
    userActiveRides.set(data.userId, rideId);
    logEvent('RIDE_CREATED', { rideId, userId: data.userId, price: data.price, status: RIDE_STATES.SEARCHING });
    
    // Emit back to the user that ride request is created
    socket.emit("ride_request_created", {
      success: true,
      rideId: rideId,
      price: data.price,
      message: "Ride request created! Searching for drivers...",
      status: RIDE_STATES.SEARCHING
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
    
    // Set timeout to expire the ride request
    setTimeout(() => {
      const ride = activeRides.get(rideId);
      if (ride && ride.status === RIDE_STATES.SEARCHING) {
        logEvent('RIDE_REQUEST_EXPIRED', { rideId });
        
        // Update state to expired
        updateRideState(rideId, RIDE_STATES.EXPIRED);
        
        // Notify user that no drivers were found
        io.to(`user:${data.userId}`).emit("ride_expired", {
          rideId: rideId,
          message: "No drivers found. Please try again."
        });
        
        cleanupRide(rideId, data.userId);
      }
    }, 60000); // 1 minute timeout
  });

  // ========================================
  // RIDE ACCEPTANCE FLOW - DRIVER EVENTS
  // ========================================

  // Event: Driver accepts or rejects a ride request
  socket.on("accept_ride", async (data) => {
    logEvent('DRIVER_ACCEPT_RIDE', { driverId: data.driverId, rideId: data.rideId });

    const ride = activeRides.get(data.rideId);
    if (!ride) {
      logEvent('RIDE_NOT_FOUND_ACCEPT', { rideId: data.rideId });
      socket.emit("ride_accept_error", { 
        message: "This ride request has expired. Please look for new ride requests." 
      });
      return;
    }

    // Check if driver is already busy
    const driver = connectedDrivers.get(data.driverId);
    if (driver && driver.status === "busy") {
      logEvent('DRIVER_BUSY_ACCEPT', { driverId: data.driverId });
      socket.emit("ride_accept_error", {
        message: "You are already busy with another ride. Please complete your current ride first."
      });
      return;
    }
    
    // Check if ride is already accepted
    if (ride.status === RIDE_STATES.ACCEPTED) {
      logEvent('RIDE_ALREADY_ACCEPTED', { rideId: data.rideId, acceptedBy: ride.driverId });
      socket.emit("ride_accept_error", {
        message: "This ride has already been accepted by another driver."
      });
      return;
    }
    
    // Check if ride is locked (being processed by another driver)
    if (rideLocks.has(data.rideId)) {
      logEvent('RIDE_LOCKED_ACCEPT', { rideId: data.rideId });
      socket.emit("ride_accept_error", {
        message: "Ride is being processed by another driver. Please try another ride."
      });
      return;
    }
    
    // Check if ride is still in searching state
    if (ride.status !== RIDE_STATES.SEARCHING) {
      logEvent('RIDE_NOT_SEARCHING', { rideId: data.rideId, status: ride.status });
      socket.emit("ride_accept_error", {
        message: `Ride is no longer available (status: ${ride.status})`
      });
      return;
    }
    
    // Add lock to prevent race conditions
    rideLocks.add(data.rideId);
    
    try {
      // Double-check ride status after acquiring lock
      const currentRide = activeRides.get(data.rideId);
      if (!currentRide || currentRide.status !== RIDE_STATES.SEARCHING) {
        logEvent('RIDE_STATUS_CHANGED_ACCEPT', { rideId: data.rideId, status: currentRide?.status });
        socket.emit("ride_accept_error", {
          message: currentRide ? `Ride is no longer available (status: ${currentRide.status})` : "Ride was cancelled during processing"
        });
        return;
      }
      
      // Update ride state to ACCEPTED
      const updateResult = updateRideState(data.rideId, RIDE_STATES.ACCEPTED, {
        acceptedBy: data.driverId,
        driverId: data.driverId,
        acceptedAt: Date.now()
      });
      
      if (!updateResult.success) {
        socket.emit("ride_accept_error", { message: updateResult.error });
        return;
      }

      // Mark driver as busy
      const acceptingDriver = connectedDrivers.get(data.driverId);
      if (acceptingDriver) {
        acceptingDriver.status = "busy";
        logEvent('DRIVER_MARKED_BUSY', { driverId: data.driverId });
      }

      logEvent('RIDE_ACCEPTED', { rideId: data.rideId, driverId: data.driverId });

      // Notify customer that ride has been accepted
      const notificationData = {
        rideId: data.rideId,
        driverId: data.driverId,
        driverName: data.driverName || "Driver",
        driverPhone: data.driverPhone || "+1234567890",
        estimatedArrival: data.estimatedArrival || "5 minutes",
        status: RIDE_STATES.ACCEPTED
      };
    
      logEvent('NOTIFY_CUSTOMER_ACCEPTED', { userId: currentRide.userId, rideId: data.rideId });
      
      // Debug: Check if user room exists and has sockets
      const userRoom = io.sockets.adapter.rooms.get(`user:${currentRide.userId}`);
      const roomSockets = userRoom ? Array.from(userRoom) : [];
      logEvent('USER_ROOM_DEBUG', { 
        userId: currentRide.userId, 
        roomExists: !!userRoom, 
        socketCount: roomSockets.length,
        socketIds: roomSockets 
      });
      
      io.to(`user:${currentRide.userId}`).emit("ride_accepted", notificationData);
      logEvent('RIDE_ACCEPTED_EMITTED', { 
        userId: currentRide.userId, 
        rideId: data.rideId,
        notificationData 
      });

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
        status: RIDE_STATES.ACCEPTED,
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
  });

  // Event: Driver rejects a ride request
  socket.on("reject_ride", (data) => {
    logEvent('DRIVER_REJECT_RIDE', { rideId: data.rideId, driverId: data.driverId });
    
    socket.emit("ride_reject_confirmed", {
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
  });

  // ========================================
  // RIDE STATUS UPDATES - DRIVER EVENTS
  // ========================================

  // Event: Driver arrives at pickup location
  socket.on("driver_arrived", (data) => {
    logEvent('DRIVER_ARRIVED', { rideId: data.rideId, driverId: data.driverId });
    
    const updateResult = updateRideState(data.rideId, RIDE_STATES.ARRIVED);
    if (updateResult.success) {
      // Notify customer
      io.to(`user:${updateResult.ride.userId}`).emit("driver_arrived", {
        rideId: data.rideId,
        driverId: data.driverId,
        message: "Driver has arrived at pickup location",
        status: RIDE_STATES.ARRIVED
      });
      
      // Notify driver
      socket.emit("ride_status_updated", {
        rideId: data.rideId,
        status: RIDE_STATES.ARRIVED,
        message: "You have arrived at pickup location"
      });
    } else {
      socket.emit("ride_status_error", { message: updateResult.error });
    }
  });

  // Event: Driver sends OTP for verification
  socket.on("send_otp", (data) => {
    logEvent('DRIVER_SENT_OTP', { rideId: data.rideId, driverId: data.driverId, otp: data.otp });
    
    const ride = activeRides.get(data.rideId);
    if (!ride) {
      logEvent('RIDE_NOT_FOUND_OTP', { rideId: data.rideId });
      socket.emit("otp_error", { message: "Ride not found" });
      return;
    }
    
    if (ride.driverId !== data.driverId) {
      logEvent('DRIVER_MISMATCH_OTP', { rideId: data.rideId, driverId: data.driverId, expectedDriver: ride.driverId });
      socket.emit("otp_error", { message: "Unauthorized driver" });
      return;
    }
    
    // Store the OTP for verification
    ride.driverOtp = data.otp;
    ride.otpTimestamp = Date.now();
    
    logEvent('OTP_STORED', { rideId: data.rideId, otp: data.otp });
    
    // Notify driver that OTP was sent successfully
    socket.emit("otp_sent", {
      rideId: data.rideId,
      message: "OTP sent successfully, waiting for customer verification"
    });
  });

  // Event: Customer verifies MPIN
  socket.on("verify_mpin", (data) => {
    logEvent('CUSTOMER_VERIFY_MPIN', { rideId: data.rideId, mpin: data.mpin });
    
    const ride = activeRides.get(data.rideId);
    if (!ride) {
      logEvent('RIDE_NOT_FOUND_MPIN', { rideId: data.rideId });
      socket.emit("mpin_error", { message: "Ride not found" });
      return;
    }
    
    if (ride.userId !== data.userId) {
      logEvent('USER_MISMATCH_MPIN', { rideId: data.rideId, userId: data.userId, expectedUser: ride.userId });
      socket.emit("mpin_error", { message: "Unauthorized user" });
      return;
    }
    
    // Check if driver OTP exists and matches
    if (!ride.driverOtp) {
      logEvent('NO_DRIVER_OTP', { rideId: data.rideId });
      socket.emit("mpin_error", { message: "Driver has not sent OTP yet" });
      return;
    }
    
    // Check if OTP is expired (5 minutes)
    const otpAge = Date.now() - ride.otpTimestamp;
    if (otpAge > 5 * 60 * 1000) {
      logEvent('OTP_EXPIRED', { rideId: data.rideId, age: Math.round(otpAge/1000) });
      socket.emit("mpin_error", { message: "OTP has expired, please ask driver to send again" });
      return;
    }
    
    // Verify MPIN matches OTP
    if (data.mpin === ride.driverOtp) {
      logEvent('MPIN_VERIFIED', { rideId: data.rideId, mpin: data.mpin });
      
      // Update ride state to started
      const updateResult = updateRideState(data.rideId, RIDE_STATES.STARTED);
      if (updateResult.success) {
        // Notify customer
        socket.emit("mpin_verified", {
          rideId: data.rideId,
          message: "MPIN verified successfully, ride started",
          status: RIDE_STATES.STARTED
        });
        
        // Notify driver
        io.to(`driver:${ride.driverId}`).emit("mpin_verified", {
          rideId: data.rideId,
          message: "Customer verified MPIN, ride started",
          status: RIDE_STATES.STARTED
        });
        
        // Clean up OTP data
        delete ride.driverOtp;
        delete ride.otpTimestamp;
        
        logEvent('RIDE_STARTED_VIA_MPIN', { rideId: data.rideId, driverId: ride.driverId });
      } else {
        socket.emit("mpin_error", { message: updateResult.error });
      }
    } else {
      logEvent('MPIN_MISMATCH', { rideId: data.rideId, providedMpin: data.mpin, expectedOtp: ride.driverOtp });
      socket.emit("mpin_error", { message: "Incorrect MPIN, please try again" });
    }
  });

  // Event: Driver starts the ride (picks up passenger) - Legacy method
  socket.on("start_ride", (data) => {
    logEvent('RIDE_STARTED', { rideId: data.rideId, driverId: data.driverId });
    
    const updateResult = updateRideState(data.rideId, RIDE_STATES.STARTED);
    if (updateResult.success) {
      // Notify customer
      io.to(`user:${updateResult.ride.userId}`).emit("ride_started", {
        rideId: data.rideId,
        driverId: data.driverId,
        message: "Ride has started",
        status: RIDE_STATES.STARTED
      });
      
      // Notify driver
      socket.emit("ride_status_updated", {
        rideId: data.rideId,
        status: RIDE_STATES.STARTED,
        message: "Ride has started"
      });
    } else {
      socket.emit("ride_status_error", { message: updateResult.error });
    }
  });

  // Event: Driver completes the ride
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
    
    if (ride.status === RIDE_STATES.STARTED && ride.driverId === data.driverId) {
      const updateResult = updateRideState(data.rideId, RIDE_STATES.COMPLETED);
      if (updateResult.success) {
        logEvent('RIDE_COMPLETED', { rideId: data.rideId, driverId: data.driverId });
        
        // Mark driver as available again
        resetDriverStatus(data.driverId);
        
        // Notify customer
        io.to(`user:${ride.userId}`).emit("ride_completed", {
          rideId: data.rideId,
          message: "Ride completed successfully",
          status: RIDE_STATES.COMPLETED,
          timestamp: Date.now(),
          fare: ride.price || null,        // Use original fare calculation from ride creation
          distance: ride.distance || null, // Use original distance if set
          duration: ride.duration || null  // Use original duration if set
        });
        
        // Notify driver
        socket.emit("ride_completed", {
          rideId: data.rideId,
          message: "Ride completed successfully",
          status: RIDE_STATES.COMPLETED,
          timestamp: Date.now()
        });
        
        // Clean up ride data
        cleanupRide(data.rideId, ride.userId);
        
        logEvent('RIDE_COMPLETION_COMPLETE', { rideId: data.rideId });
      } else {
        socket.emit("ride_completion_error", { message: updateResult.error });
      }
    } else {
      logEvent('CANNOT_COMPLETE_RIDE', { rideId: data.rideId, status: ride.status, driverId: ride.driverId });
      socket.emit("ride_completion_error", {
        message: "Cannot complete this ride"
      });
    }
  });

  // ========================================
  // RIDE CANCELLATION - CUSTOMER EVENTS
  // ========================================

  // Event: Customer cancels a ride
  socket.on("cancel_ride", (data) => {
    logEvent('CANCEL_RIDE_REQUEST', data);
    
    // Check if ride is locked
    if (rideLocks.has(data.rideId)) {
      logEvent('RIDE_LOCKED_CANCEL', { rideId: data.rideId });
      socket.emit("ride_cancellation_error", {
        message: "Ride is currently being processed by a driver. Please wait a moment."
      });
      return;
    }
    
    // Use enhanced cancellation handler
    const result = handleRideCancellation(data.rideId, 'USER', data.reason || '');
    
    if (result.success) {
      logEvent('RIDE_CANCELLATION_COMPLETE', { 
        rideId: data.rideId, 
        cancelledBy: 'USER',
        fee: result.cancellationFee 
      });
      socket.emit("ride_cancellation_success", {
        message: result.message,
        cancellationFee: result.cancellationFee
      });
    } else {
      logEvent('RIDE_CANCELLATION_FAILED', { rideId: data.rideId, error: result.error });
      socket.emit("ride_cancellation_error", { message: result.error });
    }
  });

  // ========================================
  // DRIVER CANCELLATION - DRIVER EVENTS
  // ========================================

  // Event: Driver cancels a ride
  socket.on("driver_cancel_ride", (data) => {
    logEvent('DRIVER_CANCEL_RIDE_REQUEST', data);
    
    // Check if ride is locked
    if (rideLocks.has(data.rideId)) {
      logEvent('RIDE_LOCKED_DRIVER_CANCEL', { rideId: data.rideId });
      socket.emit("driver_cancellation_error", {
        message: "Ride is currently being processed. Please wait a moment."
      });
      return;
    }
    
    // Use enhanced cancellation handler
    const result = handleRideCancellation(data.rideId, 'DRIVER', data.reason || '');
    
    if (result.success) {
      logEvent('DRIVER_CANCELLATION_COMPLETE', { 
        rideId: data.rideId, 
        cancelledBy: 'DRIVER',
        fee: result.cancellationFee 
      });
      socket.emit("driver_cancellation_success", {
        message: result.message,
        cancellationFee: result.cancellationFee
      });
    } else {
      logEvent('DRIVER_CANCELLATION_FAILED', { rideId: data.rideId, error: result.error });
      socket.emit("driver_cancellation_error", { message: result.error });
    }
  });

  // ========================================
  // LOCATION UPDATES - DRIVER EVENTS
  // ========================================

  // Event: Driver updates location
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

  // ========================================
  // DISCONNECTION HANDLING
  // ========================================

  socket.on("disconnect", (reason) => {
    logEvent('DISCONNECT', { socketId: socket.id, type, id, reason });
    
    if (type === "driver") {
      const driver = connectedDrivers.get(id);
      if (driver) {
        // Reset driver status if they were busy
        if (driver.status === "busy") {
          resetDriverStatus(id);
        }
        connectedDrivers.delete(id);
        logEvent('DRIVER_DISCONNECTED', { driverId: id, totalDrivers: connectedDrivers.size });
      }
    } else if (type === "user" || type === "customer") {
      connectedUsers.delete(id);
      logEvent('USER_DISCONNECTED', { userId: id, totalUsers: connectedUsers.size });
    }
  });
  } catch (error) {
    logEvent('CONNECTION_HANDLER_ERROR', { 
      socketId: socket.id, 
      error: error.message, 
      stack: error.stack 
    });
  }
  });
}

// ========================================
// DEBUG ENDPOINTS
// ========================================

// Debug endpoint to clean up stuck rides
app.post('/debug/cleanup-stuck-rides', (req, res) => {
  logEvent('DEBUG_CLEANUP_REQUESTED');
  
  let cleanedCount = 0;
  const now = Date.now();
  
  // Clean up all rides in accepted status (force cleanup for debugging)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === RIDE_STATES.ACCEPTED) {
      logEvent('DEBUG_CLEANUP_ACCEPTED_RIDE', { rideId, age: Math.round((now - ride.lastUpdated)/1000) });
      
      // Force complete the ride
      updateRideState(rideId, RIDE_STATES.COMPLETED);
      
      // Notify user
      io.to(`user:${ride.userId}`).emit("ride_completed", {
        rideId: rideId,
        message: "Ride auto-completed (debug cleanup)",
        status: RIDE_STATES.COMPLETED,
        timestamp: Date.now(),
        fare: ride.price || null,        // Use original fare calculation from ride creation
        distance: ride.distance || null, // Use original distance if set
        duration: ride.duration || null  // Use original duration if set
      });
      
      // Notify driver if exists
      if (ride.driverId) {
        io.to(`driver:${ride.driverId}`).emit("ride_completed", {
          rideId: rideId,
          message: "Ride auto-completed (debug cleanup)",
          status: RIDE_STATES.COMPLETED,
          timestamp: Date.now()
        });
        resetDriverStatus(ride.driverId);
      }
      
      cleanupRide(rideId, ride.userId);
      cleanedCount++;
    }
  }
  
  // Clean up all rides in searching status (force cleanup for debugging)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === RIDE_STATES.SEARCHING) {
      logEvent('DEBUG_CLEANUP_SEARCHING_RIDE', { rideId, age: Math.round((now - ride.createdAt)/1000) });
      
      updateRideState(rideId, RIDE_STATES.EXPIRED);
      
      io.to(`user:${ride.userId}`).emit("ride_expired", {
        rideId: rideId,
        message: "Ride request expired (debug cleanup)"
      });
      
      cleanupRide(rideId, ride.userId);
      cleanedCount++;
    }
  }
  
  // Clean up all rides in arrived status (force cleanup for debugging)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === RIDE_STATES.ARRIVED) {
      logEvent('DEBUG_CLEANUP_ARRIVED_RIDE', { rideId, age: Math.round((now - ride.lastUpdated)/1000) });
      
      updateRideState(rideId, RIDE_STATES.COMPLETED);
      
      io.to(`user:${ride.userId}`).emit("ride_completed", {
        rideId: rideId,
        message: "Ride auto-completed (debug cleanup)",
        status: RIDE_STATES.COMPLETED,
        timestamp: Date.now()
      });
      
      if (ride.driverId) {
        io.to(`driver:${ride.driverId}`).emit("ride_completed", {
          rideId: rideId,
          message: "Ride auto-completed (debug cleanup)",
          status: RIDE_STATES.COMPLETED,
          timestamp: Date.now()
        });
        resetDriverStatus(ride.driverId);
      }
      
      cleanupRide(rideId, ride.userId);
      cleanedCount++;
    }
  }
  
  // Clean up all rides in started status (force cleanup for debugging)
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.status === RIDE_STATES.STARTED) {
      logEvent('DEBUG_CLEANUP_STARTED_RIDE', { rideId, age: Math.round((now - ride.lastUpdated)/1000) });
      
      updateRideState(rideId, RIDE_STATES.COMPLETED);
      
      io.to(`user:${ride.userId}`).emit("ride_completed", {
        rideId: rideId,
        message: "Ride auto-completed (debug cleanup)",
        status: RIDE_STATES.COMPLETED,
        timestamp: Date.now()
      });
      
      if (ride.driverId) {
        io.to(`driver:${ride.driverId}`).emit("ride_completed", {
          rideId: rideId,
          message: "Ride auto-completed (debug cleanup)",
          status: RIDE_STATES.COMPLETED,
          timestamp: Date.now()
        });
        resetDriverStatus(ride.driverId);
      }
      
      cleanupRide(rideId, ride.userId);
      cleanedCount++;
    }
  }
  
  // Clear all user active rides
  userActiveRides.clear();
  
  logEvent('DEBUG_CLEANUP_COMPLETE', { cleanedCount, remainingRides: activeRides.size });
  
  res.json({
    success: true,
    message: `Cleaned up ${cleanedCount} stuck rides`,
    cleanedCount,
    remainingRides: activeRides.size
  });
});

// Debug endpoint to get current state
app.get('/debug/state', (req, res) => {
  const state = {
    activeRides: Array.from(activeRides.entries()).map(([id, ride]) => ({
      id,
      status: ride.status,
      userId: ride.userId,
      driverId: ride.driverId,
      createdAt: ride.createdAt,
      lastUpdated: ride.lastUpdated,
      age: Math.round((Date.now() - ride.createdAt) / 1000)
    })),
    connectedDrivers: connectedDrivers.size,
    connectedUsers: connectedUsers.size,
    userActiveRides: Array.from(userActiveRides.entries()),
    rideLocks: Array.from(rideLocks),
    rideRequestRecipients: Array.from(rideRequestRecipients.entries())
  };
  
  res.json(state);
});

// Cancellation fee rules
const CANCELLATION_FEE_RULES = {
  USER: {
    BEFORE_DRIVER_ASSIGNMENT: 0,
    AFTER_DRIVER_ASSIGNMENT: 10, // ₹10
    AFTER_DRIVER_ARRIVAL: 25,    // ₹25
    AFTER_RIDE_START: null       // Cannot cancel
  },
  DRIVER: {
    BEFORE_ARRIVAL: 0,
    AFTER_ARRIVAL: 50,           // ₹50 penalty
    AFTER_RIDE_START: null       // Cannot cancel
  }
};

// Calculate cancellation fee based on ride state and who cancelled
const calculateCancellationFee = (ride, cancelledBy) => {
  if (!ride) return 0;
  
  const rules = CANCELLATION_FEE_RULES[cancelledBy];
  if (!rules) return 0;
  
  switch (ride.status) {
    case RIDE_STATES.SEARCHING:
      return rules.BEFORE_DRIVER_ASSIGNMENT;
    case RIDE_STATES.ACCEPTED:
      return rules.AFTER_DRIVER_ASSIGNMENT;
    case RIDE_STATES.ARRIVED:
      return cancelledBy === 'USER' ? rules.AFTER_DRIVER_ARRIVAL : rules.AFTER_ARRIVAL;
    case RIDE_STATES.STARTED:
    case RIDE_STATES.COMPLETED:
      return null; // Cannot cancel
    default:
      return 0;
  }
};

// Enhanced cancellation handler
const handleRideCancellation = (rideId, cancelledBy, reason = '') => {
  const ride = activeRides.get(rideId);
  if (!ride) {
    return { success: false, error: 'Ride not found' };
  }
  
  // Check if ride can be cancelled
  if (ride.status === RIDE_STATES.STARTED || ride.status === RIDE_STATES.COMPLETED) {
    return { success: false, error: 'Ride cannot be cancelled at this stage' };
  }
  
  // Calculate cancellation fee
  const cancellationFee = calculateCancellationFee(ride, cancelledBy);
  if (cancellationFee === null) {
    return { success: false, error: 'Ride cannot be cancelled at this stage' };
  }
  
  // Update ride state
  const updateResult = updateRideState(rideId, RIDE_STATES.CANCELLED, {
    cancelledAt: Date.now(),
    cancelledBy: cancelledBy,
    cancellationReason: reason,
    cancellationFee: cancellationFee
  });
  
  if (!updateResult.success) {
    return updateResult;
  }
  
  // Notify user
  io.to(`user:${ride.userId}`).emit("ride_cancelled", {
    rideId: rideId,
    status: RIDE_STATES.CANCELLED,
    message: `Ride cancelled by ${cancelledBy.toLowerCase()}`,
    cancellationFee: cancellationFee,
    cancellationReason: reason,
    timestamp: Date.now()
  });
  
  // Notify driver if ride was accepted
  if (ride.driverId) {
    resetDriverStatus(ride.driverId);
    
    io.to(`driver:${ride.driverId}`).emit("ride_cancelled", {
      rideId: rideId,
      status: RIDE_STATES.CANCELLED,
      message: `Ride cancelled by ${cancelledBy.toLowerCase()}`,
      cancellationFee: cancellationFee,
      cancellationReason: reason,
      timestamp: Date.now()
    });
    
    io.to(`driver:${ride.driverId}`).emit("driver_status_reset", {
      message: "Your status has been reset to available",
      timestamp: Date.now()
    });
  }
  
  // Clean up
  cleanupRide(rideId, ride.userId);
  
  return { 
    success: true, 
    cancellationFee: cancellationFee,
    message: `Ride cancelled successfully. ${cancellationFee > 0 ? `Cancellation fee: ₹${cancellationFee}` : 'No cancellation fee.'}`
  };
};

// Create HTTP server and attach Socket.IO
const server = require('http').createServer(app);

// Attach Socket.IO to server with error handling
if (io) {
  try {
    io.attach(server);
    logEvent('SOCKET_IO_ATTACHED', { success: true });
  } catch (error) {
    logEvent('SOCKET_IO_ATTACH_ERROR', { error: error.message });
  }
} else {
  logEvent('SOCKET_IO_NOT_AVAILABLE', { message: 'Socket.IO server not created, running HTTP-only mode' });
}

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  logEvent('SERVER_LISTENING', { port: PORT });
});

// Error handling for server
server.on('error', (error) => {
  logEvent('SERVER_ERROR', { error: error.message, code: error.code });
});

// Handle process termination
process.on('SIGTERM', () => {
  logEvent('SERVER_SHUTDOWN', { reason: 'SIGTERM' });
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logEvent('SERVER_SHUTDOWN', { reason: 'SIGINT' });
  server.close(() => {
    process.exit(0);
  });
});
