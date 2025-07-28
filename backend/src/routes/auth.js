const express = require("express");
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

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

// Login endpoint
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'fail',
        message: 'נתונים לא תקינים',
        errors: errors.array()
      });
    }
    await authController.login(req, res);
  }
);

// Get current user
router.get('/me', authenticate, authController.me);

// Refresh token
router.post('/refresh', authController.refresh);

// Logout
router.post('/logout', authController.logout);

// Health check
router.get("/", (req, res) => {
  res.json({ status: "ok", route: "auth" });
});

module.exports = router;
