@echo off
echo.
echo ========================================
echo   🎯 Bypass Build Issue - Direct Deploy
echo ========================================
echo.

echo 💡 Since the build keeps failing on the 'out' folder issue,
echo    we'll deploy the current working code without rebuilding.
echo.

echo 📝 Step 1: Add all current changes to git...
git add .

echo 💾 Step 2: Commit the current state...
set commit_msg=🚀 Deploy current working version - bypass build issue - %date% %time%
git commit -m "%commit_msg%"

if errorlevel 1 (
    echo ℹ️ No new changes to commit
    echo 📤 Pushing existing changes...
) else (
    echo ✅ Changes committed successfully
)

echo 🌐 Step 3: Push to GitLab...
git push origin main

if errorlevel 1 (
    echo 🔄 Setting upstream branch...
    git push -u origin main
    if errorlevel 1 (
        echo ❌ Push failed. Checking git configuration...
        git remote -v
        echo.
        echo 🔧 Please ensure:
        echo    1. Git remote is configured correctly
        echo    2. You have push permissions to the repository
        echo    3. You're logged into GitLab
        pause
        exit /b 1
    )
)

echo.
echo 🎉 SUCCESS! Changes pushed to GitLab!
echo.
echo 📋 What happens next:
echo    ✅ Your code is now on GitLab
echo    🔄 GitLab CI/CD will try to build it (might work better on Linux)
echo    🌐 If GitLab build succeeds, Netlify will deploy automatically
echo    ⚠️ If GitLab build fails, we'll need to fix the build issue
echo.
echo 🔗 Monitor your deployment:
echo    - GitLab CI/CD: https://gitlab.com/[username]/ai-platform/-/pipelines
echo    - Netlify: https://app.netlify.com
echo.
echo 💡 Build Issue Note:
echo    The Windows build fails due to a locked 'out' directory.
echo    This is a common Windows + Next.js issue.
echo    GitLab's Linux environment might build successfully.
echo.
pause