const { spawn, exec } = require('child_process');
const { EventEmitter } = require('events');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class MCPService extends EventEmitter {
  constructor() {
    super();
    this.servers = new Map(); // serverId -> serverInstance
    this.serverProcesses = new Map(); // serverId -> process
    this.serversDir = process.env.MCP_SERVERS_DIR || './mcp-servers';
    this.healthCheckInterval = 30000; // 30 seconds
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    
    this.init();
  }

  async init() {
    try {
      // Ensure MCP servers directory exists
      await fs.mkdir(this.serversDir, { recursive: true });
      
      // Load existing servers from database
      await this.loadServersFromDatabase();
      
      // Start health check routine
      this.startHealthChecking();
      
      logger.info('MCP Service initialized');
    } catch (error) {
      logger.error('Failed to initialize MCP Service:', error);
    }
  }

  // Load servers from database
  async loadServersFromDatabase() {
    try {
      const servers = await prisma.mcpServer.findMany({
        where: { 
          enabled: true,
          deletedAt: null
        }
      });
      
      for (const server of servers) {
        // Auto-start enabled servers
        if (server.enabled && server.healthStatus === 'HEALTHY') {
          try {
            await this.startServer(server.id);
          } catch (error) {
            logger.error(`Failed to auto-start server ${server.id}:`, error);
          }
        }
      }
      
      logger.info(`Loaded ${servers.length} MCP servers from database`);
    } catch (error) {
      logger.error('Failed to load servers from database:', error);
    }
  }

  // Get all MCP servers for a user
  async getUserServers(userId) {
    try {
      const servers = await prisma.mcpServer.findMany({
        where: { 
          userId,
          deletedAt: null 
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Add runtime status information
      const serversWithStatus = servers.map(server => ({
        ...server,
        args: JSON.parse(server.args || '[]'),
        env: JSON.parse(server.env || '{}'),
        isRunning: this.serverProcesses.has(server.id),
        runtimeStatus: this.getServerRuntimeStatus(server.id)
      }));
      
      return serversWithStatus;
    } catch (error) {
      logger.error('Error fetching user MCP servers:', error);
      throw error;
    }
  }

  // Get all servers (admin only)
  async getAllServers() {
    try {
      const servers = await prisma.mcpServer.findMany({
        where: { deletedAt: null },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return servers.map(server => ({
        ...server,
        args: JSON.parse(server.args || '[]'),
        env: JSON.parse(server.env || '{}'),
        isRunning: this.serverProcesses.has(server.id)
      }));
    } catch (error) {
      logger.error('Error fetching all MCP servers:', error);
      throw error;
    }
  }

  // Create new MCP server configuration
  async createServer(userId, serverConfig) {
    try {
      const { 
        name, 
        description, 
        command, 
        args = [], 
        env = {}, 
        enabled = true 
      } = serverConfig;
      
      if (!name || !command) {
        throw new Error('Server name and command are required');
      }
      
      // Validate server configuration
      await this.validateServerConfig(command, args, env);
      
      const server = await prisma.mcpServer.create({
        data: {
          userId,
          name,
          description: description || '',
          command,
          args: JSON.stringify(args),
          env: JSON.stringify(env),
          enabled,
          healthStatus: 'UNKNOWN',
          totalCalls: 0
        }
      });

      logger.info(`MCP server created: ${server.id} for user ${userId}`);
      
      // Start the server if enabled
      if (enabled) {
        try {
          await this.startServer(server.id);
        } catch (error) {
          logger.error(`Failed to start server ${server.id} after creation:`, error);
        }
      }
      
      return {
        ...server,
        args: JSON.parse(server.args),
        env: JSON.parse(server.env)
      };
    } catch (error) {
      logger.error('Error creating MCP server:', error);
      throw error;
    }
  }

  // Update MCP server configuration
  async updateServer(serverId, userId, updates) {
    try {
      // Verify ownership
      const existingServer = await prisma.mcpServer.findFirst({
        where: { id: serverId, userId, deletedAt: null }
      });
      
      if (!existingServer) {
        throw new Error('Server not found or access denied');
      }
      
      // Stop server if it's running and config changed
      const configChanged = updates.command || updates.args || updates.env;
      if (configChanged && this.serverProcesses.has(serverId)) {
        await this.stopServer(serverId);
      }
      
      const server = await prisma.mcpServer.update({
        where: { id: serverId },
        data: {
          ...updates,
          args: updates.args ? JSON.stringify(updates.args) : undefined,
          env: updates.env ? JSON.stringify(updates.env) : undefined,
          updatedAt: new Date()
        }
      });
      
      // Restart server if enabled and config changed
      if (server.enabled && configChanged) {
        try {
          await this.startServer(serverId);
        } catch (error) {
          logger.error(`Failed to restart server ${serverId} after update:`, error);
        }
      }
      
      return {
        ...server,
        args: JSON.parse(server.args || '[]'),
        env: JSON.parse(server.env || '{}')
      };
    } catch (error) {
      logger.error('Error updating MCP server:', error);
      throw error;
    }
  }

  // Start MCP server process
  async startServer(serverId) {
    try {
      const server = await prisma.mcpServer.findUnique({
        where: { id: serverId }
      });
      
      if (!server || !server.enabled) {
        throw new Error('Server not found or not enabled');
      }
      
      // Check if already running
      if (this.serverProcesses.has(serverId)) {
        logger.warn(`Server ${serverId} is already running`);
        return;
      }
      
      const args = JSON.parse(server.args || '[]');
      const env = JSON.parse(server.env || '{}');
      
      // Update status to starting
      await this.updateServerStatus(serverId, 'STARTING');
      
      // Spawn the MCP server process with Windows compatibility
      const isWindows = process.platform === 'win32';
      const spawnOptions = {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      };
      
      // On Windows, add shell option for better compatibility
      if (isWindows) {
        spawnOptions.shell = true;
      }
      
      const childProcess = spawn(server.command, args, spawnOptions);
      
      // Store process reference
      this.serverProcesses.set(serverId, childProcess);
      
      // Setup process event handlers
      this.setupProcessHandlers(serverId, childProcess);
      
      logger.info(`MCP server ${serverId} starting...`);
      
      // Wait for server to initialize
      await this.waitForServerReady(serverId, childProcess);
      
      return childProcess;
    } catch (error) {
      logger.error(`Error starting MCP server ${serverId}:`, error);
      await this.updateServerStatus(serverId, 'ERROR');
      throw error;
    }
  }

  // Stop MCP server process with Windows compatibility
  async stopServer(serverId) {
    try {
      const childProcess = this.serverProcesses.get(serverId);
      
      if (!childProcess) {
        logger.warn(`Server ${serverId} is not running`);
        return;
      }
      
      const isWindows = process.platform === 'win32';
      
      // Graceful shutdown
      if (isWindows) {
        // On Windows, use taskkill for better process termination
        try {
          exec(`taskkill /pid ${childProcess.pid} /t /f`, (error) => {
            if (error) {
              logger.warn(`Failed to kill process tree for ${serverId}:`, error);
            }
          });
        } catch (error) {
          logger.warn(`Taskkill failed for ${serverId}, falling back to kill()`, error);
          childProcess.kill('SIGTERM');
        }
      } else {
        childProcess.kill('SIGTERM');
      }
      
      // Force kill after timeout
      setTimeout(() => {
        if (!childProcess.killed) {
          if (isWindows) {
            exec(`taskkill /pid ${childProcess.pid} /t /f`);
          } else {
            childProcess.kill('SIGKILL');
          }
        }
      }, 10000);
      
      // Remove from tracking
      this.serverProcesses.delete(serverId);
      this.servers.delete(serverId);
      
      // Update status
      await this.updateServerStatus(serverId, 'STOPPED');
      
      logger.info(`MCP server ${serverId} stopped`);
    } catch (error) {
      logger.error(`Error stopping MCP server ${serverId}:`, error);
      throw error;
    }
  }

  // Remove an MCP server
  async removeServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Server not found: ${serverId}`);
      }

      // Stop the server first
      await this.stopServer(serverId);
      
      // Remove from memory
      this.servers.delete(serverId);
      
      logger.info(`MCP server removed: ${server.name} (${serverId})`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to remove MCP server ${serverId}:`, error);
      throw error;
    }
  }

  // Get server status
  async getServerStatus(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Server not found: ${serverId}`);
      }

      // Ping the server to check if it's responsive
      const isResponsive = await this.pingServer(serverId);
      
      return {
        id: serverId,
        name: server.name,
        status: server.status,
        responsive: isResponsive,
        lastPing: server.lastPing,
        uptime: server.status === 'running' ? Date.now() - server.lastPing?.getTime() : 0
      };
    } catch (error) {
      logger.error(`Failed to get server status ${serverId}:`, error);
      throw error;
    }
  }

  // Ping an MCP server
  async pingServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server || server.status !== 'running') {
        return false;
      }

      // In a real implementation, this would send a ping request to the MCP server
      // For demo purposes, we'll simulate a successful ping
      
      server.lastPing = new Date();
      return true;
    } catch (error) {
      logger.error(`Failed to ping server ${serverId}:`, error);
      return false;
    }
  }

  // Get server logs
  async getServerLogs(serverId, lines = 100) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Server not found: ${serverId}`);
      }

      // In a real implementation, this would read actual log files
      // For demo purposes, we'll return simulated logs
      
      const now = new Date();
      const logs = [];
      
      for (let i = lines; i > 0; i--) {
        const timestamp = new Date(now.getTime() - (i * 60000));
        logs.push({
          timestamp: timestamp.toISOString(),
          level: i % 10 === 0 ? 'error' : i % 5 === 0 ? 'warn' : 'info',
          message: `MCP server ${server.name} - Simulated log entry ${lines - i + 1}`
        });
      }
      
      return logs;
    } catch (error) {
      logger.error(`Failed to get server logs ${serverId}:`, error);
      throw error;
    }
  }

  // Update server configuration
  async updateServerConfig(serverId, newConfig) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Server not found: ${serverId}`);
      }

      const oldConfig = { ...server.config };
      server.config = { ...server.config, ...newConfig };
      server.updatedAt = new Date();
      
      logger.info(`MCP server config updated: ${server.name} (${serverId})`);
      
      // If server is running, restart it with new config
      if (server.status === 'running') {
        await this.stopServer(serverId);
        await this.startServer(serverId);
      }
      
      return {
        id: serverId,
        oldConfig,
        newConfig: server.config,
        restarted: server.status === 'running'
      };
    } catch (error) {
      logger.error(`Failed to update server config ${serverId}:`, error);
      throw error;
    }
  }

  // Health check for all servers
  async healthCheck() {
    try {
      const results = [];
      
      for (const [serverId, server] of this.servers) {
        const isResponsive = await this.pingServer(serverId);
        
        results.push({
          id: serverId,
          name: server.name,
          status: server.status,
          responsive: isResponsive,
          lastPing: server.lastPing
        });
      }
      
      return {
        timestamp: new Date().toISOString(),
        total: this.servers.size,
        running: results.filter(r => r.status === 'running').length,
        responsive: results.filter(r => r.responsive).length,
        servers: results
      };
    } catch (error) {
      logger.error('MCP health check failed:', error);
      throw error;
    }
  }

  // Get MCP server statistics
  async getStatistics() {
    try {
      const servers = Array.from(this.servers.values());
      
      const stats = {
        total: servers.length,
        active: servers.filter(s => s.status === 'running').length,
        inactive: servers.filter(s => s.status === 'inactive').length,
        error: servers.filter(s => s.status === 'error').length,
        byStatus: {},
        averageUptime: 0,
        oldestServer: null,
        newestServer: null
      };

      // Group by status
      servers.forEach(server => {
        stats.byStatus[server.status] = (stats.byStatus[server.status] || 0) + 1;
      });

      // Calculate average uptime for running servers
      const runningServers = servers.filter(s => s.status === 'running' && s.lastPing);
      if (runningServers.length > 0) {
        const totalUptime = runningServers.reduce((sum, server) => {
          return sum + (Date.now() - server.lastPing.getTime());
        }, 0);
        stats.averageUptime = totalUptime / runningServers.length;
      }

      // Find oldest and newest servers
      if (servers.length > 0) {
        stats.oldestServer = servers.reduce((oldest, server) => 
          server.createdAt < oldest.createdAt ? server : oldest
        );
        stats.newestServer = servers.reduce((newest, server) => 
          server.createdAt > newest.createdAt ? server : newest
        );
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get MCP statistics:', error);
      throw error;
    }
  }

  // Execute tool on MCP server
  async executeTool(serverId, toolName, parameters) {
    try {
      const startTime = Date.now();
      
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error('Server not connected or not running');
      }
      
      // Simulate tool execution for demo
      const result = { 
        success: true, 
        result: `Tool ${toolName} executed successfully`,
        parameters 
      };
      
      const executionTime = Date.now() - startTime;
      
      // Log tool execution
      await prisma.mcpToolCall.create({
        data: {
          serverId,
          toolName,
          parameters: JSON.stringify(parameters),
          response: JSON.stringify(result),
          success: true,
          executionTime
        }
      });
      
      // Update server usage stats
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: {
          totalCalls: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
      
      return result;
    } catch (error) {
      logger.error(`Error executing tool ${toolName} on server ${serverId}:`, error);
      
      // Log failed execution
      await prisma.mcpToolCall.create({
        data: {
          serverId,
          toolName,
          parameters: JSON.stringify(parameters),
          response: null,
          success: false,
          errorMessage: error.message,
          executionTime: Date.now() - startTime
        }
      });
      
      throw error;
    }
  }

  // Setup process event handlers
  setupProcessHandlers(serverId, process) {
    process.on('spawn', () => {
      logger.info(`MCP server ${serverId} spawned successfully`);
    });
    
    process.on('error', async (error) => {
      logger.error(`MCP server ${serverId} process error:`, error);
      await this.updateServerStatus(serverId, 'ERROR');
      this.emit('serverError', { serverId, error });
    });
    
    process.on('exit', async (code, signal) => {
      logger.info(`MCP server ${serverId} exited with code ${code}, signal ${signal}`);
      
      // Clean up
      this.serverProcesses.delete(serverId);
      this.servers.delete(serverId);
      
      await this.updateServerStatus(serverId, code === 0 ? 'STOPPED' : 'ERROR');
      this.emit('serverExit', { serverId, code, signal });
      
      // Auto-restart if enabled and unexpected exit
      if (code !== 0) {
        await this.handleServerCrash(serverId);
      }
    });
  }

  // Wait for server to be ready
  async waitForServerReady(serverId, process, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkReady = async () => {
        try {
          if (Date.now() - startTime > timeout) {
            reject(new Error('Server startup timeout'));
            return;
          }
          
          if (process.killed || process.exitCode !== null) {
            reject(new Error('Server process died during startup'));
            return;
          }
          
          // For demo, assume ready after 3 seconds
          if (Date.now() - startTime > 3000) {
            await this.updateServerStatus(serverId, 'HEALTHY');
            resolve(true);
          } else {
            setTimeout(checkReady, 1000);
          }
        } catch (error) {
          setTimeout(checkReady, 1000);
        }
      };
      
      setTimeout(checkReady, 1000);
    });
  }

  // Start health checking routine
  startHealthChecking() {
    setInterval(async () => {
      for (const [serverId] of this.serverProcesses) {
        try {
          const isHealthy = await this.checkServerHealth(serverId);
          await this.updateServerStatus(serverId, isHealthy ? 'HEALTHY' : 'UNHEALTHY');
        } catch (error) {
          logger.error(`Health check failed for server ${serverId}:`, error);
          await this.updateServerStatus(serverId, 'ERROR');
        }
      }
    }, this.healthCheckInterval);
  }

  // Check server health
  async checkServerHealth(serverId) {
    const process = this.serverProcesses.get(serverId);
    return process && !process.killed && process.exitCode === null;
  }

  // Update server status in database
  async updateServerStatus(serverId, status) {
    try {
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: {
          healthStatus: status,
          lastHealthCheck: new Date()
        }
      });
      logger.info(`Server ${serverId} status updated to: ${status}`);
    } catch (error) {
      logger.error(`Error updating server ${serverId} status:`, error);
    }
  }

  // Handle server crash and auto-restart
  async handleServerCrash(serverId) {
    try {
      const server = await prisma.mcpServer.findUnique({
        where: { id: serverId }
      });
      
      if (!server || !server.enabled) {
        return;
      }
      
      logger.warn(`Server ${serverId} crashed, attempting restart...`);
      
      // Wait before restart
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      
      // Restart server
      await this.startServer(serverId);
      
    } catch (error) {
      logger.error(`Failed to restart server ${serverId}:`, error);
    }
  }

  // Validate server configuration with better Windows support
  async validateServerConfig(command, args, env) {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const checkCommand = isWindows ? `where "${command}"` : `which "${command}"`;
      
      exec(checkCommand, (error, stdout, stderr) => {
        if (error) {
          // For Windows, also try looking in common paths
          if (isWindows) {
            const commonPaths = [
              'C:\\Program Files\\nodejs\\',
              'C:\\Program Files (x86)\\nodejs\\',
              process.env.APPDATA ? `${process.env.APPDATA}\\npm\\` : ''
            ].filter(Boolean);
            
            const fullCommand = commonPaths.find(path => {
              try {
                require('fs').accessSync(`${path}${command}.exe`);
                return true;
              } catch {
                return false;
              }
            });
            
            if (fullCommand) {
              resolve(true);
              return;
            }
          }
          
          reject(new Error(`Command '${command}' not found. Make sure it's installed and in your PATH.`));
        } else {
          resolve(true);
        }
      });
    });
  }

  // Get server runtime status
  getServerRuntimeStatus(serverId) {
    const process = this.serverProcesses.get(serverId);
    if (!process) {
      return { status: 'stopped', pid: null, uptime: 0 };
    }
    
    return {
      status: 'running',
      pid: process.pid,
      uptime: Date.now() - process.spawnArgs?.timestamp || 0
    };
  }

  // Get server statistics
  async getServerStats(serverId) {
    try {
      const server = await prisma.mcpServer.findUnique({
        where: { id: serverId },
        include: {
          toolCalls: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });
      
      if (!server) {
        throw new Error('Server not found');
      }
      
      const stats = await prisma.mcpToolCall.aggregate({
        where: { serverId },
        _count: { id: true },
        _avg: { executionTime: true },
        _sum: { executionTime: true }
      });
      
      return {
        server: {
          ...server,
          args: JSON.parse(server.args || '[]'),
          env: JSON.parse(server.env || '{}')
        },
        stats: {
          totalCalls: stats._count.id || 0,
          averageExecutionTime: stats._avg.executionTime || 0,
          totalExecutionTime: stats._sum.executionTime || 0
        },
        recentCalls: server.toolCalls,
        runtimeStatus: this.getServerRuntimeStatus(serverId)
      };
    } catch (error) {
      logger.error(`Error getting server stats for ${serverId}:`, error);
      throw error;
    }
  }

  // Remove server (soft delete)
  async removeServer(serverId, userId) {
    try {
      // Verify ownership
      const server = await prisma.mcpServer.findFirst({
        where: { id: serverId, userId, deletedAt: null }
      });
      
      if (!server) {
        throw new Error('Server not found or access denied');
      }
      
      // Stop the server first
      if (this.serverProcesses.has(serverId)) {
        await this.stopServer(serverId);
      }
      
      // Soft delete
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: { 
          deletedAt: new Date(),
          enabled: false
        }
      });
      
      logger.info(`MCP server removed: ${serverId}`);
      return true;
    } catch (error) {
      logger.error(`Error removing server ${serverId}:`, error);
      throw error;
    }
  }

  // Shutdown all servers
  async shutdown() {
    logger.info('Shutting down MCP service...');
    
    const shutdownPromises = Array.from(this.serverProcesses.keys()).map(serverId => 
      this.stopServer(serverId)
    );
    
    await Promise.allSettled(shutdownPromises);
    
    logger.info('MCP service shutdown complete');
  }
}

// Create singleton instance
const mcpService = new MCPService();

// Graceful shutdown handling
process.on('SIGTERM', () => mcpService.shutdown());
process.on('SIGINT', () => mcpService.shutdown());

module.exports = mcpService;