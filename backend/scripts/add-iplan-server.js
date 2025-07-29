const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function addIplanServer() {
  try {
    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@platform.com' }
    });

    if (!adminUser) {
      console.error('Admin user not found');
      return;
    }

    // Get the path to the iplan server
    const serverPath = path.join(__dirname, '..', '..', 'mcp-servers', 'iplan-server', 'index.js');
    
    // Add iplan server to database
    const iplanServer = await prisma.mcpServer.create({
      data: {
        userId: adminUser.id,
        name: 'מינהל התכנון הישראלי (iplan)',
        description: 'שרת MCP לחיבור למינהל התכנון הישראלי - חיפוש תכניות, הגבלות בנייה, תשתיות ואתרי שימור',
        command: 'node',
        args: JSON.stringify([serverPath]),
        env: JSON.stringify({}),
        enabled: true,
        healthStatus: 'UNKNOWN'
      }
    });

    console.log('✅ שרת iplan נוסף בהצלחה:', iplanServer.id);
    console.log('📝 פרטי השרת:');
    console.log(`   - שם: ${iplanServer.name}`);
    console.log(`   - פקודה: ${iplanServer.command}`);
    console.log(`   - ארגומנטים: ${iplanServer.args}`);
    console.log(`   - מופעל: ${iplanServer.enabled}`);

  } catch (error) {
    console.error('❌ שגיאה בהוספת שרת iplan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addIplanServer();