# פריסת פלטפורמת AI

## קבצים מוכנים לפריסה

האפליקציה נבנתה בהצלחה והקבצים הסטטיים נמצאים בתיקיית `out/`.

## בדיקה מקומית

להרצת שרת מקומי:
```bash
# בתיקיית frontend-next
serve.bat
```
או
```bash
cd out
python -m http.server 8000
```

האפליקציה תהיה זמינה בכתובת: http://localhost:8000

## אפשרויות פריסה לאינטרנט

### 1. Vercel (מומלץ לפרויקטי Next.js)
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 2. Netlify
```bash
npm i -g netlify-cli
netlify login
netlify deploy --dir=out --prod
```

### 3. GitHub Pages
1. העלה את התיקיה `out/` לrepository ב-GitHub
2. הפעל GitHub Pages בהגדרות הrepository

### 4. Surge.sh
```bash
npm i -g surge
cd out
surge
```

### 5. Firebase Hosting
```bash
npm i -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## קובץ ZIP

קובץ `ai-platform-static.zip` מכיל את כל הקבצים הדרושים לפריסה.
ניתן להעלות אותו לכל שירות hosting סטטי.

## הערות

- כל הקבצים מוכנים לפריסה סטטית
- האפליקציה מותאמת לעבודה בלי שרת backend (frontend בלבד)
- נדרש חיבור לשרת API נפרד לפונקציונליות מלאה