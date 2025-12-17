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

## AI Prompting Best Practices for Cloudflare Workers

### Overview
Lessons learned from implementing AI-powered features (Starbursting, Claims Analysis, Content Intelligence) using OpenAI GPT models via Cloudflare Workers.

### Critical Rule: Be Specific, Never Generic

**❌ BAD - Vague References**:
```typescript
// Generated question:
"Why is this significant or important?"
"How did this happen or come about?"
"Where did these events occur?"
```

**Problem**: Questions use "this", "it", "these events" - too generic for research. Researchers can't investigate vague questions.

**✅ GOOD - Specific References**:
```typescript
// Generated question:
"Why is Lee Myung-bak involved in the Ministry of Foreign Affairs investigation?"
"How did the Korea-Costa Rica diplomatic incident escalate between June 2023 and August 2023?"
"Where in Camp David did the trilateral summit between US, Japan, and South Korea take place?"
```

**Why This Matters**: Specific questions reference actual entities, names, dates, locations - making them actionable for research.

### Prompt Engineering Patterns

#### 1. Entity-Rich Context Injection

**Pattern**:
```typescript
const aiContext = {
  url: primaryAnalysis.url,
  title: primaryAnalysis.title,
  summary: primaryAnalysis.summary,
  // ✅ Include up to 8000 chars of full text
  extracted_text: primaryAnalysis.extracted_text.substring(0, 8000),
  // ✅ Provide structured entities
  entities: {
    people: entities.people.map(p => ({ name: p.name, description: p.description })),
    organizations: entities.organizations.map(o => o.name),
    locations: entities.locations.map(l => l.name)
  },
  central_topic: centralTopic
}
```

**Lessons**:
1. ✅ **Send 8000+ chars of context** - More text = better specificity
2. ✅ **Structure entities clearly** - People, orgs, locations separate
3. ✅ **Include metadata** - Title, summary, URL for context
4. ⚠️ **Balance token usage** - 8000 chars ≈ 2000 tokens (reasonable)

#### 2. Explicit Anti-Vagueness Instructions

**Pattern**:
```typescript
const prompt = `Generate 5W1H questions for investigation.

CRITICAL RULES:
1. Questions MUST reference actual entities, names, dates, locations
2. DO NOT use vague terms: "this", "it", "the situation", "these events"
3. Each question must be self-contained and specific
4. Reference concrete nouns and actions from the text

❌ BAD: "Why is this significant?"
✅ GOOD: "Why is the Ministry of Foreign Affairs involved in the corruption investigation?"

❌ BAD: "How did this happen?"
✅ GOOD: "How did Lee Myung-bak's relationship with Samsung influence the policy decision?"

Extract entities:
- People: ${entities.people.map(p => p.name).join(', ')}
- Organizations: ${entities.organizations.map(o => o.name).join(', ')}
- Locations: ${entities.locations.map(l => l.name).join(', ')}

Full Text Context:
${fullText.substring(0, 8000)}

Generate questions that investigators can actually research.`
```

**Lessons**:
1. ✅ **Show examples** - ❌ BAD vs ✅ GOOD in prompt
2. ✅ **List entities explicitly** - AI sees what's available
3. ✅ **Explain WHY specificity matters** - "investigators can actually research"
4. ✅ **Use strong language** - "MUST", "DO NOT", "CRITICAL"

#### 3. Context-Aware Answer Extraction

**Pattern**:
```typescript
const prompt = `Extract answers from the text for these questions.

Questions to Answer:
${questions.map(q => `- ${q.question}`).join('\n')}

Full Text (search for answers):
${fullText}

INSTRUCTIONS:
1. Search the text for answers to each question
2. If answer found: Return relevant excerpt (max 300 chars)
3. If NOT found: Leave answer as empty string ("")
4. Mark status:
   - "answered" = Complete answer found in text
   - "partial" = Some information found but incomplete
   - "pending" = No answer found, requires investigation

Return JSON:
{
  "questions": [
    {
      "question": "Who is Lee Myung-bak and what is their role?",
      "answer": "Lee Myung-bak served as President of South Korea from 2008 to 2013...",
      "status": "answered",
      "source": "Text search"
    }
  ]
}`
```

**Lessons**:
1. ✅ **Provide full text for search** - AI can grep for answers
2. ✅ **Define status levels** - answered/partial/pending
3. ✅ **Accept "no answer"** - Marking pending is valid
4. ✅ **Limit answer length** - 300 chars prevents rambling

#### 4. Avoiding Duplicate Questions

**Pattern**:
```typescript
const existingQuestionsContext = `
EXISTING QUESTIONS (DO NOT DUPLICATE):

WHO:
- Who is Lee Myung-bak and what is their role?
- Who are the key officials in Ministry of Foreign Affairs?

WHAT:
- What actions did the Ministry announce on June 15?

[... all existing questions ...]

Your task: Generate NEW questions that cover GAPS not addressed above.
Focus on aspects that haven't been asked yet.`

const prompt = `${existingQuestionsContext}

Generate 2-3 NEW questions for each category (Who, What, Where, When, Why, How).

Rules:
1. DO NOT duplicate or rephrase existing questions
2. Identify what hasn't been asked yet
3. Focus on specific entities mentioned in the text
4. Each question must be unique and investigate a new angle`
```

**Lessons**:
1. ✅ **Show ALL existing questions** - AI can avoid duplication
2. ✅ **Emphasize "NEW" and "GAPS"** - Focus on what's missing
3. ✅ **Request specific count** - "2-3 NEW questions per category"
4. ✅ **Explain purpose** - "investigate a new angle"

#### 5. Structured JSON Response Format

**Pattern**:
```typescript
const prompt = `Return ONLY valid JSON in this exact format:

{
  "who": [
    {
      "id": "who_1",
      "category": "who",
      "question": "Who is [specific person] and what role do they play in [specific context]?",
      "answer": "Found in text or empty string",
      "priority": 5,
      "source": "Entity extraction" or "Text search" or "Requires investigation",
      "status": "answered" or "partial" or "pending"
    }
  ],
  "what": [...],
  "where": [...],
  "when": [...],
  "why": [...],
  "how": [...]
}

IMPORTANT:
- Return ONLY the JSON object
- No markdown code blocks
- No explanatory text
- All strings must be properly escaped
- Arrays must have proper commas`

const data = await callOpenAIViaGateway(env, {
  messages: [
    {
      role: 'system',
      content: 'You are an expert investigative researcher. Return ONLY valid JSON with specific questions referencing concrete entities.'
    },
    { role: 'user', content: prompt }
  ]
})

// Clean response
const jsonText = data.choices[0].message.content
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim()

const result = JSON.parse(jsonText)
```

**Lessons**:
1. ✅ **Show exact JSON structure** - AI follows format precisely
2. ✅ **Request "ONLY JSON"** - Prevents extra text
3. ✅ **System message reinforces** - "Return ONLY valid JSON"
4. ✅ **Clean markdown artifacts** - Remove ```json blocks
5. ⚠️ **Handle parse errors** - Try/catch around JSON.parse

### Model Selection

**For Starbursting/Question Generation**:
```typescript
model: 'gpt-4o-mini',
max_completion_tokens: 2000,
temperature: 0.7  // Balanced creativity/consistency
```

**Lessons**:
1. ✅ **gpt-4o-mini for most tasks** - Fast, cheap, good quality
2. ✅ **temperature 0.7** - Creative but not random
3. ✅ **max_completion_tokens 2000** - Enough for detailed responses
4. ⚠️ **Use gpt-4o for complex reasoning** - When quality matters more than speed

**For Claims Analysis/Deception Detection**:
```typescript
model: 'gpt-4o-mini',
max_completion_tokens: 3000,
temperature: 0.3  // Lower for analytical tasks
```

**Lessons**:
1. ✅ **Lower temperature (0.3)** - More consistent analysis
2. ✅ **Higher token limit (3000)** - Detailed reasoning needed
3. ✅ **Same model works** - gpt-4o-mini handles analysis well

### Caching Strategy for AI Calls

**Pattern**:
```typescript
const data = await callOpenAIViaGateway(env, {
  model: 'gpt-4o-mini',
  messages: [...]
}, {
  // ✅ Cache responses for 6 hours
  cacheTTL: getOptimalCacheTTL('starbursting-questions'),
  metadata: {
    endpoint: 'starbursting-generate',
    operation: 'question-generation'
  },
  timeout: 30000  // 30 second timeout
})

// In ai-gateway.ts
export function getOptimalCacheTTL(operation: string): number {
  const ttls = {
    'starbursting-questions': 21600,  // 6 hours
    'claim-extraction': 21600,        // 6 hours
    'claim-analysis': 21600,          // 6 hours
    'entity-extraction': 43200        // 12 hours
  }
  return ttls[operation] || 3600
}
```

**Lessons**:
1. ✅ **Cache AI responses** - Same content → same questions
2. ✅ **6 hours for questions** - Balance freshness vs cost
3. ✅ **12 hours for entities** - They rarely change
4. ✅ **Set timeouts** - 30s prevents hanging
5. ⚠️ **Don't cache errors** - Only cache successful results

### Error Handling

**Pattern**:
```typescript
try {
  const data = await callOpenAIViaGateway(env, {...})

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid API response')
  }

  const jsonText = data.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return JSON.parse(jsonText)

} catch (error) {
  console.error('[AI Error]', error)

  // Return fallback structure
  return {
    who: [],
    what: [],
    where: [],
    when: [],
    why: [],
    how: []
  }
}
```

**Lessons**:
1. ✅ **Check response structure** - Don't assume success
2. ✅ **Clean JSON before parsing** - Remove markdown
3. ✅ **Return fallback on error** - Empty structure, not crash
4. ✅ **Log errors with context** - Include endpoint/operation
5. ⚠️ **Don't expose API errors to users** - Generic error messages

### Cost Optimization

**Current Usage (gpt-4o-mini)**:
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Typical request: ~2500 tokens input, ~1000 tokens output
- Cost per request: ~$0.0009 (less than 1 cent)

**Optimization Strategies**:
```typescript
// 1. Limit context size
extracted_text: text.substring(0, 8000)  // ≈2000 tokens

// 2. Cache aggressively
cacheTTL: 21600  // 6 hours

// 3. Use gpt-4o-mini by default
model: 'gpt-4o-mini'  // 10x cheaper than gpt-4o

// 4. Limit response tokens
max_completion_tokens: 2000  // Prevents runaway responses
```

**Lessons**:
1. ✅ **8000 chars is sweet spot** - Enough context, reasonable cost
2. ✅ **Cache = free repeat requests** - 6 hour cache saves 90%+ of calls
3. ✅ **gpt-4o-mini for most tasks** - Only use gpt-4o when necessary
4. ✅ **Set token limits** - Prevents expensive accidents

### Prompt Testing Checklist

Before deploying AI prompts to production:

1. ✅ **Test with real data** - Use actual article text, not samples
2. ✅ **Check for vague responses** - No "this", "it", "the situation"
3. ✅ **Verify JSON parsing** - Response must be valid JSON
4. ✅ **Test error cases** - What if API fails? Timeout?
5. ✅ **Review cost** - How many tokens per request?
6. ✅ **Test caching** - Same input = cached response?
7. ✅ **Check specificity** - Do questions reference actual entities?
8. ✅ **Validate answer quality** - Are text searches finding answers?

### Common Pitfalls to Avoid

**❌ Don't:**
1. Use generic prompts expecting specific output
2. Skip providing entity context to AI
3. Allow vague references in generated content
4. Parse JSON without cleaning markdown artifacts
5. Cache errors or invalid responses
6. Use gpt-4o when gpt-4o-mini suffices
7. Send unlimited context (token costs add up)
8. Forget to set timeouts on API calls
9. Assume AI will follow format without examples
10. Deploy prompts without testing on real data

**✅ Do:**
1. Provide rich entity-based context (8000+ chars)
2. Show explicit examples of good vs bad output
3. Use strong directive language ("MUST", "DO NOT")
4. Clean and validate all JSON responses
5. Cache successful responses (6+ hours)
6. Use gpt-4o-mini as default model
7. Limit context to 8000 chars (≈2000 tokens)
8. Set 30s timeouts on all AI calls
9. Include exact JSON format in prompt
10. Test thoroughly with production-like data

---

**Last Updated**: 2025-10-30
**Cloudflare Products Used**: Pages, Workers, D1, KV
**AI Models Used**: GPT-4o-mini (primary), GPT-4o (complex reasoning)
**Deployment URL**: https://researchtoolspy.pages.dev
