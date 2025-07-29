#!/usr/bin/env node

/**
 * Integration Test Script for AI Platform
 * Tests the connections between frontend and backend components
 */

const https = require('https');
const http = require('http');

// Configuration
const BACKEND_BASE = process.env.BACKEND_URL || 'http://localhost:3004';
const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

// Test utilities
const makeRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
};

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

// Test Functions
async function testBackendHealth() {
  console.log('\n🔍 Testing Backend Health...');
  
  try {
    const result = await makeRequest(`${BACKEND_BASE}/health`);
    logTest('Backend health endpoint', result.status === 200, `Status: ${result.status}`);
    logTest('Health response format', result.data.status === 'OK', `Response: ${JSON.stringify(result.data)}`);
  } catch (error) {
    logTest('Backend health endpoint', false, `Error: ${error.message}`);
  }
}

async function testBackendAPI() {
  console.log('\n🔍 Testing Backend API...');
  
  try {
    const result = await makeRequest(`${BACKEND_BASE}/api`);
    logTest('API info endpoint', result.status === 200, `Status: ${result.status}`);
    logTest('API info structure', 
      result.data.endpoints && result.data.endpoints.auth && result.data.endpoints.chat,
      `Endpoints: ${Object.keys(result.data.endpoints || {}).join(', ')}`
    );
  } catch (error) {
    logTest('Backend API endpoint', false, `Error: ${error.message}`);
  }
}

async function testCORS() {
  console.log('\n🔍 Testing CORS Configuration...');
  
  try {
    const result = await makeRequest(`${BACKEND_BASE}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const corsHeader = result.headers['access-control-allow-origin'];
    logTest('CORS preflight', result.status === 204 || result.status === 200, `Status: ${result.status}`);
    logTest('CORS origin header', corsHeader === 'http://localhost:3000' || corsHeader === '*', `Origin: ${corsHeader}`);
  } catch (error) {
    logTest('CORS configuration', false, `Error: ${error.message}`);
  }
}

async function testAuthEndpoints() {
  console.log('\n🔍 Testing Authentication Endpoints...');
  
  try {
    // Test registration endpoint exists
    const regResult = await makeRequest(`${BACKEND_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }) // Incomplete data to test validation
    });
    
    logTest('Register endpoint exists', regResult.status !== 404, `Status: ${regResult.status}`);
    logTest('Register validation works', regResult.status === 400, `Status: ${regResult.status}`);
    
    // Test login endpoint
    const loginResult = await makeRequest(`${BACKEND_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }) // Incomplete data
    });
    
    logTest('Login endpoint exists', loginResult.status !== 404, `Status: ${loginResult.status}`);
    logTest('Login validation works', loginResult.status === 400, `Status: ${loginResult.status}`);
    
  } catch (error) {
    logTest('Authentication endpoints', false, `Error: ${error.message}`);
  }
}

async function testMCPEndpoints() {
  console.log('\n🔍 Testing MCP Endpoints...');
  
  try {
    // Test MCP endpoints (should require auth)
    const mcpResult = await makeRequest(`${BACKEND_BASE}/api/mcp`);
    logTest('MCP endpoint exists', mcpResult.status !== 404, `Status: ${mcpResult.status}`);
    logTest('MCP endpoint requires auth', mcpResult.status === 401, `Status: ${mcpResult.status}`);
    
  } catch (error) {
    logTest('MCP endpoints', false, `Error: ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n🔍 Testing Error Handling...');
  
  try {
    // Test 404 handling
    const notFoundResult = await makeRequest(`${BACKEND_BASE}/api/nonexistent`);
    logTest('404 error handling', notFoundResult.status === 404, `Status: ${notFoundResult.status}`);
    logTest('404 error format', notFoundResult.data.status === 'fail', `Response: ${JSON.stringify(notFoundResult.data)}`);
    
  } catch (error) {
    logTest('Error handling', false, `Error: ${error.message}`);
  }
}

async function testDatabaseConnection() {
  console.log('\n🔍 Testing Database Connection...');
  
  try {
    // Try to access user endpoint (requires auth but tests DB)
    const userResult = await makeRequest(`${BACKEND_BASE}/api/user`);
    logTest('Database accessible', userResult.status !== 500, `Status: ${userResult.status}`);
    
  } catch (error) {
    logTest('Database connection', false, `Error: ${error.message}`);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting AI Platform Integration Tests\n');
  console.log(`Backend: ${BACKEND_BASE}`);
  console.log(`Frontend: ${FRONTEND_BASE}\n`);
  
  await testBackendHealth();
  await testBackendAPI();
  await testCORS();
  await testAuthEndpoints();
  await testMCPEndpoints();
  await testErrorHandling();
  await testDatabaseConnection();
  
  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => console.log(`   - ${test.name}: ${test.details}`));
  }
  
  console.log('\n🎉 Integration tests completed!');
  
  // Exit with error code if tests failed
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle script execution
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, makeRequest };