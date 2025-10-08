# Architecture Shift Documentation Index

**Project:** Content-First Intelligence Platform Architecture Redesign
**Date:** 2025-10-08
**Status:** Implementation Plan - Ready for Review

---

## Quick Start

**For Decision Makers:** Read [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) (10 min read)

**For Engineers:** Read [ARCHITECTURE_SHIFT_PLAN.md](./ARCHITECTURE_SHIFT_PLAN.md) (30 min read)

**For Product/UX:** Read [UX_FLOW_DIAGRAMS.md](./UX_FLOW_DIAGRAMS.md) (15 min read)

**For API Developers:** Read [API_SPECIFICATIONS.md](./API_SPECIFICATIONS.md) (20 min read)

---

## Document Overview

### 📊 EXECUTIVE_SUMMARY.md
**Audience:** Product Owners, Tech Leads, Business Stakeholders
**Length:** ~3,500 words (10 min)
**Purpose:** Business case, cost analysis, timeline, success metrics

**Key Sections:**
- The Problem (why this shift is needed)
- The Solution (5 major changes)
- Business Impact (acquisition, retention, efficiency)
- Cost Analysis (GPT API costs: $300/month)
- Technical Risks (with mitigations)
- Implementation Timeline (6-7 weeks)
- Success Metrics (conversion rates, performance KPIs)
- Recommendation (PROCEED with phased approach)

---

### 📐 ARCHITECTURE_SHIFT_PLAN.md
**Audience:** Backend Engineers, Database Administrators, AI/ML Engineers
**Length:** ~18,000 words (30 min)
**Purpose:** Comprehensive technical specification with SQL, logic, and risk analysis

**Key Sections:**
1. **Problem Statement** (constraints, non-goals)
2. **Local Context** (existing tables, gaps identified)
3. **Findings** (9 key findings with source citations)
4. **Recommendation** (database schema changes, UX flow, API architecture)
5. **Framework Auto-Population Logic** (PMESII-PT, DIME, COG, Causeway, etc.)
6. **Implementation Phases** (6 phases, 42-49 days total)
7. **Risk Analysis** (10 risks with likelihood, impact, mitigation)
8. **Next Steps** (11 actionable items with owners, deadlines)

**Deliverables:**
- Database DDL for 3 new migrations (025, 026, 027)
- Text-based UX flow diagram
- Framework auto-population prompts
- Risk matrix with mitigations
- Phase-by-phase task breakdown

---

### 🎨 UX_FLOW_DIAGRAMS.md
**Audience:** Frontend Engineers, UX Designers, Product Managers
**Length:** ~2,500 words (15 min)
**Purpose:** Visual user flows for 6 key scenarios

**Flows:**
1. **Non-Authenticated User - First Visit**
   - Landing page → URL analysis → Framework suggestions → Account prompt
2. **Non-Authenticated → Registration → Data Migration**
   - Registration → Workspace migration (5 analyses, 12 entities, 2 links)
3. **Authenticated User - Framework Creation**
   - URL analysis → Entity extraction → Auto-populated framework → Review/accept
4. **Content Usage Dashboard**
   - View content → See all frameworks/evidence/entities using it
5. **Entity Detail View - Reverse Lookup**
   - View actor → See all content mentioning actor (47 mentions across 3 sources)
6. **Content Update Alert - Stale Data Detection**
   - 90-day-old content → Re-analyze → Compare changes → Update framework

**Bonus:** Mobile responsive flow (condensed)

---

### 🔌 API_SPECIFICATIONS.md
**Audience:** Backend Engineers, Frontend Engineers, API Consumers
**Length:** ~7,000 words (20 min)
**Purpose:** Complete API contract with request/response examples

**Sections:**
1. **Authentication & Workspace Detection**
   - Workspace ID resolution (JWT token → user workspace OR bookmark hash → temp workspace)
   - Request/response headers
2. **Modified Endpoints**
   - `POST /api/content-intelligence/analyze-url` (add workspace_id, deduplication, entity storage)
3. **New Endpoints**
   - `GET /api/content-intelligence/framework-suggestions` (AI-generated suggestions)
   - `POST /api/frameworks/create-from-content` (auto-populate framework)
   - `POST /api/content-intelligence/extract-to-entities` (batch create actors/places/events)
   - `GET /api/content-intelligence/content-usage` (bidirectional links)
4. **Response Formats** (success, error, pagination)
5. **Error Handling** (error codes, retry logic, rate limiting)

**Deliverables:**
- JSON request/response examples
- Error code reference table
- Rate limit specifications
- TypeScript client retry logic example

---

## Database Migrations

### schema/migrations/025-content-workspace-isolation.sql
**Phase:** 1 (Foundation)
**Complexity:** MEDIUM
**Purpose:** Add workspace_id to content tables, enable multi-tenancy

**Changes:**
- `ALTER TABLE content_analysis ADD COLUMN workspace_id TEXT`
- `ALTER TABLE saved_links ADD COLUMN workspace_id TEXT`
- `ALTER TABLE content_analysis ADD COLUMN bookmark_hash TEXT`
- `ALTER TABLE content_analysis ADD COLUMN access_count INTEGER`
- Create indexes for performance
- Create trigger for access timestamp updates
- Migrate existing data to workspace '1'

**Size:** ~100 lines of SQL

---

### schema/migrations/026-content-entity-linking.sql
**Phase:** 1 (Foundation)
**Complexity:** MEDIUM
**Purpose:** Junction tables for content → entities and content → frameworks

**Changes:**
- `CREATE TABLE content_entities` (links content to actors/places/events)
- `CREATE TABLE framework_content_sources` (links frameworks to source content)
- `CREATE TABLE content_deduplication` (maps content hash to canonical record)
- `CREATE TABLE content_chunks` (stores large documents in chunks)
- `ALTER TABLE evidence_items ADD COLUMN source_content_id`
- Create indexes for all junction tables
- Create triggers for timestamp updates

**Size:** ~150 lines of SQL

---

### schema/migrations/027-framework-suggestions.sql
**Phase:** 3 (Framework Suggestions)
**Complexity:** HIGH
**Purpose:** AI-powered framework suggestion system

**Changes:**
- `CREATE TABLE content_framework_suggestions` (cached GPT suggestions)
- `CREATE TABLE suggestion_analytics` (track user behavior for prompt optimization)
- `CREATE TABLE suggestion_prompt_templates` (versioned prompts for A/B testing)
- Insert seed data: initial prompt template (v1.0)
- Create indexes for caching and analytics queries

**Size:** ~200 lines of SQL (includes seed data)

---

## Implementation Checklist

### Pre-Implementation (Before Phase 1)
- [ ] Review and approve EXECUTIVE_SUMMARY.md
- [ ] Allocate 4 engineers for 6-7 weeks
- [ ] Set up GPT API budget alerts ($300/month limit)
- [ ] Create staging environment for testing
- [ ] Set up database backup strategy (before migrations)

### Phase 1: Foundation (Week 1)
- [ ] Deploy migration 025 to staging
- [ ] Deploy migration 026 to staging
- [ ] Test workspace isolation (user A cannot see user B's content)
- [ ] Test content deduplication (same URL analyzed twice → cache hit)
- [ ] Test bookmark hash system (non-authenticated user workflow)
- [ ] Deploy to production (with rollback plan)

### Phase 2: Landing Page Integration (Week 2)
- [ ] Modify LandingPage.tsx (remove auth redirect, add URL input)
- [ ] Create content analysis preview component
- [ ] Add "Recent Analyses" sidebar (authenticated users)
- [ ] Add "Sign in to save" prompt (non-authenticated users)
- [ ] Test mobile responsiveness
- [ ] Deploy to production

### Phase 3: Framework Suggestions (Week 3)
- [ ] Deploy migration 027 to staging
- [ ] Create `/api/framework-suggestions` endpoint
- [ ] Implement GPT integration with prompt templates
- [ ] Add framework suggestion UI component
- [ ] Test suggestion accuracy (50 diverse articles)
- [ ] Monitor GPT API costs (should be <$2/day for 100 analyses)
- [ ] Deploy to production

### Phase 4: Auto-Population (Week 4-5)
- [ ] Create `/api/frameworks/create-from-content` endpoint
- [ ] Implement PMESII-PT auto-population logic
- [ ] Implement DIME auto-population logic
- [ ] Implement COG auto-population logic
- [ ] Implement Starbursting auto-population logic
- [ ] Create auto-population review UI (accept/reject/edit)
- [ ] Test auto-population accuracy (manual review of 20 test cases)
- [ ] Monitor GPT API costs (should be <$5/day for 50 auto-populations)
- [ ] Deploy to production

### Phase 5: Bidirectional Linking (Week 6)
- [ ] Add evidence-to-content links
- [ ] Create content usage dashboard
- [ ] Add content citations to framework exports (PDF, Excel)
- [ ] Implement content versioning/staleness alerts
- [ ] Test bidirectional navigation (content → frameworks → content)
- [ ] Deploy to production

### Phase 6: Entity Extraction Automation (Week 7)
- [ ] Create `/api/extract-to-entities` endpoint
- [ ] Implement batch entity creation (actors, places, events)
- [ ] Implement smart entity merging (detect duplicates)
- [ ] Add entity detail view with reverse content lookup
- [ ] Test entity deduplication (same actor mentioned in 3 sources)
- [ ] Deploy to production

---

## Success Criteria

### Phase 1 (Foundation) - Go/No-Go Decision Point
**MUST ACHIEVE:**
- ✅ Workspace isolation working (users cannot see each other's content)
- ✅ Content deduplication achieving >30% cache hit rate
- ✅ Bookmark hash system working (non-authenticated users can analyze URLs)
- ✅ Database migrations complete with zero data loss

**IF FAILED:** Pause project, reassess approach

---

### Phase 3 (Framework Suggestions) - Value Validation
**MUST ACHIEVE:**
- ✅ Framework suggestions have >70% accuracy (user clicks top 3 suggestions)
- ✅ GPT API costs <$2/day (within budget)
- ✅ Suggestion generation completes in <5 seconds

**IF FAILED:** Consider simpler rule-based suggestions instead of GPT

---

### Phase 4 (Auto-Population) - Core Value Proposition
**MUST ACHIEVE:**
- ✅ Auto-population acceptance rate >60% (users accept AI-generated fields)
- ✅ Time to create framework reduced from ~30 min to <5 min
- ✅ GPT API costs <$5/day (within budget)
- ✅ No hallucinations in critical fields (manual QA review)

**IF FAILED:** Make auto-population opt-in instead of default

---

## Monitoring & Alerts

### Database Monitoring
- **Alert:** Database size >1.5GB (75% of 2GB limit)
- **Action:** Implement aggressive cache eviction, archive old content

### API Cost Monitoring
- **Alert:** GPT API costs >$10/day ($300/month threshold)
- **Action:** Review caching strategy, reduce auto-population frequency

### Performance Monitoring
- **Alert:** Content analysis endpoint >10 sec response time
- **Action:** Optimize database queries, implement streaming extraction

### Error Rate Monitoring
- **Alert:** Content extraction failure rate >20%
- **Action:** Improve timeout handling, add more bypass URLs

---

## Rollback Plan

### Phase 1 Rollback (if migrations fail)
1. Restore database from backup (pre-migration snapshot)
2. Revert code changes (git revert)
3. Redeploy previous version
4. Investigate migration failure, fix, retry

### Phase 3 Rollback (if GPT costs explode)
1. Disable framework suggestion feature (feature flag)
2. Clear suggestion cache (reduce GPT calls)
3. Implement aggressive rate limiting (max 10 suggestions/user/day)
4. Review prompt efficiency, reduce token usage

### Phase 4 Rollback (if auto-population accuracy is poor)
1. Disable auto-population by default (make opt-in)
2. Add warning: "AI-generated content may be inaccurate"
3. Increase confidence threshold (reject suggestions <70% confidence)
4. Review prompt templates, improve accuracy

---

## Frequently Asked Questions

### Q: Why not just keep Content Intelligence as a tool?
**A:** The current architecture creates unnecessary friction. Users must navigate through 5 pages to analyze a URL, when URL analysis should be the *first* action, not the fifth. Making content the entry point aligns with user intent: "I have a source, help me analyze it."

### Q: What if GPT costs exceed budget?
**A:** We have multiple mitigation strategies:
1. Aggressive caching (40% cache hit rate → 40% cost reduction)
2. Make auto-population opt-in (users request it, not automatic)
3. Use GPT-5-nano for simpler tasks (4x cheaper)
4. Implement daily user quotas (free tier: 5 auto-populations/day)

### Q: What happens to existing framework sessions?
**A:** Zero impact. Existing frameworks remain unchanged. New features are additive:
- Old frameworks: manual entry (current workflow)
- New frameworks: option to auto-populate from content (new workflow)

### Q: How does bookmark hash authentication work?
**A:**
1. Non-authenticated user visits landing page
2. System generates SHA-256 hash, stores in localStorage
3. User analyzes URL → content saved to `workspace_id = 'temp_<hash>'`
4. User can return later (bookmark hash persists for 30 days)
5. Upon registration → all temp workspace data migrated to user's personal workspace

### Q: What if the same article is analyzed by 100 different users?
**A:** Content deduplication handles this:
1. First user analyzes URL → content stored, hash calculated
2. Second user analyzes same URL → hash matches, return cached content
3. Database stores content once, but links to multiple workspaces
4. Storage: 1 content record, 100 workspace links (minimal overhead)

### Q: How accurate is auto-population?
**A:** Expected accuracy:
- PMESII-PT: 70-85% (8 categories, some easier than others)
- DIME: 75-90% (4 categories, well-defined)
- COG: 65-80% (requires inference, harder for AI)
- Starbursting: 80-95% (factual extraction, easier for AI)

**Mitigation:** All auto-populated fields marked as "review required", users must accept/edit before saving.

### Q: What if framework suggestions are wrong?
**A:** We track suggestion quality via `suggestion_analytics` table:
- User clicks suggestion → `action_type = 'clicked'`
- User creates framework → `action_type = 'created'`
- User ignores suggestions → `action_type = 'ignored'`

Analytics feed back into prompt optimization:
- If PMESII-PT suggestions have <50% acceptance → revise prompt
- If users consistently pick suggestion #3 instead of #1 → adjust ranking algorithm

---

## Contact & Ownership

**Technical Lead:** [Assign Backend Engineer]
**Product Owner:** [Assign Product Manager]
**QA Lead:** [Assign QA Engineer]
**AI/ML Lead:** [Assign AI Engineer]

**Questions?** Create an issue in the repository or contact technical lead.

---

**Last Updated:** 2025-10-08
**Document Version:** 1.0
**Status:** Ready for Review
