# העלאה לGitLab והפעלה באינטרנט

## 🚀 שלב 1: הכנת הפרויקט ל-Git

### יצירת .gitignore
```bash
# בתיקיית הפרויקט הראשית
echo "node_modules/
.env
.env.local
*.log
.DS_Store
.vscode/
backend/dev.db
backend/prisma/dev.db
backend/uploads/
.next/
dist/
build/
coverage/
*.tgz
*.tar.gz
.cache/
.vercel
.netlify
package-lock.json" > .gitignore
```

### אתחול Git Repository
```bash
cd "C:\Users\חיים\Desktop\ai-platform"
git init
git add .
git commit -m "Initial commit: AI Platform with Israeli Planning Tools"
```

## 🔧 שלב 2: יצירת פרויקט ב-GitLab

### אופציה A: GitLab.com (ציבורי/פרטי)
1. היכנס ל-https://gitlab.com
2. לחץ על "New Project" > "Create blank project"
3. שם הפרויקט: `ai-platform-israeli-planning`
4. תיאור: `Advanced AI Platform with Israeli Planning Administration Integration`
5. בחר Private או Public
6. לחץ "Create project"

### אופציה B: GitLab Self-Managed
אם יש לך שרת GitLab פרטי, השתמש בכתובת שלו.

## 🔗 שלב 3: חיבור הפרויקט המקומי ל-GitLab

```bash
# החלף בכתובת הפרויקט שלך ב-GitLab
git remote add origin https://gitlab.com/username/ai-platform-israeli-planning.git
git branch -M main
git push -u origin main
```

## 🌐 שלב 4: הגדרת CI/CD Pipeline

### יצירת .gitlab-ci.yml
```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "20"

before_script:
  - apt-get update -qq && apt-get install -y -qq git curl
  - curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  - apt-get install -y nodejs

# Build Backend
build_backend:
  stage: build
  script:
    - cd backend
    - npm ci
    - npx prisma generate
  artifacts:
    paths:
      - backend/node_modules/
      - backend/prisma/
    expire_in: 1 hour

# Build Frontend
build_frontend:
  stage: build
  script:
    - cd frontend-next
    - npm ci
    - npm run build
  artifacts:
    paths:
      - frontend-next/.next/
      - frontend-next/node_modules/
    expire_in: 1 hour

# Test Israeli Planning Tools
test_planning_tools:
  stage: test
  dependencies:
    - build_backend
  script:
    - cd backend
    - npm ci
    - cd ..
    - node test-planning-tools.js
  allow_failure: false

# Deploy to production (example)
deploy_production:
  stage: deploy
  script:
    - echo "Deploying to production server..."
    # כאן תוסיף את הפקודות לפריסה
  only:
    - main
  when: manual
```

## 🏗️ שלב 5: הגדרת Environment Variables ב-GitLab

1. לך לפרויקט ב-GitLab
2. Settings > CI/CD > Variables
3. הוסף את המשתנים הבאים:

```
JWT_SECRET = your-jwt-secret-key
CLAUDE_API_KEY = your-claude-api-key (אופציונלי)
OPENAI_API_KEY = your-openai-api-key (אופציונלי)
GOOGLE_AI_API_KEY = your-gemini-api-key (אופציונלי)
DATABASE_URL = file:./dev.db
NODE_ENV = production
PORT = 3001
CORS_ORIGIN = https://your-domain.com
```

## 🚀 שלב 6: פריסה לפרודקציה

### אופציה A: Heroku
```bash
# התקן Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# יצירת אפליקציה
heroku create ai-platform-israeli-planning

# הגדרת environment variables
heroku config:set JWT_SECRET=your-jwt-secret
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=your-postgres-url

# פריסה
git push heroku main
```

### אופציה B: DigitalOcean App Platform
1. צור חשבון ב-DigitalOcean
2. לך ל-App Platform
3. חבר את GitLab Repository
4. הגדר environment variables
5. לחץ Deploy

### אופציה C: Vercel (עבור Frontend)
```bash
npm i -g vercel
cd frontend-next
vercel --prod
```

### אופציה D: שרת VPS עצמאי
```bash
# התחבר לשרת
ssh user@your-server.com

# התקן Node.js ו-PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pm2

# שכפל הפרויקט
git clone https://gitlab.com/username/ai-platform-israeli-planning.git
cd ai-platform-israeli-planning

# התקן dependencies
cd backend && npm ci
cd ../frontend-next && npm ci && npm run build

# יצירת .env בשרת
echo "JWT_SECRET=your-secret
DATABASE_URL=file:./dev.db
NODE_ENV=production
PORT=3001" > backend/.env

# הכן database
cd backend
npx prisma db push
npx prisma generate

# הפעל עם PM2
pm2 start src/index.js --name "ai-platform-backend"
pm2 startup
pm2 save

# הגדר Nginx (אופציונלי)
sudo apt install nginx
# הגדר reverse proxy לפורט 3001
```

## 🔒 שלב 7: הגדרת HTTPS (לפרודקציה)

### עם Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📊 שלב 8: מעקב ו-Monitoring

### GitLab CI/CD Pipelines
1. לך ל-CI/CD > Pipelines
2. עקב אחרי ה-builds וה-deployments
3. בדוק logs אם יש שגיאות

### הגדרת Alerts
```yaml
# הוסף ל-.gitlab-ci.yml
notify_success:
  stage: deploy
  script:
    - echo "Deployment successful!"
    # שלח הודעת email או Slack
  only:
    - main
```

## 🔄 שלב 9: עדכונים שוטפים

### Workflow לעדכון
```bash
# עבודה על feature
git checkout -b feature/new-feature
# בצע שינויים
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# צור Merge Request ב-GitLab
# לאחר אישור:
git checkout main
git pull origin main
```

## 🚨 שלב 10: גיבוי ו-Recovery

### גיבוי Database
```bash
# גיבוי שבועי אוטומטי
crontab -e
# הוסף:
0 2 * * 0 cp /path/to/your/dev.db /path/to/backup/backup-$(date +\%Y\%m\%d).db
```

## 📝 רשימת בדיקה לפני הפרסום

- [ ] כל הקבצים נוספו ל-Git
- [ ] .gitignore מוגדר נכון
- [ ] Environment variables מוגדרים
- [ ] CI/CD Pipeline עובד
- [ ] בדיקות עוברות בהצלחה
- [ ] כלי התכנון הישראלי עובדים
- [ ] Domain מוגדר ו-HTTPS פעיל
- [ ] גיבויים אוטומטיים מוגדרים
- [ ] Documentation מעודכן

## 🎯 לסיכום

לאחר ביצוע כל השלבים, תהיה לך פלטפורמת AI מלאה עם כלי מינהל התכנון הישראלי הפועלת באינטרנט!

**נגישות:**
- Frontend: https://your-domain.com
- API: https://your-domain.com/api
- Documentation: https://your-domain.com/api/docs

---
💡 **טיפ**: התחל עם GitLab.com בחינם ולאחר מכן העבר לשרת פרטי אם נדרש.