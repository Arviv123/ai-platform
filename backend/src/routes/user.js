const express = require('express');
const { body, query } = require('express-validator');
const userController = require('../controllers/userController');
const { validateRequest } = require('../middleware/validation');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Validation rules
const updatePreferencesValidation = [
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be a valid locale code'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be boolean'),
  body('defaultModel')
    .optional()
    .isString()
    .withMessage('Default model must be a string'),
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// Routes

/**
 * @route   GET /api/user/profile
 * @desc    Get detailed user profile
 * @access  Private
 */
router.get('/profile',
  catchAsync(userController.getProfile)
);

/**
 * @route   PUT /api/user/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences',
  updatePreferencesValidation,
  validateRequest,
  catchAsync(userController.updatePreferences)
);

/**
 * @route   GET /api/user/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences',
  catchAsync(userController.getPreferences)
);

/**
 * @route   GET /api/user/usage
 * @desc    Get user usage statistics
 * @access  Private
 */
router.get('/usage',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('granularity')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage('Granularity must be day, week, or month'),
  ],
  validateRequest,
  catchAsync(userController.getUsage)
);

/**
 * @route   GET /api/user/credits
 * @desc    Get user credits information
 * @access  Private
 */
router.get('/credits',
  catchAsync(userController.getCredits)
);

/**
 * @route   GET /api/user/credits/transactions
 * @desc    Get user credit transactions
 * @access  Private
 */
router.get('/credits/transactions',
  paginationValidation,
  [
    query('type')
      .optional()
      .isIn(['PURCHASE', 'USAGE', 'REFUND', 'BONUS', 'SUBSCRIPTION_CREDIT'])
      .withMessage('Invalid transaction type'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
  validateRequest,
  catchAsync(userController.getCreditTransactions)
);

/**
 * @route   GET /api/user/subscription
 * @desc    Get user subscription information
 * @access  Private
 */
router.get('/subscription',
  catchAsync(userController.getSubscription)
);

/**
 * @route   GET /api/user/activity
 * @desc    Get user activity log
 * @access  Private
 */
router.get('/activity',
  paginationValidation,
  [
    query('action')
      .optional()
      .isString()
      .withMessage('Action must be a string'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
  validateRequest,
  catchAsync(userController.getActivity)
);

/**
 * @route   DELETE /api/user/data
 * @desc    Request user data deletion
 * @access  Private
 */
router.delete('/data',
  [
    body('confirmation')
      .equals('DELETE_MY_DATA')
      .withMessage('Confirmation must be "DELETE_MY_DATA"'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  validateRequest,
  catchAsync(userController.requestDataDeletion)
);

/**
 * @route   POST /api/user/export
 * @desc    Request user data export
 * @access  Private
 */
router.post('/export',
  [
    body('format')
      .isIn(['json', 'csv'])
      .withMessage('Format must be json or csv'),
    body('includeChats')
      .optional()
      .isBoolean()
      .withMessage('Include chats must be boolean'),
    body('includeMcpServers')
      .optional()
      .isBoolean()
      .withMessage('Include MCP servers must be boolean'),
  ],
  validateRequest,
  catchAsync(userController.exportData)
);

/**
 * @route   GET /api/user/sessions
 * @desc    Get user active sessions
 * @access  Private
 */
router.get('/sessions',
  paginationValidation,
  validateRequest,
  catchAsync(userController.getSessions)
);

/**
 * @route   DELETE /api/user/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  catchAsync(userController.revokeSession)
);

/**
 * @route   GET /api/user/dashboard
 * @desc    Get dashboard data
 * @access  Private
 */
router.get('/dashboard',
  catchAsync(userController.getDashboard)
);

/**
 * @route   POST /api/user/feedback
 * @desc    Submit user feedback
 * @access  Private
 */
router.post('/feedback',
  [
    body('type')
      .isIn(['bug', 'feature', 'general', 'complaint'])
      .withMessage('Type must be bug, feature, general, or complaint'),
    body('subject')
      .isLength({ min: 5, max: 200 })
      .withMessage('Subject must be between 5 and 200 characters'),
    body('message')
      .isLength({ min: 10, max: 2000 })
      .withMessage('Message must be between 10 and 2000 characters'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
  ],
  validateRequest,
  catchAsync(userController.submitFeedback)
);

// Admin only routes
/**
 * @route   GET /api/user/admin/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/admin/users',
  authorize('ADMIN', 'SUPER_ADMIN'),
  paginationValidation,
  [
    query('role')
      .optional()
      .isIn(['USER', 'ADMIN', 'SUPER_ADMIN'])
      .withMessage('Invalid role'),
    query('subscriptionTier')
      .optional()
      .isIn(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'])
      .withMessage('Invalid subscription tier'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('Is active must be boolean'),
    query('search')
      .optional()
      .isString()
      .withMessage('Search must be a string'),
  ],
  validateRequest,
  catchAsync(userController.getAllUsers)
);

/**
 * @route   GET /api/user/admin/users/:userId
 * @desc    Get specific user details (admin only)
 * @access  Private/Admin
 */
router.get('/admin/users/:userId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  catchAsync(userController.getUserById)
);

/**
 * @route   PUT /api/user/admin/users/:userId
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put('/admin/users/:userId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('role')
      .optional()
      .isIn(['USER', 'ADMIN', 'SUPER_ADMIN'])
      .withMessage('Invalid role'),
    body('subscriptionTier')
      .optional()
      .isIn(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'])
      .withMessage('Invalid subscription tier'),
    body('credits')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Credits must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('Is active must be boolean'),
  ],
  validateRequest,
  catchAsync(userController.updateUser)
);

/**
 * @route   POST /api/user/admin/users/:userId/credits
 * @desc    Add credits to user (admin only)
 * @access  Private/Admin
 */
router.post('/admin/users/:userId/credits',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('amount')
      .isInt({ min: 1 })
      .withMessage('Amount must be a positive integer'),
    body('reason')
      .isLength({ min: 5, max: 200 })
      .withMessage('Reason must be between 5 and 200 characters'),
  ],
  validateRequest,
  catchAsync(userController.addCreditsToUser)
);

/**
 * @route   GET /api/user/admin/stats
 * @desc    Get platform statistics (admin only)
 * @access  Private/Admin
 */
router.get('/admin/stats',
  authorize('ADMIN', 'SUPER_ADMIN'),
  catchAsync(userController.getPlatformStats)
);

module.exports = router;