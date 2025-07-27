const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

// Register new user
const register = async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Generate email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');

  // Create user with transaction
  const { user, refreshTokenRecord } = await withTransaction(async (tx) => {
    // Create user
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        credits: 1000, // Welcome credits
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        credits: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true
      }
    });

    // Generate refresh token
    const refreshToken = generateRefreshToken(newUser.id);
    const refreshTokenRecord = await tx.refreshToken.create({
      data: {
        userId: newUser.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Log registration
    await tx.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: newUser.id,
        newData: { email, firstName, lastName },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return { user: newUser, refreshTokenRecord };
  });

  // Send verification email (async, don't wait)
  emailService.sendVerificationEmail(user.email, user.firstName, emailVerificationToken)
    .catch((error) => {
      logger.error('Failed to send verification email:', error);
    });

  // Generate access token
  const accessToken = generateAccessToken(user.id);

  logger.info('User registered successfully', {
    userId: user.id,
    email: user.email,
    ip: req.ip
  });

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully. Please check your email for verification.',
    data: {
      user,
      tokens: {
        accessToken,
        refreshToken: refreshTokenRecord.token,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m'
      }
    }
  });
};

// Login user
const login = async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstName: true,
      lastName: true,
      role: true,
      credits: true,
      subscriptionTier: true,
      emailVerified: true,
      isActive: true,
      deletedAt: true,
      createdAt: true
    }
  });

  if (!user || user.deletedAt || !user.isActive) {
    logger.logSecurity('Login attempt with invalid email', {
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Invalid email or password', 401);
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isPasswordValid) {
    logger.logSecurity('Login attempt with invalid password', {
      userId: user.id,
      email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens and update user
  const { refreshTokenRecord } = await withTransaction(async (tx) => {
    // Clean up old refresh tokens
    await tx.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } }
        ]
      }
    });

    // Generate new refresh token
    const refreshToken = generateRefreshToken(user.id);
    const refreshTokenRecord = await tx.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Update last login
    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Log login
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return { refreshTokenRecord };
  });

  // Generate access token
  const accessToken = generateAccessToken(user.id);

  // Remove sensitive data
  const { passwordHash, ...userWithoutPassword } = user;

  logger.info('User logged in successfully', {
    userId: user.id,
    email: user.email,
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'Login successful',
    data: {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        refreshToken: refreshTokenRecord.token,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m'
      }
    }
  });
};

// Refresh access token
const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 401);
  }

  // Verify refresh token
  const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid token type', 401);
  }

  // Check if refresh token exists and is valid
  const refreshTokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      userId: decoded.userId,
      expiresAt: { gt: new Date() },
      revokedAt: null
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          credits: true,
          subscriptionTier: true,
          emailVerified: true,
          isActive: true,
          deletedAt: true
        }
      }
    }
  });

  if (!refreshTokenRecord || !refreshTokenRecord.user.isActive || refreshTokenRecord.user.deletedAt) {
    logger.logSecurity('Invalid refresh token used', {
      userId: decoded.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Invalid refresh token', 401);
  }

  // Generate new access token
  const accessToken = generateAccessToken(refreshTokenRecord.user.id);

  res.json({
    status: 'success',
    data: {
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    }
  });
};

// Logout user
const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Revoke the specific refresh token
    await prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        userId: req.user.id
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  // Log logout
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  logger.info('User logged out', {
    userId: req.user.id,
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
};

// Logout from all devices
const logoutAll = async (req, res) => {
  // Revoke all refresh tokens for user
  await prisma.refreshToken.updateMany({
    where: {
      userId: req.user.id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  // Log logout all
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'USER_LOGOUT_ALL',
      entity: 'User',
      entityId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  logger.info('User logged out from all devices', {
    userId: req.user.id,
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'Logged out from all devices successfully'
  });
};

// Get current user
const getMe = async (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user
    }
  });
};

// Update user profile
const updateProfile = async (req, res) => {
  const { firstName, lastName, email } = req.body;
  
  const updateData = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  
  // If email is being changed, require verification
  if (email && email !== req.user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('Email already in use', 409);
    }

    updateData.email = email;
    updateData.emailVerified = false;
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      credits: true,
      subscriptionTier: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Log profile update
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'PROFILE_UPDATED',
      entity: 'User',
      entityId: req.user.id,
      oldData: { 
        firstName: req.user.firstName, 
        lastName: req.user.lastName,
        email: req.user.email 
      },
      newData: updateData,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: updatedUser
    }
  });
};

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true }
  });

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  
  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password and revoke all refresh tokens
  await withTransaction(async (tx) => {
    await tx.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash }
    });

    // Revoke all refresh tokens (force re-login)
    await tx.refreshToken.updateMany({
      where: {
        userId: req.user.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    // Log password change
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PASSWORD_CHANGED',
        entity: 'User',
        entityId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  });

  logger.info('User changed password', {
    userId: req.user.id,
    ip: req.ip
  });

  res.json({
    status: 'success',
    message: 'Password changed successfully. Please login again.'
  });
};

// Placeholder implementations for other auth methods
const forgotPassword = async (req, res) => {
  // TODO: Implement password reset functionality
  res.json({
    status: 'success',
    message: 'Password reset email sent (not implemented yet)'
  });
};

const resetPassword = async (req, res) => {
  // TODO: Implement password reset functionality
  res.json({
    status: 'success',
    message: 'Password reset successful (not implemented yet)'
  });
};

const verifyEmail = async (req, res) => {
  // TODO: Implement email verification
  res.json({
    status: 'success',
    message: 'Email verified (not implemented yet)'
  });
};

const resendVerification = async (req, res) => {
  // TODO: Implement resend verification
  res.json({
    status: 'success',
    message: 'Verification email sent (not implemented yet)'
  });
};

const deleteAccount = async (req, res) => {
  // TODO: Implement account deletion
  res.json({
    status: 'success',
    message: 'Account deleted (not implemented yet)'
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  deleteAccount
};