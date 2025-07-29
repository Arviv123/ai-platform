@echo off
echo.
echo ========================================
echo   ⚡ Quick GitLab Setup
echo ========================================
echo.

echo 🔄 Removing GitHub remote...
git remote remove origin

echo 📝 Adding GitLab remote (template)...
echo.
echo 💡 IMPORTANT: Replace 'yourusername' with your actual GitLab username!
echo.
echo    Example: If your GitLab username is 'john123', use:
echo    https://gitlab.com/john123/ai-platform.git
echo.

set /p username="Enter your GitLab username: "

if "%username%"=="" (
    echo ❌ Username is required
    pause
    exit /b 1
)

set gitlab_url=https://gitlab.com/%username%/ai-platform.git

echo 🔗 Setting GitLab remote to: %gitlab_url%
git remote add origin "%gitlab_url%"

echo ✅ Remote configured! Testing connection...
git remote -v

echo 📤 Pushing to GitLab...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ Push failed - Repository might not exist yet
    echo.
    echo 🔧 Please:
    echo    1. Go to https://gitlab.com
    echo    2. Create new project named: ai-platform
    echo    3. Don't initialize with README
    echo    4. Run this script again
    echo.
    echo 🔗 Or create it now: https://gitlab.com/projects/new
    pause
    exit /b 1
)

echo.
echo 🎉 SUCCESS! 
echo.
echo ✅ Your code is now on GitLab: %gitlab_url%
echo 🔄 CI/CD pipeline should start automatically
echo 🌐 Connect this to Netlify for auto-deployment
echo.
pause