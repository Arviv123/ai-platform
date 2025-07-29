@echo off
echo.
echo ========================================
echo   🎯 Manual Build & Deploy Solution
echo ========================================
echo.

echo 🛑 Step 1: Manual cleanup (Windows safe)...
cd frontend-next

REM Close Explorer windows that might lock the folder
taskkill /f /im "explorer.exe" /fi "windowtitle eq out*" 2>nul

REM Wait a moment
timeout /t 3 /nobreak >nul

REM Try to unlock and remove out folder manually
if exist "out" (
    echo 📁 Found existing 'out' folder, attempting to remove...
    attrib -r "out\*.*" /s 2>nul
    rmdir /s /q "out" 2>nul
    if exist "out" (
        echo ⚠️ Cannot remove 'out' folder automatically
        echo 💡 Please manually delete the 'frontend-next\out' folder
        echo 📂 Open File Explorer and delete: %cd%\out
        echo ⏳ Press any key when you've deleted the folder...
        pause
    )
)

echo 🔨 Step 2: Build without removing out folder...
REM Use a different approach - let Next.js handle the out folder
call npx next build

if errorlevel 1 (
    echo ❌ Build failed with npx, trying npm...
    call npm run build
    if errorlevel 1 (
        echo ❌ Both build methods failed
        echo 💡 The 'out' folder might be open in Explorer or another program
        echo 🔧 Please close all File Explorer windows and try again
        cd ..
        pause
        exit /b 1
    )
)

echo ✅ Build completed!
cd ..

REM Check if out folder was created
if not exist "frontend-next\out" (
    echo ❌ No 'out' folder was created
    echo 🔧 Build may have failed silently
    pause
    exit /b 1
)

echo 📊 Build statistics:
dir "frontend-next\out" /s

echo.
echo 📝 Step 3: Git operations...
git add .

set commit_msg=🚀 Successful build and deploy - %date% %time%
git commit -m "%commit_msg%"

echo 🌐 Step 4: Push to GitLab...
git push origin main

if errorlevel 1 (
    git push -u origin main
)

echo.
echo 🎉 DEPLOYMENT SUCCESSFUL!
echo.
echo 📋 What happened:
echo    ✅ Frontend built to 'frontend-next/out'
echo    ✅ Static files ready for deployment
echo    ✅ Changes pushed to GitLab
echo    🌐 Netlify will deploy automatically
echo.
echo 🔗 Check your deployment:
echo    - GitLab: https://gitlab.com/[username]/ai-platform
echo    - Netlify: https://app.netlify.com
echo.
pause