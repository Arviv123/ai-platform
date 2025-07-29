@echo off
echo Stopping AI Platform MCP Server...
cd /d "%~dp0"
npm run stop
pause