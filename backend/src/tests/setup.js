const { beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

// Load environment variables for testing
require('dotenv').config({ path: '.env.test' });

// Mock console methods to reduce noise during testing
const originalConsole = global.console;

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce logging during tests
  
  // Mock console to reduce noise
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: originalConsole.error // Keep errors visible
  };
});

afterAll(() => {
  // Restore console
  global.console = originalConsole;
  
  // Clean up any global resources
  // Force exit to prevent hanging
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  // Helper to create mock user
  createMockUser: () => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    credits: 100,
    subscription: 'free',
    status: 'active'
  }),
  
  // Helper to create mock JWT token
  createMockToken: () => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'test-secret';
    return jwt.sign(
      { sub: 'test@example.com', type: 'access' },
      secret,
      { expiresIn: '1h' }
    );
  },
  
  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock external services for testing
jest.mock('../services/aiService', () => ({
  sendMessage: jest.fn().mockResolvedValue({
    response: 'Mock AI response',
    tokensUsed: 10,
    model: 'claude-3-haiku'
  }),
  getAvailableModels: jest.fn().mockReturnValue([
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ])
}));

jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  isConfigured: true
}));

jest.mock('../config/database', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue({ rows: [] }),
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    chatSession: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn()
    }
  }
}));

// Mock Redis for caching
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0)
  }))
}));

// Mock Stripe for payments
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test',
        client_secret: 'pi_test_secret'
      })
    },
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test'
      })
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({
        id: 'sub_test',
        latest_invoice: {
          payment_intent: {
            client_secret: 'sub_test_secret'
          }
        }
      })
    }
  }));
});

// Increase timeout for database operations
jest.setTimeout(30000);

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});