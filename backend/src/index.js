require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { globalErrorHandler, notFound } = require('./middleware/globalErrorHandler');
const { connectDB } = require('./config/database');
const websocketService = require('./services/websocketService');
const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');
const securityService = require('./services/securityService');

// Import routes with safe loading
function safeRequire(path) {
  try {
    return require(path);
  } catch (error) {
    logger.warn(`Failed to load route ${path}:`, error.message);
    return null;
  }
}

const authRoutes = safeRequire('./routes/auth');
const chatRoutes = safeRequire('./routes/chat');
const mcpRoutes = safeRequire('./routes/mcp');
const userRoutes = safeRequire('./routes/user');
const billingRoutes = safeRequire('./routes/billing');
const monitoringRoutes = safeRequire('./routes/monitoring');
const securityRoutes = safeRequire('./routes/security');
const gatewayRoutes = safeRequire('./routes/gateway');
const organizationRoutes = safeRequire('./routes/organizations');
const aiRoutes = safeRequire('./routes/ai');
const a2aRoutes = safeRequire('./routes/a2a');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

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
const allowedOrigins = [
  'https://super-genie-7460e3.netlify.app',
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-MFA-Token'],
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

// Response time tracking
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Logging middleware with response time
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Custom response time logger
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    const responseTime = Date.now() - req.startTime;
    logger.logPerformance(`${req.method} ${req.originalUrl}`, responseTime, {
      statusCode: res.statusCode,
      userId: req.user?.id,
      ip: req.ip
    });
    
    originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // בדיקת חיבור למסד נתונים
    let dbStatus = 'unknown';
    try {
      const { checkDBHealth } = require('./config/database');
      const dbHealth = await checkDBHealth();
      dbStatus = dbHealth.status;
    } catch (error) {
      dbStatus = 'error';
    }

    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      database: dbStatus,
      cors: {
        allowedOrigins: allowedOrigins.length,
        origins: allowedOrigins
      }
    };

    // הוספת CORS headers במפורש
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// CORS preflight endpoint
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-MFA-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Safe route mounting
function safeUse(path, route) {
  if (!route || typeof route !== "function") {
    console.warn(`Skipping route ${path} because route is ${route}`);
    return;
  }
  app.use(path, route);
}

// API routes
safeUse('/api/auth', authRoutes);
safeUse('/api/chat', chatRoutes);
safeUse('/api/mcp', mcpRoutes);
safeUse('/api/user', userRoutes);
safeUse('/api/billing', billingRoutes);
safeUse('/api/monitoring', monitoringRoutes);
safeUse('/api/security', securityRoutes);
safeUse('/api/gateway', gatewayRoutes);
safeUse('/api/organizations', organizationRoutes);
safeUse('/api/ai', aiRoutes);
safeUse('/api/a2a', a2aRoutes);

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
app.use('*', notFound);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

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

    // Initialize AI Service
    try {
      const AIService = require('./services/ai/AIService');
      const aiService = new AIService();
      await aiService.initialize();
      logger.info('AI Service initialized successfully');
    } catch (error) {
      logger.warn('AI Service initialization failed, some features may not work:', error.message);
    }

    // Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`📚 API documentation available at http://localhost:${PORT}/api`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🌐 Server listening on all interfaces (0.0.0.0:${PORT})`);
    });

    // Initialize WebSocket service
    try {
      websocketService.initialize(server);
    } catch (error) {
      logger.warn('WebSocket service initialization failed:', error.message);
    }

    // Export server for graceful shutdown
    global.server = server;

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;