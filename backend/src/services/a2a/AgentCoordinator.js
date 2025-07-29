/**
 * Agent Coordinator - Multi-Agent Task Management
 * Orchestrates collaboration between multiple AI agents using A2A protocol
 */

const logger = require('../../utils/logger');
const A2AService = require('./A2AService');
const AIService = require('../ai/AIService');

class AgentCoordinator {
  constructor() {
    this.a2aService = new A2AService();
    this.aiService = new AIService();
    this.coordinationStrategies = new Map();
    this.activeCoordinations = new Map();
    
    this.setupDefaultStrategies();
  }

  /**
   * Initialize the coordinator
   */
  async initialize() {
    try {
      await this.a2aService.initialize();
      await this.aiService.initialize();
      
      logger.info('✅ Agent Coordinator initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Agent Coordinator:', error);
      throw error;
    }
  }

  /**
   * Setup default coordination strategies
   */
  setupDefaultStrategies() {
    // Sequential strategy - agents work one after another
    this.coordinationStrategies.set('sequential', {
      name: 'Sequential Execution',
      description: 'Agents execute tasks sequentially, passing results to the next agent',
      execute: this.executeSequential.bind(this)
    });

    // Parallel strategy - agents work simultaneously
    this.coordinationStrategies.set('parallel', {
      name: 'Parallel Execution', 
      description: 'Agents execute tasks in parallel and results are combined',
      execute: this.executeParallel.bind(this)
    });

    // Hierarchical strategy - coordinator delegates to specialized agents
    this.coordinationStrategies.set('hierarchical', {
      name: 'Hierarchical Delegation',
      description: 'Master agent coordinates and delegates to specialized sub-agents',
      execute: this.executeHierarchical.bind(this)
    });

    // Collaborative strategy - agents discuss and collaborate
    this.coordinationStrategies.set('collaborative', {
      name: 'Collaborative Discussion',
      description: 'Agents engage in discussion to solve complex problems together',
      execute: this.executeCollaborative.bind(this)
    });

    logger.info(`📋 Loaded ${this.coordinationStrategies.size} coordination strategies`);
  }

  /**
   * Coordinate multi-agent task execution
   */
  async coordinateTask(taskDefinition, strategy = 'auto') {
    try {
      const coordinationId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create task in A2A system
      const task = await this.a2aService.createTask({
        ...taskDefinition,
        coordinationId
      });

      // Determine optimal strategy if auto
      if (strategy === 'auto') {
        strategy = this.determineOptimalStrategy(taskDefinition);
      }

      const coordination = {
        id: coordinationId,
        taskId: task.id,
        strategy: strategy,
        status: 'initializing',
        startTime: new Date(),
        phases: [],
        results: [],
        agents: [],
        context: taskDefinition.context || {}
      };

      this.activeCoordinations.set(coordinationId, coordination);

      // Assign agents to task
      await this.a2aService.assignAgentsToTask(task.id, taskDefinition.agents);
      
      // Execute coordination strategy
      const executionStrategy = this.coordinationStrategies.get(strategy);
      if (!executionStrategy) {
        throw new Error(`Unknown coordination strategy: ${strategy}`);
      }

      logger.info(`🎯 Starting coordination ${coordinationId} with strategy: ${strategy}`);
      
      coordination.status = 'executing';
      const result = await executionStrategy.execute(coordination, task);
      
      coordination.status = 'completed';
      coordination.endTime = new Date();
      coordination.duration = coordination.endTime - coordination.startTime;
      coordination.finalResult = result;

      logger.info(`✅ Coordination ${coordinationId} completed in ${coordination.duration}ms`);
      
      return {
        coordinationId,
        result,
        duration: coordination.duration,
        strategy,
        agents: coordination.agents.length
      };

    } catch (error) {
      logger.error('❌ Failed to coordinate task:', error);
      throw error;
    }
  }

  /**
   * Determine optimal coordination strategy based on task characteristics
   */
  determineOptimalStrategy(taskDefinition) {
    const complexity = this.assessTaskComplexity(taskDefinition);
    const requiredCapabilities = taskDefinition.requiredCapabilities || [];
    
    // Simple tasks - use sequential
    if (complexity < 3 && requiredCapabilities.length <= 2) {
      return 'sequential';
    }

    // Independent parallel work
    if (taskDefinition.parallelizable === true) {
      return 'parallel';
    }

    // Complex analytical tasks - use collaborative
    if (requiredCapabilities.includes('analysis') || requiredCapabilities.includes('reasoning')) {
      return 'collaborative';
    }

    // Multi-domain tasks - use hierarchical
    if (requiredCapabilities.length > 3) {
      return 'hierarchical';
    }

    // Default to sequential
    return 'sequential';
  }

  /**
   * Assess task complexity (1-10 scale)
   */
  assessTaskComplexity(taskDefinition) {
    let complexity = 1;
    
    // Add complexity for each capability required
    complexity += (taskDefinition.requiredCapabilities || []).length;
    
    // Add complexity for context size
    const contextSize = JSON.stringify(taskDefinition.context || {}).length;
    complexity += Math.min(Math.floor(contextSize / 1000), 3);
    
    // Add complexity for sub-tasks
    if (taskDefinition.subtasks) {
      complexity += taskDefinition.subtasks.length;
    }
    
    // Add complexity for expected output complexity
    if (taskDefinition.expectedOutput) {
      if (taskDefinition.expectedOutput.includes('analysis')) complexity += 2;
      if (taskDefinition.expectedOutput.includes('code')) complexity += 2;
      if (taskDefinition.expectedOutput.includes('plan')) complexity += 1;
    }

    return Math.min(complexity, 10);
  }

  /**
   * Sequential execution strategy
   */
  async executeSequential(coordination, task) {
    try {
      const agents = task.assignedAgents;
      const results = [];
      let currentContext = task.context;

      coordination.phases.push({
        name: 'Sequential Execution',
        startTime: new Date(),
        agents: agents.map(a => a.id)
      });

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const phaseContext = {
          ...currentContext,
          previousResults: results,
          agentRole: agent.role,
          phaseNumber: i + 1,
          totalPhases: agents.length
        };

        logger.info(`🔄 Sequential phase ${i + 1}/${agents.length}: ${agent.name}`);

        const agentResult = await this.executeAgentTask(agent.id, {
          task: task.description,
          context: phaseContext,
          expectedOutput: task.expectedOutput
        });

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          phase: i + 1,
          result: agentResult,
          timestamp: new Date()
        });

        // Update context for next agent
        currentContext = {
          ...currentContext,
          [`phase${i + 1}Result`]: agentResult
        };
      }

      // Combine results
      const finalResult = await this.combineSequentialResults(results, task);
      
      coordination.phases[0].endTime = new Date();
      coordination.results = results;

      return finalResult;
    } catch (error) {
      logger.error('❌ Sequential execution failed:', error);
      throw error;
    }
  }

  /**
   * Parallel execution strategy
   */
  async executeParallel(coordination, task) {
    try {
      const agents = task.assignedAgents;
      
      coordination.phases.push({
        name: 'Parallel Execution',
        startTime: new Date(),
        agents: agents.map(a => a.id)
      });

      logger.info(`🔄 Parallel execution with ${agents.length} agents`);

      // Execute all agents in parallel
      const agentPromises = agents.map(agent => 
        this.executeAgentTask(agent.id, {
          task: task.description,
          context: {
            ...task.context,
            agentRole: agent.role,
            parallelExecution: true
          },
          expectedOutput: task.expectedOutput
        }).then(result => ({
          agentId: agent.id,
          agentName: agent.name,
          result,
          timestamp: new Date()
        }))
      );

      const results = await Promise.all(agentPromises);

      // Combine parallel results
      const finalResult = await this.combineParallelResults(results, task);

      coordination.phases[0].endTime = new Date();
      coordination.results = results;

      return finalResult;
    } catch (error) {
      logger.error('❌ Parallel execution failed:', error);
      throw error;
    }
  }

  /**
   * Hierarchical execution strategy
   */
  async executeHierarchical(coordination, task) {
    try {
      const agents = task.assignedAgents;
      const coordinator = agents.find(a => a.role === 'coordinator') || agents[0];
      const workers = agents.filter(a => a.id !== coordinator.id);

      coordination.phases.push({
        name: 'Hierarchical Planning',
        startTime: new Date(),
        coordinator: coordinator.id,
        workers: workers.map(w => w.id)
      });

      logger.info(`🔄 Hierarchical execution: coordinator ${coordinator.name}, ${workers.length} workers`);

      // Phase 1: Coordinator creates execution plan
      const planResult = await this.executeAgentTask(coordinator.id, {
        task: `Create an execution plan for: ${task.description}`,
        context: {
          ...task.context,
          role: 'coordinator',
          availableWorkers: workers.map(w => ({
            id: w.id,
            name: w.name,
            capabilities: this.a2aService.registeredAgents.get(w.id)?.capabilities || []
          }))
        },
        expectedOutput: 'execution plan with task assignments'
      });

      coordination.phases[0].planResult = planResult;
      coordination.phases[0].endTime = new Date();

      // Phase 2: Workers execute assigned tasks
      coordination.phases.push({
        name: 'Worker Execution',
        startTime: new Date(),
        workers: workers.map(w => w.id)
      });

      const workerPromises = workers.map(worker => 
        this.executeAgentTask(worker.id, {
          task: this.extractWorkerTask(planResult.text, worker.name),
          context: {
            ...task.context,
            role: 'worker',
            coordinatorPlan: planResult.text,
            workerSpecialty: worker.role
          },
          expectedOutput: task.expectedOutput
        }).then(result => ({
          agentId: worker.id,
          agentName: worker.name,
          result,
          timestamp: new Date()
        }))
      );

      const workerResults = await Promise.all(workerPromises);
      coordination.phases[1].endTime = new Date();

      // Phase 3: Coordinator synthesizes results
      coordination.phases.push({
        name: 'Result Synthesis',
        startTime: new Date(),
        coordinator: coordinator.id
      });

      const finalResult = await this.executeAgentTask(coordinator.id, {
        task: `Synthesize the following worker results into a final response for: ${task.description}`,
        context: {
          ...task.context,
          role: 'synthesizer',
          workerResults: workerResults.map(r => ({
            agent: r.agentName,
            result: r.result.text
          }))
        },
        expectedOutput: 'synthesized final result'
      });

      coordination.phases[2].endTime = new Date();
      coordination.results = [
        {
          agentId: coordinator.id,
          agentName: coordinator.name,
          phase: 'planning',
          result: planResult,
          timestamp: new Date()
        },
        ...workerResults.map(r => ({ ...r, phase: 'execution' })),
        {
          agentId: coordinator.id,
          agentName: coordinator.name,
          phase: 'synthesis',
          result: finalResult,
          timestamp: new Date()
        }
      ];

      return finalResult;
    } catch (error) {
      logger.error('❌ Hierarchical execution failed:', error);
      throw error;
    }
  }

  /**
   * Collaborative execution strategy
   */
  async executeCollaborative(coordination, task) {
    try {
      const agents = task.assignedAgents;
      const maxRounds = 3;
      const results = [];

      coordination.phases.push({
        name: 'Collaborative Discussion',
        startTime: new Date(),
        agents: agents.map(a => a.id),
        maxRounds
      });

      let discussionContext = {
        ...task.context,
        task: task.description,
        expectedOutput: task.expectedOutput,
        round: 0,
        discussion: []
      };

      logger.info(`🔄 Collaborative execution with ${agents.length} agents, ${maxRounds} rounds`);

      // Multi-round discussion
      for (let round = 1; round <= maxRounds; round++) {
        discussionContext.round = round;
        
        logger.info(`💭 Discussion round ${round}/${maxRounds}`);

        const roundResults = [];

        for (const agent of agents) {
          const agentResult = await this.executeAgentTask(agent.id, {
            task: round === 1 
              ? `Provide your initial analysis for: ${task.description}`
              : `Based on the previous discussion, provide your insights for: ${task.description}`,
            context: {
              ...discussionContext,
              agentRole: agent.role,
              isCollaborative: true
            },
            expectedOutput: round === maxRounds ? task.expectedOutput : 'analysis and insights'
          });

          roundResults.push({
            agentId: agent.id,
            agentName: agent.name,
            round,
            result: agentResult,
            timestamp: new Date()
          });

          // Add to discussion context for next agent
          discussionContext.discussion.push({
            agent: agent.name,
            round,
            content: agentResult.text
          });
        }

        results.push(...roundResults);

        // Check for convergence (simplified)
        if (round > 1 && this.checkDiscussionConvergence(roundResults)) {
          logger.info('💡 Discussion converged early');
          break;
        }
      }

      // Final synthesis by first agent (acting as moderator)
      const moderator = agents[0];
      const finalResult = await this.executeAgentTask(moderator.id, {
        task: `Based on the collaborative discussion, provide the final answer for: ${task.description}`,
        context: {
          ...discussionContext,
          role: 'moderator',
          fullDiscussion: discussionContext.discussion
        },
        expectedOutput: task.expectedOutput
      });

      results.push({
        agentId: moderator.id,
        agentName: moderator.name,
        phase: 'synthesis',
        result: finalResult,
        timestamp: new Date()
      });

      coordination.phases[0].endTime = new Date();
      coordination.results = results;

      return finalResult;
    } catch (error) {
      logger.error('❌ Collaborative execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute task with specific agent
   */
  async executeAgentTask(agentId, taskParams) {
    try {
      // Use the AI service to generate response
      const response = await this.aiService.generateResponse({
        prompt: this.formatAgentPrompt(agentId, taskParams),
        context: taskParams.context,
        model: 'gemini-1.5-flash'
      });

      return response;
    } catch (error) {
      logger.error(`❌ Failed to execute task with agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Format prompt for specific agent
   */
  formatAgentPrompt(agentId, taskParams) {
    const agent = this.a2aService.registeredAgents.get(agentId);
    if (!agent) {
      return taskParams.task;
    }

    let prompt = `As ${agent.name} (${agent.description}), please handle the following task:\n\n`;
    prompt += `Task: ${taskParams.task}\n\n`;
    
    if (taskParams.context && Object.keys(taskParams.context).length > 0) {
      prompt += `Context: ${JSON.stringify(taskParams.context, null, 2)}\n\n`;
    }
    
    if (taskParams.expectedOutput) {
      prompt += `Expected Output: ${taskParams.expectedOutput}\n\n`;
    }

    prompt += `Please provide a response that leverages your specialized capabilities: ${agent.capabilities.join(', ')}`;

    return prompt;
  }

  /**
   * Extract specific task for worker from coordinator's plan
   */
  extractWorkerTask(plan, workerName) {
    // Simple extraction - in production would use more sophisticated NLP
    const lines = plan.split('\n');
    const workerSection = lines.find(line => 
      line.toLowerCase().includes(workerName.toLowerCase())
    );
    
    return workerSection || `Handle your part of the overall task based on your specialization.`;
  }

  /**
   * Check if collaborative discussion has converged
   */
  checkDiscussionConvergence(roundResults) {
    // Simplified convergence check - could be more sophisticated
    if (roundResults.length < 2) return false;
    
    const responses = roundResults.map(r => r.result.text);
    const similarity = this.calculateTextSimilarity(responses[0], responses[1]);
    
    return similarity > 0.8; // 80% similarity threshold
  }

  /**
   * Simple text similarity calculation
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  /**
   * Combine sequential results
   */
  async combineSequentialResults(results, task) {
    const combinedText = results
      .map((r, i) => `Phase ${i + 1} (${r.agentName}): ${r.result.text}`)
      .join('\n\n');

    return {
      text: `Sequential execution completed:\n\n${combinedText}`,
      model: 'multi-agent-sequential',
      timestamp: new Date(),
      agents: results.map(r => r.agentName),
      strategy: 'sequential'
    };
  }

  /**
   * Combine parallel results
   */
  async combineParallelResults(results, task) {
    const combinedText = results
      .map(r => `${r.agentName}: ${r.result.text}`)
      .join('\n\n');

    return {
      text: `Parallel execution results:\n\n${combinedText}`,
      model: 'multi-agent-parallel',
      timestamp: new Date(),
      agents: results.map(r => r.agentName),
      strategy: 'parallel'
    };
  }

  /**
   * Get coordination status
   */
  getCoordinationStatus(coordinationId) {
    return this.activeCoordinations.get(coordinationId);
  }

  /**
   * Get all active coordinations
   */
  getActiveCoordinations() {
    return Array.from(this.activeCoordinations.values());
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Agent Coordinator',
      version: '1.0.0',
      status: 'active',
      strategies: Array.from(this.coordinationStrategies.keys()),
      activeCoordinations: this.activeCoordinations.size,
      a2aService: this.a2aService.getStatus()
    };
  }
}

module.exports = AgentCoordinator;