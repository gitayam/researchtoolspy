#!/bin/bash

echo "Finding and cleaning mock data from framework pages..."

# List of framework pages to check
FRAMEWORK_PAGES=(
  "frontend/src/app/(dashboard)/frameworks/swot/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/cog/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/dime/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/pmesii-pt/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/pest/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/stakeholder/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/surveillance/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/trend/page.tsx"
  "frontend/src/app/(dashboard)/frameworks/vrio/page.tsx"
)

# Check each page for mock data
for page in "${FRAMEWORK_PAGES[@]}"; do
  if [ -f "$page" ]; then
    echo "Checking $page..."
    grep -n "mock.*=.*\[" "$page" 2>/dev/null && echo "  Found mock data in $page"
  fi
done

# Also check collaboration page
echo "Checking collaboration page..."
grep -n "mock.*=.*\[" "frontend/src/app/(dashboard)/collaboration/page.tsx" 2>/dev/null && echo "  Found mock data"

# Check evidence page
echo "Checking evidence page..."
grep -n "mockEvidence\|mockStats" "frontend/src/app/(dashboard)/evidence/page.tsx" 2>/dev/null && echo "  Found mock data"

# Check tools pages
echo "Checking tools pages..."
TOOLS_PAGES=(
  "frontend/src/app/(dashboard)/tools/url/page.tsx"
  "frontend/src/app/(dashboard)/tools/citations/page.tsx"
  "frontend/src/app/(dashboard)/tools/documents/page.tsx"
  "frontend/src/app/(dashboard)/tools/social-media/page.tsx"
  "frontend/src/app/(dashboard)/tools/scraping/page.tsx"
  "frontend/src/app/(dashboard)/tools/content-extraction/page.tsx"
  "frontend/src/app/(dashboard)/tools/batch-processing/page.tsx"
)

for page in "${TOOLS_PAGES[@]}"; do
  if [ -f "$page" ]; then
    grep -n "mock.*=.*\[" "$page" 2>/dev/null && echo "  Found mock data in $page"
  fi
done