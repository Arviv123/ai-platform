const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Middleware to handle validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    logger.logSecurity('Validation failed', {
      errors: validationErrors,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    });

    return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
      errors: validationErrors
    }));
  }

  next();
};

// Custom validation functions
const validateUUID = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, one uppercase, one lowercase, one number, one special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const validatePhoneNumber = (phone) => {
  // Basic international phone number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

const validateCreditCard = (cardNumber) => {
  // Basic Luhn algorithm implementation
  const digits = cardNumber.replace(/\D/g, '');
  
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

// Sanitization functions
const sanitizeHtml = (text) => {
  if (typeof text !== 'string') return text;
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim();
  }
  return input;
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') return email;
  return email.toLowerCase().trim();
};

// File upload validation
const validateFileUpload = (allowedTypes = [], maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return next(new AppError(`File size too large. Maximum size is ${maxSize / 1024 / 1024}MB`, 400));
      }

      // Check file type
      if (allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some(type => {
          if (type.includes('*')) {
            const baseType = type.split('/')[0];
            return file.mimetype.startsWith(baseType);
          }
          return file.mimetype === type;
        });

        if (!isAllowed) {
          return next(new AppError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400));
        }
      }

      // Security checks
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.jar'];
      const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      
      if (dangerousExtensions.includes(fileExtension)) {
        logger.logSecurity('Dangerous file upload attempt', {
          filename: file.originalname,
          mimetype: file.mimetype,
          ip: req.ip,
          userId: req.user?.id
        });
        return next(new AppError('File type not allowed for security reasons', 400));
      }
    }

    next();
  };
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  // Check if rate limit headers are present (set by rate limiting middleware)
  const remaining = res.get('X-RateLimit-Remaining');
  const limit = res.get('X-RateLimit-Limit');

  if (remaining && limit) {
    const remainingCount = parseInt(remaining);
    const limitCount = parseInt(limit);
    
    if (remainingCount < limitCount * 0.1) { // Less than 10% remaining
      logger.logSecurity('Rate limit warning', {
        remaining: remainingCount,
        limit: limitCount,
        ip: req.ip,
        userId: req.user?.id
      });
    }
  }

  next();
};

// Business logic validation
const validateSubscriptionAccess = (requiredFeature) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { subscriptionTier } = req.user;
    
    const featureAccess = {
      'basic_chat': ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'],
      'advanced_chat': ['PRO', 'BUSINESS', 'ENTERPRISE'],
      'mcp_servers': ['PRO', 'BUSINESS', 'ENTERPRISE'],
      'multiple_mcp': ['BUSINESS', 'ENTERPRISE'],
      'unlimited_mcp': ['ENTERPRISE'],
      'api_access': ['BUSINESS', 'ENTERPRISE'],
      'priority_support': ['BUSINESS', 'ENTERPRISE'],
      'custom_branding': ['ENTERPRISE']
    };

    const allowedTiers = featureAccess[requiredFeature];
    
    if (!allowedTiers || !allowedTiers.includes(subscriptionTier)) {
      return next(new AppError(`Feature requires ${allowedTiers?.join(' or ')} subscription`, 403));
    }

    next();
  };
};

const validateCreditUsage = (estimatedCost) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (req.user.credits < estimatedCost) {
      return next(new AppError('Insufficient credits', 402, 'INSUFFICIENT_CREDITS', {
        required: estimatedCost,
        available: req.user.credits
      }));
    }

    // Store estimated cost for later use
    req.estimatedCost = estimatedCost;
    next();
  };
};

// JSON schema validation
const validateJsonSchema = (schema) => {
  const Joi = require('joi');
  
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return next(new AppError('Schema validation failed', 400, 'SCHEMA_VALIDATION_ERROR', {
        errors: validationErrors
      }));
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

module.exports = {
  validateRequest,
  validateUUID,
  validateEmail,
  validatePassword,
  validateUrl,
  validatePhoneNumber,
  validateCreditCard,
  sanitizeHtml,
  sanitizeInput,
  normalizeEmail,
  validateFileUpload,
  validateRateLimit,
  validateSubscriptionAccess,
  validateCreditUsage,
  validateJsonSchema
};