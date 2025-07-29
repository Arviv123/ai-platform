const OpenAI = require('openai');
const BaseAIProvider = require('./BaseAIProvider');
const logger = require('../../utils/logger');

class OpenAIProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config);
    this.providerName = 'openai';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.client = null;
    this.defaultModel = config.defaultModel || 'gpt-3.5-turbo';
    this.availableModels = config.availableModels || [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
    this.maxTokens = config.maxTokens || 4096;
  }

  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key is required');
      }

      this.client = new OpenAI({
        apiKey: this.apiKey
      });
      
      this.isInitialized = true;
      logger.info('OpenAI provider initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize OpenAI provider:', error);
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
      supportsTools: this.modelSupportsTools(modelId),
      supportsStreaming: true,
      isDefault: modelId === this.defaultModel
    }));
  }

  getModelDisplayName(modelId) {
    const displayNames = {
      'gpt-4-turbo-preview': 'GPT-4 Turbo (Preview)',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K'
    };
    return displayNames[modelId] || modelId;
  }

  getModelDescription(modelId) {
    const descriptions = {
      'gpt-4-turbo-preview': 'Latest GPT-4 model with improved performance',
      'gpt-4': 'Most capable GPT model for complex tasks',
      'gpt-3.5-turbo': 'Fast and efficient model for most tasks',
      'gpt-3.5-turbo-16k': 'GPT-3.5 with extended context length'
    };
    return descriptions[modelId] || 'OpenAI GPT model';
  }

  getModelContextLength(modelId) {
    const contextLengths = {
      'gpt-4-turbo-preview': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384
    };
    return contextLengths[modelId] || 4096;
  }

  modelSupportsTools(modelId) {
    const toolSupportModels = ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'];
    return toolSupportModels.includes(modelId);
  }

  // Convert tools to OpenAI format
  convertToolsToOpenAIFormat(tools) {
    if (!tools || tools.length === 0) return [];
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  async generateResponse(prompt, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const modelId = options.model || this.defaultModel;
      if (!this.validateModel(modelId)) {
        throw new Error(`Model ${modelId} is not available for OpenAI provider`);
      }

      const messages = [{ role: 'user', content: prompt }];
      const requestConfig = {
        model: modelId,
        messages: messages,
        max_tokens: options.maxTokens || this.maxTokens
      };

      // Add tools if provided and model supports them
      if (options.tools && options.tools.length > 0 && this.modelSupportsTools(modelId)) {
        requestConfig.tools = this.convertToolsToOpenAIFormat(options.tools);
        requestConfig.tool_choice = 'auto';
      }

      const response = await this.client.chat.completions.create(requestConfig);
      
      let finalText = response.choices[0]?.message?.content || '';
      let toolResults = [];

      // Handle tool calls if present
      const toolCalls = response.choices[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0 && options.onToolCall) {
        logger.info(`OpenAI requested ${toolCalls.length} tool calls`);
        
        for (const toolCall of toolCalls) {
          const functionCall = toolCall.function;
          const toolResult = await options.onToolCall({
            name: functionCall.name,
            arguments: JSON.parse(functionCall.arguments)
          });
          
          toolResults.push({
            name: functionCall.name,
            arguments: JSON.parse(functionCall.arguments),
            result: toolResult
          });
        }

        // Generate follow-up response with tool results
        if (toolResults.length > 0) {
          const toolResultsText = toolResults.map(tr => 
            `Tool ${tr.name} result: ${JSON.stringify(tr.result)}`
          ).join('\n');

          const followUpMessages = [
            { role: 'user', content: prompt },
            response.choices[0].message,
            { role: 'user', content: `Tool results:\n${toolResultsText}\n\nBased on these results, provide a comprehensive response:` }
          ];

          const followUpResponse = await this.client.chat.completions.create({
            model: modelId,
            messages: followUpMessages,
            max_tokens: options.maxTokens || this.maxTokens
          });

          finalText = followUpResponse.choices[0]?.message?.content || finalText;
        }
      }

      logger.info(`OpenAI response generated using model: ${modelId}`);

      return this.formatResponse(finalText, modelId, {
        contextLength: options.contextLength || 0,
        toolsUsed: toolResults,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      });

    } catch (error) {
      logger.error("Error generating OpenAI response:", error);
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
        throw new Error(`Model ${modelId} is not available for OpenAI provider`);
      }

      const messages = [{ role: 'user', content: prompt }];
      const requestConfig = {
        model: modelId,
        messages: messages,
        max_tokens: options.maxTokens || this.maxTokens,
        stream: true
      };

      // Add tools if provided and model supports them
      if (options.tools && options.tools.length > 0 && this.modelSupportsTools(modelId)) {
        requestConfig.tools = this.convertToolsToOpenAIFormat(options.tools);
        requestConfig.tool_choice = 'auto';
      }

      const stream = await this.client.chat.completions.create(requestConfig);
      
      let fullText = '';
      let chunkCount = 0;
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          const chunkText = delta.content;
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
        
        // Handle usage info (usually in the last chunk)
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0
          };
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

      logger.info(`OpenAI streaming response completed: ${chunkCount} chunks, model: ${modelId}`);
      return finalResponse;

    } catch (error) {
      logger.error("Error generating OpenAI streaming response:", error);
      
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
      logger.error("OpenAI connection test failed:", error);
      return {
        success: false,
        error: error.message,
        availableModels: this.getAvailableModels(),
        provider: this.providerName
      };
    }
  }
}

module.exports = OpenAIProvider;