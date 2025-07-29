@echo off
echo.
echo ========================================
echo   🚀 AI Platform - Deploy to GitLab
echo ========================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed or not in PATH
    echo Please install Git from: https://git-scm.com/
    pause
    exit /b 1
)

REM Check if we're in a git repository
if not exist ".git" (
    echo ❌ This is not a Git repository
    echo Please initialize Git repository first:
    echo    git init
    echo    git remote add origin YOUR_GITLAB_URL
    pause
    exit /b 1
)

echo 📋 Checking current status...
git status

echo.
echo 📦 Building frontend...
cd frontend-next
call npm run build
if errorlevel 1 (
    echo ❌ Frontend build failed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo 🧪 Running tests...
cd backend
call npm test
if errorlevel 1 (
    echo ⚠️ Some tests failed, continuing anyway...
)
cd ..

echo.
echo 📝 Adding all changes...
git add .

echo.
echo 💾 Creating commit...
set /p commit_message="Enter commit message (or press Enter for default): "
if "%commit_message%"=="" set commit_message=🚀 Update: %date% %time%

git commit -m "%commit_message%"

if errorlevel 1 (
    echo ℹ️ No changes to commit
) else (
    echo ✅ Changes committed successfully
)

echo.
echo 🌐 Pushing to GitLab...
git push origin main

if errorlevel 1 (
    echo ❌ Push failed. Trying to set upstream...
    git push -u origin main
    if errorlevel 1 (
        echo ❌ Push failed. Please check your GitLab remote URL
        echo Current remotes:
        git remote -v
        pause
        exit /b 1
    )
)

echo.
echo ✅ Successfully deployed to GitLab!
echo.
echo 📡 If connected to Netlify, your changes should deploy automatically
echo 🔗 Check your Netlify dashboard for deployment status
echo.

REM Open GitLab in browser (optional)
set /p open_gitlab="Open GitLab repository in browser? (y/n): "
if /i "%open_gitlab%"=="y" (
    start "" "https://gitlab.com"
)

REM Open Netlify dashboard (optional)
set /p open_netlify="Open Netlify dashboard in browser? (y/n): "
if /i "%open_netlify%"=="y" (
    start "" "https://app.netlify.com"
)

echo.
echo 🎉 Deployment process completed!
echo.
pause