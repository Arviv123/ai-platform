#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting AI Platform Backend...');

// Run database setup first
console.log('🔧 Setting up database...');
const setupScript = path.join(__dirname, 'scripts', 'setup-database.js');

const setupProcess = spawn('node', [setupScript], {
  stdio: 'inherit',
  cwd: __dirname
});

setupProcess.on('close', (code) => {
  console.log(`Database setup completed with exit code ${code}`);
  
  // Start the main server
  console.log('🌟 Starting main server...');
  const serverProcess = spawn('node', ['src/index.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  serverProcess.on('close', (serverCode) => {
    console.log(`Server process exited with code ${serverCode}`);
    process.exit(serverCode);
  });
  
  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
});

setupProcess.on('error', (error) => {
  console.error('Database setup failed:', error);
  console.log('Continuing with server startup anyway...');
  
  // Start server even if database setup fails
  const serverProcess = spawn('node', ['src/index.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  serverProcess.on('close', (serverCode) => {
    process.exit(serverCode);
  });
});