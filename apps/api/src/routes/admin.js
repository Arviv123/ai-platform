const express = require("express");
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Admin dashboard info
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    // Check if user has admin permissions
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'אין הרשאות מנהל'
      });
    }

    // Return comprehensive dashboard data
    return res.status(200).json({
      status: 'success',
      data: {
        user: req.user,
        permissions: req.user.permissions || [],
        dashboardAccess: {
          userManagement: true,
          systemSettings: true,
          billing: req.user.role === 'PLATFORM_OWNER',
          analytics: true,
          apiManagement: true,
          organizationManagement: req.user.isOwner || false
        },
        systemInfo: {
          platform: 'נדל"ן AI Platform',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'production',
          lastUpdate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'שגיאה בטעינת דשבורד המנהל'
    });
  }
});

// Get all users (admin only)
router.get('/users', authenticate, async (req, res) => {
  try {
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'אין הרשאות לניהול משתמשים'
      });
    }

    // Return demo users for now
    const { demoUsers } = require('../controllers/authController');
    const users = Object.entries(demoUsers || {}).map(([email, userData]) => ({
      id: userData.id,
      email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      permissions: userData.permissions || [],
      isOwner: userData.isOwner || false,
      createdAt: '2024-01-01T00:00:00.000Z',
      lastLogin: new Date().toISOString()
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        users,
        totalUsers: users.length,
        adminUsers: users.filter(u => ['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN'].includes(u.role)).length,
        regularUsers: users.filter(u => u.role === 'USER').length
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'שגיאה בטעינת רשימת משתמשים'
    });
  }
});

// System statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'אין הרשאות לצפייה בסטטיסטיקות'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        platform: {
          totalUsers: 5,
          activeUsers: 3,
          totalSessions: 25,
          systemUptime: process.uptime(),
          version: '1.0.0'
        },
        usage: {
          apiCalls: 150,
          successfulLogins: 45,
          failedLogins: 3,
          avgResponseTime: '250ms'
        },
        business: {
          revenue: 5000,
          subscriptions: 12,
          conversionRate: '15%',
          userGrowth: '+25%'
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'שגיאה בטעינת סטטיסטיקות'
    });
  }
});

module.exports = router;