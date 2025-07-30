const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AI Platform API',
    version: '1.0.0',
    description: 'פלטפורמת בינה מלאכותית מתקדמת עם תמיכה ב-MCP, מערכת חיובים ומנויים',
    contact: {
      name: 'AI Platform Team',
      email: 'support@ai-platform.com',
      url: 'https://ai-platform.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3004',
      description: 'Development server'
    },
    {
      url: 'https://api.ai-platform.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          name: {
            type: 'string',
            description: 'User full name'
          },
          subscription: {
            type: 'string',
            enum: ['free', 'basic', 'premium', 'enterprise'],
            description: 'Subscription tier'
          },
          credits: {
            type: 'integer',
            description: 'Available credits'
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'suspended'],
            description: 'Account status'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation date'
          }
        }
      },
      ChatMessage: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Message ID'
          },
          content: {
            type: 'string',
            description: 'Message content'
          },
          role: {
            type: 'string',
            enum: ['user', 'assistant'],
            description: 'Message sender role'
          },
          model: {
            type: 'string',
            description: 'AI model used'
          },
          tokensUsed: {
            type: 'integer',
            description: 'Tokens consumed'
          },
          creditsUsed: {
            type: 'integer',
            description: 'Credits consumed'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Message timestamp'
          }
        }
      },
      MCPServer: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Server ID'
          },
          name: {
            type: 'string',
            description: 'Server name'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Server URL'
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'error'],
            description: 'Server status'
          },
          config: {
            type: 'object',
            description: 'Server configuration'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Server creation date'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['error', 'fail'],
            description: 'Error status'
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          details: {
            type: 'object',
            description: 'Additional error details'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success'],
            description: 'Success status'
          },
          message: {
            type: 'string',
            description: 'Success message'
          },
          data: {
            type: 'object',
            description: 'Response data'
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};

// Options for swagger-jsdoc
const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/index.js'
  ]
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

// Custom CSS for RTL support
const customCss = `
  .swagger-ui .info .title {
    direction: ltr;
    text-align: left;
  }
  .swagger-ui .info .description {
    direction: rtl;
    text-align: right;
  }
  .swagger-ui .scheme-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
    padding: 15px;
  }
  .swagger-ui .btn.authorize {
    background: #667eea;
    border-color: #667eea;
  }
  .swagger-ui .btn.authorize:hover {
    background: #5a6fd8;
    border-color: #5a6fd8;
  }
`;

const swaggerOptions = {
  customCss,
  customSiteTitle: 'AI Platform API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    defaultModelsExpandDepth: 2
  }
};

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions
};