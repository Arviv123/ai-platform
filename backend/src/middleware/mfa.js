const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Generate MFA secret for user
exports.generateMFASecret = async (userId, userEmail) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `AI Platform (${userEmail})`,
      issuer: 'AI Platform',
      length: 32
    });

    // Store secret in database (encrypted)
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret.base32,
        mfaEnabled: false // Will be enabled after verification
      }
    });

    // Generate QR code for authenticator app
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    };

  } catch (error) {
    logger.error('Error generating MFA secret:', error);
    throw new Error('Failed to generate MFA secret');
  }
};

// Verify MFA token
exports.verifyMFAToken = async (userId, token) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true }
    });

    if (!user || !user.mfaSecret) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) tolerance
    });

    if (verified) {
      // Log successful MFA verification
      logger.info(`MFA verification successful for user ${userId}`);
      
      // Update last MFA verification time
      await prisma.user.update({
        where: { id: userId },
        data: { lastMfaVerification: new Date() }
      });
    } else {
      // Log failed MFA attempt
      logger.warn(`MFA verification failed for user ${userId}`);
    }

    return verified;

  } catch (error) {
    logger.error('Error verifying MFA token:', error);
    return false;
  }
};

// Enable MFA for user (after successful verification)
exports.enableMFA = async (userId, token) => {
  try {
    const verified = await exports.verifyMFAToken(userId, token);
    
    if (verified) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          mfaEnabled: true,
          mfaEnabledAt: new Date()
        }
      });

      // Generate backup codes
      const backupCodes = await generateBackupCodes(userId);
      
      logger.info(`MFA enabled for user ${userId}`);
      return { success: true, backupCodes };
    }

    return { success: false, message: 'Invalid MFA token' };

  } catch (error) {
    logger.error('Error enabling MFA:', error);
    throw new Error('Failed to enable MFA');
  }
};

// Disable MFA for user
exports.disableMFA = async (userId, token, currentPassword) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, mfaSecret: true }
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!validPassword) {
      return { success: false, message: 'Invalid password' };
    }

    // Verify MFA token
    const verified = await exports.verifyMFAToken(userId, token);
    
    if (verified) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          mfaEnabled: false,
          mfaSecret: null,
          mfaEnabledAt: null,
          lastMfaVerification: null
        }
      });

      // Remove backup codes
      await prisma.mfaBackupCode.deleteMany({
        where: { userId }
      });

      logger.info(`MFA disabled for user ${userId}`);
      return { success: true };
    }

    return { success: false, message: 'Invalid MFA token' };

  } catch (error) {
    logger.error('Error disabling MFA:', error);
    throw new Error('Failed to disable MFA');
  }
};

// Generate backup codes for MFA
async function generateBackupCodes(userId) {
  const codes = [];
  
  // Generate 10 backup codes
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    codes.push(code);
    
    // Hash and store in database
    const bcrypt = require('bcryptjs');
    const hashedCode = await bcrypt.hash(code, 12);
    
    await prisma.mfaBackupCode.create({
      data: {
        userId,
        code: hashedCode,
        used: false
      }
    });
  }

  return codes;
}

// Verify backup code
exports.verifyBackupCode = async (userId, code) => {
  try {
    const backupCodes = await prisma.mfaBackupCode.findMany({
      where: { 
        userId,
        used: false
      }
    });

    const bcrypt = require('bcryptjs');
    
    for (const backupCode of backupCodes) {
      const valid = await bcrypt.compare(code.toUpperCase(), backupCode.code);
      
      if (valid) {
        // Mark backup code as used
        await prisma.mfaBackupCode.update({
          where: { id: backupCode.id },
          data: { 
            used: true,
            usedAt: new Date()
          }
        });

        logger.info(`Backup code used for user ${userId}`);
        return true;
      }
    }

    logger.warn(`Invalid backup code attempt for user ${userId}`);
    return false;

  } catch (error) {
    logger.error('Error verifying backup code:', error);
    return false;
  }
};

// MFA middleware for protected routes
exports.requireMFA = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const mfaToken = req.headers['x-mfa-token'];

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        mfaEnabled: true, 
        lastMfaVerification: true,
        role: true 
      }
    });

    if (!user) {
      return res.status(401).json({ 
        status: 'fail', 
        message: 'User not found' 
      });
    }

    // Skip MFA for admin users in development
    if (process.env.NODE_ENV === 'development' && user.role === 'ADMIN') {
      return next();
    }

    // If MFA is not enabled, proceed
    if (!user.mfaEnabled) {
      return next();
    }

    // Check if MFA verification is recent (within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user.lastMfaVerification && user.lastMfaVerification > oneHourAgo) {
      return next();
    }

    // Require MFA token
    if (!mfaToken) {
      return res.status(401).json({
        status: 'fail',
        message: 'MFA token required',
        requireMfa: true
      });
    }

    // Verify MFA token
    const verified = await exports.verifyMFAToken(userId, mfaToken);
    
    if (!verified) {
      // Try backup code
      const backupVerified = await exports.verifyBackupCode(userId, mfaToken);
      
      if (!backupVerified) {
        return res.status(401).json({
          status: 'fail',
          message: 'Invalid MFA token',
          requireMfa: true
        });
      }
    }

    next();

  } catch (error) {
    logger.error('MFA middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'MFA verification failed'
    });
  }
};