#!/bin/bash

# Framework configurations - using arrays instead of associative arrays for compatibility
frameworks=(
    "dotmlpf|DOTMLPF|Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities"
    "pest|PEST|Political, Economic, Social, Technological"
    "vrio|VRIO|Value, Rarity, Imitability, Organization"
    "trend|TREND|Trend Analysis Framework"
    "dime|DIME|Diplomatic, Information, Military, Economic"
    "cog|COG|Center of Gravity Analysis"
    "stakeholder|STAKEHOLDER|Stakeholder Analysis Framework"
    "starbursting|STARBURSTING|Starbursting Question Framework"
    "fundamental-flow|FUNDAMENTAL_FLOW|Fundamental Flow Analysis"
    "behavior|BEHAVIOR|Behavioral Analysis Framework"
    "causeway|CAUSEWAY|Causeway Analysis Framework"
    "surveillance|SURVEILLANCE|Surveillance Framework"
    "deception|DECEPTION|Deception Detection Framework"
)

BASE_DIR="/Users/sac/Git/researchtoolspy/cloudflare/workers/frameworks"

for config in "${frameworks[@]}"; do
    IFS='|' read -r framework NAME DESCRIPTION <<< "$config"

    # Create directory structure
    mkdir -p "$BASE_DIR/$framework/src"

    echo "Creating $framework framework worker..."

    # Create package.json
    cat > "$BASE_DIR/$framework/package.json" << EOF
{
  "name": "@researchtoolspy/${framework}-worker",
  "version": "1.0.0",
  "private": true,
  "description": "${DESCRIPTION} Framework Cloudflare Worker",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev --local",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env development",
    "deploy:production": "wrangler deploy --env production",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240124.0",
    "@types/node": "^20.11.5",
    "typescript": "^5.3.3",
    "vitest": "^1.2.1",
    "wrangler": "^4.39.0"
  },
  "dependencies": {
    "itty-router": "^4.0.25"
  }
}
EOF

    # Create wrangler.toml
    cat > "$BASE_DIR/$framework/wrangler.toml" << EOF
name = "researchtoolspy-${framework}"
main = "src/index.ts"
compatibility_date = "2024-01-24"
compatibility_flags = ["nodejs_compat"]

# Development configuration
[env.development]
name = "researchtoolspy-${framework}-dev"
workers_dev = true

[[env.development.d1_databases]]
binding = "DB"
database_name = "researchtoolspy-dev"
database_id = "local-db-id"

[[env.development.kv_namespaces]]
binding = "CACHE"
id = "${framework}-cache-dev"
preview_id = "${framework}-cache-preview"

[env.development.vars]
ENVIRONMENT = "development"

# Production configuration
[env.production]
name = "researchtoolspy-${framework}"
workers_dev = false

[[env.production.d1_databases]]
binding = "DB"
database_name = "researchtoolspy-prod"
database_id = "prod-db-id"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "${framework}-cache-prod"

[env.production.vars]
ENVIRONMENT = "production"
EOF

    echo "Created basic structure for $framework"
done

echo "All framework workers created successfully!"