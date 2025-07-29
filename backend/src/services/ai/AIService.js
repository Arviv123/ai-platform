
const MultiProviderAIService = require('./MultiProviderAIService');
const logger = require("../../utils/logger");

const EventEmitter = require('events');

// Wrapper class to maintain backward compatibility
class AIService extends EventEmitter {
  constructor() {
    super();
    this.multiProvider = new MultiProviderAIService();
    this.defaultModel = process.env.DEFAULT_AI_MODEL || 'gemini-1.5-flash';
  }

  async initialize() {
    return await this.multiProvider.initialize();
  }

  // Delegate methods to MultiProviderAIService
  async generateEnhancedAIResponse(prompt, conversationHistory = [], userId, sessionId = null, modelName = null, retryCount = 0) {
    return await this.multiProvider.generateEnhancedAIResponse(prompt, conversationHistory, userId, sessionId, modelName, false);
  }

  async generateStreamingAIResponseWithContext(prompt, conversationHistory = [], modelName = null, onChunk = null, retryCount = 0) {
    // Convert to new format - use enhanced response with streaming
    const userId = null; // Legacy method doesn't have userId
    const sessionId = null; // Legacy method doesn't have sessionId
    return await this.multiProvider.generateEnhancedAIResponse(prompt, conversationHistory, userId, sessionId, modelName, true, onChunk);
  }

  async generateAIResponseWithContext(prompt, conversationHistory = [], modelName = null, retryCount = 0) {
    return await this.multiProvider.generateEnhancedAIResponse(prompt, conversationHistory, null, null, modelName, false);
  }

  async generateAIResponseWithMCPTools(prompt, conversationHistory = [], userId, modelName = null, retryCount = 0) {
    return await this.multiProvider.generateEnhancedAIResponse(prompt, conversationHistory, userId, null, modelName, false);
  }

  async getAvailableMCPTools(userId) {
    return await this.multiProvider.getAvailableMCPTools(userId);
  }

  // Keep the original method for backward compatibility
  async generateAIResponse(prompt, modelName = null, retryCount = 0) {
    return await this.multiProvider.generateAIResponse(prompt, modelName);
  }

  getAvailableModels() {
    return this.multiProvider.getAvailableModels();
  }

  async testConnection() {
    return await this.multiProvider.testConnection();
  }
}

module.exports = AIService;
