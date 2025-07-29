@echo off
echo Starting AI Platform...
echo.

echo Step 1: Stopping previous processes...
taskkill /F /IM node.exe 2>nul >nul
timeout /t 2 /nobreak > nul

echo Step 2: Starting Backend...
cd /d "%~dp0backend"
start "Backend" /MIN cmd /c "npm run dev"
timeout /t 8 /nobreak > nul

echo Step 3: Starting Frontend...
cd /d "%~dp0frontend-next"
start "Frontend" /MIN cmd /c "npm run dev"
timeout /t 8 /nobreak > nul

echo Step 4: Starting MCP Server...
cd /d "%~dp0mcp-server-example"
start "MCP" /MIN cmd /c "npm run force-restart"
timeout /t 5 /nobreak > nul

echo.
echo AI Platform is starting...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.
echo Login: admin@platform.com / admin123
echo.
echo Opening browser...
timeout /t 3 /nobreak > nul
start http://localhost:3000

echo System is running!
pause