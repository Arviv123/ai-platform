/**
 * A2A Protocol Routes - Agent-to-Agent Communication API
 * Implements Google's A2A protocol endpoints for agent interoperability
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const A2AService = require('../services/a2a/A2AService');
const AgentCoordinator = require('../services/a2a/AgentCoordinator');
const PersonalizationService = require('../services/intelligence/PersonalizationService');
const IntelligenceAnalyzer = require('../services/intelligence/IntelligenceAnalyzer');
const { body, param, query } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize services
const a2aService = new A2AService();
const agentCoordinator = new AgentCoordinator();
const personalizationService = new PersonalizationService();
const intelligenceAnalyzer = new IntelligenceAnalyzer();

// Initialize services on startup
(async () => {
  try {
    await a2aService.initialize();
    await agentCoordinator.initialize();
    await personalizationService.initialize();
    await intelligenceAnalyzer.initialize();
    logger.info('✅ A2A services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize A2A services:', error);
  }
})();

// === AGENT DISCOVERY ENDPOINTS ===

/**
 * Get service information and capabilities (A2A discovery endpoint)
 */
router.get('/discover', async (req, res) => {
  try {
    const serviceInfo = {
      ...a2aService.serviceInfo,
      timestamp: new Date().toISOString(),
      status: 'active'
    };

    res.json({
      protocol: 'a2a-v0.2',
      service: serviceInfo,
      agents: await a2aService.discoverAgents()
    });
  } catch (error) {
    logger.error('A2A discovery failed:', error);
    res.status(500).json({
      error: 'Discovery failed',
      message: error.message
    });
  }
});

/**
 * Discover available agents with optional filtering
 */
router.get('/agents', authenticate, async (req, res) => {
  try {
    const { type, capabilities, status } = req.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (capabilities) filters.capabilities = capabilities.split(',');
    if (status) filters.status = status;

    const agents = await a2aService.discoverAgents(filters);
    
    res.json({
      status: 'success',
      agents,
      total: agents.length,
      filters: filters
    });
  } catch (error) {
    logger.error('Agent discovery failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to discover agents',
      error: error.message
    });
  }
});

/**
 * Register a new agent
 */
router.post('/agents', 
  authenticate,
  body('id').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('type').isString().notEmpty(),
  body('capabilities').isArray(),
  body('description').isString().notEmpty(),
  async (req, res) => {
    try {
      const agentInfo = {
        id: req.body.id,
        name: req.body.name,
        type: req.body.type,
        capabilities: req.body.capabilities,
        description: req.body.description,
        vendor: req.body.vendor,
        version: req.body.version
      };

      const agentCard = await a2aService.registerAgent(agentInfo);
      
      res.status(201).json({
        status: 'success',
        message: 'Agent registered successfully',
        agent: agentCard
      });
    } catch (error) {
      logger.error('Agent registration failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to register agent',
        error: error.message
      });
    }
  }
);

/**
 * Get specific agent details
 */
router.get('/agents/:agentId', authenticate, async (req, res) => {
  try {
    const { agentId } = req.params;
    const agents = await a2aService.discoverAgents();
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: 'Agent not found'
      });
    }

    res.json({
      status: 'success',
      agent
    });
  } catch (error) {
    logger.error('Get agent failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get agent details',
      error: error.message
    });
  }
});

// === TASK MANAGEMENT ENDPOINTS ===

/**
 * Create a new collaborative task
 */
router.post('/tasks',
  authenticate,
  body('name').isString().notEmpty(),
  body('description').isString().notEmpty(),
  body('type').optional().isString(),
  body('requiredCapabilities').optional().isArray(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  async (req, res) => {
    try {
      const taskDefinition = {
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        requiredCapabilities: req.body.requiredCapabilities,
        priority: req.body.priority,
        deadline: req.body.deadline ? new Date(req.body.deadline) : null,
        context: req.body.context,
        agents: req.body.agents
      };

      const task = await a2aService.createTask(taskDefinition);
      
      res.status(201).json({
        status: 'success',
        message: 'Task created successfully',
        task
      });
    } catch (error) {
      logger.error('Task creation failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create task',
        error: error.message
      });
    }
  }
);

/**
 * Execute multi-agent coordination
 */
router.post('/coordinate',
  authenticate,
  body('taskDefinition').isObject(),
  body('strategy').optional().isString(),
  async (req, res) => {
    try {
      const { taskDefinition, strategy = 'auto' } = req.body;
      
      // Add user context to task
      taskDefinition.context = {
        ...taskDefinition.context,
        userId: req.user.id,
        userEmail: req.user.email
      };

      const result = await agentCoordinator.coordinateTask(taskDefinition, strategy);
      
      // Analyze the coordination result for intelligence metrics
      if (result.result && result.result.text) {
        try {
          await intelligenceAnalyzer.analyzeResponse(
            req.user.id,
            result.coordinationId,
            result.result.text,
            {
              type: 'multi_agent_coordination',
              strategy: result.strategy,
              agents: result.agents
            }
          );
        } catch (analysisError) {
          logger.warn('Intelligence analysis failed:', analysisError);
        }
      }
      
      res.json({
        status: 'success',
        coordination: result,
        message: 'Multi-agent coordination completed successfully'
      });
    } catch (error) {
      logger.error('Coordination failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to coordinate agents',
        error: error.message
      });
    }
  }
);

/**
 * Get coordination status
 */
router.get('/coordinate/:coordinationId', authenticate, async (req, res) => {
  try {
    const { coordinationId } = req.params;
    const status = agentCoordinator.getCoordinationStatus(coordinationId);
    
    if (!status) {
      return res.status(404).json({
        status: 'error',
        message: 'Coordination not found'
      });
    }

    res.json({
      status: 'success',
      coordination: status
    });
  } catch (error) {
    logger.error('Get coordination status failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get coordination status',
      error: error.message
    });
  }
});

/**
 * Get all active coordinations
 */
router.get('/coordinate', authenticate, async (req, res) => {
  try {
    const coordinations = agentCoordinator.getActiveCoordinations();
    
    res.json({
      status: 'success',
      coordinations,
      total: coordinations.length
    });
  } catch (error) {
    logger.error('Get coordinations failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get coordinations',
      error: error.message
    });
  }
});

// === AGENT COMMUNICATION ENDPOINTS ===

/**
 * Send message between agents
 */
router.post('/messages',
  authenticate,
  body('fromAgentId').isString().notEmpty(),
  body('toAgentId').isString().notEmpty(),
  body('message').isObject(),
  async (req, res) => {
    try {
      const { fromAgentId, toAgentId, message } = req.body;
      
      const sentMessage = await a2aService.sendAgentMessage(fromAgentId, toAgentId, message);
      
      res.status(201).json({
        status: 'success',
        message: 'Message sent successfully',
        sentMessage
      });
    } catch (error) {
      logger.error('Send message failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to send message',
        error: error.message
      });
    }
  }
);

// === PERSONALIZATION ENDPOINTS ===

/**
 * Get user personalization profile
 */
router.get('/personalization/profile', authenticate, async (req, res) => {
  try {
    const profile = await personalizationService.getUserProfile(req.user.id);
    
    res.json({
      status: 'success',
      profile: profile ? {
        communicationStyle: profile.communicationStyle,
        learningStyle: profile.learningStyle,
        skillLevel: profile.skillLevel,
        topicInterests: profile.topicInterests,
        customInstructions: profile.customInstructions,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      } : null
    });
  } catch (error) {
    logger.error('Get personalization profile failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get personalization profile',
      error: error.message
    });
  }
});

/**
 * Update user personalization profile
 */
router.put('/personalization/profile',
  authenticate,
  body('communicationStyle').optional().isString(),
  body('learningStyle').optional().isString(),
  body('skillLevel').optional().isString(),
  body('topicInterests').optional().isArray(),
  body('customInstructions').optional().isString(),
  async (req, res) => {
    try {
      const profileData = {
        communicationStyle: req.body.communicationStyle,
        learningStyle: req.body.learningStyle,
        skillLevel: req.body.skillLevel,
        topicInterests: req.body.topicInterests,
        customInstructions: req.body.customInstructions,
        preferences: req.body.preferences,
        goals: req.body.goals
      };

      const profile = await personalizationService.createOrUpdateProfile(req.user.id, profileData);
      
      res.json({
        status: 'success',
        message: 'Personalization profile updated successfully',
        profile: {
          communicationStyle: profile.communicationStyle,
          learningStyle: profile.learningStyle,
          skillLevel: profile.skillLevel,
          topicInterests: profile.topicInterests,
          customInstructions: profile.customInstructions,
          updatedAt: profile.updatedAt
        }
      });
    } catch (error) {
      logger.error('Update personalization profile failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update personalization profile',
        error: error.message
      });
    }
  }
);

/**
 * Get personalization insights
 */
router.get('/personalization/insights', authenticate, async (req, res) => {
  try {
    const insights = await personalizationService.generateInsights(req.user.id);
    
    res.json({
      status: 'success',
      insights
    });
  } catch (error) {
    logger.error('Get personalization insights failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get personalization insights',
      error: error.message
    });
  }
});

/**
 * Submit personalization feedback
 */
router.post('/personalization/feedback',
  authenticate,
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  body('preferredStyle').optional().isString(),
  async (req, res) => {
    try {
      const feedback = {
        rating: req.body.rating,
        comment: req.body.comment,
        preferredStyle: req.body.preferredStyle,
        context: req.body.context
      };

      const result = await personalizationService.learnFromFeedback(req.user.id, feedback);
      
      res.json({
        status: 'success',
        message: 'Feedback processed successfully',
        result
      });
    } catch (error) {
      logger.error('Process feedback failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process feedback',
        error: error.message
      });
    }
  }
);

// === INTELLIGENCE ANALYTICS ENDPOINTS ===

/**
 * Get user intelligence trends
 */
router.get('/intelligence/trends', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await intelligenceAnalyzer.getUserIntelligenceTrends(req.user.id, parseInt(days));
    
    res.json({
      status: 'success',
      trends
    });
  } catch (error) {
    logger.error('Get intelligence trends failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get intelligence trends',
      error: error.message
    });
  }
});

/**
 * Analyze a response manually
 */
router.post('/intelligence/analyze',
  authenticate,
  body('response').isString().notEmpty(),
  body('context').optional().isObject(),
  async (req, res) => {
    try {
      const { response, context = {} } = req.body;
      const sessionId = `manual_${Date.now()}`;
      
      const analysis = await intelligenceAnalyzer.analyzeResponse(
        req.user.id,
        sessionId,
        response,
        context
      );
      
      res.json({
        status: 'success',
        analysis
      });
    } catch (error) {
      logger.error('Manual analysis failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to analyze response',
        error: error.message
      });
    }
  }
);

// === STATUS AND HEALTH ENDPOINTS ===

/**
 * Get A2A service status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = {
      a2a: a2aService.getStatus(),
      coordinator: agentCoordinator.getStatus(),
      personalization: personalizationService.getStatus(),
      intelligence: intelligenceAnalyzer.getStatus(),
      timestamp: new Date().toISOString()
    };

    res.json({
      status: 'success',
      services: status
    });
  } catch (error) {
    logger.error('Get A2A status failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get service status',
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      services: {
        a2a: 'active',
        coordinator: 'active',
        personalization: 'active',
        intelligence: 'active'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;