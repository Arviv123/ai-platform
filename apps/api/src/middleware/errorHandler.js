const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

const handlePrismaError = (err) => {
  switch (err.code) {
    case 'P2002':
      return new AppError(`Duplicate field value. Please use another value!`, 400);
    case 'P2014':
      return new AppError(`Invalid ID provided.`, 400);
    case 'P2003':
      return new AppError(`Invalid input data. Foreign key constraint failed.`, 400);
    case 'P2025':
      return new AppError(`Record not found.`, 404);
    default:
      return new AppError(`Database error occurred.`, 500);
  }
};

const handleStripeError = (err) => {
  switch (err.type) {
    case 'StripeCardError':
      return new AppError(`Payment failed: ${err.message}`, 400);
    case 'StripeRateLimitError':
      return new AppError('Too many requests made to Stripe API', 429);
    case 'StripeInvalidRequestError':
      return new AppError(`Invalid payment request: ${err.message}`, 400);
    case 'StripeAPIError':
      return new AppError('Payment service temporarily unavailable', 503);
    case 'StripeConnectionError':
      return new AppError('Network error with payment service', 503);
    case 'StripeAuthenticationError':
      return new AppError('Payment authentication failed', 500);
    default:
      return new AppError('Payment processing error', 500);
  }
};

// Send error response for development
const sendErrorDev = (err, req, res) => {
  // Log error for debugging
  logger.logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  });
};

// Send error response for production
const sendErrorProd = (err, req, res) => {
  // Log error
  logger.logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      timestamp: new Date().toISOString(),
      ...(err.code && { code: err.code }),
    });
  } else {
    // Programming or other unknown error: don't leak error details
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString(),
    });
  }
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
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
    if (error.type && error.type.startsWith('Stripe')) error = handleStripeError(error);

    sendErrorProd(error, req, res);
  }
};

// Async error handler wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// 404 handler
const notFound = (req, res, next) => {
  const err = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(err);
};

// Rate limit error handler
const handleRateLimit = (req, res) => {
  logger.logSecurity('Rate limit exceeded', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
  });

  res.status(429).json({
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  AppError,
  errorHandler,
  catchAsync,
  notFound,
  handleRateLimit,
};