#!/bin/bash
# =============================================================================
# ResearchToolsPy - Deployment Script
# =============================================================================
# Deploys the frontend + Cloudflare Pages Functions to production.
#
# IMPORTANT: The deployment process requires:
# 1. Build frontend (outputs to dist/)
# 2. Copy functions/ to dist/functions/ (Cloudflare bundles them server-side)
# 3. Deploy dist/ directory (NOT the root .)
#
# DO NOT deploy "." - it will use the root index.html which is the
# development version (points to /src/main.tsx) and results in a blank page.
#
# Usage:
#   ./deploy.sh              # Full deploy (build + functions + deploy)
#   ./deploy.sh --skip-build # Skip build, just copy functions + deploy
#   ./deploy.sh --dry-run    # Build + verify but don't deploy
#   ./deploy.sh --help       # Show help
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_NAME="researchtoolspy"

# =============================================================================
# Parse Arguments
# =============================================================================
SKIP_BUILD=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --help|-h)
            echo "ResearchToolsPy - Deployment Script"
            echo ""
            echo "Usage:"
            echo "  ./deploy.sh              Full deploy (build + functions + deploy)"
            echo "  ./deploy.sh --skip-build Skip build, just copy functions + deploy"
            echo "  ./deploy.sh --dry-run    Build + verify but don't deploy"
            echo "  ./deploy.sh --help       Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "${RED}Unknown option: $arg${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo ""
echo "${BLUE}ResearchToolsPy - Deployment${NC}"
echo "=============================================="
echo ""

# =============================================================================
# Step 0: Verify Directory
# =============================================================================
EXPECTED_DIR="researchtoolspy"
CURRENT_DIR=$(basename $(pwd))

if [ "$CURRENT_DIR" != "$EXPECTED_DIR" ]; then
    echo "${RED}ERROR: Wrong directory!${NC}"
    echo ""
    echo "   You are in:  ${YELLOW}$CURRENT_DIR${NC}"
    echo "   Expected:    ${GREEN}$EXPECTED_DIR${NC}"
    echo ""
    echo "   Run: ${GREEN}cd /Users/sac/Git/researchtoolspy${NC}"
    echo ""
    exit 1
fi

echo "${GREEN}Directory verified: $CURRENT_DIR${NC}"

# Verify key files exist
if [ ! -f "wrangler.toml" ]; then
    echo "${RED}ERROR: wrangler.toml not found!${NC}"
    exit 1
fi

if [ ! -d "functions" ]; then
    echo "${RED}ERROR: functions/ directory not found!${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "${RED}ERROR: package.json not found!${NC}"
    exit 1
fi

echo "${GREEN}Project files verified${NC}"
echo ""

# =============================================================================
# Step 1: Build Frontend
# =============================================================================
if [ "$SKIP_BUILD" = true ]; then
    echo "${YELLOW}Step 1: Skipping build (--skip-build)${NC}"
    if [ ! -d "dist" ]; then
        echo "${RED}ERROR: dist/ not found. Cannot skip build without a previous build.${NC}"
        exit 1
    fi
else
    echo "${YELLOW}Step 1: Building frontend...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo "${RED}Build failed!${NC}"
        exit 1
    fi
    echo "${GREEN}Build complete${NC}"
fi
echo ""

# =============================================================================
# Step 2: Copy Functions to dist/
# =============================================================================
echo "${YELLOW}Step 2: Copying functions to dist/functions/...${NC}"
rsync -av --delete functions/ dist/functions/
if [ $? -ne 0 ]; then
    echo "${RED}Failed to copy functions!${NC}"
    exit 1
fi
FUNC_COUNT=$(find dist/functions -name "*.ts" | wc -l | tr -d ' ')
echo "${GREEN}Functions copied ($FUNC_COUNT TypeScript files)${NC}"
echo ""

# =============================================================================
# Step 3: Verify Build
# =============================================================================
echo "${YELLOW}Step 3: Verifying build...${NC}"

# Check dist/index.html exists
if [ ! -f "dist/index.html" ]; then
    echo "${RED}ERROR: dist/index.html not found!${NC}"
    exit 1
fi

# Check it has bundled assets (NOT development /src/main.tsx)
if grep -q 'src="/src/main.tsx"' dist/index.html; then
    echo "${RED}ERROR: dist/index.html has development script (/src/main.tsx)!${NC}"
    echo "This will cause a BLANK PAGE in production."
    echo "The build may have failed. Check for errors above."
    exit 1
fi

if grep -q 'src="/assets/index-' dist/index.html; then
    echo "${GREEN}Build verified - has bundled assets${NC}"
else
    echo "${RED}ERROR: dist/index.html missing bundled assets!${NC}"
    exit 1
fi

# Check functions are in dist
if [ ! -d "dist/functions/api" ]; then
    echo "${RED}ERROR: dist/functions/api/ not found!${NC}"
    echo "Functions were not copied correctly."
    exit 1
fi

# Check intelligence endpoints exist
INTEL_COUNT=$(ls dist/functions/api/intelligence/*.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$INTEL_COUNT" -lt 7 ]; then
    echo "${YELLOW}Warning: Expected 7 intelligence endpoints, found $INTEL_COUNT${NC}"
else
    echo "${GREEN}Intelligence endpoints verified ($INTEL_COUNT files)${NC}"
fi

# Check _routes.json
if [ -f "dist/_routes.json" ]; then
    echo "${GREEN}_routes.json present${NC}"
else
    # Copy from public if not in dist
    if [ -f "public/_routes.json" ]; then
        cp public/_routes.json dist/_routes.json
        echo "${GREEN}_routes.json copied from public/${NC}"
    else
        echo "${YELLOW}Warning: _routes.json not found${NC}"
    fi
fi

echo ""

# =============================================================================
# Step 4: Deploy
# =============================================================================
if [ "$DRY_RUN" = true ]; then
    echo "${YELLOW}Step 4: Dry run - skipping deployment${NC}"
    echo ""
    echo "${GREEN}=============================================="
    echo "Dry run complete - build verified, ready to deploy"
    echo "==============================================${NC}"
    echo ""
    echo "To deploy for real: ${GREEN}./deploy.sh${NC}"
    exit 0
fi

echo "${YELLOW}Step 4: Deploying to Cloudflare Pages...${NC}"
npx wrangler pages deploy dist --project-name=$PROJECT_NAME --commit-dirty=true
if [ $? -ne 0 ]; then
    echo "${RED}Deployment failed!${NC}"
    echo ""
    echo "If you see an auth error, run: ${GREEN}wrangler login${NC}"
    echo "Then retry: ${GREEN}./deploy.sh --skip-build${NC}"
    exit 1
fi

echo ""

# =============================================================================
# Step 5: Post-Deploy Verification
# =============================================================================
echo "${YELLOW}Step 5: Post-deploy verification...${NC}"

# Wait for deployment to propagate
sleep 3

# Check the production site responds
PROD_URL="https://${PROJECT_NAME}.pages.dev"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "${GREEN}Production site responding (HTTP $HTTP_STATUS)${NC}"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "${YELLOW}Warning: Could not reach $PROD_URL (may still be propagating)${NC}"
else
    echo "${YELLOW}Warning: Production site returned HTTP $HTTP_STATUS${NC}"
fi

# Check that index.html has bundled assets (not dev mode)
PROD_CONTENT=$(curl -s "$PROD_URL" 2>/dev/null)
if echo "$PROD_CONTENT" | grep -q '/assets/index-'; then
    echo "${GREEN}Production serving bundled assets${NC}"
elif echo "$PROD_CONTENT" | grep -q '/src/main.tsx'; then
    echo "${RED}CRITICAL: Production serving development index.html!${NC}"
    echo "Re-run ./deploy.sh to fix."
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "${GREEN}=============================================="
echo "Deployment Complete!"
echo "==============================================${NC}"
echo ""
echo "  Pages:  $PROD_URL"
echo "  Dashboard: $PROD_URL/dashboard/intelligence"
echo ""
echo "  Preview URL shown above in wrangler output."
echo ""
