const EventEmitter = require('eventemitter3');
const { v4: uuidv4 } = require('uuid');
const { MCPError, MCPConnectionError, MCPTimeoutError } = require('../errors/MCPErrors');

class MCPConnection extends EventEmitter {
  constructor(server, config = {}) {
    super();
    
    this.server = server;
    this.config = {
      timeout: config.timeout || config.defaultTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
    
    this.isConnectedFlag = false;
    this.pendingRequests = new Map();
    this.lastResponseTime = null;
    this.errorCount = 0;
    this.messageBuffer = '';
    
    this.setupServerEventListeners();
  }

  isConnected() {
    return this.isConnectedFlag && this.server.isRunning();
  }

  getLastResponseTime() {
    return this.lastResponseTime;
  }

  getErrorCount() {
    return this.errorCount;
  }

  async connect() {
    try {
      if (this.isConnected()) {
        return this;
      }

      if (!this.server.isRunning()) {
        throw new MCPConnectionError('Server is not running');
      }

      // Send initialize request
      const initResponse = await this.sendRequest({
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          clientInfo: {
            name: 'mcp-manager',
            version: '1.0.0'
          }
        }
      });

      if (initResponse.error) {
        throw new MCPConnectionError(`Initialization failed: ${initResponse.error.message}`);
      }

      this.isConnectedFlag = true;
      this.emit('connected');
      
      return this;

    } catch (error) {
      this.errorCount++;
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (!this.isConnected()) {
        return true;
      }

      // Clear pending requests
      for (const [id, request] of this.pendingRequests) {
        request.reject(new MCPConnectionError('Connection closed'));
      }
      this.pendingRequests.clear();

      this.isConnectedFlag = false;
      this.emit('disconnected');
      
      return true;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async callTool(toolName, parameters = {}) {
    if (!this.isConnected()) {
      throw new MCPConnectionError('Not connected to server');
    }

    try {
      const response = await this.sendRequest({
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters
        }
      });

      if (response.error) {
        throw new MCPError(`Tool call failed: ${response.error.message}`);
      }

      return response.result;

    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  async listTools() {
    if (!this.isConnected()) {
      throw new MCPConnectionError('Not connected to server');
    }

    try {
      const response = await this.sendRequest({
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'tools/list'
      });

      if (response.error) {
        throw new MCPError(`List tools failed: ${response.error.message}`);
      }

      return response.result.tools || [];

    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  async listResources() {
    if (!this.isConnected()) {
      throw new MCPConnectionError('Not connected to server');
    }

    try {
      const response = await this.sendRequest({
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'resources/list'
      });

      if (response.error) {
        throw new MCPError(`List resources failed: ${response.error.message}`);
      }

      return response.result.resources || [];

    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  async readResource(resourceUri) {
    if (!this.isConnected()) {
      throw new MCPConnectionError('Not connected to server');
    }

    try {
      const response = await this.sendRequest({
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'resources/read',
        params: {
          uri: resourceUri
        }
      });

      if (response.error) {
        throw new MCPError(`Read resource failed: ${response.error.message}`);
      }

      return response.result;

    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const requestId = request.id;
      const startTime = Date.now();

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, startTime });

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.errorCount++;
        reject(new MCPTimeoutError(`Request ${requestId} timed out`));
      }, this.config.timeout);

      try {
        // Send request to server
        this.server.sendMessage(request);

        // Override the stored request to include timeout cleanup
        this.pendingRequests.set(requestId, {
          resolve: (response) => {
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            this.lastResponseTime = Date.now() - startTime;
            resolve(response);
          },
          reject: (error) => {
            clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            this.errorCount++;
            reject(error);
          },
          startTime
        });

      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.errorCount++;
        reject(error);
      }
    });
  }

  handleMessage(message) {
    try {
      const parsed = JSON.parse(message);
      
      if (parsed.id && this.pendingRequests.has(parsed.id)) {
        const request = this.pendingRequests.get(parsed.id);
        request.resolve(parsed);
      } else {
        // Handle notifications or other messages
        this.emit('message', parsed);
      }

    } catch (error) {
      this.emit('error', new MCPError(`Failed to parse message: ${error.message}`));
    }
  }

  setupServerEventListeners() {
    this.server.on('output', (output) => {
      if (output.type === 'stdout') {
        this.handleServerOutput(output.data);
      }
    });

    this.server.on('error', (error) => {
      this.errorCount++;
      this.emit('error', error);
    });

    this.server.on('stopped', () => {
      this.isConnectedFlag = false;
      this.emit('disconnected');
    });
  }

  handleServerOutput(data) {
    // Buffer the data as messages might be split across chunks
    this.messageBuffer += data;
    
    // Process complete messages (separated by newlines)
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line.trim());
      }
    }
  }
}

module.exports = MCPConnection;