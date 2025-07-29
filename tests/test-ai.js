#!/usr/bin/env node

const AIService = require('./backend/src/services/ai/AIService');

async function testAI() {
  console.log('🧪 Testing AI Service...\n');

  try {
    const aiService = new AIService();
    
    console.log('1️⃣ Testing getAvailableModels...');
    const models = aiService.getAvailableModels();
    console.log('Models:', JSON.stringify(models, null, 2));
    
    console.log('\n2️⃣ Testing connection...');
    const connectionTest = await aiService.testConnection();
    console.log('Connection test:', JSON.stringify(connectionTest, null, 2));
    
    console.log('\n3️⃣ Testing generateAIResponse...');
    const response = await aiService.generateAIResponse('Hello, AI! Please respond with a simple greeting.');
    console.log('AI Response:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAI();