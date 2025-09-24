#!/bin/bash

# Rollback script for Cloudflare deployments
# Usage: ./rollback.sh [environment] [service]

set -e

ENVIRONMENT=${1:-development}
SERVICE=${2:-all}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================="
echo "Rolling back Cloudflare deployment"
echo "Environment: $ENVIRONMENT"
echo "Service: $SERVICE"
echo "========================================="

rollback_worker() {
    local worker_name=$1
    local worker_path=$2

    echo ""
    echo "Rolling back $worker_name..."
    cd "$PROJECT_ROOT/$worker_path"

    # Get deployment history
    echo "Fetching deployment history..."
    wrangler deployments list --env "$ENVIRONMENT"

    # Prompt for deployment ID to rollback to
    read -p "Enter deployment ID to rollback to: " deployment_id

    if [ -n "$deployment_id" ]; then
        wrangler rollback "$deployment_id" --env "$ENVIRONMENT"
        echo "✅ Rolled back $worker_name to deployment $deployment_id"
    else
        echo "❌ Skipping rollback for $worker_name"
    fi
}

rollback_pages() {
    echo ""
    echo "Rolling back Cloudflare Pages..."

    # Get deployment history
    echo "Fetching Pages deployment history..."
    npx wrangler pages deployment list --project-name=researchtoolspy

    # Prompt for deployment ID to rollback to
    read -p "Enter deployment ID to rollback to: " deployment_id

    if [ -n "$deployment_id" ]; then
        npx wrangler pages rollback "$deployment_id" --project-name=researchtoolspy
        echo "✅ Rolled back Pages to deployment $deployment_id"
    else
        echo "❌ Skipping Pages rollback"
    fi
}

# Check authentication
echo "Checking Cloudflare authentication..."
wrangler whoami || {
    echo "Please authenticate with Cloudflare:"
    wrangler login
}

# Perform rollback based on service selection
case "$SERVICE" in
    gateway)
        rollback_worker "Gateway Worker" "cloudflare/workers/gateway"
        ;;
    export)
        rollback_worker "Export Worker" "cloudflare/workers/export"
        ;;
    swot)
        rollback_worker "SWOT Worker" "cloudflare/workers/frameworks/swot"
        ;;
    ach)
        rollback_worker "ACH Worker" "cloudflare/workers/frameworks/ach"
        ;;
    pages|frontend)
        rollback_pages
        ;;
    all)
        echo "Rolling back all services..."
        rollback_worker "Gateway Worker" "cloudflare/workers/gateway"
        rollback_worker "Export Worker" "cloudflare/workers/export"
        rollback_worker "SWOT Worker" "cloudflare/workers/frameworks/swot"
        rollback_worker "ACH Worker" "cloudflare/workers/frameworks/ach"
        rollback_pages
        ;;
    *)
        echo "Unknown service: $SERVICE"
        echo "Available services: gateway, export, swot, ach, pages, all"
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "Rollback Complete!"
echo "========================================="
echo ""
echo "Please verify:"
echo "1. Check service health endpoints"
echo "2. Monitor error logs"
echo "3. Test critical functionality"
echo "4. Update incident reports if applicable"