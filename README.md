# 🤖 AI Platform - פלטפורמת בינה מלאכותית מתקדמת

פלטפורמה מלאה לניהול ושימוש במודלי בינה מלאכותית עם תמיכה ב-MCP, מערכת חיובים ומנויים.

## ✨ תכונות עיקריות

### 🔮 AI Models Support
- Claude 3 (Sonnet & Haiku)
- GPT-4 & GPT-3.5 Turbo  
- Gemini Pro

### 💰 מערכת מונטיזציה
- מנויים חודשיים (חינם, בסיסי, פרימיום, ארגוני)
- רכישת קרדיטים עם מחירים מדורגים
- אינטגרציה עם Stripe לתשלומים

### 🔌 MCP Integration
- חיבור שרתי MCP חיצוניים
- ניהול מחזור חיים של שרתים
- מעקב בריאות ולוגים

### 👥 ניהול משתמשים
- דשבורד ניהול מלא
- פאנל משתמשים עם CRUD מלא
- מעקב פעילות ואנליטיקס

## 🚀 התקנה והפעלה

### דרישות מערכת
- Node.js 20+
- npm או yarn
- Git

### התקנה מהירה

1. **קלון הפרויקט:**
   ```bash
   git clone https://github.com/[username]/ai-platform.git
   cd ai-platform
   ```

2. **התקנת תלויות Backend:**
   ```bash
   cd backend
   npm install
   ```

3. **התקנת תלויות Frontend:**
   ```bash
   cd ../frontend-next
   npm install
   ```

4. **הגדרת מסד נתונים:**
   ```bash
   cd ../backend
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. **הפעלת השרתים:**
   ```bash
   # מהתיקייה הראשית
   ./start-servers.bat
   # או באופן ידני:
   # Backend: cd backend && npm run dev
   # Frontend: cd frontend-next && npm run dev
   ```

### כתובות השרתים
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3004
- **API Documentation**: http://localhost:3004/api
- **Health Check**: http://localhost:3004/health

## 👥 משתמשי בדיקה

### מנהל מערכת:
- **אימייל**: `admin@platform.com`
- **סיסמה**: `admin123`

### משתמשי דמו:
- **אימייל**: `user1@example.com` | **סיסמה**: `demo123`
- **אימייל**: `test@platform.com` | **סיסמה**: `demo123`

## 🔧 API Endpoints

- GET /health - בדיקת תקינות
- GET /api - תיעוד API
- POST /api/auth/register - הרשמה
- POST /api/chat - צ'אט עם AI
- GET /api/user - ניהול משתמשים

## 💳 מנויים ותמחור

| תוכנית | מחיר | קרדיטים | תכונות |
|---------|------|----------|---------|
| חינם | ₪0 | 100 | צ'אט בסיסי |
| בסיסי | ₪29 | 1,000 | כל המודלים |
| פרימיום | ₪99 | 5,000 | MCP + תמיכה |
| ארגוני | ₪299 | 20,000 | API + תמיכה 24/7 |

---

**הפלטפורמה מוכנה לשימוש\! 🎉**

## 🛠️ מבנה הפרויקט

```
ai-platform/
├── backend/                 # שרת Node.js + Express
│   ├── src/
│   │   ├── controllers/     # בקרים
│   │   ├── routes/         # נתיבי API
│   │   ├── services/       # שירותים
│   │   ├── middleware/     # middleware
│   │   └── utils/          # כלי עזר
│   ├── prisma/             # סכימת מסד נתונים
│   └── package.json
├── frontend-next/          # ממשק משתמש Next.js
│   ├── src/
│   │   ├── app/           # דפי האפליקציה
│   │   ├── components/    # רכיבי React
│   │   ├── contexts/      # Context providers
│   │   └── hooks/         # Custom hooks
│   └── package.json
├── mcp-servers/           # שרתי MCP
├── docker-compose.yml     # הגדרות Docker
└── start-servers.bat      # הפעלת השרתים

```

## 🔥 תכונות מתקדמות

### ⚡ מערכת ניהול שגיאות מתקדמת
- **Error Boundary** - תפיסת שגיאות React
- **Global Error Context** - ניהול שגיאות גלובלי
- **API Error Handling** - טיפול חכם בשגיאות API
- **User-Friendly Messages** - הודעות ברורות בעברית
- **Retry Logic** - ניסיון חוזר אוטומטי

### 🔐 אבטחה ואימות
- **JWT Authentication** - אימות מבוסס טוקנים
- **Password Hashing** - הצפנת סיסמאות עם bcrypt
- **Rate Limiting** - הגבלת קצב בקשות
- **CORS Protection** - הגנת CORS
- **Input Validation** - וולידציה של קלטים

### 📊 ניטור וביצועים
- **Health Checks** - בדיקות תקינות
- **Logging System** - מערכת לוגים מתקדמת
- **Error Tracking** - מעקב שגיאות
- **Performance Monitoring** - ניטור ביצועים

🔗 **קישורים מהירים:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3004
- **API Documentation**: http://localhost:3004/api
- **Health Check**: http://localhost:3004/health

---

**המערכת מוכנה לשימוש ופריסה!** 🚀
