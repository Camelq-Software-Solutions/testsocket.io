const { Server } = require("socket.io");
const express = require("express");
const { v4: uuidv4 } = require("uuid");

// Generate UUID function
const generateUUID = () => {
  return uuidv4();
};

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS middleware for React Native and APK clients
app.use((req, res, next) => {
  // Allow all origins for APK compatibility
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin, User-Agent, X-Platform, X-Environment, X-App-Version');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced health check endpoint with APK-specific info
app.get('/health', (req, res) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      users: connectedUsers.size,
      drivers: connectedDrivers.size,
      activeRides: activeRides.size
    },
    clientInfo: {
      userAgent: userAgent.substring(0, 100), // Truncate for logging
      isAPK: isAPK,
      platform: req.headers['x-platform'] || 'unknown',
      environment: req.headers['x-environment'] || 'unknown',
      appVersion: req.headers['x-app-version'] || 'unknown'
    },
    serverConfig: {
      socketPath: '/socket.io/',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000
    }
  });
});

// Socket.IO endpoint info with APK recommendations
app.get('/socket-info', (req, res) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
  
  res.json({
    socketPath: '/socket.io/',
    transports: ['websocket', 'polling'],
    recommendedTransports: isAPK ? ['websocket'] : ['websocket', 'polling'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin', 'X-Requested-With', 'Accept', 'Origin', 'User-Agent', 'X-Platform', 'X-Environment', 'X-App-Version']
    },
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    apkRecommendations: isAPK ? {
      useWebSocketOnly: true,
      disableUpgrade: true,
      longerTimeouts: true,
      aggressiveReconnection: true
    } : null
  });
});

// React Native connection test endpoint
app.get('/test-connection', (req, res) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
  
  res.json({
    status: 'ok',
    message: 'Server is reachable from React Native',
    timestamp: new Date().toISOString(),
    headers: {
      'user-agent': userAgent,
      'x-platform': req.headers['x-platform'],
      'x-environment': req.headers['x-environment'],
      'x-app-version': req.headers['x-app-version']
    },
    clientType: isAPK ? 'APK' : 'Expo/Development',
    recommendations: isAPK ? {
      transport: 'websocket',
      upgrade: false,
      rememberUpgrade: false,
      timeout: 30000,
      reconnectionAttempts: 25
    } : {
      transport: 'websocket',
      upgrade: true,
      timeout: 20000,
      reconnectionAttempts: 15
    }
  });
});

// Socket.IO connection test endpoint
app.get('/socket-test', (req, res) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
  
  res.json({
    status: 'ok',
    message: 'Socket.IO server is running',
    socketPath: '/socket.io/',
    transports: ['websocket', 'polling'],
    recommendedTransports: isAPK ? ['websocket'] : ['websocket', 'polling'],
    serverTime: new Date().toISOString(),
    activeConnections: {
      users: connectedUsers.size,
      drivers: connectedDrivers.size,
      total: connectedUsers.size + connectedDrivers.size
    },
    clientType: isAPK ? 'APK' : 'Expo/Development'
  });
});

// React Native specific test endpoint
app.get('/react-native-test', (req, res) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
  
  res.json({
    status: 'ok',
    message: 'React Native Socket.IO test endpoint',
    recommendedConfig: isAPK ? {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      timeout: 30000,
      reconnectionAttempts: 25,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      extraHeaders: {
        'User-Agent': 'ReactNative-APK',
        'X-Platform': 'Android',
        'X-Environment': 'production'
      }
    } : {
      transports: ['websocket'],
      upgrade: true,
      timeout: 20000,
      reconnectionAttempts: 15,
      extraHeaders: {
        'User-Agent': 'ReactNative'
      }
    },
    serverTime: new Date().toISOString(),
    userAgent: userAgent,
    clientType: isAPK ? 'APK' : 'Expo/Development'
  });
});

// APK-specific test endpoint
app.get('/apk-test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'APK-specific test endpoint',
    recommendedConfig: {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      timeout: 30000,
      reconnectionAttempts: 25,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      pingTimeout: 60000,
      pingInterval: 25000,
      extraHeaders: {
        'User-Agent': 'ReactNative-APK',
        'X-Platform': 'Android',
        'X-Environment': 'production',
        'X-App-Version': '1.0.0'
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
const rideLocks = new Map();
const rideRequestRecipients = new Map();
const userActiveRides = new Map();
const rideAcceptanceAttempts = new Map();

// Store cancelled rides to prevent duplicate cancellation attempts
const cancelledRides = new Map();

// Chat message storage
const chatMessages = new Map(); // rideId -> messages array
const chatParticipants = new Map(); // rideId -> { userId, driverId }

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
  
  // Clean up cancelled rides after some time to prevent memory leaks
  setTimeout(() => {
    cancelledRides.delete(rideId);
  }, 300000); // 5 minutes
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
  
  // Emit state change events to users and drivers
  if (ride.userId) {
    io.to(`user:${ride.userId}`).emit("RIDE_STATE_CHANGED", {
      rideId,
      from: oldState,
      to: newState,
      userId: ride.userId,
      driverId: ride.driverId,
      timestamp: Date.now()
    });
  }
  
  if (ride.driverId) {
    io.to(`driver:${ride.driverId}`).emit("RIDE_STATE_CHANGED", {
      rideId,
      from: oldState,
      to: newState,
      userId: ride.userId,
      driverId: ride.driverId,
      timestamp: Date.now()
    });
  }
  
  return { success: true, ride };
};

// Cleanup interval for stale data
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Clean up stale ride locks (older than 30 seconds)
  for (const [rideId, lockTime] of rideLocks) {
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
      activeRides: activeRides.size,
      cancelledRides: cancelledRides.size,
      rideLocks: rideLocks.size
    }
  });
});

// Debug endpoint to check ride states
app.get('/debug/rides', (req, res) => {
  const rideId = req.query.rideId;
  
  if (rideId) {
    const activeRide = activeRides.get(rideId);
    const cancelledRide = cancelledRides.get(rideId);
    
    res.json({
      rideId,
      activeRide: activeRide ? {
        status: activeRide.status,
        driverId: activeRide.driverId,
        userId: activeRide.userId,
        createdAt: activeRide.createdAt
      } : null,
      cancelledRide: cancelledRide ? {
        status: cancelledRide.status,
        cancelledAt: cancelledRide.cancelledAt,
        cancelledBy: cancelledRide.cancelledBy,
        cancellationReason: cancelledRide.cancellationReason
      } : null,
      isLocked: rideLocks.has(rideId),
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      activeRides: Array.from(activeRides.keys()),
      cancelledRides: Array.from(cancelledRides.keys()),
      totalActive: activeRides.size,
      totalCancelled: cancelledRides.size,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to force cleanup a ride
app.post('/debug/cleanup-ride/:rideId', (req, res) => {
  const { rideId } = req.params;
  
  const activeRide = activeRides.get(rideId);
  const cancelledRide = cancelledRides.get(rideId);
  
  if (activeRide) {
    cleanupRide(rideId, activeRide.userId);
    res.json({ 
      success: true, 
      message: `Cleaned up active ride ${rideId}`,
      action: 'cleaned_active_ride'
    });
  } else if (cancelledRide) {
    cancelledRides.delete(rideId);
    res.json({ 
      success: true, 
      message: `Cleaned up cancelled ride ${rideId}`,
      action: 'cleaned_cancelled_ride'
    });
  } else {
    res.json({ 
      success: false, 
      message: `Ride ${rideId} not found in active or cancelled rides` 
    });
  }
});

// Debug endpoint to force cancel a ride
app.post('/debug/force-cancel-ride/:rideId', (req, res) => {
  const { rideId } = req.params;
  const { cancelledBy = 'SYSTEM', reason = 'Force cancelled via debug endpoint' } = req.body;
  
  console.log(`🔧 Force cancelling ride ${rideId} via debug endpoint`);
  
  const activeRide = activeRides.get(rideId);
  if (!activeRide) {
    res.json({ 
      success: false, 
      message: `Ride ${rideId} not found in active rides` 
    });
    return;
  }
  
  try {
    // Force cancel the ride
    const result = handleRideCancellation(rideId, cancelledBy, reason);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Force cancelled ride ${rideId}`,
        cancellationFee: result.cancellationFee,
        action: 'force_cancelled_ride'
      });
    } else {
      res.json({ 
        success: false, 
        message: `Failed to force cancel ride ${rideId}: ${result.error}`,
        error: result.error
      });
    }
  } catch (error) {
    console.error(`❌ Error force cancelling ride ${rideId}:`, error);
    res.json({ 
      success: false, 
      message: `Error force cancelling ride ${rideId}: ${error.message}`,
      error: error.message
    });
  }
});

// Debug endpoint
app.get('/debug/sockets', (req, res) => {
  const debugInfo = {
    connectedUsers: Array.from(connectedUsers.entries()),
    connectedDrivers: Array.from(connectedDrivers.entries()),
    activeRides: Array.from(activeRides.entries()),
    userActiveRides: Array.from(userActiveRides.entries()),
    rideLocks: Array.from(rideLocks.entries()),
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
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin", "X-Requested-With", "Accept", "Origin", "User-Agent", "X-Platform", "X-Environment", "X-App-Version"]
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
    httpCompression: true,
    // APK-specific optimizations
    upgrade: true,
    rememberUpgrade: true,
    // Enhanced error handling
    handlePreflightRequest: (req, res) => {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Access-Control-Allow-Origin, X-Requested-With, Accept, Origin, User-Agent, X-Platform, X-Environment, X-App-Version",
        "Access-Control-Allow-Credentials": true
      });
      res.end();
    }
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
    const userAgent = err.req?.headers['user-agent'] || 'Unknown';
    const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
    
    logEvent('CONNECTION_ERROR', {
      type: err.type,
      message: err.message,
      context: err.context,
      clientType: isAPK ? 'APK' : 'Expo/Development',
      req: {
        headers: {
          'user-agent': userAgent,
          'x-platform': err.req?.headers['x-platform'],
          'x-environment': err.req?.headers['x-environment'],
          'x-app-version': err.req?.headers['x-app-version']
        },
        url: err.req?.url,
        method: err.req?.method
      }
    });
    
    // Special handling for React Native XHR errors
    if (err.message.includes('xhr poll error')) {
      logEvent('REACT_NATIVE_XHR_ERROR', {
        message: 'React Native XHR polling error detected',
        clientType: isAPK ? 'APK' : 'Expo/Development',
        suggestion: isAPK ? 'APK client should use WebSocket transport only' : 'Client should use WebSocket transport'
      });
    }
    
    // Special handling for APK-specific errors
    if (isAPK) {
      logEvent('APK_CONNECTION_ERROR', {
        message: 'APK-specific connection error detected',
        error: err.message,
        recommendations: [
          'Use WebSocket transport only',
          'Disable transport upgrade',
          'Increase connection timeout',
          'Use aggressive reconnection'
        ]
      });
    }
  });
}

if (io) {
  io.on("connection", (socket) => {
  try {
    const { type, id, platform, version } = socket.handshake.query;
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    const origin = socket.handshake.headers.origin || 'Unknown';
    const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk') || platform === 'android-apk';
  
  logEvent('NEW_CONNECTION', { 
    socketId: socket.id, 
    type, 
    id, 
    platform,
    version,
    userAgent: userAgent.substring(0, 100), // Truncate for logging
    origin,
    transport: socket.conn.transport.name,
    remoteAddress: socket.handshake.address,
    clientType: isAPK ? 'APK' : 'Expo/Development',
    headers: {
      'x-platform': socket.handshake.headers['x-platform'],
      'x-environment': socket.handshake.headers['x-environment'],
      'x-app-version': socket.handshake.headers['x-app-version']
    }
  });
  
  // APK-specific connection handling
  if (isAPK) {
    logEvent('APK_CONNECTION', {
      socketId: socket.id,
      type,
      id,
      transport: socket.conn.transport.name,
      recommendations: [
        'Monitor connection stability',
        'Use WebSocket transport only',
        'Implement aggressive reconnection'
      ]
    });
  }

  // Test event handler
  socket.on("test_event", (data) => {
    logEvent('TEST_EVENT', { socketId: socket.id, data });
    socket.emit("test_response", {
      message: "Hello from server!",
      received: data,
      timestamp: Date.now()
    });
  });

  // Enhanced disconnection handling for APK clients
  socket.on("disconnect", (reason) => {
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
    const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
    
    logEvent('SOCKET_DISCONNECT', {
      socketId: socket.id,
      type,
      id,
      reason,
      clientType: isAPK ? 'APK' : 'Expo/Development',
      transport: socket.conn.transport.name
    });
    
    if (isAPK) {
      logEvent('APK_DISCONNECT', {
        socketId: socket.id,
        reason,
        recommendations: [
          'Check network connectivity',
          'Verify server reachability',
          'Monitor reconnection attempts'
        ]
      });
    }
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
    
    // Use backend ride ID if provided, otherwise generate proper UUID
    let rideId;
    if (data.rideId && !data.rideId.startsWith('ride_')) {
      // Customer app provided the backend ride ID
      rideId = data.rideId;
      logEvent('USING_BACKEND_RIDE_ID', { rideId: data.rideId });
    } else {
      // Generate proper UUID for backend compatibility
      rideId = generateUUID();
      logEvent('GENERATED_UUID_RIDE_ID', { rideId });
    }
    
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
    
    // If we're using a backend ride ID, include it in the request for drivers
    if (data.rideId && !data.rideId.startsWith('ride_')) {
      rideRequest.backendRideId = data.rideId;
      rideRequest.originalRideId = data.rideId;
      logEvent('ADDED_BACKEND_RIDE_ID_TO_REQUEST', { backendRideId: data.rideId });
    }
    
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
    rideLocks.set(data.rideId, Date.now());
    
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
    
    // Notify customer that driver has sent OTP (for new flow where customer doesn't enter MPIN)
    io.to(`user:${ride.userId}`).emit("DRIVER_SENT_OTP", {
      rideId: data.rideId,
      driverId: data.driverId,
      otp: data.otp,
      message: "Driver has entered OTP, ride can proceed"
    });
    
    logEvent('CUSTOMER_NOTIFIED_OTP', { rideId: data.rideId, userId: ride.userId });
    
    // Auto-start the ride since customer doesn't need to enter MPIN anymore
    setTimeout(() => {
      const updateResult = updateRideState(data.rideId, RIDE_STATES.STARTED);
      if (updateResult.success) {
        logEvent('RIDE_AUTO_STARTED_AFTER_OTP', { rideId: data.rideId, driverId: data.driverId });
        
        // Notify customer that ride has started
        io.to(`user:${ride.userId}`).emit("ride_started", {
          rideId: data.rideId,
          driverId: data.driverId,
          message: "Ride has started automatically after OTP verification",
          status: RIDE_STATES.STARTED
        });
        
        // Notify driver that ride has started
        io.to(`driver:${ride.driverId}`).emit("ride_started", {
          rideId: data.rideId,
          message: "Ride has started automatically after OTP verification",
          status: RIDE_STATES.STARTED
        });
        
        // Clean up OTP data
        delete ride.driverOtp;
        delete ride.otpTimestamp;
      }
    }, 2000); // 2 second delay to allow customer to see the OTP notification
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
    console.log(`🚫 Driver cancellation request received:`, data);
    logEvent('DRIVER_CANCEL_RIDE_REQUEST', data);
    
    // Check if ride is locked
    if (rideLocks.has(data.rideId)) {
      logEvent('RIDE_LOCKED_DRIVER_CANCEL', { rideId: data.rideId });
      socket.emit("driver_cancellation_error", {
        message: "Ride is currently being processed. Please wait a moment."
      });
      return;
    }
    
    // Lock the ride to prevent concurrent cancellation attempts
    rideLocks.set(data.rideId, Date.now());
    
    try {
      // Log current ride status before attempting cancellation
      const currentRide = activeRides.get(data.rideId);
      if (currentRide) {
        console.log(`🔍 Current ride status: ${currentRide.status} for ride: ${data.rideId}`);
      }
      
      // Use enhanced cancellation handler
      const result = handleRideCancellation(data.rideId, 'DRIVER', data.reason || '');
      
      if (result.success) {
        console.log(`✅ Driver cancellation successful for ride: ${data.rideId}`);
        logEvent('DRIVER_CANCELLATION_COMPLETE', { 
          rideId: data.rideId, 
          cancelledBy: 'DRIVER',
          fee: result.cancellationFee 
        });
        socket.emit("driver_cancellation_success", {
          message: result.message,
          cancellationFee: result.cancellationFee,
          rideId: data.rideId
        });
      } else {
        console.log(`❌ Driver cancellation failed for ride: ${data.rideId}, error: ${result.error}`);
        logEvent('DRIVER_CANCELLATION_FAILED', { rideId: data.rideId, error: result.error });
        
        // Send error with appropriate flags
        const errorResponse = { 
          message: result.error,
          rideId: data.rideId,
          alreadyCancelled: result.alreadyCancelled || false,
          notFound: result.notFound || false,
          currentStatus: result.currentStatus || null
        };
        console.log(`📤 Sending cancellation error response:`, errorResponse);
        socket.emit("driver_cancellation_error", errorResponse);
      }
    } catch (error) {
      logEvent('DRIVER_CANCELLATION_EXCEPTION', { rideId: data.rideId, error: error.message });
      socket.emit("driver_cancellation_error", { 
        message: "An error occurred while cancelling the ride",
        rideId: data.rideId
      });
    } finally {
      // Always release the lock
      rideLocks.delete(data.rideId);
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
  // CHAT FUNCTIONALITY
  // ========================================

  // Event: Send chat message
  socket.on("send_chat_message", (data) => {
    const { rideId, senderId, senderType, message, rideId: messageRideId } = data;
    
    logEvent('SEND_CHAT_MESSAGE', { 
      rideId, 
      senderId, 
      senderType, 
      messageLength: message.length 
    });

    // Validate ride exists and sender is participant
    const ride = activeRides.get(rideId);
    if (!ride) {
      socket.emit("chat_message_error", { 
        message: "Ride not found" 
      });
      return;
    }

    // Check if sender is part of this ride
    const isUser = senderType === 'user' && ride.userId === senderId;
    const isDriver = senderType === 'driver' && ride.driverId === senderId;
    
    if (!isUser && !isDriver) {
      socket.emit("chat_message_error", { 
        message: "You are not authorized to send messages for this ride" 
      });
      return;
    }

    // Create message object
    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rideId: rideId,
      senderId: senderId,
      senderType: senderType,
      message: message.trim(),
      timestamp: Date.now(),
      isRead: false
    };

    // Store message
    if (!chatMessages.has(rideId)) {
      chatMessages.set(rideId, []);
    }
    chatMessages.get(rideId).push(chatMessage);

    // Emit to both participants
    const messageData = {
      ...chatMessage,
      timestamp: new Date(chatMessage.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    // Send to user
    io.to(`user:${ride.userId}`).emit("receive_chat_message", messageData);
    
    // Send to driver if ride is accepted
    if (ride.driverId) {
      io.to(`driver:${ride.driverId}`).emit("receive_chat_message", messageData);
    }

    // Send confirmation to sender
    socket.emit("chat_message_sent", {
      messageId: chatMessage.id,
      timestamp: messageData.timestamp
    });

    logEvent('CHAT_MESSAGE_SENT', { 
      rideId, 
      messageId: chatMessage.id, 
      senderType 
    });
  });

  // Event: Mark messages as read
  socket.on("mark_messages_read", (data) => {
    const { rideId, readerId, readerType } = data;
    
    logEvent('MARK_MESSAGES_READ', { rideId, readerId, readerType });

    const ride = activeRides.get(rideId);
    if (!ride) {
      return;
    }

    // Validate reader is participant
    const isUser = readerType === 'user' && ride.userId === readerId;
    const isDriver = readerType === 'driver' && ride.driverId === readerId;
    
    if (!isUser && !isDriver) {
      return;
    }

    // Mark messages as read
    const messages = chatMessages.get(rideId);
    if (messages) {
      messages.forEach(msg => {
        if (msg.senderType !== readerType && !msg.isRead) {
          msg.isRead = true;
        }
      });
    }

    // Notify other participant
    const otherParticipantId = readerType === 'user' ? ride.driverId : ride.userId;
    const otherParticipantType = readerType === 'user' ? 'driver' : 'user';
    
    if (otherParticipantId) {
      io.to(`${otherParticipantType}:${otherParticipantId}`).emit("messages_read", {
        rideId: rideId,
        readBy: readerId,
        readByType: readerType,
        timestamp: Date.now()
      });
    }
  });

  // Event: Get chat history
  socket.on("get_chat_history", (data) => {
    const { rideId, requesterId, requesterType } = data;
    
    logEvent('GET_CHAT_HISTORY', { rideId, requesterId, requesterType });

    const ride = activeRides.get(rideId);
    if (!ride) {
      socket.emit("chat_history_error", { 
        message: "Ride not found" 
      });
      return;
    }

    // Validate requester is participant
    const isUser = requesterType === 'user' && ride.userId === requesterId;
    const isDriver = requesterType === 'driver' && ride.driverId === requesterId;
    
    if (!isUser && !isDriver) {
      socket.emit("chat_history_error", { 
        message: "You are not authorized to view messages for this ride" 
      });
      return;
    }

    // Get chat history
    const messages = chatMessages.get(rideId) || [];
    const formattedMessages = messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }));

    socket.emit("chat_history", {
      rideId: rideId,
      messages: formattedMessages,
      totalMessages: formattedMessages.length
    });

    logEvent('CHAT_HISTORY_SENT', { 
      rideId, 
      messageCount: formattedMessages.length 
    });
  });

  // Event: Typing indicator
  socket.on("typing_start", (data) => {
    const { rideId, senderId, senderType } = data;
    
    const ride = activeRides.get(rideId);
    if (!ride) return;

    // Validate sender is participant
    const isUser = senderType === 'user' && ride.userId === senderId;
    const isDriver = senderType === 'driver' && ride.driverId === senderId;
    
    if (!isUser && !isDriver) return;

    // Emit typing indicator to other participant
    const otherParticipantId = senderType === 'user' ? ride.driverId : ride.userId;
    const otherParticipantType = senderType === 'user' ? 'driver' : 'user';
    
    if (otherParticipantId) {
      io.to(`${otherParticipantType}:${otherParticipantId}`).emit("typing_indicator", {
        rideId: rideId,
        isTyping: true,
        senderId: senderId,
        senderType: senderType
      });
    }
  });

  socket.on("typing_stop", (data) => {
    const { rideId, senderId, senderType } = data;
    
    const ride = activeRides.get(rideId);
    if (!ride) return;

    // Validate sender is participant
    const isUser = senderType === 'user' && ride.userId === senderId;
    const isDriver = senderType === 'driver' && ride.driverId === senderId;
    
    if (!isUser && !isDriver) return;

    // Emit typing stop to other participant
    const otherParticipantId = senderType === 'user' ? ride.driverId : ride.userId;
    const otherParticipantType = senderType === 'user' ? 'driver' : 'user';
    
    if (otherParticipantId) {
      io.to(`${otherParticipantType}:${otherParticipantId}`).emit("typing_indicator", {
        rideId: rideId,
        isTyping: false,
        senderId: senderId,
        senderType: senderType
      });
    }
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
    rideLocks: Array.from(rideLocks.entries()),
    rideRequestRecipients: Array.from(rideRequestRecipients.entries())
  };
  
  res.json(state);
});

// APK-specific debug endpoint
app.get('/debug/apk-connections', (req, res) => {
  const apkConnections = [];
  const expoConnections = [];
  
  // Analyze connected users
  for (const [userId, user] of connectedUsers.entries()) {
    const userSocket = io.sockets.sockets.get(user.socketId);
    if (userSocket) {
      const userAgent = userSocket.handshake.headers['user-agent'] || 'Unknown';
      const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
      
      const connectionInfo = {
        userId,
        socketId: user.socketId,
        userAgent: userAgent.substring(0, 100),
        transport: userSocket.conn.transport.name,
        platform: userSocket.handshake.headers['x-platform'],
        environment: userSocket.handshake.headers['x-environment'],
        appVersion: userSocket.handshake.headers['x-app-version'],
        lastSeen: user.lastSeen,
        isAPK
      };
      
      if (isAPK) {
        apkConnections.push(connectionInfo);
      } else {
        expoConnections.push(connectionInfo);
      }
    }
  }
  
  // Analyze connected drivers
  for (const [driverId, driver] of connectedDrivers.entries()) {
    const driverSocket = io.sockets.sockets.get(driver.socketId);
    if (driverSocket) {
      const userAgent = driverSocket.handshake.headers['user-agent'] || 'Unknown';
      const isAPK = userAgent.includes('ReactNative-APK') || userAgent.includes('android-apk');
      
      const connectionInfo = {
        driverId,
        socketId: driver.socketId,
        userAgent: userAgent.substring(0, 100),
        transport: driverSocket.conn.transport.name,
        platform: driverSocket.handshake.headers['x-platform'],
        environment: driverSocket.handshake.headers['x-environment'],
        appVersion: driverSocket.handshake.headers['x-app-version'],
        lastSeen: driver.lastSeen,
        status: driver.status,
        isAPK
      };
      
      if (isAPK) {
        apkConnections.push(connectionInfo);
      } else {
        expoConnections.push(connectionInfo);
      }
    }
  }
  
  res.json({
    apkConnections: {
      count: apkConnections.length,
      connections: apkConnections
    },
    expoConnections: {
      count: expoConnections.length,
      connections: expoConnections
    },
    summary: {
      totalConnections: apkConnections.length + expoConnections.length,
      apkPercentage: ((apkConnections.length / (apkConnections.length + expoConnections.length)) * 100).toFixed(2) + '%',
      expoPercentage: ((expoConnections.length / (apkConnections.length + expoConnections.length)) * 100).toFixed(2) + '%'
    },
    serverTime: new Date().toISOString()
  });
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
  console.log(`🔍 Cancellation request for ride: ${rideId}, by: ${cancelledBy}`);
  
  // First check if ride was already cancelled
  const cancelledRide = cancelledRides.get(rideId);
  if (cancelledRide) {
    console.log(`❌ Ride ${rideId} was already cancelled at ${cancelledRide.cancelledAt}`);
    return { success: false, error: 'Ride has already been cancelled', alreadyCancelled: true };
  }
  
  const ride = activeRides.get(rideId);
  if (!ride) {
    console.log(`❌ Ride ${rideId} not found in active rides`);
    return { success: false, error: 'Ride not found', notFound: true };
  }
  
  // Check if ride is already cancelled
  if (ride.status === RIDE_STATES.CANCELLED) {
    console.log(`❌ Ride ${rideId} status is already cancelled`);
    return { success: false, error: 'Ride has already been cancelled', alreadyCancelled: true };
  }
  
  // Check if ride can be cancelled
  if (ride.status === RIDE_STATES.STARTED || ride.status === RIDE_STATES.COMPLETED) {
    console.log(`❌ Ride ${rideId} cannot be cancelled at status: ${ride.status}`);
    return { 
      success: false, 
      error: `Ride cannot be cancelled at this stage. Current status: ${ride.status}`,
      currentStatus: ride.status
    };
  }
  
  // Calculate cancellation fee
  const cancellationFee = calculateCancellationFee(ride, cancelledBy);
  if (cancellationFee === null) {
    console.log(`❌ Ride ${rideId} cannot be cancelled at this stage`);
    return { success: false, error: 'Ride cannot be cancelled at this stage' };
  }
  
  console.log(`✅ Proceeding with cancellation for ride: ${rideId}`);
  
  // Update ride state
  const updateResult = updateRideState(rideId, RIDE_STATES.CANCELLED, {
    cancelledAt: Date.now(),
    cancelledBy: cancelledBy,
    cancellationReason: reason,
    cancellationFee: cancellationFee
  });
  
  if (!updateResult.success) {
    console.log(`❌ Failed to update ride state: ${updateResult.error}`);
    return updateResult;
  }
  
  // Store cancelled ride for reference
  cancelledRides.set(rideId, {
    ...ride,
    status: RIDE_STATES.CANCELLED,
    cancelledAt: Date.now(),
    cancelledBy: cancelledBy,
    cancellationReason: reason,
    cancellationFee: cancellationFee
  });
  
  console.log(`✅ Ride ${rideId} successfully cancelled and stored in cancelledRides`);
  
  // Notify user
  console.log(`📤 Notifying user ${ride.userId} about ride cancellation`);
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
    console.log(`📤 Notifying driver ${ride.driverId} about ride cancellation`);
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
  
  console.log(`✅ Cancellation complete for ride: ${rideId}`);
  
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

// Periodic cleanup of old cancelled rides
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000; // 5 minutes
  
  for (const [rideId, ride] of cancelledRides.entries()) {
    if (ride.cancelledAt && ride.cancelledAt < fiveMinutesAgo) {
      cancelledRides.delete(rideId);
      logEvent('CLEANUP_OLD_CANCELLED_RIDE', { rideId });
    }
  }
}, 60000); // Run every minute

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