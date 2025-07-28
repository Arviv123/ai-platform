const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ChatService = require('../services/chat/ChatService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();
const chatService = new ChatService();

// Get user's chat sessions
router.get('/sessions', 
  authenticateToken,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { limit = 50, offset = 0 } = req.query;
      const sessions = await chatService.getUserSessions(
        req.user.id, 
        parseInt(limit), 
        parseInt(offset)
      );

      res.json({
        success: true,
        data: sessions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: sessions.length
        }
      });
    } catch (error) {
      console.error('Error getting sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sessions'
      });
    }
  }
);

// Create new chat session
router.post('/sessions',
  authenticateToken,
  body('title').optional().isLength({ min: 1, max: 200 }),
  body('model').optional().isIn(['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gemini-pro']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, model } = req.body;
      const session = await chatService.createSession(req.user.id, title, model);

      res.status(201).json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create session'
      });
    }
  }
);

// Get specific chat session
router.get('/sessions/:sessionId',
  authenticateToken,
  param('sessionId').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const session = await chatService.getSession(req.params.sessionId, req.user.id);

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error getting session:', error);
      if (error.message === 'Session not found') {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to get session'
        });
      }
    }
  }
);

// Update session title
router.patch('/sessions/:sessionId',
  authenticateToken,
  param('sessionId').isUUID(),
  body('title').isLength({ min: 1, max: 200 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title } = req.body;
      await chatService.updateSessionTitle(req.params.sessionId, req.user.id, title);

      res.json({
        success: true,
        message: 'Session title updated'
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session'
      });
    }
  }
);

// Delete session
router.delete('/sessions/:sessionId',
  authenticateToken,
  param('sessionId').isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      await chatService.deleteSession(req.params.sessionId, req.user.id);

      res.json({
        success: true,
        message: 'Session deleted'
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete session'
      });
    }
  }
);

// Send message to chat
router.post('/message',
  authenticateToken,
  body('sessionId').optional().isUUID(),
  body('message').isLength({ min: 1, max: 10000 }),
  body('model').optional().isIn(['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gemini-pro']),
  body('stream').optional().isBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { sessionId, message, model, stream = true } = req.body;

      // Check user's token limits
      const usage = await chatService.getUserUsageStats(req.user.id, 'month');
      const userPlan = req.user.organization?.plan || 'free';
      const tokenLimits = {
        free: 10000,
        pro: 100000,
        enterprise: 1000000
      };

      if (usage.totalTokens >= tokenLimits[userPlan]) {
        return res.status(429).json({
          success: false,
          message: 'Monthly token limit exceeded',
          usage,
          limit: tokenLimits[userPlan]
        });
      }

      if (stream) {
        // Set up Server-Sent Events
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        const response = await chatService.sendMessage(sessionId, req.user.id, message, model);
        
        // Pipe the stream to the client
        response.stream.on('data', (chunk) => {
          res.write(chunk);
        });

        response.stream.on('end', () => {
          res.end();
        });

        response.stream.on('error', (error) => {
          console.error('Stream error:', error);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        });

      } else {
        // Non-streaming response
        const response = await chatService.sendMessage(sessionId, req.user.id, message, model);
        
        res.json({
          success: true,
          data: {
            userMessage: response.userMessage,
            assistantMessage: response.assistantMessage,
            toolResults: response.toolResults || []
          }
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      if (req.get('Accept') === 'text/event-stream') {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send message',
          error: error.message
        });
      }
    }
  }
);

// Get available AI models
router.get('/models',
  authenticateToken,
  async (req, res) => {
    try {
      const models = await chatService.aiService.getAvailableModels();
      
      res.json({
        success: true,
        data: models
      });
    } catch (error) {
      console.error('Error getting models:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available models'
      });
    }
  }
);

// Get user usage statistics
router.get('/usage',
  authenticateToken,
  query('period').optional().isIn(['day', 'week', 'month', 'year']),
  async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      const usage = await chatService.getUserUsageStats(req.user.id, period);
      
      // Get user's plan limits
      const userPlan = req.user.organization?.plan || 'free';
      const tokenLimits = {
        free: 10000,
        pro: 100000,
        enterprise: 1000000
      };

      res.json({
        success: true,
        data: {
          ...usage,
          limit: tokenLimits[userPlan],
          plan: userPlan,
          percentage: (usage.totalTokens / tokenLimits[userPlan]) * 100
        }
      });
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get usage statistics'
      });
    }
  }
);

// Get conversation export
router.get('/sessions/:sessionId/export',
  authenticateToken,
  param('sessionId').isUUID(),
  query('format').optional().isIn(['json', 'markdown', 'txt']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { format = 'json' } = req.query;
      const session = await chatService.getSession(req.params.sessionId, req.user.id);

      let exportData;
      let contentType;
      let filename;

      switch (format) {
        case 'markdown':
          exportData = generateMarkdownExport(session);
          contentType = 'text/markdown';
          filename = `conversation-${session.id}.md`;
          break;
        case 'txt':
          exportData = generateTextExport(session);
          contentType = 'text/plain';
          filename = `conversation-${session.id}.txt`;
          break;
        default:
          exportData = JSON.stringify(session, null, 2);
          contentType = 'application/json';
          filename = `conversation-${session.id}.json`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);

    } catch (error) {
      console.error('Error exporting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export conversation'
      });
    }
  }
);

// Helper functions for export
function generateMarkdownExport(session) {
  let content = `# ${session.title}\n\n`;
  content += `**Model:** ${session.model}\n`;
  content += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
  content += `**Total Tokens:** ${session.totalTokens}\n\n`;
  content += `---\n\n`;

  for (const message of session.messages) {
    const role = message.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
    content += `## ${role}\n\n`;
    content += `${message.content}\n\n`;
    content += `*${new Date(message.createdAt).toLocaleString()} • ${message.tokens} tokens*\n\n`;
    content += `---\n\n`;
  }

  return content;
}

function generateTextExport(session) {
  let content = `${session.title}\n`;
  content += `Model: ${session.model}\n`;
  content += `Created: ${new Date(session.createdAt).toLocaleString()}\n`;
  content += `Total Tokens: ${session.totalTokens}\n\n`;
  content += `${'='.repeat(50)}\n\n`;

  for (const message of session.messages) {
    const role = message.role === 'user' ? 'You' : 'Assistant';
    content += `[${role}] ${new Date(message.createdAt).toLocaleString()}\n`;
    content += `${message.content}\n\n`;
    content += `${'-'.repeat(30)}\n\n`;
  }

  return content;
}

module.exports = router;
