const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const sharp = require('sharp');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// MCP Tools Discovery Endpoint
app.get('/mcp/tools', (req, res) => {
  const tools = [
    {
      name: 'web_scraper',
      description: 'Scrape content from web pages and extract text, links, and metadata',
      category: 'web',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of the webpage to scrape'
          },
          selector: {
            type: 'string',
            description: 'CSS selector to target specific elements (optional)'
          },
          extract: {
            type: 'string',
            enum: ['text', 'links', 'images', 'all'],
            description: 'What to extract from the page'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'file_manager',
      description: 'Read, write, and manage files on the server',
      category: 'filesystem',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['read', 'write', 'list', 'delete', 'exists'],
            description: 'Action to perform on the file/directory'
          },
          path: {
            type: 'string',
            description: 'File or directory path'
          },
          content: {
            type: 'string',
            description: 'Content to write (for write action)'
          },
          encoding: {
            type: 'string',
            default: 'utf8',
            description: 'File encoding'
          }
        },
        required: ['action', 'path']
      }
    },
    {
      name: 'image_processor',
      description: 'Process and manipulate images - resize, convert, compress',
      category: 'media',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['resize', 'convert', 'compress', 'info'],
            description: 'Image processing action'
          },
          inputPath: {
            type: 'string',
            description: 'Path to input image'
          },
          outputPath: {
            type: 'string',
            description: 'Path for output image'
          },
          width: {
            type: 'integer',
            description: 'Target width for resize'
          },
          height: {
            type: 'integer',
            description: 'Target height for resize'
          },
          format: {
            type: 'string',
            enum: ['jpeg', 'png', 'webp', 'gif'],
            description: 'Output format for conversion'
          },
          quality: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Quality for compression (1-100)'
          }
        },
        required: ['action', 'inputPath']
      }
    },
    {
      name: 'http_client',
      description: 'Make HTTP requests to external APIs and services',
      category: 'network',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            description: 'HTTP method'
          },
          url: {
            type: 'string',
            description: 'Target URL'
          },
          headers: {
            type: 'object',
            description: 'HTTP headers as key-value pairs'
          },
          body: {
            type: 'object',
            description: 'Request body for POST/PUT requests'
          },
          timeout: {
            type: 'integer',
            default: 30000,
            description: 'Request timeout in milliseconds'
          }
        },
        required: ['method', 'url']
      }
    },
    {
      name: 'data_analyzer',
      description: 'Analyze and process data - JSON, CSV, statistics',
      category: 'data',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['parse_json', 'parse_csv', 'statistics', 'filter', 'sort'],
            description: 'Data analysis action'
          },
          data: {
            type: 'string',
            description: 'Input data as string'
          },
          filePath: {
            type: 'string',
            description: 'Path to data file (alternative to data parameter)'
          },
          filter: {
            type: 'object',
            description: 'Filter criteria for data filtering'
          },
          sortBy: {
            type: 'string',
            description: 'Field to sort by'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'asc',
            description: 'Sort order'
          }
        },
        required: ['action']
      }
    },
    {
      name: 'text_processor',
      description: 'Process and analyze text - summarization, sentiment, translation',
      category: 'text',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['count_words', 'count_chars', 'extract_emails', 'extract_urls', 'sentiment', 'hash'],
            description: 'Text processing action'
          },
          text: {
            type: 'string',
            description: 'Input text to process'
          },
          algorithm: {
            type: 'string',
            enum: ['md5', 'sha1', 'sha256'],
            default: 'sha256',
            description: 'Hash algorithm (for hash action)'
          }
        },
        required: ['action', 'text']
      }
    },
    {
      name: 'datetime_helper',
      description: 'Handle date and time operations - formatting, parsing, calculations',
      category: 'utility',
      version: '1.0.0',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['now', 'format', 'parse', 'add', 'subtract', 'diff'],
            description: 'DateTime operation'
          },
          datetime: {
            type: 'string',
            description: 'Input datetime string'
          },
          format: {
            type: 'string',
            default: 'YYYY-MM-DD HH:mm:ss',
            description: 'DateTime format string'
          },
          amount: {
            type: 'integer',
            description: 'Amount to add/subtract'
          },
          unit: {
            type: 'string',
            enum: ['years', 'months', 'days', 'hours', 'minutes', 'seconds'],
            description: 'Time unit for add/subtract/diff operations'
          },
          timezone: {
            type: 'string',
            description: 'Timezone for operations'
          }
        },
        required: ['action']
      }
    }
  ];

  res.json({
    success: true,
    tools,
    serverInfo: {
      name: 'AI Platform MCP Server',
      version: '1.0.0',
      description: 'Multi-purpose MCP server with various utility tools'
    }
  });
});

// MCP Tool Execution Endpoint
app.post('/mcp/execute', async (req, res) => {
  try {
    const { tool, parameters } = req.body;

    if (!tool || !parameters) {
      return res.status(400).json({
        success: false,
        error: 'Missing tool name or parameters'
      });
    }

    let result;
    const startTime = Date.now();

    switch (tool) {
      case 'web_scraper':
        result = await executeWebScraper(parameters);
        break;
      case 'file_manager':
        result = await executeFileManager(parameters);
        break;
      case 'image_processor':
        result = await executeImageProcessor(parameters);
        break;
      case 'http_client':
        result = await executeHttpClient(parameters);
        break;
      case 'data_analyzer':
        result = await executeDataAnalyzer(parameters);
        break;
      case 'text_processor':
        result = await executeTextProcessor(parameters);
        break;
      case 'datetime_helper':
        result = await executeDateTimeHelper(parameters);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown tool: ${tool}`
        });
    }

    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      result,
      metadata: {
        tool,
        executionTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Tool Implementation Functions
async function executeWebScraper(params) {
  const { url, selector, extract = 'text' } = params;

  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);
  let result = {};

  if (extract === 'all' || extract === 'text') {
    const text = selector ? $(selector).text().trim() : $('body').text().trim();
    result.text = text;
  }

  if (extract === 'all' || extract === 'links') {
    const links = [];
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        links.push({ url: href, text });
      }
    });
    result.links = links;
  }

  if (extract === 'all' || extract === 'images') {
    const images = [];
    $('img[src]').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src) {
        images.push({ url: src, alt });
      }
    });
    result.images = images;
  }

  // Extract metadata
  result.metadata = {
    title: $('title').text() || '',
    description: $('meta[name="description"]').attr('content') || '',
    url: url,
    timestamp: new Date().toISOString()
  };

  return result;
}

async function executeFileManager(params) {
  const { action, path: filePath, content, encoding = 'utf8' } = params;

  // Security: Restrict to safe directories
  const safePath = path.resolve('./data', filePath.replace(/^\/+/, ''));
  if (!safePath.startsWith(path.resolve('./data'))) {
    throw new Error('Access denied: Path outside allowed directory');
  }

  switch (action) {
    case 'read':
      if (!(await fs.pathExists(safePath))) {
        throw new Error('File does not exist');
      }
      const fileContent = await fs.readFile(safePath, encoding);
      return { content: fileContent, size: fileContent.length };

    case 'write':
      if (!content) {
        throw new Error('Content is required for write action');
      }
      await fs.ensureDir(path.dirname(safePath));
      await fs.writeFile(safePath, content, encoding);
      return { message: 'File written successfully', path: safePath };

    case 'list':
      if (!(await fs.pathExists(safePath))) {
        throw new Error('Directory does not exist');
      }
      const items = await fs.readdir(safePath);
      const detailedItems = [];
      for (const item of items) {
        const itemPath = path.join(safePath, item);
        const stats = await fs.stat(itemPath);
        detailedItems.push({
          name: item,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime
        });
      }
      return { items: detailedItems };

    case 'delete':
      if (!(await fs.pathExists(safePath))) {
        throw new Error('File/directory does not exist');
      }
      await fs.remove(safePath);
      return { message: 'File/directory deleted successfully' };

    case 'exists':
      const exists = await fs.pathExists(safePath);
      return { exists };

    default:
      throw new Error(`Unknown file action: ${action}`);
  }
}

async function executeImageProcessor(params) {
  const { action, inputPath, outputPath, width, height, format, quality } = params;

  const safeInputPath = path.resolve('./data', inputPath.replace(/^\/+/, ''));
  
  if (!(await fs.pathExists(safeInputPath))) {
    throw new Error('Input image does not exist');
  }

  switch (action) {
    case 'info':
      const metadata = await sharp(safeInputPath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        colorspace: metadata.space
      };

    case 'resize':
      if (!width && !height) {
        throw new Error('Width or height is required for resize');
      }
      const safeOutputPath = outputPath 
        ? path.resolve('./data', outputPath.replace(/^\/+/, ''))
        : safeInputPath;
      
      await fs.ensureDir(path.dirname(safeOutputPath));
      await sharp(safeInputPath)
        .resize(width, height)
        .toFile(safeOutputPath);
      
      return { message: 'Image resized successfully', outputPath: safeOutputPath };

    case 'convert':
      if (!format) {
        throw new Error('Format is required for conversion');
      }
      const convertOutputPath = outputPath 
        ? path.resolve('./data', outputPath.replace(/^\/+/, ''))
        : safeInputPath.replace(/\.[^.]+$/, `.${format}`);
      
      await fs.ensureDir(path.dirname(convertOutputPath));
      await sharp(safeInputPath)
        .toFormat(format)
        .toFile(convertOutputPath);
      
      return { message: 'Image converted successfully', outputPath: convertOutputPath };

    case 'compress':
      const compressOutputPath = outputPath 
        ? path.resolve('./data', outputPath.replace(/^\/+/, ''))
        : safeInputPath;
      
      await fs.ensureDir(path.dirname(compressOutputPath));
      let processor = sharp(safeInputPath);
      
      if (quality) {
        processor = processor.jpeg({ quality });
      }
      
      await processor.toFile(compressOutputPath);
      return { message: 'Image compressed successfully', outputPath: compressOutputPath };

    default:
      throw new Error(`Unknown image action: ${action}`);
  }
}

async function executeHttpClient(params) {
  const { method, url, headers = {}, body, timeout = 30000 } = params;

  const config = {
    method,
    url,
    headers,
    timeout
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    config.data = body;
  }

  const response = await axios(config);
  
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data
  };
}

async function executeDataAnalyzer(params) {
  const { action, data, filePath, filter, sortBy, sortOrder = 'asc' } = params;

  let inputData = data;
  if (filePath && !data) {
    const safePath = path.resolve('./data', filePath.replace(/^\/+/, ''));
    inputData = await fs.readFile(safePath, 'utf8');
  }

  if (!inputData) {
    throw new Error('No data provided');
  }

  switch (action) {
    case 'parse_json':
      const jsonData = JSON.parse(inputData);
      return { parsed: jsonData, type: 'json' };

    case 'parse_csv':
      const lines = inputData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });
      return { headers, rows, count: rows.length };

    case 'statistics':
      const parsedData = JSON.parse(inputData);
      if (!Array.isArray(parsedData)) {
        throw new Error('Data must be an array for statistics');
      }
      
      const stats = {
        count: parsedData.length,
        types: {},
        fields: {}
      };

      parsedData.forEach(item => {
        const type = typeof item;
        stats.types[type] = (stats.types[type] || 0) + 1;
        
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => {
            if (!stats.fields[key]) {
              stats.fields[key] = { count: 0, types: {} };
            }
            stats.fields[key].count++;
            const fieldType = typeof item[key];
            stats.fields[key].types[fieldType] = (stats.fields[key].types[fieldType] || 0) + 1;
          });
        }
      });

      return stats;

    case 'filter':
      const filterData = JSON.parse(inputData);
      if (!Array.isArray(filterData)) {
        throw new Error('Data must be an array for filtering');
      }
      
      const filtered = filterData.filter(item => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) {
            return false;
          }
        }
        return true;
      });
      
      return { filtered, originalCount: filterData.length, filteredCount: filtered.length };

    case 'sort':
      const sortData = JSON.parse(inputData);
      if (!Array.isArray(sortData)) {
        throw new Error('Data must be an array for sorting');
      }
      
      const sorted = [...sortData].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      
      return { sorted, count: sorted.length };

    default:
      throw new Error(`Unknown data analysis action: ${action}`);
  }
}

async function executeTextProcessor(params) {
  const { action, text, algorithm = 'sha256' } = params;
  const crypto = require('crypto');

  switch (action) {
    case 'count_words':
      const words = text.split(/\s+/).filter(word => word.length > 0);
      return { wordCount: words.length, words };

    case 'count_chars':
      return { 
        totalChars: text.length, 
        charsNoSpaces: text.replace(/\s/g, '').length,
        lines: text.split('\n').length
      };

    case 'extract_emails':
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emails = text.match(emailRegex) || [];
      return { emails: [...new Set(emails)] };

    case 'extract_urls':
      const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
      const urls = text.match(urlRegex) || [];
      return { urls: [...new Set(urls)] };

    case 'sentiment':
      // Simple sentiment analysis based on keywords
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'positive'];
      const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'negative', 'angry', 'disappointed'];
      
      const lowerText = text.toLowerCase();
      const positiveCount = positiveWords.reduce((count, word) => count + (lowerText.match(new RegExp(word, 'g')) || []).length, 0);
      const negativeCount = negativeWords.reduce((count, word) => count + (lowerText.match(new RegExp(word, 'g')) || []).length, 0);
      
      let sentiment = 'neutral';
      if (positiveCount > negativeCount) sentiment = 'positive';
      else if (negativeCount > positiveCount) sentiment = 'negative';
      
      return { 
        sentiment, 
        positiveScore: positiveCount, 
        negativeScore: negativeCount,
        confidence: Math.abs(positiveCount - negativeCount) / (positiveCount + negativeCount + 1)
      };

    case 'hash':
      const hash = crypto.createHash(algorithm).update(text).digest('hex');
      return { hash, algorithm };

    default:
      throw new Error(`Unknown text processing action: ${action}`);
  }
}

async function executeDateTimeHelper(params) {
  const { action, datetime, format = 'YYYY-MM-DD HH:mm:ss', amount, unit, timezone } = params;

  switch (action) {
    case 'now':
      const now = moment();
      if (timezone) now.tz(timezone);
      return { 
        timestamp: now.format(format),
        iso: now.toISOString(),
        unix: now.unix()
      };

    case 'format':
      if (!datetime) throw new Error('datetime parameter is required');
      const momentObj = moment(datetime);
      if (timezone) momentObj.tz(timezone);
      return { 
        formatted: momentObj.format(format),
        iso: momentObj.toISOString(),
        unix: momentObj.unix()
      };

    case 'parse':
      if (!datetime) throw new Error('datetime parameter is required');
      const parsed = moment(datetime, format);
      return {
        isValid: parsed.isValid(),
        iso: parsed.toISOString(),
        unix: parsed.unix(),
        formatted: parsed.format('YYYY-MM-DD HH:mm:ss')
      };

    case 'add':
      if (!datetime || !amount || !unit) {
        throw new Error('datetime, amount, and unit parameters are required');
      }
      const addMoment = moment(datetime).add(amount, unit);
      return {
        result: addMoment.format(format),
        iso: addMoment.toISOString(),
        unix: addMoment.unix()
      };

    case 'subtract':
      if (!datetime || !amount || !unit) {
        throw new Error('datetime, amount, and unit parameters are required');
      }
      const subtractMoment = moment(datetime).subtract(amount, unit);
      return {
        result: subtractMoment.format(format),
        iso: subtractMoment.toISOString(),
        unix: subtractMoment.unix()
      };

    case 'diff':
      if (!datetime || !unit) {
        throw new Error('datetime and unit parameters are required');
      }
      const diffMoment = moment(datetime);
      const nowMoment = moment();
      const difference = nowMoment.diff(diffMoment, unit);
      return {
        difference,
        unit,
        absolute: Math.abs(difference),
        direction: difference > 0 ? 'past' : 'future'
      };

    default:
      throw new Error(`Unknown datetime action: ${action}`);
  }
}

// Ensure data directory exists
fs.ensureDirSync('./data');

// Start server
app.listen(PORT, () => {
  console.log(`🤖 AI Platform MCP Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Tools: http://localhost:${PORT}/mcp/tools`);
  console.log(`💡 Ready to process MCP tool requests!`);
});

module.exports = app;