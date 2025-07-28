const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    });
    
    console.log(`✅ Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
    });

    // Test organizations
    const orgs = await prisma.organization.count();
    console.log(`✅ Found ${orgs} organizations`);

    // Test chat sessions
    const sessions = await prisma.chatSession.count();
    console.log(`✅ Found ${sessions} chat sessions`);

    // Test MCP servers
    const mcpServers = await prisma.mcpServer.count();
    console.log(`✅ Found ${mcpServers} MCP servers`);

    console.log('🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();