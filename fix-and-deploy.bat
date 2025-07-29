@echo off
echo.
echo ========================================
echo   🔧 Fix Build Issues & Deploy
echo ========================================
echo.

echo 🧹 Cleaning build directories...
rmdir /s /q "frontend-next\.next" 2>nul
rmdir /s /q "frontend-next\out" 2>nul
rmdir /s /q "backend\dist" 2>nul

echo 📦 Removing duplicate lockfiles...
del "package-lock.json" 2>nul
echo ✅ Main lockfile removed, keeping frontend-next/package-lock.json

echo 🔄 Reinstalling frontend dependencies...
cd frontend-next
call npm install --force
if errorlevel 1 (
    echo ❌ npm install failed
    cd ..
    pause
    exit /b 1
)

echo 📦 Building frontend with proper permissions...
call npm run build
if errorlevel 1 (
    echo ❌ Build still failing, trying alternative approach...
    echo 🔧 Running as administrator might help
    echo 💡 Try running this script as administrator
    cd ..
    pause
    exit /b 1
)

cd ..

echo ✅ Build successful!
echo.

echo 📝 Adding all changes to git...
git add .

echo 💾 Creating commit...
set commit_msg=🚀 Fix build issues and deploy - %date% %time%
git commit -m "%commit_msg%"

echo 🌐 Pushing to GitLab...
git push origin main

if errorlevel 1 (
    echo ❌ Push failed. Trying to set upstream...
    git push -u origin main
)

echo.
echo ✅ Deployment completed!
echo 🌐 Check your Netlify dashboard for deployment status
echo.
pause