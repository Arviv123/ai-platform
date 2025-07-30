const jwt = require("jsonwebtoken");
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Enhanced token verification
async function verifyToken(token) {
  try {
    const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
    const payload = jwt.verify(token, secret);
    return payload;
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    return null;
  }
}

// Unified authentication middleware
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

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        mfaEnabled: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        status: "fail", 
        message: "User not found" 
      });
    }

    // Add user info to request
    req.user = {
      ...payload,
      ...user
    };
    
    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      status: "error",
      message: "Authentication failed"
    });
  }
}

// Optional authentication (for public endpoints)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            role: true,
            organizationId: true
          }
        });
        
        if (user) {
          req.user = { ...payload, ...user };
        }
      }
    }
    
    next();
  } catch (error) {
    logger.warn('Optional auth failed:', error);
    next(); // Continue without authentication
  }
}

module.exports = {
  authenticate,
  authenticateToken: authenticate, // Alias for backward compatibility
  optionalAuth,
  verifyToken
};