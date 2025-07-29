@echo off
echo.
echo ========================================
echo   🚀 Create GitLab Project & Push
echo ========================================
echo.

echo 📋 Current status:
echo    ✅ Git remote configured to GitLab
echo    ❌ GitLab project doesn't exist yet
echo.

echo 🌐 Opening GitLab in your browser...
start https://gitlab.com/projects/new

echo.
echo 📝 Please create the project on GitLab:
echo.
echo    1. ✅ Project name: ai-platform
echo    2. ✅ Visibility: Public (recommended) or Private
echo    3. ❌ Don't check "Initialize repository with a README"
echo    4. ❌ Don't add .gitignore or license (we have them)
echo    5. ✅ Click "Create project"
echo.

echo ⏳ After creating the project, press any key to continue...
pause

echo 📤 Attempting to push to GitLab...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ Still failed. Let's try with authentication...
    echo.
    echo 🔐 You might need to authenticate:
    echo.
    echo    Option 1 - Use Git Credential Manager:
    git config --global credential.helper manager-core
    echo    ✅ Credential manager configured
    echo.
    echo    Option 2 - Use Personal Access Token:
    echo    1. Go to: https://gitlab.com/-/profile/personal_access_tokens
    echo    2. Create token with 'write_repository' scope
    echo    3. Use username and token when prompted
    echo.
    
    echo 🔄 Trying push again...
    git push -u origin main
    
    if errorlevel 1 (
        echo.
        echo ❌ Authentication failed
        echo.
        echo 💡 Manual steps:
        echo    1. Make sure the GitLab project exists
        echo    2. Check your GitLab username is exactly: חיים
        echo    3. Try: git push -u origin main
        echo       (and enter your GitLab credentials when prompted)
        pause
        exit /b 1
    )
)

echo.
echo 🎉 SUCCESS! Your code is now on GitLab!
echo.
echo 📊 What's available:
echo    ✅ Source code: https://gitlab.com/חיים/ai-platform
echo    🔄 CI/CD Pipeline: Will start automatically
echo    📦 Build: GitLab will build the frontend
echo    🌐 Deploy: Connect to Netlify for auto-deployment
echo.
echo 🔗 Next steps:
echo    1. Check GitLab project: https://gitlab.com/חיים/ai-platform
echo    2. Monitor CI/CD pipeline in GitLab
echo    3. Connect GitLab repo to Netlify
echo    4. Use 'bypass-deploy.bat' for future updates
echo.
pause