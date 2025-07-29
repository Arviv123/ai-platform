const { generateChatCompletionWithTools } = require('../src/services/aiService');
const logger = require('../src/utils/logger');

async function testMCPIntegration() {
  try {
    console.log('🧪 בודק אינטגרציה של MCP עם AI...');
    
    // Test messages with planning-related content
    const testMessages = [
      {
        role: 'user',
        content: 'אני רוצה לחפש תכניות בנייה בתל אביב. תוכל לעזור לי?'
      }
    ];
    
    console.log('📤 שולח הודעה לבדיקה...');
    
    const response = await generateChatCompletionWithTools(
      'claude-3-sonnet', // או כל מודל זמין
      testMessages,
      'admin-user-id', // Admin user ID for testing
      { maxTokens: 1000 }
    );
    
    console.log('✅ תגובה התקבלה:');
    console.log('📝 תכן:', response.content);
    
    if (response.toolUsed) {
      console.log('🔧 כלי שהופעל:', response.toolUsed.name);
      console.log('⚙️  פרמטרים:', JSON.stringify(response.toolUsed.parameters, null, 2));
      console.log('📊 תוצאה:', response.toolUsed.result.success ? '✅ הצליח' : '❌ נכשל');
    } else {
      console.log('ℹ️  לא הופעלו כלים בתגובה זו');
    }
    
    console.log('🎯 בדיקת אינטגרציה הושלמה בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת אינטגרציה:', error);
  }
}

testMCPIntegration();