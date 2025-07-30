const EventEmitter = require('eventemitter3');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { MCPError, MCPTimeoutError } = require('../errors/MCPErrors');

class MCPServer extends EventEmitter {
  constructor(serverId, config, globalConfig = {}) {
    super();
    
    this.id = serverId;
    this.config = {
      command: config.command,
      args: config.args || [],
      env: { ...process.env, ...config.env },
      cwd: config.cwd || process.cwd(),
      enabled: config.enabled !== false,
      timeout: config.timeout || globalConfig.defaultTimeout || 30000,
      maxRetries: config.maxRetries || globalConfig.maxRetries || 3,
      retryDelay: config.retryDelay || globalConfig.retryDelay || 1000,
      ...config
    };
    
    this.process = null;
    this.status = 'stopped';
    this.startTime = null;
    this.lastError = null;
    this.retryCount = 0;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    this.healthStatus = 'unknown';
  }

  getId() {
    return this.id;
  }

  getConfig() {
    return { ...this.config };
  }

  getStatus() {
    return this.status;
  }

  isRunning() {
    return this.status === 'running' && this.process && !this.process.killed;
  }

  getLastError() {
    return this.lastError;
  }

  getUptime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  getStats() {
    return { ...this.stats };
  }

  getHealthStatus() {
    return this.healthStatus;
  }

  getMemoryUsage() {
    if (!this.process || !this.process.pid) return 0;
    try {
      // Simple memory usage estimation
      return process.memoryUsage().heapUsed;
    } catch (error) {
      return 0;
    }
  }

  getCpuUsage() {
    // Simple CPU usage estimation
    return process.cpuUsage().user + process.cpuUsage().system;
  }

  async start() {
    try {
      if (this.isRunning()) {
        return this;
      }

      if (!this.config.enabled) {
        throw new MCPError(`Server ${this.id} is disabled`);
      }

      this.status = 'starting';
      this.emit('starting');

      // Spawn the MCP server process
      this.process = spawn(this.config.command, this.config.args, {
        env: this.config.env,
        cwd: this.config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up process event listeners
      this.setupProcessEventListeners();

      // Wait for the process to start
      await this.waitForStart();

      this.status = 'running';
      this.startTime = Date.now();
      this.healthStatus = 'healthy';
      this.retryCount = 0;
      
      this.emit('started');
      return this;

    } catch (error) {
      this.status = 'error';
      this.lastError = error;
      this.healthStatus = 'unhealthy';
      this.emit('error', error);
      throw error;
    }
  }

  async stop() {
    try {
      if (!this.isRunning()) {
        return true;
      }

      this.status = 'stopping';
      this.emit('stopping');

      if (this.process) {
        // Try graceful shutdown first
        this.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          this.process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      this.process = null;
      this.status = 'stopped';
      this.startTime = null;
      this.healthStatus = 'unknown';
      
      this.emit('stopped');
      return true;

    } catch (error) {
      this.lastError = error;
      this.emit('error', error);
      throw error;
    }
  }

  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
    return this;
  }

  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      env: { ...this.config.env, ...newConfig.env }
    };
    this.emit('config:updated', this.config);
  }

  sendMessage(message) {
    if (!this.isRunning() || !this.process || !this.process.stdin) {
      throw new MCPError(`Server ${this.id} is not running`);
    }

    try {
      const messageStr = JSON.stringify(message) + '\n';
      this.process.stdin.write(messageStr);
      this.stats.totalRequests++;
    } catch (error) {
      this.stats.failedRequests++;
      throw new MCPError(`Failed to send message to server ${this.id}: ${error.message}`);
    }
  }

  // Private methods
  setupProcessEventListeners() {
    if (!this.process) return;

    this.process.stdout.on('data', (data) => {
      this.emit('output', { type: 'stdout', data: data.toString() });
    });

    this.process.stderr.on('data', (data) => {
      this.emit('output', { type: 'stderr', data: data.toString() });
    });

    this.process.on('exit', (code, signal) => {
      this.status = 'stopped';
      this.process = null;
      this.healthStatus = 'unknown';
      
      this.emit('exit', { code, signal });
      
      if (code !== 0 && code !== null) {
        const error = new MCPError(`Server ${this.id} exited with code ${code}`);
        this.lastError = error;
        this.emit('error', error);
      }
    });

    this.process.on('error', (error) => {
      this.status = 'error';
      this.lastError = error;
      this.healthStatus = 'unhealthy';
      this.emit('error', error);
    });
  }

  async waitForStart() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new MCPTimeoutError(`Server ${this.id} failed to start within timeout`));
      }, this.config.timeout);

      // Simple check - assume started if process is running
      const checkInterval = setInterval(() => {
        if (this.process && !this.process.killed) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      this.process.once('error', (error) => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        reject(error);
      });

      this.process.once('exit', (code) => {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        if (code !== 0) {
          reject(new MCPError(`Server ${this.id} exited during startup with code ${code}`));
        }
      });
    });
  }
}

module.exports = MCPServer;