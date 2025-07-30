const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map of userId -> Set of WebSocket connections
    this.rooms = new Map(); // Map of roomId -> Set of client IDs
    this.isInitialized = false;
  }

  // Initialize WebSocket server
  initialize(server) {
    try {
      this.wss = new WebSocket.Server({ 
        server,
        path: '/ws',
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleError.bind(this));

      this.isInitialized = true;
      logger.info('WebSocket service initialized successfully');
      
      // Set up periodic cleanup
      setInterval(() => this.cleanupConnections(), 30000);
      
    } catch (error) {
      logger.error('Failed to initialize WebSocket service:', error);
    }
  }

  // Verify client authentication
  verifyClient(info) {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided');
        return false;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
      
      // Add user info to request for later use
      info.req.user = decoded;
      return true;
      
    } catch (error) {
      logger.warn('WebSocket connection rejected: Invalid token', error.message);
      return false;
    }
  }

  // Handle new WebSocket connection
  handleConnection(ws, req) {
    try {
      const user = req.user;
      const userId = user.sub;
      
      // Initialize client data
      ws.userId = userId;
      ws.connectionId = this.generateConnectionId();
      ws.connectedAt = new Date();
      ws.isAlive = true;

      // Store client connection
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);

      logger.info(`WebSocket client connected: ${userId} (${ws.connectionId})`);

      // Set up event handlers
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnection(ws));
      ws.on('error', (error) => this.handleClientError(ws, error));
      ws.on('pong', () => { ws.isAlive = true; });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection',
        status: 'connected',
        connectionId: ws.connectionId,
        timestamp: new Date().toISOString()
      });

      // Notify about active users (if in a room)
      this.broadcastUserStatus(userId, 'online');

    } catch (error) {
      logger.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Server error');
    }
  }

  // Handle incoming messages
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      logger.debug(`WebSocket message from ${ws.userId}:`, message.type);

      switch (message.type) {
        case 'ping':
          this.handlePing(ws);
          break;
          
        case 'join_room':
          this.handleJoinRoom(ws, message.roomId);
          break;
          
        case 'leave_room':
          this.handleLeaveRoom(ws, message.roomId);
          break;
          
        case 'chat_typing':
          this.handleTypingIndicator(ws, message);
          break;
          
        case 'chat_message':
          this.handleChatMessage(ws, message);
          break;
          
        case 'notification_read':
          this.handleNotificationRead(ws, message);
          break;
          
        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
          this.sendError(ws, 'Unknown message type', message.type);
      }
      
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  // Handle ping messages
  handlePing(ws) {
    this.sendToClient(ws, {
      type: 'pong',
      timestamp: new Date().toISOString()
    });
  }

  // Handle room joining
  handleJoinRoom(ws, roomId) {
    try {
      if (!roomId) {
        return this.sendError(ws, 'Room ID required');
      }

      // Add client to room
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
      }
      
      this.rooms.get(roomId).add(ws.connectionId);
      ws.currentRoom = roomId;

      logger.info(`Client ${ws.userId} joined room: ${roomId}`);

      // Send confirmation
      this.sendToClient(ws, {
        type: 'room_joined',
        roomId: roomId,
        timestamp: new Date().toISOString()
      });

      // Notify other room members
      this.broadcastToRoom(roomId, {
        type: 'user_joined',
        userId: ws.userId,
        roomId: roomId,
        timestamp: new Date().toISOString()
      }, [ws.connectionId]);

    } catch (error) {
      logger.error('Error joining room:', error);
      this.sendError(ws, 'Failed to join room');
    }
  }

  // Handle room leaving
  handleLeaveRoom(ws, roomId) {
    try {
      const room = roomId || ws.currentRoom;
      
      if (!room || !this.rooms.has(room)) {
        return this.sendError(ws, 'Not in specified room');
      }

      // Remove client from room
      this.rooms.get(room).delete(ws.connectionId);
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }

      ws.currentRoom = null;

      logger.info(`Client ${ws.userId} left room: ${room}`);

      // Send confirmation
      this.sendToClient(ws, {
        type: 'room_left',
        roomId: room,
        timestamp: new Date().toISOString()
      });

      // Notify other room members
      this.broadcastToRoom(room, {
        type: 'user_left',
        userId: ws.userId,
        roomId: room,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error leaving room:', error);
      this.sendError(ws, 'Failed to leave room');
    }
  }

  // Handle typing indicators
  handleTypingIndicator(ws, message) {
    try {
      const { roomId, isTyping } = message;
      
      if (!roomId) {
        return this.sendError(ws, 'Room ID required for typing indicator');
      }

      // Broadcast typing status to room members
      this.broadcastToRoom(roomId, {
        type: 'user_typing',
        userId: ws.userId,
        roomId: roomId,
        isTyping: !!isTyping,
        timestamp: new Date().toISOString()
      }, [ws.connectionId]);

    } catch (error) {
      logger.error('Error handling typing indicator:', error);
    }
  }

  // Handle chat messages
  handleChatMessage(ws, message) {
    try {
      const { roomId, content, messageId } = message;
      
      if (!roomId || !content) {
        return this.sendError(ws, 'Room ID and content required');
      }

      // Broadcast message to room members
      this.broadcastToRoom(roomId, {
        type: 'new_message',
        messageId: messageId || this.generateMessageId(),
        userId: ws.userId,
        roomId: roomId,
        content: content,
        timestamp: new Date().toISOString()
      });

      logger.info(`Chat message from ${ws.userId} in room ${roomId}`);

    } catch (error) {
      logger.error('Error handling chat message:', error);
      this.sendError(ws, 'Failed to send message');
    }
  }

  // Handle notification read status
  handleNotificationRead(ws, message) {
    try {
      const { notificationId } = message;
      
      if (!notificationId) {
        return this.sendError(ws, 'Notification ID required');
      }

      // Here you would typically update the database
      // to mark the notification as read
      
      logger.info(`Notification ${notificationId} marked as read by ${ws.userId}`);

      // Send confirmation
      this.sendToClient(ws, {
        type: 'notification_updated',
        notificationId: notificationId,
        status: 'read',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error handling notification read:', error);
    }
  }

  // Handle client disconnection
  handleDisconnection(ws) {
    try {
      logger.info(`WebSocket client disconnected: ${ws.userId} (${ws.connectionId})`);

      // Remove from clients map
      if (this.clients.has(ws.userId)) {
        this.clients.get(ws.userId).delete(ws);
        if (this.clients.get(ws.userId).size === 0) {
          this.clients.delete(ws.userId);
          // Broadcast user offline status
          this.broadcastUserStatus(ws.userId, 'offline');
        }
      }

      // Remove from rooms
      if (ws.currentRoom && this.rooms.has(ws.currentRoom)) {
        this.rooms.get(ws.currentRoom).delete(ws.connectionId);
        if (this.rooms.get(ws.currentRoom).size === 0) {
          this.rooms.delete(ws.currentRoom);
        } else {
          // Notify room members
          this.broadcastToRoom(ws.currentRoom, {
            type: 'user_left',
            userId: ws.userId,
            roomId: ws.currentRoom,
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      logger.error('Error handling WebSocket disconnection:', error);
    }
  }

  // Handle client errors
  handleClientError(ws, error) {
    logger.error(`WebSocket client error (${ws.userId}):`, error);
  }

  // Handle WebSocket server errors
  handleError(error) {
    logger.error('WebSocket server error:', error);
  }

  // Send message to specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending message to client:', error);
      }
    }
  }

  // Send error message to client
  sendError(ws, message, details = null) {
    this.sendToClient(ws, {
      type: 'error',
      message: message,
      details: details,
      timestamp: new Date().toISOString()
    });
  }

  // Send notification to user
  sendNotification(userId, notification) {
    try {
      if (!this.clients.has(userId)) {
        logger.debug(`User ${userId} not connected, notification queued`);
        return false;
      }

      const message = {
        type: 'notification',
        id: notification.id || this.generateNotificationId(),
        title: notification.title,
        message: notification.message,
        category: notification.category || 'general',
        priority: notification.priority || 'normal',
        timestamp: new Date().toISOString(),
        data: notification.data || {}
      };

      const userConnections = this.clients.get(userId);
      let sent = false;

      userConnections.forEach(ws => {
        this.sendToClient(ws, message);
        sent = true;
      });

      if (sent) {
        logger.info(`Notification sent to ${userId}: ${notification.title}`);
      }

      return sent;

    } catch (error) {
      logger.error('Error sending notification:', error);
      return false;
    }
  }

  // Broadcast to all users
  broadcast(message, excludeUsers = []) {
    try {
      this.clients.forEach((connections, userId) => {
        if (!excludeUsers.includes(userId)) {
          connections.forEach(ws => {
            this.sendToClient(ws, message);
          });
        }
      });
    } catch (error) {
      logger.error('Error broadcasting message:', error);
    }
  }

  // Broadcast to room members
  broadcastToRoom(roomId, message, excludeConnections = []) {
    try {
      if (!this.rooms.has(roomId)) {
        return;
      }

      const roomConnections = this.rooms.get(roomId);
      
      this.clients.forEach((connections) => {
        connections.forEach(ws => {
          if (roomConnections.has(ws.connectionId) && 
              !excludeConnections.includes(ws.connectionId)) {
            this.sendToClient(ws, message);
          }
        });
      });

    } catch (error) {
      logger.error('Error broadcasting to room:', error);
    }
  }

  // Broadcast user status change
  broadcastUserStatus(userId, status) {
    try {
      this.broadcast({
        type: 'user_status',
        userId: userId,
        status: status,
        timestamp: new Date().toISOString()
      }, [userId]);
    } catch (error) {
      logger.error('Error broadcasting user status:', error);
    }
  }

  // Get online users
  getOnlineUsers() {
    return Array.from(this.clients.keys());
  }

  // Get room members
  getRoomMembers(roomId) {
    if (!this.rooms.has(roomId)) {
      return [];
    }

    const roomConnections = this.rooms.get(roomId);
    const members = new Set();

    this.clients.forEach((connections, userId) => {
      connections.forEach(ws => {
        if (roomConnections.has(ws.connectionId)) {
          members.add(userId);
        }
      });
    });

    return Array.from(members);
  }

  // Clean up inactive connections
  cleanupConnections() {
    try {
      let cleanedCount = 0;

      this.clients.forEach((connections, userId) => {
        const activeConnections = new Set();
        
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            // Send ping to check if connection is alive
            if (ws.isAlive === false) {
              ws.terminate();
              cleanedCount++;
            } else {
              ws.isAlive = false;
              ws.ping();
              activeConnections.add(ws);
            }
          } else {
            cleanedCount++;
          }
        });

        if (activeConnections.size > 0) {
          this.clients.set(userId, activeConnections);
        } else {
          this.clients.delete(userId);
        }
      });

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} inactive WebSocket connections`);
      }

    } catch (error) {
      logger.error('Error during connection cleanup:', error);
    }
  }

  // Generate unique IDs
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get service statistics
  getStats() {
    return {
      totalClients: this.clients.size,
      totalConnections: Array.from(this.clients.values()).reduce((sum, connections) => sum + connections.size, 0),
      totalRooms: this.rooms.size,
      uptime: this.isInitialized ? Date.now() - this.initTime : 0,
      onlineUsers: this.getOnlineUsers()
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;