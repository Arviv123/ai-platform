const EventEmitter = require('events');
const GeminiProvider = require('./GeminiProvider');
const ClaudeProvider = require('./ClaudeProvider');
const OpenAIProvider = require('./OpenAIProvider');
const mcpService = require('../mcpService');
const memoryService = require('../memoryService');
const logger = require('../../utils/logger');

class MultiProviderAIService extends EventEmitter {
  constructor() {
    super();
    this.providers = new Map();
    this.defaultProvider = 'google'; // Default to Gemini
    this.providerInstances = {
      google: null,
      anthropic: null,
      openai: null
    };
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize Gemini provider (primary)
      if (process.env.GOOGLE_AI_API_KEY) {
        this.providerInstances.google = new GeminiProvider();
        await this.providerInstances.google.initialize();
        this.providers.set('google', this.providerInstances.google);
        logger.info('Gemini provider initialized');
      }

      // Initialize Claude provider (if API key available)
      if (process.env.ANTHROPIC_API_KEY) {
        this.providerInstances.anthropic = new ClaudeProvider();
        await this.providerInstances.anthropic.initialize();
        this.providers.set('anthropic', this.providerInstances.anthropic);
        logger.info('Claude provider initialized');
      }

      // Initialize OpenAI provider (if API key available)
      if (process.env.OPENAI_API_KEY) {
        this.providerInstances.openai = new OpenAIProvider();
        await this.providerInstances.openai.initialize();
        this.providers.set('openai', this.providerInstances.openai);
        logger.info('OpenAI provider initialized');
      }

      if (this.providers.size === 0) {
        throw new Error('No AI providers could be initialized. Please check your API keys.');
      }

      this.isInitialized = true;
      logger.info(`Multi-provider AI service initialized with ${this.providers.size} providers`);
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize Multi-provider AI service:', error);
      throw error;
    }
  }

  // Get provider from model ID
  getProviderFromModel(modelId) {
    // Determine provider based on model ID patterns
    if (modelId.startsWith('gemini') || modelId.includes('gemini')) {
      return this.providers.get('google');
    } else if (modelId.startsWith('claude') || modelId.includes('claude')) {
      return this.providers.get('anthropic');
    } else if (modelId.startsWith('gpt') || modelId.includes('gpt')) {
      return this.providers.get('openai');
    }
    
    // Default to primary provider
    return this.providers.get(this.defaultProvider) || Array.from(this.providers.values())[0];
  }

  // Get all available models from all providers
  getAvailableModels() {
    const allModels = [];
    
    for (const [providerName, provider] of this.providers) {
      const providerModels = provider.getAvailableModels();
      allModels.push(...providerModels);
    }

    // Sort by provider and mark defaults
    return allModels.sort((a, b) => {
      if (a.provider === this.defaultProvider && b.provider !== this.defaultProvider) return -1;
      if (b.provider === this.defaultProvider && a.provider !== this.defaultProvider) return 1;
      return a.provider.localeCompare(b.provider);
    });
  }

  // Get available MCP tools for function calling
  async getAvailableMCPTools(userId) {
    try {
      const servers = await mcpService.getUserServers(userId);
      const availableTools = [];

      for (const server of servers) {
        if (server.isRunning && server.healthStatus === 'HEALTHY') {
          availableTools.push({
            name: `mcp_${server.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_execute`,
            description: `Execute tools on ${server.name} MCP server: ${server.description || 'General purpose MCP server'}`,
            parameters: {
              type: "object",
              properties: {
                tool_name: {
                  type: "string",
                  description: "The name of the tool to execute"
                },
                parameters: {
                  type: "object",
                  description: "Parameters to pass to the tool"
                }
              },
              required: ["tool_name"]
            },
            serverId: server.id
          });
        }
      }

      logger.info(`Found ${availableTools.length} available MCP tools for user ${userId}`);
      return availableTools;
    } catch (error) {
      logger.error('Error getting available MCP tools:', error);
      return [];
    }
  }

  // Execute MCP tool function call
  async executeMCPTool(userId, toolCall) {
    try {
      const { name, arguments: args } = toolCall;
      
      // Extract server ID from tool name
      const serverMatch = name.match(/^mcp_(.+)_execute$/);
      if (!serverMatch) {
        throw new Error('Invalid MCP tool name format');
      }

      // Find the server ID
      const servers = await mcpService.getUserServers(userId);
      const targetServer = servers.find(s => 
        s.name.toLowerCase().replace(/[^a-z0-9]/g, '_') === serverMatch[1]
      );

      if (!targetServer) {
        throw new Error('MCP server not found or not accessible');
      }

      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
      const { tool_name, parameters = {} } = parsedArgs;

      logger.info(`Executing MCP tool: ${tool_name} on server ${targetServer.id}`);

      const result = await mcpService.executeTool(targetServer.id, tool_name, parameters);
      
      return {
        success: true,
        result: result.result,
        executionTime: result.executionTime || 0,
        serverId: targetServer.id,
        toolName: tool_name
      };
    } catch (error) {
      logger.error('Error executing MCP tool:', error);
      return {
        success: false,
        error: error.message,
        serverId: null,
        toolName: null
      };
    }
  }

  // Generate enhanced AI response with memory, context, and MCP tools
  async generateEnhancedAIResponse(prompt, conversationHistory = [], userId, sessionId = null, modelId = null, streaming = false, onChunk = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Get provider for the requested model
      const provider = modelId ? this.getProviderFromModel(modelId) : this.providers.get(this.defaultProvider);
      if (!provider) {
        throw new Error(`No provider available for model: ${modelId || 'default'}`);
      }

      // Use provider's default model if none specified
      const selectedModel = modelId || provider.defaultModel;

      // Get conversation context including long-term memory
      const conversationContext = sessionId 
        ? await memoryService.getConversationContext(sessionId, userId)
        : { summaries: [], memories: [], recentMessages: [], totalContext: 0 };

      // Get available MCP tools
      const availableTools = await this.getAvailableMCPTools(userId);
      
      // Build enhanced context with memory and summaries
      const enhancedPrompt = memoryService.buildEnhancedContext(conversationContext, prompt);

      // Set up options for provider
      const options = {
        model: selectedModel,
        contextLength: conversationHistory.length,
        tools: availableTools.length > 0 ? availableTools : undefined,
        onToolCall: availableTools.length > 0 ? (toolCall) => this.executeMCPTool(userId, toolCall) : undefined
      };

      logger.info(`Generating enhanced AI response with provider: ${provider.providerName}, model: ${selectedModel}, context: ${conversationContext.totalContext}, tools: ${availableTools.length}`);
      
      let response;
      if (streaming && onChunk) {
        response = await provider.generateStreamingResponse(enhancedPrompt, options, onChunk);
      } else {
        response = await provider.generateResponse(enhancedPrompt, options);
      }

      // Check if conversation needs summarization
      if (sessionId && await memoryService.shouldSummarizeConversation(sessionId)) {
        logger.info(`Creating summary for session ${sessionId}`);
        try {
          await memoryService.createConversationSummary(sessionId, userId, this);
        } catch (summaryError) {
          logger.error('Failed to create conversation summary:', summaryError);
        }
      }
      
      // Enhance response with additional metadata
      const enhancedResponse = {
        ...response,
        provider: provider.providerName,
        contextLength: conversationHistory.length,
        enhancedContext: conversationContext.totalContext,
        memoryItemsUsed: conversationContext.memories.length,
        summariesUsed: conversationContext.summaries.length,
        availableTools: availableTools.length,
        toolsUsed: response.toolsUsed || []
      };

      logger.info(`Enhanced AI response completed: provider=${provider.providerName}, model=${selectedModel}, tokens=${response.estimatedTokens}`);
      
      return enhancedResponse;
    } catch (error) {
      logger.error("Error generating enhanced AI response:", error);
      return {
        text: "מצטערים, חלה שגיאה בעת יצירת תגובה. נסו שוב מאוחר יותר.",
        error: error.message,
        provider: 'unknown',
        model: modelId || 'unknown',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Legacy method for backward compatibility
  async generateAIResponse(prompt, modelId = null) {
    const response = await this.generateEnhancedAIResponse(prompt, [], null, null, modelId, false);
    return {
      text: response.text,
      model: response.model,
      error: response.error,
      timestamp: response.timestamp
    };
  }

  // Test connection for all providers
  async testConnection() {
    const results = {};
    
    for (const [providerName, provider] of this.providers) {
      try {
        results[providerName] = await provider.testConnection();
      } catch (error) {
        results[providerName] = {
          success: false,
          error: error.message,
          provider: providerName
        };
      }
    }

    const overallSuccess = Object.values(results).some(result => result.success);
    
    return {
      success: overallSuccess,
      providers: results,
      availableModels: this.getAvailableModels(),
      activeProviders: Array.from(this.providers.keys())
    };
  }

  // Get service statistics
  getStats() {
    return {
      providersCount: this.providers.size,
      activeProviders: Array.from(this.providers.keys()),
      defaultProvider: this.defaultProvider,
      totalModels: this.getAvailableModels().length,
      isInitialized: this.isInitialized
    };
  }

  // Health check for all providers
  async healthCheck() {
    const health = {
      status: 'healthy',
      providers: {},
      timestamp: new Date().toISOString()
    };

    for (const [providerName, provider] of this.providers) {
      try {
        health.providers[providerName] = await provider.healthCheck();
      } catch (error) {
        health.providers[providerName] = {
          status: 'unhealthy',
          provider: providerName,
          error: error.message
        };
        health.status = 'degraded';
      }
    }

    const healthyProviders = Object.values(health.providers).filter(p => p.status === 'healthy').length;
    if (healthyProviders === 0) {
      health.status = 'unhealthy';
    }

    return health;
  }
}

module.exports = MultiProviderAIService;