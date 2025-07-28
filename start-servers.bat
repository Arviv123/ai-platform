@echo off
echo Starting AI Platform servers...

echo.
echo Starting Backend server on port 3004...
cd /d "C:\Users\חיים\Desktop\ai-platform\backend"
start "Backend Server" cmd /k "npm run dev"

echo.
echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak > nul

echo.
echo Starting Frontend server on port 3000...
cd /d "C:\Users\חיים\Desktop\ai-platform\frontend-next"
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo.
echo Backend: http://localhost:3004
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:3004/api
echo.
echo Press any key to continue...
pause > nul