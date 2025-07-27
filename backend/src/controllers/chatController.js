const { prisma, withTransaction, dbUtils } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// Get user's chat sessions
const getSessions = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const { skip, take } = dbUtils.paginate(page, limit);

  const where = {
    userId: req.user.id,
    deletedAt: null,
    ...dbUtils.search(search, ['title'])
  };

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      select: {
        id: true,
        title: true,
        model: true,
        totalTokens: true,
        totalCost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take
    }),
    prisma.chatSession.count({ where })
  ]);

  res.json({
    status: 'success',
    data: {
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
};

// Create new chat session
const createSession = async (req, res) => {
  const { title, model, systemPrompt, contextData } = req.body;

  // Validate model
  aiService.validateModel(model);

  const session = await prisma.chatSession.create({
    data: {
      userId: req.user.id,
      title: title || `Chat ${new Date().toLocaleString()}`,
      model,
      systemPrompt,
      contextData
    },
    select: {
      id: true,
      title: true,
      model: true,
      systemPrompt: true,
      contextData: true,
      totalTokens: true,
      totalCost: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Log session creation
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'CHAT_SESSION_CREATED',
      entity: 'ChatSession',
      entityId: session.id,
      newData: { title, model },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  logger.info('Chat session created', {
    userId: req.user.id,
    sessionId: session.id,
    model
  });

  res.status(201).json({
    status: 'success',
    message: 'Chat session created successfully',
    data: { session }
  });
};

// Get specific chat session with messages
const getSession = async (req, res) => {
  const { sessionId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const { skip, take } = dbUtils.paginate(page, limit);

  // Get session
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId: req.user.id,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      model: true,
      systemPrompt: true,
      contextData: true,
      totalTokens: true,
      totalCost: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!session) {
    throw new AppError('Chat session not found', 404);
  }

  // Get messages
  const [messages, totalMessages] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId },
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        tokenCount: true,
        costCredits: true,
        mcpToolCalls: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take
    }),
    prisma.chatMessage.count({ where: { sessionId } })
  ]);

  res.json({
    status: 'success',
    data: {
      session,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit)
      }
    }
  });
};

// Update chat session
const updateSession = async (req, res) => {
  const { sessionId } = req.params;
  const { title, systemPrompt, contextData } = req.body;

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
  if (contextData !== undefined) updateData.contextData = contextData;

  const session = await prisma.chatSession.updateMany({
    where: {
      id: sessionId,
      userId: req.user.id,
      deletedAt: null
    },
    data: updateData
  });

  if (session.count === 0) {
    throw new AppError('Chat session not found', 404);
  }

  // Get updated session
  const updatedSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      model: true,
      systemPrompt: true,
      contextData: true,
      totalTokens: true,
      totalCost: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json({
    status: 'success',
    message: 'Chat session updated successfully',
    data: { session: updatedSession }
  });
};

// Delete chat session
const deleteSession = async (req, res) => {
  const { sessionId } = req.params;

  const result = await prisma.chatSession.updateMany({
    where: {
      id: sessionId,
      userId: req.user.id,
      deletedAt: null
    },
    data: {
      deletedAt: new Date(),
      isActive: false
    }
  });

  if (result.count === 0) {
    throw new AppError('Chat session not found', 404);
  }

  // Log session deletion
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'CHAT_SESSION_DELETED',
      entity: 'ChatSession',
      entityId: sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    status: 'success',
    message: 'Chat session deleted successfully'
  });
};

// Send message in chat session
const sendMessage = async (req, res) => {
  const { sessionId } = req.params;
  const { content, role = 'user', mcpToolCalls } = req.body;

  // Verify session ownership
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId: req.user.id,
      deletedAt: null,
      isActive: true
    }
  });

  if (!session) {
    throw new AppError('Chat session not found or inactive', 404);
  }

  // Get recent messages for context
  const recentMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    select: {
      role: true,
      content: true
    },
    orderBy: { createdAt: 'asc' },
    take: 20 // Last 20 messages for context
  });

  // Prepare messages for AI
  const messages = [];
  
  if (session.systemPrompt) {
    messages.push({
      role: 'system',
      content: session.systemPrompt
    });
  }

  messages.push(...recentMessages);
  messages.push({ role, content });

  // Estimate credits needed
  const inputTokens = aiService.countTokens(messages.map(m => m.content).join(' '));
  const estimatedCredits = aiService.calculateCredits(session.model, inputTokens, 1000); // Estimate max output

  // Check user credits
  if (req.user.credits < estimatedCredits) {
    throw new AppError('Insufficient credits', 402);
  }

  const startTime = Date.now();
  let userMessage, aiResponse, actualCredits = 0;

  try {
    // Save user message and generate AI response in transaction
    const result = await withTransaction(async (tx) => {
      // Save user message
      const userMessage = await tx.chatMessage.create({
        data: {
          sessionId,
          role,
          content,
          mcpToolCalls,
          tokenCount: aiService.countTokens(content),
          costCredits: 0 // User messages don't cost credits
        }
      });

      // Generate AI response
      const aiResult = await aiService.generateChatCompletion(
        session.model,
        messages,
        {
          maxTokens: 4096,
          temperature: 0.7
        }
      );

      actualCredits = aiResult.usage.credits;

      // Check credits again with actual usage
      if (req.user.credits < actualCredits) {
        throw new AppError('Insufficient credits for this response', 402);
      }

      // Save AI response
      const aiMessage = await tx.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: aiResult.content,
          metadata: aiResult.metadata,
          tokenCount: aiResult.usage.outputTokens,
          costCredits: actualCredits
        }
      });

      // Deduct credits from user
      await tx.user.update({
        where: { id: req.user.id },
        data: {
          credits: {
            decrement: actualCredits
          }
        }
      });

      // Create credit transaction
      await tx.creditTransaction.create({
        data: {
          userId: req.user.id,
          sessionId,
          type: 'USAGE',
          amount: -actualCredits,
          description: `Chat message - ${session.model}`
        }
      });

      // Update session totals
      await tx.chatSession.update({
        where: { id: sessionId },
        data: {
          totalTokens: {
            increment: aiResult.usage.totalTokens
          },
          totalCost: {
            increment: actualCredits
          },
          updatedAt: new Date()
        }
      });

      return { userMessage, aiMessage: aiMessage };
    });

    const duration = Date.now() - startTime;

    logger.logPerformance('Chat message processed', duration, {
      userId: req.user.id,
      sessionId,
      model: session.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      credits: actualCredits
    });

    res.json({
      status: 'success',
      data: {
        userMessage: result.userMessage,
        aiMessage: result.aiMessage,
        usage: {
          credits: actualCredits,
          remainingCredits: req.user.credits - actualCredits
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Chat message failed', {
      userId: req.user.id,
      sessionId,
      model: session.model,
      duration,
      error: error.message
    });

    throw error;
  }
};

// Stream message response
const streamMessage = async (req, res) => {
  const { sessionId } = req.params;
  const { content, role = 'user' } = req.body;

  // Verify session ownership
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId: req.user.id,
      deletedAt: null,
      isActive: true
    }
  });

  if (!session) {
    throw new AppError('Chat session not found or inactive', 404);
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // Get recent messages for context
    const recentMessages = await prisma.chatMessage.findMany({
      where: { sessionId },
      select: { role: true, content: true },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    const messages = [];
    if (session.systemPrompt) {
      messages.push({ role: 'system', content: session.systemPrompt });
    }
    messages.push(...recentMessages);
    messages.push({ role, content });

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        tokenCount: aiService.countTokens(content),
        costCredits: 0
      }
    });

    res.write(`data: ${JSON.stringify({ type: 'user_message', data: userMessage })}\n\n`);

    // Stream AI response
    let aiContent = '';
    const stream = aiService.streamChatCompletion(session.model, messages);

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        aiContent += chunk.content;
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
      } else if (chunk.type === 'done') {
        // Save complete AI message
        const aiResult = {
          content: aiContent,
          usage: {
            inputTokens: aiService.countTokens(messages.map(m => m.content).join(' ')),
            outputTokens: aiService.countTokens(aiContent),
            totalTokens: 0
          }
        };
        
        aiResult.usage.totalTokens = aiResult.usage.inputTokens + aiResult.usage.outputTokens;
        const credits = aiService.calculateCredits(session.model, aiResult.usage.inputTokens, aiResult.usage.outputTokens);

        await withTransaction(async (tx) => {
          // Save AI message
          await tx.chatMessage.create({
            data: {
              sessionId,
              role: 'assistant',
              content: aiContent,
              metadata: chunk.metadata,
              tokenCount: aiResult.usage.outputTokens,
              costCredits: credits
            }
          });

          // Deduct credits
          await tx.user.update({
            where: { id: req.user.id },
            data: { credits: { decrement: credits } }
          });

          // Create transaction
          await tx.creditTransaction.create({
            data: {
              userId: req.user.id,
              sessionId,
              type: 'USAGE',
              amount: -credits,
              description: `Chat stream - ${session.model}`
            }
          });

          // Update session
          await tx.chatSession.update({
            where: { id: sessionId },
            data: {
              totalTokens: { increment: aiResult.usage.totalTokens },
              totalCost: { increment: credits },
              updatedAt: new Date()
            }
          });
        });

        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          usage: { credits, remainingCredits: req.user.credits - credits }
        })}\n\n`);
        break;
      }
    }

  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
  } finally {
    res.end();
  }
};

// Get messages for a chat session
const getMessages = async (req, res) => {
  const { sessionId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const { skip, take } = dbUtils.paginate(page, limit);

  // Verify session ownership
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userId: req.user.id,
      deletedAt: null
    }
  });

  if (!session) {
    throw new AppError('Chat session not found', 404);
  }

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId },
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        tokenCount: true,
        costCredits: true,
        mcpToolCalls: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take
    }),
    prisma.chatMessage.count({ where: { sessionId } })
  ]);

  res.json({
    status: 'success',
    data: {
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
};

// Placeholder implementations
const deleteMessage = async (req, res) => {
  res.json({ status: 'success', message: 'Message deleted (not implemented)' });
};

const regenerateMessage = async (req, res) => {
  res.json({ status: 'success', message: 'Message regenerated (not implemented)' });
};

const editMessage = async (req, res) => {
  res.json({ status: 'success', message: 'Message edited (not implemented)' });
};

const getModels = async (req, res) => {
  const models = aiService.getAvailableModels();
  res.json({
    status: 'success',
    data: { models }
  });
};

const getUsage = async (req, res) => {
  res.json({ status: 'success', message: 'Usage stats (not implemented)' });
};

const exportSession = async (req, res) => {
  res.json({ status: 'success', message: 'Session exported (not implemented)' });
};

const shareSession = async (req, res) => {
  res.json({ status: 'success', message: 'Session shared (not implemented)' });
};

module.exports = {
  getSessions,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  sendMessage,
  streamMessage,
  getMessages,
  deleteMessage,
  regenerateMessage,
  editMessage,
  getModels,
  getUsage,
  exportSession,
  shareSession
};