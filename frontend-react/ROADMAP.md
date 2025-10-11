# Research Tools Platform - Development Roadmap

## Priority 1: Content Intelligence Critical Fixes 🔴

### Starbursting Integration Failure
**Status**: Broken
**Priority**: HIGH
**Issue**: Starbursting auto-creation failing on Content Intelligence page
**Solution**:
- [ ] Convert to manual trigger (like DIME analysis)
- [ ] Add "Create Starbursting Session" button in Overview tab
- [ ] Show loading state during generation
- [ ] Display success/error states clearly
- [ ] Add badge to Starbursting tab showing status (Not Run / Processing / Ready)
- [ ] Fix background processing issues
- [ ] Test with various content types and lengths

**Estimated Effort**: 4 hours

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

## Priority 2: PMESII-PT Framework Enhancements 🟡

### Phase 1: URL Import Integration
**Status**: Not Started
**Priority**: MEDIUM
**Tasks**:
- [ ] Add "Import from URL" section to PMESII-PT create page
- [ ] Create URL input modal with analyze button
- [ ] Show loading state during analysis
- [ ] Display imported sources as badges
- [ ] Allow removal of imported sources
- [ ] Integrate with Content Intelligence analyze endpoint

**Files to Modify**:
- `src/components/frameworks/GenericFrameworkForm.tsx`
- `src/pages/frameworks/index.tsx` (PmesiiPtPage)

**Estimated Effort**: 4 hours

---

### Phase 2: Backend API for URL→PMESII-PT Mapping
**Status**: Not Started
**Priority**: MEDIUM
**Tasks**:
- [ ] Create `/api/frameworks/pmesii-pt/import-url` endpoint
- [ ] Analyze URL via Content Intelligence
- [ ] Map extracted content to 8 PMESII-PT dimensions
- [ ] Use GPT to generate dimension-specific Q&A pairs
- [ ] Return structured PMESII-PT data

**Dimension Mapping Logic**:
```typescript
Political: government, leaders, governance, political entities
Military: armed forces, defense, military operations, weapons
Economic: GDP, trade, resources, money entities, financial systems
Social: demographics, culture, education, social structures
Information: media, propaganda, information flow, communications
Infrastructure: transportation, utilities, facilities, infrastructure entities
Physical: geography, terrain, climate, environmental factors
Time: dates, historical context, temporal patterns
```

**Estimated Effort**: 8 hours

---

### Phase 3: AI-Powered Dimension Pre-Population
**Status**: Not Started
**Priority**: MEDIUM
**Tasks**:
- [ ] Create dimension-specific GPT prompts
- [ ] Generate guided questions for each dimension
- [ ] Auto-suggest answers based on imported content
- [ ] Add "Generate with AI" button per dimension
- [ ] Allow user to accept/reject/edit suggestions

**Estimated Effort**: 6 hours

---

### Phase 4: Batch URL Import
**Status**: Not Started
**Priority**: LOW
**Tasks**:
- [ ] Create `/api/frameworks/pmesii-pt/batch-import` endpoint
- [ ] Support CSV upload of URLs
- [ ] Parallel analysis of multiple URLs
- [ ] Aggregate findings by dimension
- [ ] Detect contradictions and patterns
- [ ] Generate comprehensive report

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
