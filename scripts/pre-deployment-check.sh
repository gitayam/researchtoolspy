#!/bin/bash

# Pre-Deployment Check Script
# Runs all validation checks before production deployment
# Usage: ./scripts/pre-deployment-check.sh [--skip-build]

set -e  # Exit on any error

RESEARCHTOOLSPY_CLOUDFLARE_ACCOUNT_ID="04eac09ae835290383903273f68c79b0"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$RESEARCHTOOLSPY_CLOUDFLARE_ACCOUNT_ID}"

SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --help|-h)
      echo "Usage: $0 [--skip-build]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

echo "🚀 Starting Pre-Deployment Checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
# Five attempts add at most ten seconds of linear backoff while still failing
# closed during a sustained Cloudflare API outage.
REMOTE_READ_ATTEMPTS=5

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
    ERRORS=$((ERRORS + 1))
  fi
}

# Cloudflare's remote D1 reads can occasionally return a transient error or an
# empty response. Retry read-only release checks without allowing a genuinely
# missing migration, table, or column to pass.
run_remote_read() {
  local attempt=1
  local output=""

  while [ "$attempt" -le "$REMOTE_READ_ATTEMPTS" ]; do
    if output=$("$@" 2>&1); then
      printf '%s\n' "$output"
      return 0
    fi

    if [ "$attempt" -lt "$REMOTE_READ_ATTEMPTS" ]; then
      echo "Remote read failed (attempt ${attempt}/${REMOTE_READ_ATTEMPTS}); retrying..." >&2
      sleep "$attempt"
    fi
    attempt=$((attempt + 1))
  done

  printf '%s\n' "$output"
  return 1
}

read_d1_query() {
  local sql=$1
  local expected=$2
  local attempt=1
  local output=""

  while [ "$attempt" -le "$REMOTE_READ_ATTEMPTS" ]; do
    if output=$(pnpm exec wrangler d1 execute researchtoolspy-prod --remote --command="$sql" 2>&1) && \
      printf '%s\n' "$output" | grep -Fq -- "$expected"; then
      printf '%s\n' "$output"
      return 0
    fi

    if [ "$attempt" -lt "$REMOTE_READ_ATTEMPTS" ]; then
      echo "Remote schema read for '${expected}' was inconclusive (attempt ${attempt}/${REMOTE_READ_ATTEMPTS}); retrying..." >&2
      sleep "$attempt"
    fi
    attempt=$((attempt + 1))
  done

  printf '%s\n' "$output"
  return 1
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

# Check pnpm and the workspace Wrangler binary
if command_exists pnpm; then
  PNPM_VERSION=$(pnpm --version)
  print_status 0 "pnpm installed ($PNPM_VERSION)"

  if WRANGLER_VERSION=$(pnpm exec wrangler --version 2>&1 | head -n1); then
    print_status 0 "Workspace Wrangler available ($WRANGLER_VERSION)"
  else
    print_status 1 "Workspace Wrangler unavailable"
  fi
else
  print_status 1 "pnpm not found"
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

if [ "$SKIP_BUILD" = true ]; then
  print_status 0 "Production build skipped (already completed by deploy.sh)"
elif npm run build >/dev/null 2>&1; then
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
echo "4️⃣  Checking Managed Migrations and Database Schema (Production)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Listing pending managed migrations (read-only)..."
if MIGRATION_LIST=$(run_remote_read ./scripts/list-managed-migrations.sh --remote); then
  print_status 0 "Managed migration list available"
  echo "$MIGRATION_LIST"
else
  print_status 1 "Unable to list managed migrations"
  echo "$MIGRATION_LIST"
fi

echo ""
echo "Checking critical tables..."

SCHEMA_SNAPSHOT_SQL="WITH expected(table_name, column_name) AS (
  VALUES
    ('__snapshot__', NULL),
    ('evidence_items', NULL),
    ('content_intelligence', NULL),
    ('evidence_items', 'workspace_id'),
    ('evidence_items', 'eve_assessment'),
    ('framework_sessions', 'view_count'),
    ('framework_sessions', 'clone_count'),
    ('evidence_actors', 'auto_linked'),
    ('evidence_citations', 'citation_format'),
    ('evidence_citations', 'citation_type'),
    ('evidence_citations', 'relevance_score'),
    ('evidence_citations', 'notes'),
    ('evidence_citations', 'created_by'),
    ('ach_analyses', 'is_public')
)
SELECT CASE
  WHEN table_name = '__snapshot__' THEN 'schema_snapshot_complete'
  WHEN column_name IS NULL THEN 'table:' || table_name
  ELSE 'column:' || table_name || '.' || column_name
END AS schema_item
FROM expected
WHERE table_name = '__snapshot__'
  OR (column_name IS NULL AND EXISTS (
    SELECT 1 FROM sqlite_master
    WHERE type = 'table' AND name = expected.table_name
  ))
  OR (column_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM pragma_table_info(expected.table_name)
    WHERE name = expected.column_name
  ));"

SCHEMA_SNAPSHOT=""
SCHEMA_SNAPSHOT_AVAILABLE=false
if SCHEMA_SNAPSHOT=$(read_d1_query "$SCHEMA_SNAPSHOT_SQL" "schema_snapshot_complete"); then
  SCHEMA_SNAPSHOT_AVAILABLE=true
  print_status 0 "Production schema snapshot available"
else
  print_status 1 "Unable to read production schema snapshot"
  echo "Last remote schema response:" >&2
  printf '%s\n' "$SCHEMA_SNAPSHOT" >&2
fi

schema_snapshot_contains() {
  printf '%s\n' "$SCHEMA_SNAPSHOT" | grep -Fq -- "$1"
}

check_column() {
  local table_name=$1
  local column_name=$2

  if schema_snapshot_contains "column:${table_name}.${column_name}"; then
    print_status 0 "Field '${table_name}.${column_name}' exists"
  else
    print_status 1 "Field '${table_name}.${column_name}' missing"
  fi
}

if [ "$SCHEMA_SNAPSHOT_AVAILABLE" = true ]; then
  # Check canonical evidence table
  if schema_snapshot_contains "table:evidence_items"; then
    print_status 0 "Table 'evidence_items' exists"
  else
    print_status 1 "Table 'evidence_items' missing"
  fi

  # Existing canonical scoping plus every column required by managed migrations.
  check_column "evidence_items" "workspace_id"
  check_column "evidence_items" "eve_assessment"
  check_column "framework_sessions" "view_count"
  check_column "framework_sessions" "clone_count"
  check_column "evidence_actors" "auto_linked"
  check_column "evidence_citations" "citation_format"
  check_column "evidence_citations" "citation_type"
  check_column "evidence_citations" "relevance_score"
  check_column "evidence_citations" "notes"
  check_column "evidence_citations" "created_by"
  check_column "ach_analyses" "is_public"

  if schema_snapshot_contains "table:content_intelligence"; then
    print_status 0 "Table 'content_intelligence' exists"
  else
    print_status 1 "Table 'content_intelligence' missing"
  fi
else
  echo -e "${YELLOW}   Schema object checks skipped because the remote snapshot was unavailable.${NC}"
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

  if [ "$(grep -c 'migrations_dir = \"schema/managed-migrations\"' wrangler.toml)" -eq 2 ]; then
    print_status 0 "Managed migration directory configured for default and production bindings"
  else
    print_status 1 "Managed migration directory must be configured on both D1 bindings"
  fi

  if [ "$(grep -c 'binding = \"SCRAPE_ANALYTICS\"' wrangler.toml)" -eq 2 ]; then
    print_status 0 "Scraping Analytics Engine binding configured for default and production"
  else
    print_status 1 "SCRAPE_ANALYTICS binding must be configured for default and production"
  fi

  if secret_list=$(pnpm exec wrangler pages secret list --project-name=researchtoolspy 2>&1) \
    && printf '%s\n' "$secret_list" | grep -q 'SCRAPE_TELEMETRY_KEY'; then
    print_status 0 "Privacy-safe scraping telemetry key configured"
  else
    print_status 1 "SCRAPE_TELEMETRY_KEY missing from production Pages secrets"
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
  echo "  pnpm exec wrangler pages deploy dist --project-name=researchtoolspy"
  exit 0
else
  echo -e "${RED}❌ $ERRORS check(s) failed. Fix these issues before deploying.${NC}"
  echo ""
  echo "Common fixes:"
  echo "  - Run missing migrations: pnpm run migrate:prod"
  echo "  - Fix TypeScript errors: npm run type-check"
  echo "  - Fix build errors: npm run build"
  exit 1
fi
