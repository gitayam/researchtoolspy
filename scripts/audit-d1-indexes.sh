#!/bin/bash

# Run the read-only D1 composite/covering-index audit locally or remotely.

set -euo pipefail

DATABASE_NAME="researchtoolspy-prod"
TARGET="--local"

for arg in "$@"; do
  case "$arg" in
    --local)
      TARGET="--local"
      ;;
    --remote)
      TARGET="--remote"
      ;;
    --database=*)
      DATABASE_NAME="${arg#--database=}"
      ;;
    --help|-h)
      echo "Usage: $0 [--local|--remote] [--database=NAME]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if rg -n '^[[:space:]]*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|REINDEX|PRAGMA)\b' \
  scripts/d1-index-audit.sql; then
  echo "Refusing to run: scripts/d1-index-audit.sql contains a mutating statement" >&2
  exit 1
fi

echo "Running read-only index audit against ${DATABASE_NAME} (${TARGET#--})"
INDEX_AUDIT_SQL=$(<scripts/d1-index-audit.sql)
pnpm exec wrangler d1 execute "$DATABASE_NAME" "$TARGET" \
  --command="$INDEX_AUDIT_SQL"
