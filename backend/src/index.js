function safeUse(path, route) {
  if (!route || typeof route !== "function") {
    console.warn(`Skipping route ${path} because require returned ${route}`);
    return;
  }
  app.use(path, route);
}
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { connectDB } = require('./config/database');
// const websocketService = require('./services/websocketService');
const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');
// const monitoringService = require('./services/monitoringService');
// const { requestMonitoring, errorMonitoring } = require('./middleware/monitoring');
const securityService = require('./services/securityService');

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const mcpRoutes = require('./routes/mcp');
const userRoutes = require('./routes/user');
const billingRoutes = require('./routes/billing');
const monitoringRoutes = require('./routes/monitoring');
const securityRoutes = require('./routes/security');
const gatewayRoutes = require('./routes/gateway');
const organizationRoutes = require('./routes/organizations');

const app = express();
const PORT = process.env.PORT || 3004;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Security middleware
app.use(securityService.ipBlockingMiddleware());
// app.use(requestMonitoring);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/user', userRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/organizations', organizationRoutes);

// API documentation with Swagger
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'AI Platform API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      chat: '/api/chat',
      mcp: '/api/mcp',
      user: '/api/user',
      billing: '/api/billing'
    },
    documentation: '/api/docs'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    method: req.method,
    url: req.originalUrl
  });
});

// Error handling middleware (must be last)
// app.use(errorMonitoring);
const __eh = require('./middleware/errorHandler');
const __errorHandler = __eh.errorHandler || __eh;
app.use(__errorHandler);
// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  if (global.server) {
    global.server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Handle process termination
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`נ€ Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`נ“ API documentation available at http://localhost:${PORT}/api`);
      logger.info(`נ¥ Health check available at http://localhost:${PORT}/health`);
    });

    // Initialize WebSocket service (disabled for demo)
    // websocketService.initialize(server);

    // Export server for graceful shutdown
    global.server = server;

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

