const logger = require('../utils/logger');

// Enhanced error handler with better categorization
class AppError extends Error {
  constructor(message, statusCode, type = 'general', details = null) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.type = type; // 'auth', 'validation', 'permission', 'network', 'database', 'general'
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'validation', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, 'auth', details);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details = null) {
    super(message, 403, 'permission', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'general', details);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, 'database', details);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400, 'validation');
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400, 'validation');
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400, 'validation', { errors });
};

const handleJWTError = () =>
  new AuthenticationError('Invalid token. Please log in again!');

const handleJWTExpiredError = () =>
  new AuthenticationError('Your token has expired! Please log in again.');

const handlePrismaError = (err) => {
  let message = 'Database operation failed';
  let statusCode = 500;
  let type = 'database';
  let details = null;

  switch (err.code) {
    case 'P2002':
      message = 'A record with this data already exists';
      statusCode = 409;
      type = 'validation';
      details = { constraint: err.meta?.target };
      break;
    case 'P2025':
      message = 'Record not found';
      statusCode = 404;
      type = 'general';
      break;
    case 'P2003':
      message = 'Foreign key constraint failed';
      statusCode = 400;
      type = 'validation';
      break;
    case 'P2014':
      message = 'Invalid relation data';
      statusCode = 400;
      type = 'validation';
      break;
    default:
      message = err.message || 'Database operation failed';
  }

  return new AppError(message, statusCode, type, details);
};

// Send error response for development
const sendErrorDev = (err, req, res) => {
  // API Error
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      type: err.type,
      message: err.message,
      details: err.details,
      stack: err.stack,
      timestamp: err.timestamp
    });
  }

  // Non-API error - return JSON anyway (no template engine)
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    status: err.status,
    type: err.type,
    message: err.message,
    stack: err.stack,
    timestamp: err.timestamp
  });
};

// Send error response for production
const sendErrorProd = (err, req, res) => {
  // API Error
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        type: err.type,
        message: err.message,
        details: process.env.SHOW_ERROR_DETAILS === 'true' ? err.details : undefined,
        timestamp: err.timestamp
      });
    }

    // Programming or other unknown error: don't leak error details
    logger.logError(err, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id
    });

    return res.status(500).json({
      status: 'error',
      type: 'general',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString()
    });
  }

  // Non-API error - return JSON anyway (no template engine)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      type: err.type,
      message: err.message,
      timestamp: err.timestamp
    });
  }

  // Programming or other unknown error: don't leak error details
  logger.logError(err);
  return res.status(500).json({
    status: 'error',
    type: 'general',
    message: 'Please try again later.',
    timestamp: new Date().toISOString()
  });
};

// Main error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  console.log('🚨 GLOBAL ERROR HANDLER HIT!');
  console.log('🚨 Error details:', {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    status: err.status,
    type: err.type,
    url: req.originalUrl,
    method: req.method
  });
  
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  err.type = err.type || 'general';

  if (process.env.NODE_ENV === 'development') {
    logger.logError(err, {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id
    });
    
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'PrismaClientKnownRequestError') error = handlePrismaError(error);

    sendErrorProd(error, req, res);
  }
};

// Async error catcher wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// 404 handler
const notFound = (req, res, next) => {
  const err = new NotFoundError(`Can't find ${req.originalUrl} on this server!`);
  next(err);
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  globalErrorHandler,
  catchAsync,
  notFound
};