const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Generate JWT access token
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'ai-platform',
      audience: 'ai-platform-users'
    }
  );
};

// Generate JWT refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'ai-platform',
      audience: 'ai-platform-users'
    }
  );
};

// Verify JWT token
const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret, {
      issuer: 'ai-platform',
      audience: 'ai-platform-users'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401);
    }
    throw new AppError('Token verification failed', 401);
  }
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Access token required', 401));
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return next(new AppError('Access token required', 401));
    }

    // Verify token
    const decoded = verifyToken(token, process.env.JWT_SECRET);

    if (decoded.type !== 'access') {
      return next(new AppError('Invalid token type', 401));
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        credits: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      logger.logSecurity('Authentication failed - User not found', {
        userId: decoded.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new AppError('User not found', 401));
    }

    if (!user.emailVerified) {
      return next(new AppError('Email verification required', 403));
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    // Update last login time (async, don't wait)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch((error) => {
      logger.error('Failed to update last login time:', error);
    });

    next();
  } catch (error) {
    logger.logSecurity('Authentication failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next(error);
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token, process.env.JWT_SECRET);

    if (decoded.type !== 'access') {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        credits: true,
        subscriptionTier: true,
        emailVerified: true
      }
    });

    if (user && user.emailVerified) {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    // Ignore authentication errors in optional auth
    next();
  }
};

// Authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurity('Authorization failed', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Subscription tier authorization
const requireSubscription = (...tiers) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!tiers.includes(req.user.subscriptionTier)) {
      return next(new AppError('Subscription upgrade required', 403));
    }

    next();
  };
};

// Credits check middleware
const requireCredits = (minCredits = 1) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (req.user.credits < minCredits) {
      return next(new AppError('Insufficient credits', 402));
    }

    next();
  };
};

// Rate limiting per user
const userRateLimit = (maxRequests, windowMs) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (requests.has(userId)) {
      const userRequests = requests.get(userId);
      const validRequests = userRequests.filter(time => time > windowStart);
      requests.set(userId, validRequests);
    }

    // Check rate limit
    const userRequests = requests.get(userId) || [];
    
    if (userRequests.length >= maxRequests) {
      logger.logSecurity('User rate limit exceeded', {
        userId,
        requests: userRequests.length,
        maxRequests,
        windowMs,
        ip: req.ip
      });
      return next(new AppError('Rate limit exceeded', 429));
    }

    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);

    next();
  };
};

// API key authentication (for external integrations)
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return next(new AppError('API key required', 401));
    }

    // Hash the API key to compare with stored hash
    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true
      }
    });

    if (!apiKeyRecord) {
      logger.logSecurity('Invalid API key', {
        keyHash: keyHash.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new AppError('Invalid API key', 401));
    }

    // Update last used time
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() }
    }).catch((error) => {
      logger.error('Failed to update API key last used time:', error);
    });

    req.apiKey = apiKeyRecord;
    next();
  } catch (error) {
    next(error);
  }
};

// Check if user owns resource
const checkResourceOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return next(new AppError('Resource ID required', 400));
      }

      const resource = await prisma[resourceModel].findFirst({
        where: {
          id: resourceId,
          userId: req.user.id,
          deletedAt: null
        }
      });

      if (!resource) {
        return next(new AppError('Resource not found or access denied', 404));
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authenticate,
  optionalAuth,
  authorize,
  requireSubscription,
  requireCredits,
  userRateLimit,
  authenticateApiKey,
  checkResourceOwnership
};