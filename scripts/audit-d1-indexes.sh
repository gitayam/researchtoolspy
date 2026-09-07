#!/bin/bash

# Run the read-only D1 composite/covering-index audit locally or remotely.

set -euo pipefail

# shellcheck source=scripts/cloudflare-account.sh
source ./scripts/cloudflare-account.sh

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

AUDIT_SQL_PATH="scripts/d1-index-audit.sql"
if [ ! -f "$AUDIT_SQL_PATH" ]; then
  echo "Refusing to run: ${AUDIT_SQL_PATH} is missing" >&2
  exit 1
fi

# Use POSIX grep rather than an optional developer tool: this safety check must
# run in every production shell. Capture status 1 as "no matches" and fail
# closed on any actual grep/read error.
set +e
MUTATING_LINES=$(grep -Ein \
  '^[[:space:]]*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|REINDEX|PRAGMA)([[:space:](;]|$)' \
  "$AUDIT_SQL_PATH")
GREP_STATUS=$?
set -e

if [ "$GREP_STATUS" -gt 1 ]; then
  echo "Refusing to run: could not inspect ${AUDIT_SQL_PATH}" >&2
  exit 1
fi

if [ "$GREP_STATUS" -eq 0 ]; then
  printf '%s\n' "$MUTATING_LINES"
  echo "Refusing to run: scripts/d1-index-audit.sql contains a mutating statement" >&2
  exit 1
fi

echo "Running read-only index audit against ${DATABASE_NAME} (${TARGET#--})"
INDEX_AUDIT_SQL=$(<"$AUDIT_SQL_PATH")
pnpm exec wrangler d1 execute "$DATABASE_NAME" "$TARGET" \
  --command="$INDEX_AUDIT_SQL"
