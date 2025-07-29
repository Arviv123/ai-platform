const EventEmitter = require('events');

class BaseAIProvider extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.providerName = 'base';
    this.isInitialized = false;
  }

  // Abstract methods that must be implemented by each provider
  async initialize() {
    throw new Error('initialize() must be implemented by provider');
  }

  async generateResponse(prompt, options = {}) {
    throw new Error('generateResponse() must be implemented by provider');
  }

  async generateStreamingResponse(prompt, options = {}, onChunk = null) {
    throw new Error('generateStreamingResponse() must be implemented by provider');
  }

  getAvailableModels() {
    throw new Error('getAvailableModels() must be implemented by provider');
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented by provider');
  }

  // Common utility methods
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // Basic estimation
  }

  validateModel(modelId) {
    const availableModels = this.getAvailableModels();
    return availableModels.some(model => model.id === modelId);
  }

  async rotateToNextKey() {
    // Default implementation - can be overridden
    return false;
  }

  // Common response formatting
  formatResponse(text, model, metadata = {}) {
    return {
      text,
      model,
      provider: this.providerName,
      estimatedTokens: this.estimateTokens(text),
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  // Error handling
  handleError(error, context = '') {
    const errorMessage = `${this.providerName} Provider Error${context ? ` (${context})` : ''}: ${error.message}`;
    this.emit('error', { error, context, provider: this.providerName });
    return {
      text: "מצטערים, חלה שגיאה בעת יצירת תגובה. נסו שוב מאוחר יותר.",
      error: errorMessage,
      provider: this.providerName,
      timestamp: new Date().toISOString()
    };
  }

  // Health check
  async healthCheck() {
    try {
      await this.testConnection();
      return { status: 'healthy', provider: this.providerName };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        provider: this.providerName, 
        error: error.message 
      };
    }
  }
}

module.exports = BaseAIProvider;