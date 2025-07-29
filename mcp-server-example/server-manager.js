const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ServerManager {
  constructor() {
    this.serverProcess = null;
    this.port = process.env.PORT || 8080;
    this.pidFile = path.join(__dirname, '.server.pid');
    this.logFile = path.join(__dirname, 'server.log');
  }

  // Check if port is in use
  async isPortInUse(port) {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        resolve(stdout.includes(`${port}`));
      });
    });
  }

  // Kill process by PID
  async killProcess(pid) {
    return new Promise((resolve) => {
      exec(`taskkill /F /PID ${pid}`, (error) => {
        resolve(!error);
      });
    });
  }

  // Stop all servers on ports 8080-8090
  async stopAllServers() {
    console.log('🛑 Stopping all existing servers...');
    
    for (let port = 8080; port <= 8090; port++) {
      try {
        const { exec } = require('child_process');
        await new Promise(resolve => {
          exec(`netstat -ano | findstr :${port}`, async (error, stdout) => {
            if (stdout) {
              const lines = stdout.split('\\n');
              for (const line of lines) {
                if (line.includes('LISTENING')) {
                  const parts = line.trim().split(/\\s+/);
                  const pid = parts[parts.length - 1];
                  if (pid && !isNaN(pid)) {
                    console.log(`  Killing process ${pid} on port ${port}`);
                    await this.killProcess(pid);
                  }
                }
              }
            }
            resolve();
          });
        });
      } catch (error) {
        // Ignore errors
      }
    }

    // Remove PID file if exists
    if (fs.existsSync(this.pidFile)) {
      fs.unlinkSync(this.pidFile);
    }

    // Wait a bit for processes to terminate
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Find available port
  async findAvailablePort(startPort = 8080) {
    for (let port = startPort; port <= startPort + 20; port++) {
      if (!(await this.isPortInUse(port))) {
        return port;
      }
    }
    throw new Error('No available ports found');
  }

  // Start the server
  async start(forceRestart = false) {
    try {
      if (forceRestart) {
        await this.stopAllServers();
      }

      // Find available port
      this.port = await this.findAvailablePort();
      console.log(`🚀 Starting server on port ${this.port}...`);

      // Start server process
      this.serverProcess = spawn('node', ['index.js'], {
        env: { ...process.env, PORT: this.port },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Save PID
      fs.writeFileSync(this.pidFile, this.serverProcess.pid.toString());

      // Handle server output
      const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      
      this.serverProcess.stdout.on('data', (data) => {
        const message = data.toString();
        console.log(message.trim());
        logStream.write(`[${new Date().toISOString()}] ${message}`);
      });

      this.serverProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.error(message.trim());
        logStream.write(`[${new Date().toISOString()}] ERROR: ${message}`);
      });

      this.serverProcess.on('close', (code) => {
        console.log(`📊 Server process exited with code ${code}`);
        logStream.end();
        if (fs.existsSync(this.pidFile)) {
          fs.unlinkSync(this.pidFile);
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('❌ Failed to start server:', error);
        logStream.end();
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test server
      try {
        const axios = require('axios');
        const response = await axios.get(`http://localhost:${this.port}/health`);
        console.log('✅ Server is running successfully!');
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🔧 Tools: http://localhost:${this.port}/mcp/tools`);
        console.log(`💬 Conversations: http://localhost:${this.port}/conversations`);
        console.log(`📝 Logs: ${this.logFile}`);
        return true;
      } catch (error) {
        console.error('❌ Server health check failed:', error.message);
        return false;
      }

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      return false;
    }
  }

  // Stop the server
  async stop() {
    console.log('🛑 Stopping server...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }

    await this.stopAllServers();
    console.log('✅ Server stopped successfully');
  }

  // Restart the server
  async restart() {
    console.log('🔄 Restarting server...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await this.start();
  }

  // Get server status
  async status() {
    if (fs.existsSync(this.pidFile)) {
      const pid = fs.readFileSync(this.pidFile, 'utf8').trim();
      console.log(`📊 Server PID: ${pid}`);
      
      // Check if process is running
      try {
        process.kill(pid, 0);
        console.log('✅ Server is running');
        
        if (await this.isPortInUse(this.port)) {
          console.log(`🌐 Server is accessible on port ${this.port}`);
          return true;
        } else {
          console.log('⚠️  Server process exists but port is not listening');
          return false;
        }
      } catch (error) {
        console.log('❌ Server process is not running');
        fs.unlinkSync(this.pidFile);
        return false;
      }
    } else {
      console.log('❌ No server process found');
      return false;
    }
  }

  // Show server logs
  showLogs(lines = 50) {
    if (fs.existsSync(this.logFile)) {
      console.log(`📝 Last ${lines} log lines:`);
      exec(`powershell "Get-Content '${this.logFile}' | Select-Object -Last ${lines}"`, (error, stdout) => {
        if (!error) {
          console.log(stdout);
        } else {
          console.log('❌ Could not read logs');
        }
      });
    } else {
      console.log('📝 No log file found');
    }
  }
}

// CLI interface
if (require.main === module) {
  const manager = new ServerManager();
  const command = process.argv[2];

  switch (command) {
    case 'start':
      manager.start(false);
      break;
    case 'stop':
      manager.stop();
      break;
    case 'restart':
      manager.restart();
      break;
    case 'force-restart':
      manager.start(true);
      break;
    case 'status':
      manager.status();
      break;
    case 'logs':
      const lines = process.argv[3] || 50;
      manager.showLogs(parseInt(lines));
      break;
    default:
      console.log(`
🤖 AI Platform MCP Server Manager

Usage:
  node server-manager.js <command>

Commands:
  start          Start the server
  stop           Stop the server  
  restart        Restart the server
  force-restart  Stop all servers and start fresh
  status         Show server status
  logs [lines]   Show server logs (default: 50 lines)

Examples:
  node server-manager.js start
  node server-manager.js force-restart
  node server-manager.js logs 100
      `);
  }
}

module.exports = ServerManager;