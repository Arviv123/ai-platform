const { GoogleGenerativeAI } = require("@google/generative-ai");
const BaseAIProvider = require('./BaseAIProvider');
const logger = require('../../utils/logger');

class GeminiProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'google';
    this.primaryKey = config.apiKey || process.env.GOOGLE_AI_API_KEY;
    this.backupKeys = config.backupKeys || 
      (process.env.GOOGLE_AI_API_KEY_BACKUP ? 
        process.env.GOOGLE_AI_API_KEY_BACKUP.split(',').map(key => key.trim()) : []);
    this.currentKeyIndex = 0;
    this.allKeys = [this.primaryKey, ...this.backupKeys];
    this.genAI = null;
    this.defaultModel = config.defaultModel || 'gemini-1.5-flash';
    this.availableModels = config.availableModels || ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
  }

  async initialize() {
    try {
      if (!this.primaryKey) {
        throw new Error('Google AI API key is required');
      }

      this.genAI = new GoogleGenerativeAI(this.primaryKey);
      this.isInitialized = true;
      
      logger.info('Gemini provider initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Gemini provider:', error);
      throw error;
    }
  }

  async rotateToNextKey() {
    if (this.currentKeyIndex < this.allKeys.length - 1) {
      this.currentKeyIndex++;
      const newKey = this.allKeys[this.currentKeyIndex];
      this.genAI = new GoogleGenerativeAI(newKey);
      logger.info(`Rotated to backup Gemini API key #${this.currentKeyIndex}`);
      return true;
    }
    return false;
  }

  getAvailableModels() {
    return this.availableModels.map(modelId => ({
      id: modelId,
      name: this.getModelDisplayName(modelId),
      provider: this.providerName,
      description: this.getModelDescription(modelId),
      contextLength: this.getModelContextLength(modelId),
      supportsTools: true,
      supportsStreaming: true,
      isDefault: modelId === this.defaultModel
    }));
  }

  getModelDisplayName(modelId) {
    const displayNames = {
      'gemini-2.0-flash': 'Gemini 2.0 Flash (Latest)',
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-pro': 'Gemini Pro (Legacy)'
    };
    return displayNames[modelId] || modelId;
  }

  getModelDescription(modelId) {
    const descriptions = {
      'gemini-2.0-flash': 'Latest and fastest Gemini model with advanced capabilities',
      'gemini-1.5-pro': 'Most capable Gemini model for complex tasks',
      'gemini-1.5-flash': 'Fast and efficient model for most tasks',
      'gemini-pro': 'Legacy Gemini model'
    };
    return descriptions[modelId] || 'Google Gemini AI model';
  }

  getModelContextLength(modelId) {
    const contextLengths = {
      'gemini-2.0-flash': 1000000,
      'gemini-1.5-pro': 2000000,
      'gemini-1.5-flash': 1000000,
      'gemini-pro': 32000
    };
    return contextLengths[modelId] || 32000;
  }

  async generateResponse(prompt, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const modelId = options.model || this.defaultModel;
      if (!this.validateModel(modelId)) {
        throw new Error(`Model ${modelId} is not available for Gemini provider`);
      }

      const modelConfig = { model: modelId };
      if (options.tools && options.tools.length > 0) {
        modelConfig.tools = [{ functionDeclarations: options.tools }];
      }

      const model = this.genAI.getGenerativeModel(modelConfig);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      let finalText = response.text();
      let toolResults = [];

      // Handle function calls if present
      const functionCalls = response.functionCalls ? response.functionCalls() : null;
      if (functionCalls && functionCalls.length > 0 && options.onToolCall) {
        logger.info(`Gemini requested ${functionCalls.length} function calls`);
        
        for (const call of functionCalls) {
          const toolResult = await options.onToolCall(call);
          toolResults.push({
            name: call.name,
            arguments: call.arguments,
            result: toolResult
          });
        }

        // Generate follow-up response with tool results
        if (toolResults.length > 0) {
          const toolResultsText = toolResults.map(tr => 
            `Tool ${tr.name} result: ${JSON.stringify(tr.result)}`
          ).join('\n');

          const followUpPrompt = `${prompt}\n\nTool execution results:\n${toolResultsText}\n\nBased on these results, provide a comprehensive response:`;
          
          const followUpResult = await model.generateContent(followUpPrompt);
          const followUpResponse = await followUpResult.response;
          finalText = followUpResponse.text();
        }
      }

      logger.info(`Gemini response generated using model: ${modelId}, key index: ${this.currentKeyIndex}`);

      return this.formatResponse(finalText, modelId, {
        contextLength: options.contextLength || 0,
        toolsUsed: toolResults,
        keyIndex: this.currentKeyIndex
      });

    } catch (error) {
      logger.error("Error generating Gemini response:", error);
      
      // Try rotating key on rate limit errors
      if ((error.message.includes('overloaded') || error.message.includes('503')) && 
          options.retryCount < this.allKeys.length - 1 && this.rotateToNextKey()) {
        logger.info(`Retrying Gemini with backup key, attempt ${(options.retryCount || 0) + 1}`);
        return this.generateResponse(prompt, { ...options, retryCount: (options.retryCount || 0) + 1 });
      }
      
      return this.handleError(error, 'generateResponse');
    }
  }

  async generateStreamingResponse(prompt, options = {}, onChunk = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const modelId = options.model || this.defaultModel;
      if (!this.validateModel(modelId)) {
        throw new Error(`Model ${modelId} is not available for Gemini provider`);
      }

      const model = this.genAI.getGenerativeModel({ model: modelId });
      const result = await model.generateContentStream(prompt);
      
      let fullText = '';
      let chunkCount = 0;

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        chunkCount++;
        
        if (onChunk && typeof onChunk === 'function') {
          onChunk({
            chunk: chunkText,
            fullText: fullText,
            chunkIndex: chunkCount,
            isComplete: false,
            provider: this.providerName,
            model: modelId
          });
        }
      }

      const finalResponse = this.formatResponse(fullText, modelId, {
        contextLength: options.contextLength || 0,
        chunkCount: chunkCount,
        keyIndex: this.currentKeyIndex
      });

      // Final chunk callback
      if (onChunk && typeof onChunk === 'function') {
        onChunk({
          chunk: '',
          fullText: fullText,
          chunkIndex: chunkCount,
          isComplete: true,
          response: finalResponse,
          provider: this.providerName,
          model: modelId
        });
      }

      logger.info(`Gemini streaming response completed: ${chunkCount} chunks, model: ${modelId}`);
      return finalResponse;

    } catch (error) {
      logger.error("Error generating Gemini streaming response:", error);
      
      // Try rotating key on rate limit errors
      if ((error.message.includes('overloaded') || error.message.includes('503')) && 
          options.retryCount < this.allKeys.length - 1 && this.rotateToNextKey()) {
        logger.info(`Retrying Gemini streaming with backup key, attempt ${(options.retryCount || 0) + 1}`);
        return this.generateStreamingResponse(prompt, { ...options, retryCount: (options.retryCount || 0) + 1 }, onChunk);
      }
      
      const errorResponse = this.handleError(error, 'generateStreamingResponse');
      
      // Error chunk callback
      if (onChunk && typeof onChunk === 'function') {
        onChunk({
          chunk: errorResponse.text,
          fullText: errorResponse.text,
          chunkIndex: 1,
          isComplete: true,
          error: error.message,
          response: errorResponse,
          provider: this.providerName
        });
      }

      return errorResponse;
    }
  }

  async testConnection() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const testResponse = await this.generateResponse("Hello, this is a connection test. Please respond with 'Connection successful'.");
      return {
        success: !testResponse.error,
        response: testResponse,
        availableModels: this.getAvailableModels(),
        provider: this.providerName
      };
    } catch (error) {
      logger.error("Gemini connection test failed:", error);
      return {
        success: false,
        error: error.message,
        availableModels: this.getAvailableModels(),
        provider: this.providerName
      };
    }
  }
}

module.exports = GeminiProvider;