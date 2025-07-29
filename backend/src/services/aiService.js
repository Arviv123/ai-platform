const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const mcpService = require('./mcpService');
const IsraeliPlanningService = require('./israeliPlanningService');

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Israeli Planning Service
const israeliPlanningService = new IsraeliPlanningService();

// Google AI will be added later

// Model configurations
const modelConfigs = {
  'claude-3-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    costPerToken: 0.000015, // $15 per 1M tokens
    contextWindow: 200000
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    costPerToken: 0.00000025, // $0.25 per 1M tokens
    contextWindow: 200000
  },
  'gpt-4': {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    costPerToken: 0.00001, // $10 per 1M tokens
    contextWindow: 128000
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 4096,
    costPerToken: 0.0000005, // $0.5 per 1M tokens
    contextWindow: 16384
  },
};

// Calculate credits needed for a request
const calculateCredits = (model, inputTokens, outputTokens = 0) => {
  const config = modelConfigs[model];
  if (!config) {
    throw new AppError(`Unknown model: ${model}`, 400);
  }

  const totalTokens = inputTokens + outputTokens;
  const cost = totalTokens * config.costPerToken;
  
  // Convert to credits (1 credit = $0.001)
  return Math.ceil(cost * 1000);
};

// Count tokens (approximation)
const countTokens = (text) => {
  if (typeof text !== 'string') return 0;
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
};

// Format messages for different providers
const formatMessages = (messages, provider) => {
  switch (provider) {
    case 'anthropic':
      return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    
    case 'openai':
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    
    
    default:
      return messages;
  }
};

// Generate chat completion
const generateChatCompletion = async (model, messages, options = {}) => {
  const config = modelConfigs[model];
  if (!config) {
    throw new AppError(`Model ${model} not supported`, 400);
  }

  const startTime = Date.now();
  let response;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    // Calculate input tokens
    const messagesText = messages.map(m => m.content).join(' ');
    inputTokens = countTokens(messagesText);

    // Check if we have enough context window
    if (inputTokens > config.contextWindow * 0.9) {
      throw new AppError('Message too long for model context window', 400);
    }

    const formattedMessages = formatMessages(messages, config.provider);

    switch (config.provider) {
      case 'anthropic':
        response = await generateAnthropicCompletion(config, formattedMessages, options);
        break;
      
      case 'openai':
        response = await generateOpenAICompletion(config, formattedMessages, options);
        break;
      
      
      default:
        throw new AppError(`Provider ${config.provider} not implemented`, 500);
    }

    outputTokens = countTokens(response.content);
    const credits = calculateCredits(model, inputTokens, outputTokens);

    const duration = Date.now() - startTime;
    
    logger.logPerformance('AI completion', duration, {
      model,
      inputTokens,
      outputTokens,
      credits
    });

    return {
      content: response.content,
      model: config.model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        credits
      },
      metadata: response.metadata || {}
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('AI completion failed', {
      model,
      duration,
      error: error.message,
      inputTokens
    });

    // Handle specific API errors
    if (error.response?.status === 429) {
      throw new AppError('AI service rate limit exceeded. Please try again later.', 429);
    }
    
    if (error.response?.status === 401) {
      throw new AppError('AI service authentication failed', 500);
    }

    if (error.response?.status === 400) {
      throw new AppError('Invalid request to AI service', 400);
    }

    throw new AppError('AI service temporarily unavailable', 503);
  }
};

// Anthropic (Claude) completion
const generateAnthropicCompletion = async (config, messages, options) => {
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');

  const params = {
    model: config.model,
    max_tokens: options.maxTokens || config.maxTokens,
    messages: userMessages,
    temperature: options.temperature || 0.7,
    top_p: options.topP || 0.9,
    top_k: options.topK || 40,
  };

  if (systemMessage) {
    params.system = systemMessage.content;
  }

  if (options.stopSequences) {
    params.stop_sequences = options.stopSequences;
  }

  const response = await anthropic.messages.create(params);
  
  return {
    content: response.content[0].text,
    metadata: {
      id: response.id,
      usage: response.usage,
      stopReason: response.stop_reason
    }
  };
};

// OpenAI completion
const generateOpenAICompletion = async (config, messages, options) => {
  const params = {
    model: config.model,
    messages,
    max_tokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature || 0.7,
    top_p: options.topP || 0.9,
    frequency_penalty: options.frequencyPenalty || 0,
    presence_penalty: options.presencePenalty || 0,
  };

  if (options.stopSequences) {
    params.stop = options.stopSequences;
  }

  const response = await openai.chat.completions.create(params);
  
  return {
    content: response.choices[0].message.content,
    metadata: {
      id: response.id,
      usage: response.usage,
      finishReason: response.choices[0].finish_reason
    }
  };
};


// Stream chat completion
const streamChatCompletion = async function* (model, messages, options = {}) {
  const config = modelConfigs[model];
  if (!config) {
    throw new AppError(`Model ${model} not supported`, 400);
  }

  const formattedMessages = formatMessages(messages, config.provider);

  try {
    switch (config.provider) {
      case 'anthropic':
        yield* streamAnthropicCompletion(config, formattedMessages, options);
        break;
      
      case 'openai':
        yield* streamOpenAICompletion(config, formattedMessages, options);
        break;
      
      default:
        throw new AppError(`Streaming not supported for ${config.provider}`, 400);
    }
  } catch (error) {
    logger.error('AI streaming failed', {
      model,
      error: error.message
    });
    throw error;
  }
};

// Anthropic streaming
const streamAnthropicCompletion = async function* (config, messages, options) {
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');

  const params = {
    model: config.model,
    max_tokens: options.maxTokens || config.maxTokens,
    messages: userMessages,
    temperature: options.temperature || 0.7,
    stream: true,
  };

  if (systemMessage) {
    params.system = systemMessage.content;
  }

  const stream = await anthropic.messages.create(params);
  
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      yield {
        type: 'content',
        content: chunk.delta.text,
        done: false
      };
    } else if (chunk.type === 'message_stop') {
      yield {
        type: 'done',
        content: '',
        done: true,
        metadata: chunk
      };
    }
  }
};

// OpenAI streaming
const streamOpenAICompletion = async function* (config, messages, options) {
  const params = {
    model: config.model,
    messages,
    max_tokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature || 0.7,
    stream: true,
  };

  const stream = await openai.chat.completions.create(params);
  
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    
    if (delta?.content) {
      yield {
        type: 'content',
        content: delta.content,
        done: false
      };
    }
    
    if (chunk.choices[0]?.finish_reason) {
      yield {
        type: 'done',
        content: '',
        done: true,
        metadata: {
          finishReason: chunk.choices[0].finish_reason
        }
      };
    }
  }
};

// Get available models
const getAvailableModels = () => {
  return Object.keys(modelConfigs).map(key => ({
    id: key,
    name: key,
    provider: modelConfigs[key].provider,
    maxTokens: modelConfigs[key].maxTokens,
    contextWindow: modelConfigs[key].contextWindow,
    costPerToken: modelConfigs[key].costPerToken
  }));
};

// Validate model availability
const validateModel = (model) => {
  const config = modelConfigs[model];
  if (!config) {
    throw new AppError(`Model ${model} not supported`, 400);
  }

  // Check if API keys are configured
  switch (config.provider) {
    case 'anthropic':
      if (!process.env.CLAUDE_API_KEY) {
        throw new AppError('Claude API not configured', 500);
      }
      break;
    
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        throw new AppError('OpenAI API not configured', 500);
      }
      break;
    
  }

  return config;
};

// Get available Israeli planning tools
const getAvailablePlanningTools = () => {
  try {
    return israeliPlanningService.getAvailableTools();
  } catch (error) {
    logger.error('Error getting planning tools:', error);
    return [];
  }
};

// Execute Israeli planning tool
const executePlanningTool = async (toolName, parameters) => {
  try {
    logger.info(`Executing planning tool: ${toolName} with parameters:`, parameters);
    
    const result = await israeliPlanningService.executeTool(toolName, parameters);
    
    return {
      success: true,
      content: result,
      data: result
    };
  } catch (error) {
    logger.error(`Error executing planning tool ${toolName}:`, error);
    return {
      success: false,
      error: error.message,
      content: `שגיאה בהפעלת הכלי ${toolName}: ${error.message}`
    };
  }
};

// Enhanced chat completion with Israeli planning tools
const generateChatCompletionWithTools = async (model, messages, userId, options = {}) => {
  try {
    // Get available planning tools
    const availableTools = getAvailablePlanningTools();
    
    if (availableTools.length === 0) {
      // No planning tools available, use regular completion
      return await generateChatCompletion(model, messages, options);
    }

    // Check if the user's message is related to Israeli planning
    const lastMessage = messages[messages.length - 1];
    const planningKeywords = ['תכנית', 'בנייה', 'מיקום', 'תכנון', 'ייעוד', 'מינהל התכנון', 'קואורדינטות', 'מחוז', 'עיר', 'דונם', 'מגורים', 'מסחר', 'תעשיה'];
    const isPlanningRelated = planningKeywords.some(keyword => 
      lastMessage.content.includes(keyword)
    );

    if (!isPlanningRelated) {
      // Not planning related, use regular completion
      return await generateChatCompletion(model, messages, options);
    }

    // Add system message about available tools
    const toolsDescription = availableTools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    const systemMessage = {
      role: 'system',
      content: `אתה עוזר AI עם גישה לכלים של מינהל התכנון הישראלי. הכלים הזמינים הם:

${toolsDescription}

כשהמשתמש שואל על תכניות, בנייה, או מיקומים בישראל, תוכל להשתמש בכלים האלה.
עבור שימוש בכלים, ענה בפורמט JSON כזה:
{
  "tool_call": {
    "tool_name": "שם_הכלי",
    "parameters": {
      "parameter1": "value1",
      "parameter2": "value2"
    }
  }
}

לאחר קבלת התוצאות, סכם אותן באברית בצורה ברורה ומועילה למשתמש.`
    };

    // Add system message to the beginning
    const messagesWithSystem = [systemMessage, ...messages];
    
    // Generate completion
    const completion = await generateChatCompletion(model, messagesWithSystem, options);
    
    // Check if the response contains a tool call
    let content = completion.content;
    
    try {
      // Try to parse tool call from response
      const toolCallMatch = content.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
      if (toolCallMatch) {
        const toolCallData = JSON.parse(toolCallMatch[0]);
        const toolCall = toolCallData.tool_call;
        
        if (toolCall && toolCall.tool_name && toolCall.parameters) {
          // Validate the tool exists
          const tool = availableTools.find(t => t.name === toolCall.tool_name);
          
          if (tool) {
            logger.info(`Executing planning tool: ${toolCall.tool_name} with parameters:`, toolCall.parameters);
            
            // Execute the planning tool
            const toolResult = await executePlanningTool(
              toolCall.tool_name,
              toolCall.parameters
            );
            
            // Generate a follow-up response with the tool results
            const followUpMessages = [
              systemMessage,
              ...messages,
              {
                role: 'assistant',
                content: `אני מפעיל את הכלי ${toolCall.tool_name}...`
              },
              {
                role: 'user',
                content: `תוצאות הכלי ${toolCall.tool_name}:\n\n${toolResult.content}\n\nאנא סכם את התוצאות בצורה ברורה ומועילה באברית.`
              }
            ];
            
            const finalCompletion = await generateChatCompletion(model, followUpMessages, options);
            
            return {
              ...finalCompletion,
              toolUsed: {
                name: toolCall.tool_name,
                parameters: toolCall.parameters,
                result: toolResult
              }
            };
          }
        }
      }
    } catch (parseError) {
      // If parsing fails, return original completion
      logger.warn('Failed to parse tool call from response:', parseError);
    }
    
    return completion;
    
  } catch (error) {
    logger.error('Error in generateChatCompletionWithTools:', error);
    // Fallback to regular completion
    return await generateChatCompletion(model, messages, options);
  }
};

module.exports = {
  generateChatCompletion,
  generateChatCompletionWithTools,
  streamChatCompletion,
  calculateCredits,
  countTokens,
  getAvailableModels,
  validateModel,
  getAvailablePlanningTools,
  executePlanningTool,
  modelConfigs
};