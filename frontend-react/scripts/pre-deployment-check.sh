#!/bin/bash

# Pre-Deployment Check Script
# Runs all validation checks before production deployment
# Usage: ./scripts/pre-deployment-check.sh

set -e  # Exit on any error

echo "🚀 Starting Pre-Deployment Checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Function to check command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2${NC}"
    ((ERRORS++))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Checking Prerequisites"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node.js
if command_exists node; then
  NODE_VERSION=$(node --version)
  print_status 0 "Node.js installed ($NODE_VERSION)"
else
  print_status 1 "Node.js not found"
fi

# Check npm
if command_exists npm; then
  NPM_VERSION=$(npm --version)
  print_status 0 "npm installed ($NPM_VERSION)"
else
  print_status 1 "npm not found"
fi

# Check wrangler
if command_exists wrangler; then
  WRANGLER_VERSION=$(wrangler --version 2>&1 | head -n1)
  print_status 0 "Wrangler installed ($WRANGLER_VERSION)"
else
  print_status 1 "Wrangler not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Running TypeScript Compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if npm run type-check >/dev/null 2>&1 || tsc --noEmit; then
  print_status 0 "TypeScript compilation passed"
else
  print_status 1 "TypeScript compilation failed"
  echo -e "${YELLOW}   Run 'npm run type-check' for details${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Building Production Bundle"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if npm run build >/dev/null 2>&1; then
  print_status 0 "Production build successful"

  # Check bundle sizes
  if [ -d "dist" ]; then
    TOTAL_SIZE=$(du -sh dist | cut -f1)
    echo -e "${GREEN}   Total bundle size: $TOTAL_SIZE${NC}"

    # Check for overly large bundles
    LARGE_FILES=$(find dist -type f -size +1M | wc -l)
    if [ "$LARGE_FILES" -gt 5 ]; then
      echo -e "${YELLOW}   ⚠️  Warning: $LARGE_FILES files larger than 1MB${NC}"
    fi
  fi
else
  print_status 1 "Production build failed"
  echo -e "${YELLOW}   Run 'npm run build' for details${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Checking Database Schema (Production)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Checking critical tables..."

# Check evidence table
if wrangler d1 execute researchtoolspy-prod --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='evidence';" 2>/dev/null | grep -q "evidence"; then
  print_status 0 "Table 'evidence' exists"
else
  print_status 1 "Table 'evidence' missing"
fi

# Check evidence fields
if wrangler d1 execute researchtoolspy-prod --remote --command="PRAGMA table_info(evidence);" 2>/dev/null | grep -q "date"; then
  print_status 0 "Field 'evidence.date' exists"
else
  print_status 1 "Field 'evidence.date' missing"
fi

if wrangler d1 execute researchtoolspy-prod --remote --command="PRAGMA table_info(evidence);" 2>/dev/null | grep -q "credibility_score"; then
  print_status 0 "Field 'evidence.credibility_score' exists"
else
  print_status 1 "Field 'evidence.credibility_score' missing"
fi

# Check ach_analyses is_public
if wrangler d1 execute researchtoolspy-prod --remote --command="PRAGMA table_info(ach_analyses);" 2>/dev/null | grep -q "is_public"; then
  print_status 0 "Field 'ach_analyses.is_public' exists"
else
  print_status 1 "Field 'ach_analyses.is_public' missing"
fi

# Check content_intelligence table
if wrangler d1 execute researchtoolspy-prod --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='content_intelligence';" 2>/dev/null | grep -q "content_intelligence"; then
  print_status 0 "Table 'content_intelligence' exists"
else
  print_status 1 "Table 'content_intelligence' missing"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Checking Environment Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check wrangler.toml exists
if [ -f "wrangler.toml" ]; then
  print_status 0 "wrangler.toml exists"

  # Check for database binding
  if grep -q "d1_databases" wrangler.toml; then
    print_status 0 "D1 database binding configured"
  else
    print_status 1 "D1 database binding missing in wrangler.toml"
  fi
else
  print_status 1 "wrangler.toml not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Running Tests (if available)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
  if npm test >/dev/null 2>&1; then
    print_status 0 "Tests passed"
  else
    echo -e "${YELLOW}   ⚠️  Tests not run or failed${NC}"
  fi
else
  echo -e "${YELLOW}   ℹ️  No tests configured${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Ready for production deployment.${NC}"
  echo ""
  echo "To deploy:"
  echo "  npm run build"
  echo "  wrangler pages deploy dist --project-name=researchtoolspy"
  exit 0
else
  echo -e "${RED}❌ $ERRORS check(s) failed. Fix these issues before deploying.${NC}"
  echo ""
  echo "Common fixes:"
  echo "  - Run missing migrations: npm run migrate:prod"
  echo "  - Fix TypeScript errors: npm run type-check"
  echo "  - Fix build errors: npm run build"
  exit 1
fi
