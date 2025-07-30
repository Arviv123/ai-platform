# 🏗️ נדל"ן AI Platform

> פלטפורמה מקצועית לתכנון ובנייה בישראל המבוססת על בינה מלאכותית מתקדמת

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-green)](https://www.prisma.io/)

## 🎯 סקירה

נדל"ן AI Platform היא מערכת מקצועית המיועדת לאדריכלים, מתכננים עירוניים, קבלנים ומשקיעי נדלן בישראל. המערכת מספקת כלי AI מתקדמים לתכנון, בדיקת היתרי בנייה, ניתוח תקנים ועוד.

### ✨ תכונות עיקריות

- 🤖 **AI מתקדם**: Claude + Gemini + GPT-4 לייעוץ מקצועי
- 🏗️ **היתרי בנייה**: בדיקות אוטומטיות ומעקב סטטוס
- 📋 **תקנים ותקנות**: מאגר מעודכן של תקנים ישראליים
- 🗺️ **תכנון עירוני**: כלים לתוכניות מתאר ומיקום
- 👥 **ניהול פרויקטים**: מעקב צוותי ושיתוף מידע
- 📊 **דשבורד מנהל**: ניתוח נתונים ודוחות מפורטים

## 🚀 התחלה מהירה

### דרישות מקדימות

```bash
# וידא שמותקנות הגרסאות הנכונות
node --version  # >= 20.0.0
npm --version   # >= 10.0.0
```

### התקנה וההפעלה

```bash
# 1. שיבוט הפרויקט
git clone https://github.com/yourusername/nedlan-ai-platform.git
cd nedlan-ai-platform

# 2. התקנת dependencies
npm install

# 3. הגדרת environment variables
cp .env.example .env.local

# 4. הפעלת מסד הנתונים (development)
npm run db:migrate
npm run db:seed

# 5. הפעלת הפרויקט
npm run dev
```

🌐 **הפרויקט יהיה זמין ב:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database Studio: http://localhost:5555

## 🔑 פרטי התחברות

### 👨‍💼 מנהל המערכת
```
📧 Email: admin@nedlan-ai.co.il
🔐 Password: Admin2024!
🎯 Access: מלא (דשבורד ניהול + כל התכונות)
```

### 👥 משתמשים מקצועיים
```
🏗️ אדריכל: architect@nedlan-ai.co.il / Architect2024!
🏙️ מתכנן עירוני: planner@nedlan-ai.co.il / Planner2024!
🔨 קבלן בנייה: contractor@nedlan-ai.co.il / Builder2024!
💰 משקיע נדלן: investor@nedlan-ai.co.il / Investor2024!
```

## 🏗️ ארכיטקטורה

### Stack טכנולוגי

**Frontend (apps/web):**
- Next.js 14 + App Router
- React 18 + TypeScript
- TailwindCSS 3.4
- RTL Support (עברית)

**Backend (apps/api):**
- Express.js + TypeScript
- Prisma ORM
- PostgreSQL (Production) / SQLite (Development)
- JWT Authentication + RBAC

**AI & MCP (packages/mcp):**
- Claude (Anthropic)
- Gemini (Google)
- GPT-4 (OpenAI)
- MCP Protocol for tool integration

### 📁 מבנה הפרויקט

```
nedlan-ai-platform/
├── apps/
│   ├── web/              # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/      # App Router pages
│   │   │   ├── components/
│   │   │   ├── lib/      # Utils & API
│   │   │   └── types/
│   │   ├── public/       # Static assets
│   │   └── package.json
│   └── api/              # Express Backend
│       ├── src/
│       │   ├── controllers/
│       │   ├── middleware/
│       │   ├── routes/
│       │   └── services/
│       ├── prisma/       # Database schema
│       └── package.json
├── packages/
│   ├── ui/               # Shared UI components
│   ├── shared/           # Shared types & utils
│   └── mcp/              # MCP protocol handlers
├── deployment/
│   ├── netlify.toml      # Frontend deployment
│   ├── render.yaml       # Backend deployment
│   └── docker/           # Container configs
└── tools/
    ├── scripts/          # Build & deployment scripts
    └── configs/          # Shared configurations
```

## 📦 פקודות זמינות

### Development
```bash
npm run dev          # הפעלת סביבת פיתוח
npm run build        # בניית הפרויקט לproduction
npm run start        # הפעלת production build
npm run test         # הרצת בדיקות
npm run lint         # בדיקת איכות קוד
npm run type-check   # בדיקת TypeScript
```

### Database
```bash
npm run db:migrate   # הרצת migrations
npm run db:seed      # הכנסת נתוני לדוגמה
npm run db:studio    # פתיחת Prisma Studio
npm run db:reset     # איפוס מסד הנתונים
```

### Deployment
```bash
npm run deploy:web   # פריסת frontend ל-Netlify
npm run deploy:api   # פריסת backend ל-Render
npm run clean        # ניקוי build artifacts
```

## 🌐 Deployment

### Frontend (Netlify)
- **URL**: https://nedlan-ai.netlify.app
- **Auto-deploy**: כל push ל-main branch
- **Build Command**: `npm run build`
- **Publish Directory**: `apps/web/dist`

### Backend (Render)
- **URL**: https://nedlan-ai-api.onrender.com
- **Database**: PostgreSQL (Render)
- **Auto-deploy**: כל push ל-main branch
- **Health Check**: `/health`

### Environment Variables

**.env.local (Development):**
```env
# Database
DATABASE_URL="file:./dev.db"

# API URLs
NEXT_PUBLIC_API_URL="http://localhost:3001"

# AI API Keys
ANTHROPIC_API_KEY="your_key_here"
GOOGLE_AI_API_KEY="your_key_here"
OPENAI_API_KEY="your_key_here"

# Auth
JWT_SECRET="your_jwt_secret_here"
JWT_EXPIRE="24h"
```

## 🔒 אבטחה

- **Authentication**: JWT tokens + refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encryption at rest and in transit
- **API Security**: Rate limiting + CORS + Helmet
- **Input Validation**: Joi/Zod schemas

## 🧪 Testing

```bash
# הרצת כל הבדיקות
npm run test

# בדיקות עם coverage
npm run test:coverage

# בדיקות E2E
npm run test:e2e

# בדיקות integration
npm run test:integration
```

## 📊 Monitoring

- **Logs**: Winston (structured logging)
- **Metrics**: Prometheus + Grafana
- **Health Checks**: Built-in health endpoints
- **Error Tracking**: Sentry integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
```bash
npm run lint        # ESLint + Prettier
npm run type-check  # TypeScript validation
npm run test        # Run tests before PR
```

## 📝 API Documentation

API documentation זמינה ב:
- **Development**: http://localhost:3001/api/docs
- **Production**: https://nedlan-ai-api.onrender.com/api/docs

### עיקרי Endpoints

```
# Authentication
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me

# Chat & AI
POST /api/chat/message
GET  /api/chat/sessions
GET  /api/chat/models

# MCP Tools
GET  /api/mcp
POST /api/mcp/{id}/execute

# Admin
GET  /api/admin/users
GET  /api/admin/stats
```

## 🔧 Troubleshooting

### בעיות נפוצות

**Build נכשל:**
```bash
npm run clean
npm install
npm run build
```

**Database connection errors:**
```bash
npm run db:reset
npm run db:migrate
npm run db:seed
```

**Frontend לא טוען:**
- וודא ש-`NEXT_PUBLIC_API_URL` מוגדר נכון
- בדוק שה-backend רץ על פורט 3001

### Support

📧 **Email**: support@nedlan-ai.co.il  
💬 **Discord**: [Discord Server Link]  
📖 **Wiki**: [GitHub Wiki Link]

## 📄 License

This project is licensed under UNLICENSED - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by the נדל"ן AI Team**

*Supporting Israel's construction and planning industry with cutting-edge AI technology*