# 🚀 AI Platform - מדריך פריסה מלא

מדריך מפורט להפעלת פלטפורמת ה-AI הכוללת מערכת SaaS מלאה עם אימות, חיוב, ו-MCP.

## 📋 דרישות מערכת

- **Node.js** 18+ 
- **npm** או **yarn**
- **Git**
- **Google AI API Key** (Gemini)
- **Stripe Account** (אופציונלי לתשלומים)

## 🛠️ התקנה מהירה

### 1. שכפול הפרויקט
```bash
git clone <repository-url>
cd ai-platform
```

### 2. התקנת Dependencies
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend-next && npm install
```

### 3. הגדרת סביבת הפיתוח

#### Backend (.env)
```bash
cd backend
cp .env.example .env
```

ערכו את הקובץ `.env`:
```env
# Required - Google AI API Key
GOOGLE_AI_API_KEY="your-google-ai-api-key"

# Database (SQLite - default)
DATABASE_URL="file:./dev.db"

# JWT Secret
JWT_SECRET="your-super-secure-secret-here"

# Server ports
PORT=3001
WEBSOCKET_PORT=3004
CORS_ORIGIN="http://localhost:3000"

# Optional - Stripe for payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

#### Frontend (.env.local)
```bash
cd ../frontend-next
cp .env.example .env.local
```

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3004"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### 4. אתחול בסיס הנתונים
```bash
cd backend
npx prisma db push
npx prisma generate
```

### 5. הפעלת השרתים

#### Terminal 1 - Backend
```bash
cd backend
npm run dev
```

#### Terminal 2 - Frontend
```bash
cd frontend-next
npm run dev
```

השרתים יהיו זמינים ב:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **WebSocket**: ws://localhost:3004

## 🎯 תכונות מרכזיות

### ✅ מערכת אימות מלאה
- רישום והתחברות עם אימייל/סיסמה
- אימות דו-שלבי (2FA)
- OAuth עם Google/Facebook (מוכן לאינטגרציה)
- ניהול הרשאות (User/Admin)

### ✅ צ'אט AI עם זיכרון
- שיחות מתמשכות עם הקשר
- תמיכה במודלים מרובים (Gemini)
- היסטוריית שיחות
- WebSocket לתגובות בזמן אמת

### ✅ פלטפורמת SaaS
- דף תמחור עם תוכניות מרובות
- ניהול מנויים וחשבונית
- מעקב אחר שימוש (Tokens)
- מערכת חיוב (מוכן ל-Stripe)

### ✅ ניהול MCP שרתים
- הוספה, עריכה ומחיקה של שרתי MCP
- מעקב בריאות שרתים
- סטטיסטיקות שימוש
- ממשק ניהול ידידותי

### ✅ ממשק מנהל מתקדם
- דשבורד ניהול מלא
- ניהול משתמשים
- סטטיסטיקות מערכת
- מעקב הכנסות

### ✅ UX/UI מעולה
- עיצוב רספונסיבי מודרני
- ממשק דו-לשוני (עברית/אנגלית)
- אנימציות חלקות
- הודעות משוב לטובת המשתמש

## 🔧 הגדרות מתקדמות

### Google AI API
1. גשו ל-[Google AI Studio](https://makersuite.google.com/app/apikey)
2. צרו API Key חדש
3. הוסיפו אותו ל-`.env`

### Stripe Integration
1. גשו ל-[Stripe Dashboard](https://dashboard.stripe.com)
2. קבלו את המפתחות (Secret + Publishable)
3. הוסיפו ל-`.env` ו-`.env.local`

### OAuth Setup
1. **Google**: [Google Cloud Console](https://console.cloud.google.com)
2. **Facebook**: [Facebook Developers](https://developers.facebook.com)

## 📱 דפים זמינים

- `/` - דף בית
- `/auth/login` - התחברות
- `/auth/register` - הרשמה
- `/dashboard` - דשבורד משתמש
- `/admin` - ממשק מנהל
- `/chat` - צ'אט AI
- `/mcp` - ניהול MCP שרתים
- `/pricing` - דף תמחור
- `/billing` - ניהול חשבונית
- `/profile` - פרופיל משתמש

## 🛡️ אבטחה

- JWT Authentication
- Password Hashing (bcrypt)
- CORS Protection
- Rate Limiting
- SQL Injection Protection (Prisma ORM)
- XSS Protection

## 🗄️ מבנה בסיס הנתונים

```prisma
// Core Models
User, Organization, ChatSession, ChatMessage

// SaaS Models
Subscription, SubscriptionPlan, Invoice, PaymentMethod

// MCP Models
MCPServer, MCPTool, MCPCall

// System Models
UsageRecord, Coupon, Notification
```

## 🚀 פריסה לייצור

### Docker (מומלץ)
```bash
# Build & Run
docker-compose up -d
```

### Manual Deployment
1. הגדירו משתני סביבה לייצור
2. הפעילו `npm run build`
3. הגדירו reverse proxy (nginx)
4. הפעילו SSL certificates

## 📞 תמיכה

אם נתקלתם בבעיות:
1. בדקו את ה-logs בקונסול
2. ודאו שכל משתני הסביבה מוגדרים
3. בדקו שהפורטים זמינים
4. פנו לתמיכה

## 🎉 מזל טוב!

הפלטפורמה מוכנה לשימוש! עכשיו תוכלו:
- לנהל לקוחות ומנויים
- לספק שירותי AI מתקדמים
- לגבות תשלומים
- להרחיב עם MCP שרתים

בהצלחה! 🚀