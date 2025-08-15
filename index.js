const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const config = require('./config/config');

// Import middleware
const { logger, errorLogger, performanceMonitor } = require('./middleware/logger');
const { apiLimiter, authLimiter, searchLimiter, bookingLimiter } = require('./middleware/rateLimit');
const { cacheControl, serverCache } = require('./middleware/cache');
const { detectVersion, deprecationCheck, versionedResponse } = require('./middleware/apiVersion');
const { protect, authorize, refreshToken } = require('./middleware/auth');
const { handleValidationErrors } = require('./middleware/validation');

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isProduction = !isDevelopment && !isTest;

// Connect to MongoDB
connectDB();

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: [config.clientUrl, config.adminUrl],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// ===== MIDDLEWARE SETUP =====

// 1. Basic security middleware (should come first)
app.use(helmet()); // Protect against web vulnerabilities
app.use(cors({
  origin: [config.clientUrl, config.adminUrl],
  credentials: true,
  exposedHeaders: ['API-Version', 'API-Deprecation-Info', 'New-Token'] // Allow front-end to see custom headers
}));

// 2. Request logging middleware
app.use(logger); // Main logger middleware

// 3. Performance monitoring middleware
if (!isTest) {
  app.use(performanceMonitor); // Track request timing and resource usage
}

// 4. API versioning middleware
app.use(detectVersion()); // Detect and set API version
app.use(deprecationCheck()); // Check for deprecated API versions
app.use(versionedResponse()); // Format responses based on API version

// 5. Server compression middleware
app.use(compression()); // Compress responses

// 6. Body parsing middleware
app.use(express.json({ limit: '1mb' })); // Parse JSON request bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Parse URL-encoded request bodies
app.use(cookieParser(config.cookieSecret)); // Parse cookies

// 7. Rate limiting middleware (application-wide)
if (!isDevelopment && !isTest) {
  app.use(apiLimiter); // Apply general rate limiting to all routes
}

// 8. Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.get('/', (req, res) => {
  res.send('Welcome to Bus Booking API');
});

// 9. Health check route (excluded from most middleware)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// ===== ROUTES =====

// Authenticate routes
app.use('/api/auth', authLimiter, require('./routes/auth')); // Apply auth-specific rate limiting

// Apply cache control middleware to common read endpoints
const standardCacheControl = cacheControl({ maxAge: 300 }); // 5 minute default cache
const noCacheControl = cacheControl({ noCache: true }); // No cache for sensitive/dynamic routes

// User routes
app.use('/api/users', 
  searchLimiter, 
  standardCacheControl,
  require('./routes/users')
);

// Bus routes
app.use('/api/buses', 
  require('./routes/buses')
);

// Route routes
app.use('/api/routes', 
  standardCacheControl,
  serverCache(), // Use default TTL from route config
  require('./routes/routes')
);

// Booking routes (no caching for booking operations)
app.use('/api/bookings', 
  //bookingLimiter,
  noCacheControl,
  require('./routes/bookings')
);

// Payment routes (no caching for payment operations)
app.use('/api/payments', 
  noCacheControl,
  require('./routes/payments')
);

// Hiring routes (no caching for hiring operations)
app.use('/api/hiring', 
  //bookingLimiter,
  noCacheControl,
  require('./routes/hiring')
);

app.use(
  "/api/locations",
  require("./routes/locations")
);

// Notification routes (no caching for real-time updates)
app.use('/api/notifications', 
  noCacheControl,
  require('./routes/notifications')
);

// Debug routes (development only)
if (isDevelopment) {
  app.use('/api/debug', 
    noCacheControl,
    require('./routes/debug')
  );
}

// Analytics routes - disabled (requires analytics controller)
// app.use('/api/analytics', 
//   protect, 
//   authorize('admin'),
//   refreshToken,
//   standardCacheControl,
//   require('./routes/analytics')
// );

// ===== ERROR HANDLING =====

// Validation error handler
app.use(handleValidationErrors);

// Main error logger and handler
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Determine status code: use error's status code or default to 500
  const statusCode = err.statusCode || err.status || 500;
  
  // Format error response based on environment
  const errorResponse = {
    status: 'error',
    message: err.message || 'Internal Server Error',
  };
  
  // Include stack trace and additional details in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }
  
  res.status(statusCode).json(errorResponse);
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// ===== SOCKET.IO SETUP =====

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  // Handle user authentication for notifications
  socket.on('authenticate', (data) => {
    try {
      // In a real app, you'd verify the JWT token here
      const { userId, token } = data;
      
      // For now, we'll just join the user to their room
      if (userId) {
        socket.join(`user:${userId}`);
        socket.userId = userId;
        console.log(`User ${userId} authenticated and joined their room`);
        
        // Send confirmation
        socket.emit('authenticated', { success: true, userId });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('authenticated', { success: false, error: 'Authentication failed' });
    }
  });
  
  // Handle user disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User ${socket.userId} disconnected`);
    }
    console.log('Client disconnected', socket.id);
  });
  
  // Handle booking status updates
  socket.on('join:booking', (bookingId) => {
    socket.join(`booking:${bookingId}`);
    console.log(`Socket ${socket.id} joined booking room: ${bookingId}`);
  });
  
  // Handle bus location tracking
  socket.on('join:bus', (busId) => {
    socket.join(`bus:${busId}`);
    console.log(`Socket ${socket.id} joined bus room: ${busId}`);
  });
  
  // Handle notification events
  socket.on('notification:read', (notificationId) => {
    // This could be used to sync read status across multiple devices
    if (socket.userId) {
      socket.to(`user:${socket.userId}`).emit('notification:syncRead', { notificationId });
    }
  });
});

// ===== SERVER STARTUP =====

// Start server
const PORT = config.port || 5000;
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/**
 * Graceful shutdown function
 * Closes server connections and performs cleanup
 */
async function gracefulShutdown() {
  console.log('Received shutdown signal, closing connections...');
  
  // Close HTTP server first (stop accepting new connections)
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Close Socket.io connections
  io.close(() => {
    console.log('Socket.io connections closed');
  });
  
  try {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

module.exports = app;

