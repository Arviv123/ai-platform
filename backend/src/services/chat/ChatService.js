const { PrismaClient } = require('@prisma/client');
const AIService = require('../ai/AIService');
const mcpService = require('../mcpService');
const EventEmitter = require('events');

class ChatService extends EventEmitter {
  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.aiService = new AIService();
    this.mcpService = mcpService;
    
    // Listen to AI service events for monitoring
    this.aiService.on('request', (data) => this.emit('ai_request', data));
    this.aiService.on('response', (data) => this.emit('ai_response', data));
    this.aiService.on('error', (data) => this.emit('ai_error', data));
  }

  async createSession(userId, title = 'New Conversation', model = 'claude-3-sonnet') {
    try {
      const session = await this.prisma.chatSession.create({
        data: {
          userId,
          title,
          model,
          totalTokens: 0,
          messageCount: 0
        }
      });

      this.emit('session_created', { userId, sessionId: session.id, model });
      return session;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  async getSession(sessionId, userId) {
    try {
      const session = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!session) {
        throw new Error('Session not found');
      }

      return session;
    } catch (error) {
      console.error('Error getting chat session:', error);
      throw new Error('Failed to get chat session');
    }
  }

  async getUserSessions(userId, limit = 50, offset = 0) {
    try {
      const sessions = await this.prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw new Error('Failed to get user sessions');
    }
  }

  async sendMessage(sessionId, userId, content, model = null) {
    try {
      // Get or create session
      let session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      });

      if (!session) {
        // Create new session if not found
        session = await this.createSession(userId, 'New Conversation', model || 'claude-3-sonnet');
        session.messages = [];
      }

      // Create user message
      const userMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content,
          tokens: this.estimateTokens(content)
        }
      });

      // Prepare messages for AI
      const messages = [
        ...session.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content
        }
      ];

      // Get available tools from MCP servers
      const availableTools = await this.mcpService.getAvailableTools(userId);

      // Manage context to stay within limits
      const managedMessages = await this.aiService.manageContext(messages);

      // Generate AI response
      const aiResponse = await this.aiService.generateResponse({
        model: model || session.model,
        messages: managedMessages,
        stream: true,
        tools: availableTools,
        userId,
        sessionId: session.id
      });

      // Handle the response
      return this.handleAIResponse(session.id, aiResponse, userMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  async handleAIResponse(sessionId, aiResponse, userMessage) {
    if (aiResponse.stream) {
      // Handle streaming response
      return this.handleStreamingResponse(sessionId, aiResponse, userMessage);
    } else {
      // Handle non-streaming response
      return this.handleDirectResponse(sessionId, aiResponse, userMessage);
    }
  }

  async handleStreamingResponse(sessionId, aiResponse, userMessage) {
    // Create initial assistant message
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: '',
        tokens: 0,
        model: userMessage.model || 'claude-3-sonnet'
      }
    });

    // Return a readable stream that the client can consume
    const { Readable } = require('stream');
    const responseStream = new Readable({
      read() {}
    });

    let fullContent = '';
    let totalTokens = 0;
    let toolCalls = [];

    // Process the AI stream
    this.processAIStream(aiResponse, {
      onContent: (content) => {
        fullContent += content;
        responseStream.push(`data: ${JSON.stringify({ 
          type: 'content', 
          content, 
          messageId: assistantMessage.id 
        })}\n\n`);
      },
      onToolCall: (toolCall) => {
        toolCalls.push(toolCall);
        responseStream.push(`data: ${JSON.stringify({ 
          type: 'tool_call', 
          toolCall,
          messageId: assistantMessage.id 
        })}\n\n`);
      },
      onComplete: async (usage) => {
        totalTokens = usage.totalTokens || this.estimateTokens(fullContent);
        
        // Execute tool calls if any
        let toolResults = [];
        if (toolCalls.length > 0) {
          toolResults = await this.executeToolCalls(toolCalls, sessionId);
          
          // Add tool results to the response
          for (const result of toolResults) {
            responseStream.push(`data: ${JSON.stringify({ 
              type: 'tool_result', 
              result,
              messageId: assistantMessage.id 
            })}\n\n`);
          }
        }

        // Update the assistant message in database
        await this.prisma.chatMessage.update({
          where: { id: assistantMessage.id },
          data: {
            content: fullContent,
            tokens: totalTokens,
            metadata: {
              usage,
              toolCalls,
              toolResults
            }
          }
        });

        // Update session statistics
        await this.updateSessionStats(sessionId, userMessage.tokens + totalTokens);

        responseStream.push(`data: ${JSON.stringify({ 
          type: 'complete', 
          messageId: assistantMessage.id,
          tokens: totalTokens 
        })}\n\n`);
        
        responseStream.push(null); // End stream
      },
      onError: (error) => {
        console.error('AI stream error:', error);
        responseStream.push(`data: ${JSON.stringify({ 
          type: 'error', 
          error: error.message 
        })}\n\n`);
        responseStream.push(null);
      }
    });

    return {
      stream: responseStream,
      userMessage,
      assistantMessage
    };
  }

  async handleDirectResponse(sessionId, aiResponse, userMessage) {
    let toolResults = [];
    
    // Execute tool calls if any
    if (aiResponse.tools && aiResponse.tools.length > 0) {
      toolResults = await this.executeToolCalls(aiResponse.tools, sessionId);
    }

    // Create assistant message
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponse.content,
        tokens: aiResponse.usage.totalTokens,
        model: aiResponse.model,
        metadata: {
          usage: aiResponse.usage,
          toolCalls: aiResponse.tools,
          toolResults
        }
      }
    });

    // Update session statistics
    await this.updateSessionStats(sessionId, userMessage.tokens + aiResponse.usage.totalTokens);

    return {
      userMessage,
      assistantMessage,
      toolResults
    };
  }

  async processAIStream(aiResponse, callbacks) {
    const { stream, type } = aiResponse;
    
    try {
      if (type === 'anthropic') {
        await this.processAnthropicStream(stream, callbacks);
      } else if (type === 'openai') {
        await this.processOpenAIStream(stream, callbacks);
      } else if (type === 'google') {
        await this.processGoogleStream(stream, callbacks);
      }
    } catch (error) {
      callbacks.onError(error);
    }
  }

  async processAnthropicStream(stream, callbacks) {
    let buffer = '';
    
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'content_block_delta') {
              callbacks.onContent(data.delta.text);
            } else if (data.type === 'message_stop') {
              callbacks.onComplete(data.usage || {});
            } else if (data.type === 'tool_use') {
              callbacks.onToolCall({
                name: data.name,
                input: data.input,
                id: data.id
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    stream.on('end', () => {
      callbacks.onComplete({});
    });
    
    stream.on('error', callbacks.onError);
  }

  async processOpenAIStream(stream, callbacks) {
    let buffer = '';
    
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            callbacks.onComplete({});
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta;
            
            if (delta?.content) {
              callbacks.onContent(delta.content);
            } else if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                callbacks.onToolCall({
                  name: toolCall.function.name,
                  input: JSON.parse(toolCall.function.arguments),
                  id: toolCall.id
                });
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    stream.on('end', () => {
      callbacks.onComplete({});
    });
    
    stream.on('error', callbacks.onError);
  }

  async processGoogleStream(stream, callbacks) {
    let buffer = '';
    
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const candidate = data.candidates?.[0];
            const content = candidate?.content?.parts?.[0];
            
            if (content?.text) {
              callbacks.onContent(content.text);
            } else if (content?.functionCall) {
              callbacks.onToolCall({
                name: content.functionCall.name,
                input: content.functionCall.args,
                id: Math.random().toString(36)
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    stream.on('end', () => {
      callbacks.onComplete({});
    });
    
    stream.on('error', callbacks.onError);
  }

  async executeToolCalls(toolCalls, sessionId) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.mcpService.executeTool(
          toolCall.name,
          toolCall.input,
          sessionId
        );
        
        results.push({
          toolCallId: toolCall.id,
          name: toolCall.name,
          result,
          success: true
        });
        
        this.emit('tool_executed', {
          sessionId,
          toolName: toolCall.name,
          input: toolCall.input,
          result,
          success: true
        });
        
      } catch (error) {
        console.error(`Tool execution error for ${toolCall.name}:`, error);
        
        results.push({
          toolCallId: toolCall.id,
          name: toolCall.name,
          error: error.message,
          success: false
        });
        
        this.emit('tool_executed', {
          sessionId,
          toolName: toolCall.name,
          input: toolCall.input,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  async updateSessionStats(sessionId, additionalTokens) {
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        totalTokens: { increment: additionalTokens },
        messageCount: { increment: 2 }, // User + Assistant
        updatedAt: new Date()
      }
    });
  }

  async updateSessionTitle(sessionId, userId, title) {
    try {
      const session = await this.prisma.chatSession.updateMany({
        where: {
          id: sessionId,
          userId
        },
        data: { title }
      });

      return session;
    } catch (error) {
      console.error('Error updating session title:', error);
      throw new Error('Failed to update session title');
    }
  }

  async deleteSession(sessionId, userId) {
    try {
      // Delete all messages first
      await this.prisma.chatMessage.deleteMany({
        where: { sessionId }
      });

      // Delete the session
      const session = await this.prisma.chatSession.deleteMany({
        where: {
          id: sessionId,
          userId
        }
      });

      this.emit('session_deleted', { userId, sessionId });
      return session;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw new Error('Failed to delete session');
    }
  }

  estimateTokens(text) {
    // Rough estimation: 4 characters = 1 token
    return Math.ceil(text.length / 4);
  }

  async getUserUsageStats(userId, period = 'month') {
    try {
      const startDate = this.getStartDate(period);
      
      const stats = await this.prisma.chatMessage.aggregate({
        where: {
          session: { userId },
          createdAt: { gte: startDate }
        },
        _sum: { tokens: true },
        _count: { id: true }
      });

      const sessionCount = await this.prisma.chatSession.count({
        where: {
          userId,
          createdAt: { gte: startDate }
        }
      });

      return {
        totalTokens: stats._sum.tokens || 0,
        totalMessages: stats._count.id || 0,
        totalSessions: sessionCount,
        period
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw new Error('Failed to get usage stats');
    }
  }

  getStartDate(period) {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return weekStart;
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
}

module.exports = ChatService;