# 🚀 AI Platform - Deployment Instructions

## Quick Deployment

### Method 1: Automatic Script (Recommended)
```bash
# Just double-click this file:
deploy-to-gitlab.bat
```

### Method 2: Manual Commands
```bash
# Build frontend
cd frontend-next
npm run build
cd ..

# Add changes
git add .
git commit -m "🚀 Update: $(date)"
git push origin main
```

## Setup Instructions

### 1. GitLab Repository Setup

1. **Create GitLab Repository**:
   - Go to https://gitlab.com
   - Create new project: `ai-platform`
   - Copy the repository URL

2. **Connect Local Repository**:
   ```bash
   git init
   git remote add origin https://gitlab.com/yourusername/ai-platform.git
   git branch -M main
   git add .
   git commit -m "🎉 Initial commit"
   git push -u origin main
   ```

### 2. Netlify Setup

1. **Connect GitLab to Netlify**:
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Choose "GitLab"
   - Select your `ai-platform` repository

2. **Build Settings**:
   - **Build command**: `cd frontend-next && npm run build`
   - **Publish directory**: `frontend-next/out`
   - **Node version**: `20`

3. **Environment Variables** (if needed):
   ```
   NODE_VERSION=20
   NEXT_TELEMETRY_DISABLED=1
   ```

### 3. GitLab CI/CD Setup

1. **Set CI/CD Variables** (Project Settings → CI/CD → Variables):
   ```
   NETLIFY_SITE_ID=your-site-id-from-netlify
   NETLIFY_AUTH_TOKEN=your-netlify-personal-access-token
   ```

2. **Get Netlify Tokens**:
   - Site ID: Netlify Dashboard → Site Settings → General → Site Information
   - Auth Token: Netlify Dashboard → User Settings → Applications → Personal Access Tokens

## Deployment Process

### Automatic Deployment
1. **Push to GitLab**: Changes trigger CI/CD pipeline
2. **Build**: Frontend builds automatically
3. **Deploy**: Netlify deploys the built frontend
4. **Live**: Your site is live on Netlify URL

### Files Created for Deployment:

- **`deploy-to-gitlab.bat`**: One-click deployment script
- **`.gitlab-ci.yml`**: GitLab CI/CD pipeline configuration
- **`netlify.toml`**: Netlify deployment configuration

## Deployment Workflow

```
Local Changes → GitLab Push → CI/CD Build → Netlify Deploy → Live Site
     ↓              ↓              ↓              ↓           ↓
  Your Code      Git Repo      Build Stage    Deploy Stage  Production
```

## Troubleshooting

### Common Issues:

1. **Build Fails**:
   ```bash
   cd frontend-next
   npm install
   npm run build
   ```

2. **Git Push Fails**:
   ```bash
   git remote -v  # Check remote URL
   git push -u origin main  # Set upstream
   ```

3. **Netlify Deploy Fails**:
   - Check build logs in Netlify dashboard
   - Verify build settings match above

### Support Files:

- **Frontend Build**: `frontend-next/package.json` (build script)
- **CI/CD Config**: `.gitlab-ci.yml` (pipeline stages)
- **Netlify Config**: `netlify.toml` (deployment rules)

## Next Steps

1. **Custom Domain**: Connect your domain in Netlify settings
2. **HTTPS**: Automatic with Netlify
3. **Backend**: Deploy backend separately (Heroku, Railway, etc.)
4. **Monitoring**: Set up error tracking (Sentry, LogRocket)

---

## Quick Reference

### Deploy Command:
```bash
./deploy-to-gitlab.bat
```

### Check Status:
```bash
git status
netlify status  # if CLI installed
```

### View Deployments:
- GitLab: https://gitlab.com/yourusername/ai-platform/-/pipelines
- Netlify: https://app.netlify.com

---

**Ready to deploy!** 🎉