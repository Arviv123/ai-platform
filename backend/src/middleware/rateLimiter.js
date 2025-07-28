const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const logger = require('../utils/logger');

// In-memory rate limiter for development
const memoryLimiter = new RateLimiterMemory({
  points: 5, // Number of attempts
  duration: 15 * 60, // Per 15 minutes
  blockDuration: 60 * 60, // Block for 1 hour
});

// Redis rate limiter for production (if Redis is available)
let redisLimiter = null;

// Try to initialize Redis limiter
try {
  const redis = require('redis');
  const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: 5,
    duration: 15 * 60,
    blockDuration: 60 * 60,
  });
} catch (error) {
  logger.warn('Redis not available, using memory-based rate limiting');
}

// Get the appropriate limiter
const getLimiter = () => {
  return redisLimiter || memoryLimiter;
};

// Rate limiting middleware for login attempts
exports.loginAttemptLimiter = async (req, res, next) => {
  try {
    const limiter = getLimiter();
    const key = `login_${req.ip}_${req.body.email || 'unknown'}`;
    
    await limiter.consume(key);
    next();
    
  } catch (rejRes) {
    const msBeforeNext = rejRes.msBeforeNext || 1000;
    const remainingAttempts = rejRes.remainingHits || 0;
    
    logger.warn(`Rate limit exceeded for login attempt from ${req.ip}`, {
      email: req.body.email,
      remainingAttempts,
      msBeforeNext
    });
    
    res.status(429).json({
      status: 'fail',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000),
      remainingAttempts
    });
  }
};

// Rate limiting for API requests
exports.apiRequestLimiter = async (req, res, next) => {
  try {
    const limiter = new RateLimiterMemory({
      points: 100, // More generous for API requests
      duration: 60, // Per minute
      blockDuration: 60, // Block for 1 minute
    });
    
    const key = `api_${req.ip}_${req.user?.sub || 'anonymous'}`;
    
    await limiter.consume(key);
    next();
    
  } catch (rejRes) {
    const msBeforeNext = rejRes.msBeforeNext || 1000;
    
    logger.warn(`API rate limit exceeded from ${req.ip}`, {
      userId: req.user?.sub,
      msBeforeNext
    });
    
    res.status(429).json({
      status: 'fail',
      message: 'API rate limit exceeded. Please slow down your requests.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
};

// Rate limiting for password reset attempts
exports.passwordResetLimiter = async (req, res, next) => {
  try {
    const limiter = new RateLimiterMemory({
      points: 3, // 3 attempts
      duration: 60 * 60, // Per hour
      blockDuration: 60 * 60, // Block for 1 hour
    });
    
    const key = `password_reset_${req.ip}_${req.body.email || 'unknown'}`;
    
    await limiter.consume(key);
    next();
    
  } catch (rejRes) {
    const msBeforeNext = rejRes.msBeforeNext || 1000;
    
    logger.warn(`Password reset rate limit exceeded from ${req.ip}`, {
      email: req.body.email,
      msBeforeNext
    });
    
    res.status(429).json({
      status: 'fail',
      message: 'Too many password reset attempts. Please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
};

// MFA attempt rate limiting
exports.mfaAttemptLimiter = async (req, res, next) => {
  try {
    const limiter = new RateLimiterMemory({
      points: 10, // 10 attempts
      duration: 15 * 60, // Per 15 minutes
      blockDuration: 60 * 60, // Block for 1 hour
    });
    
    const key = `mfa_${req.ip}_${req.user?.sub || 'unknown'}`;
    
    await limiter.consume(key);
    next();
    
  } catch (rejRes) {
    const msBeforeNext = rejRes.msBeforeNext || 1000;
    
    logger.warn(`MFA rate limit exceeded from ${req.ip}`, {
      userId: req.user?.sub,
      msBeforeNext
    });
    
    res.status(429).json({
      status: 'fail',
      message: 'Too many MFA attempts. Please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
};

// General security rate limiter
exports.securityLimiter = (points = 20, duration = 60) => {
  return async (req, res, next) => {
    try {
      const limiter = new RateLimiterMemory({
        points,
        duration,
        blockDuration: duration * 2,
      });
      
      const key = `security_${req.ip}_${req.user?.sub || 'anonymous'}`;
      
      await limiter.consume(key);
      next();
      
    } catch (rejRes) {
      const msBeforeNext = rejRes.msBeforeNext || 1000;
      
      logger.warn(`Security rate limit exceeded from ${req.ip}`, {
        userId: req.user?.sub,
        endpoint: req.path,
        msBeforeNext
      });
      
      res.status(429).json({
        status: 'fail',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(msBeforeNext / 1000)
      });
    }
  };
};