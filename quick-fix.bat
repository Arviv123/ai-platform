@echo off
echo 🚀 Quick Fix for Build Issue
echo.

echo Step 1: Close File Explorer windows
taskkill /f /im "explorer.exe" 2>nul
timeout /t 2 /nobreak >nul
start explorer.exe

echo Step 2: Navigate to frontend folder and delete 'out' manually
cd frontend-next
echo.
echo 📂 You are now in: %cd%
echo.
echo 🗑️ Please manually delete the 'out' folder if it exists
echo    (Right-click → Delete, or press Shift+Delete)
echo.
echo ⏳ After deleting, press any key to continue...
pause

echo Step 3: Build again
call npm run build

if not errorlevel 1 (
    echo ✅ Build successful!
    cd ..
    git add .
    git commit -m "🎉 Fixed build - %time%"
    git push origin main
    echo 🌐 Deployed to GitLab!
) else (
    echo ❌ Still failing - the 'out' folder might still be locked
    echo 💡 Try restarting your computer or running as administrator
)

pause