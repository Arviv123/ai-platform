@echo off
echo.
echo ========================================
echo   🌐 Connect GitLab to Netlify
echo ========================================
echo.

echo 📋 Current status:
echo    ✅ Netlify project exists: super-genie-7460e3
echo    🔄 Need to connect GitLab repository
echo.

echo 🌐 Opening necessary pages...
start https://gitlab.com/projects/new
start https://app.netlify.com/sites/super-genie-7460e3/settings/deploys

echo.
echo 📝 Step 1: Create GitLab Repository
echo    1. ✅ Project name: ai-platform
echo    2. ✅ Visibility: Public 
echo    3. ❌ Don't initialize with README
echo    4. ✅ Click "Create project"
echo.

echo ⏳ After creating GitLab project, press any key...
pause

echo.
echo 📤 Step 2: Push code to GitLab...
git push -u origin main

if errorlevel 1 (
    echo ❌ Push failed - trying with authentication...
    git config --global credential.helper manager-core
    git push -u origin main
)

echo.
echo 🔗 Step 3: Connect to Netlify
echo.
echo    In the Netlify page that opened:
echo    1. ✅ Click "Change site's repository"
echo    2. ✅ Choose "GitLab"  
echo    3. ✅ Select your repository: חיים/ai-platform
echo    4. ✅ Build settings:
echo       - Build command: cd frontend-next && npm run build
echo       - Publish directory: frontend-next/out
echo       - Node version: 20
echo    5. ✅ Click "Save"
echo.

echo ⏳ After connecting, press any key...
pause

echo.
echo 🎉 Setup Complete!
echo.
echo 📊 What's configured:
echo    ✅ GitLab Repository: https://gitlab.com/חיים/ai-platform
echo    ✅ Netlify Site: https://super-genie-7460e3.netlify.app
echo    🔄 Auto-deployment: GitLab → Netlify
echo    🚀 CI/CD Pipeline: Ready
echo.
echo 🔗 Your live site: https://super-genie-7460e3.netlify.app
echo.
echo 💡 Future deployments:
echo    Use: bypass-deploy.bat
echo    - Pushes to GitLab
echo    - GitLab builds (Linux - no Windows issues!)
echo    - Netlify deploys automatically
echo.
pause