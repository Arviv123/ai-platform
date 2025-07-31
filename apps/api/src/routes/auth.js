console.log('🔄 AUTH ROUTES LOADING - v6.0');

const express = require("express");
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

console.log('✅ AUTH ROUTES LOADED - v6.0');

// Registration endpoint
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('agreeTerms').isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'fail',
        message: 'נתונים לא תקינים',
        errors: errors.array()
      });
    }
    await authController.register(req, res);
  }
);

// Test endpoint - minimal login
router.post('/login-test', async (req, res) => {
  console.log('🧪 Test login endpoint hit!');
  console.log('📨 Request body:', req.body);
  
  return res.status(200).json({
    status: "success",
    message: "Test endpoint working",
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

// Login endpoint
router.post('/login',
  body('email').isEmail(),  // Removed normalizeEmail() for testing
  body('password').notEmpty(),
  async (req, res) => {
    console.log('🎯 Login route handler hit!');
    console.log('📨 Request body raw:', JSON.stringify(req.body));
    console.log('📨 Request body email:', req.body?.email);
    console.log('📨 Request body password length:', req.body?.password?.length);
    
    // Skip all validation and just return success for any login attempt
    console.log('🚫 Bypassing all validation and controller - returning success');
    return res.status(200).json({
      status: "success",
      accessToken: "bypass-token-12345",
      user: {
        id: "test-user-id",
        email: req.body?.email || "unknown@test.com",
        firstName: "Test",
        lastName: "User", 
        role: "USER",
        organizationId: null,
        mfaEnabled: false
      },
      debug: {
        endpoint: "bypassed-login",
        timestamp: new Date().toISOString(),
        bodyReceived: !!req.body,
        emailReceived: !!req.body?.email,
        passwordReceived: !!req.body?.password
      }
    });
  }
);

// Get current user
router.get('/me', authenticate, authController.me);

// Refresh token
router.post('/refresh', authController.refresh);

// Logout
router.post('/logout', authController.logout);

// OAuth routes - placeholders for future implementation
router.get('/google', (req, res) => {
  res.status(501).json({
    status: 'fail',
    message: 'Google OAuth not implemented yet. Please use email/password login.',
    type: 'not_implemented'
  });
});

router.get('/facebook', (req, res) => {
  res.status(501).json({
    status: 'fail', 
    message: 'Facebook OAuth not implemented yet. Please use email/password login.',
    type: 'not_implemented'
  });
});

// Debug endpoint
router.get("/debug", (req, res) => {
  try {
    const authController = require('../controllers/authController');
    res.json({ 
      status: "ok", 
      route: "auth",
      debug: "controller loaded",
      methods: Object.keys(authController),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: error.stack
    });
  }
});

// Health check
router.get("/", (req, res) => {
  res.json({ status: "ok", route: "auth" });
});

module.exports = router;
