const express = require('express');
const { authenticate } = require('../middleware/auth');
const chatController = require('../controllers/chatController');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Get available AI models
router.get('/models', authenticate, chatController.getModels);

// Test AI connection
router.get('/test', authenticate, chatController.testConnection);

// Get user's chat sessions
router.get('/sessions', authenticate, chatController.getSessions);

// Get messages for a specific session
router.get('/sessions/:sessionId', 
  authenticate,
  param('sessionId').isString(),
  chatController.getSessionMessages
);

// Send message to chat
router.post('/message',
  authenticate,
  body('message').isLength({ min: 1, max: 10000 }),
  body('sessionId').optional().isString(),
  body('model').optional().isString(),
  chatController.createMessage
);

// Stream AI response
router.post('/stream', authenticate, chatController.stream);

// Get available MCP tools
router.get('/tools', authenticate, chatController.getAvailableTools);

// Get user usage statistics
router.get('/usage',
  authenticate,
  query('period').optional().isIn(['day', 'week', 'month', 'year']),
  async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      
      // For now, return mock data
      res.json({
        status: 'success',
        data: {
          totalTokens: 1500,
          totalMessages: 25,
          totalSessions: 5,
          period,
          limit: 10000,
          plan: 'free',
          percentage: 15
        }
      });
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get usage statistics'
      });
    }
  }
);

module.exports = router;