#!/usr/bin/env node

/**
 * Render.com production server starter
 * This file ensures the server starts correctly on Render
 */

const path = require('path');
const fs = require('fs');

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Set PORT if not set (Render provides this)
if (!process.env.PORT) {
  process.env.PORT = '10000';
}

console.log('🚀 Starting AI Platform Backend...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV);
console.log('🌐 PORT:', process.env.PORT);
console.log('📁 Current directory:', process.cwd());

// Check if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist directory not found. Did the build complete successfully?');
  process.exit(1);
}

// Check if main file exists
const mainFile = path.join(distPath, 'index.js');
if (!fs.existsSync(mainFile)) {
  console.error('❌ dist/index.js not found. Build may have failed.');
  process.exit(1);
}

console.log('✅ Starting server from:', mainFile);

// Start the server
try {
  require(mainFile);
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}