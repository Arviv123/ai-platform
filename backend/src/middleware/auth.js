const jwt = require("jsonwebtoken");
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const prisma = new PrismaClient();

// Enhanced token verification with blacklist check
async function verifyToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key");
    
    // Check if token is in blacklist (for logout/compromised tokens)
    const blacklistedToken = await prisma.refreshToken.findFirst({
      where: { 
        token: token,
        revokedAt: { not: null }
      }
    });
    
    if (blacklistedToken) {
      return null;
    }
    
    return payload;
  } catch (e) {
    logger.warn('Token verification failed:', e.message);
    return null;
  }
}

// Main authentication middleware
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ 
        status: "fail", 
        message: "Access token required" 
      });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return res.status(401).json({ 
        status: "fail", 
        message: "Invalid or expired token" 
      });
    }

    // Get user details with security info
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        mfaEnabled: true,
        organizationId: true,
        lockedUntil: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        status: "fail", 
        message: "User not found" 
      });
    }

    // Check if user account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({
        status: "fail",
        message: "Account temporarily locked due to security concerns"
      });
    }

    // User is active by default (no status field in schema)

    // Log security event for high-privilege operations
    if (req.method !== 'GET' && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      await logSecurityEvent(req, user);
    }

    req.user = payload;
    req.userDetails = user;
    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      status: "error",
      message: "Authentication failed"
    });
  }
}

// API Key authentication for external integrations
async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        status: "fail",
        message: "API key required"
      });
    }

    // Find and verify API key
    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          select: { id: true, email: true, role: true, organizationId: true }
        },
        organization: {
          select: { id: true, name: true }
        }
      }
    });

    if (!keyRecord) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid API key"
      });
    }

    // Verify the API key hash
    const { verifyApiKey } = require('../utils/encryption');
    const isValid = await verifyApiKey(apiKey, keyRecord.keyHash);
    
    if (!isValid) {
      return res.status(401).json({
        status: "fail",
        message: "Invalid API key"
      });
    }

    // Update usage statistics
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: req.ip,
        usageCount: { increment: 1 }
      }
    });

    req.user = {
      sub: keyRecord.userId,
      email: keyRecord.user?.email,
      role: keyRecord.user?.role,
      organizationId: keyRecord.organizationId || keyRecord.user?.organizationId
    };
    req.apiKey = keyRecord;
    
    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      status: "error",
      message: "API authentication failed"
    });
  }
}

// Optional authentication (for public endpoints that benefit from user context)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }
    
    next();
  } catch (error) {
    logger.warn('Optional auth failed:', error);
    next(); // Continue without authentication
  }
}

// Log security events
async function logSecurityEvent(req, user) {
  try {
    const userAgent = req.headers['user-agent'];
    const parser = new UAParser(userAgent);
    const geo = geoip.lookup(req.ip);
    
    await prisma.securityAuditLog.create({
      data: {
        userId: user.id,
        action: `${req.method} ${req.path}`,
        result: 'success',
        ipAddress: req.ip,
        userAgent: userAgent,
        location: geo ? `${geo.city}, ${geo.country}` : null,
        details: JSON.stringify({
          browser: parser.getBrowser(),
          os: parser.getOS(),
          device: parser.getDevice()
        })
      }
    });
  } catch (error) {
    logger.error('Failed to log security event:', error);
  }
}

module.exports = {
  authenticate,
  authenticateToken: authenticate,
  authenticateApiKey,
  optionalAuth,
  verifyToken
};
