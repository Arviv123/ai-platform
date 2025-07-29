#!/usr/bin/env node

const AIService = require('./backend/src/services/ai/AIService');

// Override environment for test
process.env.DEFAULT_AI_MODEL = 'gemini-1.5-flash';
process.env.AVAILABLE_MODELS = 'gemini-1.5-flash';
process.env.GOOGLE_AI_API_KEY = 'AIzaSyBzzaw5hY0GmxIMwEFQOVAUkXKAS6pRyPQ';

async function testAIWorking() {
  console.log('🧪 Testing AI Service with working config...\n');

  try {
    const aiService = new AIService();
    
    console.log('1️⃣ Testing getAvailableModels...');
    const models = aiService.getAvailableModels();
    console.log('Models:', JSON.stringify(models, null, 2));
    
    console.log('\n2️⃣ Testing connection...');
    const connectionTest = await aiService.testConnection();
    console.log('Connection test:', JSON.stringify(connectionTest, null, 2));
    
    console.log('\n3️⃣ Testing generateAIResponse...');
    const response = await aiService.generateAIResponse('שלום! איך אפשר לעזור לך היום? ענה בעברית בקצרה.');
    console.log('AI Response:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAIWorking();