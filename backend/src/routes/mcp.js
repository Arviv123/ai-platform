const express = require('express');
const { body, param, query } = require('express-validator');
const mcpController = require('../controllers/mcpController');
const { validateRequest } = require('../middleware/validation');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// All MCP routes require authentication
router.use(authenticate);

// Validation rules
const createServerValidation = [
  body('name')
    .notEmpty()
    .withMessage('Server name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Server name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\-_\s]+$/)
    .withMessage('Server name can only contain letters, numbers, hyphens, underscores, and spaces'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('command')
    .notEmpty()
    .withMessage('Command is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Command must be between 1 and 255 characters'),
  body('args')
    .optional()
    .isArray()
    .withMessage('Args must be an array'),
  body('env')
    .optional()
    .isObject()
    .withMessage('Environment variables must be an object'),
];

const updateServerValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Server name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\-_\s]+$/)
    .withMessage('Server name can only contain letters, numbers, hyphens, underscores, and spaces'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('command')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Command must be between 1 and 255 characters'),
  body('args')
    .optional()
    .isArray()
    .withMessage('Args must be an array'),
  body('env')
    .optional()
    .isObject()
    .withMessage('Environment variables must be an object'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
];

const serverIdValidation = [
  param('serverId')
    .isUUID()
    .withMessage('Invalid server ID format'),
];

const toolCallValidation = [
  body('toolName')
    .notEmpty()
    .withMessage('Tool name is required'),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('Parameters must be an object'),
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
 * @route   GET /api/mcp/servers
 * @desc    Get user's MCP servers
 * @access  Private
 */
router.get('/servers',
  paginationValidation,
  [
    query('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled filter must be boolean'),
    query('healthStatus')
      .optional()
      .isIn(['HEALTHY', 'UNHEALTHY', 'UNKNOWN', 'CONNECTING', 'ERROR'])
      .withMessage('Invalid health status'),
  ],
  validateRequest,
  catchAsync(mcpController.getServers)
);

/**
 * @route   POST /api/mcp/servers
 * @desc    Create a new MCP server
 * @access  Private
 */
router.post('/servers',
  createServerValidation,
  validateRequest,
  catchAsync(mcpController.createServer)
);

/**
 * @route   GET /api/mcp/servers/:serverId
 * @desc    Get specific MCP server details
 * @access  Private
 */
router.get('/servers/:serverId',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.getServer)
);

/**
 * @route   PUT /api/mcp/servers/:serverId
 * @desc    Update MCP server configuration
 * @access  Private
 */
router.put('/servers/:serverId',
  serverIdValidation,
  updateServerValidation,
  validateRequest,
  catchAsync(mcpController.updateServer)
);

/**
 * @route   DELETE /api/mcp/servers/:serverId
 * @desc    Delete MCP server
 * @access  Private
 */
router.delete('/servers/:serverId',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.deleteServer)
);

/**
 * @route   POST /api/mcp/servers/:serverId/test
 * @desc    Test MCP server connection
 * @access  Private
 */
router.post('/servers/:serverId/test',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.testServer)
);

/**
 * @route   POST /api/mcp/servers/:serverId/start
 * @desc    Start MCP server
 * @access  Private
 */
router.post('/servers/:serverId/start',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.startServer)
);

/**
 * @route   POST /api/mcp/servers/:serverId/stop
 * @desc    Stop MCP server
 * @access  Private
 */
router.post('/servers/:serverId/stop',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.stopServer)
);

/**
 * @route   POST /api/mcp/servers/:serverId/restart
 * @desc    Restart MCP server
 * @access  Private
 */
router.post('/servers/:serverId/restart',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.restartServer)
);

/**
 * @route   GET /api/mcp/servers/:serverId/tools
 * @desc    Get available tools for MCP server
 * @access  Private
 */
router.get('/servers/:serverId/tools',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.getServerTools)
);

/**
 * @route   POST /api/mcp/servers/:serverId/tools/call
 * @desc    Call a tool on MCP server
 * @access  Private
 */
router.post('/servers/:serverId/tools/call',
  serverIdValidation,
  toolCallValidation,
  validateRequest,
  catchAsync(mcpController.callTool)
);

/**
 * @route   GET /api/mcp/servers/:serverId/logs
 * @desc    Get MCP server logs
 * @access  Private
 */
router.get('/servers/:serverId/logs',
  serverIdValidation,
  paginationValidation,
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('level')
      .optional()
      .isIn(['error', 'warn', 'info', 'debug'])
      .withMessage('Invalid log level'),
  ],
  validateRequest,
  catchAsync(mcpController.getServerLogs)
);

/**
 * @route   GET /api/mcp/servers/:serverId/health
 * @desc    Get MCP server health status
 * @access  Private
 */
router.get('/servers/:serverId/health',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.getServerHealth)
);

/**
 * @route   GET /api/mcp/servers/:serverId/stats
 * @desc    Get MCP server usage statistics
 * @access  Private
 */
router.get('/servers/:serverId/stats',
  serverIdValidation,
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
  catchAsync(mcpController.getServerStats)
);

/**
 * @route   POST /api/mcp/servers/:serverId/clone
 * @desc    Clone MCP server configuration
 * @access  Private
 */
router.post('/servers/:serverId/clone',
  serverIdValidation,
  [
    body('name')
      .notEmpty()
      .withMessage('New server name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Server name must be between 1 and 100 characters'),
  ],
  validateRequest,
  catchAsync(mcpController.cloneServer)
);

/**
 * @route   POST /api/mcp/servers/import
 * @desc    Import MCP server configuration
 * @access  Private
 */
router.post('/servers/import',
  [
    body('config')
      .notEmpty()
      .withMessage('Server configuration is required')
      .isObject()
      .withMessage('Configuration must be an object'),
  ],
  validateRequest,
  catchAsync(mcpController.importServer)
);

/**
 * @route   GET /api/mcp/servers/:serverId/export
 * @desc    Export MCP server configuration
 * @access  Private
 */
router.get('/servers/:serverId/export',
  serverIdValidation,
  validateRequest,
  catchAsync(mcpController.exportServer)
);

/**
 * @route   GET /api/mcp/templates
 * @desc    Get MCP server templates
 * @access  Private
 */
router.get('/templates',
  [
    query('category')
      .optional()
      .isString()
      .withMessage('Category must be a string'),
  ],
  validateRequest,
  catchAsync(mcpController.getTemplates)
);

/**
 * @route   POST /api/mcp/servers/from-template
 * @desc    Create MCP server from template
 * @access  Private
 */
router.post('/servers/from-template',
  [
    body('templateId')
      .notEmpty()
      .withMessage('Template ID is required'),
    body('name')
      .notEmpty()
      .withMessage('Server name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Server name must be between 1 and 100 characters'),
    body('config')
      .optional()
      .isObject()
      .withMessage('Configuration overrides must be an object'),
  ],
  validateRequest,
  catchAsync(mcpController.createFromTemplate)
);

module.exports = router;