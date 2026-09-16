#!/bin/bash

# Apply pending managed D1 migrations.
#
# Deliberately not `wrangler d1 migrations apply`. That command fails against
# this database for reasons never identified: migration 0017 was rejected by it
# four times, and the same file applied cleanly through `d1 execute --file` on
# the first attempt. A throwaway remote probe confirmed the SQL was valid, so
# the file was never the problem — the apply path was.
#
# So this drives `d1 execute --remote --file` (the path that works) and keeps
# wrangler's own `d1_migrations` ledger itself, using the exact table shape
# wrangler creates. scripts/list-managed-migrations.sh already reads that ledger
# directly rather than trusting `migrations list`, so the two agree.
#
# The ledger row is written only AFTER the migration's SQL succeeds. A migration
# that fails halfway is left unrecorded and the run stops there, so the next
# attempt retries it rather than skipping past a half-applied change.

set -euo pipefail

# shellcheck source=scripts/cloudflare-account.sh
source ./scripts/cloudflare-account.sh

DATABASE_NAME="researchtoolspy-prod"
MIGRATION_DIR="schema/managed-migrations"
TARGET="--remote"
TARGET_LABEL="production"

for arg in "$@"; do
  case "$arg" in
    --remote) TARGET="--remote"; TARGET_LABEL="production" ;;
    --local)  TARGET="--local";  TARGET_LABEL="local dev" ;;
    --help|-h) echo "Usage: $0 [--local|--remote]"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "Managed migration directory not found: $MIGRATION_DIR" >&2
  exit 1
fi

d1_command() {
  pnpm exec wrangler d1 execute "$DATABASE_NAME" "$TARGET" --json --command="$1"
}

# Wrangler's own shape, so a later `wrangler d1 migrations list` still agrees
# with what this script recorded.
d1_command "CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);" > /dev/null

APPLIED_NAMES=$(d1_command "SELECT name FROM d1_migrations ORDER BY id;" | node -e '
  let input = ""
  process.stdin.on("data", chunk => { input += chunk })
  process.stdin.on("end", () => {
    const payload = JSON.parse(input)
    const names = (payload?.[0]?.results ?? []).map(row => row.name)
    process.stdout.write(names.join("\n"))
  })
')

APPLIED_COUNT=0
for migration_path in "$MIGRATION_DIR"/*.sql; do
  migration_name=$(basename "$migration_path")

  if [ -n "$APPLIED_NAMES" ] && printf '%s\n' "$APPLIED_NAMES" | grep -Fxq "$migration_name"; then
    continue
  fi

  # A name with a quote in it would break the ledger INSERT below. Refuse rather
  # than build the statement anyway.
  case "$migration_name" in
    *"'"*|*'"'*|*'\'*)
      echo "Refusing to apply a migration whose filename contains a quote: $migration_name" >&2
      exit 1
      ;;
  esac

  echo "Applying $migration_name to $TARGET_LABEL..."
  if ! pnpm exec wrangler d1 execute "$DATABASE_NAME" "$TARGET" --file="$migration_path"; then
    echo "MIGRATION FAILED: $migration_name" >&2
    echo "It is NOT recorded as applied, so the next run will retry it." >&2
    echo "$APPLIED_COUNT migration(s) applied before this one." >&2
    exit 1
  fi

  # Only now: the work succeeded, so the ledger may say so.
  d1_command "INSERT INTO d1_migrations (name) VALUES ('$migration_name');" > /dev/null
  echo "Applied and recorded: $migration_name"
  APPLIED_COUNT=$((APPLIED_COUNT + 1))
done

if [ "$APPLIED_COUNT" -eq 0 ]; then
  echo "No managed migrations pending."
else
  echo "Applied $APPLIED_COUNT managed migration(s) to $TARGET_LABEL."
fi
