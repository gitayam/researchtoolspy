#!/bin/bash
# Test script for Git Repository Extraction
# Tests GitHub, GitLab, and Bitbucket endpoints

DEPLOYMENT_URL="https://918f7672.researchtoolspy.pages.dev"
API_ENDPOINT="/api/content-intelligence/git-repository-extract"

echo "🧪 Testing Git Repository Extraction Feature"
echo "================================================"
echo ""

# Test 1: GitHub - Popular Public Repo
echo "Test 1: GitHub - facebook/react"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/facebook/react"}' \
  | jq -r 'if .success then "✅ SUCCESS: \(.platform) - \(.repository.fullName) (\(.repository.stars) ⭐)" else "❌ FAILED: \(.error)" end'
echo ""

# Test 2: GitHub - Smaller Repo
echo "Test 2: GitHub - anthropics/anthropic-sdk-python"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/anthropics/anthropic-sdk-python"}' \
  | jq -r 'if .success then "✅ SUCCESS: \(.platform) - \(.repository.fullName) (\(.repository.stars) ⭐)" else "❌ FAILED: \(.error)" end'
echo ""

# Test 3: GitLab - GitLab Itself
echo "Test 3: GitLab - gitlab-org/gitlab"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://gitlab.com/gitlab-org/gitlab"}' \
  | jq -r 'if .success then "✅ SUCCESS: \(.platform) - \(.repository.fullName) (\(.repository.stars) ⭐)" else "❌ FAILED: \(.error)" end'
echo ""

# Test 4: Bitbucket - Atlassian Repo
echo "Test 4: Bitbucket - atlassian/python-bitbucket"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://bitbucket.org/atlassian/python-bitbucket"}' \
  | jq -r 'if .success then "✅ SUCCESS: \(.platform) - \(.repository.fullName)" else "❌ FAILED: \(.error)" end'
echo ""

# Test 5: Invalid URL
echo "Test 5: Invalid URL (should fail gracefully)"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/not-a-repo"}' \
  | jq -r 'if .success then "❌ UNEXPECTED SUCCESS" else "✅ CORRECTLY FAILED: \(.error)" end'
echo ""

# Test 6: Missing URL
echo "Test 6: Missing URL parameter (should return 400)"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{}' \
  | jq -r 'if .success then "❌ UNEXPECTED SUCCESS" else "✅ CORRECTLY FAILED: \(.error)" end'
echo ""

# Test 7: GitHub with .git suffix
echo "Test 7: GitHub URL with .git suffix"
curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/vercel/next.js.git"}' \
  | jq -r 'if .success then "✅ SUCCESS: \(.platform) - \(.repository.fullName) (\(.repository.stars) ⭐)" else "❌ FAILED: \(.error)" end'
echo ""

# Test 8: Check README extraction
echo "Test 8: Verify README extraction (GitHub - tailwindlabs/tailwindcss)"
RESPONSE=$(curl -s -X POST "$DEPLOYMENT_URL$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/tailwindlabs/tailwindcss"}')

if echo "$RESPONSE" | jq -e '.readme.content' > /dev/null; then
  README_LENGTH=$(echo "$RESPONSE" | jq -r '.readme.content | length')
  echo "✅ README extracted: $README_LENGTH characters"
else
  echo "❌ README not extracted"
fi
echo ""

# Test 9: Check latest commit extraction
echo "Test 9: Verify latest commit extraction"
if echo "$RESPONSE" | jq -e '.latestCommit.message' > /dev/null; then
  COMMIT_MSG=$(echo "$RESPONSE" | jq -r '.latestCommit.message')
  COMMIT_AUTHOR=$(echo "$RESPONSE" | jq -r '.latestCommit.author')
  echo "✅ Latest commit: \"$COMMIT_MSG\" by $COMMIT_AUTHOR"
else
  echo "❌ Latest commit not extracted"
fi
echo ""

# Test 10: Check languages extraction
echo "Test 10: Verify languages extraction"
if echo "$RESPONSE" | jq -e '.repository.languages' > /dev/null; then
  LANG_COUNT=$(echo "$RESPONSE" | jq '.repository.languages | length')
  TOP_LANG=$(echo "$RESPONSE" | jq -r '.repository.languages | to_entries | max_by(.value) | .key')
  echo "✅ Languages extracted: $LANG_COUNT languages, primary: $TOP_LANG"
else
  echo "❌ Languages not extracted"
fi
echo ""

echo "================================================"
echo "✅ Test Suite Complete!"
echo ""
echo "Summary:"
echo "- Tested GitHub, GitLab, Bitbucket platforms"
echo "- Verified error handling"
echo "- Checked data extraction (README, commits, languages)"
echo ""
echo "Deployment: $DEPLOYMENT_URL"
