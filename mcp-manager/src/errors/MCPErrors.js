// Base MCP error class
class MCPError extends Error {
  constructor(message, code = 'MCP_ERROR', details = {}) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// Connection-related errors
class MCPConnectionError extends MCPError {
  constructor(message, details = {}) {
    super(message, 'MCP_CONNECTION_ERROR', details);
    this.name = 'MCPConnectionError';
  }
}

// Timeout errors
class MCPTimeoutError extends MCPError {
  constructor(message, timeout, details = {}) {
    super(message, 'MCP_TIMEOUT_ERROR', { timeout, ...details });
    this.name = 'MCPTimeoutError';
    this.timeout = timeout;
  }
}

// Server startup errors
class MCPServerStartupError extends MCPError {
  constructor(message, command, args = [], details = {}) {
    super(message, 'MCP_SERVER_STARTUP_ERROR', { command, args, ...details });
    this.name = 'MCPServerStartupError';
    this.command = command;
    this.args = args;
  }
}

// Protocol errors
class MCPProtocolError extends MCPError {
  constructor(message, method, details = {}) {
    super(message, 'MCP_PROTOCOL_ERROR', { method, ...details });
    this.name = 'MCPProtocolError';
    this.method = method;
  }
}

// Tool execution errors
class MCPToolError extends MCPError {
  constructor(message, toolName, parameters = {}, details = {}) {
    super(message, 'MCP_TOOL_ERROR', { toolName, parameters, ...details });
    this.name = 'MCPToolError';
    this.toolName = toolName;
    this.parameters = parameters;
  }
}

// Resource errors
class MCPResourceError extends MCPError {
  constructor(message, resourceUri, details = {}) {
    super(message, 'MCP_RESOURCE_ERROR', { resourceUri, ...details });
    this.name = 'MCPResourceError';
    this.resourceUri = resourceUri;
  }
}

// Validation errors
class MCPValidationError extends MCPError {
  constructor(message, field, value, details = {}) {
    super(message, 'MCP_VALIDATION_ERROR', { field, value, ...details });
    this.name = 'MCPValidationError';
    this.field = field;
    this.value = value;
  }
}

// Permission errors
class MCPPermissionError extends MCPError {
  constructor(message, requiredPermission, details = {}) {
    super(message, 'MCP_PERMISSION_ERROR', { requiredPermission, ...details });
    this.name = 'MCPPermissionError';
    this.requiredPermission = requiredPermission;
  }
}

// Rate limiting errors
class MCPRateLimitError extends MCPError {
  constructor(message, limit, window, details = {}) {
    super(message, 'MCP_RATE_LIMIT_ERROR', { limit, window, ...details });
    this.name = 'MCPRateLimitError';
    this.limit = limit;
    this.window = window;
  }
}

// Configuration errors
class MCPConfigurationError extends MCPError {
  constructor(message, config, details = {}) {
    super(message, 'MCP_CONFIGURATION_ERROR', { config, ...details });
    this.name = 'MCPConfigurationError';
    this.config = config;
  }
}

module.exports = {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPServerStartupError,
  MCPProtocolError,
  MCPToolError,
  MCPResourceError,
  MCPValidationError,
  MCPPermissionError,
  MCPRateLimitError,
  MCPConfigurationError
};