#!/bin/bash

# List pending managed D1 migrations without initializing the remote
# d1_migrations table. Wrangler's native `migrations list` creates that table
# when it is absent, so it is not suitable for a production dry run.

set -euo pipefail

DATABASE_NAME="researchtoolspy-prod"
MIGRATION_DIR="schema/managed-migrations"
REMOTE=false
D1_READ_ATTEMPTS=5

run_d1_json() {
  local sql=$1
  local attempt=1
  local output=""

  while [ "$attempt" -le "$D1_READ_ATTEMPTS" ]; do
    if output=$(pnpm exec wrangler d1 execute "$DATABASE_NAME" \
      --remote \
      --json \
      --command="$sql" 2>&1); then
      printf '%s\n' "$output"
      return 0
    fi

    if [ "$attempt" -lt "$D1_READ_ATTEMPTS" ]; then
      echo "Remote migration read failed (attempt ${attempt}/${D1_READ_ATTEMPTS}); retrying..." >&2
      sleep "$attempt"
    fi
    attempt=$((attempt + 1))
  done

  printf '%s\n' "$output" >&2
  return 1
}

for arg in "$@"; do
  case "$arg" in
    --remote)
      REMOTE=true
      ;;
    --local)
      REMOTE=false
      ;;
    --help|-h)
      echo "Usage: $0 [--local|--remote]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "Managed migration directory not found: $MIGRATION_DIR" >&2
  exit 1
fi

if [ "$REMOTE" = false ]; then
  pnpm exec wrangler d1 migrations list "$DATABASE_NAME" --local
  exit 0
fi

TRACKER_JSON=$(run_d1_json "SELECT name FROM sqlite_master
  WHERE type = 'table' AND name = 'd1_migrations';")

TRACKER_EXISTS=$(printf '%s' "$TRACKER_JSON" | node -e '
  let input = ""
  process.stdin.on("data", chunk => { input += chunk })
  process.stdin.on("end", () => {
    const payload = JSON.parse(input)
    const trackerExists = (payload?.[0]?.results ?? [])
      .some(row => row.name === "d1_migrations")
    process.stdout.write(trackerExists ? "1" : "0")
  })
')

APPLIED_NAMES=""
if [ "$TRACKER_EXISTS" = "1" ]; then
  APPLIED_JSON=$(run_d1_json "SELECT name FROM d1_migrations ORDER BY id;")

  APPLIED_NAMES=$(printf '%s' "$APPLIED_JSON" | node -e '
    let input = ""
    process.stdin.on("data", chunk => { input += chunk })
    process.stdin.on("end", () => {
      const payload = JSON.parse(input)
      const names = (payload?.[0]?.results ?? []).map(row => row.name)
      process.stdout.write(names.join("\n"))
    })
  ')
fi

PENDING_COUNT=0
echo "Pending managed migrations:"

for migration_path in "$MIGRATION_DIR"/*.sql; do
  migration_name=$(basename "$migration_path")
  if [ -n "$APPLIED_NAMES" ] && printf '%s\n' "$APPLIED_NAMES" | grep -Fxq "$migration_name"; then
    continue
  fi

  echo "  - $migration_name"
  PENDING_COUNT=$((PENDING_COUNT + 1))
done

if [ "$PENDING_COUNT" -eq 0 ]; then
  echo "  none"
fi

echo "Total pending: $PENDING_COUNT"
