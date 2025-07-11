# SocketIO Real-Time Ride Booking System

A complete real-time ride booking system built with SocketIO, featuring user and driver apps with live location tracking and ride management.

## 🚀 Features

### Real-Time Communication
- **WebSocket connections** with polling fallback
- **Automatic reconnection** handling
- **Connection status** monitoring
- **Railway deployment** ready

### Ride Management
- **Unique ride ID** generation
- **Ride status tracking** (pending → accepted → started → completed)
- **One-to-one flow** (first driver wins)
- **Automatic cleanup** on completion

### Driver Management
- **Online/offline status** tracking
- **Real-time location** updates
- **Ride acceptance** with conflict resolution
- **Active ride management**

### User Experience
- **Real-time ride status** updates
- **Driver location** tracking on map
- **Ride acceptance** notifications
- **Error handling** and user feedback

## 📁 Project Structure

```
testsocket.io/
├── index.js                          # Enhanced SocketIO server
├── test_ride_booking_flow.js        # Complete flow test
├── package.json                      # Server dependencies
├── SOCKETIO_RIDE_BOOKING_GUIDE.md   # Complete implementation guide
├── testinguser/                      # User app
│   ├── src/utils/socket.ts          # Enhanced socket utility
│   └── src/screens/home/HomeScreen.tsx # Enhanced user interface
└── ridersony/                        # Driver app
    ├── src/utils/socket.ts          # Enhanced socket manager
    └── src/screens/home/HomeScreen.tsx # Enhanced existing driver interface
```

## 🛠️ Quick Start

### 1. Server Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test:flow
```

### 2. User App
```bash
cd testinguser
npm install
npm start
```

### 3. Driver App
```bash
cd ridersony
npm install
npm start
```

## 🧪 Testing

### Automated Tests
```bash
# Test basic connection
npm run test:connection

# Test driver connection
npm run test:driver

# Test ride request
npm run test:ride

# Test complete flow (recommended)
npm run test:flow
```

### Manual Testing
1. Start the server: `npm start`
2. Open user app and connect to socket
3. Open driver app and go online
4. Book a ride from user app
5. Accept ride from driver app
6. Verify real-time updates in both apps

## 🌐 Deployment

### Railway Deployment
The server is configured for Railway deployment:
- **URL**: `https://testsocketio-roqet.up.railway.app`
- **Health Check**: `/health`
- **Stats**: `/stats`

### Client Configuration
Both apps are configured to connect to the Railway server automatically.

## 📊 Server Endpoints

- `GET /` - Server status
- `GET /health` - Health check with connection stats
- `GET /stats` - Detailed server statistics

## 🔄 Real-Time Events

### User Events
- `book_ride` - Request a ride
- `ride_booked` - Ride booking confirmed
- `ride_accepted` - Driver accepted ride
- `driver_location_update` - Real-time driver location
- `ride_status_update` - Ride status changes
- `driver_offline` - Driver went offline

### Driver Events
- `new_ride_request` - New ride available
- `ride_taken` - Another driver accepted ride
- `ride_response` - Accept/reject ride
- `ride_response_error` - Error in response
- `ride_response_confirmed` - Response confirmed

## 🎯 Key Features Implemented

### ✅ Server Features
- Real-time ride tracking with in-memory storage
- Driver connection management with status tracking
- One-to-one ride acceptance (first driver wins)
- Location updates and ride status management
- Comprehensive error handling and logging

### ✅ User App Features
- Type-safe event callbacks for better development
- Automatic ride booking with real-time status updates
- Driver location tracking on map
- Ride status management with UI updates
- Error handling and connection management

### ✅ Driver App Features
- Enhanced existing HomeScreen with socket integration
- Online/offline toggle with status management
- Real-time ride requests with accept/reject options
- Active ride management with start/complete actions
- Location updates for user tracking
- Connection status monitoring
- Socket integration through OnlineStatusContext

## 📚 Documentation

- **[Complete Implementation Guide](SOCKETIO_RIDE_BOOKING_GUIDE.md)** - Step-by-step guide
- **[Server Configuration](index.js)** - Enhanced SocketIO server
- **[User App Integration](testinguser/src/utils/socket.ts)** - Enhanced socket utility
- **[Driver App Integration](ridersony/src/utils/socket.ts)** - Enhanced socket manager

## 🔧 Configuration

### Server Configuration
```javascript
// Enhanced server with ride tracking
const activeRides = new Map();
const connectedDrivers = new Map();
const connectedUsers = new Map();
```

### Client Configuration
```typescript
// User app socket connection
const socket = io(SOCKET_URL, {
  query: { type: "user", id: userId }
});

// Driver app socket connection
const socket = io(SOCKET_URL, {
  query: { type: "driver", id: driverId }
});
```

## 🚀 Next Steps for Production

1. **Database Integration** - Replace in-memory storage with Redis or PostgreSQL
2. **Authentication** - Add JWT-based user/driver authentication
3. **Geolocation Filtering** - Filter drivers by proximity to user
4. **Payment Integration** - Add payment processing for completed rides
5. **Push Notifications** - Implement push notifications for offline users
6. **Analytics** - Add ride analytics and driver performance tracking
7. **Rate Limiting** - Implement rate limiting for API endpoints
8. **Monitoring** - Add comprehensive monitoring and alerting

## 🐛 Troubleshooting

### Common Issues
1. **Connection Failed** - Check Railway deployment status
2. **Events Not Received** - Verify event names match between client/server
3. **Ride Not Accepted** - Check if driver is online and connected
4. **Location Not Updating** - Verify location permissions and socket connection

### Debug Commands
```bash
# Check server status
curl https://testsocketio-roqet.up.railway.app/health

# Check server stats
curl https://testsocketio-roqet.up.railway.app/stats

# Test complete flow
npm run test:flow
```

## 📄 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

---

**Built with ❤️ using SocketIO, React Native, and Railway**
