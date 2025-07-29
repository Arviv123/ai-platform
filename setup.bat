@echo off
echo Setting up AI Platform...
echo This may take a few minutes on first run.
echo.

echo Step 1: Installing Backend dependencies...
cd /d "%~dp0backend"
if not exist node_modules (
    echo Installing backend packages...
    call npm install
) else (
    echo Backend dependencies already installed.
)

echo.
echo Step 2: Installing Frontend dependencies...
cd /d "%~dp0frontend-next"
if not exist node_modules (
    echo Installing frontend packages...
    call npm install
) else (
    echo Frontend dependencies already installed.
)

echo.
echo Step 3: Installing MCP Server dependencies...
cd /d "%~dp0mcp-server-example"
if not exist node_modules (
    echo Installing MCP packages...
    call npm install
) else (
    echo MCP dependencies already installed.
)

echo.
echo Step 4: Setting up database...
cd /d "%~dp0backend"
echo Generating Prisma client...
call npx prisma generate
echo Setting up database schema...
call npx prisma db push
echo Seeding database with sample data...
call node prisma/seed.js

echo.
echo Setup completed!
echo You can now run: start.bat
echo.
pause