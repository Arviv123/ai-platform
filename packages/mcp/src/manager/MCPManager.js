const EventEmitter = require('eventemitter3');
const MCPServer = require('../server/MCPServer');
const MCPConnection = require('../connection/MCPConnection');
const { 
  MCPError, 
  MCPConnectionError, 
  MCPTimeoutError,
  MCPConfigurationError 
} = require('../errors/MCPErrors');

class MCPManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.servers = new Map(); // serverId -> MCPServer instance
    this.connections = new Map(); // serverId -> MCPConnection instance
    this.config = {
      defaultTimeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 60000,
      maxConcurrentConnections: options.maxConcurrentConnections || 10,
      ...options
    };
    
    this.isShuttingDown = false;
    this.healthCheckTimer = null;
    
    this.startHealthCheckTimer();
  }

  // Add a new MCP server
  async addServer(serverId, serverConfig) {
    try {
      if (this.servers.has(serverId)) {
        throw new MCPError(`Server ${serverId} already exists`);
      }

      // Validate configuration
      this.validateServerConfig(serverConfig);

      // Create server instance
      const server = new MCPServer(serverId, serverConfig, this.config);
      
      // Set up event listeners
      this.setupServerEventListeners(server);
      
      // Store server
      this.servers.set(serverId, server);
      
      this.emit('server:added', { serverId, config: serverConfig });
      
      return server;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Remove MCP server
  async removeServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new MCPError(`Server ${serverId} not found`);
      }

      // Stop server if running
      await this.stopServer(serverId);
      
      // Remove from maps
      this.servers.delete(serverId);
      this.connections.delete(serverId);
      
      this.emit('server:removed', { serverId });
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Start MCP server
  async startServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new MCPError(`Server ${serverId} not found`);
      }

      // Check if already running
      if (server.isRunning()) {
        return server;
      }

      // Start server
      await server.start();
      
      // Create connection
      const connection = new MCPConnection(server, this.config);
      await connection.connect();
      
      this.connections.set(serverId, connection);
      
      this.emit('server:started', { serverId });
      
      return server;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Stop MCP server
  async stopServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      const connection = this.connections.get(serverId);
      
      if (connection) {
        await connection.disconnect();
        this.connections.delete(serverId);
      }
      
      if (server) {
        await server.stop();
      }
      
      this.emit('server:stopped', { serverId });
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Restart MCP server
  async restartServer(serverId) {
    try {
      await this.stopServer(serverId);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
      await this.startServer(serverId);
      
      this.emit('server:restarted', { serverId });
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Get server status
  getServerStatus(serverId) {
    const server = this.servers.get(serverId);
    const connection = this.connections.get(serverId);
    
    if (!server) {
      return { status: 'not_found' };
    }
    
    return {
      status: server.getStatus(),
      isRunning: server.isRunning(),
      isConnected: connection ? connection.isConnected() : false,
      config: server.getConfig(),
      stats: server.getStats(),
      lastError: server.getLastError(),
      uptime: server.getUptime(),
      healthStatus: server.getHealthStatus()
    };
  }

  // List all servers
  listServers() {
    const servers = [];
    
    for (const [serverId, server] of this.servers) {
      servers.push({
        id: serverId,
        ...this.getServerStatus(serverId)
      });
    }
    
    return servers;
  }

  // Call tool on specific server
  async callTool(serverId, toolName, parameters = {}) {
    try {
      const connection = this.connections.get(serverId);
      if (!connection || !connection.isConnected()) {
        throw new MCPConnectionError(`Server ${serverId} is not connected`);
      }

      const result = await connection.callTool(toolName, parameters);
      
      this.emit('tool:called', { serverId, toolName, parameters, result });
      
      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Get available tools for server
  async getServerTools(serverId) {
    try {
      const connection = this.connections.get(serverId);
      if (!connection || !connection.isConnected()) {
        throw new MCPConnectionError(`Server ${serverId} is not connected`);
      }

      return await connection.listTools();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Get server resources
  async getServerResources(serverId) {
    try {
      const connection = this.connections.get(serverId);
      if (!connection || !connection.isConnected()) {
        throw new MCPConnectionError(`Server ${serverId} is not connected`);
      }

      return await connection.listResources();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Read resource from server
  async readResource(serverId, resourceUri) {
    try {
      const connection = this.connections.get(serverId);
      if (!connection || !connection.isConnected()) {
        throw new MCPConnectionError(`Server ${serverId} is not connected`);
      }

      return await connection.readResource(resourceUri);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Test server connection
  async testServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new MCPError(`Server ${serverId} not found`);
      }

      // Try to start server if not running
      if (!server.isRunning()) {
        await this.startServer(serverId);
      }

      const connection = this.connections.get(serverId);
      if (!connection || !connection.isConnected()) {
        throw new MCPConnectionError(`Failed to connect to server ${serverId}`);
      }

      // Test basic functionality
      const tools = await connection.listTools();
      const resources = await connection.listResources();
      
      return {
        success: true,
        tools: tools.length,
        resources: resources.length,
        responseTime: connection.getLastResponseTime()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Perform health checks on all servers
  async performHealthChecks() {
    const results = new Map();
    
    for (const [serverId, server] of this.servers) {
      try {
        const health = await this.checkServerHealth(serverId);
        results.set(serverId, health);
      } catch (error) {
        results.set(serverId, {
          healthy: false,
          error: error.message
        });
      }
    }
    
    this.emit('health:checked', Object.fromEntries(results));
    
    return results;
  }

  // Check health of specific server
  async checkServerHealth(serverId) {
    const server = this.servers.get(serverId);
    const connection = this.connections.get(serverId);
    
    if (!server) {
      return { healthy: false, reason: 'Server not found' };
    }
    
    const health = {
      healthy: true,
      server: {
        running: server.isRunning(),
        status: server.getStatus(),
        uptime: server.getUptime(),
        memory: server.getMemoryUsage(),
        cpu: server.getCpuUsage()
      },
      connection: {
        connected: connection ? connection.isConnected() : false,
        responseTime: connection ? connection.getLastResponseTime() : null,
        errorCount: connection ? connection.getErrorCount() : 0
      }
    };
    
    // Determine overall health
    if (!health.server.running || 
        !health.connection.connected || 
        health.connection.responseTime > 5000 ||
        health.connection.errorCount > 10) {
      health.healthy = false;
      health.reason = 'Performance or connectivity issues';
    }
    
    return health;
  }

  // Update server configuration
  async updateServerConfig(serverId, newConfig) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new MCPError(`Server ${serverId} not found`);
      }

      // Validate new configuration
      this.validateServerConfig(newConfig);
      
      const wasRunning = server.isRunning();
      
      // Stop server if running
      if (wasRunning) {
        await this.stopServer(serverId);
      }
      
      // Update configuration
      server.updateConfig(newConfig);
      
      // Restart if it was running
      if (wasRunning) {
        await this.startServer(serverId);
      }
      
      this.emit('server:config_updated', { serverId, config: newConfig });
      
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Get manager statistics
  getStats() {
    const stats = {
      totalServers: this.servers.size,
      runningServers: 0,
      connectedServers: 0,
      healthyServers: 0,
      totalUptime: 0,
      averageResponseTime: 0
    };
    
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    for (const [serverId, server] of this.servers) {
      if (server.isRunning()) {
        stats.runningServers++;
        stats.totalUptime += server.getUptime();
      }
      
      const connection = this.connections.get(serverId);
      if (connection && connection.isConnected()) {
        stats.connectedServers++;
        
        const responseTime = connection.getLastResponseTime();
        if (responseTime) {
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }
      
      if (server.getHealthStatus() === 'healthy') {
        stats.healthyServers++;
      }
    }
    
    if (responseTimeCount > 0) {
      stats.averageResponseTime = totalResponseTime / responseTimeCount;
    }
    
    return stats;
  }

  // Shutdown manager
  async shutdown() {
    this.isShuttingDown = true;
    
    // Stop health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Stop all servers
    const shutdownPromises = [];
    for (const serverId of this.servers.keys()) {
      shutdownPromises.push(this.stopServer(serverId));
    }
    
    await Promise.all(shutdownPromises);
    
    this.emit('manager:shutdown');
  }

  // Private methods
  validateServerConfig(config) {
    if (!config.command) {
      throw new MCPConfigurationError('Command is required');
    }
    
    if (!Array.isArray(config.args)) {
      config.args = [];
    }
    
    if (!config.env || typeof config.env !== 'object') {
      config.env = {};
    }
    
    if (typeof config.enabled !== 'boolean') {
      config.enabled = true;
    }
  }

  setupServerEventListeners(server) {
    server.on('started', () => {
      this.emit('server:started', { serverId: server.getId() });
    });
    
    server.on('stopped', () => {
      this.emit('server:stopped', { serverId: server.getId() });
    });
    
    server.on('error', (error) => {
      this.emit('server:error', { serverId: server.getId(), error });
    });
    
    server.on('output', (data) => {
      this.emit('server:output', { serverId: server.getId(), data });
    });
  }

  startHealthCheckTimer() {
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        if (!this.isShuttingDown) {
          this.performHealthChecks();
        }
      }, this.config.healthCheckInterval);
    }
  }
}

module.exports = MCPManager;