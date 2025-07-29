const { generateChatCompletionWithTools } = require('./backend/src/services/aiService');

async function testChatWithPlanningTools() {
  console.log('🧪 בודק אינטגרציה של כלי התכנון בצ\'אט...\n');
  
  // Test messages that should trigger planning tools
  const testMessages = [
    {
      role: 'user',
      content: 'מה אתה יכול לעשות?'
    }
  ];
  
  try {
    console.log('📨 שולח הודעה לצ\'אט...');
    console.log('הודעה:', testMessages[0].content);
    
    const result = await generateChatCompletionWithTools(
      'claude-3-haiku',
      testMessages,
      'test-user-id'
    );
    
    console.log('\n📋 תשובת הצ\'אט:');
    console.log(result.content);
    
    if (result.toolUsed) {
      console.log('\n🔧 כלי שנעשה בו שימוש:');
      console.log('שם:', result.toolUsed.name);
      console.log('פרמטרים:', JSON.stringify(result.toolUsed.parameters, null, 2));
    } else {
      console.log('\n💬 לא נעשה שימוש בכלים (כפי שמצופה עבור השאלה הזו)');
    }
    
    // Now test with a planning-related question
    console.log('\n' + '='.repeat(60) + '\n');
    
    const planningMessages = [
      {
        role: 'user',
        content: 'איזה תכניות יש בתל אביב?'
      }
    ];
    
    console.log('📨 שולח הודעה על תכנון...');
    console.log('הודעה:', planningMessages[0].content);
    
    const planningResult = await generateChatCompletionWithTools(
      'claude-3-haiku',
      planningMessages,
      'test-user-id'
    );
    
    console.log('\n📋 תשובת הצ\'אט:');
    console.log(planningResult.content);
    
    if (planningResult.toolUsed) {
      console.log('\n🔧 כלי שנעשה בו שימוש:');
      console.log('שם:', planningResult.toolUsed.name);
      console.log('פרמטרים:', JSON.stringify(planningResult.toolUsed.parameters, null, 2));
      console.log('תוצאה:', planningResult.toolUsed.result.success ? '✅ הצליח' : '❌ נכשל');
    } else {
      console.log('\n💭 לא נעשה שימוש בכלים');
    }
    
    console.log('\n✅ בדיקת האינטגרציה הושלמה!');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקה:', error.message);
    console.error('Stack:', error.stack);
  }
}

testChatWithPlanningTools();