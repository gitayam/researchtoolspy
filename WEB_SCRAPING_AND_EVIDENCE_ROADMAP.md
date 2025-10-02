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
