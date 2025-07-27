const express = require('express');
const { body, query } = require('express-validator');
const billingController = require('../controllers/billingController');
const { validateRequest } = require('../middleware/validation');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// All billing routes require authentication
router.use(authenticate);

// Validation rules
const purchaseCreditsValidation = [
  body('amount')
    .isInt({ min: 100, max: 100000 })
    .withMessage('Amount must be between 100 and 100,000 credits'),
  body('paymentMethodId')
    .optional()
    .isString()
    .withMessage('Payment method ID must be a string'),
];

const createSubscriptionValidation = [
  body('tier')
    .isIn(['PRO', 'BUSINESS', 'ENTERPRISE'])
    .withMessage('Tier must be PRO, BUSINESS, or ENTERPRISE'),
  body('paymentMethodId')
    .isString()
    .withMessage('Payment method ID is required'),
  body('billingCycle')
    .optional()
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be monthly or yearly'),
];

const webhookValidation = [
  body('type')
    .isString()
    .withMessage('Webhook type is required'),
  body('data')
    .isObject()
    .withMessage('Webhook data must be an object'),
];

// Routes

/**
 * @route   GET /api/billing/credits
 * @desc    Get user credits balance and history
 * @access  Private
 */
router.get('/credits',
  catchAsync(billingController.getCredits)
);

/**
 * @route   POST /api/billing/credits/purchase
 * @desc    Purchase credits
 * @access  Private
 */
router.post('/credits/purchase',
  purchaseCreditsValidation,
  validateRequest,
  catchAsync(billingController.purchaseCredits)
);

/**
 * @route   GET /api/billing/credits/packages
 * @desc    Get available credit packages
 * @access  Private
 */
router.get('/credits/packages',
  catchAsync(billingController.getCreditPackages)
);

/**
 * @route   GET /api/billing/subscription
 * @desc    Get current subscription
 * @access  Private
 */
router.get('/subscription',
  catchAsync(billingController.getSubscription)
);

/**
 * @route   POST /api/billing/subscription
 * @desc    Create new subscription
 * @access  Private
 */
router.post('/subscription',
  createSubscriptionValidation,
  validateRequest,
  catchAsync(billingController.createSubscription)
);

/**
 * @route   PUT /api/billing/subscription
 * @desc    Update subscription
 * @access  Private
 */
router.put('/subscription',
  [
    body('tier')
      .optional()
      .isIn(['PRO', 'BUSINESS', 'ENTERPRISE'])
      .withMessage('Tier must be PRO, BUSINESS, or ENTERPRISE'),
    body('billingCycle')
      .optional()
      .isIn(['monthly', 'yearly'])
      .withMessage('Billing cycle must be monthly or yearly'),
  ],
  validateRequest,
  catchAsync(billingController.updateSubscription)
);

/**
 * @route   DELETE /api/billing/subscription
 * @desc    Cancel subscription
 * @access  Private
 */
router.delete('/subscription',
  [
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
    body('feedback')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Feedback must be less than 1000 characters'),
  ],
  validateRequest,
  catchAsync(billingController.cancelSubscription)
);

/**
 * @route   GET /api/billing/plans
 * @desc    Get available subscription plans
 * @access  Private
 */
router.get('/plans',
  catchAsync(billingController.getPlans)
);

/**
 * @route   GET /api/billing/invoices
 * @desc    Get user invoices
 * @access  Private
 */
router.get('/invoices',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['draft', 'open', 'paid', 'uncollectible', 'void'])
      .withMessage('Invalid invoice status'),
  ],
  validateRequest,
  catchAsync(billingController.getInvoices)
);

/**
 * @route   GET /api/billing/invoices/:invoiceId
 * @desc    Get specific invoice
 * @access  Private
 */
router.get('/invoices/:invoiceId',
  catchAsync(billingController.getInvoice)
);

/**
 * @route   POST /api/billing/invoices/:invoiceId/pay
 * @desc    Pay invoice
 * @access  Private
 */
router.post('/invoices/:invoiceId/pay',
  [
    body('paymentMethodId')
      .isString()
      .withMessage('Payment method ID is required'),
  ],
  validateRequest,
  catchAsync(billingController.payInvoice)
);

/**
 * @route   GET /api/billing/payment-methods
 * @desc    Get user payment methods
 * @access  Private
 */
router.get('/payment-methods',
  catchAsync(billingController.getPaymentMethods)
);

/**
 * @route   POST /api/billing/payment-methods
 * @desc    Add payment method
 * @access  Private
 */
router.post('/payment-methods',
  [
    body('type')
      .isIn(['card', 'bank_account'])
      .withMessage('Type must be card or bank_account'),
    body('token')
      .isString()
      .withMessage('Payment method token is required'),
  ],
  validateRequest,
  catchAsync(billingController.addPaymentMethod)
);

/**
 * @route   DELETE /api/billing/payment-methods/:paymentMethodId
 * @desc    Remove payment method
 * @access  Private
 */
router.delete('/payment-methods/:paymentMethodId',
  catchAsync(billingController.removePaymentMethod)
);

/**
 * @route   PUT /api/billing/payment-methods/:paymentMethodId/default
 * @desc    Set default payment method
 * @access  Private
 */
router.put('/payment-methods/:paymentMethodId/default',
  catchAsync(billingController.setDefaultPaymentMethod)
);

/**
 * @route   GET /api/billing/transactions
 * @desc    Get billing transactions
 * @access  Private
 */
router.get('/transactions',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('type')
      .optional()
      .isIn(['PURCHASE', 'USAGE', 'REFUND', 'SUBSCRIPTION_CREDIT'])
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
  catchAsync(billingController.getTransactions)
);

/**
 * @route   GET /api/billing/usage
 * @desc    Get billing usage statistics
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
  catchAsync(billingController.getUsage)
);

/**
 * @route   POST /api/billing/refund
 * @desc    Request refund
 * @access  Private
 */
router.post('/refund',
  [
    body('transactionId')
      .isString()
      .withMessage('Transaction ID is required'),
    body('reason')
      .isLength({ min: 10, max: 500 })
      .withMessage('Reason must be between 10 and 500 characters'),
    body('amount')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Amount must be a positive integer'),
  ],
  validateRequest,
  catchAsync(billingController.requestRefund)
);

/**
 * @route   GET /api/billing/estimates
 * @desc    Get cost estimates
 * @access  Private
 */
router.get('/estimates',
  [
    query('model')
      .isString()
      .withMessage('Model is required'),
    query('inputTokens')
      .isInt({ min: 1 })
      .withMessage('Input tokens must be a positive integer'),
    query('outputTokens')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Output tokens must be a non-negative integer'),
  ],
  validateRequest,
  catchAsync(billingController.getCostEstimates)
);

/**
 * @route   POST /api/billing/apply-coupon
 * @desc    Apply coupon code
 * @access  Private
 */
router.post('/apply-coupon',
  [
    body('code')
      .isString()
      .isLength({ min: 3, max: 50 })
      .withMessage('Coupon code must be between 3 and 50 characters'),
  ],
  validateRequest,
  catchAsync(billingController.applyCoupon)
);

/**
 * @route   GET /api/billing/tax-info
 * @desc    Get tax information
 * @access  Private
 */
router.get('/tax-info',
  catchAsync(billingController.getTaxInfo)
);

/**
 * @route   PUT /api/billing/tax-info
 * @desc    Update tax information
 * @access  Private
 */
router.put('/tax-info',
  [
    body('taxId')
      .optional()
      .isString()
      .withMessage('Tax ID must be a string'),
    body('country')
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage('Country must be a 2-letter country code'),
    body('state')
      .optional()
      .isString()
      .withMessage('State must be a string'),
    body('address')
      .optional()
      .isObject()
      .withMessage('Address must be an object'),
  ],
  validateRequest,
  catchAsync(billingController.updateTaxInfo)
);

// Webhook endpoints (no authentication required)
/**
 * @route   POST /api/billing/webhooks/stripe
 * @desc    Handle Stripe webhooks
 * @access  Public (verified by Stripe signature)
 */
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  catchAsync(billingController.handleStripeWebhook)
);

// Admin routes
/**
 * @route   GET /api/billing/admin/revenue
 * @desc    Get revenue statistics (admin only)
 * @access  Private/Admin
 */
router.get('/admin/revenue',
  authorize('ADMIN', 'SUPER_ADMIN'),
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
  catchAsync(billingController.getRevenueStats)
);

/**
 * @route   GET /api/billing/admin/subscriptions
 * @desc    Get all subscriptions (admin only)
 * @access  Private/Admin
 */
router.get('/admin/subscriptions',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE', 'PAUSED'])
      .withMessage('Invalid subscription status'),
    query('tier')
      .optional()
      .isIn(['PRO', 'BUSINESS', 'ENTERPRISE'])
      .withMessage('Invalid subscription tier'),
  ],
  validateRequest,
  catchAsync(billingController.getAllSubscriptions)
);

/**
 * @route   POST /api/billing/admin/refunds/:transactionId
 * @desc    Process refund (admin only)
 * @access  Private/Admin
 */
router.post('/admin/refunds/:transactionId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('amount')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Amount must be a positive integer'),
    body('reason')
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters'),
  ],
  validateRequest,
  catchAsync(billingController.processRefund)
);

module.exports = router;