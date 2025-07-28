const axios = require('axios');
const EventEmitter = require('events');

class AIService extends EventEmitter {
  constructor() {
    super();
    this.providers = {
      anthropic: {
        baseURL: 'https://api.anthropic.com/v1',
        models: {
          'claude-3-opus': 'claude-3-opus-20240229',
          'claude-3-sonnet': 'claude-3-sonnet-20240229',
          'claude-3-haiku': 'claude-3-haiku-20240307'
        }
      },
      openai: {
        baseURL: 'https://api.openai.com/v1',
        models: {
          'gpt-4-turbo': 'gpt-4-turbo-preview',
          'gpt-4': 'gpt-4',
          'gpt-3.5-turbo': 'gpt-3.5-turbo'
        }
      },
      google: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        models: {
          'gemini-pro': 'gemini-pro',
          'gemini-pro-vision': 'gemini-pro-vision'
        }
      }
    };
    
    this.defaultSettings = {
      temperature: 0.7,
      maxTokens: 2000,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0
    };
  }

  async generateResponse(options) {
    const {
      model,
      messages,
      stream = false,
      settings = {},
      tools = [],
      userId,
      sessionId
    } = options;

    try {
      const provider = this.getProviderForModel(model);
      const finalSettings = { ...this.defaultSettings, ...settings };

      // Log the request for monitoring
      this.emit('request', {
        userId,
        sessionId,
        model,
        provider,
        messageCount: messages.length,
        timestamp: new Date()
      });

      let response;
      switch (provider) {
        case 'anthropic':
          response = await this.callAnthropic(model, messages, finalSettings, stream, tools);
          break;
        case 'openai':
          response = await this.callOpenAI(model, messages, finalSettings, stream, tools);
          break;
        case 'google':
          response = await this.callGoogle(model, messages, finalSettings, stream, tools);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Log the response for monitoring
      this.emit('response', {
        userId,
        sessionId,
        model,
        provider,
        tokensUsed: response.usage?.totalTokens || 0,
        timestamp: new Date()
      });

      return response;
    } catch (error) {
      this.emit('error', {
        userId,
        sessionId,
        model,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async callAnthropic(model, messages, settings, stream, tools) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const modelName = this.providers.anthropic.models[model];
    if (!modelName) {
      throw new Error(`Invalid Anthropic model: ${model}`);
    }

    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessagesToAnthropic(messages);
    
    const payload = {
      model: modelName,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      messages: anthropicMessages.messages,
      stream
    };

    // Add system message if exists
    if (anthropicMessages.system) {
      payload.system = anthropicMessages.system;
    }

    // Add tools if provided
    if (tools && tools.length > 0) {
      payload.tools = this.convertToolsToAnthropic(tools);
    }

    const response = await axios.post(
      `${this.providers.anthropic.baseURL}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        responseType: stream ? 'stream' : 'json'
      }
    );

    if (stream) {
      return this.handleAnthropicStream(response);
    } else {
      return this.parseAnthropicResponse(response.data);
    }
  }

  async callOpenAI(model, messages, settings, stream, tools) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const modelName = this.providers.openai.models[model];
    if (!modelName) {
      throw new Error(`Invalid OpenAI model: ${model}`);
    }

    const payload = {
      model: modelName,
      messages: this.convertMessagesToOpenAI(messages),
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      top_p: settings.topP,
      frequency_penalty: settings.frequencyPenalty,
      presence_penalty: settings.presencePenalty,
      stream
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      payload.tools = this.convertToolsToOpenAI(tools);
      payload.tool_choice = 'auto';
    }

    const response = await axios.post(
      `${this.providers.openai.baseURL}/chat/completions`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: stream ? 'stream' : 'json'
      }
    );

    if (stream) {
      return this.handleOpenAIStream(response);
    } else {
      return this.parseOpenAIResponse(response.data);
    }
  }

  async callGoogle(model, messages, settings, stream, tools) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not configured');
    }

    const modelName = this.providers.google.models[model];
    if (!modelName) {
      throw new Error(`Invalid Google model: ${model}`);
    }

    // Convert messages to Gemini format
    const geminiMessages = this.convertMessagesToGemini(messages);
    
    const payload = {
      contents: geminiMessages,
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        topP: settings.topP
      }
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      payload.tools = this.convertToolsToGemini(tools);
    }

    const endpoint = stream 
      ? `${this.providers.google.baseURL}/models/${modelName}:streamGenerateContent?key=${apiKey}`
      : `${this.providers.google.baseURL}/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      return this.handleGoogleStream(response);
    } else {
      return this.parseGoogleResponse(response.data);
    }
  }

  convertMessagesToAnthropic(messages) {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const system = systemMessages.length > 0 
      ? systemMessages.map(m => m.content).join('\n') 
      : null;

    return {
      system,
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    };
  }

  convertMessagesToOpenAI(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  convertMessagesToGemini(messages) {
    return messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
  }

  convertToolsToAnthropic(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  convertToolsToOpenAI(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  convertToolsToGemini(tools) {
    return [{
      function_declarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }];
  }

  parseAnthropicResponse(data) {
    return {
      content: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model,
      tools: data.content.filter(c => c.type === 'tool_use').map(c => ({
        name: c.name,
        input: c.input,
        id: c.id
      }))
    };
  }

  parseOpenAIResponse(data) {
    const choice = data.choices[0];
    return {
      content: choice.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      tools: choice.message?.tool_calls?.map(call => ({
        name: call.function.name,
        input: JSON.parse(call.function.arguments),
        id: call.id
      })) || []
    };
  }

  parseGoogleResponse(data) {
    const candidate = data.candidates[0];
    const content = candidate.content?.parts[0]?.text || '';
    
    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: data.model,
      tools: candidate.content?.parts
        ?.filter(part => part.functionCall)
        ?.map(part => ({
          name: part.functionCall.name,
          input: part.functionCall.args,
          id: Math.random().toString(36)
        })) || []
    };
  }

  async handleAnthropicStream(response) {
    // Return stream handler for Anthropic
    return {
      stream: response.data,
      type: 'anthropic'
    };
  }

  async handleOpenAIStream(response) {
    // Return stream handler for OpenAI
    return {
      stream: response.data,
      type: 'openai'
    };
  }

  async handleGoogleStream(response) {
    // Return stream handler for Google
    return {
      stream: response.data,
      type: 'google'
    };
  }

  getProviderForModel(model) {
    for (const [provider, config] of Object.entries(this.providers)) {
      if (config.models[model]) {
        return provider;
      }
    }
    throw new Error(`Unknown model: ${model}`);
  }

  async getAvailableModels() {
    const models = [];
    
    for (const [provider, config] of Object.entries(this.providers)) {
      for (const [key, value] of Object.entries(config.models)) {
        models.push({
          id: key,
          name: this.getModelDisplayName(key),
          provider,
          available: await this.checkModelAvailability(provider, key)
        });
      }
    }
    
    return models;
  }

  getModelDisplayName(modelId) {
    const displayNames = {
      'claude-3-opus': 'Claude 3 Opus',
      'claude-3-sonnet': 'Claude 3 Sonnet',
      'claude-3-haiku': 'Claude 3 Haiku',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gemini-pro': 'Gemini Pro',
      'gemini-pro-vision': 'Gemini Pro Vision'
    };
    
    return displayNames[modelId] || modelId;
  }

  async checkModelAvailability(provider, model) {
    try {
      // Simple check - verify API keys are present
      switch (provider) {
        case 'anthropic':
          return !!process.env.ANTHROPIC_API_KEY;
        case 'openai':
          return !!process.env.OPENAI_API_KEY;
        case 'google':
          return !!process.env.GOOGLE_API_KEY;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  // Context management for long conversations
  async manageContext(messages, maxTokens = 100000) {
    // Simple context management - keep recent messages within token limit
    let totalTokens = 0;
    const keptMessages = [];
    
    // Always keep system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    keptMessages.push(...systemMessages);
    
    // Estimate tokens for system messages (rough estimate: 4 chars = 1 token)
    totalTokens += systemMessages.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    
    // Add recent messages from the end until we hit the limit
    const conversationMessages = messages.filter(m => m.role !== 'system').reverse();
    
    for (const message of conversationMessages) {
      const messageTokens = Math.ceil(message.content.length / 4);
      if (totalTokens + messageTokens > maxTokens) {
        break;
      }
      keptMessages.unshift(message);
      totalTokens += messageTokens;
    }
    
    return keptMessages;
  }
}

module.exports = AIService;