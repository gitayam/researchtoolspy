#!/bin/sh
# Custom entrypoint for SearXNG in Cloudflare Containers
# Ensures the service starts and binds to the correct port

set -e

# Generate secret key if not set
if [ -z "$SEARXNG_SECRET" ]; then
    export SEARXNG_SECRET=$(head -c 32 /dev/urandom | base64)
fi

# Update settings with secret key
if [ -f /etc/searxng/settings.yml ]; then
    sed -i "s/secret_key:.*/secret_key: \"$SEARXNG_SECRET\"/" /etc/searxng/settings.yml
fi

# Ensure bind to all interfaces
export BIND_ADDRESS="${BIND_ADDRESS:-0.0.0.0}"

echo "Starting SearXNG on ${BIND_ADDRESS}:8080..."

# Start uwsgi with explicit settings
exec uwsgi --http ${BIND_ADDRESS}:8080 \
    --master \
    --module searx.webapp:app \
    --processes 2 \
    --threads 2 \
    --disable-logging \
    --buffer-size 8192 \
    --enable-threads \
    --lazy-apps
