#!/bin/bash

# Script to set environment variables for Cloudflare Pages
# This uses the Cloudflare API to set environment variables

ACCOUNT_ID="04eac09ae835290383903273f68c79b0"
PROJECT_NAME="researchtoolspy"

echo "Setting environment variables for Cloudflare Pages project: $PROJECT_NAME"
echo ""

# Get Cloudflare API token (you'll need to set this)
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN environment variable not set"
    echo ""
    echo "To set up:"
    echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Create a token with 'Cloudflare Pages:Edit' permission"
    echo "3. export CLOUDFLARE_API_TOKEN='your-token-here'"
    echo ""
    echo "OR use the Cloudflare dashboard:"
    echo "https://dash.cloudflare.com/$ACCOUNT_ID/pages/view/$PROJECT_NAME/settings/environment-variables"
    exit 1
fi

# Set environment variables via API
echo "Setting ENABLE_AI_FEATURES=true for production..."
curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "deployment_configs": {
      "production": {
        "env_vars": {
          "ENABLE_AI_FEATURES": {
            "value": "true"
          },
          "DEFAULT_AI_MODEL": {
            "value": "gpt-4o-mini"
          }
        }
      }
    }
  }'

echo ""
echo "Environment variables set!"
echo ""
echo "Note: You may need to redeploy for changes to take effect"
echo "Run: cd frontend-react && wrangler pages deploy dist --project-name=researchtoolspy"
