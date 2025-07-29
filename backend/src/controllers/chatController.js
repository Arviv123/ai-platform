const { PrismaClient } = require('@prisma/client');
const AIService = require('../services/ai/AIService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const websocketService = require('../services/websocketService');

const prisma = new PrismaClient();
const aiService = new AIService();

// Get available AI models
const getModels = async (req, res) => {
  try {
    const models = aiService.getAvailableModels();
    res.json({
      status: 'success',
      data: {
        models,
        default: models.find(m => m.isDefault)?.id
      }
    });
  } catch (error) {
    logger.error('Error getting models:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get available models'
    });
  }
};

// Test AI connection
const testConnection = async (req, res) => {
  try {
    const result = await aiService.testConnection();
    res.json({
      status: result.success ? 'success' : 'error',
      data: result
    });
  } catch (error) {
    logger.error('Error testing AI connection:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test AI connection'
    });
  }
};

// Get user chat sessions
const getSessions = async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      include: {
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      status: 'success',
      data: sessions
    });
  } catch (error) {
    logger.error('Error getting chat sessions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get chat sessions'
    });
  }
};

// Get messages for a specific session
const getSessionMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.sub;

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found'
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      status: 'success',
      data: {
        session,
        messages
      }
    });
  } catch (error) {
    logger.error('Error getting session messages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get session messages'
    });
  }
};

// Create a new chat message and get AI response
const createMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sessionId, message, model } = req.body;
    const userId = req.user.sub;

    let session;

    // Create new session if not provided
    if (!sessionId) {
      session = await prisma.chatSession.create({
        data: {
          userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          model: model || aiService.defaultModel,
          messageCount: 0,
          totalTokens: 0
        }
      });
    } else {
      // Verify session belongs to user
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId }
      });

      if (!session) {
        return res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
      }
    }

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        tokens: Math.ceil(message.length / 4) // Rough token estimation
      }
    });

    // Get conversation history for context (last 20 messages for better context)
    const conversationHistory = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        tokens: true
      }
    });

    // Reverse to get chronological order (oldest first)
    conversationHistory.reverse();

    // Generate AI response with enhanced context, memory, and MCP tools
    const aiResponse = await aiService.generateEnhancedAIResponse(message, conversationHistory, userId, session.id, model);

    // Save AI message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: aiResponse.text,
        model: aiResponse.model,
        tokens: aiResponse.estimatedTokens || Math.ceil(aiResponse.text.length / 4),
        metadata: JSON.stringify({
          timestamp: aiResponse.timestamp,
          contextLength: aiResponse.contextLength,
          enhancedContext: aiResponse.enhancedContext || 0,
          memoryItemsUsed: aiResponse.memoryItemsUsed || 0,
          summariesUsed: aiResponse.summariesUsed || 0,
          toolsUsed: aiResponse.toolsUsed || [],
          availableTools: aiResponse.availableTools || 0,
          error: aiResponse.error
        })
      }
    });

    // Update session stats
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        messageCount: { increment: 2 },
        totalTokens: { increment: userMessage.tokens + assistantMessage.tokens },
        updatedAt: new Date()
      }
    });

    // Broadcast new message via WebSocket
    websocketService.sendNotification(userId, {
      type: 'chat_message',
      title: 'New Message',
      message: 'AI response received',
      data: {
        sessionId: session.id,
        userMessage,
        assistantMessage,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      status: 'success',
      data: {
        session,
        userMessage,
        assistantMessage,
        aiResponse
      }
    });

  } catch (error) {
    logger.error('Error creating message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create message'
    });
  }
};

// Stream AI response
const stream = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sessionId, message, model } = req.body;
    const userId = req.user.sub;

    let session;

    // Create new session if not provided
    if (!sessionId) {
      session = await prisma.chatSession.create({
        data: {
          userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          model: model || aiService.defaultModel,
          messageCount: 0,
          totalTokens: 0
        }
      });
    } else {
      // Verify session belongs to user
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId }
      });

      if (!session) {
        return res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
      }
    }

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        tokens: Math.ceil(message.length / 4)
      }
    });

    // Get conversation history for context
    const conversationHistory = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        tokens: true
      }
    });

    conversationHistory.reverse();

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    let assistantMessage = null;
    let fullResponse = '';

    // Streaming callback
    const onChunk = async (chunkData) => {
      try {
        // Send chunk to client
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          chunk: chunkData.chunk,
          fullText: chunkData.fullText,
          chunkIndex: chunkData.chunkIndex,
          isComplete: chunkData.isComplete,
          sessionId: session.id,
          userMessageId: userMessage.id
        })}\n\n`);

        if (chunkData.isComplete) {
          fullResponse = chunkData.fullText;
          
          // Save AI message to database
          assistantMessage = await prisma.chatMessage.create({
            data: {
              sessionId: session.id,
              role: 'assistant',
              content: fullResponse,
              model: chunkData.response?.model || model || aiService.defaultModel,
              tokens: chunkData.response?.estimatedTokens || Math.ceil(fullResponse.length / 4),
              metadata: JSON.stringify({
                timestamp: chunkData.response?.timestamp || new Date().toISOString(),
                contextLength: chunkData.response?.contextLength || 0,
                enhancedContext: chunkData.response?.enhancedContext || 0,
                memoryItemsUsed: chunkData.response?.memoryItemsUsed || 0,
                summariesUsed: chunkData.response?.summariesUsed || 0,
                toolsUsed: chunkData.response?.toolsUsed || [],
                chunkCount: chunkData.response?.chunkCount || 0,
                error: chunkData.error
              })
            }
          });

          // Update session stats
          await prisma.chatSession.update({
            where: { id: session.id },
            data: {
              messageCount: { increment: 2 },
              totalTokens: { increment: userMessage.tokens + assistantMessage.tokens },
              updatedAt: new Date()
            }
          });

          // Send completion data
          res.write(`data: ${JSON.stringify({
            type: 'complete',
            sessionId: session.id,
            userMessage,
            assistantMessage,
            response: chunkData.response
          })}\n\n`);

          // Broadcast via WebSocket
          websocketService.sendNotification(userId, {
            type: 'chat_message_stream_complete',
            title: 'Message Complete',
            message: 'AI response completed',
            data: {
              sessionId: session.id,
              userMessage,
              assistantMessage,
              timestamp: new Date().toISOString()
            }
          });

          res.end();
        }
      } catch (error) {
        logger.error('Error in streaming chunk callback:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`);
        res.end();
      }
    };

    // Generate streaming AI response with MCP tools support
    // Note: For now we'll use the regular MCP tools method in streaming,
    // full streaming with tools can be implemented in future iterations
    try {
      const aiResponse = await aiService.generateEnhancedAIResponse(
        message, 
        conversationHistory, 
        userId,
        session.id,
        model
      );

      // Simulate streaming by sending the complete response
      onChunk({
        chunk: aiResponse.text,
        fullText: aiResponse.text,
        chunkIndex: 1,
        isComplete: true,
        response: aiResponse
      });
    } catch (error) {
      logger.error('Error in MCP-enabled streaming:', error);
      // Fallback to regular streaming
      await aiService.generateStreamingAIResponseWithContext(
        message, 
        conversationHistory, 
        model, 
        onChunk
      );
    }

  } catch (error) {
    logger.error('Error in streaming endpoint:', error);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to stream response'
      });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    }
  }
};

// Get available Israeli planning tools
const getAvailableTools = async (req, res) => {
  try {
    const tools = aiService.getAvailablePlanningTools();
    
    res.json({
      status: 'success',
      data: {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          category: 'israeli-planning'
        })),
        count: tools.length
      }
    });
  } catch (error) {
    logger.error('Error getting available tools:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get available tools'
    });
  }
};

module.exports = {
  getModels,
  testConnection,
  getSessions,
  getSessionMessages,
  createMessage,
  stream,
  getAvailableTools
};
