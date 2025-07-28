const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class LoadBalancerService {
  constructor() {
    this.models = new Map();
    this.strategies = {
      ROUND_ROBIN: 'round_robin',
      LEAST_CONNECTIONS: 'least_connections',
      WEIGHTED_ROUND_ROBIN: 'weighted_round_robin',
      RESPONSE_TIME: 'response_time',
      HEALTH_BASED: 'health_based',
      SMART: 'smart'
    };
    
    this.currentStrategy = this.strategies.SMART;
    this.healthCheckInterval = 30000; // 30 seconds
    this.maxRetries = 3;
    
    this.initializeModels();
    this.startHealthChecks();
  }

  // Initialize AI models with their configurations
  initializeModels() {
    const modelConfigs = [
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        maxTokens: 4096,
        costPerToken: 0.003,
        weight: 3,
        priority: 1,
        features: ['chat', 'analysis', 'coding'],
        limits: {
          requestsPerMinute: 50,
          tokensPerMinute: 40000,
          concurrentRequests: 10
        }
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        maxTokens: 4096,
        costPerToken: 0.001,
        weight: 5,
        priority: 2,
        features: ['chat', 'quick-tasks'],
        limits: {
          requestsPerMinute: 100,
          tokensPerMinute: 100000,
          concurrentRequests: 20
        }
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        maxTokens: 8192,
        costPerToken: 0.03,
        weight: 2,
        priority: 1,
        features: ['chat', 'analysis', 'coding', 'creative'],
        limits: {
          requestsPerMinute: 40,
          tokensPerMinute: 40000,
          concurrentRequests: 8
        }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        maxTokens: 4096,
        costPerToken: 0.002,
        weight: 4,
        priority: 3,
        features: ['chat', 'quick-tasks'],
        limits: {
          requestsPerMinute: 200,
          tokensPerMinute: 200000,
          concurrentRequests: 30
        }
      }
    ];

    modelConfigs.forEach(config => {
      this.models.set(config.id, {
        ...config,
        status: 'healthy',
        currentConnections: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastHealthCheck: null,
        lastRequestTime: null,
        currentLoad: 0,
        roundRobinIndex: 0
      });
    });

    logger.info(`Initialized ${this.models.size} AI models for load balancing`);
  }

  // Get the best model for a request based on the current strategy
  async selectModel(options = {}) {
    const {
      requiredFeatures = [],
      maxTokens = null,
      maxCost = null,
      preferredProvider = null,
      userTier = 'free'
    } = options;

    // Filter available models
    let availableModels = this.getHealthyModels();

    // Apply filters
    if (requiredFeatures.length > 0) {
      availableModels = availableModels.filter(model =>
        requiredFeatures.every(feature => model.features.includes(feature))
      );
    }

    if (maxTokens) {
      availableModels = availableModels.filter(model => model.maxTokens >= maxTokens);
    }

    if (maxCost) {
      availableModels = availableModels.filter(model => model.costPerToken <= maxCost);
    }

    if (preferredProvider) {
      const preferredModels = availableModels.filter(model => model.provider === preferredProvider);
      if (preferredModels.length > 0) {
        availableModels = preferredModels;
      }
    }

    // Apply user tier restrictions
    availableModels = this.applyUserTierFilters(availableModels, userTier);

    if (availableModels.length === 0) {
      throw new Error('No suitable AI models available');
    }

    // Select model based on strategy
    const selectedModel = await this.applySelectionStrategy(availableModels);
    
    // Update model state
    selectedModel.currentConnections++;
    selectedModel.totalRequests++;
    selectedModel.lastRequestTime = Date.now();

    logger.debug(`Selected model: ${selectedModel.id} using strategy: ${this.currentStrategy}`);
    
    return selectedModel;
  }

  // Apply user tier filters
  applyUserTierFilters(models, userTier) {
    const tierLimits = {
      free: ['claude-3-haiku', 'gpt-3.5-turbo'],
      basic: ['claude-3-haiku', 'gpt-3.5-turbo', 'claude-3-sonnet'],
      premium: ['claude-3-haiku', 'gpt-3.5-turbo', 'claude-3-sonnet', 'gpt-4'],
      enterprise: null // No restrictions
    };

    const allowedModels = tierLimits[userTier];
    if (!allowedModels) return models; // No restrictions

    return models.filter(model => allowedModels.includes(model.id));
  }

  // Apply selection strategy
  async applySelectionStrategy(models) {
    switch (this.currentStrategy) {
      case this.strategies.ROUND_ROBIN:
        return this.roundRobinSelection(models);
      
      case this.strategies.LEAST_CONNECTIONS:
        return this.leastConnectionsSelection(models);
      
      case this.strategies.WEIGHTED_ROUND_ROBIN:
        return this.weightedRoundRobinSelection(models);
      
      case this.strategies.RESPONSE_TIME:
        return this.responseTimeSelection(models);
      
      case this.strategies.HEALTH_BASED:
        return this.healthBasedSelection(models);
      
      case this.strategies.SMART:
        return this.smartSelection(models);
      
      default:
        return models[0]; // Fallback to first model
    }
  }

  // Round robin selection
  roundRobinSelection(models) {
    models.sort((a, b) => a.id.localeCompare(b.id)); // Ensure consistent order
    
    let minIndex = Infinity;
    let selectedModel = models[0];
    
    models.forEach(model => {
      if (model.roundRobinIndex < minIndex) {
        minIndex = model.roundRobinIndex;
        selectedModel = model;
      }
    });
    
    selectedModel.roundRobinIndex++;
    return selectedModel;
  }

  // Least connections selection
  leastConnectionsSelection(models) {
    return models.reduce((min, model) => 
      model.currentConnections < min.currentConnections ? model : min
    );
  }

  // Weighted round robin selection
  weightedRoundRobinSelection(models) {
    const totalWeight = models.reduce((sum, model) => sum + model.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const model of models) {
      currentWeight += model.weight;
      if (random <= currentWeight) {
        return model;
      }
    }
    
    return models[0]; // Fallback
  }

  // Response time based selection
  responseTimeSelection(models) {
    return models.reduce((fastest, model) => 
      model.averageResponseTime < fastest.averageResponseTime ? model : fastest
    );
  }

  // Health based selection
  healthBasedSelection(models) {
    // Calculate health score for each model
    const modelsWithScore = models.map(model => ({
      ...model,
      healthScore: this.calculateHealthScore(model)
    }));
    
    return modelsWithScore.reduce((best, model) => 
      model.healthScore > best.healthScore ? model : best
    );
  }

  // Smart selection (combines multiple factors)
  smartSelection(models) {
    const modelsWithScore = models.map(model => {
      const healthScore = this.calculateHealthScore(model);
      const loadScore = this.calculateLoadScore(model);
      const costScore = this.calculateCostScore(model);
      const performanceScore = this.calculatePerformanceScore(model);
      
      // Weighted composite score
      const compositeScore = 
        (healthScore * 0.3) +
        (loadScore * 0.25) +
        (performanceScore * 0.25) +
        (costScore * 0.2);
      
      return {
        ...model,
        compositeScore
      };
    });
    
    return modelsWithScore.reduce((best, model) => 
      model.compositeScore > best.compositeScore ? model : best
    );
  }

  // Calculate health score (0-100)
  calculateHealthScore(model) {
    if (model.status !== 'healthy') return 0;
    
    const successRate = model.totalRequests > 0 ? 
      (model.successfulRequests / model.totalRequests) * 100 : 100;
    
    const timeSinceLastCheck = Date.now() - (model.lastHealthCheck || 0);
    const healthFreshness = Math.max(0, 100 - (timeSinceLastCheck / 60000)); // Decay over 1 minute
    
    return Math.min(100, (successRate * 0.7) + (healthFreshness * 0.3));
  }

  // Calculate load score (0-100, higher is better)
  calculateLoadScore(model) {
    const connectionRatio = model.currentConnections / model.limits.concurrentRequests;
    return Math.max(0, 100 - (connectionRatio * 100));
  }

  // Calculate cost score (0-100, lower cost is better)
  calculateCostScore(model) {
    const maxCost = Math.max(...Array.from(this.models.values()).map(m => m.costPerToken));
    return 100 - ((model.costPerToken / maxCost) * 100);
  }

  // Calculate performance score (0-100)
  calculatePerformanceScore(model) {
    if (model.averageResponseTime === 0) return 100;
    
    const maxResponseTime = 10000; // 10 seconds
    const performanceScore = Math.max(0, 100 - ((model.averageResponseTime / maxResponseTime) * 100));
    
    return performanceScore;
  }

  // Get healthy models
  getHealthyModels() {
    return Array.from(this.models.values()).filter(model => 
      model.status === 'healthy' && 
      model.currentConnections < model.limits.concurrentRequests
    );
  }

  // Record request completion
  recordRequestComplete(modelId, responseTime, success = true) {
    const model = this.models.get(modelId);
    if (!model) return;

    model.currentConnections = Math.max(0, model.currentConnections - 1);
    
    if (success) {
      model.successfulRequests++;
    } else {
      model.failedRequests++;
    }

    // Update average response time
    const totalRequests = model.successfulRequests + model.failedRequests;
    model.averageResponseTime = 
      (model.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Update current load
    this.updateModelLoad(model);
  }

  // Update model load metrics
  updateModelLoad(model) {
    const connectionLoad = model.currentConnections / model.limits.concurrentRequests;
    const requestRate = this.calculateRequestRate(model);
    const errorRate = model.totalRequests > 0 ? 
      (model.failedRequests / model.totalRequests) : 0;

    model.currentLoad = Math.min(100, 
      (connectionLoad * 40) + 
      (requestRate * 40) + 
      (errorRate * 20)
    );
  }

  // Calculate request rate
  calculateRequestRate(model) {
    // This would typically use a sliding window
    // For simplicity, we'll use a basic calculation
    const timeWindow = 60000; // 1 minute
    const recentRequests = model.totalRequests; // Simplified
    
    return Math.min(1, recentRequests / model.limits.requestsPerMinute);
  }

  // Health check for models
  async performHealthCheck(model) {
    try {
      const startTime = Date.now();
      
      // Simple health check - could be expanded to actual API calls
      const isHealthy = await this.checkModelHealth(model);
      
      const responseTime = Date.now() - startTime;
      
      model.lastHealthCheck = Date.now();
      model.status = isHealthy ? 'healthy' : 'unhealthy';
      
      if (isHealthy) {
        // Update average response time for health checks
        if (model.averageResponseTime === 0) {
          model.averageResponseTime = responseTime;
        } else {
          model.averageResponseTime = 
            (model.averageResponseTime * 0.9) + (responseTime * 0.1);
        }
      }

      return isHealthy;
      
    } catch (error) {
      logger.error(`Health check failed for model ${model.id}:`, error);
      model.status = 'unhealthy';
      model.lastHealthCheck = Date.now();
      return false;
    }
  }

  // Check individual model health
  async checkModelHealth(model) {
    // Check if API key is available
    const apiKeyEnvVar = model.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    if (!process.env[apiKeyEnvVar]) {
      return false;
    }

    // Check rate limits
    const rateLimitKey = `rate_limit:${model.id}`;
    const currentRequests = await cacheService.get(rateLimitKey) || 0;
    
    if (currentRequests >= model.limits.requestsPerMinute) {
      return false;
    }

    // Check error rate
    const errorRate = model.totalRequests > 0 ? 
      (model.failedRequests / model.totalRequests) : 0;
    
    if (errorRate > 0.1) { // 10% error rate threshold
      return false;
    }

    return true;
  }

  // Start health checks
  startHealthChecks() {
    setInterval(async () => {
      const models = Array.from(this.models.values());
      
      for (const model of models) {
        await this.performHealthCheck(model);
      }
      
      logger.debug('Health checks completed for all models');
    }, this.healthCheckInterval);
  }

  // Get load balancer statistics
  getStats() {
    const models = Array.from(this.models.values());
    
    return {
      strategy: this.currentStrategy,
      totalModels: models.length,
      healthyModels: models.filter(m => m.status === 'healthy').length,
      totalRequests: models.reduce((sum, m) => sum + m.totalRequests, 0),
      totalConnections: models.reduce((sum, m) => sum + m.currentConnections, 0),
      averageResponseTime: models.reduce((sum, m) => sum + m.averageResponseTime, 0) / models.length,
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        status: model.status,
        currentConnections: model.currentConnections,
        totalRequests: model.totalRequests,
        successRate: model.totalRequests > 0 ? 
          ((model.successfulRequests / model.totalRequests) * 100).toFixed(2) : '100.00',
        averageResponseTime: model.averageResponseTime.toFixed(0),
        currentLoad: model.currentLoad.toFixed(1),
        healthScore: this.calculateHealthScore(model).toFixed(1)
      }))
    };
  }

  // Change load balancing strategy
  setStrategy(strategy) {
    if (Object.values(this.strategies).includes(strategy)) {
      this.currentStrategy = strategy;
      logger.info(`Load balancing strategy changed to: ${strategy}`);
      return true;
    }
    return false;
  }

  // Get available strategies
  getStrategies() {
    return Object.values(this.strategies);
  }

  // Reset model statistics
  resetModelStats(modelId = null) {
    const modelsToReset = modelId ? [this.models.get(modelId)] : Array.from(this.models.values());
    
    modelsToReset.forEach(model => {
      if (model) {
        model.totalRequests = 0;
        model.successfulRequests = 0;
        model.failedRequests = 0;
        model.averageResponseTime = 0;
        model.roundRobinIndex = 0;
        model.currentLoad = 0;
      }
    });
    
    logger.info(`Reset statistics for ${modelsToReset.length} models`);
  }
}

// Create singleton instance
const loadBalancerService = new LoadBalancerService();

module.exports = loadBalancerService;