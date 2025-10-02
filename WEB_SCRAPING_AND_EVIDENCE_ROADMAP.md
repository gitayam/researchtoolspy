# Web Scraping Integration & Quick Evidence Creation Roadmap

**Created:** October 1, 2025
**Status:** 🚀 Planning Phase
**Priority:** High
**Estimated Timeline:** 2-3 weeks

---

## 🎯 Executive Summary

**Goals:**
1. Integrate web scraping functionality to auto-populate datasets from URLs
2. Add "Quick Create Evidence" feature to all evidence link dialogs
3. Enable seamless workflow: Scrape → Dataset → Evidence → Framework

**Architecture Decision:** Hybrid approach
- Python FastAPI backend for heavy scraping (existing `/api/` service)
- Cloudflare Workers for API orchestration and data management
- React frontend for UI

---

## 📋 Phase 1: Quick Evidence Creation Feature (Week 1)

### 1.1 Update EvidenceSelector Component

**File:** `src/components/evidence/EvidenceSelector.tsx`

**Changes:**
- Add "Create New Evidence" button in dialog header
- Toggle between "Select Mode" and "Create Mode"
- Inline mini-form for quick evidence creation
- Pre-fill fields from context (section_key, framework metadata)
- Auto-select newly created evidence
- Support partial completion (only required: title, description, type, level)

**UI Design:**
```
┌─────────────────────────────────────────────┐
│ Link Evidence Items                    [X]  │
├─────────────────────────────────────────────┤
│ Select evidence to link to "who" section    │
│                                             │
│ [🔍 Search...]  [+ Create New Evidence]     │
│                                             │
│ ┌─── Create New Evidence ───────────────┐  │
│ │ Title: *                               │  │
│ │ Description: *                         │  │
│ │ Evidence Type: [observation ▼]        │  │
│ │ Evidence Level: [tactical ▼]          │  │
│ │ Priority: [normal ▼]                  │  │
│ │                                        │  │
│ │ ✓ Show all fields (5 W's + How)       │  │
│ │                                        │  │
│ │ [Cancel] [Create & Link]               │  │
│ └────────────────────────────────────────┘  │
│                                             │
│ OR select from existing:                    │
│ ☐ Evidence Item 1...                        │
│ ☐ Evidence Item 2...                        │
│                                             │
│ 0 items selected    [Cancel] [Link]         │
└─────────────────────────────────────────────┘
```

**Implementation Steps:**
1. Add state for create mode toggle
2. Create `QuickEvidenceForm` mini-component
3. Handle create-and-select workflow
4. Add expandable "Show all fields" section
5. Context-aware pre-filling logic

**Files to Create/Modify:**
- `src/components/evidence/EvidenceSelector.tsx` (modify)
- `src/components/evidence/QuickEvidenceForm.tsx` (create)

---

### 1.2 Apply Pattern to All Evidence Link Locations

**Locations to Update:**
1. Generic Framework Forms (all 13 frameworks)
2. Dataset linking to evidence
3. Any other evidence selector usage

**Pattern:**
- Consistent "Create New" button placement
- Same quick-create form component (reusable)
- Context-aware pre-filling based on location

---

## 📋 Phase 2: Web Scraping Backend Integration (Week 1-2)

### 2.1 Existing Python Backend Assessment

**Current Implementation:** `api/app/services/url_service.py`

**Features Available:**
- URL normalization and validation
- HTML content extraction via BeautifulSoup
- Metadata extraction (title, description, author, domain)
- Reliability scoring
- Domain reputation assessment
- Content caching

**Database Model:** `ProcessedUrl`

**What We Need:**
- Enhanced metadata extraction (dates, keywords, tags)
- Content summarization
- Entity extraction (people, places, organizations)
- Citation format generation (APA, MLA, Chicago)

---

### 2.2 Create Cloudflare Workers API Bridge

**New API Endpoint:** `functions/api/web-scraper.ts`

**Purpose:** Bridge between frontend and Python backend

**Methods:**
```typescript
POST /api/web-scraper
{
  "url": "https://example.com/article",
  "extract_mode": "full" | "metadata" | "summary",
  "create_dataset": true,
  "citation_style": "apa"
}

Response:
{
  "url": "...",
  "metadata": {
    "title": "...",
    "description": "...",
    "author": "...",
    "published_date": "...",
    "domain": "...",
    "reliability_score": 8.5
  },
  "content": {
    "text": "...",
    "summary": "...",
    "word_count": 1234
  },
  "entities": {
    "people": ["Person A", "Person B"],
    "places": ["Location X"],
    "organizations": ["Org Y"]
  },
  "citation": {
    "apa": "...",
    "mla": "...",
    "chicago": "..."
  },
  "dataset_id": 123  // if create_dataset=true
}
```

**Implementation:**
- Workers function calls Python backend via HTTP
- Transforms response to frontend format
- Optionally creates dataset in D1
- Returns enriched data

---

### 2.3 Enhanced Python Backend

**File:** `api/app/services/url_service.py`

**Enhancements Needed:**
1. **Entity Extraction:**
   - Use spaCy for NER (Named Entity Recognition)
   - Extract people, places, organizations, dates

2. **Content Summarization:**
   - Use transformers or extractive summarization
   - Generate 2-3 sentence summary

3. **Citation Generation:**
   - Parse metadata (author, date, title, URL)
   - Format in APA, MLA, Chicago styles

4. **Keyword Extraction:**
   - TF-IDF or KeyBERT for automatic tags
   - Return top 5-10 keywords

**New Dependencies:**
```python
# requirements.txt
spacy>=3.0
transformers>=4.0
keybert>=0.7
```

**New Service Methods:**
```python
class EnhancedURLService:
    async def extract_full(self, url: str) -> ProcessedUrlEnhanced
    async def extract_entities(self, text: str) -> Entities
    async def generate_summary(self, text: str) -> str
    async def generate_citation(self, metadata: dict, style: str) -> str
    async def extract_keywords(self, text: str, n: int = 10) -> list[str]
```

---

### 2.4 Web Scraping UI Component

**New Page:** `src/pages/WebScraperPage.tsx`

**Features:**
- URL input field
- Extract mode selector (metadata only, full content, with analysis)
- Real-time progress indicator
- Preview extracted content
- Option to create dataset immediately
- Option to create evidence from extracted data
- Citation preview

**UI Design:**
```
┌─────────────────────────────────────────────────┐
│ Web Scraper & Intelligence Extractor            │
├─────────────────────────────────────────────────┤
│                                                 │
│ URL: [https://example.com/article        ] 🔍  │
│                                                 │
│ Extract Mode: ⦿ Full Analysis                   │
│               ○ Metadata Only                   │
│               ○ Content Only                    │
│                                                 │
│ Auto-create: ✓ Dataset  ✓ Evidence Item        │
│                                                 │
│ [Extract & Analyze]                             │
│                                                 │
│ ┌─── Extracted Data ──────────────────────────┐ │
│ │ 📄 Title: "Article Title Here"             │ │
│ │ 👤 Author: John Doe                        │ │
│ │ 📅 Published: 2025-09-15                   │ │
│ │ 🌐 Domain: example.com (Reliability: 8.5)  │ │
│ │                                            │ │
│ │ Summary:                                   │ │
│ │ This article discusses...                  │ │
│ │                                            │ │
│ │ Entities Found:                            │ │
│ │ 👥 People: Alice Smith, Bob Jones          │ │
│ │ 📍 Places: Washington DC, London           │ │
│ │ 🏢 Organizations: United Nations, NATO     │ │
│ │                                            │ │
│ │ Keywords: policy, security, analysis       │ │
│ │                                            │ │
│ │ Citation (APA):                            │ │
│ │ Doe, J. (2025). Article Title...           │ │
│ │                                            │ │
│ │ [Create Dataset] [Create Evidence]         │ │
│ └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Component Structure:**
```
src/pages/WebScraperPage.tsx
src/components/scraper/
├── URLInput.tsx
├── ExtractionControls.tsx
├── ExtractionProgress.tsx
├── ExtractedDataPreview.tsx
├── EntityDisplay.tsx
└── CitationPreview.tsx
```

---

### 2.5 Integration with Dataset/Evidence System

**Workflow:**
1. User enters URL in Web Scraper
2. System extracts metadata, content, entities
3. User reviews extracted data
4. Click "Create Dataset" → Auto-fills DatasetForm with:
   - Title (from page title)
   - Description (from meta description or summary)
   - Source (URL)
   - Type (web_article, research_paper, etc.)
   - Author, publication_date, reliability_rating (from extraction)
   - Tags (from keywords)
5. Click "Create Evidence" → Auto-fills EvidenceItemForm with:
   - Title (from article title)
   - Description (summary)
   - What (extracted from content)
   - Who/Where/When (from entities)
   - Tags (from keywords)
   - Auto-link to created dataset via citation

**API Flow:**
```
Frontend → /api/web-scraper (Workers)
         → Python Backend /process-url
         → Returns enriched data
         → Frontend creates Dataset (POST /api/datasets)
         → Frontend creates Evidence (POST /api/evidence-items)
         → Frontend creates Citation (POST /api/evidence-citations)
```

---

## 📋 Phase 3: Advanced Features (Week 2-3)

### 3.1 Bulk URL Processing

**Feature:** Process multiple URLs at once
- Upload CSV/text file with URLs
- Queue system for async processing
- Progress tracking
- Batch dataset/evidence creation

**Implementation:**
- Use Cloudflare Queues for job management
- Workers process queue items
- Real-time updates via WebSocket or polling

---

### 3.2 Scheduled Monitoring

**Feature:** Monitor URLs for changes
- Schedule periodic re-scraping
- Detect content changes
- Update datasets automatically
- Notify user of significant changes

**Implementation:**
- Cloudflare Cron Triggers
- Store hash of content
- Compare on re-scrape
- Send notifications

---

### 3.3 Source Credibility Assessment

**Feature:** Enhanced reliability scoring
- Domain reputation (existing)
- Content analysis (sentiment, bias detection)
- Cross-reference with known reliable sources
- User feedback loop

**Implementation:**
- Integrate bias detection model
- Maintain credibility database
- User rating system

---

### 3.4 Intelligence Dashboard

**Feature:** Analytics for scraped data
- Most scraped domains
- Entity frequency analysis
- Timeline of events (from when_occurred)
- Geographic distribution (from where_location)
- Network graphs (entity relationships)

**New Page:** `src/pages/IntelligenceDashboard.tsx`

---

## 🗄️ Database Changes

### 3.1 New Tables (if needed)

**scraping_jobs** (for async processing):
```sql
CREATE TABLE scraping_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  extract_mode TEXT DEFAULT 'full',
  result TEXT,
  error TEXT,
  dataset_id INTEGER,
  evidence_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
)
```

**monitored_urls** (for scheduled monitoring):
```sql
CREATE TABLE monitored_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  dataset_id INTEGER NOT NULL,
  check_frequency TEXT DEFAULT 'daily',
  last_checked TEXT,
  last_content_hash TEXT,
  change_detected BOOLEAN DEFAULT 0,
  active BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
)
```

---

## 📁 File Structure

```
researchtoolspy/
├── frontend-react/
│   ├── functions/api/
│   │   ├── web-scraper.ts (NEW)
│   │   ├── scraping-jobs.ts (NEW - Phase 3)
│   │   └── monitored-urls.ts (NEW - Phase 3)
│   ├── src/
│   │   ├── components/
│   │   │   ├── evidence/
│   │   │   │   ├── EvidenceSelector.tsx (MODIFY)
│   │   │   │   └── QuickEvidenceForm.tsx (NEW)
│   │   │   └── scraper/
│   │   │       ├── URLInput.tsx (NEW)
│   │   │       ├── ExtractionControls.tsx (NEW)
│   │   │       ├── ExtractionProgress.tsx (NEW)
│   │   │       ├── ExtractedDataPreview.tsx (NEW)
│   │   │       ├── EntityDisplay.tsx (NEW)
│   │   │       └── CitationPreview.tsx (NEW)
│   │   ├── pages/
│   │   │   ├── WebScraperPage.tsx (NEW)
│   │   │   └── IntelligenceDashboard.tsx (NEW - Phase 3)
│   │   └── types/
│   │       └── scraper.ts (NEW)
└── api/
    └── app/
        └── services/
            ├── url_service.py (ENHANCE)
            ├── entity_extraction.py (NEW)
            ├── summarization.py (NEW)
            └── citation_generator.py (NEW)
```

---

## ✅ Implementation Checklist

### Phase 1: Quick Evidence Creation ⏳

#### EvidenceSelector Enhancement
- [ ] Add create mode toggle state
- [ ] Create QuickEvidenceForm component
- [ ] Implement inline form UI
- [ ] Add "Create New Evidence" button
- [ ] Context-aware pre-filling logic
- [ ] Create and auto-select workflow
- [ ] Expandable "Show all fields" section
- [ ] Handle create API call
- [ ] Error handling and validation
- [ ] Test in different framework sections

#### Pattern Application
- [ ] Update all framework forms
- [ ] Update dataset-evidence linking
- [ ] Ensure consistent UX across all locations
- [ ] Test end-to-end workflows

---

### Phase 2: Web Scraping Integration ⏳

#### Backend Enhancement
- [ ] Install spaCy, transformers, KeyBERT
- [ ] Create entity_extraction.py service
- [ ] Create summarization.py service
- [ ] Create citation_generator.py service
- [ ] Enhance url_service.py with new methods
- [ ] Test Python backend enhancements
- [ ] Deploy Python backend updates

#### Workers API
- [ ] Create /api/web-scraper endpoint
- [ ] Implement Python backend communication
- [ ] Handle response transformation
- [ ] Add optional dataset creation
- [ ] Error handling for network failures
- [ ] Rate limiting
- [ ] Test with various URLs

#### Frontend UI
- [ ] Create scraper component structure
- [ ] Build URLInput component
- [ ] Build ExtractionControls component
- [ ] Build ExtractionProgress component
- [ ] Build ExtractedDataPreview component
- [ ] Build EntityDisplay component
- [ ] Build CitationPreview component
- [ ] Build WebScraperPage
- [ ] Add to navigation
- [ ] Test extraction flow
- [ ] Test dataset/evidence creation from extracted data

#### Types
- [ ] Create scraper.ts type definitions
- [ ] Define extraction response types
- [ ] Define entity types
- [ ] Define citation types

#### Integration Testing
- [ ] Test URL → Dataset flow
- [ ] Test URL → Evidence flow
- [ ] Test URL → Dataset → Evidence → Framework flow
- [ ] Test with various URL types (articles, PDFs, etc.)
- [ ] Test error scenarios

---

### Phase 3: Advanced Features 🔮

#### Bulk Processing
- [ ] Design bulk upload UI
- [ ] Create scraping_jobs table
- [ ] Implement job queue with Cloudflare Queues
- [ ] Build progress tracking
- [ ] Test batch processing

#### Monitoring
- [ ] Create monitored_urls table
- [ ] Implement Cloudflare Cron Triggers
- [ ] Build change detection logic
- [ ] Create notification system
- [ ] Build monitoring management UI

#### Intelligence Dashboard
- [ ] Design dashboard layout
- [ ] Build analytics queries
- [ ] Create visualization components
- [ ] Implement entity network graphs
- [ ] Add timeline view
- [ ] Add geographic distribution

---

## 🎯 Success Metrics

### Phase 1 Goals
- [ ] Quick create available in all evidence link dialogs
- [ ] 80% reduction in time to create and link evidence
- [ ] Context-aware pre-filling working
- [ ] No regression in existing functionality

### Phase 2 Goals
- [ ] Web scraping functional for 95%+ of standard URLs
- [ ] Entity extraction accuracy >85%
- [ ] Auto-created datasets require <5 field edits on average
- [ ] Full workflow (URL → Dataset → Evidence → Framework) <2 minutes

### Phase 3 Goals
- [ ] Bulk processing handles 100+ URLs
- [ ] Change monitoring detects updates within 24 hours
- [ ] Intelligence dashboard provides actionable insights
- [ ] User satisfaction >4/5 stars

---

## 🚀 Deployment Strategy

### Phase 1
1. Develop and test locally
2. Deploy to Cloudflare Pages dev branch
3. User acceptance testing
4. Deploy to production

### Phase 2
1. Deploy Python backend enhancements first
2. Deploy Workers API
3. Deploy frontend components
4. Test integration in dev environment
5. Gradual rollout to production

### Phase 3
1. Enable Cloudflare Queues
2. Configure Cron Triggers
3. Deploy advanced features incrementally
4. Monitor performance and costs

---

## 📊 Risk Assessment

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Python backend performance | High | Implement caching, rate limiting |
| Entity extraction accuracy | Medium | Provide manual correction UI |
| Cloudflare Workers timeout | High | Use async jobs for slow URLs |
| Cost of NLP models | Medium | Optimize model usage, consider lightweight alternatives |

### UX Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Quick create form too complex | Medium | Require only essential fields |
| Scraping takes too long | High | Show progress, allow background processing |
| Auto-filled data incorrect | Medium | Easy edit before save |

---

## 📚 Documentation Updates

### Cloudflare_React_Development_Guide.md Updates Needed
- [ ] Add section on Quick Evidence Creation pattern
- [ ] Document web scraper API usage
- [ ] Add Python backend integration patterns
- [ ] Document async job processing with Queues
- [ ] Add monitoring setup guide
- [ ] Include troubleshooting for scraping issues

### New Documentation Files
- [ ] WEB_SCRAPING_GUIDE.md - User guide for web scraping features
- [ ] ENTITY_EXTRACTION_GUIDE.md - Technical guide for entity extraction
- [ ] BULK_PROCESSING_GUIDE.md - Guide for bulk URL processing

---

**Last Updated:** October 1, 2025
**Next Review:** After Phase 1 completion

---

## 📋 Phase 4: Public Access & Authentication Strategy

### Overview
**Goal**: Make frameworks and tools publicly available. Hash-based authentication only required for saving work and team collaboration.

**Philosophy**: Lower barrier to entry, increase adoption, convert users to authenticated mode organically.

### Current State
- Hash-based authentication required for ALL access
- Users must have valid hash to use any features
- No guest/anonymous usage possible

### Target State
- **Public Access (No Auth)**: All frameworks, tools, and public datasets viewable and usable
- **Hash Login Required For**:
  - Saving work (framework sessions, datasets, evidence)
  - Team collaboration and sharing
  - Access to personal history
  - Creating private datasets/evidence

---

### 4.1 Public Routes Implementation

#### Frontend Routes (No Auth Required)
```
Public Pages:
- / (landing page - updated with "Continue as Guest" option)
- /frameworks (list all 13 frameworks)
- /frameworks/:type (specific framework - ephemeral usage)
- /tools (list all tools)
- /tools/web-scraper (web scraping tool - results in browser only)
- /datasets?filter=public (public datasets only)
- /evidence?filter=public (public evidence only)

Auth-Protected Pages:
- /dashboard (user's saved work)
- /dashboard/sessions (user's framework sessions)
- /dashboard/datasets (user's datasets)
- /dashboard/evidence (user's evidence items)
- /settings (user settings)
```

#### Backend API Routes

**Public Endpoints (No Auth)**:
```typescript
GET  /api/frameworks          // List all framework types
GET  /api/frameworks/:id      // Get public framework template
GET  /api/datasets?public=true // List public datasets
GET  /api/evidence-items?public=true // List public evidence
POST /api/web-scraper         // Scrape URL (no save)
```

**Auth-Protected Endpoints**:
```typescript
POST   /api/framework-sessions    // Save framework session
PUT    /api/framework-sessions/:id
DELETE /api/framework-sessions/:id
POST   /api/datasets              // Create dataset
PUT    /api/datasets/:id
DELETE /api/datasets/:id
POST   /api/evidence-items        // Create evidence
PUT    /api/evidence-items/:id
DELETE /api/evidence-items/:id
```

---

### 4.2 Guest Mode Features

#### What Guest Users Can Do
- ✅ Use all 13 analytical frameworks (SWOT, PMESII-PT, etc.)
- ✅ Use web scraper (results shown in browser)
- ✅ View public datasets and evidence
- ✅ Export framework results as PDF/JSON
- ✅ Work temporarily (local storage up to 7 days)
- ✅ Share framework link (read-only snapshot)

#### What Guest Users Cannot Do
- ❌ Save framework sessions to database
- ❌ Create permanent datasets
- ❌ Create permanent evidence items
- ❌ Collaborate with team members
- ❌ Access work history
- ❌ Make private datasets/evidence

#### Guest Data Management
```typescript
// Local storage structure for guest work
localStorage.setItem('guest-framework-{id}', JSON.stringify({
  framework_type: 'swot',
  data: { /* framework data */ },
  created_at: '2025-10-01T12:00:00Z',
  expires_at: '2025-10-08T12:00:00Z'  // 7 days
}))

// Periodic cleanup of expired guest data
setInterval(() => {
  cleanupExpiredGuestData()
}, 3600000) // Every hour
```

---

### 4.3 UI/UX Changes

#### Landing Page Redesign
```
┌──────────────────────────────────────────┐
│  ResearchTools Intelligence Platform     │
├──────────────────────────────────────────┤
│                                          │
│  Professional Intelligence Analysis      │
│  for Everyone                            │
│                                          │
│  [Try It Now - No Sign Up Required]     │
│  [Sign In with Hash Code]               │
│                                          │
│  As a guest you can:                     │
│  ✓ Use all 13 analytical frameworks      │
│  ✓ Web scraping & data extraction        │
│  ✓ View public intelligence datasets     │
│  ✓ Export your analysis                  │
│                                          │
│  With a hash code you can also:          │
│  ✓ Save your work permanently            │
│  ✓ Build a personal intel library        │
│  ✓ Collaborate with your team            │
│  ✓ Access work from anywhere             │
└──────────────────────────────────────────┘
```

#### Framework Page (Guest Mode)
```
┌──────────────────────────────────────────┐
│ SWOT Analysis                      [Menu]│
├──────────────────────────────────────────┤
│ ⚠️  Guest Mode - Work not saved          │
│ [Sign In to Save Permanently] [Export]   │
├──────────────────────────────────────────┤
│                                          │
│ [Framework content and inputs]           │
│                                          │
│ Your work is temporarily stored in       │
│ your browser. Sign in to save forever.   │
└──────────────────────────────────────────┘
```

#### Framework Page (Authenticated Mode)
```
┌──────────────────────────────────────────┐
│ SWOT Analysis                      [Menu]│
├──────────────────────────────────────────┤
│ ✓ Auto-saving... Last saved 2 min ago    │
│ [Export] [Share with Team]               │
├──────────────────────────────────────────┤
│                                          │
│ [Framework content and inputs]           │
│                                          │
│ All changes automatically saved          │
└──────────────────────────────────────────┘
```

---

### 4.4 Implementation Tasks

#### Frontend Changes
- [ ] Update routing to remove auth guards from public pages
- [ ] Create GuestModeProvider context
- [ ] Add "Save your work" conversion prompts
- [ ] Implement local storage for guest sessions
- [ ] Add guest data expiration warnings
- [ ] Create guest-to-auth conversion flow
- [ ] Add "Continue as Guest" to landing page
- [ ] Update navigation to show auth status clearly

#### Backend Changes
- [ ] Make framework GET endpoints public
- [ ] Add `is_public` flag to datasets/evidence
- [ ] Implement rate limiting for guests (stricter)
- [ ] Add IP-based throttling
- [ ] Create guest analytics tracking
- [ ] Keep POST/PUT/DELETE auth-protected

#### Database Schema Updates
```sql
-- Add public flag to datasets
ALTER TABLE datasets ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE datasets ADD COLUMN shared_by_user_id INTEGER;
CREATE INDEX idx_datasets_public ON datasets(is_public);

-- Add public flag to evidence
ALTER TABLE evidence_items ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE evidence_items ADD COLUMN shared_by_user_id INTEGER;
CREATE INDEX idx_evidence_public ON evidence_items(is_public);

-- Track guest sessions (optional)
CREATE TABLE guest_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Security Considerations
- Rate limiting: 100 requests/hour for guests vs 1000 for auth
- IP-based throttling to prevent abuse
- No sensitive operations without auth
- Guest data auto-expires after 7 days
- CAPTCHA for intensive scraping operations
- Monitor for abuse patterns

---

### 4.5 Migration Strategy

**Phase A: Preparation (Week 1)**
1. Add public flags to database tables
2. Update API endpoints with public filtering
3. Implement rate limiting infrastructure
4. Test public endpoints with auth still enforced

**Phase B: Frontend Updates (Week 2)**
1. Create GuestModeProvider
2. Update landing page with guest option
3. Add conversion prompts to framework pages
4. Implement local storage for guest work
5. Test guest flow end-to-end

**Phase C: Backend Enablement (Week 3)**
1. Remove auth guards from public GET endpoints
2. Enable public dataset/evidence filtering
3. Deploy rate limiting for guests
4. Monitor for abuse/performance issues

**Phase D: Gradual Rollout (Week 4)**
1. Enable public access for 10% of traffic
2. Monitor conversion rates and abuse
3. Gradually increase to 50%, then 100%
4. Gather user feedback
5. Optimize conversion funnel

---

### 4.6 Success Metrics

**Adoption Metrics**:
- [ ] 80%+ of traffic can access without auth
- [ ] <10% bounce rate on landing page
- [ ] 50%+ of users try at least one framework as guest
- [ ] 20%+ guest-to-auth conversion rate within 30 days

**Performance Metrics**:
- [ ] No degradation in response times
- [ ] <5% increase in server load
- [ ] Rate limiting catches 99%+ abuse attempts
- [ ] Zero security incidents

**Business Metrics**:
- [ ] 3x increase in total users (including guests)
- [ ] 2x increase in authenticated users (absolute numbers)
- [ ] 5x increase in framework usage
- [ ] Improved SEO ranking (public content indexed)

---

### 4.7 Guest-to-Auth Conversion Strategy

#### Conversion Triggers
1. **After completing framework**: "Save this analysis permanently?"
2. **On page refresh**: "Your work will be lost. Sign in to save."
3. **After 3 framework uses**: "You're getting the hang of this! Save your progress."
4. **Export attempt**: "Export now or sign in to save forever"
5. **7-day expiration warning**: "Your work expires in 24 hours"

#### Conversion Incentives
- Unlimited storage vs 7-day expiration
- Team collaboration features
- Private datasets and evidence
- Work history and versioning
- Priority support
- Advanced features (bulk processing, etc.)

#### Onboarding Flow
```
Guest completes SWOT analysis
  ↓
"Great work! Save this permanently?"
  ↓
[Get Hash Code] or [Continue as Guest]
  ↓
If "Get Hash Code":
  → Show hash request form
  → Email hash code
  → Auto-login on first use
  → Migrate guest work to account
```

---

**Phase 4 Timeline:** 4 weeks
**Phase 4 Priority:** High (increases adoption significantly)
**Phase 4 Dependencies:** Phases 1-3 complete

---

**Last Updated:** October 1, 2025
**Next Review:** After Phase 4 completion

