# Cloudflare-Specific Lessons Learned

## Overview
Lessons learned from deploying and operating Research Tools on Cloudflare Pages with Workers, D1 Database, and KV storage.

---

## Cloudflare Pages Deployment

### Build Configuration

**What Works Well**:
```toml
# wrangler.toml
name = "researchtoolspy"
pages_build_output_dir = "dist"
compatibility_date = "2024-09-23"

[vars]
ENVIRONMENT = "development"
ENABLE_AI_FEATURES = "true"
DEFAULT_AI_MODEL = "gpt-4o-mini"
```

**Lessons**:
1. ✅ **Always set compatibility_date** - Ensures consistent behavior
2. ✅ **Use [vars] for development defaults** - Prevents 401 errors in dev
3. ✅ **Separate production/preview vars** - Different AI keys, database IDs
4. ⚠️ **Build output must be in dist/** - Pages expects this structure

### Deployment Process

**Successful Pattern**:
```bash
npm run build && wrangler pages deploy dist --project-name=researchtoolspy
```

**Lessons**:
1. ✅ **Always build before deploy** - Catches TypeScript errors early
2. ✅ **Use --project-name flag** - Explicit is better than implicit
3. ⚠️ **Deployment takes 60-90 seconds** - Be patient, don't interrupt
4. ⚠️ **51/71 files uploaded** - Cloudflare caches unchanged files (good!)
5. ❌ **Don't run multiple deploys simultaneously** - Causes conflicts

### Environment Variables

**Critical Variables**:
```bash
# Production
OPENAI_API_KEY=sk-...
DATABASE_ID=xxx-yyy-zzz
KV_NAMESPACE_ID=abc123

# Development (in [vars])
ENABLE_AI_FEATURES=true
DEFAULT_AI_MODEL=gpt-4o-mini
ENVIRONMENT=development
```

**Lessons**:
1. ✅ **Set AI features in [vars]** - Fixes 401 errors in development
2. ✅ **Use secrets for API keys** - `wrangler secret put OPENAI_API_KEY`
3. ✅ **Document all required vars** - Prevents deployment issues
4. ⚠️ **Preview vs Production** - Different env vars for each
5. ❌ **Never commit secrets to git** - Use wrangler secrets

---

## Cloudflare D1 Database

### Migration Best Practices

**Successful Pattern**:
```bash
# Local development
wrangler d1 execute researchtoolspy-db --file=schema/migrations/020-create-comments-table.sql

# Production deployment
wrangler d1 execute researchtoolspy-db --file=schema/migrations/020-create-comments-table.sql --remote
```

**Lessons**:
1. ✅ **Always add database binding to wrangler.toml FIRST** - Before running commands
2. ✅ **Use --remote flag for production** - Local is for dev only
3. ✅ **Verify migrations immediately** - Run test queries after
4. ✅ **Number migrations sequentially** - 001, 002, 003... for order
5. ⚠️ **D1 doesn't track migrations** - You must track applied migrations manually
6. ❌ **Don't forget database binding** - Causes "database not found" errors

### Database Binding

**Working Configuration**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "researchtoolspy-db"
database_id = "your-db-id-here"
```

**Lessons**:
1. ✅ **Use "DB" as binding name** - Consistent across Functions
2. ✅ **Document database_id** - Needed for migrations
3. ✅ **Binding must match code** - `env.DB` in TypeScript
4. ⚠️ **Preview and production use same DB** - Be careful with data

### Query Performance

**Optimized Patterns**:
```typescript
// Good: Use composite indexes
CREATE INDEX idx_comments_entity_status
  ON comments(entity_type, entity_id, status, created_at DESC)

// Good: Use prepared statements
const stmt = env.DB.prepare('SELECT * FROM comments WHERE entity_type = ? AND entity_id = ?')
const { results } = await stmt.bind(entityType, entityId).all()

// Bad: String concatenation (SQL injection risk)
const query = `SELECT * FROM comments WHERE entity_type = '${entityType}'`
```

**Lessons**:
1. ✅ **Composite indexes are crucial** - Dramatically faster queries
2. ✅ **Always use prepared statements** - Security + performance
3. ✅ **Index on query WHERE clauses** - entity_type + entity_id + status
4. ✅ **Use .all() for arrays, .first() for single** - Clearer intent
5. ⚠️ **D1 is SQLite** - Some features differ from PostgreSQL/MySQL
6. ⚠️ **Indexes cost storage** - Balance query speed vs storage

---

## Cloudflare KV Storage

### Caching Strategy

**Successful Pattern**:
```typescript
// Check cache first
const cacheKey = `instagram:${shortcode}:${mode}`
const cached = await env.CACHE.get(cacheKey, 'json')
if (cached) {
  console.log('[Cache HIT]', cacheKey)
  return cached
}

// Fetch fresh, then cache
const result = await fetchInstagramData(url)
await env.CACHE.put(cacheKey, JSON.stringify(result), {
  expirationTtl: 86400 // 24 hours
})
return result
```

**Lessons**:
1. ✅ **Always specify expirationTtl** - Prevents infinite cache growth
2. ✅ **Use structured cache keys** - `prefix:id:variant` format
3. ✅ **Cache successful results only** - Don't cache errors
4. ✅ **Log cache hits/misses** - Helps debug and monitor
5. ⚠️ **KV is eventually consistent** - May take 60s to propagate globally
6. ⚠️ **KV has size limits** - 25MB per value, 1GB per namespace
7. ❌ **Don't use KV for real-time data** - Use D1 or Durable Objects

### Cache Invalidation

**Strategies**:
```typescript
// Time-based (good for external APIs)
expirationTtl: 86400 // 24 hours

// Version-based (good for internal data)
const cacheKey = `menu:full:v${version}`

// Manual purge (for critical updates)
await env.CACHE.delete(cacheKey)
```

**Lessons**:
1. ✅ **Time-based for external APIs** - Instagram, social media
2. ✅ **Version-based for internal data** - Increment to bust cache
3. ✅ **Manual purge for critical updates** - When data must be fresh
4. ⚠️ **Cache warmup on deploy** - Prepopulate common keys
5. ❌ **Don't cache user-specific data in shared keys** - Use user-scoped keys

---

## Cloudflare Workers (Functions)

### API Endpoint Patterns

**Successful Pattern**:
```typescript
// functions/api/comments.ts
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const method = request.method

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Handle methods...
  try {
    // Logic here
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
```

**Lessons**:
1. ✅ **Always handle OPTIONS** - Required for CORS
2. ✅ **Return corsHeaders on ALL responses** - Including errors
3. ✅ **Use try/catch at top level** - Prevents unhandled rejections
4. ✅ **Explicit method routing** - if/switch on request.method
5. ✅ **Type the Env interface** - DB, SESSIONS, CACHE, etc.
6. ⚠️ **Workers have 50ms CPU limit** - Offload heavy work
7. ⚠️ **Response must be returned** - Don't forget to return!

### Authentication Patterns

**Dual-mode auth (Token + Hash)**:
```typescript
async function getUserFromRequest(request: Request, env: Env) {
  // Try bearer token first (authenticated users)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const sessionData = await env.SESSIONS.get(token)
    if (sessionData) {
      return { userId: JSON.parse(sessionData).user_id }
    }
  }

  // Fall back to hash (guest mode)
  const userHash = request.headers.get('X-User-Hash')
  if (userHash) {
    return { userHash }
  }

  return {}
}
```

**Lessons**:
1. ✅ **Support both authenticated and guest** - Increases adoption
2. ✅ **Use KV for sessions** - Fast, edge-cached
3. ✅ **Custom headers for guest mode** - X-User-Hash
4. ✅ **Validate tokens on every request** - No server-side sessions
5. ⚠️ **Session expiry in KV** - Set expirationTtl appropriately

---

## Performance Optimization

### Bundle Size

**Current State**:
```
dist/assets/index-BDTo_EmN.js    2,769.39 kB │ gzip: 799.27 kB ⚠️
```

**Issues**:
- Main bundle is 2.77MB (too large)
- Warning about 500KB chunks
- Slow initial page load

**Recommended Fixes**:
```typescript
// 1. Lazy load heavy components
const NetworkGraphPage = lazy(() => import('./pages/NetworkGraphPage'))
const COGWizard = lazy(() => import('./components/frameworks/COGWizard'))

// 2. Manual chunks in vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'viz-libs': ['force-graph', 'd3', 'react-force-graph-2d'],
        'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
      }
    }
  }
}
```

**Lessons**:
1. ⚠️ **Monitor bundle size** - Anything >500KB needs attention
2. ✅ **Lazy load visualization libraries** - They're huge
3. ✅ **Manual chunking** - Group vendors logically
4. ✅ **Code splitting by route** - React.lazy() per page
5. ❌ **Don't lazy load core UI** - Button, Input, etc. should be in main

### Cold Start Performance

**Observed**:
- First request: ~200-300ms
- Subsequent: ~50-100ms
- Database queries: <10ms (D1 is fast!)

**Optimization**:
```typescript
// Cache frequently accessed data
const cachedUsers = await env.CACHE.get('users:active')
if (!cachedUsers) {
  const users = await env.DB.prepare('SELECT * FROM users WHERE active = 1').all()
  await env.CACHE.put('users:active', JSON.stringify(users), { expirationTtl: 3600 })
}
```

**Lessons**:
1. ✅ **KV caching reduces cold starts** - Warm data is instant
2. ✅ **D1 queries are sub-millisecond** - Very fast at edge
3. ✅ **Workers warm up quickly** - After first request
4. ⚠️ **External API calls are slow** - Cache aggressively
5. ⚠️ **Cold start depends on region** - Varies globally

---

## Common Issues & Solutions

### Issue 1: 401 Unauthorized in Development

**Symptom**: AI features returning 401 in dev environment

**Root Cause**: ENABLE_AI_FEATURES only in production

**Solution**:
```toml
# Add to wrangler.toml
[vars]
ENABLE_AI_FEATURES = "true"
DEFAULT_AI_MODEL = "gpt-4o-mini"
```

### Issue 2: Database Not Found

**Symptom**: `Error: Database 'DB' not found`

**Root Cause**: Missing database binding in wrangler.toml

**Solution**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "researchtoolspy-db"
database_id = "your-db-id"
```

### Issue 3: CORS Errors

**Symptom**: Browser blocks API requests from frontend

**Root Cause**: Missing CORS headers or OPTIONS handling

**Solution**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

if (method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders })
}

// Include corsHeaders in ALL responses
return new Response(data, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

### Issue 4: Slow Instagram Extraction

**Symptom**: Timeouts or 429 rate limiting

**Root Cause**: Too many API calls, no caching

**Solution**: Implement 5-strategy fallback + 24hr KV caching (as documented)

### Issue 5: Build Timeout During Deployment

**Symptom**: `npm run wrangler:deploy` times out at 2 minutes

**Root Cause**: Build + upload takes >2 minutes for large projects

**Solution**:
```bash
# Build separately, deploy only dist
npm run build
wrangler pages deploy dist --project-name=researchtoolspy
```

Or increase timeout in CI/CD:
```yaml
timeout-minutes: 10
```

---

## Best Practices Summary

### Do:
1. ✅ Use composite indexes for common query patterns
2. ✅ Cache external API calls aggressively (24hr TTL)
3. ✅ Handle CORS properly (OPTIONS + headers on all responses)
4. ✅ Use prepared statements for SQL (security + performance)
5. ✅ Support both authenticated and guest users
6. ✅ Log cache hits/misses for monitoring
7. ✅ Version cache keys for easy invalidation
8. ✅ Set expirationTtl on all KV puts
9. ✅ Build before deploy to catch errors
10. ✅ Document all environment variables

### Don't:
1. ❌ Rely on single external service (use fallbacks)
2. ❌ Skip CORS headers (causes browser blocks)
3. ❌ Forget database binding in wrangler.toml
4. ❌ Use string concatenation for SQL (injection risk)
5. ❌ Cache errors (only cache successful results)
6. ❌ Run multiple deploys simultaneously
7. ❌ Commit secrets to git (use wrangler secrets)
8. ❌ Ignore bundle size warnings (>500KB needs attention)
9. ❌ Hard delete threaded data (breaks relationships)
10. ❌ Use KV for real-time data (it's eventually consistent)

---

## Cloudflare-Specific Gotchas

### 1. KV Eventual Consistency
- Changes take up to 60s to propagate globally
- Use D1 for data requiring immediate consistency
- KV is perfect for caching, not source of truth

### 2. D1 is SQLite
- Some SQL features differ from PostgreSQL
- No stored procedures or triggers
- Use application logic for complex operations

### 3. Worker CPU Limit (50ms)
- Offload heavy computation
- Use async operations
- Cache expensive calculations

### 4. Cold Start Variability
- First request can be slow (200-300ms)
- Subsequent requests fast (50-100ms)
- Pre-warm with health checks

### 5. Bundle Size Impacts Cold Start
- Large bundles = slower cold starts
- Code split aggressively
- Lazy load heavy libraries

---

## Monitoring & Debugging

### Recommended Tools
1. **Wrangler Tail**: `wrangler pages deployment tail`
2. **Console Logs**: Show up in tail output
3. **D1 Dashboard**: Query browser for debugging
4. **KV Dashboard**: Inspect cached data
5. **Analytics**: Built-in CF analytics

### Debugging Pattern
```typescript
// Add structured logging
console.log('[API] Comments fetch:', { entityType, entityId, status })
console.log('[Cache] Hit:', cacheKey)
console.error('[Error] Database query failed:', error)

// Use wrangler tail to watch logs
// Terminal: wrangler pages deployment tail --project-name=researchtoolspy
```

---

## Future Considerations

### Scaling
- **Workers**: Auto-scale (no config needed)
- **D1**: 10GB limit per database (plan for sharding)
- **KV**: 1GB per namespace (plan for multiple namespaces)

### Costs (Estimated)
- **Pages**: Free for most projects (<500 builds/month)
- **Workers**: $5/month (10M requests included)
- **D1**: $5/month (first 5GB free)
- **KV**: $0.50/month (first 1GB free)

### Alternatives to Consider
- **Durable Objects**: For real-time features (comments, chat)
- **R2**: For file storage (images, PDFs)
- **Queues**: For background processing
- **Workers AI**: For GPT integration at edge

---

**Last Updated**: 2025-10-07
**Cloudflare Products Used**: Pages, Workers, D1, KV
**Deployment URL**: https://researchtoolspy.pages.dev
