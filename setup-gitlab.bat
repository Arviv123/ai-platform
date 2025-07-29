@echo off
echo.
echo ========================================
echo   🔧 Setup GitLab Repository
echo ========================================
echo.

echo 📋 Current git remote configuration:
git remote -v
echo.

echo 🔄 Step 1: Remove existing GitHub remote...
git remote remove origin

echo 📝 Step 2: Please create a GitLab repository first:
echo.
echo    1. Go to: https://gitlab.com
echo    2. Click "New Project" 
echo    3. Name it: ai-platform
echo    4. Make it Public or Private (your choice)
echo    5. Don't initialize with README (we have one)
echo    6. Copy the repository URL (should look like: https://gitlab.com/USERNAME/ai-platform.git)
echo.

set /p gitlab_url="Paste your GitLab repository URL here: "

if "%gitlab_url%"=="" (
    echo ❌ No URL provided
    echo 💡 Please create the GitLab repository first and run this script again
    pause
    exit /b 1
)

echo 🔗 Step 3: Adding GitLab remote...
git remote add origin "%gitlab_url%"

echo ✅ Remote configured! Checking...
git remote -v

echo 🚀 Step 4: Push to GitLab...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo ❌ Push failed
    echo 💡 Possible issues:
    echo    - Repository doesn't exist on GitLab
    echo    - Wrong URL format
    echo    - Authentication required
    echo.
    echo 🔧 To fix authentication:
    echo    1. Go to GitLab → Settings → Access Tokens
    echo    2. Create a Personal Access Token with 'write_repository' scope
    echo    3. Use: git push https://USERNAME:TOKEN@gitlab.com/USERNAME/ai-platform.git main
    pause
    exit /b 1
)

echo.
echo 🎉 SUCCESS! GitLab repository configured!
echo.
echo 📋 What's configured:
echo    ✅ Git remote points to GitLab
echo    ✅ Code pushed to GitLab main branch
echo    🔄 Ready for CI/CD pipeline
echo.
echo 🔗 Next steps:
echo    1. Check your GitLab repository: %gitlab_url%
echo    2. Set up Netlify connection to this GitLab repo
echo    3. Use bypass-deploy.bat for future deployments
echo.
pause