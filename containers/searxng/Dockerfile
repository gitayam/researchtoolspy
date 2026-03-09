# containers/searxng/Dockerfile
FROM searxng/searxng:latest

# Copy custom settings
COPY settings.yml /etc/searxng/settings.yml

# SearXNG runs on port 8080 by default
EXPOSE 8080

# Health check - SearXNG needs startup time
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Use default entrypoint from base image (runs uwsgi)
