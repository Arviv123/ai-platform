# 🚨 Build Issue - Windows + Next.js

## The Problem
Windows is locking the `frontend-next/out` directory, preventing Next.js from rebuilding.

**Error:** `EBUSY: resource busy or locked, rmdir 'frontend-next\out'`

## Temporary Solution
Use the bypass deployment script:
```bash
bypass-deploy.bat
```

This will:
1. Skip the problematic local build
2. Push current code to GitLab  
3. Let GitLab's Linux environment handle the build
4. Deploy automatically to Netlify if build succeeds

## Why This Happens
- Windows file locking is more aggressive than Linux/Mac
- File Explorer or antivirus might be scanning the `out` folder
- Next.js tries to remove the folder but Windows won't let it

## Long-term Solutions

### Option 1: Manual Folder Deletion
1. Open Task Manager → End all `node.exe` processes
2. Navigate to `frontend-next/` folder
3. Manually delete the `out` folder
4. Run build again

### Option 2: Build in WSL (Windows Subsystem for Linux)
```bash
# Install WSL if not already installed
wsl --install

# Run build in WSL environment
wsl
cd /mnt/c/Users/חיים/Desktop/ai-platform/frontend-next
npm run build
```

### Option 3: Use Different Build Directory
Edit `next.config.ts`:
```javascript
const nextConfig = {
  distDir: '.build', // Instead of default .next
  // ... other config
};
```

### Option 4: Exclude from Antivirus
Add these folders to your antivirus exclusion list:
- `frontend-next/.next`
- `frontend-next/out`
- `node_modules`

## Current Workaround Status
✅ **bypass-deploy.bat** - Pushes to GitLab for remote build  
⚠️ **Local builds** - Failing due to Windows file lock  
🔄 **GitLab CI/CD** - Should work (Linux environment)  
🌐 **Netlify Deploy** - Will work if GitLab build succeeds  

## Next Steps
1. Use `bypass-deploy.bat` for now
2. Monitor GitLab CI/CD pipeline
3. If GitLab build also fails, implement Option 2 or 3 above

---
**Note:** This is a common Windows development issue, not a code problem.