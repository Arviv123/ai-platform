'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface WebSocketOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

export interface WebSocketState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: WebSocketMessage | null;
  error: string | null;
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    debug = false
  } = options;

  const { isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageHandlersRef = useRef<Map<string, ((message: WebSocketMessage) => void)[]>>(new Map());

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    lastMessage: null,
    error: null
  });

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }, [debug]);

  const getWebSocketURL = useCallback(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = 'nedlan-ai-api.onrender.com';
    return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated) {
      log('Not authenticated, skipping WebSocket connection');
      return;
    }

    const wsUrl = getWebSocketURL();
    if (!wsUrl) {
      log('No auth token available, cannot connect');
      setState(prev => ({ ...prev, connectionStatus: 'error', error: 'No auth token' }));
      return;
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting', error: null }));
    log('Connecting to WebSocket:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        log('WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          connectionStatus: 'connected',
          error: null
        }));
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          log('Received message:', message);
          
          setState(prev => ({ ...prev, lastMessage: message }));

          // Call registered handlers for this message type
          const handlers = messageHandlersRef.current.get(message.type) || [];
          handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in WebSocket message handler:', error);
            }
          });

          // Call 'all' handlers
          const allHandlers = messageHandlersRef.current.get('*') || [];
          allHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in WebSocket message handler:', error);
            }
          });

        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        log('WebSocket disconnected:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected'
        }));

        wsRef.current = null;

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            connectionStatus: 'error',
            error: 'Max reconnection attempts reached'
          }));
        }
      };

      ws.onerror = (error) => {
        log('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          connectionStatus: 'error',
          error: 'Connection error'
        }));
      };

    } catch (error) {
      log('Error creating WebSocket connection:', error);
      setState(prev => ({
        ...prev,
        connectionStatus: 'error',
        error: 'Failed to create connection'
      }));
    }
  }, [isAuthenticated, getWebSocketURL, log, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    log('Disconnecting WebSocket');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, 'Normal closure');
    }
    
    wsRef.current = null;
    setState(prev => ({
      ...prev,
      isConnected: false,
      connectionStatus: 'disconnected',
      error: null
    }));
  }, [log]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
      log('Sent message:', message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }, [log]);

  const addMessageHandler = useCallback((messageType: string, handler: (message: WebSocketMessage) => void) => {
    const handlers = messageHandlersRef.current.get(messageType) || [];
    handlers.push(handler);
    messageHandlersRef.current.set(messageType, handlers);

    // Return cleanup function
    return () => {
      const currentHandlers = messageHandlersRef.current.get(messageType) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
        if (currentHandlers.length === 0) {
          messageHandlersRef.current.delete(messageType);
        } else {
          messageHandlersRef.current.set(messageType, currentHandlers);
        }
      }
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    return sendMessage({ type: 'join_room', roomId });
  }, [sendMessage]);

  const leaveRoom = useCallback((roomId: string) => {
    return sendMessage({ type: 'leave_room', roomId });
  }, [sendMessage]);

  const sendPing = useCallback(() => {
    return sendMessage({ type: 'ping' });
  }, [sendMessage]);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    addMessageHandler,
    joinRoom,
    leaveRoom,
    sendPing
  };
}