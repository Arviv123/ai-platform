const monitoringService = require('../services/monitoringService');
const logger = require('../utils/logger');

// Request monitoring middleware
const requestMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Record request metrics
    try {
      monitoringService.recordRequest(req, res, responseTime);
      
      // Log slow requests
      if (responseTime > 5000) {
        logger.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`, {
          method: req.method,
          path: req.path,
          responseTime: responseTime,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }
      
    } catch (error) {
      logger.error('Error recording request metrics:', error);
    }
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
};

// Error monitoring middleware
const errorMonitoring = (error, req, res, next) => {
  try {
    // Record error metrics
    monitoringService.recordError(error, {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      user: req.user?.sub || 'anonymous'
    });
    
  } catch (err) {
    logger.error('Error recording error metrics:', err);
  }
  
  next(error);
};

// User activity monitoring
const userActivityMonitoring = (action) => {
  return (req, res, next) => {
    try {
      const userId = req.user?.sub;
      if (userId) {
        monitoringService.recordUserActivity(userId, action);
      }
    } catch (error) {
      logger.error('Error recording user activity:', error);
    }
    
    next();
  };
};

module.exports = {
  requestMonitoring,
  errorMonitoring,
  userActivityMonitoring
};