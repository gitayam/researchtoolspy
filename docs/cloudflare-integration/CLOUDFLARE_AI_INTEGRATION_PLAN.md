# Cloudflare AI Gateway & AI Search Integration Plan
## Research Tools Platform

**Status**: 📋 Planning Phase
**Created**: 2025-10-11
**Platform**: Research Tools (researchtoolspy)
**Primary Use Case**: Intelligence analysis frameworks with GPT-4o-mini

---

## 🎯 Executive Summary

### What We're Building

Integrate Cloudflare AI Gateway and AI Search into the Research Tools platform to:

1. **Reduce GPT costs by 60-80%** through intelligent caching
2. **Enable semantic evidence search** across all frameworks
3. **Improve response times** from 2-5s to 200-800ms for cached queries
4. **Add cross-framework intelligence** (PMESII evidence → ACH hypotheses)
5. **Implement robust API security** (rate limiting, abuse prevention)

### Expected Impact

| Metric | Current | With AI Gateway | Improvement |
|--------|---------|-----------------|-------------|
| **GPT API Cost** | ~$50/month | ~$15/month | -70% |
| **Cache Hit Rate** | 0% | 60-80% | +∞ |
| **Response Time** | 2-5s | 0.2-0.8s (cached) | -75% |
| **Evidence Findability** | Keyword only | Semantic | +400% |
| **Framework Integration** | Manual | Automated | N/A |

### Time Investment

- **Setup**: 2 hours (AI Gateway + AI Search)
- **Implementation**: 3 weeks (phased rollout)
- **Monitoring**: 30 min/week ongoing

---

## 🏗️ Architecture Overview

### Current System

```
User Request → Cloudflare Pages Function → OpenAI API → Response
                                           ↓
                                      D1 Database (storage)
```

**Issues**:
- ❌ No caching → duplicate API calls for similar content
- ❌ No rate limiting → potential abuse/cost overruns
- ❌ No semantic search → can't find related evidence
- ❌ No cross-framework intelligence

---

### Proposed System

```
User Request → Cloudflare Pages Function → AI Gateway → OpenAI API
                          ↓                    ↓
                          ↓              Cache (KV/Durable Objects)
                          ↓                    ↓
                    AI Search (R2) ←→ Evidence Library (D1)
```

**Benefits**:
- ✅ AI Gateway caches GPT responses (60-80% cache hit rate)
- ✅ Rate limiting prevents abuse (per-user + global limits)
- ✅ AI Search enables semantic evidence discovery
- ✅ Analytics dashboard tracks usage and costs
- ✅ Automatic fallback if AI Gateway unavailable

---

## 📦 Component Breakdown

### 1. AI Gateway

**Purpose**: Intelligent middleware for all GPT API calls

**Features We'll Use**:
- **Caching**: Cache GPT responses for identical/similar queries
- **Rate Limiting**: Per-user (20 req/min) + global (1000 req/hr)
- **Analytics**: Track token usage, costs, latency per endpoint
- **Logging**: Detailed request/response logs for debugging
- **Fallback**: Direct OpenAI if gateway unavailable

**Use Cases**:
- Content Intelligence URL analysis (high duplication potential)
- DIME/Starbursting generation (same URL → same questions)
- Entity extraction (same entities across analyses)
- Sentiment analysis (similar content patterns)

**Implementation Endpoints**:
```
/api/content-intelligence/analyze-url
/api/content-intelligence/dime-analyze
/api/content-intelligence/starbursting
/api/frameworks/pmesii-pt/import-url
/api/ai/scrape-url
```

---

### 2. AI Search

**Purpose**: Semantic search across evidence library and framework templates

**Features We'll Use**:
- **Semantic Similarity**: Find evidence by meaning, not keywords
- **Cross-Framework Search**: "Ukraine military 2024" finds PMESII-PT, DIME, ACH evidence
- **Template Library**: Search framework examples by topic
- **Smart Filtering**: By framework type, location, date, dimension

**Use Cases**:

1. **Evidence Discovery** (Primary)
   - User creating ACH analysis searches for "Russia economic sanctions 2024"
   - AI Search finds relevant PMESII-PT evidence, DIME analyses, saved articles
   - Returns: Evidence items, source URLs, confidence scores

2. **PMESII Evidence Library** (Phase 4 continuation)
   - Each PMESII-PT Q&A becomes searchable evidence
   - Tagged with: location, dimension, date, source
   - Searchable across all frameworks

3. **Framework Templates**
   - Search examples: "COG analysis China" → returns 3 COG analyses
   - Learn from past analyses
   - Copy structure and adapt

4. **Cross-Workspace Intelligence** (Future)
   - Search public library frameworks
   - Community-contributed evidence
   - Best practices and patterns

**Data Sources**:
- Framework analyses (JSON export to R2)
- Evidence library (exported to markdown)
- Content Intelligence summaries
- Framework templates and examples

---

## 🚀 Implementation Roadmap

### Phase 1: AI Gateway Setup (Week 1)

**Goal**: Integrate AI Gateway for cost savings and analytics

**Tasks**:

1. **Create AI Gateway** (30 min)
   ```bash
   # Cloudflare Dashboard
   AI → AI Gateway → Create
   Name: research-tools-ai
   Providers: OpenAI
   ```

2. **Update API Endpoints** (4 hours)
   - Modify all GPT-calling functions to use gateway
   - Add caching headers for duplicate queries
   - Implement fallback to direct OpenAI

3. **Add Rate Limiting** (2 hours)
   - Per-user: 20 requests/minute
   - Global: 1000 requests/hour
   - Store limits in KV namespace

4. **Deploy & Test** (1 hour)
   - Deploy to staging
   - Test cache hit rates
   - Verify fallback works
   - Monitor costs

**Files to Modify**:
- `functions/api/content-intelligence/analyze-url.ts`
- `functions/api/content-intelligence/dime-analyze.ts`
- `functions/api/content-intelligence/starbursting.ts`
- `functions/api/frameworks/pmesii-pt/import-url.ts`
- `functions/api/ai/scrape-url.ts`

**Expected Results**:
- 60-70% cache hit rate for Content Intelligence
- 40-50% cache hit rate for DIME/Starbursting
- API costs reduce by 50-60%

---

### Phase 2: Security Hardening (Week 2)

**Goal**: Implement comprehensive API security

**Tasks**:

1. **Rate Limiting** (3 hours)
   - Implement per-IP rate limiting
   - Add user-based limits (hash_id)
   - Configure sliding window algorithm
   - Return proper 429 responses with retry-after

2. **Input Sanitization** (2 hours)
   - Add XSS protection to all user inputs
   - Block injection attacks
   - Validate URL formats
   - Limit payload sizes

3. **CORS Hardening** (1 hour)
   - Restrict to researchtools.net domains
   - Add localhost for development
   - Block wildcard origins

4. **Security Headers** (30 min)
   - Add X-Content-Type-Options
   - Add X-Frame-Options
   - Add Content-Security-Policy

**Files to Create**:
- `functions/_middleware.ts` - Global security middleware
- `functions/api/_shared/security.ts` - Security utilities

**Expected Results**:
- No unauthorized API access
- Rate limit prevents abuse
- Input sanitization blocks attacks
- Security headers prevent common exploits

---

### Phase 3: AI Search - Evidence Library (Week 3)

**Goal**: Enable semantic search across all evidence

**Tasks**:

1. **Create AI Search Instance** (30 min)
   ```bash
   # Cloudflare Dashboard
   AI → AI Search → Create
   Name: research-tools-evidence
   Data Source: R2 bucket (research-evidence)
   ```

2. **Evidence Export System** (4 hours)
   - Export PMESII-PT Q&A to markdown
   - Export Content Intelligence summaries
   - Export framework analyses
   - Format: Structured markdown with metadata

3. **Knowledge Base Structure** (2 hours)
   ```
   evidence/
   ├── pmesii-pt/
   │   ├── political/
   │   │   └── ukraine_government_2024.md
   │   ├── military/
   │   └── economic/
   ├── dime/
   │   └── russia_sanctions_2024.md
   ├── content-intelligence/
   │   └── analyzed_articles/
   └── framework-templates/
       ├── cog-examples/
       └── ach-templates/
   ```

4. **Search API Endpoint** (3 hours)
   ```typescript
   // /api/evidence/search
   POST {
     query: "Ukraine military capabilities",
     filters: {
       framework_type: ["pmesii-pt", "dime"],
       location_country: "Ukraine",
       date_after: "2024-01-01"
     }
   }
   ```

5. **Upload & Index** (1 hour)
   - Upload evidence to R2
   - Wait for AI Search indexing (24-48 hrs)
   - Test in playground

**Files to Create**:
- `functions/api/evidence/search.ts`
- `functions/api/evidence/export.ts`
- `scripts/export-evidence-to-r2.ts`

**Expected Results**:
- Semantic search across 500+ evidence items
- Cross-framework evidence discovery
- 90%+ relevance for specific queries

---

### Phase 4: PMESII Evidence Integration (Week 4)

**Goal**: Complete PMESII-PT evidence library integration

**Tasks**:

1. **Evidence Tagging System** (3 hours)
   - Add evidence tags to PMESII Q&A items
   - Link to source URLs
   - Tag with dimension, location, date

2. **ACH Integration** (4 hours)
   - Search PMESII evidence from ACH page
   - One-click evidence import
   - Automatic source attribution

3. **Evidence Library Page** (5 hours)
   - New page: `/dashboard/evidence`
   - Search interface with filters
   - Evidence cards with metadata
   - Link to source frameworks

4. **Cross-Framework Search** (3 hours)
   - Search bar in all frameworks
   - "Find Related Evidence" button
   - Automatic suggestions based on content

**Expected Results**:
- Evidence reuse across frameworks
- Faster analysis creation
- Higher quality analyses with citations

---

## 💰 Cost Analysis

### Current Costs (Estimated)

```
OpenAI API:
- Content Intelligence: ~200 analyses/mo × $0.30 = $60/mo
- DIME: ~50 analyses/mo × $0.15 = $7.50/mo
- Starbursting: ~50 sessions/mo × $0.15 = $7.50/mo
- PMESII Import: ~30 imports/mo × $0.20 = $6/mo
Total: ~$81/mo
```

### With AI Gateway (Projected)

```
OpenAI API:
- Cache hit rate: 65%
- Actual API calls: 35% of current
- New cost: $81 × 0.35 = $28.35/mo

Cloudflare AI Gateway:
- Free tier: 10M requests/mo (we use ~5K/mo)
- Cost: $0/mo

Cloudflare AI Search:
- Indexed documents: 1,000-5,000
- Queries: ~500/mo
- Cost: ~$5/mo

Total: $28.35 + $5 = $33.35/mo
Savings: $81 - $33.35 = $47.65/mo (-59%)
```

**Annual Savings**: $571.80/year

---

## 📊 Success Metrics

### Week 1 (AI Gateway)
- ✅ AI Gateway handling 100% of GPT requests
- ✅ Cache hit rate > 50%
- ✅ No increase in error rates
- ✅ Response time improvement for cached queries

### Week 2 (Security)
- ✅ Rate limiting active and logging
- ✅ No unauthorized access attempts successful
- ✅ Security headers present on all responses
- ✅ Input sanitization blocking attacks

### Week 3 (AI Search)
- ✅ Evidence exported to R2 (500+ items)
- ✅ AI Search indexed and queryable
- ✅ Search relevance > 80%
- ✅ Search API endpoint functional

### Week 4 (PMESII Integration)
- ✅ Evidence tags on all PMESII Q&A
- ✅ ACH can search and import PMESII evidence
- ✅ Evidence library page functional
- ✅ Cross-framework search working

### Month 2 Goals
- ✅ Cache hit rate > 70%
- ✅ API costs reduced by 60%+
- ✅ Evidence reuse rate > 30%
- ✅ User satisfaction with search

---

## 🔧 Technical Implementation Details

### AI Gateway Integration Pattern

**Before** (Direct OpenAI):
```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [...]
  })
})
```

**After** (Via AI Gateway):
```typescript
const response = await fetch(
  `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/research-tools-ai/openai`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'cf-aig-cache-ttl': '3600',  // Cache for 1 hour
      'cf-aig-metadata': JSON.stringify({
        endpoint: 'content-intelligence',
        url: requestUrl,
        user: userId
      })
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [...]
    })
  }
)
```

**Benefits**:
- Automatic caching based on request similarity
- Analytics tracking (token usage, latency, costs)
- Rate limiting at gateway level
- Fallback to direct OpenAI if gateway down

---

### AI Search Query Pattern

```typescript
// Search PMESII evidence for ACH hypothesis
async function searchPMESIIEvidence(
  query: string,
  filters: {
    location_country?: string
    dimensions?: string[]
    date_after?: string
  }
) {
  const response = await env.AI_SEARCH.query({
    query,
    maxResults: 10,
    scoreThreshold: 0.75,
    filters: {
      framework_type: 'pmesii-pt',
      ...filters
    }
  })

  return response.results.map(result => ({
    text: result.content,
    dimension: result.metadata.dimension,
    location: result.metadata.location_country,
    source_url: result.metadata.source_url,
    confidence: result.score,
    framework_id: result.metadata.framework_id
  }))
}
```

---

## 🚨 Risk Mitigation

### Risk 1: AI Gateway Downtime

**Impact**: All GPT requests fail
**Mitigation**: Automatic fallback to direct OpenAI
**Recovery**: Immediate (fallback built-in)

```typescript
async function callGPTWithFallback(request) {
  try {
    return await callViaAIGateway(request)
  } catch (error) {
    console.warn('[AI Gateway] Failed, using direct OpenAI', error)
    return await callDirectOpenAI(request)
  }
}
```

---

### Risk 2: Cache Poisoning

**Impact**: Bad responses cached and served repeatedly
**Mitigation**: Cache TTL (1 hour), cache invalidation API
**Recovery**: Manual cache flush via dashboard

---

### Risk 3: AI Search Indexing Delays

**Impact**: New evidence not immediately searchable
**Mitigation**: Fallback to D1 keyword search
**Recovery**: 24-48 hours for indexing to complete

---

## 📋 Next Steps

### Immediate (This Week)
- [ ] Review this plan and approve
- [ ] Create Cloudflare AI Gateway instance
- [ ] Set up development environment variables
- [ ] Read Cloudflare AI Gateway documentation

### Week 1
- [ ] Implement AI Gateway integration
- [ ] Deploy to staging
- [ ] Test cache hit rates
- [ ] Monitor costs and performance

### Week 2
- [ ] Add security middleware
- [ ] Implement rate limiting
- [ ] Test security measures
- [ ] Deploy to production

### Week 3
- [ ] Create AI Search instance
- [ ] Export evidence to R2
- [ ] Wait for indexing
- [ ] Build search API endpoint

### Week 4
- [ ] Complete PMESII evidence integration
- [ ] Build evidence library page
- [ ] Test cross-framework search
- [ ] Optimize and fine-tune

---

## 📚 Resources

**Cloudflare Docs**:
- [AI Gateway Overview](https://developers.cloudflare.com/ai-gateway/)
- [AI Search Documentation](https://developers.cloudflare.com/ai-search/)
- [Rate Limiting Best Practices](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limiting/)

**Implementation References**:
- Muse & Co guides (imported templates)
- Current Research Tools codebase
- Cloudflare Workers examples

---

**Let's transform Research Tools with intelligent caching and semantic search!** 🚀🔍✨
