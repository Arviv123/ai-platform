@echo off
echo 🧹 מתחיל ניקוי פרויקט נדל"ן AI Platform...

REM מחיקת תיקיות כפולות
echo מוחק תיקיות כפולות...
rmdir /s /q src 2>nul
rmdir /s /q public 2>nul

REM מחיקת קבצי .md מיותרים (מלבד README.md העיקרי)
echo מוחק קבצי תיעוד מיותרים...
del BUILD_ISSUE_README.md 2>nul
del CHAT_SYSTEM_DEEP_DIVE.md 2>nul
del CREDENTIALS.md 2>nul
del DEMO_*.md 2>nul
del DEPLOYMENT_*.md 2>nul
del GITHUB_TO_NETLIFY.md 2>nul
del GITLAB-SETUP.md 2>nul
del NETLIFY_CONNECTION_GUIDE.md 2>nul
del PROJECT_OVERVIEW.md 2>nul
del START_HERE_README.md 2>nul
del TECHNICAL_ARCHITECTURE_ADVANCED.md 2>nul

REM מחיקת קבצי .bat מיותרים (שמירה על 3 עיקריים)
echo מוחק scripts מיותרים...
del bypass-deploy.bat 2>nul
del connect-to-netlify.bat 2>nul
del create-and-push.bat 2>nul
del deploy-to-gitlab.bat 2>nul
del final-deploy.bat 2>nul
del fix-and-deploy.bat 2>nul
del manual-build-deploy.bat 2>nul
del quick-*.bat 2>nul
del setup-gitlab.bat 2>nul

REM מחיקת קבצי backup
echo מוחק קבצי backup...
del netlify.toml.* 2>nul
del *.zip 2>nul
del *.tar.gz 2>nul

echo ✅ ניקוי הושלם!
pause