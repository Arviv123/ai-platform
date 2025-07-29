#!/usr/bin/env node

/**
 * Frontend Validation Script
 * Checks frontend build and basic functionality
 */

const fs = require('fs');
const path = require('path');

// Test Results Storage
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

const logTest = (name, passed, details = '') => {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (details) console.log(`   ${details}`);
  
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
};

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  logTest(`${description} exists`, exists, filePath);
  return exists;
}

function checkDirectoryExists(dirPath, description) {
  const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  logTest(`${description} directory exists`, exists, dirPath);
  return exists;
}

function validatePackageJson(packagePath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    logTest('package.json is valid JSON', true, `Name: ${pkg.name}, Version: ${pkg.version}`);
    
    const hasDevScript = pkg.scripts && pkg.scripts.dev;
    logTest('Dev script exists', !!hasDevScript, pkg.scripts?.dev || 'Not found');
    
    const hasBuildScript = pkg.scripts && pkg.scripts.build;
    logTest('Build script exists', !!hasBuildScript, pkg.scripts?.build || 'Not found');
    
    const hasNextDep = pkg.dependencies && pkg.dependencies.next;
    logTest('Next.js dependency exists', !!hasNextDep, pkg.dependencies?.next || 'Not found');
    
    return true;
  } catch (error) {
    logTest('package.json validation', false, error.message);
    return false;
  }
}

function validateTSConfig(tsConfigPath) {
  try {
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    logTest('tsconfig.json is valid', true, `Compiler target: ${tsConfig.compilerOptions?.target}`);
    
    const hasAppRouter = tsConfig.compilerOptions?.paths && 
                        tsConfig.compilerOptions.paths['@/*'];
    logTest('Path mapping configured', !!hasAppRouter, 'App router paths configured');
    
    return true;
  } catch (error) {
    logTest('tsconfig.json validation', false, error.message);
    return false;
  }
}

function validateEnvironmentFiles() {
  const frontendDir = path.join(__dirname, 'frontend-next');
  
  // Check for environment files
  const envLocal = path.join(frontendDir, '.env.local');
  const envExample = path.join(frontendDir, '.env.example');
  
  checkFileExists(envLocal, '.env.local');
  
  if (fs.existsSync(envLocal)) {
    try {
      const envContent = fs.readFileSync(envLocal, 'utf8');
      const hasApiUrl = envContent.includes('NEXT_PUBLIC_API_URL');
      logTest('API URL configured', hasApiUrl, 'NEXT_PUBLIC_API_URL found in .env.local');
    } catch (error) {
      logTest('Environment file readable', false, error.message);
    }
  }
}

function validateAppStructure() {
  const frontendDir = path.join(__dirname, 'frontend-next');
  const srcDir = path.join(frontendDir, 'src');
  const appDir = path.join(srcDir, 'app');
  
  checkDirectoryExists(srcDir, 'src');
  checkDirectoryExists(appDir, 'app');
  checkDirectoryExists(path.join(srcDir, 'components'), 'components');
  checkDirectoryExists(path.join(srcDir, 'lib'), 'lib');
  
  // Check for key files
  checkFileExists(path.join(appDir, 'layout.tsx'), 'Root layout');
  checkFileExists(path.join(appDir, 'page.tsx'), 'Root page');
  checkFileExists(path.join(appDir, 'globals.css'), 'Global styles');
  
  // Check for key pages
  checkFileExists(path.join(appDir, 'auth', 'login', 'page.tsx'), 'Login page');
  checkFileExists(path.join(appDir, 'auth', 'register', 'page.tsx'), 'Register page');
  checkFileExists(path.join(appDir, 'chat', 'page.tsx'), 'Chat page');
  checkFileExists(path.join(appDir, 'dashboard', 'page.tsx'), 'Dashboard page');
  
  // Check for API integration
  checkFileExists(path.join(srcDir, 'lib', 'api.ts'), 'API client');
  
  // Check for providers
  checkFileExists(path.join(srcDir, 'components', 'providers', 'AuthProvider.tsx'), 'Auth provider');
  checkFileExists(path.join(srcDir, 'components', 'providers', 'ToastProvider.tsx'), 'Toast provider');
}

function validateApiIntegration() {
  const apiPath = path.join(__dirname, 'frontend-next', 'src', 'lib', 'api.ts');
  
  if (fs.existsSync(apiPath)) {
    try {
      const apiContent = fs.readFileSync(apiPath, 'utf8');
      
      const hasApiBase = apiContent.includes('API_BASE_URL');
      logTest('API base URL defined', hasApiBase, 'API_BASE_URL constant found');
      
      const hasApiHelpers = apiContent.includes('apiHelpers');
      logTest('API helpers exported', hasApiHelpers, 'apiHelpers object found');
      
      const hasAuthMethods = apiContent.includes('login') && apiContent.includes('register');
      logTest('Auth methods available', hasAuthMethods, 'Login and register methods found');
      
      const hasChatMethods = apiContent.includes('chat:');
      logTest('Chat methods available', hasChatMethods, 'Chat methods object found');
      
      const hasMcpMethods = apiContent.includes('mcp:');
      logTest('MCP methods available', hasMcpMethods, 'MCP methods object found');
      
    } catch (error) {
      logTest('API integration validation', false, error.message);
    }
  }
}

async function runValidation() {
  console.log('🔍 Starting Frontend Validation\n');
  
  const frontendDir = path.join(__dirname, 'frontend-next');
  
  if (!fs.existsSync(frontendDir)) {
    logTest('Frontend directory exists', false, frontendDir);
    console.log('\n❌ Frontend directory not found. Stopping validation.');
    return;
  }
  
  console.log('📁 Checking project structure...');
  validateAppStructure();
  
  console.log('\n📦 Validating configuration files...');
  const packagePath = path.join(frontendDir, 'package.json');
  const tsConfigPath = path.join(frontendDir, 'tsconfig.json');
  
  if (checkFileExists(packagePath, 'package.json')) {
    validatePackageJson(packagePath);
  }
  
  if (checkFileExists(tsConfigPath, 'tsconfig.json')) {
    validateTSConfig(tsConfigPath);
  }
  
  console.log('\n🌍 Validating environment configuration...');
  validateEnvironmentFiles();
  
  console.log('\n🔗 Validating API integration...');
  validateApiIntegration();
  
  // Print summary
  console.log('\n📊 Validation Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Validations:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => console.log(`   - ${test.name}: ${test.details}`));
  }
  
  console.log('\n🎉 Frontend validation completed!');
  
  // Exit with error code if validations failed
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle script execution
if (require.main === module) {
  runValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = { runValidation };