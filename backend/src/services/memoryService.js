const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class MemoryService {
  constructor() {
    this.summaryThreshold = 15; // Create summary after 15 messages
    this.memoryTypes = {
      PERSONAL: 'PERSONAL',      // Personal info about user
      PREFERENCE: 'PREFERENCE',  // User preferences and settings
      FACT: 'FACT',             // Important facts to remember
      CONTEXT: 'CONTEXT'        // Contextual information
    };
  }

  // Check if conversation needs summarization
  async shouldSummarizeConversation(sessionId) {
    try {
      const messageCount = await prisma.chatMessage.count({
        where: { sessionId }
      });

      const lastSummary = await prisma.conversationSummary.findFirst({
        where: { sessionId, isActive: true },
        orderBy: { summarizedUpTo: 'desc' }
      });

      const messagesAfterSummary = lastSummary 
        ? await prisma.chatMessage.count({
            where: { 
              sessionId,
              createdAt: { gt: lastSummary.summarizedUpTo }
            }
          })
        : messageCount;

      return messagesAfterSummary >= this.summaryThreshold;
    } catch (error) {
      logger.error('Error checking if conversation should be summarized:', error);
      return false;
    }
  }

  // Create conversation summary using AI
  async createConversationSummary(sessionId, userId, aiService) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: true }
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Get last summary to know what to summarize
      const lastSummary = await prisma.conversationSummary.findFirst({
        where: { sessionId, isActive: true },
        orderBy: { summarizedUpTo: 'desc' }
      });

      // Get messages to summarize
      const messagesToSummarize = await prisma.chatMessage.findMany({
        where: {
          sessionId,
          createdAt: lastSummary 
            ? { gt: lastSummary.summarizedUpTo }
            : undefined
        },
        orderBy: { createdAt: 'asc' }
      });

      if (messagesToSummarize.length === 0) {
        return null;
      }

      // Prepare conversation text for summarization
      const conversationText = messagesToSummarize
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      // Create summary prompt
      const summaryPrompt = `Please create a comprehensive summary of this conversation segment. Focus on:
1. Key topics discussed
2. Important decisions or conclusions
3. User preferences or personal information revealed
4. Any tasks or actions requested/completed
5. Context that should be remembered for future conversations

Previous summary context: ${lastSummary ? lastSummary.summaryText : 'None'}

Conversation to summarize:
${conversationText}

Please provide a structured summary that will help maintain context in future conversations:`;

      // Generate summary using AI
      const summaryResponse = await aiService.generateAIResponse(summaryPrompt);

      // Calculate tokens
      const totalTokens = messagesToSummarize.reduce((sum, msg) => sum + msg.tokens, 0);
      const summaryTokens = Math.ceil(summaryResponse.text.length / 4);

      // Save summary
      const summary = await prisma.conversationSummary.create({
        data: {
          sessionId,
          userId,
          summaryText: summaryResponse.text,
          summarizedUpTo: messagesToSummarize[messagesToSummarize.length - 1].createdAt,
          messageCount: messagesToSummarize.length,
          tokenCount: totalTokens,
          summaryTokens
        }
      });

      logger.info(`Created conversation summary for session ${sessionId}, ${messagesToSummarize.length} messages, ${totalTokens} tokens`);

      // Extract and store long-term memories from summary
      await this.extractLongTermMemoriesFromSummary(summary, userId, aiService);

      return summary;
    } catch (error) {
      logger.error('Error creating conversation summary:', error);
      throw error;
    }
  }

  // Extract long-term memories from conversation summary
  async extractLongTermMemoriesFromSummary(summary, userId, aiService) {
    try {
      const extractionPrompt = `Analyze this conversation summary and extract specific information that should be remembered long-term about the user. 

For each piece of information, classify it as:
- PERSONAL: Personal details about the user (name, job, family, etc.)
- PREFERENCE: User preferences (likes, dislikes, preferred ways of working)
- FACT: Important facts or knowledge the user has shared or learned
- CONTEXT: Important context that affects how I should interact with them

Return the information in JSON format like this:
{
  "memories": [
    {
      "type": "PERSONAL|PREFERENCE|FACT|CONTEXT",
      "content": "specific information to remember",
      "importance": 0.1-1.0,
      "confidence": 0.1-1.0
    }
  ]
}

Conversation summary:
${summary.summaryText}

Extract memories:`;

      const extractionResponse = await aiService.generateAIResponse(extractionPrompt);

      try {
        const extracted = JSON.parse(extractionResponse.text);
        
        if (extracted.memories && Array.isArray(extracted.memories)) {
          for (const memory of extracted.memories) {
            if (memory.content && memory.type && this.memoryTypes[memory.type]) {
              await this.storeMemory(
                userId,
                summary.sessionId,
                memory.type,
                memory.content,
                memory.importance || 0.5,
                memory.confidence || 0.8
              );
            }
          }
          
          logger.info(`Extracted ${extracted.memories.length} long-term memories from summary`);
        }
      } catch (parseError) {
        logger.warn('Failed to parse memory extraction response:', parseError);
      }
    } catch (error) {
      logger.error('Error extracting long-term memories:', error);
    }
  }

  // Store a long-term memory
  async storeMemory(userId, sessionId, memoryType, content, importance = 0.5, confidence = 0.8, metadata = null) {
    try {
      // Check for similar existing memories to avoid duplicates
      const existingMemory = await prisma.longTermMemory.findFirst({
        where: {
          userId,
          memoryType,
          content: { contains: content.substring(0, 50) } // Check first 50 chars
        }
      });

      if (existingMemory) {
        // Update existing memory with higher importance/confidence
        const updatedMemory = await prisma.longTermMemory.update({
          where: { id: existingMemory.id },
          data: {
            importance: Math.max(existingMemory.importance, importance),
            confidence: Math.max(existingMemory.confidence, confidence),
            accessCount: { increment: 1 },
            lastAccessed: new Date(),
            updatedAt: new Date()
          }
        });
        
        logger.info(`Updated existing memory: ${content.substring(0, 100)}...`);
        return updatedMemory;
      } else {
        // Create new memory
        const memory = await prisma.longTermMemory.create({
          data: {
            userId,
            sessionId,
            memoryType,
            content,
            importance,
            confidence,
            metadata: metadata ? JSON.stringify(metadata) : null
          }
        });
        
        logger.info(`Stored new memory: ${content.substring(0, 100)}...`);
        return memory;
      }
    } catch (error) {
      logger.error('Error storing memory:', error);
      throw error;
    }
  }

  // Retrieve relevant memories for conversation context
  async getRelevantMemories(userId, query = null, limit = 10) {
    try {
      const where = {
        userId,
        expiresAt: { not: { lte: new Date() } } // Exclude expired memories
      };

      // If query provided, find relevant memories (simple text search)
      if (query) {
        where.content = { contains: query, mode: 'insensitive' };
      }

      const memories = await prisma.longTermMemory.findMany({
        where,
        orderBy: [
          { importance: 'desc' },
          { confidence: 'desc' },
          { lastAccessed: 'desc' }
        ],
        take: limit
      });

      // Update access count for retrieved memories
      if (memories.length > 0) {
        await prisma.longTermMemory.updateMany({
          where: { id: { in: memories.map(m => m.id) } },
          data: { 
            accessCount: { increment: 1 },
            lastAccessed: new Date()
          }
        });
      }

      logger.info(`Retrieved ${memories.length} relevant memories for user ${userId}`);
      return memories;
    } catch (error) {
      logger.error('Error retrieving memories:', error);
      return [];
    }
  }

  // Get conversation context including summaries and memories
  async getConversationContext(sessionId, userId, limit = 5) {
    try {
      // Get recent summaries
      const summaries = await prisma.conversationSummary.findMany({
        where: { sessionId, isActive: true },
        orderBy: { summarizedUpTo: 'desc' },
        take: 3
      });

      // Get relevant long-term memories
      const memories = await this.getRelevantMemories(userId, null, limit);

      // Get recent messages not yet summarized
      const lastSummary = summaries[0];
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          sessionId,
          createdAt: lastSummary 
            ? { gt: lastSummary.summarizedUpTo }
            : undefined
        },
        orderBy: { createdAt: 'asc' },
        take: 10
      });

      return {
        summaries: summaries.reverse(), // Oldest first
        memories,
        recentMessages,
        totalContext: summaries.length + memories.length + recentMessages.length
      };
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      return { summaries: [], memories: [], recentMessages: [], totalContext: 0 };
    }
  }

  // Build enhanced context for AI with long-term memory
  buildEnhancedContext(conversationContext, currentPrompt) {
    let context = '';
    
    // Add user memories as system context
    if (conversationContext.memories.length > 0) {
      context += "=== Long-term Memory About User ===\n";
      conversationContext.memories.forEach(memory => {
        const confidenceLabel = memory.confidence >= 0.8 ? 'High' : memory.confidence >= 0.5 ? 'Medium' : 'Low';
        context += `[${memory.memoryType}] (${confidenceLabel} confidence): ${memory.content}\n`;
      });
      context += "\n";
    }

    // Add conversation summaries
    if (conversationContext.summaries.length > 0) {
      context += "=== Previous Conversation Context ===\n";
      conversationContext.summaries.forEach((summary, index) => {
        context += `Summary ${index + 1} (${summary.messageCount} messages):\n${summary.summaryText}\n\n`;
      });
    }

    // Add recent messages
    if (conversationContext.recentMessages.length > 0) {
      context += "=== Recent Conversation ===\n";
      conversationContext.recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        context += `${role}: ${msg.content}\n`;
      });
      context += "\n";
    }

    // Add current prompt
    context += "=== Current Request ===\n";
    context += currentPrompt;

    return context;
  }

  // Clean up old memories and summaries
  async cleanup(olderThanDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Delete low-importance, old memories
      const deletedMemories = await prisma.longTermMemory.deleteMany({
        where: {
          importance: { lt: 0.3 },
          lastAccessed: { lt: cutoffDate },
          accessCount: { lt: 2 }
        }
      });

      // Mark old summaries as inactive
      const inactivatedSummaries = await prisma.conversationSummary.updateMany({
        where: {
          createdAt: { lt: cutoffDate },
          isActive: true
        },
        data: { isActive: false }
      });

      logger.info(`Memory cleanup: deleted ${deletedMemories.count} memories, inactivated ${inactivatedSummaries.count} summaries`);
      
      return {
        deletedMemories: deletedMemories.count,
        inactivatedSummaries: inactivatedSummaries.count
      };
    } catch (error) {
      logger.error('Error during memory cleanup:', error);
      throw error;
    }
  }

  // Get memory statistics for user
  async getMemoryStats(userId) {
    try {
      const stats = await Promise.all([
        prisma.longTermMemory.count({ where: { userId } }),
        prisma.conversationSummary.count({ where: { userId, isActive: true } }),
        prisma.longTermMemory.aggregate({
          where: { userId },
          _avg: { importance: true, confidence: true },
          _sum: { accessCount: true }
        })
      ]);

      return {
        totalMemories: stats[0],
        activeSummaries: stats[1],
        averageImportance: stats[2]._avg.importance || 0,
        averageConfidence: stats[2]._avg.confidence || 0,
        totalAccesses: stats[2]._sum.accessCount || 0
      };
    } catch (error) {
      logger.error('Error getting memory stats:', error);
      return {
        totalMemories: 0,
        activeSummaries: 0,
        averageImportance: 0,
        averageConfidence: 0,
        totalAccesses: 0
      };
    }
  }
}

// Create singleton instance
const memoryService = new MemoryService();

module.exports = memoryService;