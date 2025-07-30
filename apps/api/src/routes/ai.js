const express = require('express');
const router = express.Router();
const AIService = require('../services/ai/AIService');
const aiService = new AIService();

// Get available AI models from all providers
router.get('/models', async (req, res) => {
  try {
    await aiService.initialize();
    const models = aiService.getAvailableModels();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test AI connection and capabilities
router.get('/test', async (req, res) => {
  try {
    await aiService.initialize();
    const testResult = await aiService.testConnection();
    res.json({ test: testResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const response = await aiService.generateAIResponse(prompt);
  res.json({ response });
});

module.exports = router;
