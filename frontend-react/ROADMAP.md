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
**Status**: Broken
**Priority**: HIGH
**Issue**: Sentiment analysis not working or returning errors
**Root Causes to Investigate**:
- [ ] GPT API integration issues
- [ ] JSON parsing failures
- [ ] Missing or malformed sentiment_analysis field in database
- [ ] Frontend rendering errors

**Tasks**:
- [ ] Debug backend sentiment analysis endpoint
- [ ] Check GPT prompt and response format
- [ ] Validate database schema for sentiment_analysis column
- [ ] Add error handling and fallbacks
- [ ] Test with sample articles
- [ ] Add retry logic for failed analyses

**Estimated Effort**: 6 hours

---

### Claims Analysis Broken
**Status**: Broken
**Priority**: HIGH
**Issue**: Claim detection and deception analysis not functioning
**Root Causes to Investigate**:
- [ ] GPT API failures
- [ ] claim_analysis field not saving to database
- [ ] Frontend parsing errors
- [ ] Empty or null responses from analysis

**Tasks**:
- [ ] Debug backend claim analysis endpoint
- [ ] Fix GPT prompt for claim extraction
- [ ] Validate deception risk scoring logic
- [ ] Add comprehensive error logging
- [ ] Test with controversial content
- [ ] Add manual claim entry fallback

**Estimated Effort**: 6 hours

---

### Progressive Loading UX Improvement
**Status**: Enhancement
**Priority**: HIGH
**Issue**: All-or-nothing loading bar creates poor UX, users wait for everything before seeing anything
**Solution**:
- [ ] **Phase 1: Show Summary First** (Fastest to display)
  - Extract and display summary within 2-3 seconds
  - Show skeleton loaders for other sections
  - Allow user to read summary while other analysis runs

- [ ] **Phase 2: Progressive Component Loading**
  - Load in priority order:
    1. Summary (immediate)
    2. Word frequency (fast, no GPT)
    3. Entities (moderate, spaCy/NER)
    4. Sentiment (slower, GPT)
    5. Claims (slower, GPT)
    6. DIME (on-demand only)
    7. Starbursting (on-demand only)

- [ ] **Phase 3: Independent Analysis States**
  - Each component has own loading state
  - Failed components don't block others
  - Retry buttons for failed sections
  - Cache successful analyses

- [ ] **Phase 4: Background Analysis**
  - Start word/entity analysis immediately
  - Queue GPT analyses (sentiment, claims) as background jobs
  - Use WebSocket or polling to update UI when ready
  - Show progress notifications

**Implementation**:
```typescript
// New loading states
interface AnalysisProgress {
  summary: 'pending' | 'loading' | 'complete' | 'error'
  wordFrequency: 'pending' | 'loading' | 'complete' | 'error'
  entities: 'pending' | 'loading' | 'complete' | 'error'
  sentiment: 'pending' | 'loading' | 'complete' | 'error'
  claims: 'pending' | 'loading' | 'complete' | 'error'
  dime: 'idle' | 'loading' | 'complete' | 'error'
  starbursting: 'idle' | 'loading' | 'complete' | 'error'
}

// API changes
POST /api/content-intelligence/analyze
→ Returns basic metadata + summary immediately
→ Starts background jobs for other analyses
→ Returns job IDs for polling

GET /api/content-intelligence/status/:analysisId
→ Returns completion status for each component
→ Frontend polls this every 2 seconds
```

**Estimated Effort**: 12 hours

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
**Status**: NOT STARTED
**Priority**: CRITICAL
**Issue**: PMESII-PT is fundamentally geographic but lacks location context

**Requirements**:
- [ ] **Location Selector**: Add country, state/region, city fields to PMESII-PT
  - Required field: At minimum country
  - Optional: State/region, city for more specificity
  - Auto-suggest locations (use existing location entities)
  - Display location prominently in analysis header

- [ ] **Evidence Integration**: Transform PMESII-PT into evidence library
  - Each Q&A item should link to evidence
  - Tag evidence with:
    - Location (country, region, city)
    - PMESII-PT dimension (Political, Military, etc.)
    - Source URL
    - Date/temporal context
  - Create "PMESII Evidence Library" page showing all evidence by dimension and location

- [ ] **Framework Integration**: Feed PMESII evidence into ACH and other frameworks
  - PMESII evidence items appear as evidence options in ACH
  - Filter evidence by location and dimension
  - Cross-reference evidence across frameworks

**Estimated Effort**: 12 hours

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
- `/api/research/submit/[hashId]` - Public submission endpoint
- `/api/research/submissions/list` - List submissions for review
- `/api/research/submissions/process` - Process submission to evidence

**Files Created**:
- `migrations/004_submission_forms.sql`
- `functions/api/research/forms/create.ts`
- `functions/api/research/forms/list.ts`
- `functions/api/research/submit/[hashId].ts`
- `functions/api/research/submissions/list.ts`
- `functions/api/research/submissions/process.ts`
- `src/pages/CreateSubmissionFormPage.tsx`
- `src/pages/SubmissionFormsPage.tsx`
- `src/pages/SubmitEvidencePage.tsx`
- `src/pages/SubmissionsReviewPage.tsx`

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
