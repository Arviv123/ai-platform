const aiKeys = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  google: process.env.GOOGLE_AI_API_KEY
};

// Validate API keys
function validateApiKeys() {
  const missing = [];
  
  if (!aiKeys.anthropic) missing.push('ANTHROPIC_API_KEY');
  if (!aiKeys.openai) missing.push('OPENAI_API_KEY');
  if (!aiKeys.google) missing.push('GOOGLE_AI_API_KEY');
  
  if (missing.length > 0) {
    console.warn('Missing AI API keys:', missing.join(', '));
    console.warn('Some AI features may not work properly.');
    console.warn('Please add these keys to your .env file:');
    missing.forEach(key => console.warn(`${key}=your-api-key-here`));
  }
  
  return missing.length === 0;
}

// Get available models based on API keys
function getAvailableModels() {
  const models = [];
  
  if (aiKeys.anthropic) {
    models.push(
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic' }
    );
  }
  
  if (aiKeys.openai) {
    models.push(
      { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
    );
  }
  
  if (aiKeys.google) {
    models.push(
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google' }
    );
  }
  
  return models;
}

module.exports = {
  aiKeys,
  validateApiKeys,
  getAvailableModels
};