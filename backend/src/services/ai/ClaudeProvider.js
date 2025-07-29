const Anthropic = require('@anthropic-ai/sdk');
const BaseAIProvider = require('./BaseAIProvider');
const logger = require('../../utils/logger');

class ClaudeProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'anthropic';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.client = null;
    this.defaultModel = config.defaultModel || 'claude-3-sonnet-20240229';
    this.availableModels = config.availableModels || [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229', 
      'claude-3-haiku-20240307'
    ];
    this.maxTokens = config.maxTokens || 4096;
  }

  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('Anthropic API key is required');
      }

      this.client = new Anthropic({
        apiKey: this.apiKey
      });
      
      this.isInitialized = true;
      logger.info('Claude provider initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Claude provider:', error);
      throw error;
    }
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
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku'
    };
    return displayNames[modelId] || modelId;
  }

  getModelDescription(modelId) {
    const descriptions = {
      'claude-3-opus-20240229': 'Most capable Claude model for complex tasks',
      'claude-3-sonnet-20240229': 'Balanced Claude model for most use cases',
      'claude-3-haiku-20240307': 'Fastest Claude model for simple tasks'
    };
    return descriptions[modelId] || 'Anthropic Claude AI model';
  }

  getModelContextLength(modelId) {
    // All Claude 3 models support 200k context
    return 200000;
  }

  // Convert tools to Claude format
  convertToolsToClaudeFormat(tools) {
    if (!tools || tools.length === 0) return [];
    
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  async generateResponse(prompt, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const modelId = options.model || this.defaultModel;
      if (!this.validateModel(modelId)) {
        throw new Error(`Model ${modelId} is not available for Claude provider`);
      }

      const messages = [{ role: 'user', content: prompt }];
      const requestConfig = {
        model: modelId,
        max_tokens: options.maxTokens || this.maxTokens,
        messages: messages
      };

      // Add tools if provided
      if (options.tools && options.tools.length > 0) {
        requestConfig.tools = this.convertToolsToClaudeFormat(options.tools);
      }

      const response = await this.client.messages.create(requestConfig);
      
      let finalText = '';
      let toolResults = [];

      // Process response content
      for (const content of response.content) {
        if (content.type === 'text') {
          finalText += content.text;
        } else if (content.type === 'tool_use' && options.onToolCall) {
          logger.info(`Claude requested tool: ${content.name}`);
          
          const toolResult = await options.onToolCall({
            name: content.name,
            arguments: content.input
          });
          
          toolResults.push({
            name: content.name,
            arguments: content.input,
            result: toolResult
          });
        }
      }

      // If tools were used, generate follow-up response
      if (toolResults.length > 0) {
        const toolResultsText = toolResults.map(tr => 
          `Tool ${tr.name} result: ${JSON.stringify(tr.result)}`
        ).join('\n');

        const followUpMessages = [
          { role: 'user', content: prompt },
          { role: 'assistant', content: response.content },
          { role: 'user', content: `Tool results:\n${toolResultsText}\n\nBased on these results, provide a comprehensive response:` }
        ];

        const followUpResponse = await this.client.messages.create({
          model: modelId,
          max_tokens: options.maxTokens || this.maxTokens,
          messages: followUpMessages
        });

        finalText = followUpResponse.content[0]?.text || finalText;
      }

      logger.info(`Claude response generated using model: ${modelId}`);

      return this.formatResponse(finalText, modelId, {
        contextLength: options.contextLength || 0,
        toolsUsed: toolResults,
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0
        }
      });

    } catch (error) {
      logger.error("Error generating Claude response:", error);
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
        throw new Error(`Model ${modelId} is not available for Claude provider`);
      }

      const messages = [{ role: 'user', content: prompt }];
      const requestConfig = {
        model: modelId,
        max_tokens: options.maxTokens || this.maxTokens,
        messages: messages,
        stream: true
      };

      // Add tools if provided
      if (options.tools && options.tools.length > 0) {
        requestConfig.tools = this.convertToolsToClaudeFormat(options.tools);
      }

      const stream = await this.client.messages.create(requestConfig);
      
      let fullText = '';
      let chunkCount = 0;
      let usage = { inputTokens: 0, outputTokens: 0 };

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          const chunkText = chunk.delta.text;
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
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          usage.outputTokens = chunk.usage.output_tokens || 0;
        }
      }

      const finalResponse = this.formatResponse(fullText, modelId, {
        contextLength: options.contextLength || 0,
        chunkCount: chunkCount,
        usage: usage
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

      logger.info(`Claude streaming response completed: ${chunkCount} chunks, model: ${modelId}`);
      return finalResponse;

    } catch (error) {
      logger.error("Error generating Claude streaming response:", error);
      
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
      logger.error("Claude connection test failed:", error);
      return {
        success: false,
        error: error.message,
        availableModels: this.getAvailableModels(),
        provider: this.providerName
      };
    }
  }
}

module.exports = ClaudeProvider;