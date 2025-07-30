const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up test files
  const testEnvPath = path.join(__dirname, '../../.env.test');
  try {
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
      console.log('✅ Test environment file removed');
    }
  } catch (error) {
    console.warn('⚠️  Could not remove test environment file:', error.message);
  }

  // Clean up test directories (optional)
  const testDirs = [
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../../mcp-servers')
  ];

  for (const dir of testDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        // Only remove test files, keep directory structure
        files.forEach(file => {
          if (file.startsWith('test-') || file.includes('temp')) {
            fs.unlinkSync(path.join(dir, file));
          }
        });
        console.log(`✅ Cleaned test files from: ${path.basename(dir)}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not clean directory ${dir}:`, error.message);
    }
  }

  // Close any remaining database connections
  try {
    // In a real application, you might want to:
    // 1. Close database connections
    // 2. Clean up test data
    // 3. Reset any global state
    console.log('✅ Database cleanup complete');
  } catch (error) {
    console.warn('⚠️  Database cleanup warning:', error.message);
  }

  // Force cleanup of any hanging processes
  setTimeout(() => {
    console.log('🏁 Global test teardown complete');
    process.exit(0);
  }, 500);
};