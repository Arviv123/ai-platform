@echo off
chcp 65001 > nul
echo ================================================================
echo 🤖 הפעלה מלאה של פלטפורמת AI עם כלי התכנון הישראליים
echo ================================================================
echo.

echo 🔄 מנקה תהליכים קודמים...
taskkill /F /IM node.exe 2>nul >nul
timeout /t 2 /nobreak > nul

echo 📦 מתקין תלויות...
cd /d "%~dp0backend"
call npm install --silent
cd /d "%~dp0frontend-next" 
call npm install --silent
cd /d "%~dp0mcp-servers\iplan-server"
call npm install --silent

echo 🗄️ מכין מסד נתונים...
cd /d "%~dp0backend"
call npx prisma generate --silent
call npx prisma db push --silent
call node prisma/seed.js

echo 🚀 מפעיל Backend על פורט 3001...
start "AI Platform Backend" /MIN cmd /c "cd /d %~dp0backend && npm run dev"
timeout /t 8 /nobreak > nul

echo 🌐 מפעיל Frontend על פורט 3000...
start "AI Platform Frontend" /MIN cmd /c "cd /d %~dp0frontend-next && npm run dev"
timeout /t 8 /nobreak > nul

echo ✅ בודק שהשרתים פועלים...
curl -s http://localhost:3001/health > nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend פעיל על http://localhost:3001
) else (
    echo ❌ Backend לא מגיב
)

curl -s -I http://localhost:3000 > nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend פעיל על http://localhost:3000
) else (
    echo ❌ Frontend לא מגיב
)

echo.
echo ================================================================
echo 🎉 המערכת מוכנה לשימוש!
echo ================================================================
echo.
echo 🌐 כתובות:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo.
echo 👥 פרטי התחברות:
echo   אדמין:     admin@platform.com / admin123
echo   משתמש:     user1@example.com / demo123
echo.
echo 💬 דוגמאות לשיחות:
echo   "חפש לי תכניות בתל אביב"
echo   "מה ההגבלות בנייה ברח' דיזנגוף?"
echo   "תן לי פרטים על תכנית 101-0123456"
echo.

start http://localhost:3000

echo המערכת פועלת! לעצירה - סגור חלונות השרתים.
pause