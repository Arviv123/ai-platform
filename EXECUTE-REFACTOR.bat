@echo off
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo 🏗️ נדל"ן AI Platform - רפקטורינג
echo ========================================
echo.

echo ⚠️  אזהרה: פעולה זו תשנה את מבנה הפרויקט!
echo.
set /p confirm="האם אתה בטוח שברצונך להמשיך? (y/n): "
if /i not "%confirm%"=="y" (
    echo פעולה בוטלה.
    pause
    exit /b
)

echo.
echo 🔄 יוצר גיבוי...
robocopy . ..\ai-platform-backup /E /XD node_modules .git .next out dist /XF *.log
if errorlevel 1 (
    echo ✅ גיבוי נוצר ב ..\ai-platform-backup
) else (
    echo ❌ שגיאה ביצירת גיבוי
    pause
    exit /b 1
)

echo.
echo 🧹 מנקה קבצים מיותרים...

REM מחיקת כפילויות
if exist "src" rmdir /s /q "src"
if exist "public" rmdir /s /q "public"
if exist "tsconfig.json" del "tsconfig.json"
if exist "postcss.config.mjs" del "postcss.config.mjs"

REM מחיקת קבצי .md מיותרים
for %%f in (BUILD_ISSUE_README.md CHAT_SYSTEM_DEEP_DIVE.md CREDENTIALS.md DEMO_*.md DEPLOYMENT_*.md GITHUB_TO_NETLIFY.md GITLAB-SETUP.md NETLIFY_CONNECTION_GUIDE.md PROJECT_OVERVIEW.md START_HERE_README.md TECHNICAL_ARCHITECTURE_ADVANCED.md) do (
    if exist "%%f" del "%%f"
)

REM מחיקת קבצי .bat מיותרים
for %%f in (bypass-deploy.bat connect-to-netlify.bat create-and-push.bat deploy-to-gitlab.bat final-deploy.bat fix-and-deploy.bat manual-build-deploy.bat quick-*.bat setup-gitlab.bat) do (
    if exist "%%f" del "%%f"
)

REM מחיקת קבצי backup
del netlify.toml.* 2>nul
del *.zip 2>nul
del *.tar.gz 2>nul

echo ✅ ניקוי הושלם

echo.
echo 📁 יוצר מבנה תיקיות חדש...
mkdir apps\web 2>nul
mkdir apps\api 2>nul
mkdir packages\ui 2>nul
mkdir packages\shared 2>nul
mkdir packages\mcp 2>nul
mkdir tools\scripts 2>nul
mkdir tools\configs 2>nul
mkdir deployment 2>nul
mkdir docs 2>nul

echo.
echo 📦 מעביר קבצים...

REM העברת frontend
echo מעביר frontend...
robocopy frontend-next apps\web /E /XD node_modules .next out dist .netlify /XF *.log
if exist "frontend-next" rmdir /s /q "frontend-next"

REM העברת backend
echo מעביר backend...
robocopy backend apps\api /E /XD node_modules dist /XF *.log
if exist "backend" rmdir /s /q "backend"

REM העברת MCP
echo מעביר MCP...
robocopy mcp-manager packages\mcp /E /XD node_modules /XF *.log
if exist "mcp-manager" rmdir /s /q "mcp-manager"

echo.
echo 🔧 מעדכן קובצי קונפיגורציה...

REM החלפת קבצים
if exist "new-package.json" (
    move "package.json" "package.json.old"
    move "new-package.json" "package.json"
)

if exist "new-next.config.js" (
    move "apps\web\next.config.js" "apps\web\next.config.js.old" 2>nul
    move "new-next.config.js" "apps\web\next.config.js"
)

if exist "new-netlify.toml" (
    move "new-netlify.toml" "deployment\netlify.toml"
)

if exist "render.yaml" (
    move "render.yaml" "deployment\render.yaml"
)

if exist "NEW-README.md" (
    move "README.md" "README.old.md"
    move "NEW-README.md" "README.md"
)

echo.
echo 📝 מעדכן workspace paths...
cd apps\web
if exist "package.json" (
    powershell -Command "(Get-Content package.json) -replace '\"name\": \"frontend-next\"', '\"name\": \"web\"' | Set-Content package.json"
)
cd ..\..

cd apps\api
if exist "package.json" (
    powershell -Command "(Get-Content package.json) -replace '\"name\": \"ai-platform-backend\"', '\"name\": \"api\"' | Set-Content package.json"
)
cd ..\..

echo.
echo 🔄 מתקין dependencies...
npm install
if errorlevel 1 (
    echo ❌ שגיאה בהתקנת dependencies
    echo ℹ️  נסה להריץ 'npm install' ידנית
)

echo.
echo ✅ רפקטורינג הושלם בהצלחה!
echo.
echo 📋 צעדים הבאים:
echo 1. npm run build     # בדיקת build
echo 2. npm run dev       # הפעלה לבדיקה
echo 3. npm run test      # הרצת טסטים
echo.
echo 🗂️  גיבוי זמין ב: ..\ai-platform-backup
echo.
pause