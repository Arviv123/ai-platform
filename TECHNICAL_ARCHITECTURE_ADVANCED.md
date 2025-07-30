# 🏗️ אר_טקטורה טכנית מתקדמת - AI Platform

## 📚 המשך המדריך המעמיק

---

## 🧩 ספקי AI (AI Providers)

### 🎯 מבנה הספקים:

#### 1. **Base AI Provider** (`backend/src/services/ai/BaseAIProvider.js`)
```javascript
class BaseAIProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.isInitialized = false;
    this.models = [];
    this.rateLimits = {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    };
  }

  // מתודות אבסטרקטיות שכל ספק צריך לממש
  async initialize() {
    throw new Error('initialize() must be implemented by provider');
  }

  async generateResponse(prompt, options = {}) {
    throw new Error('generateResponse() must be implemented by provider');
  }

  async generateStreamingResponse(prompt, options = {}, onChunk) {
    throw new Error('generateStreamingResponse() must be implemented by provider');
  }

  // מתודות משותפות
  validateConfig() {
    return this.config.apiKey && this.config.apiKey.length > 0;
  }

  estimateTokens(text) {
    // הערכה גסה: 1 token ≈ 4 תווים באנגלית, 2 תווים בעברית
    const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const otherChars = text.length - hebrewChars;
    return Math.ceil((hebrewChars / 2) + (otherChars / 4));
  }

  async checkRateLimit() {
    // בדיקת rate limiting - יכול להיות מיושם עם Redis
    return true;
  }
}
```

#### 2. **Gemini Provider** (`backend/src/services/ai/GeminiProvider.js`)
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider extends BaseAIProvider {
  constructor() {
    super('google', {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      backupKeys: process.env.GOOGLE_AI_API_KEY_BACKUP?.split(',') || []
    });
    this.client = null;
    this.currentKeyIndex = 0;
  }

  async initialize() {
    try {
      this.client = new GoogleGenerativeAI(this.config.apiKey);
      this.models = [
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          provider: 'google',
          contextLength: 1000000,
          maxOutputTokens: 8192,
          isDefault: true,
          costPerToken: 0.00015
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          provider: 'google',
          contextLength: 2000000,
          maxOutputTokens: 8192,
          isDefault: false,
          costPerToken: 0.0005
        },
        {
          id: 'gemini-2.0-flash-001',
          name: 'Gemini 2.0 Flash',
          provider: 'google',
          contextLength: 1000000,
          maxOutputTokens: 8192,
          isDefault: false,
          costPerToken: 0.00015
        }
      ];

      // בדיקת חיבור
      await this.testConnection();
      this.isInitialized = true;
      
      logger.info(`Gemini provider initialized with ${this.models.length} models`);
    } catch (error) {
      logger.error('Failed to initialize Gemini provider:', error);
      throw error;
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!this.isInitialized) await this.initialize();

    const {
      model = 'gemini-1.5-flash',
      temperature = 0.7,
      maxTokens = 2048,
      tools = [],
      systemPrompt = null
    } = options;

    try {
      const genAI = this.client;
      const modelInstance = genAI.getGenerativeModel({ 
        model: model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.8,
          topK: 10
        }
      });

      // בניית ההקשר המלא
      let fullPrompt = '';
      
      if (systemPrompt) {
        fullPrompt += `הוראות מערכת: ${systemPrompt}\n\n`;
      }

      if (tools && tools.length > 0) {
        fullPrompt += this.buildToolsContext(tools);
      }

      fullPrompt += prompt;

      // שליחת הבקשה
      const result = await modelInstance.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      // עיבוד function calls אם יש
      const toolCalls = this.extractToolCalls(text);

      return {
        text: this.cleanResponseText(text),
        model: model,
        provider: 'google',
        tokens: {
          prompt: this.estimateTokens(fullPrompt),
          completion: this.estimateTokens(text),
          total: this.estimateTokens(fullPrompt + text)
        },
        toolCalls,
        finishReason: response.candidates?.[0]?.finishReason || 'stop',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // טיפול בשגיאות rate limiting
      if (error.message.includes('quota') || error.message.includes('rate')) {
        logger.warn('Gemini rate limit reached, trying backup key...');
        return await this.retryWithBackupKey(prompt, options);
      }
      
      logger.error('Gemini generation error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  async generateStreamingResponse(prompt, options = {}, onChunk) {
    if (!this.isInitialized) await this.initialize();

    const { model = 'gemini-1.5-flash' } = options;

    try {
      const genAI = this.client;
      const modelInstance = genAI.getGenerativeModel({ model });

      const result = await modelInstance.generateContentStream(prompt);
      let fullText = '';
      let chunkIndex = 0;

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        
        // קריאה ל-callback עם כל chunk
        if (onChunk) {
          onChunk({
            chunk: chunkText,
            fullText,
            chunkIndex: chunkIndex++,
            isComplete: false,
            model,
            provider: 'google'
          });
        }
      }

      // chunk אחרון - סיום
      if (onChunk) {
        onChunk({
          chunk: '',
          fullText,
          chunkIndex: chunkIndex++,
          isComplete: true,
          model,
          provider: 'google',
          tokens: {
            total: this.estimateTokens(fullText)
          }
        });
      }

      return {
        text: fullText,
        model,
        provider: 'google',
        streaming: true
      };

    } catch (error) {
      logger.error('Gemini streaming error:', error);
      throw error;
    }
  }

  buildToolsContext(tools) {
    let context = "\n📋 **כלים זמינים:**\n";
    
    for (const tool of tools) {
      context += `\n🔧 **${tool.name}**: ${tool.description}\n`;
      if (tool.parameters) {
        context += `   פרמטרים: ${Object.keys(tool.parameters.properties || {}).join(', ')}\n`;
      }
    }
    
    context += "\nלשימוש בכלי, כתב: [USE_TOOL:tool_name:parameters_json]\n\n";
    return context;
  }

  extractToolCalls(text) {
    const toolCallRegex = /\[USE_TOOL:([^:]+):([^\]]+)\]/g;
    const toolCalls = [];
    let match;

    while ((match = toolCallRegex.exec(text)) !== null) {
      try {
        const toolName = match[1];
        const parameters = JSON.parse(match[2]);
        
        toolCalls.push({
          name: toolName,
          parameters
        });
      } catch (error) {
        logger.warn('Failed to parse tool call:', match[0]);
      }
    }

    return toolCalls;
  }

  cleanResponseText(text) {
    // הסרת tool calls מהטקסט הסופי
    return text.replace(/\[USE_TOOL:[^\]]+\]/g, '').trim();
  }

  async retryWithBackupKey(prompt, options) {
    const backupKeys = this.config.backupKeys;
    
    for (let i = 0; i < backupKeys.length; i++) {
      try {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % (backupKeys.length + 1);
        const newKey = this.currentKeyIndex === 0 ? 
          this.config.apiKey : 
          backupKeys[this.currentKeyIndex - 1];

        this.client = new GoogleGenerativeAI(newKey);
        logger.info(`Retrying with backup key ${this.currentKeyIndex}`);
        
        return await this.generateResponse(prompt, options);
      } catch (error) {
        logger.warn(`Backup key ${i} also failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('All Gemini API keys exhausted');
  }

  async testConnection() {
    try {
      const testModel = this.client.getGenerativeModel({ 
        model: 'gemini-1.5-flash' 
      });
      
      const result = await testModel.generateContent('Test connection');
      const response = await result.response;
      
      return {
        success: true,
        message: 'Gemini connection successful',
        response: response.text()
      };
    } catch (error) {
      return {
        success: false,
        message: `Gemini connection failed: ${error.message}`
      };
    }
  }
}
```

#### 3. **Claude Provider** (`backend/src/services/ai/ClaudeProvider.js`)
```javascript
const Anthropic = require('@anthropic-ai/sdk');

class ClaudeProvider extends BaseAIProvider {
  constructor() {
    super('anthropic', {
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.client = null;
  }

  async initialize() {
    try {
      this.client = new Anthropic({
        apiKey: this.config.apiKey
      });

      this.models = [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'anthropic',
          contextLength: 200000,
          maxOutputTokens: 8192,
          isDefault: true,
          costPerToken: 0.003
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          provider: 'anthropic',
          contextLength: 200000,
          maxOutputTokens: 4096,
          isDefault: false,
          costPerToken: 0.00025
        }
      ];

      await this.testConnection();
      this.isInitialized = true;
      
      logger.info(`Claude provider initialized with ${this.models.length} models`);
    } catch (error) {
      logger.error('Failed to initialize Claude provider:', error);
      throw error;
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!this.isInitialized) await this.initialize();

    const {
      model = 'claude-3-5-sonnet-20241022',
      temperature = 0.7,
      maxTokens = 4096,
      systemPrompt = null,
      tools = []
    } = options;

    try {
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const requestParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages
      };

      // הוספת system prompt
      if (systemPrompt) {
        requestParams.system = systemPrompt;
      }

      // הוספת tools
      if (tools && tools.length > 0) {
        requestParams.tools = this.formatToolsForClaude(tools);
      }

      const response = await this.client.messages.create(requestParams);

      // עיבוד tool calls
      const toolCalls = this.extractClaudeToolCalls(response);

      return {
        text: response.content[0]?.text || '',
        model,
        provider: 'anthropic',
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        },
        toolCalls,
        finishReason: response.stop_reason,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Claude generation error:', error);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  formatToolsForClaude(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters?.properties || {},
        required: tool.parameters?.required || []
      }
    }));
  }

  extractClaudeToolCalls(response) {
    const toolCalls = [];
    
    for (const content of response.content) {
      if (content.type === 'tool_use') {
        toolCalls.push({
          name: content.name,
          parameters: content.input,
          id: content.id
        });
      }
    }

    return toolCalls;
  }
}
```

---

## 🔗 מערכת WebSocket ועדכונים בזמן אמת

### 📡 WebSocket Server (`backend/src/services/websocketService.js`)

```javascript
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket
    this.userSessions = new Map();   // userId -> sessionIds[]
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication failed - no token'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.sub;
        socket.user = decoded;
        
        logger.info(`WebSocket authenticated: ${decoded.email}`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket service initialized');
  }

  handleConnection(socket) {
    const userId = socket.userId;
    logger.info(`User connected: ${userId} (socket: ${socket.id})`);

    // שמירת החיבור
    this.connectedUsers.set(userId, socket);

    // Join personal room
    socket.join(`user_${userId}`);

    // Event handlers
    socket.on('join_session', (sessionId) => {
      this.handleJoinSession(socket, sessionId);
    });

    socket.on('leave_session', (sessionId) => {
      this.handleLeaveSession(socket, sessionId);
    });

    socket.on('typing_start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to AI Platform',
      timestamp: new Date().toISOString()
    });
  }

  handleJoinSession(socket, sessionId) {
    socket.join(`session_${sessionId}`);
    
    // Add to user sessions
    if (!this.userSessions.has(socket.userId)) {
      this.userSessions.set(socket.userId, new Set());
    }
    this.userSessions.get(socket.userId).add(sessionId);

    logger.info(`User ${socket.userId} joined session ${sessionId}`);
    
    // Notify others in session
    socket.to(`session_${sessionId}`).emit('user_joined', {
      userId: socket.userId,
      sessionId,
      timestamp: new Date().toISOString()
    });
  }

  handleLeaveSession(socket, sessionId) {
    socket.leave(`session_${sessionId}`);
    
    if (this.userSessions.has(socket.userId)) {
      this.userSessions.get(socket.userId).delete(sessionId);
    }

    logger.info(`User ${socket.userId} left session ${sessionId}`);
    
    // Notify others in session
    socket.to(`session_${sessionId}`).emit('user_left', {
      userId: socket.userId,
      sessionId,
      timestamp: new Date().toISOString()
    });
  }

  handleTypingStart(socket, { sessionId }) {
    socket.to(`session_${sessionId}`).emit('typing', {
      userId: socket.userId,
      sessionId,
      typing: true,
      timestamp: new Date().toISOString()
    });
  }

  handleTypingStop(socket, { sessionId }) {
    socket.to(`session_${sessionId}`).emit('typing', {
      userId: socket.userId,
      sessionId,
      typing: false,
      timestamp: new Date().toISOString()
    });
  }

  handleDisconnect(socket) {
    const userId = socket.userId;
    logger.info(`User disconnected: ${userId}`);

    // Clean up
    this.connectedUsers.delete(userId);
    this.userSessions.delete(userId);
  }

  // Public methods for sending notifications
  sendNotification(userId, notification) {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  sendToSession(sessionId, event, data) {
    this.io.to(`session_${sessionId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  broadcastToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Get connection statistics
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeSessions: Array.from(this.userSessions.values())
        .reduce((sum, sessions) => sum + sessions.size, 0),
      totalSockets: this.io.engine.clientsCount
    };
  }
}

module.exports = new WebSocketService();
```

### 🔄 Real-time Chat Updates

#### שימוש ב-Controller:
```javascript
// בcontroller הצ'אט - שליחת עדכון בזמן אמת
const createMessage = async (req, res) => {
  // ... קוד יצירת הודעה ...

  // שליחת עדכון WebSocket
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

  // עדכון כל מי שנמצא בsession
  websocketService.sendToSession(session.id, 'message_update', {
    type: 'new_message',
    message: assistantMessage
  });

  res.json({ status: 'success', data: response });
};
```

---

## 🛡️ אבטחה מתקדמת (Advanced Security)

### 🔐 JWT & Authentication

#### 1. **JWT Service** (`backend/src/services/authService.js`)
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.jwtSecret + '_refresh';
    this.tokenExpiry = process.env.JWT_EXPIRY || '15m';
    this.refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  // יצירת tokens
  generateTokens(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry,
      issuer: 'ai-platform',
      audience: 'ai-platform-users'
    });

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      this.refreshSecret,
      { expiresIn: this.refreshExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.tokenExpiry),
      tokenType: 'Bearer'
    };
  }

  // אימות token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'ai-platform',
        audience: 'ai-platform-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  // רענון token
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // הצפנת סיסמה
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // אימות סיסמה
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // יצירת secure random token
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  parseExpiry(expiry) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };
    
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes
    
    return parseInt(match[1]) * units[match[2]];
  }
}
```

#### 2. **Authentication Middleware** (`backend/src/middleware/authUnified.js`)
```javascript
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const authMiddleware = {
  // אימות חובה
  required: async (req, res, next) => {
    try {
      const token = extractToken(req);
      
      if (!token) {
        return res.status(401).json({
          status: 'error',
          message: 'Access token required'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // בדיקה שהמשתמש עדיין קיים ופעיל
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          lockUntil: true
        }
      });

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found'
        });
      }

      if (user.lockUntil && user.lockUntil > new Date()) {
        return res.status(423).json({
          status: 'error',
          message: 'Account temporarily locked'
        });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          status: 'error',
          message: 'Email verification required'
        });
      }

      // עדכון זמן כניסה אחרון
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      req.user = decoded;
      req.userDetails = user;
      next();

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      logger.error('Authentication error:', error);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      });
    }
  },

  // אימות אופציונלי
  optional: async (req, res, next) => {
    try {
      const token = extractToken(req);
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      }
      
      next();
    } catch (error) {
      // במצב אופציונלי, אנחנו מתעלמים משגיאות
      next();
    }
  },

  // בדיקת הרשאות
  requireRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
      }

      const userRole = req.userDetails?.role || req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  }
};

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // גם בדיקה בcookies
  return req.cookies?.authToken;
}

module.exports = authMiddleware;
```

### 🛡️ Rate Limiting & Security

#### 1. **Rate Limiter** (`backend/src/middleware/rateLimiter.js`)
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');
const logger = require('../utils/logger');

// Redis client (אופציונלי)
const redisClient = process.env.REDIS_URL ? 
  Redis.createClient({ url: process.env.REDIS_URL }) : null;

// Rate limiters שונים לendpoints שונים
const rateLimiters = {
  // General API
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      status: 'error',
      message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args)
    }) : undefined
  }),

  // Chat API - more restrictive
  chat: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 messages per minute
    message: {
      status: 'error',
      message: 'Too many chat messages, please slow down'
    },
    keyGenerator: (req) => {
      return req.user?.sub || req.ip;
    }
  }),

  // Auth API - very restrictive
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      status: 'error',
      message: 'Too many authentication attempts'
    },
    skipSuccessfulRequests: true
  }),

  // MCP tools - token-based limiting
  mcpTools: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: async (req) => {
      // Different limits based on user plan
      const userPlan = req.userDetails?.plan || 'FREE';
      const limits = {
        'FREE': 5,
        'PRO': 20,
        'ENTERPRISE': 100
      };
      return limits[userPlan] || 5;
    },
    keyGenerator: (req) => `mcp_${req.user?.sub}`
  })
};

// Smart rate limiting based on endpoint
const smartRateLimit = (req, res, next) => {
  const path = req.path;
  
  if (path.startsWith('/api/auth')) {
    return rateLimiters.auth(req, res, next);
  } else if (path.startsWith('/api/chat')) {
    return rateLimiters.chat(req, res, next);
  } else if (path.startsWith('/api/mcp')) {
    return rateLimiters.mcpTools(req, res, next);
  } else {
    return rateLimiters.general(req, res, next);
  }
};

module.exports = {
  smartRateLimit,
  rateLimiters
};
```

#### 2. **Security Middleware** (`backend/src/middleware/security.js`)
```javascript
const helmet = require('helmet');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

const securityMiddleware = {
  // Helmet for basic security headers
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // CORS configuration
  cors: cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }),

  // Input validation helpers
  validateChat: [
    body('message')
      .isLength({ min: 1, max: 10000 })
      .withMessage('Message must be between 1 and 10000 characters')
      .escape(),
    body('model')
      .optional()
      .isAlphanumeric()
      .withMessage('Invalid model format'),
    body('sessionId')
      .optional()
      .isUUID()
      .withMessage('Invalid session ID format')
  ],

  validateAuth: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number')
  ],

  // Validation error handler
  handleValidationErrors: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  },

  // Request sanitization
  sanitizeInput: (req, res, next) => {
    // Remove potential XSS patterns
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    
    next();
  }
};

module.exports = securityMiddleware;
```

---

## 📊 ניטור וביצועים (Monitoring & Performance)

### 📈 Monitoring Service (`backend/src/services/monitoringService.js`)

```javascript
const os = require('os');
const { performance } = require('perf_hooks');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.alerts = new Map();
    this.thresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.05,    // 5%
      memoryUsage: 0.85,  // 85%
      cpuUsage: 0.8       // 80%
    };
    
    // Start monitoring
    this.startSystemMonitoring();
  }

  // System metrics collection
  startSystemMonitoring() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes
  }

  async collectSystemMetrics() {
    try {
      const metrics = {
        timestamp: new Date(),
        memory: this.getMemoryMetrics(),
        cpu: await this.getCPUMetrics(),
        system: this.getSystemMetrics(),
        database: await this.getDatabaseMetrics(),
        api: this.getAPIMetrics()
      };

      // Store in database
      await this.storeMetrics(metrics);

      // Check for alerts
      await this.checkAlerts(metrics);

    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  getMemoryMetrics() {
    const usage = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      process: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external
      },
      system: {
        total,
        used,
        free,
        usagePercent: used / total
      }
    };
  }

  async getCPUMetrics() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = performance.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = performance.now();
        const duration = (endTime - startTime) * 1000; // microseconds

        const cpuPercent = (endUsage.user + endUsage.system) / duration;

        resolve({
          process: {
            user: endUsage.user,
            system: endUsage.system,
            percent: cpuPercent
          },
          system: {
            loadAverage: os.loadavg(),
            cpuCount: os.cpus().length
          }
        });
      }, 100);
    });
  }

  getSystemMetrics() {
    return {
      uptime: process.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }

  async getDatabaseMetrics() {
    try {
      const start = performance.now();
      
      // Simple query to test DB responsiveness
      await prisma.$queryRaw`SELECT 1`;
      
      const responseTime = performance.now() - start;

      // Get table counts
      const userCount = await prisma.user.count();
      const sessionCount = await prisma.chatSession.count();
      const messageCount = await prisma.chatMessage.count();

      return {
        responseTime,
        tables: {
          users: userCount,
          sessions: sessionCount,
          messages: messageCount
        }
      };
    } catch (error) {
      return {
        error: error.message,
        responseTime: null
      };
    }
  }

  getAPIMetrics() {
    // אלה יאספו במהלך הrequests
    const apiMetrics = this.metrics.get('api') || {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      endpoints: {}
    };

    return {
      totalRequests: apiMetrics.requests,
      totalErrors: apiMetrics.errors,
      errorRate: apiMetrics.requests > 0 ? 
        apiMetrics.errors / apiMetrics.requests : 0,
      averageResponseTime: apiMetrics.requests > 0 ? 
        apiMetrics.totalResponseTime / apiMetrics.requests : 0,
      endpoints: apiMetrics.endpoints
    };
  }

  // Request monitoring middleware
  monitorRequest() {
    return (req, res, next) => {
      const startTime = performance.now();
      const endpoint = `${req.method} ${req.route?.path || req.path}`;

      // Increment request counter
      this.incrementMetric('api.requests');
      this.incrementMetric(`api.endpoints.${endpoint}.requests`);

      // Monitor response
      const originalSend = res.send;
      res.send = function(data) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Record metrics
        this.recordMetric('api.totalResponseTime', responseTime);
        this.recordMetric(`api.endpoints.${endpoint}.responseTime`, responseTime);

        if (res.statusCode >= 400) {
          this.incrementMetric('api.errors');
          this.incrementMetric(`api.endpoints.${endpoint}.errors`);
        }

        // Log slow requests
        if (responseTime > this.thresholds.responseTime) {
          logger.warn(`Slow request detected: ${endpoint} took ${responseTime}ms`);
        }

        originalSend.call(res, data);
      }.bind(this);

      next();
    };
  }

  incrementMetric(key) {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
  }

  recordMetric(key, value) {
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }

  async storeMetrics(metrics) {
    try {
      await prisma.systemMetrics.createMany({
        data: [
          {
            type: 'memory_usage',
            value: metrics.memory.system.usagePercent,
            unit: 'percent',
            metadata: JSON.stringify(metrics.memory)
          },
          {
            type: 'cpu_usage',
            value: metrics.cpu.process.percent,
            unit: 'percent',
            metadata: JSON.stringify(metrics.cpu)
          },
          {
            type: 'db_response_time',
            value: metrics.database.responseTime || 0,
            unit: 'milliseconds',
            metadata: JSON.stringify(metrics.database)
          },
          {
            type: 'api_response_time',
            value: metrics.api.averageResponseTime,
            unit: 'milliseconds',
            metadata: JSON.stringify(metrics.api)
          }
        ]
      });
    } catch (error) {
      logger.error('Failed to store metrics:', error);
    }
  }

  async checkAlerts(metrics) {
    const alerts = [];

    // Memory alert
    if (metrics.memory.system.usagePercent > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        message: `Memory usage is ${(metrics.memory.system.usagePercent * 100).toFixed(1)}%`,
        severity: 'warning',
        value: metrics.memory.system.usagePercent
      });
    }

    // CPU alert
    if (metrics.cpu.process.percent > this.thresholds.cpuUsage) {
      alerts.push({
        type: 'HIGH_CPU_USAGE',
        message: `CPU usage is ${(metrics.cpu.process.percent * 100).toFixed(1)}%`,
        severity: 'warning',
        value: metrics.cpu.process.percent
      });
    }

    // Error rate alert
    if (metrics.api.errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        message: `API error rate is ${(metrics.api.errorRate * 100).toFixed(1)}%`,
        severity: 'critical',
        value: metrics.api.errorRate
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  async sendAlert(alert) {
    logger.warn(`ALERT: ${alert.type} - ${alert.message}`);
    
    // כאן אפשר להוסיף שליחת אימייל, Slack, Discord וכו'
    // await emailService.sendAlert(alert);
    // await slackService.sendAlert(alert);
  }

  // API endpoints for metrics
  async getMetrics(timeRange = '1h') {
    const now = new Date();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const startTime = new Date(now.getTime() - ranges[timeRange]);

    const metrics = await prisma.systemMetrics.findMany({
      where: {
        timestamp: { gte: startTime }
      },
      orderBy: { timestamp: 'asc' }
    });

    return this.formatMetricsForChart(metrics);
  }

  formatMetricsForChart(metrics) {
    const grouped = {};
    
    for (const metric of metrics) {
      if (!grouped[metric.type]) {
        grouped[metric.type] = [];
      }
      
      grouped[metric.type].push({
        timestamp: metric.timestamp,
        value: metric.value,
        metadata: metric.metadata ? JSON.parse(metric.metadata) : null
      });
    }

    return grouped;
  }

  cleanupOldMetrics() {
    // מחיקת מטריקות ישנות (מעל 30 יום)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    prisma.systemMetrics.deleteMany({
      where: {
        timestamp: { lt: thirtyDaysAgo }
      }
    }).catch(error => {
      logger.error('Failed to cleanup old metrics:', error);
    });
  }
}

module.exports = new MonitoringService();
```

זה החלק השני של המדריך המעמיק. המערכת שלך בנויה בצורה מאוד מקצועית ומתקדמת! 

האם תרצה שאמשיך עם נושאים נוספים כמו:
- 🔄 Deployment strategies  
- 🧪 Testing frameworks
- 📦 Docker & containerization
- 🌐 Scaling & load balancing
- 🔍 Advanced debugging techniques?