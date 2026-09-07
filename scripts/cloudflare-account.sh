#!/bin/bash

# Canonical Cloudflare account selection for repository-owned scripts.
#
# Wrangler cannot select non-interactively when the authenticated user belongs
# to multiple accounts. Keep the project account in one source that every
# standalone remote script can load. CI and emergency operator shells may still
# provide CLOUDFLARE_ACCOUNT_ID explicitly; a deliberate override wins.

RESEARCHTOOLSPY_CLOUDFLARE_ACCOUNT_ID="04eac09ae835290383903273f68c79b0"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$RESEARCHTOOLSPY_CLOUDFLARE_ACCOUNT_ID}"
