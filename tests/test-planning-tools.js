const IsraeliPlanningService = require('./backend/src/services/israeliPlanningService');

async function testPlanningTools() {
  console.log('🧪 בודק כלי מינהל התכנון הישראלי...\n');
  
  const planningService = new IsraeliPlanningService();
  
  try {
    console.log('1️⃣ בודק זמינות שירותים...');
    const status = await planningService.checkServiceStatus();
    console.log(status);
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('2️⃣ מחפש תכניות בתל אביב...');
    const searchResults = await planningService.searchPlans({
      district: 'תל אביב',
      minArea: 10,
      maxArea: 100
    });
    console.log(searchResults);
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('3️⃣ מחפש תכניות לפי מיקום (תל אביב)...');
    // קואורדינטות של תל אביב במערכת ישראל TM
    const locationResults = await planningService.searchByLocation(181000, 665000, 1000);
    console.log(locationResults);
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('4️⃣ מקבל מידע מקיף על מיקום...');
    const comprehensiveData = await planningService.getComprehensiveLocationData(181000, 665000, 500);
    console.log(comprehensiveData);
    
    console.log('\n✅ כל הבדיקות הושלמו בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקה:', error.message);
  }
}

testPlanningTools();