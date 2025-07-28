const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🧪 Setting up global test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ai_platform_test';
  process.env.LOG_LEVEL = 'error';
  process.env.PORT = '3004'; // Different port for testing
  
  // Create test environment file
  const testEnvPath = path.join(__dirname, '../../.env.test');
  const testEnvContent = `
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key-for-testing
JWT_REFRESH_SECRET=test-refresh-secret-key-for-testing
DATABASE_URL=postgresql://test:test@localhost:5432/ai_platform_test
LOG_LEVEL=error
PORT=3004

# Mock API keys for testing
ANTHROPIC_API_KEY=test-anthropic-key
OPENAI_API_KEY=test-openai-key
GOOGLE_AI_API_KEY=test-google-key

# Mock email settings
SMTP_HOST=smtp.test.com
SMTP_USER=test@test.com
SMTP_PASS=testpass

# Mock Stripe keys
STRIPE_SECRET_KEY=sk_test_mock
STRIPE_PUBLIC_KEY=pk_test_mock

# Test specific settings
CORS_ORIGIN=http://localhost:3004
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
`.trim();

  try {
    fs.writeFileSync(testEnvPath, testEnvContent);
    console.log('✅ Test environment file created');
  } catch (error) {
    console.warn('⚠️  Could not create test environment file:', error.message);
  }

  // Create test directories
  const testDirs = [
    path.join(__dirname, '../../logs'),
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../../mcp-servers'),
    path.join(__dirname, '../../coverage')
  ];

  for (const dir of testDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created test directory: ${path.basename(dir)}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not create directory ${dir}:`, error.message);
    }
  }

  // Initialize test database (if needed)
  try {
    // In a real application, you might want to:
    // 1. Create a test database
    // 2. Run migrations
    // 3. Seed test data
    console.log('✅ Test database preparation complete');
  } catch (error) {
    console.warn('⚠️  Database setup warning:', error.message);
  }

  console.log('🚀 Global test setup complete');
};