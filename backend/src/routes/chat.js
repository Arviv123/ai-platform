const express = require('express');
const { body, param, query } = require('express-validator');
const chatController = require('../controllers/chatController');
const { validateRequest } = require('../middleware/validation');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// All chat routes require authentication
router.use(authenticate);

// Validation rules
const createSessionValidation = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('model')
    .notEmpty()
    .withMessage('Model is required')
    .isIn(['claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo', 'gemini-pro'])
    .withMessage('Invalid model selected'),
  body('systemPrompt')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('System prompt must be less than 10000 characters'),
  body('contextData')
    .optional()
    .isObject()
    .withMessage('Context data must be an object'),
];

const sendMessageValidation = [
  body('content')
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ min: 1, max: 50000 })
    .withMessage('Message content must be between 1 and 50000 characters'),
  body('role')
    .optional()
    .isIn(['user', 'system'])
    .withMessage('Role must be either user or system'),
  body('mcpToolCalls')
    .optional()
    .isArray()
    .withMessage('MCP tool calls must be an array'),
];

const sessionIdValidation = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID format'),
];

const messageIdValidation = [
  param('messageId')
    .isUUID()
    .withMessage('Invalid message ID format'),
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
 * @route   GET /api/chat/sessions
 * @desc    Get user's chat sessions
 * @access  Private
 */
router.get('/sessions',
  paginationValidation,
  validateRequest,
  catchAsync(chatController.getSessions)
);

/**
 * @route   POST /api/chat/sessions
 * @desc    Create a new chat session
 * @access  Private
 */
router.post('/sessions',
  createSessionValidation,
  validateRequest,
  catchAsync(chatController.createSession)
);

/**
 * @route   GET /api/chat/sessions/:sessionId
 * @desc    Get specific chat session with messages
 * @access  Private
 */
router.get('/sessions/:sessionId',
  sessionIdValidation,
  paginationValidation,
  validateRequest,
  catchAsync(chatController.getSession)
);

/**
 * @route   PUT /api/chat/sessions/:sessionId
 * @desc    Update chat session
 * @access  Private
 */
router.put('/sessions/:sessionId',
  sessionIdValidation,
  [
    body('title')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('systemPrompt')
      .optional()
      .isLength({ max: 10000 })
      .withMessage('System prompt must be less than 10000 characters'),
    body('contextData')
      .optional()
      .isObject()
      .withMessage('Context data must be an object'),
  ],
  validateRequest,
  catchAsync(chatController.updateSession)
);

/**
 * @route   DELETE /api/chat/sessions/:sessionId
 * @desc    Delete chat session
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  sessionIdValidation,
  validateRequest,
  catchAsync(chatController.deleteSession)
);

/**
 * @route   POST /api/chat/sessions/:sessionId/messages
 * @desc    Send message in chat session
 * @access  Private
 */
router.post('/sessions/:sessionId/messages',
  sessionIdValidation,
  sendMessageValidation,
  validateRequest,
  catchAsync(chatController.sendMessage)
);

/**
 * @route   GET /api/chat/sessions/:sessionId/messages
 * @desc    Get messages for a chat session
 * @access  Private
 */
router.get('/sessions/:sessionId/messages',
  sessionIdValidation,
  paginationValidation,
  validateRequest,
  catchAsync(chatController.getMessages)
);

/**
 * @route   DELETE /api/chat/sessions/:sessionId/messages/:messageId
 * @desc    Delete a specific message
 * @access  Private
 */
router.delete('/sessions/:sessionId/messages/:messageId',
  sessionIdValidation,
  messageIdValidation,
  validateRequest,
  catchAsync(chatController.deleteMessage)
);

/**
 * @route   POST /api/chat/sessions/:sessionId/stream
 * @desc    Send message with streaming response
 * @access  Private
 */
router.post('/sessions/:sessionId/stream',
  sessionIdValidation,
  sendMessageValidation,
  validateRequest,
  catchAsync(chatController.streamMessage)
);

/**
 * @route   POST /api/chat/sessions/:sessionId/regenerate
 * @desc    Regenerate last assistant message
 * @access  Private
 */
router.post('/sessions/:sessionId/regenerate',
  sessionIdValidation,
  validateRequest,
  catchAsync(chatController.regenerateMessage)
);

/**
 * @route   PUT /api/chat/sessions/:sessionId/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.put('/sessions/:sessionId/messages/:messageId',
  sessionIdValidation,
  messageIdValidation,
  [
    body('content')
      .notEmpty()
      .withMessage('Message content is required')
      .isLength({ min: 1, max: 50000 })
      .withMessage('Message content must be between 1 and 50000 characters'),
  ],
  validateRequest,
  catchAsync(chatController.editMessage)
);

/**
 * @route   GET /api/chat/models
 * @desc    Get available AI models
 * @access  Private
 */
router.get('/models',
  catchAsync(chatController.getModels)
);

/**
 * @route   GET /api/chat/usage
 * @desc    Get user's chat usage statistics
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
  ],
  validateRequest,
  catchAsync(chatController.getUsage)
);

/**
 * @route   POST /api/chat/sessions/:sessionId/export
 * @desc    Export chat session
 * @access  Private
 */
router.post('/sessions/:sessionId/export',
  sessionIdValidation,
  [
    body('format')
      .isIn(['json', 'markdown', 'pdf'])
      .withMessage('Format must be json, markdown, or pdf'),
  ],
  validateRequest,
  catchAsync(chatController.exportSession)
);

/**
 * @route   POST /api/chat/sessions/:sessionId/share
 * @desc    Create shareable link for chat session
 * @access  Private
 */
router.post('/sessions/:sessionId/share',
  sessionIdValidation,
  [
    body('expiresIn')
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage('Expires in must be between 1 and 30 days'),
    body('password')
      .optional()
      .isLength({ min: 4, max: 50 })
      .withMessage('Password must be between 4 and 50 characters'),
  ],
  validateRequest,
  catchAsync(chatController.shareSession)
);

module.exports = router;