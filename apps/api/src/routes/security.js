const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireMFA, generateMFASecret, enableMFA, disableMFA, verifyMFAToken } = require('../middleware/mfa');
const { requirePermission } = require('../middleware/rbac');
const { mfaAttemptLimiter, securityLimiter } = require('../middleware/rateLimiter');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const zxcvbn = require('zxcvbn');

const router = express.Router();
const prisma = new PrismaClient();

// Generate MFA setup
router.post('/mfa/setup', authenticate, securityLimiter(5, 60), async (req, res) => {
  try {
    const userId = req.user.sub;
    const userEmail = req.userDetails.email;
    
    const mfaData = await generateMFASecret(userId, userEmail);
    
    res.json({
      status: 'success',
      data: {
        qrCode: mfaData.qrCode,
        manualEntryKey: mfaData.manualEntryKey,
        instructions: 'Scan the QR code with your authenticator app or enter the manual key'
      }
    });
    
  } catch (error) {
    logger.error('MFA setup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate MFA setup'
    });
  }
});

// Enable MFA
router.post('/mfa/enable', authenticate, mfaAttemptLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.sub;
    
    if (!token) {
      return res.status(400).json({
        status: 'fail',
        message: 'MFA token required'
      });
    }
    
    const result = await enableMFA(userId, token);
    
    if (result.success) {
      res.json({
        status: 'success',
        message: 'MFA enabled successfully',
        data: {
          backupCodes: result.backupCodes
        }
      });
    } else {
      res.status(400).json({
        status: 'fail',
        message: result.message
      });
    }
    
  } catch (error) {
    logger.error('MFA enable error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to enable MFA'
    });
  }
});

// Disable MFA
router.post('/mfa/disable', authenticate, mfaAttemptLimiter, async (req, res) => {
  try {
    const { token, currentPassword } = req.body;
    const userId = req.user.sub;
    
    if (!token || !currentPassword) {
      return res.status(400).json({
        status: 'fail',
        message: 'MFA token and current password required'
      });
    }
    
    const result = await disableMFA(userId, token, currentPassword);
    
    if (result.success) {
      res.json({
        status: 'success',
        message: 'MFA disabled successfully'
      });
    } else {
      res.status(400).json({
        status: 'fail',
        message: result.message
      });
    }
    
  } catch (error) {
    logger.error('MFA disable error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to disable MFA'
    });
  }
});

// Change password with security checks
router.post('/password/change', authenticate, securityLimiter(3, 300), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.sub;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'fail',
        message: 'Current password and new password required'
      });
    }
    
    // Check password strength
    const passwordStrength = zxcvbn(newPassword);
    if (passwordStrength.score < 3) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password is too weak',
        suggestions: passwordStrength.feedback.suggestions
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });
    
    // Verify current password
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!validPassword) {
      return res.status(400).json({
        status: 'fail',
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date()
      }
    });
    
    res.json({
      status: 'success',
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to change password'
    });
  }
});

// Generate new API key
router.post('/api-keys', authenticate, requirePermission('api:write'), async (req, res) => {
  try {
    const { name, permissions = [], expiresAt } = req.body;
    const userId = req.user.sub;
    
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'API key name required'
      });
    }
    
    const { generateApiKey, hashApiKey } = require('../utils/encryption');
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    
    const createdKey = await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        permissions: JSON.stringify(permissions),
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });
    
    res.json({
      status: 'success',
      data: {
        id: createdKey.id,
        name: createdKey.name,
        key: apiKey,
        permissions,
        expiresAt: createdKey.expiresAt
      }
    });
    
  } catch (error) {
    logger.error('API key creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create API key'
    });
  }
});

module.exports = router;