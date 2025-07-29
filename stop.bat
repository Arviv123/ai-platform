@echo off
echo Stopping AI Platform...
echo.

echo Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul >nul
taskkill /F /IM python.exe 2>nul >nul

echo Cleaning up...
cd /d "%~dp0mcp-server-example"
if exist .server.pid del .server.pid > nul 2>&1

echo.
echo AI Platform stopped!
echo To restart: run start.bat
pause