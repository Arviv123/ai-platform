#!/usr/bin/env node

const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGeminiDirect() {
    console.log('🧪 Testing Gemini API directly...\n');

    try {
        const genAI = new GoogleGenerativeAI('AIzaSyBzzaw5hY0GmxIMwEFQOVAUkXKAS6pRyPQ');
        
        console.log('1️⃣ Testing gemini-1.5-flash...');
        const model1 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result1 = await model1.generateContent("Hello! Please respond in Hebrew with a greeting.");
        const response1 = await result1.response;
        console.log('✅ Response:', response1.text());
        
        console.log('\n2️⃣ Testing gemini-1.5-pro...');
        const model2 = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result2 = await model2.generateContent("Explain AI in one sentence in Hebrew.");
        const response2 = await result2.response;
        console.log('✅ Response:', response2.text());
        
        console.log('\n3️⃣ Testing gemini-2.0-flash-001...');
        const model3 = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
        const result3 = await model3.generateContent("Say 'test successful' in Hebrew.");
        const response3 = await result3.response;
        console.log('✅ Response:', response3.text());
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testGeminiDirect();