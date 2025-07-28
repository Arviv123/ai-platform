module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/src/tests/**/*.test.js',
    '**/src/**/__tests__/**/*.js',
    '**/src/**/*.test.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/**/*.test.js',
    '!src/index.js',
    '!src/config/database.js' // Exclude database config from coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Transform files
  transform: {},

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect handles that prevent Jest from exiting
  detectOpenHandles: true,

  // Max workers for parallel testing
  maxWorkers: 1, // Use single worker to avoid conflicts

  // Global setup and teardown
  globalSetup: '<rootDir>/src/tests/globalSetup.js',
  globalTeardown: '<rootDir>/src/tests/globalTeardown.js',

  // Mock patterns
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};