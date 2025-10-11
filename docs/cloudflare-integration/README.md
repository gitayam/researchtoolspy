# Cloudflare AI Integration Documentation

This directory contains documentation for integrating Cloudflare AI Gateway and AI Search into the Research Tools platform.

## 📚 Documents

### Primary Implementation Plan

**CLOUDFLARE_AI_INTEGRATION_PLAN.md** ⭐ **START HERE**
- Comprehensive integration plan adapted for Research Tools
- 4-week phased implementation roadmap
- Cost analysis and expected ROI
- Technical implementation details
- Risk mitigation strategies

---

### Reference Guides (From Muse & Co Project)

These guides provide foundational concepts and patterns, adapted from a successful AI integration project:

1. **API_SECURITY_GUIDE.md**
   - Rate limiting best practices
   - CORS configuration
   - Input sanitization
   - Security headers
   - API key management
   - Incident response procedures

2. **AI_SEARCH_COMPLETE_GUIDE.md**
   - AI Search overview and architecture
   - Knowledge base structure
   - Deployment procedures
   - Success metrics
   - Common pitfalls

3. **AI_SEARCH_DEPLOYMENT_GUIDE.md**
   - Step-by-step deployment guide
   - Testing procedures
   - Troubleshooting
   - Rollback procedures
   - Monitoring guidelines

**Note**: These guides reference "Muse & Co" and "BaristaBot" - concepts are portable, specific implementations need adaptation for Research Tools.

---

## 🎯 Integration Goals

### AI Gateway Benefits

1. **Cost Reduction**: -60% to -70% GPT API costs through intelligent caching
2. **Rate Limiting**: Prevent abuse and cost overruns
3. **Analytics**: Track usage, costs, and performance per endpoint
4. **Resilience**: Automatic fallback to direct OpenAI if gateway down

### AI Search Benefits

1. **Evidence Discovery**: Semantic search across all saved analyses
2. **Cross-Framework Intelligence**: Connect PMESII evidence to ACH hypotheses
3. **Template Library**: Search framework examples by topic/location
4. **Smart Filtering**: By framework type, location, date, dimension

---

## 📅 Implementation Timeline

### Phase 1: AI Gateway (Week 1)
- Set up AI Gateway instance
- Integrate with all GPT-calling endpoints
- Implement caching strategy
- Add rate limiting

**Files Affected**:
- `functions/api/content-intelligence/analyze-url.ts`
- `functions/api/content-intelligence/dime-analyze.ts`
- `functions/api/content-intelligence/starbursting.ts`
- `functions/api/frameworks/pmesii-pt/import-url.ts`
- `functions/api/ai/scrape-url.ts`

---

### Phase 2: Security Hardening (Week 2)
- Implement comprehensive rate limiting
- Add input sanitization
- CORS hardening
- Security headers

**Files to Create**:
- `functions/_middleware.ts`
- `functions/api/_shared/security.ts`

---

### Phase 3: AI Search - Evidence Library (Week 3)
- Create AI Search instance
- Export evidence to R2 bucket
- Build search API endpoint
- Wait for indexing (24-48 hours)

**Data Sources**:
- PMESII-PT Q&A items (tagged with dimension + location)
- Content Intelligence summaries
- Framework analyses (COG, DIME, ACH, etc.)
- Evidence library items

---

### Phase 4: PMESII Evidence Integration (Week 4)
- Complete evidence tagging
- ACH integration with PMESII search
- Evidence library UI page
- Cross-framework search

**New Features**:
- `/dashboard/evidence` page
- "Find Related Evidence" button in all frameworks
- One-click evidence import into ACH
- Automatic source attribution

---

## 💰 Cost Projection

### Current Costs
- OpenAI API: ~$81/month
- Cloudflare: $0/month

**Total**: $81/month

### After Integration
- OpenAI API: ~$28/month (-65% via caching)
- Cloudflare AI Gateway: $0/month (free tier)
- Cloudflare AI Search: ~$5/month

**Total**: $33/month
**Savings**: $48/month ($576/year)

---

## 🔗 Related Documentation

- [ROADMAP.md](/ROADMAP.md) - Platform development roadmap
- [Cloudflare AI Gateway Docs](https://developers.cloudflare.com/ai-gateway/)
- [Cloudflare AI Search Docs](https://developers.cloudflare.com/ai-search/)

---

## 📞 Questions?

For implementation questions or clarification, refer to:
1. **CLOUDFLARE_AI_INTEGRATION_PLAN.md** (this project's specific plan)
2. Reference guides in this directory (general concepts)
3. Cloudflare official documentation (API reference)

---

**Status**: 📋 Planning complete, ready for Phase 1 implementation
