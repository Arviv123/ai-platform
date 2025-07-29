# 🌐 Connect GitLab to Existing Netlify Project

## Current Status
- ✅ **Netlify Project**: `super-genie-7460e3` 
- ✅ **Netlify URL**: https://app.netlify.com/projects/super-genie-7460e3/overview
- 🔄 **GitLab Repository**: Need to create and connect

## Quick Setup Steps

### 1. Create GitLab Repository
```bash
# Run this script to automate the process
connect-to-netlify.bat
```

**Or manually:**
1. Go to: https://gitlab.com/projects/new
2. Project name: `ai-platform`
3. Visibility: Public (recommended)
4. **Don't** initialize with README
5. Click "Create project"

### 2. Push Code to GitLab
```bash
git push -u origin main
```

### 3. Connect GitLab to Netlify

**Go to:** https://app.netlify.com/sites/super-genie-7460e3/settings/deploys

**Steps:**
1. Click **"Change site's repository"**
2. Choose **"GitLab"**
3. Authorize GitLab access
4. Select repository: **`חיים/ai-platform`**
5. Configure build settings:
   - **Build command**: `cd frontend-next && npm run build`
   - **Publish directory**: `frontend-next/out`
   - **Node version**: `20` (in Environment variables)
6. Click **"Save"**

## Build Settings

### Environment Variables (in Netlify)
```
NODE_VERSION=20
NEXT_TELEMETRY_DISABLED=1
```

### Build Configuration
- **Base directory**: `frontend-next`
- **Build command**: `npm run build`
- **Publish directory**: `frontend-next/out`

## Expected Workflow

```
Local Changes → GitLab Push → GitLab CI/CD → Netlify Deploy → Live Site
     ↓              ↓              ↓              ↓           ↓
  Your Code      Git Repo      Linux Build    Auto Deploy  Production
```

## Live URLs
- **Production Site**: https://super-genie-7460e3.netlify.app
- **GitLab Repository**: https://gitlab.com/חיים/ai-platform
- **Netlify Dashboard**: https://app.netlify.com/sites/super-genie-7460e3

## Future Deployments
Once connected, use:
```bash
bypass-deploy.bat
```

This will:
1. Push changes to GitLab
2. GitLab builds on Linux (no Windows file lock issues)
3. Netlify automatically deploys the built site

## Troubleshooting

### If GitLab build fails:
- Check `.gitlab-ci.yml` configuration
- Monitor GitLab CI/CD pipeline
- Check build logs in GitLab

### If Netlify deploy fails:
- Check Netlify deploy logs
- Verify build settings match above
- Ensure `frontend-next/out` directory is created

---

**Ready to connect!** 🚀