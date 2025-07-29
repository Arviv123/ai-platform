# AI Platform MCP Server

A comprehensive Model Context Protocol (MCP) server providing various utility tools and conversation management capabilities.

## 🚀 Features

- **7 Built-in Tools**: Web scraping, file management, image processing, HTTP client, data analysis, text processing, and datetime utilities
- **Conversation Management**: Persistent conversation storage with message history
- **RESTful API**: Clean endpoints for tool execution and conversation management
- **Security**: Path restrictions and input validation
- **Health Monitoring**: Built-in health check endpoint

## 📋 Requirements

- Node.js 20.x or higher
- npm or yarn

## 🛠 Installation

```bash
npm install
```

## 🎯 Usage

### Server Management

The server includes an intelligent management system that handles port conflicts and process management:

```bash
# Start server (finds available port automatically)
npm start

# Force restart (stops all servers and starts fresh)
npm run force-restart

# Stop server
npm run stop

# Restart server
npm run restart

# Check server status
npm run status

# View server logs
npm run logs
```

### Quick Start (Windows)

```bash
# Double-click to start
start.bat

# Double-click to stop
stop.bat
```

**Smart Port Management:** The server automatically finds available ports starting from 8080, preventing conflicts.

### Health Check

```bash
curl http://localhost:8081/health
```

## 🔧 API Endpoints

### MCP Tools

#### Get Available Tools
```bash
GET /mcp/tools
```

#### Execute Tool
```bash
POST /mcp/execute
Content-Type: application/json

{
  "tool": "text_processor",
  "parameters": {
    "action": "count_words",
    "text": "Hello world"
  }
}
```

### Conversation Management

#### Create Conversation
```bash
POST /conversations
Content-Type: application/json

{
  "metadata": {
    "title": "My Conversation",
    "userId": "user123"
  }
}
```

#### Get Conversation
```bash
GET /conversations/{id}
```

#### Add Message to Conversation
```bash
POST /conversations/{id}/messages
Content-Type: application/json

{
  "role": "user",
  "content": "Hello, this is my message"
}
```

#### Execute Tool in Conversation Context
```bash
POST /conversations/{id}/execute
Content-Type: application/json

{
  "tool": "text_processor",
  "parameters": {
    "action": "sentiment",
    "text": "I love this feature!"
  },
  "saveToHistory": true
}
```

#### Get Conversation Messages
```bash
GET /conversations/{id}/messages?limit=50&offset=0
```

#### List All Conversations
```bash
GET /conversations?limit=20&offset=0
```

#### Delete Conversation
```bash
DELETE /conversations/{id}
```

## 🛠 Available Tools

### 1. Web Scraper
Scrape content from web pages and extract text, links, and metadata.

**Parameters:**
- `url` (required): URL to scrape
- `selector` (optional): CSS selector for specific elements
- `extract`: What to extract ('text', 'links', 'images', 'all')

### 2. File Manager
Read, write, and manage files on the server.

**Parameters:**
- `action` (required): 'read', 'write', 'list', 'delete', 'exists'
- `path` (required): File or directory path
- `content`: Content for write action
- `encoding`: File encoding (default: 'utf8')

**Security:** Files are restricted to the `./data` directory.

### 3. Image Processor
Process and manipulate images - resize, convert, compress.

**Parameters:**
- `action` (required): 'resize', 'convert', 'compress', 'info'
- `inputPath` (required): Path to input image
- `outputPath`: Path for output image
- `width`, `height`: Dimensions for resize
- `format`: Output format ('jpeg', 'png', 'webp', 'gif')
- `quality`: Compression quality (1-100)

### 4. HTTP Client
Make HTTP requests to external APIs and services.

**Parameters:**
- `method` (required): 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
- `url` (required): Target URL
- `headers`: HTTP headers as key-value pairs
- `body`: Request body for POST/PUT requests
- `timeout`: Request timeout in milliseconds (default: 30000)

### 5. Data Analyzer
Analyze and process data - JSON, CSV, statistics.

**Parameters:**
- `action` (required): 'parse_json', 'parse_csv', 'statistics', 'filter', 'sort'
- `data`: Input data as string
- `filePath`: Path to data file (alternative to data parameter)
- `filter`: Filter criteria for data filtering
- `sortBy`: Field to sort by
- `sortOrder`: Sort order ('asc', 'desc')

### 6. Text Processor
Process and analyze text - word counting, sentiment analysis, extraction.

**Parameters:**
- `action` (required): 'count_words', 'count_chars', 'extract_emails', 'extract_urls', 'sentiment', 'hash'
- `text` (required): Input text to process
- `algorithm`: Hash algorithm for hash action ('md5', 'sha1', 'sha256')

### 7. DateTime Helper
Handle date and time operations - formatting, parsing, calculations.

**Parameters:**
- `action` (required): 'now', 'format', 'parse', 'add', 'subtract', 'diff'
- `datetime`: Input datetime string
- `format`: DateTime format string (default: 'YYYY-MM-DD HH:mm:ss')
- `amount`: Amount to add/subtract
- `unit`: Time unit ('years', 'months', 'days', 'hours', 'minutes', 'seconds')
- `timezone`: Timezone for operations

## 💾 Data Storage

- **Files**: Stored in `./data` directory (automatically created)
- **Conversations**: In-memory storage (consider database for production)

## 🔒 Security Features

- Path restrictions for file operations
- Input validation and sanitization
- CORS enabled for cross-origin requests
- Error handling with detailed logging

## 🧪 Testing

```bash
npm test
```

## 📈 Example Usage

### Create and use a conversation:

```bash
# Create conversation
CONV_ID=$(curl -s -X POST http://localhost:8081/conversations \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"title":"Test Chat"}}' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Add user message
curl -X POST http://localhost:8081/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Analyze this text sentiment"}'

# Execute tool in conversation
curl -X POST http://localhost:8081/conversations/$CONV_ID/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"text_processor",
    "parameters":{"action":"sentiment","text":"I love this MCP server!"},
    "saveToHistory":true
  }'

# Get conversation history
curl http://localhost:8081/conversations/$CONV_ID/messages
```

## 🔗 MCP Integration

This server implements the Model Context Protocol standard and can be integrated with:
- Claude Desktop
- Other MCP-compatible applications
- Custom MCP clients

## 📞 API Support

All endpoints return JSON responses with the following structure:

**Success:**
```json
{
  "success": true,
  "result": { /* tool result */ },
  "metadata": {
    "tool": "tool_name",
    "executionTime": 123,
    "timestamp": "2025-07-29T19:00:00.000Z"
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🚦 Server Status

The server management system provides comprehensive monitoring:

```bash
npm run status    # Check if server is running
npm run logs 100  # Show last 100 log lines
```

Features operational:

✅ Health check endpoint  
✅ MCP tools discovery  
✅ Tool execution  
✅ Conversation management  
✅ Persistent conversation storage  
✅ Message history  
✅ Error handling  

## 🐛 Troubleshooting

1. **Port conflicts**: Use `npm run force-restart` to stop all servers and start fresh
2. **Server not responding**: Check `npm run status` and `npm run logs`
3. **Permission errors**: Ensure write access to the project directory
4. **Module errors**: Run `npm install` to install dependencies
5. **Multiple servers running**: Use `npm run force-restart` to clean up

### Available Commands

```bash
npm start          # Start server
npm stop           # Stop server
npm restart        # Restart server
npm run force-restart  # Stop all and start fresh
npm run status     # Check server status
npm run logs [n]   # Show last n log lines
npm run dev        # Development mode with nodemon
npm run direct     # Direct node execution
```

---

Made with ❤️ for the AI Platform ecosystem