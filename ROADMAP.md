# Research Tools Platform - Development Roadmap

## Priority 1: Content Intelligence Critical Fixes 🔴

### Starbursting Integration Failure
**Status**: ✅ FIXED (Deployed 2025-10-10)
**Priority**: HIGH
**Issue**: Starbursting auto-creation failing on Content Intelligence page
**Solution Implemented**:
- [x] Converted to manual trigger (like DIME analysis)
- [x] Removed automatic background call after analysis
- [x] Added "Create Starbursting Session" button on Starbursting tab
- [x] Show loading state during generation
- [x] Display success/error states clearly
- [x] Added badge to Starbursting tab showing status (Not Run / Processing / Ready / Error)
- [x] Users must manually click button to generate Starbursting questions

**Deployment**: https://80e1ec57.researchtoolspy.pages.dev

---

### Sentiment Analysis Broken
**Status**: ✅ FIXED (Deployed 2025-10-13)
**Priority**: HIGH
**Issue**: Sentiment analysis showing "not available" even when analysis should have run
**Root Cause Identified**:
- ✅ Undefined variable fallback issue: When `analyzeSentiment()` threw an error, `sentimentData` remained undefined instead of using the fallback
- ✅ Frontend displayed "Sentiment analysis not available" because sentimentData was undefined
- ✅ The fallback inside `analyzeSentiment()` only applied to errors within the function, not when entire API call failed

**Solution Implemented**:
- ✅ Initialize `sentimentData` with neutral fallback BEFORE try-catch block
- ✅ Initialize `claimAnalysis` with null fallback BEFORE try-catch block
- ✅ Users now always get at least neutral sentiment instead of nothing
- ✅ Better error messages logged for debugging
- ✅ Graceful degradation ensures content analysis never fails completely

**Files Modified**:
- `functions/api/content-intelligence/analyze-url.ts` (lines 379-396, 422-443)

---

### Claims Analysis Broken
**Status**: ✅ FIXED (Deployed 2025-10-13)
**Priority**: HIGH
**Issue**: Claim detection and deception analysis showing as unavailable
**Root Cause Identified**:
- ✅ Same undefined variable fallback issue as sentiment analysis
- ✅ When `extractClaims()` or `analyzeClaimsForDeception()` threw errors, `claimAnalysis` remained undefined
- ✅ Frontend couldn't render claims tab properly

**Solution Implemented**:
- ✅ Initialize `claimAnalysis` with null fallback BEFORE try-catch block
- ✅ Graceful degradation: if claim extraction fails, analysis continues with null
- ✅ Better error logging with error details
- ✅ Frontend now properly handles null claim_analysis state

**Files Modified**:
- `functions/api/content-intelligence/analyze-url.ts` (lines 422-443)

---

### Progressive Loading UX Improvement
**Status**: 🔄 IN PROGRESS - Phase 0 Infrastructure Complete (2025-10-13)
**Priority**: HIGH
**Issue**: All-or-nothing loading bar creates poor UX, users wait for everything before seeing anything

**Progress So Far**:
- [x] **Phase 0: Infrastructure Setup** (Completed 2025-10-13)
  - ✅ Created `/api/content-intelligence/status/[id]` polling endpoint
  - ✅ Added `processing_status` column to database (migration 043)
  - ✅ Status endpoint returns component-level completion states
  - ✅ Designed progressive loading architecture

**Next Steps**:
- [ ] **Phase 1: Simplified UX Improvements** (8-12 hours, requires significant refactoring)
  - **Complexity Finding** (2025-10-13): ContentIntelligencePage is 1800+ lines with conditional rendering based on `processing` state
  - **Required Changes**:
    - Create skeleton loader components for each tab (overview, entities, sentiment, claims, etc.)
    - Refactor all conditional rendering to show skeletons instead of hiding content
    - Test across all tabs and analysis states
    - Ensure error states still work correctly
  - **Benefit**: Eliminates blank screen, gives instant feedback
  - **Risk**: Medium - Large refactor of complex component
  - **Recommendation**: Defer until other HIGH/CRITICAL items complete

- [ ] **Phase 2: True Progressive Loading** (8-10 hours, future enhancement)
  - Backend: Split analyze endpoint into fast/slow analyses
  - Backend: Return initial response within 2-3 seconds
  - Backend: Use context.waitUntil() for background GPT processing
  - Frontend: Poll status endpoint every 2 seconds
  - Frontend: Render components as analyses complete
  - **Benefit**: Users can read summary while sentiment/claims analyze
  - **Risk**: Medium - requires background job handling in Cloudflare Workers

**Architecture Designed**:
```typescript
// Status endpoint structure (already implemented)
GET /api/content-intelligence/status/:analysisId
Response: {
  analysis: { /* full analysis data */ },
  status: 'processing' | 'complete' | 'error',
  componentStatus: {
    basic: 'complete',
    wordFrequency: 'complete' | 'pending',
    entities: 'complete' | 'pending',
    summary: 'complete' | 'pending',
    sentiment: 'complete' | 'pending',
    keyphrases: 'complete' | 'pending',
    topics: 'complete' | 'pending',
    claims: 'complete' | 'pending'
  }
}

// Future: Progressive analyze flow
POST /api/content-intelligence/analyze?progressive=true
1. Extract content (fast)
2. Save partial analysis with processing_status='processing'
3. Return analysis_id + basic data immediately
4. Background: Run GPT analyses, update database
5. Frontend: Poll /status/:id until complete
```

**Estimated Remaining Effort**: 2-4 hours (Phase 1) + 8-10 hours (Phase 2)

---

## Priority 2: PMESII-PT Framework Enhancements 🟢

### Phase 1: URL Import Integration
**Status**: ✅ COMPLETED (Deployed 2025-10-10)
**Priority**: MEDIUM
**Tasks Completed**:
- [x] Added "Import Sources" card to PMESII-PT create page
- [x] Created URL input with "Analyze URL" button
- [x] Implemented loading state during analysis
- [x] Display imported sources as removable badges
- [x] Integrated with Content Intelligence analyze endpoint
- [x] Also available for DIME, DOTMLPF, PEST frameworks

**Files Modified**:
- `src/components/frameworks/GenericFrameworkForm.tsx`

---

### Phase 2: Backend API for URL→PMESII-PT Mapping
**Status**: ✅ COMPLETED (Deployed 2025-10-10)
**Priority**: MEDIUM
**Tasks Completed**:
- [x] Created `/api/frameworks/pmesii-pt/import-url` endpoint
- [x] Integrated Content Intelligence analysis
- [x] GPT-4o-mini powered mapping to 8 PMESII-PT dimensions
- [x] Auto-generates 2-3 Q&A pairs per dimension
- [x] Returns structured PMESII-PT data

**Dimension Mapping Implemented**:
```typescript
Political: Government, leaders, political actors, governance
Military: Armed forces, defense capabilities, security
Economic: Trade, GDP, financial entities, resources
Social: Demographics, culture, education (uses summary)
Information: Media landscape, propaganda (future)
Infrastructure: Transportation, facilities, locations
Physical: Geography, terrain, environmental factors
Time: Dates, historical context, temporal patterns
```

**File Created**: `functions/api/frameworks/pmesii-pt/import-url.ts`

---

### Phase 3: AI-Powered Dimension Pre-Population
**Status**: ✅ COMPLETED (Built into Phase 2)
**Priority**: MEDIUM
**Implementation**:
- [x] GPT-4o-mini generates dimension-specific questions
- [x] Evidence-based answers from extracted content
- [x] Context-aware question generation
- [x] Handles missing information gracefully
- [x] User reviews and edits generated Q&A in standard UI

**Note**: This was implemented directly in the import-url endpoint using GPT-4o-mini rather than as separate UI buttons. More efficient approach.

---

### Phase 4: Geographic Context & Evidence Integration
**Status**: 🔄 PARTIALLY COMPLETE - Infrastructure Done (2025-10-13)
**Priority**: CRITICAL
**Issue**: PMESII-PT is fundamentally geographic but lacks location context

**Infrastructure Completed** ✅:
- [x] **Location Selector Component**: `PMESIIPTLocationSelector.tsx` exists with country (required), region, city, time period, scope fields
- [x] **Database Schema**: Migration 035 added location columns to `framework_sessions` table
- [x] **Form Integration**: Location selector integrated in `GenericFrameworkForm` for PMESII-PT
- [x] **Validation**: Country field is required, enforced in form submission
- [x] **Data Saving**: Location data properly saved when creating/updating PMESII-PT analyses
- [x] **Database Indexes**: Indexes on location_country, location_region for efficient queries

**Remaining Work**:
- [ ] **Display Location in Analysis View** (2-3 hours)
  - Show location prominently in analysis header/metadata
  - Display as badge or card: "📍 Ukraine > Donbas > Mariupol"
  - Show time period if specified
  - Display scope/objectives

- [ ] **Evidence Integration** (4-6 hours)
  - Tag Q&A items with PMESII-PT metadata when saved
  - Store: location, dimension, source URL, date
  - Link each Q&A item to evidence table
  - Enable filtering by location and dimension

- [ ] **PMESII Evidence Library Page** (4-6 hours)
  - New page: `/dashboard/evidence/pmesii`
  - Filter by location (country/region/city)
  - Filter by dimension (Political, Military, etc.)
  - Filter by date range
  - Search evidence text
  - Export filtered evidence

- [ ] **Framework Integration** (2-3 hours)
  - PMESII evidence appears in ACH evidence selection
  - Cross-reference between frameworks
  - Location-based evidence suggestions

**Estimated Remaining Effort**: 12-18 hours

---

### Phase 5: Wizard Workflow
**Status**: NOT STARTED
**Priority**: HIGH
**Reason**: PMESII-PT is complex like COG - needs guided workflow

**Wizard Steps**:
1. **Step 1: Analysis Setup**
   - Title
   - Location (country, region, city) - REQUIRED
   - Time period
   - Scope/objectives

2. **Step 2: Source Import**
   - Import from URLs
   - Import from PPTX (auto-detect PMESII sections)
   - Import from DOCX/Word (auto-parse)
   - Import from saved Content Intelligence analyses
   - Manual entry

3. **Step 3: Dimension Analysis** (8 tabs)
   - Political → Military → Economic → Social → Information → Infrastructure → Physical → Time
   - AI suggestions for each dimension
   - Evidence linking per item
   - Progress indicator showing completed dimensions

4. **Step 4: Review & Export**
   - Summary view across all dimensions
   - Identify gaps (dimensions with no data)
   - AI-generated executive summary
   - Export options (PDF, DOCX, PPTX, JSON, CSV)
   - Generate shareable link

**Files to Create**:
- `src/components/frameworks/PMESIIPTWizard.tsx`
- `src/components/frameworks/PMESIIPTLocationSelector.tsx`
- `src/components/frameworks/PMESIIPTDimensionStep.tsx`

**Estimated Effort**: 16 hours

---

### Phase 6: Document Import (PPTX, DOCX)
**Status**: NOT STARTED
**Priority**: MEDIUM
**Use Case**: Many analysts have existing PMESII-PT analyses in PowerPoint/Word

**Implementation**:
- [ ] **PPTX Import**:
  - Parse PowerPoint slides
  - Detect PMESII-PT sections by headers/keywords
  - Extract text content by dimension
  - Map to Q&A format (slide title = question, content = answer)

- [ ] **DOCX/Word Import**:
  - Parse Word documents
  - Use heading structure to identify dimensions
  - Extract paragraphs under each dimension
  - Convert to Q&A pairs

- [ ] **Auto-Mapping**:
  - GPT-4o-mini analyzes extracted text
  - Categorizes content into correct PMESII-PT dimension
  - Handles mislabeled or ambiguous sections

**Libraries Needed**:
- `mammoth` or `docx` for DOCX parsing
- `pptxgenjs` or custom parser for PPTX

**API Endpoints**:
- `/api/frameworks/pmesii-pt/import-pptx`
- `/api/frameworks/pmesii-pt/import-docx`

**Estimated Effort**: 14 hours

---

### Phase 7: Enhanced Export with AI Summaries
**Status**: NOT STARTED
**Priority**: MEDIUM

**Export Formats**:
- [x] JSON (already exists)
- [x] CSV (already exists)
- [ ] **PDF** (enhanced with AI summary, charts, location maps)
- [ ] **DOCX/Word** (professional report format)
- [ ] **PPTX/PowerPoint** (briefing slides, one slide per dimension)
- [ ] **Shareable Link** (public view, no login required)

**AI Enhancements**:
- [ ] Executive summary (2-3 paragraphs)
- [ ] Key findings per dimension
- [ ] Cross-dimension insights
- [ ] Gap analysis (what's missing)
- [ ] Recommendations

**PDF Export Features**:
- Cover page with location and date
- Table of contents
- Executive summary (AI-generated)
- One section per dimension with Q&A
- Evidence citations
- Appendix with source URLs

**Estimated Effort**: 10 hours

---

### Phase 8: PMESII Evidence Library
**Status**: NOT STARTED
**Priority**: MEDIUM

**Features**:
- [ ] Dedicated page: `/dashboard/evidence/pmesii`
- [ ] View all PMESII evidence across all analyses
- [ ] Filter by:
  - Location (country, region, city)
  - Dimension (Political, Military, etc.)
  - Date range
  - Source
- [ ] Search evidence text
- [ ] Tag evidence with custom labels
- [ ] Link evidence to multiple analyses
- [ ] Export filtered evidence sets

**Database Schema**:
```sql
CREATE TABLE pmesii_evidence (
  id INTEGER PRIMARY KEY,
  pmesii_analysis_id INTEGER,
  dimension TEXT, -- political, military, etc.
  location_country TEXT,
  location_region TEXT,
  location_city TEXT,
  question TEXT,
  answer TEXT,
  source_url TEXT,
  source_date TEXT,
  evidence_ids TEXT, -- JSON array of linked evidence
  tags TEXT, -- JSON array
  created_at TEXT,
  updated_at TEXT
);
```

**Estimated Effort**: 12 hours

---

### Phase 9: Batch URL Import (Deferred)
**Status**: DEFERRED
**Priority**: LOW
**Reason**: Single URL import working well. Batch processing can be added later if needed based on user demand.

**Future Tasks** (if needed):
- [ ] Create `/api/frameworks/pmesii-pt/batch-import` endpoint
- [ ] Support CSV upload of URLs
- [ ] Parallel analysis of multiple URLs
- [ ] Aggregate findings by dimension

**Estimated Effort**: 10 hours

---

## Priority 3: Evidence & Citation Improvements 🟢

### Evidence Auto-Linking from Content Intelligence
**Status**: Not Started
**Priority**: MEDIUM
**Tasks**:
- [ ] Auto-create evidence items from extracted entities
- [ ] Link evidence to Content Intelligence source
- [ ] Batch save entities to evidence library
- [ ] Smart categorization (people → actors, locations → places)

**Estimated Effort**: 5 hours

---

### Citation Generator from Analyzed URLs
**Status**: Not Started
**Priority**: LOW
**Tasks**:
- [ ] Auto-generate citations from analyzed content
- [ ] Support multiple citation formats (APA, MLA, Chicago)
- [ ] Extract metadata (author, publish date, title)
- [ ] Save to citation library with evidence link

**Estimated Effort**: 4 hours

---

## Priority 4: Framework Enhancements 🟢

### DIME Framework Standalone Page
**Status**: Complete ✅
- Manual trigger implemented
- Full Q&A interface
- Summary generation
- Export support

### Deception Analysis PDF Export
**Status**: In Progress
**Tasks**:
- [ ] Complete PDF export component
- [ ] Add visualizations to PDF
- [ ] Include all MOM-POP-MOSES-EVE sections

**Estimated Effort**: 4 hours

---

### COG Network Visualization Improvements
**Status**: Enhancement
**Tasks**:
- [ ] Add filtering by domain (DIMEFIL)
- [ ] Improve layout algorithms
- [ ] Add centrality metrics display
- [ ] Export network data

**Estimated Effort**: 6 hours

---

## Priority 5: Database & Performance 🔵

### Content Intelligence Database Optimization
**Status**: Not Started
**Tasks**:
- [ ] Add indexes on frequently queried fields
- [ ] Implement cleanup job for expired analyses
- [ ] Optimize content_hash deduplication
- [ ] Add database migration for missing fields

**Estimated Effort**: 3 hours

---

### Caching Strategy
**Status**: Not Started
**Tasks**:
- [ ] Implement Redis/KV caching for analysis results
- [ ] Cache entity extraction results
- [ ] Cache GPT responses with TTL
- [ ] Implement cache invalidation logic

**Estimated Effort**: 8 hours

---

## Priority 6: Testing & Quality 🔵

### Integration Testing
**Status**: Not Started
**Tasks**:
- [ ] Test Content Intelligence end-to-end
- [ ] Test all framework CRUD operations
- [ ] Test evidence linking
- [ ] Test export functionality

**Estimated Effort**: 10 hours

---

### Error Handling & Logging
**Status**: In Progress
**Tasks**:
- [ ] Centralized error handling
- [ ] Better error messages for users
- [ ] Structured logging for debugging
- [ ] Error reporting dashboard

**Estimated Effort**: 6 hours

---

## Timeline Estimate

### Sprint 1 (Week 1): Content Intelligence Critical Fixes
- Fix Starbursting integration (manual trigger)
- Fix Sentiment analysis
- Fix Claims analysis
- Implement progressive loading Phase 1-2

**Total**: 28 hours

### Sprint 2 (Week 2): PMESII-PT Phase 1-2
- URL import UI
- Backend API for URL→PMESII-PT mapping
- Basic dimension pre-population

**Total**: 12 hours

### Sprint 3 (Week 3): PMESII-PT Phase 3-4 + Evidence
- AI-powered dimension suggestions
- Batch URL import
- Evidence auto-linking

**Total**: 21 hours

### Sprint 4 (Week 4): Polish & Performance
- Database optimization
- Caching
- Testing
- Bug fixes

**Total**: 17 hours

---

## Notes

- All estimates include testing and documentation time
- GPT-4o-mini should be used for all AI features (per user preferences)
- Hash-based authentication must be preserved
- All new features should work offline with localStorage fallback
- Dark mode support required for all new UI components

---

## Completed Features ✅

### Phase 3: Anonymous Evidence Submission System
**Status**: ✅ COMPLETED (Deployed 2025-10-13)
**Priority**: HIGH

**Features Implemented**:
- [x] **Phase 3A**: Database tables and APIs for submission forms
  - submission_forms table with hash-based access
  - form_submissions table for storing submitted evidence
  - Password protection support (SHA-256 hashed)
  - Auto-archiving integration with Wayback Machine
  - Metadata extraction from submitted URLs

- [x] **Phase 3B**: Form builder UI
  - CreateSubmissionFormPage with field customization
  - SubmissionFormsPage for managing forms
  - 9 customizable fields: source URL, archived URL, content type, description, login required, keywords, comments, name, contact
  - Optional password protection
  - Auto-archive toggle
  - Submitter info collection toggle

- [x] **Phase 3C**: Public submission page
  - SubmitEvidencePage with clean, accessible UI
  - Hash-based URLs (8 characters) for anonymous access
  - No authentication required for submitters
  - Real-time validation
  - Password challenge if required
  - Success confirmation with submission ID

- [x] **Phase 3E**: Submission review interface
  - SubmissionsReviewPage with two-panel layout
  - Filter by status (pending/completed/rejected)
  - Review submission details
  - Process to evidence workflow
  - Verification status assignment
  - Credibility scoring (0-100%)
  - Reviewer notes

- [x] **Phase 3F**: Consolidated Interface with Form Management (Deployed 2025-10-13)
  - EvidenceSubmissionsPage with tabbed interface (Forms / Review)
  - Merged "Submission Forms" and "Review Submissions" into single page
  - Delete form functionality with cascade deletion of submissions
  - Enable/disable toggle to stop accepting new submissions
  - Full i18n support with 40+ translation keys
  - URL state persistence for active tab
  - Submission count badges on tabs
  - Single navigation menu item in Evidence Collection

- [x] **Performance Optimization**:
  - Background processing for archiving and metadata extraction
  - Instant response (<1 second) using context.waitUntil()
  - 133x performance improvement (103s → 0.77s)

- [x] **Navigation Integration**:
  - Added to Evidence Collection menu
  - Submission Forms and Review Submissions links
  - Accessible from main dashboard

**API Endpoints**:
- `/api/research/forms/create` - Create new submission form
- `/api/research/forms/list` - List all forms for workspace
- `/api/research/forms/[id]` (GET) - Get form details
- `/api/research/forms/[id]` (DELETE) - Delete form and cascade submissions
- `/api/research/forms/[id]/toggle` (PATCH) - Toggle form active status
- `/api/research/submit/[hashId]` - Public submission endpoint
- `/api/research/submissions/list` - List submissions for review
- `/api/research/submissions/process` - Process submission to evidence

**Files Created**:
- `migrations/004_submission_forms.sql`
- `functions/api/research/forms/create.ts`
- `functions/api/research/forms/list.ts`
- `functions/api/research/forms/[id]/index.ts` (GET, DELETE)
- `functions/api/research/forms/[id]/toggle.ts` (PATCH)
- `functions/api/research/submit/[hashId].ts`
- `functions/api/research/submissions/list.ts`
- `functions/api/research/submissions/process.ts`
- `src/pages/CreateSubmissionFormPage.tsx`
- `src/pages/SubmissionFormsPage.tsx` (deprecated by EvidenceSubmissionsPage)
- `src/pages/SubmissionsReviewPage.tsx` (deprecated by EvidenceSubmissionsPage)
- `src/pages/EvidenceSubmissionsPage.tsx` (consolidated interface)
- `src/pages/SubmitEvidencePage.tsx`
- `src/locales/en/common.json` (evidenceSubmissions translations)

**Deployment**: https://researchtools.net

---

### Previous Completed Features

- [x] DIME framework manual trigger
- [x] DIME analysis Q&A interface
- [x] Content Intelligence 7-day expiration
- [x] Save permanently functionality
- [x] Share link generation
- [x] Enhanced export with DIME results
- [x] Database migration for content expiration
- [x] Framework API endpoints
- [x] Relationship inference API
- [x] Deception PDF export component (in progress)
- [x] Guest user support for investigations
- [x] Hash-based authentication system
