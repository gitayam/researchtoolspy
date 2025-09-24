# Cloudflare Deployment Guide

## Overview

This directory contains deployment scripts and configuration for deploying the ResearchToolsPy platform to Cloudflare Workers, Pages, and D1.

## Architecture

- **Cloudflare Workers**: Edge compute for API endpoints
- **Cloudflare Pages**: Static site hosting for Next.js frontend
- **Cloudflare D1**: SQLite at the edge for data storage
- **Cloudflare KV**: Key-value storage for sessions and caching
- **Cloudflare R2**: Object storage for document exports

## Prerequisites

1. Cloudflare account with Workers and Pages enabled
2. Node.js 18+ installed
3. Wrangler CLI (`npm install -g wrangler`)
4. GitHub Actions secrets configured (for CI/CD)

## Local Development

### Setup

```bash
# Install dependencies
cd cloudflare/workers
npm install

# Setup local D1 database
cd ../database
./setup-local.sh

# Start local development server
cd ../workers/gateway
npx wrangler dev --local --persist-to=../../.wrangler/state
```

### Testing Individual Workers

```bash
# Gateway Worker
cd cloudflare/workers/gateway
npx wrangler dev --local

# Export Service
cd cloudflare/workers/export
npx wrangler dev --local

# Framework Workers
cd cloudflare/workers/frameworks/swot
npx wrangler dev --local
```

## Deployment

### Manual Deployment

```bash
# Deploy to development
./cloudflare/deploy/deploy.sh development

# Deploy to staging
./cloudflare/deploy/deploy.sh staging

# Deploy to production
./cloudflare/deploy/deploy.sh production
```

### CI/CD Deployment

Deployments are automated via GitHub Actions:

- **Push to `main`**: Deploys to production
- **Push to `staging`**: Deploys to staging
- **Push to feature branch**: Deploys to development

### Environment Configuration

#### Development
- API: `https://api-dev.researchtoolspy.com`
- App: `https://app-dev.researchtoolspy.com`
- Database: `researchtoolspy-dev`

#### Staging
- API: `https://api-staging.researchtoolspy.com`
- App: `https://app-staging.researchtoolspy.com`
- Database: `researchtoolspy-staging`

#### Production
- API: `https://api.researchtoolspy.com`
- App: `https://app.researchtoolspy.com`
- Database: `researchtoolspy-prod`

## Database Migration

### Export Existing Data

```bash
cd cloudflare/migration
npm run export
```

### Import to D1

```bash
# Import to development
npm run import:dev

# Import to staging
npm run import:staging

# Import to production (requires confirmation)
npm run import:prod
```

### Verify Migration

```bash
npm run verify
```

## Rollback Procedures

### Quick Rollback

```bash
# Rollback all services
./cloudflare/deploy/rollback.sh production all

# Rollback specific service
./cloudflare/deploy/rollback.sh production gateway
./cloudflare/deploy/rollback.sh production pages
```

### Manual Rollback

```bash
# List deployments
wrangler deployments list --env production

# Rollback to specific deployment
wrangler rollback <deployment-id> --env production
```

## Monitoring

### Health Checks

- Gateway: `GET /health`
- Export Service: `GET /health`
- Framework Workers: `GET /health`

### Logs

```bash
# View real-time logs
wrangler tail --env production

# View logs for specific worker
wrangler tail researchtoolspy-gateway --env production
```

### Metrics

Access metrics via Cloudflare Dashboard:
1. Workers & Pages > Analytics
2. Select worker/page
3. View requests, errors, CPU time

## Secrets Management

### Required Secrets

Set these in GitHub Actions:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Set these in Wrangler:
```bash
# JWT Secret
echo "your-secret" | wrangler secret put JWT_SECRET --env production

# OpenAI API Key
echo "sk-..." | wrangler secret put OPENAI_API_KEY --env production
```

### Environment Variables

Configure in `wrangler.toml`:
```toml
[env.production.vars]
ENVIRONMENT = "production"
```

## Troubleshooting

### Common Issues

1. **Authentication Error**
   ```bash
   wrangler login
   ```

2. **D1 Database Not Found**
   ```bash
   wrangler d1 create researchtoolspy-prod
   wrangler d1 migrations apply researchtoolspy-prod --env production
   ```

3. **KV Namespace Not Found**
   ```bash
   wrangler kv:namespace create SESSIONS --env production
   ```

4. **Build Failures**
   - Check Node.js version (requires 18+)
   - Clear cache: `rm -rf node_modules package-lock.json`
   - Reinstall: `npm install`

### Debug Mode

Enable debug logging:
```bash
WRANGLER_LOG=debug wrangler dev
```

## Performance Optimization

### Worker Bundle Size
- Keep under 1MB compressed
- Use dynamic imports for large dependencies
- Tree-shake unused code

### D1 Queries
- Use prepared statements
- Batch operations when possible
- Implement connection pooling

### Caching Strategy
- KV for session data (TTL: 24h)
- Cache API responses (TTL: 5m)
- R2 for static assets

## Security

### Best Practices
1. Never commit secrets to repository
2. Use environment-specific API keys
3. Implement rate limiting
4. Enable CORS appropriately
5. Validate all inputs
6. Use prepared statements for D1

### Security Headers
Configured in worker middleware:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Support

For issues or questions:
1. Check logs: `wrangler tail`
2. Review Cloudflare status: https://www.cloudflarestatus.com/
3. Create GitHub issue with:
   - Environment affected
   - Error messages
   - Steps to reproduce
   - Expected vs actual behavior