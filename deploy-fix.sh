#!/bin/bash

# Quick deployment script for DOTMLPF fix
# This script can be run on the production server to update the code

echo "🚀 Deploying DOTMLPF framework fix..."

# Navigate to the project directory (adjust path as needed)
cd /root/Git/researchtoolspy || cd /var/www/researchtoolspy || cd ~/researchtoolspy || {
  echo "❌ Could not find researchtoolspy directory"
  echo "Please run this script from the correct directory or update the path"
  exit 1
}

echo "📍 Current directory: $(pwd)"

# Backup current state
echo "💾 Creating backup..."
cp -r frontend/src/app/frameworks/dotmlpf/create/page.tsx frontend/src/app/frameworks/dotmlpf/create/page.tsx.backup.$(date +%Y%m%d_%H%M%S)

# Pull latest changes
echo "📥 Pulling latest changes..."
git fetch origin
git checkout analysis/legacy-platform-evaluation
git pull origin analysis/legacy-platform-evaluation

# Check if the fix is in place
if grep -q "updateData(sessionData)" frontend/src/app/frameworks/dotmlpf/create/page.tsx; then
  echo "✅ DOTMLPF fix detected in code"
else
  echo "⚠️  Fix not found, applying manual patch..."
  
  # Apply the fix manually if git pull didn't work
  cat > /tmp/dotmlpf_fix.patch << 'EOF'
--- a/frontend/src/app/frameworks/dotmlpf/create/page.tsx
+++ b/frontend/src/app/frameworks/dotmlpf/create/page.tsx
@@ -75,7 +75,7 @@ export default function DOTMLPFCreatePage() {
       capabilities
     }
-    saveSession(sessionData)
+    updateData(sessionData)
   }, [title, description, mission, context, capabilities, saveSession])
EOF
  
  # Try to apply the patch
  patch -p1 < /tmp/dotmlpf_fix.patch || {
    echo "❌ Patch failed. Manual intervention required."
    echo "Please manually replace 'saveSession(sessionData)' with 'updateData(sessionData)'"
    echo "in frontend/src/app/frameworks/dotmlpf/create/page.tsx around line 130"
    exit 1
  }
fi

# Restart frontend service (adjust command as needed for your setup)
echo "🔄 Restarting frontend service..."

# Try different restart methods
if command -v pm2 &> /dev/null; then
  echo "Using PM2..."
  pm2 restart frontend 2>/dev/null || pm2 restart all
elif command -v systemctl &> /dev/null; then
  echo "Using systemctl..."
  systemctl restart researchtoolspy-frontend 2>/dev/null || systemctl restart nginx
elif command -v docker &> /dev/null; then
  echo "Using Docker..."
  docker-compose restart frontend 2>/dev/null || docker restart $(docker ps -q --filter "name=frontend")
elif pgrep -f "next" > /dev/null; then
  echo "Restarting Next.js process..."
  pkill -f "next" && sleep 2
  cd frontend && npm run build && npm start &
else
  echo "⚠️  Could not determine restart method. Please manually restart the frontend service."
fi

echo "✅ Deployment complete!"
echo "🔗 Please test: https://researchtools.net/frameworks/dotmlpf/create"
echo ""
echo "If the error persists, please check:"
echo "1. The frontend service restarted correctly"
echo "2. The build process completed successfully"
echo "3. No caching issues (try hard refresh: Ctrl+F5)"