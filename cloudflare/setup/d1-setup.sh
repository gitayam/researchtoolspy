#!/bin/bash

# Cloudflare D1 Database Setup Script
# This script sets up the D1 databases for ResearchToolsPy

set -e

echo "🚀 Setting up Cloudflare D1 databases for ResearchToolsPy..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI is not installed. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  You need to login to Cloudflare first${NC}"
    wrangler login
fi

# Function to create a database
create_database() {
    local db_name=$1
    local env=$2

    echo -e "${YELLOW}Creating D1 database: ${db_name}...${NC}"

    # Check if database already exists
    if wrangler d1 list | grep -q "$db_name"; then
        echo -e "${GREEN}✓ Database ${db_name} already exists${NC}"
    else
        wrangler d1 create "$db_name"
        echo -e "${GREEN}✓ Database ${db_name} created successfully${NC}"
    fi

    # Get database ID
    DB_ID=$(wrangler d1 list | grep "$db_name" | awk '{print $2}')
    echo "Database ID: $DB_ID"

    # Apply schema
    echo -e "${YELLOW}Applying schema to ${db_name}...${NC}"
    wrangler d1 execute "$db_name" --file="../database/schema.sql"
    echo -e "${GREEN}✓ Schema applied successfully${NC}"

    # Save database ID to config file
    echo "${env}_DB_ID=${DB_ID}" >> .env.d1
}

# Create .env.d1 file for database IDs
echo "# D1 Database IDs for ResearchToolsPy" > .env.d1
echo "# Generated on $(date)" >> .env.d1

# Create production database
echo -e "\n${YELLOW}=== Setting up PRODUCTION database ===${NC}"
create_database "researchtoolspy-prod" "PRODUCTION"

# Create staging database
echo -e "\n${YELLOW}=== Setting up STAGING database ===${NC}"
create_database "researchtoolspy-staging" "STAGING"

# Create development database
echo -e "\n${YELLOW}=== Setting up DEVELOPMENT database ===${NC}"
create_database "researchtoolspy-dev" "DEVELOPMENT"

# Create KV namespaces
echo -e "\n${YELLOW}=== Creating KV Namespaces ===${NC}"

create_kv_namespace() {
    local kv_name=$1
    local env=$2

    echo -e "${YELLOW}Creating KV namespace: ${kv_name}...${NC}"

    # Check if namespace exists
    if wrangler kv:namespace list | grep -q "$kv_name"; then
        echo -e "${GREEN}✓ KV namespace ${kv_name} already exists${NC}"
        KV_ID=$(wrangler kv:namespace list | grep "$kv_name" | awk -F'"id":' '{print $2}' | awk -F'"' '{print $2}' | head -1)
    else
        # Create namespace
        OUTPUT=$(wrangler kv:namespace create "$kv_name")
        KV_ID=$(echo "$OUTPUT" | grep -oE '[a-f0-9]{32}' | head -1)
        echo -e "${GREEN}✓ KV namespace ${kv_name} created successfully${NC}"
    fi

    echo "KV Namespace ID: $KV_ID"
    echo "${env}_${kv_name}_ID=${KV_ID}" >> .env.d1
}

# Create KV namespaces
create_kv_namespace "sessions" "PRODUCTION"
create_kv_namespace "rate_limits" "PRODUCTION"
create_kv_namespace "cache" "PRODUCTION"
create_kv_namespace "anonymous_sessions" "PRODUCTION"

# Create preview namespaces
create_kv_namespace "sessions_preview" "STAGING"
create_kv_namespace "rate_limits_preview" "STAGING"
create_kv_namespace "cache_preview" "STAGING"
create_kv_namespace "anonymous_sessions_preview" "STAGING"

# Create R2 buckets
echo -e "\n${YELLOW}=== Creating R2 Buckets ===${NC}"

create_r2_bucket() {
    local bucket_name=$1

    echo -e "${YELLOW}Creating R2 bucket: ${bucket_name}...${NC}"

    # Check if bucket exists
    if wrangler r2 bucket list | grep -q "$bucket_name"; then
        echo -e "${GREEN}✓ R2 bucket ${bucket_name} already exists${NC}"
    else
        wrangler r2 bucket create "$bucket_name"
        echo -e "${GREEN}✓ R2 bucket ${bucket_name} created successfully${NC}"
    fi
}

# Create R2 buckets
create_r2_bucket "researchtoolspy-documents"
create_r2_bucket "researchtoolspy-exports"
create_r2_bucket "researchtoolspy-assets"

# Create Queues
echo -e "\n${YELLOW}=== Creating Queues ===${NC}"

create_queue() {
    local queue_name=$1

    echo -e "${YELLOW}Creating Queue: ${queue_name}...${NC}"

    # Note: As of now, Queues need to be created via dashboard or API
    echo -e "${YELLOW}⚠️  Please create queue '${queue_name}' via Cloudflare dashboard${NC}"
    echo "https://dash.cloudflare.com/"
}

# List queues to be created
create_queue "document-processing"
create_queue "report-generation"
create_queue "email-notifications"
create_queue "data-export"

# Generate wrangler.toml files
echo -e "\n${YELLOW}=== Generating wrangler.toml files ===${NC}"

# Read the database IDs
source .env.d1

# Create main gateway worker wrangler.toml
cat > ../workers/gateway/wrangler.toml << EOF
name = "researchtoolspy-gateway"
main = "src/index.ts"
compatibility_date = "2024-01-24"
node_compat = true

[env.production]
workers_dev = false
routes = [
    { pattern = "api.researchtoolspy.com/*", zone_name = "researchtoolspy.com" }
]

[[env.production.d1_databases]]
binding = "DB"
database_name = "researchtoolspy-prod"
database_id = "${PRODUCTION_DB_ID}"

[[env.production.kv_namespaces]]
binding = "SESSIONS"
id = "${PRODUCTION_sessions_ID}"

[[env.production.kv_namespaces]]
binding = "RATE_LIMITS"
id = "${PRODUCTION_rate_limits_ID}"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "${PRODUCTION_cache_ID}"

[[env.production.r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "researchtoolspy-documents"

[[env.production.r2_buckets]]
binding = "EXPORTS"
bucket_name = "researchtoolspy-exports"

[[env.production.queues.producers]]
binding = "DOCUMENT_QUEUE"
queue = "document-processing"

[env.staging]
name = "researchtoolspy-gateway-staging"
workers_dev = true

[[env.staging.d1_databases]]
binding = "DB"
database_name = "researchtoolspy-staging"
database_id = "${STAGING_DB_ID}"

[[env.staging.kv_namespaces]]
binding = "SESSIONS"
id = "${STAGING_sessions_preview_ID}"

[[env.staging.kv_namespaces]]
binding = "RATE_LIMITS"
id = "${STAGING_rate_limits_preview_ID}"

[[env.staging.kv_namespaces]]
binding = "CACHE"
id = "${STAGING_cache_preview_ID}"

[env.development]
name = "researchtoolspy-gateway-dev"
workers_dev = true

[[env.development.d1_databases]]
binding = "DB"
database_name = "researchtoolspy-dev"
database_id = "${DEVELOPMENT_DB_ID}"
EOF

echo -e "${GREEN}✓ Gateway worker wrangler.toml created${NC}"

# Create auth worker wrangler.toml
cat > ../workers/auth/wrangler.toml << EOF
name = "researchtoolspy-auth"
main = "src/index.ts"
compatibility_date = "2024-01-24"
node_compat = true

[env.production]
workers_dev = false

[[env.production.d1_databases]]
binding = "DB"
database_name = "researchtoolspy-prod"
database_id = "${PRODUCTION_DB_ID}"

[[env.production.kv_namespaces]]
binding = "SESSIONS"
id = "${PRODUCTION_sessions_ID}"

[[env.production.kv_namespaces]]
binding = "ANONYMOUS_SESSIONS"
id = "${PRODUCTION_anonymous_sessions_ID}"

[env.production.vars]
JWT_SECRET = "\${JWT_SECRET}"
EOF

echo -e "${GREEN}✓ Auth worker wrangler.toml created${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ D1 Database Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Created resources:"
echo "  • 3 D1 databases (prod, staging, dev)"
echo "  • 8 KV namespaces"
echo "  • 3 R2 buckets"
echo "  • Configuration files"
echo ""
echo "Next steps:"
echo "1. Create the queues in Cloudflare dashboard"
echo "2. Set environment variables:"
echo "   wrangler secret put JWT_SECRET"
echo "   wrangler secret put OPENAI_API_KEY"
echo "3. Deploy workers:"
echo "   cd ../workers/gateway && wrangler deploy"
echo ""
echo "Database IDs saved in: .env.d1"
echo -e "${GREEN}========================================${NC}"