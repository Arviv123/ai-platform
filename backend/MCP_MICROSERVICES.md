# AI Platform - MCP & Microservices Architecture

## Overview
This document outlines the comprehensive MCP (Model Context Protocol) management system and microservices architecture implemented in the AI Platform.

## MCP Service Architecture

### Core Features
- **Dynamic Server Management** - Create, start, stop, and monitor MCP servers
- **Real-time Health Monitoring** - Continuous health checks with auto-restart
- **Tool Execution** - Secure execution of MCP tools with logging
- **Process Management** - Full lifecycle management of MCP server processes
- **Performance Monitoring** - Execution time tracking and analytics
- **Security Integration** - RBAC permissions and audit logging

### MCP Server Lifecycle

#### 1. Server Registration
```javascript
// Create new MCP server
const server = await mcpService.createServer(userId, {
  name: 'File System Server',
  description: 'Local file system access',
  command: 'node',
  args: ['mcp-server-filesystem.js'],
  env: { DEBUG: '1' },
  enabled: true
});
```

#### 2. Automatic Startup
- Servers marked as `enabled: true` start automatically on service init
- Process spawning with proper stdio configuration
- Environment variable injection
- Error handling and status tracking

#### 3. Health Monitoring
- Periodic health checks every 30 seconds
- Process status verification
- Automatic restart on unexpected crashes
- Health status reporting: `HEALTHY`, `UNHEALTHY`, `STARTING`, `STOPPED`, `ERROR`

#### 4. Tool Execution
```javascript
// Execute tool on MCP server
const result = await mcpService.executeTool(serverId, 'read_file', {
  path: '/home/user/document.txt'
});
```

### Database Schema

#### MCP Server Model
```prisma
model McpServer {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  name            String
  description     String?
  command         String
  args            String    @default("[]") // JSON array
  env             String    @default("{}") // JSON object
  enabled         Boolean   @default(true)
  healthStatus    String    @default("UNKNOWN") @map("health_status")
  totalCalls      Int       @default(0) @map("total_calls")
  lastUsedAt      DateTime? @map("last_used_at")
  lastHealthCheck DateTime? @map("last_health_check")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  // Relations
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
  toolCalls       McpToolCall[]
  auditLogs       AuditLog[]

  @@map("mcp_servers")
}
```

#### MCP Tool Call Logging
```prisma
model McpToolCall {
  id            String    @id @default(cuid())
  serverId      String    @map("server_id")
  toolName      String    @map("tool_name")
  parameters    String    // JSON parameters
  response      String?   // JSON response
  success       Boolean
  errorMessage  String?   @map("error_message")
  executionTime Int?      @map("execution_time")
  createdAt     DateTime  @default(now()) @map("created_at")

  // Relations
  server        McpServer @relation(fields: [serverId], references: [id], onDelete: Cascade)

  @@map("mcp_tool_calls")
}
```

## API Gateway Service

### Architecture Overview
The API Gateway serves as the central entry point for all microservices, providing:
- **Load Balancing** - Round-robin, least-connections, weighted distribution
- **Health Monitoring** - Service health checks and automatic failover
- **Request Routing** - Path-based routing to appropriate services
- **Rate Limiting** - Service-level request throttling
- **Authentication** - Centralized authentication and authorization

### Load Balancing Strategies

#### 1. Round Robin
```javascript
// Distributes requests evenly across healthy instances
const instance = this.roundRobinSelection(healthyInstances, loadBalancer);
```

#### 2. Least Connections
```javascript
// Routes to instance with fewest active connections
const instance = this.leastConnectionsSelection(healthyInstances);
```

#### 3. Weighted Distribution
```javascript
// Routes based on instance weight/capacity
const instance = this.weightedSelection(healthyInstances);
```

### Service Registration
```javascript
apiGatewayService.registerService({
  name: 'mcp-service',
  instances: [
    { host: 'localhost', port: 3008, weight: 1 },
    { host: 'localhost', port: 3009, weight: 2 }
  ],
  basePath: '/api/mcp',
  healthEndpoint: '/health',
  authentication: true,
  rateLimit: {
    windowMs: 60000,
    max: 100
  },
  timeout: 30000
});
```

### Health Monitoring
- Continuous health checks every 30 seconds
- HTTP health endpoint verification
- Response time tracking
- Automatic instance marking (healthy/unhealthy)
- Service availability reporting

## API Endpoints

### MCP Management Endpoints

#### Server Management
```http
GET    /api/mcp                     # Get user's MCP servers
POST   /api/mcp                     # Create new MCP server
GET    /api/mcp/:serverId           # Get server details & stats
PUT    /api/mcp/:serverId           # Update server configuration
DELETE /api/mcp/:serverId           # Remove server (soft delete)
```

#### Server Operations
```http
POST   /api/mcp/:serverId/start     # Start MCP server process
POST   /api/mcp/:serverId/stop      # Stop MCP server process
POST   /api/mcp/:serverId/execute   # Execute tool on server
GET    /api/mcp/:serverId/logs      # Get server execution logs
```

#### Admin & Monitoring
```http
GET    /api/mcp/admin/all           # Get all servers (admin)
GET    /api/mcp/admin/statistics    # Get MCP statistics (admin)
GET    /api/mcp/health/check        # Health check all user servers
```

### Gateway Management Endpoints

#### Gateway Statistics & Health
```http
GET    /api/gateway/stats           # Get gateway statistics
GET    /api/gateway/health          # Get all services health
GET    /api/gateway/health/:service # Get specific service health
GET    /api/gateway/config          # Get gateway configuration
```

#### Service Management (Admin)
```http
POST   /api/gateway/services        # Register new service
DELETE /api/gateway/services/:name  # Unregister service
POST   /api/gateway/health/:name/check # Trigger health check
```

## Security & Permissions

### RBAC Integration
```javascript
// MCP permissions in RBAC system
const MCP_PERMISSIONS = {
  'mcp:read': 'View MCP servers',
  'mcp:write': 'Create and edit MCP servers',
  'mcp:execute': 'Execute MCP tools',
  'mcp:manage': 'Full MCP management'
};
```

### Resource Ownership
```javascript
// Automatic ownership verification
router.get('/:serverId', 
  requireResourceOwnership('mcpServer', 'serverId'),
  async (req, res) => { /* ... */ }
);
```

### Rate Limiting
- **Server Creation**: 5 servers per 5 minutes
- **Tool Execution**: 20 executions per minute
- **API Requests**: 100 requests per minute

## Monitoring & Analytics

### Performance Metrics
```javascript
{
  "server": {
    "id": "mcp_12345",
    "name": "File System Server",
    "healthStatus": "HEALTHY",
    "totalCalls": 156,
    "lastUsedAt": "2025-01-27T20:30:00Z"
  },
  "stats": {
    "totalCalls": 156,
    "averageExecutionTime": 45.2,
    "totalExecutionTime": 7051
  },
  "runtimeStatus": {
    "status": "running",
    "pid": 12345,
    "uptime": 3600000
  }
}
```

### Health Dashboard
```javascript
{
  "summary": {
    "total": 12,
    "healthy": 10,
    "unhealthy": 2
  },
  "servers": [
    {
      "id": "server1",
      "name": "FS Server",
      "healthy": true,
      "status": "HEALTHY",
      "lastCheck": "2025-01-27T20:35:00Z"
    }
  ]
}
```

## Configuration

### Environment Variables
```env
# MCP Configuration
MCP_SERVERS_DIR=./mcp-servers
MCP_HEALTH_CHECK_INTERVAL=30000
MCP_AUTO_RESTART=true
MCP_MAX_RETRIES=3

# Gateway Configuration
GATEWAY_HEALTH_CHECK_INTERVAL=30000
GATEWAY_TIMEOUT_MS=30000
GATEWAY_LOAD_BALANCING=round-robin
```

### Service Configuration
```javascript
const serviceConfig = {
  name: 'chat-service',
  instances: [
    { host: 'localhost', port: 3007 }
  ],
  basePath: '/api/chat',
  healthEndpoint: '/health',
  authentication: true,
  rateLimit: {
    windowMs: 60000,
    max: 200
  },
  timeout: 15000
};
```

## Error Handling

### MCP Service Errors
- **Server Not Found**: 404 with specific error message
- **Process Spawn Failure**: 500 with process error details
- **Tool Execution Failure**: 400 with execution error
- **Permission Denied**: 403 with RBAC validation

### Gateway Errors
- **Service Unavailable**: 503 when no healthy instances
- **Timeout**: 504 when service doesn't respond
- **Rate Limited**: 429 when rate limit exceeded
- **Authentication**: 401/403 for auth failures

## Deployment Architecture

### Current Architecture (Monolith + Services)
```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   API Gateway   │
│  (React/HTML)   │    │   (Port 3010)   │
└─────────────────┘    └─────────────────┘
                                │
                        ┌───────┼───────┐
                        │       │       │
                 ┌─────────────────┐   ┌─────────────────┐
                 │   Auth Service  │   │   MCP Service   │
                 │   (Built-in)    │   │   (Built-in)    │
                 └─────────────────┘   └─────────────────┘
                                │
                    ┌─────────────────┐
                    │    Database     │
                    │    (SQLite)     │
                    └─────────────────┘
```

### Future Microservices Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   API Gateway   │
│   (Next.js)     │    │   (Port 3010)   │
└─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
         ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
         │Auth Service │ │Chat Service │ │ MCP Service │
         │ (Port 3006) │ │ (Port 3007) │ │ (Port 3008) │
         └─────────────┘ └─────────────┘ └─────────────┘
                │               │               │
                └───────────────┼───────────────┘
                                │
                    ┌─────────────────┐
                    │    Database     │
                    │  (PostgreSQL)   │
                    └─────────────────┘
```

## Future Enhancements

### Phase 2: Advanced MCP Features
1. **MCP Marketplace** - Catalog of pre-built MCP servers
2. **Server Templates** - Quick deployment templates
3. **Resource Monitoring** - CPU, memory, disk usage
4. **Log Aggregation** - Centralized logging system
5. **Performance Optimization** - Connection pooling, caching

### Phase 3: Full Microservices
1. **Service Mesh** - Istio/Consul Connect integration
2. **Container Orchestration** - Kubernetes deployment
3. **Distributed Tracing** - Jaeger/Zipkin integration
4. **Circuit Breakers** - Fault tolerance patterns
5. **Auto-scaling** - Dynamic instance scaling

---

**Status**: ✅ MCP & Microservices Foundation Complete
**Next Phase**: Frontend upgrade to React/Next.js with modern dashboard