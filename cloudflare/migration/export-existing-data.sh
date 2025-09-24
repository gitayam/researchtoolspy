#!/bin/bash

# Export existing data from current database to JSON format for D1 migration
# This script exports all tables to JSON files that can be imported into D1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPORT_DIR="$SCRIPT_DIR/exports"
DB_PATH="../backend/app/database/researchtoolspy.db"

# Create export directory
mkdir -p "$EXPORT_DIR"

echo "Starting database export from $DB_PATH..."

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at $DB_PATH"
    exit 1
fi

# Export each table to JSON
echo "Exporting users table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/users.json"
.mode json
SELECT * FROM users;
EOF

echo "Exporting framework_sessions table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/framework_sessions.json"
.mode json
SELECT * FROM framework_sessions;
EOF

echo "Exporting processed_urls table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/processed_urls.json"
.mode json
SELECT * FROM processed_urls;
EOF

echo "Exporting citations table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/citations.json"
.mode json
SELECT * FROM citations;
EOF

echo "Exporting research_jobs table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/research_jobs.json"
.mode json
SELECT * FROM research_jobs;
EOF

echo "Exporting framework_templates table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/framework_templates.json"
.mode json
SELECT * FROM framework_templates;
EOF

echo "Exporting user_preferences table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/user_preferences.json"
.mode json
SELECT * FROM user_preferences;
EOF

echo "Exporting api_keys table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/api_keys.json"
.mode json
SELECT * FROM api_keys;
EOF

echo "Exporting user_sessions table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/user_sessions.json"
.mode json
SELECT * FROM user_sessions;
EOF

echo "Exporting audit_logs table..."
sqlite3 "$DB_PATH" <<EOF > "$EXPORT_DIR/audit_logs.json"
.mode json
SELECT * FROM audit_logs;
EOF

# Create metadata file
cat > "$EXPORT_DIR/metadata.json" <<EOF
{
  "export_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source_database": "$DB_PATH",
  "tables": [
    "users",
    "framework_sessions",
    "processed_urls",
    "citations",
    "research_jobs",
    "framework_templates",
    "user_preferences",
    "api_keys",
    "user_sessions",
    "audit_logs"
  ]
}
EOF

# Create summary
echo ""
echo "Export completed successfully!"
echo "Exported files:"
ls -lh "$EXPORT_DIR"/*.json

# Count records
echo ""
echo "Record counts:"
for file in "$EXPORT_DIR"/*.json; do
    if [ "$file" != "$EXPORT_DIR/metadata.json" ]; then
        table=$(basename "$file" .json)
        count=$(cat "$file" | jq '. | length' 2>/dev/null || echo "0")
        echo "  $table: $count records"
    fi
done

echo ""
echo "Next steps:"
echo "1. Review the exported data in $EXPORT_DIR"
echo "2. Run import-to-d1.ts to import data into Cloudflare D1"
echo "3. Verify data integrity after import"