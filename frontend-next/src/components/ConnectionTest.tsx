'use client';

import { useState, useEffect } from 'react';
import { apiHelpers } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';

interface ConnectionStatus {
  isConnected: boolean;
  latency: number | null;
  lastChecked: Date | null;
  error?: string;
}

export default function ConnectionTest() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    latency: null,
    lastChecked: null
  });
  const [isChecking, setIsChecking] = useState(false);
  
  // WebSocket connection
  const {
    isConnected: wsConnected,
    connectionStatus: wsStatus,
    error: wsError,
    sendPing
  } = useWebSocket({ debug: true });

  const checkConnection = async () => {
    setIsChecking(true);
    const startTime = Date.now();
    
    try {
      const isHealthy = await apiHelpers.healthCheck();
      const latency = Date.now() - startTime;
      
      setStatus({
        isConnected: isHealthy,
        latency,
        lastChecked: new Date(),
        error: isHealthy ? undefined : 'Health check failed'
      });
    } catch (error: any) {
      setStatus({
        isConnected: false,
        latency: null,
        lastChecked: new Date(),
        error: error.message || 'Connection failed'
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (isChecking) return 'text-yellow-400';
    return status.isConnected ? 'text-green-400' : 'text-red-400';
  };

  const getStatusIcon = () => {
    if (isChecking) return '⏳';
    return status.isConnected ? '✅' : '❌';
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    return status.isConnected ? 'Connected' : 'Disconnected';
  };

  const getWSStatusColor = () => {
    switch (wsStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getWSStatusIcon = () => {
    switch (wsStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      default: return '⚫';
    }
  };

  return (
    <div className="space-y-4">
      {/* HTTP API Connection */}
      <div className="glass p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getStatusIcon()}</span>
            <div>
              <h3 className="text-white font-medium">API Connection</h3>
              <div className="flex items-center space-x-2 text-sm">
                <span className={getStatusColor()}>{getStatusText()}</span>
                {status.latency && (
                  <span className="text-gray-400">
                    ({status.latency}ms)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={checkConnection}
            disabled={isChecking}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm rounded transition-colors"
          >
            {isChecking ? 'Checking...' : 'Test Now'}
          </button>
        </div>
        
        {status.error && (
          <div className="mt-3 p-2 bg-red-900/20 border border-red-500/20 rounded text-red-400 text-sm">
            Error: {status.error}
          </div>
        )}
        
        {status.lastChecked && (
          <div className="mt-2 text-xs text-gray-500">
            Last checked: {status.lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* WebSocket Connection */}
      <div className="glass p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getWSStatusIcon()}</span>
            <div>
              <h3 className="text-white font-medium">WebSocket Connection</h3>
              <div className="flex items-center space-x-2 text-sm">
                <span className={getWSStatusColor()}>{wsStatus}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => sendPing()}
            disabled={!wsConnected}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white text-sm rounded transition-colors"
          >
            {wsConnected ? 'Ping' : 'Disconnected'}
          </button>
        </div>
        
        {wsError && (
          <div className="mt-3 p-2 bg-red-900/20 border border-red-500/20 rounded text-red-400 text-sm">
            Error: {wsError}
          </div>
        )}
      </div>

      {/* Connection Details */}
      <div className="glass p-4 rounded-lg">
        <h4 className="text-white font-medium mb-3">Connection Details</h4>
        <div className="space-y-2 text-sm">
          <div className="text-gray-300">
            <strong>API Base URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.railway.app'}
          </div>
          <div className="text-gray-300">
            <strong>Environment:</strong> {process.env.NODE_ENV || 'development'}
          </div>
          <div className="text-gray-300">
            <strong>WebSocket Status:</strong> 
            <span className={`ml-1 ${getWSStatusColor()}`}>{wsStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
}