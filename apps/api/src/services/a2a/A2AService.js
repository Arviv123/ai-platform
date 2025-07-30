/**
 * Agent2Agent (A2A) Protocol Service
 * Implementation of Google's A2A protocol for agent-to-agent communication
 * 
 * Based on A2A Protocol v0.2 specification
 * Supports JSON-RPC 2.0 over HTTP(S), agent discovery, and task delegation
 */

const logger = require('../../utils/logger');
const { PrismaClient } = require('@prisma/client');

class A2AService {
  constructor() {
    this.prisma = new PrismaClient();
    this.registeredAgents = new Map();
    this.activeConnections = new Map();
    this.taskRegistry = new Map();
    this.capabilities = new Set();
    
    // Service metadata
    this.serviceInfo = {
      id: 'ai-platform-agent',
      name: 'AI Platform Agent',
      version: '1.0.0',
      description: 'Multi-provider AI agent with MCP integration',
      vendor: 'AI Platform',
      capabilities: [],
      protocols: ['a2a-v0.2'],
      endpoints: {
        discovery: '/api/a2a/discover',
        tasks: '/api/a2a/tasks',
        collaborate: '/api/a2a/collaborate'
      }
    };
  }

  /**
   * Initialize A2A service with capabilities
   */
  async initialize() {
    try {
      await this.loadCapabilities();
      await this.registerDefaultAgents();
      logger.info('✅ A2A Service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize A2A Service:', error);
      throw error;
    }
  }

  /**
   * Load and register agent capabilities
   */
  async loadCapabilities() {
    // Core AI capabilities
    this.capabilities.add('text-generation');
    this.capabilities.add('conversation');
    this.capabilities.add('code-analysis');
    this.capabilities.add('data-processing');
    this.capabilities.add('task-delegation');
    this.capabilities.add('memory-management');
    this.capabilities.add('tool-integration');
    
    // Update service info
    this.serviceInfo.capabilities = Array.from(this.capabilities);
    
    logger.info(`📋 Loaded ${this.capabilities.size} capabilities`);
  }

  /**
   * Register default specialized agents
   */
  async registerDefaultAgents() {
    const defaultAgents = [
      {
        id: 'ai-chat-agent',
        name: 'AI Chat Agent',
        type: 'conversational',
        capabilities: ['text-generation', 'conversation', 'memory-management'],
        description: 'Specialized agent for conversational AI interactions'
      },
      {
        id: 'code-analysis-agent',
        name: 'Code Analysis Agent', 
        type: 'analytical',
        capabilities: ['code-analysis', 'debugging', 'optimization'],
        description: 'Specialized agent for code analysis and development tasks'
      },
      {
        id: 'data-processing-agent',
        name: 'Data Processing Agent',
        type: 'computational',
        capabilities: ['data-processing', 'analysis', 'transformation'],
        description: 'Specialized agent for data processing and analysis'
      },
      {
        id: 'task-coordinator-agent',
        name: 'Task Coordinator Agent',
        type: 'orchestration',
        capabilities: ['task-delegation', 'workflow-management', 'coordination'],
        description: 'Specialized agent for coordinating multi-agent tasks'
      }
    ];

    for (const agent of defaultAgents) {
      await this.registerAgent(agent);
    }

    logger.info(`🤖 Registered ${defaultAgents.length} default agents`);
  }

  /**
   * Register a new agent in the A2A network
   */
  async registerAgent(agentInfo) {
    try {
      const agentCard = this.createAgentCard(agentInfo);
      this.registeredAgents.set(agentInfo.id, {
        ...agentInfo,
        card: agentCard,
        registeredAt: new Date(),
        lastSeen: new Date(),
        status: 'active'
      });

      // Store in database for persistence
      await this.prisma.a2AAgent.upsert({
        where: { agentId: agentInfo.id },
        update: {
          name: agentInfo.name,
          type: agentInfo.type,
          capabilities: JSON.stringify(agentInfo.capabilities),
          description: agentInfo.description,
          agentCard: JSON.stringify(agentCard),
          status: 'active',
          lastSeen: new Date()
        },
        create: {
          agentId: agentInfo.id,
          name: agentInfo.name,
          type: agentInfo.type,
          capabilities: JSON.stringify(agentInfo.capabilities),
          description: agentInfo.description,
          agentCard: JSON.stringify(agentCard),
          status: 'active'
        }
      });

      logger.info(`✅ Registered agent: ${agentInfo.name} (${agentInfo.id})`);
      return agentCard;
    } catch (error) {
      logger.error(`❌ Failed to register agent ${agentInfo.id}:`, error);
      throw error;
    }
  }

  /**
   * Create A2A Agent Card (JSON format as per spec)
   */
  createAgentCard(agentInfo) {
    return {
      id: agentInfo.id,
      name: agentInfo.name,
      version: agentInfo.version || '1.0.0',
      description: agentInfo.description,
      vendor: agentInfo.vendor || 'AI Platform',
      type: agentInfo.type,
      capabilities: agentInfo.capabilities,
      protocols: ['a2a-v0.2'],
      endpoints: {
        discovery: `/api/a2a/agents/${agentInfo.id}/discover`,
        tasks: `/api/a2a/agents/${agentInfo.id}/tasks`,
        collaborate: `/api/a2a/agents/${agentInfo.id}/collaborate`
      },
      authentication: {
        type: 'bearer',
        required: true
      },
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'active'
      }
    };
  }

  /**
   * Discover available agents and their capabilities
   */
  async discoverAgents(filters = {}) {
    try {
      let agents = Array.from(this.registeredAgents.values());

      // Apply filters
      if (filters.type) {
        agents = agents.filter(agent => agent.type === filters.type);
      }
      
      if (filters.capabilities) {
        const requiredCaps = Array.isArray(filters.capabilities) 
          ? filters.capabilities 
          : [filters.capabilities];
        
        agents = agents.filter(agent => 
          requiredCaps.every(cap => agent.capabilities.includes(cap))
        );
      }

      if (filters.status) {
        agents = agents.filter(agent => agent.status === filters.status);
      }

      // Return agent cards
      return agents.map(agent => agent.card);
    } catch (error) {
      logger.error('❌ Failed to discover agents:', error);
      throw error;
    }
  }

  /**
   * Create a new collaborative task
   */
  async createTask(taskDefinition) {
    try {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const task = {
        id: taskId,
        name: taskDefinition.name,
        description: taskDefinition.description,
        type: taskDefinition.type || 'collaborative',
        requiredCapabilities: taskDefinition.requiredCapabilities || [],
        assignedAgents: [],
        status: 'created',
        priority: taskDefinition.priority || 'medium',
        deadline: taskDefinition.deadline,
        context: taskDefinition.context || {},
        messages: [],
        artifacts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.taskRegistry.set(taskId, task);

      // Store in database
      await this.prisma.a2ATask.create({
        data: {
          taskId: taskId,
          name: task.name,
          description: task.description,
          type: task.type,
          requiredCapabilities: JSON.stringify(task.requiredCapabilities),
          status: task.status,
          priority: task.priority,
          deadline: task.deadline,
          context: JSON.stringify(task.context)
        }
      });

      logger.info(`📋 Created task: ${task.name} (${taskId})`);
      return task;
    } catch (error) {
      logger.error('❌ Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Assign agents to a task based on capabilities
   */
  async assignAgentsToTask(taskId, agentSelection = 'auto') {
    try {
      const task = this.taskRegistry.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      let suitableAgents = [];

      if (agentSelection === 'auto') {
        // Auto-select agents based on required capabilities
        suitableAgents = Array.from(this.registeredAgents.values())
          .filter(agent => 
            task.requiredCapabilities.every(cap => 
              agent.capabilities.includes(cap)
            )
          )
          .slice(0, 3); // Limit to 3 agents for performance
      } else if (Array.isArray(agentSelection)) {
        // Manual agent selection
        suitableAgents = agentSelection.map(agentId => 
          this.registeredAgents.get(agentId)
        ).filter(Boolean);
      }

      task.assignedAgents = suitableAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        role: this.determineAgentRole(agent, task),
        assignedAt: new Date()
      }));

      task.status = 'assigned';
      task.updatedAt = new Date();

      logger.info(`👥 Assigned ${task.assignedAgents.length} agents to task ${taskId}`);
      return task;
    } catch (error) {
      logger.error(`❌ Failed to assign agents to task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Determine optimal role for agent in task
   */
  determineAgentRole(agent, task) {
    const roles = {
      'ai-chat-agent': 'communicator',
      'code-analysis-agent': 'analyzer', 
      'data-processing-agent': 'processor',
      'task-coordinator-agent': 'coordinator'
    };

    return roles[agent.id] || 'participant';
  }

  /**
   * Send message between agents (A2A communication)
   */
  async sendAgentMessage(fromAgentId, toAgentId, message) {
    try {
      const fromAgent = this.registeredAgents.get(fromAgentId);
      const toAgent = this.registeredAgents.get(toAgentId);

      if (!fromAgent || !toAgent) {
        throw new Error('One or both agents not found');
      }

      const a2aMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        from: {
          id: fromAgent.id,
          name: fromAgent.name
        },
        to: {
          id: toAgent.id,
          name: toAgent.name
        },
        type: message.type || 'communication',
        content: message.content,
        context: message.context || {},
        artifacts: message.artifacts || [],
        timestamp: new Date(),
        protocol: 'a2a-v0.2'
      };

      // Store message
      await this.prisma.a2AMessage.create({
        data: {
          messageId: a2aMessage.id,
          fromAgentId: fromAgentId,
          toAgentId: toAgentId,
          type: a2aMessage.type,
          content: JSON.stringify(a2aMessage.content),
          context: JSON.stringify(a2aMessage.context),
          artifacts: JSON.stringify(a2aMessage.artifacts)
        }
      });

      logger.info(`💬 Message sent from ${fromAgent.name} to ${toAgent.name}`);
      return a2aMessage;
    } catch (error) {
      logger.error('❌ Failed to send agent message:', error);
      throw error;
    }
  }

  /**
   * Get service status and metrics
   */
  getStatus() {
    return {
      service: 'A2A Protocol Service',
      version: '1.0.0',
      status: 'active',
      registeredAgents: this.registeredAgents.size,
      activeTasks: Array.from(this.taskRegistry.values())
        .filter(task => ['assigned', 'in_progress'].includes(task.status)).length,
      totalTasks: this.taskRegistry.size,
      capabilities: Array.from(this.capabilities),
      uptime: process.uptime()
    };
  }

  /**
   * Cleanup inactive agents and tasks
   */
  async cleanup() {
    try {
      const now = new Date();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

      // Mark inactive agents
      for (const [agentId, agent] of this.registeredAgents) {
        if (now - agent.lastSeen > inactiveThreshold) {
          agent.status = 'inactive';
          logger.info(`⚠️ Marked agent ${agent.name} as inactive`);
        }
      }

      // Clean up old completed tasks
      const oldTasks = Array.from(this.taskRegistry.entries())
        .filter(([_, task]) => 
          task.status === 'completed' && 
          now - task.updatedAt > 24 * 60 * 60 * 1000 // 24 hours
        );

      for (const [taskId, task] of oldTasks) {
        this.taskRegistry.delete(taskId);
        logger.info(`🗑️ Cleaned up old task: ${task.name}`);
      }

      logger.info('✅ A2A service cleanup completed');
    } catch (error) {
      logger.error('❌ Failed to cleanup A2A service:', error);
    }
  }
}

module.exports = A2AService;