#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
npx wrangler deploy --config workers/browser-renderer/wrangler.toml
