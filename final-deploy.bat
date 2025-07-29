@echo off
echo.
echo ========================================
echo   🎯 Final Deploy - AI Platform
echo ========================================
echo.

echo 🛑 Closing any processes that might lock files...
taskkill /f /im "node.exe" 2>nul
taskkill /f /im "npm.exe" 2>nul
timeout /t 2 /nobreak >nul

echo 🧹 Force cleaning build directories...
rmdir /s /q "frontend-next\.next" 2>nul
rmdir /s /q "frontend-next\out" 2>nul

echo 📦 Removing main lockfile (keeping frontend-next)...
if exist "package-lock.json" del "package-lock.json"

echo 🔄 Installing frontend dependencies...
cd frontend-next
call npm install --no-package-lock --prefer-offline

echo 📦 Building frontend (final attempt)...
call npm run build

if errorlevel 1 (
    echo ❌ Build failed again
    echo 💡 Let's try manual build...
    call npx next build
    if errorlevel 1 (
        echo ❌ Manual build also failed
        echo 🔧 Please check for antivirus or file lock issues
        cd ..
        pause
        exit /b 1
    )
)

echo ✅ Build successful!
cd ..

echo 📝 Adding all files to git...
git add .

echo 💾 Committing changes...
git commit -m "🚀 Deploy with fixed build configuration - %date% %time%"

if errorlevel 1 (
    echo ℹ️ No new changes to commit, pushing existing changes...
)

echo 🌐 Pushing to GitLab...
git push origin main

if errorlevel 1 (
    echo 🔄 Setting upstream and pushing...
    git push -u origin main
    if errorlevel 1 (
        echo ❌ Push failed. Check your GitLab connection
        git remote -v
        pause
        exit /b 1
    )
)

echo.
echo 🎉 SUCCESS! Deployment completed!
echo.
echo 📊 Deployment Summary:
echo    ✅ Frontend built successfully
echo    ✅ Changes committed to git  
echo    ✅ Pushed to GitLab
echo    🌐 Netlify will auto-deploy from GitLab
echo.
echo 🔗 Next steps:
echo    - Check GitLab repository for latest changes
echo    - Monitor Netlify dashboard for deployment
echo    - Your site should be live in 2-3 minutes
echo.
pause