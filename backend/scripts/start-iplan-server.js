const mcpService = require('../src/services/mcpService');
const logger = require('../src/utils/logger');

async function startIplanServer() {
  try {
    console.log('🚀 מפעיל שרת iplan MCP...');
    
    // Get all servers to find the iplan server
    const allServers = await mcpService.getAllServers();
    const iplanServer = allServers.find(s => 
      s.name.includes('iplan') || s.name.includes('מינהל התכנון')
    );
    
    if (!iplanServer) {
      console.error('❌ שרת iplan לא נמצא במסד הנתונים');
      return;
    }
    
    console.log(`📋 נמצא שרת: ${iplanServer.name} (ID: ${iplanServer.id})`);
    
    // Start the server
    const result = await mcpService.startServer(iplanServer.id);
    
    console.log('✅ שרת iplan הופעל בהצלחה!');
    console.log(`📊 סטטוס שרת: ${iplanServer.healthStatus}`);
    
    // Get server status
    setTimeout(async () => {
      try {
        const stats = await mcpService.getServerStats(iplanServer.id);
        console.log('📈 סטטיסטיקות שרת:');
        console.log(`   - סטטוס: ${stats.runtimeStatus.status}`);
        console.log(`   - PID: ${stats.runtimeStatus.pid}`);
        console.log(`   - זמן פעילות: ${stats.runtimeStatus.uptime}ms`);
      } catch (error) {
        console.warn('⚠️  לא ניתן לקבל סטטיסטיקות שרת:', error.message);
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ שגיאה בהפעלת שרת iplan:', error);
  }
}

startIplanServer();