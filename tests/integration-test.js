#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3004';

async function testIntegration() {
  console.log('🚀 Starting Integration Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Health Check
  try {
    console.log('1️⃣ Testing Health Check...');
    const response = await axios.get(`${API_BASE}/health`);
    if (response.status === 200 && response.data.status === 'OK') {
      console.log('✅ Health check passed');
      testsPassed++;
    } else {
      console.log('❌ Health check failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    testsFailed++;
  }

  // Test 2: API Info
  try {
    console.log('\n2️⃣ Testing API Info...');
    const response = await axios.get(`${API_BASE}/api`);
    if (response.status === 200 && response.data.message === 'AI Platform API') {
      console.log('✅ API info passed');
      testsPassed++;
    } else {
      console.log('❌ API info failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ API info failed:', error.message);
    testsFailed++;
  }

  // Test 3: Register User
  let authToken = null;
  try {
    console.log('\n3️⃣ Testing User Registration...');
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPass123!',
      firstName: 'Integration',
      lastName: 'Test',
      agreeTerms: true
    };
    
    const response = await axios.post(`${API_BASE}/api/auth/register`, testUser);
    if (response.status === 200 && response.data.status === 'success') {
      console.log('✅ User registration passed');
      authToken = response.data.accessToken;
      testsPassed++;
    } else {
      console.log('❌ User registration failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ User registration failed:', error.response?.data?.message || error.message);
    testsFailed++;
  }

  // Test 4: Authenticated Request
  if (authToken) {
    try {
      console.log('\n4️⃣ Testing Authenticated Request...');
      const response = await axios.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.status === 200 && response.data.status === 'success') {
        console.log('✅ Authenticated request passed');
        testsPassed++;
      } else {
        console.log('❌ Authenticated request failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Authenticated request failed:', error.response?.data?.message || error.message);
      testsFailed++;
    }
  } else {
    console.log('\n4️⃣ Skipping authenticated request test (no auth token)');
    testsFailed++;
  }

  // Test 5: Chat Models Endpoint
  if (authToken) {
    try {
      console.log('\n5️⃣ Testing Chat Models Endpoint...');
      const response = await axios.get(`${API_BASE}/api/chat/models`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.status === 200) {
        console.log('✅ Chat models endpoint passed');
        testsPassed++;
      } else {
        console.log('❌ Chat models endpoint failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ Chat models endpoint failed:', error.response?.data?.message || error.message);
      testsFailed++;
    }
  } else {
    console.log('\n5️⃣ Skipping chat models test (no auth token)');
    testsFailed++;
  }

  // Test 6: MCP Endpoints
  if (authToken) {
    try {
      console.log('\n6️⃣ Testing MCP Endpoints...');
      const response = await axios.get(`${API_BASE}/api/mcp`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.status === 200) {
        console.log('✅ MCP endpoints passed');
        testsPassed++;
      } else {
        console.log('❌ MCP endpoints failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('❌ MCP endpoints failed:', error.response?.data?.message || error.message);
      testsFailed++;
    }
  } else {
    console.log('\n6️⃣ Skipping MCP test (no auth token)');
    testsFailed++;
  }

  // Results
  console.log('\n📊 Integration Test Results:');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Integration is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed. Check the backend configuration.');
    process.exit(1);
  }
}

// Run tests
testIntegration().catch(error => {
  console.error('💥 Integration test failed:', error.message);
  process.exit(1);
});