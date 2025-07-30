const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class SecurityService {
  constructor() {
    this.suspiciousActivities = new Map();
    this.blockedIPs = new Set();
    this.failedAttempts = new Map();
    
    // Security thresholds
    this.thresholds = {
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      suspiciousRequestThreshold: 100,
      bruteForceWindow: 15 * 60 * 1000, // 15 minutes
      maxRequestsPerMinute: 60
    };

    this.startCleanupTasks();
  }

  // Enhanced rate limiting with dynamic thresholds
  createDynamicRateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100,
      message = 'Too many requests, please try again later',
      skipSuccessfulRequests = true,
      skipFailedRequests = false
    } = options;

    return rateLimit({
      windowMs,
      max: (req) => {
        // Different limits for different user types
        if (req.user?.subscription === 'enterprise') return max * 5;
        if (req.user?.subscription === 'premium') return max * 3;
        if (req.user?.subscription === 'basic') return max * 2;
        return max;
      },
      message: {
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      skipFailedRequests,
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.sub || req.ip;
      },
      onLimitReached: (req, res, options) => {
        this.logSecurityEvent('rate_limit_exceeded', {
          ip: req.ip,
          user: req.user?.sub,
          endpoint: req.path,
          userAgent: req.get('User-Agent')
        });
      }
    });
  }

  // Slow down requests for suspicious behavior
  createSlowDown(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      delayAfter = 2,
      delayMs = 500
    } = options;

    return slowDown({
      windowMs,
      delayAfter,
      delayMs: (hits) => hits * delayMs,
      maxDelayMs: 5000,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => req.user?.sub || req.ip
    });
  }

  // IP blocking middleware
  ipBlockingMiddleware() {
    return (req, res, next) => {
      const ip = req.ip;
      
      if (this.blockedIPs.has(ip)) {
        this.logSecurityEvent('blocked_ip_access', { ip, endpoint: req.path });
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP has been temporarily blocked due to suspicious activity'
        });
      }
      
      next();
    };
  }

  // Advanced authentication middleware
  advancedAuth() {
    return async (req, res, next) => {
      try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        // Check if token is blacklisted
        const isBlacklisted = await cacheService.exists(`blacklist:${token}`);
        if (isBlacklisted) {
          this.logSecurityEvent('blacklisted_token_used', {
            ip: req.ip,
            token: token.substring(0, 10) + '...'
          });
          return res.status(401).json({ error: 'Token has been revoked' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check token age and force refresh if too old
        const tokenAge = Date.now() - (decoded.iat * 1000);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (tokenAge > maxAge) {
          return res.status(401).json({ 
            error: 'Token expired',
            refreshRequired: true 
          });
        }

        // Check for concurrent sessions
        const sessionKey = `session:${decoded.sub}:${decoded.jti || 'default'}`;
        const sessionExists = await cacheService.exists(sessionKey);
        
        if (!sessionExists) {
          return res.status(401).json({ 
            error: 'Session not found or expired',
            loginRequired: true 
          });
        }

        req.user = decoded;
        req.token = token;
        
        // Update last activity
        await cacheService.set(sessionKey, Date.now(), { ttl: 24 * 60 * 60 });
        
        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: 'Token expired',
            refreshRequired: true 
          });
        }
        
        this.logSecurityEvent('invalid_token', {
          ip: req.ip,
          error: error.message
        });
        
        res.status(401).json({ error: 'Invalid token' });
      }
    };
  }

  // Brute force protection
  async checkBruteForce(identifier, action = 'login') {
    const key = `bruteforce:${action}:${identifier}`;
    const attempts = await cacheService.get(key) || 0;
    
    if (attempts >= this.thresholds.maxFailedAttempts) {
      throw new Error('Too many failed attempts. Please try again later.');
    }
    
    return attempts;
  }

  // Record failed attempt
  async recordFailedAttempt(identifier, action = 'login') {
    const key = `bruteforce:${action}:${identifier}`;
    const attempts = await cacheService.incr(key, 1, this.thresholds.bruteForceWindow / 1000);
    
    if (attempts >= this.thresholds.maxFailedAttempts) {
      // Block IP if it's an IP-based identifier
      if (this.isIP(identifier)) {
        this.blockIP(identifier, this.thresholds.lockoutDuration);
      }
      
      this.logSecurityEvent('brute_force_detected', {
        identifier,
        action,
        attempts
      });
    }
    
    return attempts;
  }

  // Clear failed attempts on successful login
  async clearFailedAttempts(identifier, action = 'login') {
    const key = `bruteforce:${action}:${identifier}`;
    await cacheService.del(key);
  }

  // Block IP address
  blockIP(ip, duration = this.thresholds.lockoutDuration) {
    this.blockedIPs.add(ip);
    
    // Automatically unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info(`IP ${ip} automatically unblocked`);
    }, duration);
    
    this.logSecurityEvent('ip_blocked', { ip, duration });
  }

  // Unblock IP address
  unblockIP(ip) {
    const wasBlocked = this.blockedIPs.delete(ip);
    if (wasBlocked) {
      this.logSecurityEvent('ip_unblocked', { ip });
    }
    return wasBlocked;
  }

  // Detect suspicious patterns
  async detectSuspiciousActivity(req) {
    const patterns = [];
    
    // Check for SQL injection patterns
    const sqlPatterns = /(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b)/i;
    if (sqlPatterns.test(JSON.stringify(req.body)) || sqlPatterns.test(req.url)) {
      patterns.push('sql_injection_attempt');
    }
    
    // Check for XSS patterns
    const xssPatterns = /<script|javascript:|onload=|onerror=/i;
    if (xssPatterns.test(JSON.stringify(req.body)) || xssPatterns.test(req.url)) {
      patterns.push('xss_attempt');
    }
    
    // Check for path traversal
    const pathTraversalPatterns = /\.\.\//;
    if (pathTraversalPatterns.test(req.url)) {
      patterns.push('path_traversal_attempt');
    }
    
    // Check for suspicious user agents
    const suspiciousAgents = /bot|crawler|scanner|curl|wget/i;
    if (suspiciousAgents.test(req.get('User-Agent'))) {
      patterns.push('suspicious_user_agent');
    }
    
    // Check for unusual request frequency
    const requestKey = `requests:${req.ip}`;
    const requestCount = await cacheService.incr(requestKey, 1, 60);
    if (requestCount > this.thresholds.maxRequestsPerMinute) {
      patterns.push('high_request_frequency');
    }
    
    if (patterns.length > 0) {
      this.logSecurityEvent('suspicious_activity_detected', {
        ip: req.ip,
        patterns,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        user: req.user?.sub
      });
      
      // Temporary rate limiting for suspicious IPs
      if (patterns.length >= 2) {
        this.blockIP(req.ip, 5 * 60 * 1000); // 5 minutes
      }
    }
    
    return patterns;
  }

  // Password strength validation
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasNoSpaces = !/\s/.test(password);
    
    const score = [
      password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      hasNoSpaces
    ].filter(Boolean).length;
    
    const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong';
    
    return {
      score,
      strength,
      feedback: {
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar,
        hasNoSpaces
      }
    };
  }

  // Secure password hashing
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Generate secure tokens
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Encrypt sensitive data
  encryptData(data, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new Error('Encryption key not provided');
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setEncoding('hex');
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  // Decrypt sensitive data
  decryptData(encryptedData, key = process.env.ENCRYPTION_KEY) {
    if (!key) {
      throw new Error('Encryption key not provided');
    }
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    decipher.setEncoding('utf8');
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Token blacklisting
  async blacklistToken(token, expiry = null) {
    const key = `blacklist:${token}`;
    const ttl = expiry ? Math.ceil((expiry - Date.now()) / 1000) : 24 * 60 * 60;
    
    await cacheService.set(key, true, { ttl });
    
    this.logSecurityEvent('token_blacklisted', {
      token: token.substring(0, 10) + '...',
      expiry
    });
  }

  // Check if request is from a valid origin
  validateOrigin(req) {
    const origin = req.get('Origin') || req.get('Referer');
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    
    if (!origin) return false;
    
    return allowedOrigins.some(allowed => 
      origin.startsWith(allowed.trim())
    );
  }

  // CSRF protection
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  validateCSRFToken(token, sessionToken) {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  }

  // Log security events
  logSecurityEvent(type, details) {
    logger.warn(`SECURITY EVENT [${type}]:`, {
      type,
      timestamp: new Date(),
      ...details
    });
    
    // Store in cache for monitoring
    const eventKey = `security:events:${type}`;
    cacheService.incr(eventKey, 1, 24 * 60 * 60); // 24 hours
  }

  // Get security statistics
  async getSecurityStats() {
    const stats = {
      blockedIPs: this.blockedIPs.size,
      suspiciousActivities: this.suspiciousActivities.size,
      failedAttempts: this.failedAttempts.size,
      events: {}
    };
    
    // Get event counts from cache
    const eventTypes = [
      'rate_limit_exceeded',
      'blocked_ip_access',
      'brute_force_detected',
      'suspicious_activity_detected',
      'invalid_token',
      'token_blacklisted'
    ];
    
    for (const type of eventTypes) {
      const count = await cacheService.get(`security:events:${type}`) || 0;
      stats.events[type] = count;
    }
    
    return stats;
  }

  // Utility functions
  isIP(str) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(str) || ipv6Regex.test(str);
  }

  // Cleanup tasks
  startCleanupTasks() {
    // Clean up old failed attempts every hour
    setInterval(() => {
      this.cleanupExpiredAttempts();
    }, 60 * 60 * 1000);
  }

  cleanupExpiredAttempts() {
    const now = Date.now();
    for (const [key, timestamp] of this.failedAttempts.entries()) {
      if (now - timestamp > this.thresholds.bruteForceWindow) {
        this.failedAttempts.delete(key);
      }
    }
  }
}

// Create singleton instance
const securityService = new SecurityService();

module.exports = securityService;