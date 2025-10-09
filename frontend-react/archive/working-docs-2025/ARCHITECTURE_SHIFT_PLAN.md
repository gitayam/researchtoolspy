# Architecture Shift Plan: Content-First Intelligence Platform

**Document Version:** 1.0
**Date:** 2025-10-08
**Author:** Technical Research & Due Diligence Analysis

---

## Problem

The application currently treats Content Intelligence as a buried tool rather than the foundational entry point for intelligence analysis. Users must navigate deep into the dashboard to access URL analysis, creating friction in the most common workflow: analyzing external sources. The required architectural shift inverts this hierarchy to make content the foundation upon which all framework analysis builds.

**Current Hierarchy:** `Framework >> Content (optional)`
**Required Hierarchy:** `Content >> Evidence >> Entities >> Framework`

**Constraints:**
- Must preserve existing framework functionality
- Must support non-authenticated users (bookmark hash system)
- Must work with Cloudflare D1 (SQLite) database limits
- Must maintain workspace isolation for authenticated users
- Cannot break existing saved framework sessions

**Non-Goals:**
- Complete authentication system rewrite
- Migration of historical data (acceptable data loss for beta)
- Real-time collaborative editing (future enhancement)

---

## Local Context

### Repository Structure
- **Frontend:** React + TypeScript (src/)
- **Backend:** Cloudflare Pages Functions (functions/api/)
- **Database:** Cloudflare D1 (SQLite), migrations in schema/migrations/
- **Current Tool Location:** `/dashboard/tools/content-intelligence`
- **Landing Page:** `/src/pages/LandingPage.tsx` (authentication check redirects to dashboard)

### Existing Tables (Relevant)

**Content Intelligence (Migration 014):**
```sql
saved_links (id, user_id, url, title, note, tags, is_processed, analysis_id)
content_analysis (id, user_id, url, extracted_text, summary, entities JSON, word_frequency JSON)
content_qa (id, content_analysis_id, question, answer, source_excerpts JSON)
starbursting_sources (session_id FK, content_analysis_id FK)
```

**Entity System (Migration 005):**
```sql
workspaces (id, name, type, owner_id, is_public)
actors (id, name, type, workspace_id, deception_profile JSON)
sources (id, name, type, workspace_id, moses_assessment JSON)
events (id, name, event_type, workspace_id, location_id)
places (id, name, coordinates JSON, workspace_id)
behaviors (id, name, behavior_type, workspace_id)
relationships (source_entity_id, target_entity_id, relationship_type)
```

**Evidence System (Migration 002):**
```sql
evidence_items (id, title, description, who_involved, what_happened, when_occurred,
  where_occurred, why_significant, how_obtained, credibility, reliability, workspace_id)
```

**Framework System (Migration 021):**
```sql
framework_sessions (id, framework_type, title, data JSON, workspace_id, source_url,
  published_to_library, fork_parent_id)
```

**Key Gaps Identified:**
1. No `content_id` FK in `evidence_items` or `framework_sessions`
2. No `content_to_entity` junction table
3. No `framework_content_sources` tracking table
4. `content_analysis` lacks `workspace_id` (violates isolation model)
5. No content deduplication mechanism
6. No framework auto-population metadata storage

---

## Findings (Cited)

### 1. Current Content Analysis Flow is Isolated

The `analyze-url.ts` endpoint extracts content, performs word analysis, and entity extraction via GPT, but stores results in `content_analysis` without linking to the broader evidence/entity system. Entities are stored as JSON blobs, not as foreign keys to the `actors` table [S1].

**Citation Impact:** Framework sessions can reference `source_url` (text field), but cannot query "all frameworks using content from domain X" or "all evidence citing URL Y" [S2].

### 2. Landing Page Currently Redirects Authenticated Users

The `LandingPage.tsx` component checks authentication status and redirects authenticated users directly to `/dashboard`, preventing them from using the landing page as a workflow entry point [S3]. This conflicts with the requirement to make URL input the primary interaction point.

### 3. Workspace Isolation Incomplete for Content

Migration 021 added `workspace_id` to `framework_sessions` and `ach_analyses`, but **not** to `content_analysis` or `saved_links`. This creates a data leakage risk where content analyzed in one workspace could be visible to another [S4].

### 4. Entity Extraction Stores JSON, Not Relational Links

The `ContentIntelligencePage.tsx` component can extract entities (people, orgs, locations) and "save to evidence" via the `/api/actors` endpoint, but this is a one-way export. There's no `content_to_entity` junction table tracking which entities came from which content [S5].

### 5. Framework Auto-Population Logic Doesn't Exist

While frameworks have fields like `source_url`, there's no systematic way to:
- Parse content and suggest applicable frameworks
- Pre-populate framework fields from content metadata
- Track which content sections map to which framework fields [S6]

### 6. D1 Database Size Limits Apply

Cloudflare D1 has a 2GB database size limit (as of 2024). Storing full HTML/markdown for every URL will consume space quickly. Average web page size: 2-5MB (including images, but we store text-only). Estimated capacity: ~400,000 pages of text-only content at 5KB average [S7].

**Recommendation:** Store only extracted text (markdown), not raw HTML. Implement content hash deduplication. Provide optional "archive mode" for critical content.

### 7. Non-Authenticated Users Need Bookmark Hash Support

The application uses a bookmark hash system for non-authenticated users (implicit from workspace isolation requirements). Content analyzed by non-authenticated users must be tied to their bookmark hash, then migrated to a real workspace upon registration [S8].

### 8. Starbursting Framework Already Links to Content

Migration 014 includes `starbursting_sources` junction table linking `session_id` to `content_analysis_id`. This pattern should be replicated for all frameworks [S9].

---

## Recommendation

### Database Schema Changes (Priority: HIGH)

**1. Add Workspace Isolation to Content Tables**
```sql
ALTER TABLE content_analysis ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '1';
ALTER TABLE saved_links ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '1';
CREATE INDEX idx_content_analysis_workspace ON content_analysis(workspace_id);
CREATE INDEX idx_saved_links_workspace ON saved_links(workspace_id);
```

**2. Create Content-to-Entity Junction Tables**
```sql
CREATE TABLE content_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_analysis_id INTEGER NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'ACTOR', 'PLACE', 'EVENT', etc.
  extraction_method TEXT, -- 'gpt', 'manual', 'regex'
  confidence REAL, -- 0.0-1.0
  mention_count INTEGER DEFAULT 1,
  first_mention_context TEXT, -- Sentence where entity first appears
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,
  UNIQUE(content_analysis_id, entity_id, entity_type)
);
CREATE INDEX idx_content_entities_content ON content_entities(content_analysis_id);
CREATE INDEX idx_content_entities_entity ON content_entities(entity_id, entity_type);
```

**3. Create Framework-to-Content Junction Table**
```sql
CREATE TABLE framework_content_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_session_id INTEGER NOT NULL,
  content_analysis_id INTEGER NOT NULL,

  -- Field mapping (which content populated which framework field)
  field_mappings TEXT, -- JSON: {"pmesii.political": ["para_3", "para_7"], "pmesii.military": ["para_12"]}

  -- Auto-population metadata
  auto_populated BOOLEAN DEFAULT FALSE,
  auto_population_confidence REAL, -- 0.0-1.0
  user_reviewed BOOLEAN DEFAULT FALSE,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (framework_session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,
  UNIQUE(framework_session_id, content_analysis_id)
);
CREATE INDEX idx_framework_content_framework ON framework_content_sources(framework_session_id);
CREATE INDEX idx_framework_content_content ON framework_content_sources(content_analysis_id);
```

**4. Create Content Deduplication Table**
```sql
CREATE TABLE content_deduplication (
  content_hash TEXT PRIMARY KEY,
  canonical_content_id INTEGER NOT NULL,
  duplicate_count INTEGER DEFAULT 1,
  first_analyzed_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,

  FOREIGN KEY (canonical_content_id) REFERENCES content_analysis(id) ON DELETE CASCADE
);
CREATE INDEX idx_content_dedup_canonical ON content_deduplication(canonical_content_id);
```

**5. Create Evidence-to-Content Links**
```sql
ALTER TABLE evidence_items ADD COLUMN source_content_id INTEGER;
ALTER TABLE evidence_items ADD COLUMN source_paragraph INTEGER; -- Which paragraph in content
CREATE INDEX idx_evidence_source_content ON evidence_items(source_content_id);
```

**6. Create Framework Suggestion Cache**
```sql
CREATE TABLE content_framework_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_analysis_id INTEGER NOT NULL,

  -- Suggested frameworks (ordered by relevance)
  suggested_frameworks TEXT NOT NULL, -- JSON: [{"type": "pmesii-pt", "confidence": 0.92, "reason": "..."}, ...]

  -- Analysis metadata
  analysis_model TEXT, -- gpt-5-mini, gpt-5-nano
  analysis_prompt_version TEXT, -- Track prompt changes
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,
  UNIQUE(content_analysis_id)
);
CREATE INDEX idx_framework_suggestions_content ON content_framework_suggestions(content_analysis_id);
```

### UX Flow Changes (Priority: HIGH)

**Text-Based Flow Diagram:**
```
[Landing Page - Non-Authenticated]
         |
         | Enter URL + (optional) workspace/auth
         v
   [Content Analysis View]
    - Real-time extraction progress
    - Show summary, entities, word analysis
    - Security check (VirusTotal)
    - Country origin detection
         |
         +---> [Save for Later] --> saved_links table
         |
         +---> [Extract Entities] --> Create actors/places/events in workspace
         |
         +---> [Create Evidence] --> evidence_items with source_content_id
         |
         +---> [Suggested Frameworks] (AI-generated)
                - PMESII-PT (confidence: 0.92)
                - DIME (confidence: 0.78)
                - COG (confidence: 0.65)
                |
                | User clicks "Use PMESII-PT"
                v
         [Framework Session Created]
          - Pre-populated fields from content
          - Content linked via framework_content_sources
          - User reviews/edits auto-populated data
                |
                v
         [Framework Analysis Complete]
          - Export to PDF/Excel
          - Publish to library
          - Share via public link
```

**Authentication Integration:**
- Non-authenticated users: Use temporary `workspace_id = 'temp_<bookmark_hash>'`
- Upon registration: Migrate all temp workspace data to user's personal workspace
- Bookmark hash stored in localStorage, passed as query param or header

**Landing Page Modifications:**
1. Remove authentication redirect (allow authenticated users to use landing page)
2. Add prominent URL input field (hero section)
3. Add "Quick Analyze" button (starts analysis immediately, no account required)
4. Show recent analyses in sidebar (if authenticated)
5. Add "Sign In to Save" prompt (if non-authenticated)

### API Architecture Changes (Priority: MEDIUM)

**Modified Endpoints:**

1. **POST /api/content-intelligence/analyze-url** (existing - modify)
   - Add `workspace_id` parameter (derived from auth or bookmark hash)
   - Check for duplicate content via `content_hash`
   - If duplicate exists: return cached analysis, increment access count
   - Store entities in `content_entities` table (not just JSON)
   - Trigger framework suggestion analysis (async)

2. **GET /api/content-intelligence/framework-suggestions** (new)
   - Input: `content_analysis_id`
   - Output: `[{framework_type, confidence, reasoning, sample_population}]`
   - Uses GPT-5-mini to analyze content and suggest frameworks

3. **POST /api/frameworks/create-from-content** (new)
   - Input: `content_analysis_id`, `framework_type`, `workspace_id`
   - Output: `framework_session_id`
   - Auto-populates framework fields from content
   - Creates `framework_content_sources` link
   - Returns partially filled framework for user review

4. **POST /api/content-intelligence/extract-to-entities** (new)
   - Input: `content_analysis_id`, `entity_types[]` (actor, place, event)
   - Output: Created entity IDs
   - Batch creates entities in workspace
   - Links via `content_entities` table

5. **GET /api/content-intelligence/content-usage** (new)
   - Input: `content_analysis_id`
   - Output: `{frameworks: [], evidence: [], entities: []}`
   - Shows all downstream usage of content

**Large Content Handling:**
- Cloudflare Workers have 128MB memory limit
- Pages Functions have 10-second execution timeout
- Strategy: Stream content extraction, chunk processing for large documents
- For documents >500KB, store in chunks with `content_chunks` table:
  ```sql
  CREATE TABLE content_chunks (
    id INTEGER PRIMARY KEY,
    content_analysis_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_hash TEXT NOT NULL,
    UNIQUE(content_analysis_id, chunk_index)
  );
  ```

### Framework Auto-Population Logic (Priority: MEDIUM)

**PMESII-PT Framework:**
```typescript
interface PMESIIPTAutoPopulation {
  political: {
    keywords: ['government', 'election', 'policy', 'law', 'regulation', 'diplomatic'],
    extraction: 'Find paragraphs mentioning political actors, governance structures, or policy decisions'
  },
  military: {
    keywords: ['military', 'defense', 'army', 'navy', 'forces', 'troops', 'weapons'],
    extraction: 'Extract military capabilities, force structures, equipment mentions'
  },
  economic: {
    keywords: ['economic', 'trade', 'market', 'GDP', 'inflation', 'sanctions', 'investment'],
    extraction: 'Identify economic indicators, trade relationships, financial systems'
  },
  social: {
    keywords: ['population', 'demographics', 'culture', 'education', 'health', 'religion'],
    extraction: 'Extract social structures, cultural norms, population characteristics'
  },
  infrastructure: {
    keywords: ['infrastructure', 'roads', 'ports', 'airports', 'utilities', 'telecommunications'],
    extraction: 'Identify critical infrastructure, transportation networks, utilities'
  },
  information: {
    keywords: ['media', 'propaganda', 'communications', 'internet', 'social media', 'messaging'],
    extraction: 'Extract information operations, media landscape, communication patterns'
  },
  physical_environment: {
    keywords: ['terrain', 'climate', 'geography', 'weather', 'natural resources'],
    extraction: 'Identify geographic features, climate factors, environmental constraints'
  },
  time: {
    keywords: ['timeline', 'schedule', 'deadline', 'phase', 'period'],
    extraction: 'Extract temporal information, event sequences, time-based constraints'
  }
}

// GPT Prompt Template:
const prompt = `Analyze the following content and extract information for PMESII-PT framework.
For each category (Political, Military, Economic, Social, Infrastructure, Information, Physical Environment, Time),
identify relevant passages and provide:
1. Key findings (bullet points)
2. Source paragraph numbers
3. Confidence score (0-1)
4. Missing information gaps

Content:
${content}

Return JSON with structure:
{
  "political": {"findings": [...], "paragraphs": [3,7,12], "confidence": 0.85, "gaps": [...]},
  ...
}`
```

**DIME Framework:**
```typescript
interface DIMEAutoPopulation {
  diplomatic: 'Extract mentions of diplomatic relations, alliances, treaties, negotiations',
  information: 'Identify information operations, narrative warfare, propaganda themes',
  military: 'Extract military actions, force posture, capabilities, operations',
  economic: 'Identify economic leverage, sanctions, trade policies, financial warfare'
}
```

**COG (Center of Gravity):**
```typescript
interface COGAutoPopulation {
  critical_capabilities: 'What can the actor DO? Extract verbs and capabilities',
  critical_requirements: 'What does the actor NEED? Resources, support, infrastructure',
  critical_vulnerabilities: 'What are the WEAKNESSES? Dependencies, single points of failure'
}
```

**Causeway Network Analysis:**
```typescript
interface CausewayAutoPopulation {
  strategy: 'Extract entities and relationships automatically',
  nodes: 'Auto-create actor nodes from extracted entities',
  edges: 'Infer relationships based on co-occurrence and context',
  confidence: 'Rate each relationship on confidence (mentions, context, explicit statements)'
}
```

**Deception Detection:**
```typescript
interface DeceptionAutoPopulation {
  indicators: [
    'Contradiction detection (internal vs external sources)',
    'Timeline inconsistencies',
    'Known deception patterns (MOM-POP)',
    'Source reliability assessment (MOSES)'
  ],
  red_flags: 'Auto-flag suspicious claims requiring verification'
}
```

**Starbursting Questions:**
```typescript
interface StarburstingAutoPopulation {
  who: 'Extract all actors, persons, organizations mentioned',
  what: 'Identify key events, actions, objects, topics',
  when: 'Extract temporal information, dates, timelines',
  where: 'Extract locations, geography, spatial information',
  why: 'Infer motivations, causes, rationale from context',
  how: 'Extract methods, processes, mechanisms described'
}
```

**Implementation Strategy:**
- Use GPT-5-mini for speed/cost balance (fallback to gpt-4o-mini if GPT-5 unavailable)
- Set `verbosity: 'low'` for concise responses
- Set `reasoning_effort: 'default'` (not 'high' to save processing time)
- Cache auto-population results in `framework_content_sources.field_mappings`
- Allow user to accept/reject/edit each auto-populated field

---

## Implementation Phases

### Phase 1: Foundation (Week 1) - Database & Core APIs
**Goal:** Establish persistent content storage with workspace isolation

**Complexity:** MEDIUM (5-8 days)

**Tasks:**
1. Create migration 025: Add workspace_id to content tables
   - `ALTER TABLE content_analysis ADD COLUMN workspace_id`
   - `ALTER TABLE saved_links ADD COLUMN workspace_id`
   - Migrate existing data to default workspace

2. Create migration 026: Content-to-entity junction tables
   - `content_entities` table
   - `framework_content_sources` table
   - `content_deduplication` table

3. Modify `/api/content-intelligence/analyze-url`
   - Add workspace_id detection (auth token or bookmark hash)
   - Implement content hash deduplication
   - Store entities in `content_entities` (not just JSON)

4. Create `/api/content-intelligence/content-usage` endpoint
   - Query frameworks, evidence, entities using content

5. Add bookmark hash middleware
   - Generate persistent bookmark hash for non-authenticated users
   - Store in localStorage
   - Accept via `X-Bookmark-Hash` header

**Testing:**
- Non-authenticated user analyzes URL, gets bookmark hash
- Authenticated user analyzes same URL in different workspace
- Verify workspace isolation (user A cannot see user B's content)
- Verify deduplication (same URL analyzed twice returns cached result)

**Migration Path:**
- Existing content_analysis rows: set workspace_id = '1' (default workspace)
- No data loss acceptable (beta phase)

---

### Phase 2: Landing Page Integration (Week 2) - UX Shift
**Goal:** Make URL input the primary entry point

**Complexity:** LOW (3-5 days)

**Tasks:**
1. Modify `LandingPage.tsx`
   - Remove authentication redirect
   - Add hero section with URL input field
   - Add "Quick Analyze" button (no login required)
   - Show authentication prompt for "Save to Workspace"

2. Create content analysis preview component
   - Show summary, entity count, word count
   - Inline framework suggestions (coming in Phase 3)

3. Add "Recent Analyses" sidebar
   - Show last 5 analyses (if authenticated)
   - Show "Sign in to save" prompt (if not authenticated)

4. Update navigation
   - Add "Analyze Content" link in header
   - Make landing page always accessible (even when authenticated)

**Testing:**
- Non-authenticated user: Enter URL on landing page → See analysis → See "Sign in to save" prompt
- Authenticated user: Enter URL → Analysis auto-saves to workspace
- Mobile responsiveness check

**Migration Path:**
- No database changes
- Frontend-only changes

---

### Phase 3: Framework Suggestions (Week 3) - AI Integration
**Goal:** Auto-suggest frameworks based on content analysis

**Complexity:** HIGH (6-9 days)

**Tasks:**
1. Create migration 027: Framework suggestion cache
   - `content_framework_suggestions` table

2. Create `/api/content-intelligence/framework-suggestions` endpoint
   - Analyze content with GPT-5-mini
   - Prompt: "Which analysis frameworks are most applicable?"
   - Return: `[{type, confidence, reasoning}]`
   - Cache results in database

3. Add framework suggestion UI to ContentIntelligencePage
   - Show top 3 suggested frameworks
   - Display confidence scores
   - "Use This Framework" button → creates session

4. Create prompt templates for each framework type
   - PMESII-PT keyword analysis
   - DIME applicability check
   - COG relevance scoring
   - Starbursting question generation

5. Implement suggestion caching
   - Check cache before calling GPT
   - Invalidate cache if content updated

**Testing:**
- Military article → Suggests PMESII-PT, DIME, COG
- Business article → Suggests SWOT, PEST, VRIO
- Deception indicators → Suggests Deception, ACH
- Social media analysis → Suggests Behavior, Network Analysis

**Migration Path:**
- New table, no existing data impact
- Gradual rollout: suggestion feature optional

---

### Phase 4: Framework Auto-Population (Week 4-5) - Smart Frameworks
**Goal:** Pre-populate framework fields from content

**Complexity:** VERY HIGH (10-14 days)

**Tasks:**
1. Create `/api/frameworks/create-from-content` endpoint
   - Input: content_analysis_id, framework_type
   - Call GPT with framework-specific prompt
   - Parse GPT response into framework data structure
   - Create framework_session with auto-populated data
   - Mark fields as "AI-generated" (require user review)

2. Implement PMESII-PT auto-population
   - Extract Political: governance, policy, law mentions
   - Extract Military: forces, capabilities, operations
   - Extract Economic: trade, markets, sanctions
   - Extract Social: demographics, culture, health
   - Extract Infrastructure: roads, utilities, communications
   - Extract Information: media, propaganda, messaging
   - Extract Physical Environment: terrain, climate
   - Extract Time: timelines, phases, deadlines

3. Implement DIME auto-population
   - Diplomatic: relations, treaties, alliances
   - Information: narratives, propaganda, messaging
   - Military: operations, capabilities, posture
   - Economic: leverage, sanctions, trade

4. Implement COG auto-population
   - Critical Capabilities: "what can they DO?"
   - Critical Requirements: "what do they NEED?"
   - Critical Vulnerabilities: "where are they WEAK?"

5. Implement Starbursting auto-population
   - Who: Extract actors automatically
   - What: Identify key topics/events
   - When: Extract temporal data
   - Where: Extract locations
   - Why: Infer motivations
   - How: Extract methods

6. Create auto-population review UI
   - Highlight AI-generated fields in yellow
   - Show confidence scores per field
   - Allow user to accept/reject/edit each field
   - Track user edits for prompt improvement

**Testing:**
- Russian military article → Auto-populate PMESII-PT with Kremlin, Russian forces, oil economy
- Business strategy article → Auto-populate SWOT with strengths/weaknesses
- Deception article → Auto-populate MOM-POP indicators
- Verify field accuracy (manual review of 20 test cases)

**Migration Path:**
- Existing framework sessions: no changes (manual data preserved)
- New sessions: offer auto-population option
- User always reviews/approves auto-populated data

---

### Phase 5: Bidirectional Linking (Week 6) - Content Traceability
**Goal:** Track content usage across frameworks and evidence

**Complexity:** MEDIUM (5-7 days)

**Tasks:**
1. Add evidence-to-content links
   - Modify evidence creation flow
   - Add "Source Content" field (select from analyzed content)
   - Store `source_content_id` and `source_paragraph` in evidence_items

2. Create content usage dashboard
   - Show all frameworks using specific content
   - Show all evidence citing specific content
   - Show all entities extracted from specific content
   - Add "Content Provenance" view

3. Add content citations to framework exports
   - PDF export: Include "Sources" section with URLs
   - Excel export: Add "Source URLs" column
   - Track which content informed which framework fields

4. Implement content versioning
   - Track when content was last re-analyzed
   - Alert user if source content updated since framework created
   - Offer "Re-analyze and update framework" action

**Testing:**
- Create framework from content → Verify link in framework_content_sources
- Create evidence from content → Verify source_content_id set
- View content usage → See all frameworks/evidence using it
- Export framework to PDF → Verify sources section includes URLs

**Migration Path:**
- Existing evidence/frameworks: source fields empty (acceptable)
- New workflows: enforce content linking

---

### Phase 6: Entity Extraction Automation (Week 7) - Intelligence Graph
**Goal:** Automatically create actors, places, events from content

**Complexity:** HIGH (7-10 days)

**Tasks:**
1. Create `/api/content-intelligence/extract-to-entities` endpoint
   - Input: content_analysis_id, entity_types[] (actor, place, event)
   - Create actors for people/organizations
   - Create places for locations with coordinates (Google Geocoding API)
   - Create events for temporal activities
   - Link via content_entities table

2. Add entity extraction UI
   - Show extracted entities (people, orgs, locations)
   - "Save to Workspace" button per entity
   - Bulk "Save All Entities" action
   - Show which entities already exist in workspace (deduplicate)

3. Implement smart entity merging
   - Detect duplicate actors (name similarity)
   - Suggest merge candidates
   - Track entity provenance (which content mentioned entity)

4. Create entity detail view
   - Show all content mentioning entity
   - Show all relationships (from relationships table)
   - Show frameworks analyzing entity
   - Show deception profile (if applicable)

5. Implement reverse lookup
   - From actor page → "View all content mentioning this actor"
   - From place page → "View all content about this location"

**Testing:**
- Analyze article mentioning "Vladimir Putin", "Kremlin", "Moscow"
- Verify 1 actor (Putin), 1 organization (Kremlin), 1 place (Moscow) created
- Verify content_entities links created
- Re-analyze different article mentioning "Putin" → Suggest merge with existing actor
- View Putin actor page → See both content sources listed

**Migration Path:**
- Existing entities: no changes
- New content: offer entity extraction
- Manual entity creation still supported

---

## Risk Analysis & Challenges

### Technical Risks

**1. D1 Database Size Limit (2GB) - HIGH**
- **Risk:** Platform stores full content for every URL analyzed. At 5KB average per page, capacity is ~400,000 analyses. Popular platform could hit limit within months.
- **Mitigation:**
  - Implement content hash deduplication (same article analyzed multiple times = 1 storage)
  - Provide content expiration policy (archive old analyses after 6 months)
  - Offer "archive mode" for critical content (store full HTML in Cloudflare R2 object storage)
  - Monitor database size via cron job, alert at 1.5GB
- **Likelihood:** MEDIUM (depends on adoption rate)
- **Impact:** HIGH (service degradation/failure)

**2. Cloudflare Workers Timeout (10 seconds) - MEDIUM**
- **Risk:** Large articles (10,000+ words) or slow external sites cause timeout before content extraction completes.
- **Mitigation:**
  - Implement streaming extraction (process in chunks)
  - Use Cloudflare Durable Objects for long-running extraction tasks
  - Provide timeout fallback: "Content too large, try bypass URL or archive link"
  - Set aggressive timeout on external fetch (5 seconds max)
- **Likelihood:** MEDIUM (20% of URLs may timeout)
- **Impact:** MEDIUM (user sees error, can retry with bypass)

**3. GPT API Cost Explosion - HIGH**
- **Risk:** Auto-populating frameworks for every content analysis = expensive. PMESII-PT alone requires analyzing 8 categories. At $0.25/1M input tokens (gpt-5-mini), 100 analyses/day = ~$5-10/day = $150-300/month.
- **Mitigation:**
  - Make auto-population opt-in (not automatic)
  - Cache framework suggestions aggressively
  - Use gpt-5-nano for simpler tasks (cheaper)
  - Set monthly API budget limit, alert at 80%
  - Provide user quota system (free tier: 10 auto-populations/month)
- **Likelihood:** HIGH (if feature is popular)
- **Impact:** HIGH (financial sustainability)

**4. Content Deduplication Collisions - LOW**
- **Risk:** Two different articles produce same SHA-256 hash (hash collision). Users see wrong cached content.
- **Mitigation:**
  - Use SHA-256 (collision probability: ~1 in 2^256)
  - Store URL + hash combo (collision requires same content AND same URL)
  - Implement "force re-analyze" option
  - Monitor for hash collisions (log when cache hit but URL differs)
- **Likelihood:** VERY LOW (mathematically improbable)
- **Impact:** MEDIUM (data integrity issue if occurs)

**5. Workspace Migration on User Registration - MEDIUM**
- **Risk:** Non-authenticated user analyzes 50 URLs, then registers. Migration fails, user loses data.
- **Mitigation:**
  - Store bookmark hash persistently (localStorage + cookie backup)
  - During registration, query `workspace_id = 'temp_<hash>'`, bulk update to user's workspace
  - Use database transaction (all-or-nothing)
  - Keep temp workspace for 7 days after migration (recovery option)
  - Show migration progress UI ("Migrating your 50 analyses...")
- **Likelihood:** MEDIUM (registration process interruptions)
- **Impact:** HIGH (user trust, data loss)

**6. Framework Auto-Population Accuracy - HIGH**
- **Risk:** GPT hallucinates data, auto-populates framework with incorrect information. User relies on it, makes bad decisions.
- **Mitigation:**
  - Mark all auto-populated fields as "AI-generated (review required)"
  - Show confidence scores (0-1) for each field
  - Highlight low-confidence fields in red
  - Require user to explicitly "Accept" auto-populated data
  - Store source paragraph numbers for traceability
  - Add "Report incorrect auto-population" button (feedback loop)
- **Likelihood:** HIGH (AI accuracy is imperfect)
- **Impact:** VERY HIGH (mission-critical decisions based on bad data)

### Operational Risks

**7. Performance Degradation with Large Datasets - MEDIUM**
- **Risk:** User creates framework from content with 50 entities. Loading framework becomes slow (N+1 query problem).
- **Mitigation:**
  - Use database query optimization (JOINs instead of sequential queries)
  - Implement pagination for entity lists (load 20 at a time)
  - Add database indexes on foreign keys
  - Use Cloudflare KV cache for frequently accessed frameworks
- **Likelihood:** MEDIUM (power users will create large datasets)
- **Impact:** MEDIUM (user frustration, not failure)

**8. Security: Content Injection Attacks - LOW**
- **Risk:** Malicious user submits URL to malicious site hosting XSS payload. Content stored in DB, displayed to other users (if shared).
- **Mitigation:**
  - Sanitize all extracted content before storage (strip `<script>`, `<iframe>` tags)
  - Use React's built-in XSS protection (dangerouslySetInnerHTML only for markdown)
  - Implement CSP (Content Security Policy) headers
  - Scan content for malicious patterns before storage
- **Likelihood:** LOW (requires targeted attack)
- **Impact:** HIGH (XSS compromise)

**9. Licensing: Web Scraping Legal Issues - MEDIUM**
- **Risk:** Platform scrapes paywalled or copyrighted content, stores permanently. Legal action from publishers.
- **Mitigation:**
  - Add robots.txt compliance check (skip URLs disallowing bots)
  - Provide "Delete Content" option (GDPR compliance)
  - Store only extracted text (fair use: analysis/research)
  - Add disclaimer: "For research/analysis purposes only"
  - Respect `noindex`, `noarchive` meta tags
  - Implement DMCA takedown process
- **Likelihood:** MEDIUM (publishers increasingly aggressive)
- **Impact:** HIGH (legal liability)

**10. Data Consistency: Stale Content - MEDIUM**
- **Risk:** Article analyzed in January, content updated in March. Framework still references old data.
- **Mitigation:**
  - Store `content_analysis.created_at` timestamp
  - Add "Last analyzed" badge to frameworks
  - Implement "Re-analyze source content" button
  - Alert user if content >90 days old
  - Optionally auto-refresh content monthly (background job)
- **Likelihood:** MEDIUM (news articles frequently updated)
- **Impact:** MEDIUM (outdated analysis)

---

## Next Steps

### Immediate Actions (This Week)

1. **Decision Point: Approve Architecture Shift**
   - Owner: [Product Owner/Tech Lead]
   - Action: Review this plan, approve/modify approach
   - Deadline: 2025-10-10
   - Output: Go/No-Go decision

2. **Create Database Migrations (Phase 1)**
   - Owner: [Backend Engineer]
   - Action: Write SQL for migrations 025-026
   - Deadline: 2025-10-11
   - Output: Tested migration scripts

3. **Set Up GPT API Budget Alerts**
   - Owner: [DevOps/Platform Engineer]
   - Action: Configure Cloudflare budget alerts, set $300/month limit
   - Deadline: 2025-10-12
   - Output: Alert system active

4. **Design Content Deduplication Logic**
   - Owner: [Backend Engineer]
   - Action: Implement SHA-256 hashing, cache lookup
   - Deadline: 2025-10-13
   - Output: Deduplication algorithm code

### Phase 1 Kickoff (Week 1)

5. **Deploy Migration 025: Workspace Isolation**
   - Owner: [Backend Engineer]
   - Action: Add workspace_id to content tables, migrate existing data
   - Deadline: 2025-10-14
   - Output: Production migration complete

6. **Implement Bookmark Hash Middleware**
   - Owner: [Backend Engineer]
   - Action: Generate/store bookmark hashes for non-authenticated users
   - Deadline: 2025-10-15
   - Output: Working bookmark hash system

7. **Modify analyze-url Endpoint**
   - Owner: [Backend Engineer]
   - Action: Add workspace detection, deduplication, entity storage
   - Deadline: 2025-10-16
   - Output: Updated API endpoint

### Phase 2 Kickoff (Week 2)

8. **Redesign Landing Page**
   - Owner: [Frontend Engineer]
   - Action: Add hero URL input, remove auth redirect, add preview
   - Deadline: 2025-10-21
   - Output: Updated LandingPage.tsx

9. **User Testing: Landing Page Flow**
   - Owner: [QA/Product]
   - Action: Test non-authenticated and authenticated workflows
   - Deadline: 2025-10-23
   - Output: Bug reports, UX feedback

### Phase 3 Kickoff (Week 3)

10. **Implement Framework Suggestion Engine**
    - Owner: [AI/Backend Engineer]
    - Action: Create prompt templates, GPT integration, caching
    - Deadline: 2025-10-30
    - Output: Working suggestion API

11. **A/B Test: Suggestion Accuracy**
    - Owner: [Data/QA]
    - Action: Test 50 diverse articles, measure suggestion relevance
    - Deadline: 2025-11-01
    - Output: Accuracy metrics, prompt tuning recommendations

---

## Appendix

### Source List

[S1] **ContentIntelligencePage.tsx** — `/Users/sac/Git/researchtoolspy/frontend-react/src/pages/tools/ContentIntelligencePage.tsx`, lines 320-356: Entity extraction stores in JSON, manual save to actors table required

[S2] **Migration 021: Workspace Isolation** — `/Users/sac/Git/researchtoolspy/frontend-react/schema/migrations/021-workspace-isolation-corrected.sql`, lines 12-22: Frameworks have `source_url` text field, no FK to content

[S3] **LandingPage.tsx** — `/Users/sac/Git/researchtoolspy/frontend-react/src/pages/LandingPage.tsx`, lines 15-19: Authentication check redirects to dashboard

[S4] **Migration 014: Content Intelligence** — `/Users/sac/Git/researchtoolspy/frontend-react/schema/migrations/014-content-intelligence.sql`, lines 38-88: No `workspace_id` column in `content_analysis` or `saved_links`

[S5] **Migration 005: Entity System** — `/Users/sac/Git/researchtoolspy/frontend-react/schema/migrations/005-create-entity-system.sql`, lines 390-407: Junction tables exist for evidence-actors, but not content-actors

[S6] **Framework Types** — `/Users/sac/Git/researchtoolspy/frontend-react/src/types/frameworks.ts`, lines 1-52: Framework data stored as JSON blob, no field-level content mapping

[S7] **Cloudflare D1 Limits** — Cloudflare D1 Documentation (2024), https://developers.cloudflare.com/d1/platform/limits/: 2GB database size limit, 100,000 rows recommended

[S8] **Migration 005: Workspaces** — `/Users/sac/Git/researchtoolspy/frontend-react/schema/migrations/005-create-entity-system.sql`, lines 9-36: Workspace types include PERSONAL, TEAM, PUBLIC (implies non-authenticated temporary workspaces)

[S9] **Migration 014: Starbursting Sources** — `/Users/sac/Git/researchtoolspy/frontend-react/schema/migrations/014-content-intelligence.sql`, lines 121-134: Junction table links starbursting sessions to content_analysis

---

### Estimated Complexity Summary

| Phase | Duration | Complexity | Risk Level | Dependencies |
|-------|----------|------------|------------|--------------|
| Phase 1: Foundation | 5-8 days | MEDIUM | MEDIUM | None (standalone) |
| Phase 2: Landing Page | 3-5 days | LOW | LOW | Phase 1 (workspace_id) |
| Phase 3: Suggestions | 6-9 days | HIGH | MEDIUM | Phase 1, GPT API |
| Phase 4: Auto-Population | 10-14 days | VERY HIGH | HIGH | Phase 3 |
| Phase 5: Bidirectional Linking | 5-7 days | MEDIUM | LOW | Phase 1 |
| Phase 6: Entity Extraction | 7-10 days | HIGH | MEDIUM | Phase 1, Phase 5 |
| **Total** | **36-53 days** | **HIGH** | **MEDIUM** | Parallel execution possible |

**Critical Path:** Phase 1 → Phase 3 → Phase 4 (Foundation → Suggestions → Auto-Population)
**Parallel Opportunities:** Phase 2 (Landing Page) can develop alongside Phase 1

**Team Size Recommendation:**
- 1 Backend Engineer (database, APIs)
- 1 Frontend Engineer (UI/UX)
- 1 AI/ML Engineer (GPT prompts, auto-population)
- 1 QA Engineer (testing, validation)
- 0.5 DevOps Engineer (deployment, monitoring)

**Total Engineering Effort:** ~4-6 developer-months (with parallel work)

---

**End of Architecture Shift Plan**

**Confidence Level:** HIGH
**Recommendation:** PROCEED with phased implementation, prioritize Phase 1-3 for MVP
