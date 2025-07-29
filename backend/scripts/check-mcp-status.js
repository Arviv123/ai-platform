const { PrismaClient } = require('@prisma/client');
const mcpService = require('../src/services/mcpService');

const prisma = new PrismaClient();

async function checkMCPStatus() {
  try {
    console.log('🔍 בודק סטטוס שרתי MCP...\n');
    
    // Get all MCP servers from database
    const servers = await prisma.mcpServer.findMany({
      where: { deletedAt: null }
    });
    
    console.log(`📊 נמצאו ${servers.length} שרתי MCP במסד הנתונים:\n`);
    
    for (const server of servers) {
      console.log(`📋 שרת: ${server.name}`);
      console.log(`   ID: ${server.id}`);
      console.log(`   פקודה: ${server.command}`);
      console.log(`   ארגומנטים: ${server.args}`);
      console.log(`   מופעל: ${server.enabled ? '✅' : '❌'}`);
      console.log(`   סטטוס בריאות: ${server.healthStatus}`);
      console.log(`   בדיקה אחרונה: ${server.lastHealthCheck || 'אף פעם'}`);
      console.log(`   שימוש אחרון: ${server.lastUsedAt || 'אף פעם'}`);
      console.log(`   כלל קריאות: ${server.totalCalls}`);
      
      // Check if it's currently running
      const runtimeStatus = mcpService.getServerRuntimeStatus(server.id);
      console.log(`   רץ כעת: ${runtimeStatus.status === 'running' ? '🟢' : '🔴'}`);
      if (runtimeStatus.pid) {
        console.log(`   PID: ${runtimeStatus.pid}`);
      }
      console.log('');
    }
    
    // Get user servers to check availability
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@platform.com' }
    });
    
    if (adminUser) {
      console.log('🔧 בודק כלים זמינים למשתמש admin...\n');
      const userServers = await mcpService.getUserServers(adminUser.id);
      
      for (const server of userServers) {
        console.log(`🔧 שרת ${server.name}:`);
        console.log(`   זמין: ${server.isRunning ? '✅' : '❌'}`);
        console.log(`   בריא: ${server.healthStatus === 'HEALTHY' ? '✅' : '❌'}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת סטטוס MCP:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMCPStatus();