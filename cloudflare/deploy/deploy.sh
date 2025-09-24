#!/bin/bash

# Deployment script for Cloudflare Workers and Pages
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================="
echo "Deploying to Cloudflare - $ENVIRONMENT"
echo "========================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Installing Wrangler CLI..."
    npm install -g wrangler@latest
fi

# Check authentication
echo "Checking Cloudflare authentication..."
wrangler whoami || {
    echo "Please authenticate with Cloudflare:"
    wrangler login
}

# Deploy Gateway Worker
echo ""
echo "Deploying Gateway Worker..."
cd "$PROJECT_ROOT/cloudflare/workers/gateway"
if [ "$ENVIRONMENT" == "production" ]; then
    wrangler deploy --env production
elif [ "$ENVIRONMENT" == "staging" ]; then
    wrangler deploy --env staging
else
    wrangler deploy --env development
fi

# Deploy Export Service Worker
echo ""
echo "Deploying Export Service Worker..."
cd "$PROJECT_ROOT/cloudflare/workers/export"
wrangler deploy --env "$ENVIRONMENT"

# Deploy Framework Workers
FRAMEWORKS=("swot" "ach")
for framework in "${FRAMEWORKS[@]}"; do
    echo ""
    echo "Deploying $framework Framework Worker..."
    cd "$PROJECT_ROOT/cloudflare/workers/frameworks/$framework"
    if [ -f "wrangler.toml" ]; then
        wrangler deploy --env "$ENVIRONMENT"
    else
        echo "  Skipping - not yet implemented"
    fi
done

# Deploy Frontend to Pages
echo ""
echo "Building and deploying frontend..."
cd "$PROJECT_ROOT/frontend"

# Use Cloudflare-specific config
cp next.config.cloudflare.js next.config.js

# Set environment variables
if [ "$ENVIRONMENT" == "production" ]; then
    export NEXT_PUBLIC_API_URL="https://api.researchtoolspy.com"
    export NEXT_PUBLIC_APP_URL="https://app.researchtoolspy.com"
elif [ "$ENVIRONMENT" == "staging" ]; then
    export NEXT_PUBLIC_API_URL="https://api-staging.researchtoolspy.com"
    export NEXT_PUBLIC_APP_URL="https://app-staging.researchtoolspy.com"
else
    export NEXT_PUBLIC_API_URL="https://api-dev.researchtoolspy.com"
    export NEXT_PUBLIC_APP_URL="https://app-dev.researchtoolspy.com"
fi

# Build the frontend
npm run build

# Deploy to Pages
echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy out --project-name=researchtoolspy --branch="$ENVIRONMENT"

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Environment: $ENVIRONMENT"
echo "API URL: $NEXT_PUBLIC_API_URL"
echo "App URL: $NEXT_PUBLIC_APP_URL"
echo ""
echo "Next steps:"
echo "1. Verify deployments in Cloudflare Dashboard"
echo "2. Test the API endpoints"
echo "3. Check frontend functionality"
echo "4. Monitor logs and metrics"