# ACH Framework - Complete Implementation Roadmap

## ✅ Phase 3: PUBLIC SHARING (COMPLETED)
**Timeline:** Sprint 3 - Weeks 5-6
**Status:** ✅ COMPLETE (100%)
**Deployment:** https://afb9461e.researchtoolspy.pages.dev

### Completed ✅
- [x] Database migration for public sharing
- [x] Backend API endpoints (share, public view, clone, discovery)
- [x] Type updates (ACHDomain, public fields)
- [x] ACHShareButton component
- [x] ShareButton integration in ACHAnalysisPage
- [x] PublicACHPage component
- [x] PublicACHLibraryPage component
- [x] Route configuration (/public/ach and /public/ach/:token)
- [x] Build and deployment

### Features Delivered ✨
- **Public Sharing:** Analysts can make ACH analyses public with share tokens
- **Discovery Page:** Browse public ACH analyses at /public/ach
- **Domain & Tag Filtering:** Search and filter by intelligence domain and tags
- **View Tracking:** Track views and clones of public analyses
- **Clone to Workspace:** Users can clone public analyses to their own workspace
- **Read-only Matrix:** Public view shows ACH matrix without scores (to prevent bias)

---

## 📅 Phase 1: ENHANCED WORKFLOW & UX
**Timeline:** Sprint 1 - Weeks 1-2
**Priority:** HIGH
**Estimated Effort:** 80 hours

### Epic 1.1: Unified Analysis Dashboard
**Story Points:** 13

**Tasks:**
1. Create `ACHAnalysisDashboard.tsx` layout component
   - Top section: Analysis metadata (title, question, status)
   - Left panel: Hypotheses list with quick stats
   - Center panel: Evidence list with inline scoring
   - Right panel: Real-time diagnostics
   - Responsive design for mobile/tablet

2. Implement real-time score aggregation
   - Calculate hypothesis strength on every score update
   - Update diagnostics panel live
   - Show confidence indicators

3. Add keyboard navigation
   - Arrow keys to navigate matrix
   - Number keys for scoring
   - Tab/Shift+Tab between cells
   - Space to open notes dialog

**Acceptance Criteria:**
- All analysis components visible on one screen
- No page navigation needed to score
- Keyboard shortcuts work in matrix
- Real-time updates working

**Dependencies:** None
**Risks:** Complex state management

---

### Epic 1.2: AI-Assisted Hypothesis Generation
**Story Points:** 8

**API Endpoint:** `/api/ai/generate-hypotheses`

**Input Schema:**
```typescript
{
  question: string,
  context: string,
  num_hypotheses: number (3-7),
  existing_hypotheses?: string[]
}
```

**Output Schema:**
```typescript
{
  hypotheses: [{
    text: string,
    rationale: string,
    type: 'primary' | 'alternative' | 'null'
  }]
}
```

**Tasks:**
1. Create backend endpoint in `functions/api/ai/generate-hypotheses.ts`
   - Use gpt-5-mini model
   - Structured prompt for ACH methodology
   - Return 3-7 diverse, mutually exclusive hypotheses

2. Add UI in `ACHAnalysisForm.tsx`
   - "✨ AI Generate Hypotheses" button
   - Loading state during generation
   - Preview/edit before accepting
   - Option to regenerate

3. Prompt engineering
   - Ensure hypotheses are mutually exclusive
   - Include null hypothesis
   - Vary plausibility levels
   - Context-aware generation

**Acceptance Criteria:**
- Generates 3-7 diverse hypotheses
- Hypotheses are mutually exclusive
- User can edit before accepting
- Fast response (< 5 seconds)

**Dependencies:** OpenAI API access
**Risks:** Cost management, quality control

---

### Epic 1.3: Diagnostic Evidence Ranking
**Story Points:** 8

**API Endpoint:** `/api/ai/rank-diagnostic-evidence`

**Algorithm:**
```
Diagnosticity Score =
  (Max Score Difference / Total Evidence) *
  (Number of Hypotheses Eliminated / Total Hypotheses) * 100
```

**Tasks:**
1. Create diagnostic ranking algorithm
   - Calculate potential to eliminate hypotheses
   - Factor in current score patterns
   - Consider evidence credibility

2. Update ACHMatrix component
   - Sort evidence by diagnosticity
   - Highlight high-value evidence
   - Show diagnosticity score badge

3. Add filter controls
   - Filter by diagnosticity level
   - Group by scored/unscored
   - Search evidence

**Acceptance Criteria:**
- Evidence sorted by diagnostic value
- Visual indicators for high-value items
- Filtering works correctly
- Performance < 100ms for recalculation

**Dependencies:** Scoring data
**Risks:** Algorithm complexity

---

### Epic 1.4: Incremental Evidence Addition
**Story Points:** 5

**Tasks:**
1. Create `ACHEvidenceQuickAdd.tsx` modal
   - Search existing evidence library
   - Filter by title, content, source
   - Preview evidence details
   - Multi-select support

2. Add "+ Add Evidence" button to matrix
   - Opens modal
   - Preserves current view/scores
   - Refreshes matrix on add

3. Integrate with existing evidence API
   - Reuse Evidence Library queries
   - Link evidence on selection
   - Update matrix immediately

**Acceptance Criteria:**
- Can add evidence without leaving matrix
- Search is fast and relevant
- No loss of current work
- Matrix updates smoothly

**Dependencies:** Evidence Library API
**Risks:** None

---

## 📅 Phase 2: ADVANCED ANALYTICS & INSIGHTS
**Timeline:** Sprint 2 - Weeks 3-4
**Priority:** MEDIUM
**Estimated Effort:** 60 hours

### Epic 2.1: Enhanced Hypothesis Analysis
**Story Points:** 13

**New Metrics:**
```typescript
interface EnhancedHypothesisAnalysis {
  // Existing
  hypothesisId: string
  totalScore: number
  weightedScore: number
  supportingEvidence: number
  contradictingEvidence: number

  // NEW
  evidenceGaps: string[]
  strengthTrend: 'increasing' | 'stable' | 'decreasing'
  biasIndicators: {
    confirmationBias: number  // 0-100
    anchoringBias: number
  }
  sensitivityAnalysis: {
    worstCase: number
    bestCase: number
    confidenceInterval: [number, number]
  }
}
```

**Tasks:**
1. Create `src/utils/ach-analytics.ts`
   - Implement bias detection algorithms
   - Calculate sensitivity ranges
   - Identify evidence gaps

2. Build insights panel UI
   - Show hypothesis rankings
   - Display bias warnings
   - Visualize confidence intervals
   - Highlight evidence gaps

3. Add export to reports
   - Include analytics in exports
   - Professional formatting
   - Charts and visualizations

**Acceptance Criteria:**
- All metrics calculate correctly
- Bias detection identifies issues
- UI is clear and actionable
- Performance acceptable (< 500ms)

**Dependencies:** Score data
**Risks:** Algorithm validation

---

### Epic 2.2: Deception Detection Analysis
**Story Points:** 8

**Detection Indicators:**
- Evidence supporting only one hypothesis (suspicious)
- Evidence contradicting all but one (suspicious)
- Low-credibility sources supporting unlikely hypotheses
- Timeline inconsistencies
- Unnatural score patterns

**Tasks:**
1. Implement detection algorithms
   - Statistical anomaly detection
   - Pattern recognition
   - Credibility analysis

2. Create "🔍 Deception Analysis" tab
   - List flagged evidence
   - Explain why flagged
   - Severity indicators
   - Analyst notes

3. Add to analytical reports
   - Include in exports
   - Visualization of patterns
   - Recommendations

**Acceptance Criteria:**
- Detects known deception patterns
- Low false positive rate (< 10%)
- Clear explanations
- Actionable recommendations

**Dependencies:** Credibility scores
**Risks:** False positives

---

### Epic 2.3: Historical Tracking & Versioning
**Story Points:** 8

**Database Schema:**
```sql
CREATE TABLE ach_score_history (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  notes TEXT,
  scored_by TEXT,
  scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  snapshot_reason TEXT,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id)
);
```

**Tasks:**
1. Database migration for history tracking
2. Update scoring API to save history
3. Create timeline visualization
4. Add comparison mode (before/after)

**Acceptance Criteria:**
- History tracked automatically
- Timeline shows evolution
- Comparison mode works
- Performance acceptable

**Dependencies:** None
**Risks:** Storage costs

---

## 📅 Phase 4: ENHANCED EXPORT & REPORTING
**Timeline:** Sprint 5 - Week 9
**Priority:** LOW
**Estimated Effort:** 40 hours

### Epic 4.1: Professional Report Generation
**Story Points:** 13

**Report Sections:**
1. Executive Summary
   - Hypothesis rankings
   - Key findings
   - Confidence assessment

2. Methodology
   - ACH explanation
   - Scale type used
   - Analyst information

3. Full Analysis Matrix
   - Color-coded scores
   - Evidence details
   - Credibility indicators

4. Diagnostic Analysis
   - Key evidence
   - Deception flags
   - Confidence intervals

5. Appendices
   - All evidence full text
   - Score history
   - Notes and rationale

**Export Formats:**
- PDF (jsPDF)
- Word (docxtemplater)
- PowerPoint (pptxgen)
- HTML (styled, printable)

**Tasks:**
1. Create report templates
2. Implement PDF generation
3. Implement Word export
4. Implement PowerPoint export
5. Style HTML export

**Acceptance Criteria:**
- Professional appearance
- All formats work
- Branding optional
- Fast generation (< 10s)

**Dependencies:** Library installations
**Risks:** Template complexity

---

### Epic 4.2: Shareable Report Links
**Story Points:** 5

**API Endpoint:** `/api/ach/:id/report-link`

**Features:**
- Generate unique report token
- Standalone report page
- Print-optimized layout
- Optional: PDF generation server-side

**Tasks:**
1. Create report token API
2. Build PublicACHReportPage
3. Style for printing
4. Add "Generate Report Link" button

**Acceptance Criteria:**
- Unique shareable links
- No login required
- Print-friendly
- Fast loading

**Dependencies:** Report generation
**Risks:** None

---

## 🎯 Success Metrics

### User Efficiency
- **Time to Complete Analysis:** Target 50% reduction (30min → 15min)
- **Clicks to Score Evidence:** Target 0 (unified dashboard)
- **Evidence Selection Time:** Target 70% reduction
- **Hypothesis Quality Score:** Target 8/10 average

### Analysis Quality
- **Hypothesis Diversity Index:** Measure coverage of possibility space
- **Diagnostic Evidence Usage:** Target 80%+ high-diagnostic evidence
- **Deception Detection Rate:** Target 90% sensitivity
- **Confidence Accuracy:** Compare predicted vs. actual outcomes

### Adoption & Engagement
- **Public Analyses Created:** Track growth month-over-month
- **Clone Rate:** Target 20% of viewers clone
- **Collaboration Rate:** Target 30% of analyses have 2+ collaborators
- **Weekly Active Users:** Track usage trends

### User Satisfaction
- **Net Promoter Score (NPS):** Target 40+
- **Feature Usage Rate:** Track % using AI features
- **Time Saved (Self-Reported):** Survey users
- **Recommendation Rate:** % who recommend to colleagues

---

## 🚧 Technical Dependencies

### Infrastructure
- OpenAI API access (gpt-5-mini)
- Cloudflare D1 database
- Cloudflare Pages Functions
- KV store for caching (optional)

### Libraries to Add
- `jspdf` - PDF generation
- `docxtemplater` - Word export
- `pptxgen` - PowerPoint export
- `html2canvas` - Chart export
- `xlsx` - Excel export
- `recharts` - Visualizations

### Migrations Required
- Migration 013: Public sharing ✅
- Migration 014: Score history
- Migration 015: Deception flags
- Migration 016: Analytics cache

---

## 📊 Resource Allocation

### Development Team
- **Lead Developer:** 40 hrs/sprint
- **Backend Developer:** 20 hrs/sprint
- **UI/UX Developer:** 20 hrs/sprint
- **QA Engineer:** 10 hrs/sprint

### Timeline Overview
- **Sprint 1 (Workflow):** Weeks 1-2
- **Sprint 2 (Analytics):** Weeks 3-4
- **Sprint 3 (Sharing):** Weeks 5-6 ✅ IN PROGRESS
- **Sprint 4 (Collaboration):** Week 7-8
- **Sprint 5 (Reports):** Week 9
- **Buffer/Polish:** Week 10

### Total Estimated Effort
- **Phase 1:** 80 hours
- **Phase 2:** 60 hours
- **Phase 3:** 40 hours ✅ IN PROGRESS
- **Phase 4:** 40 hours
- **Total:** 220 hours (~6 weeks with 2-person team)

---

## 🎓 Training & Documentation

### User Documentation Needed
1. ACH Methodology Guide
2. Getting Started Tutorial
3. AI Features Guide
4. Collaboration Best Practices
5. Public Sharing Guide
6. Report Generation Guide

### Developer Documentation
1. API Reference
2. Database Schema
3. Component Architecture
4. Testing Strategy
5. Deployment Guide

---

## 🔐 Security & Compliance

### Access Control
- Public analyses: Read-only for all
- Private analyses: Owner + collaborators only
- Collaboration: Role-based permissions
- Cloning: Creates independent copy

### Data Protection
- User data not exposed in public views
- Share tokens cryptographically random
- Deletion cascades properly
- Audit trail for sensitive operations

### Compliance Considerations
- GDPR: Data export, right to deletion
- Security clearance handling (future)
- Attribution requirements
- License for public sharing (CC-BY?)

---

## 📅 Phase 5: BEHAVIOR ANALYSIS ENHANCEMENTS
**Timeline:** Sprint 6 - Week 11-12
**Priority:** HIGH
**Estimated Effort:** 60 hours

### Epic 5.1: Environmental Factors Structured Input
**Story Points:** 8

**Problem:** Environmental factors currently stored as raw JSON array. Need structured component similar to Consequences/Symbols.

**Tasks:**
1. Create `EnvironmentalFactorsManager.tsx` component
   - Category selection (physical, resource, accessibility, regulatory, environmental)
   - Factor name/description fields
   - Add/edit/remove functionality
   - Grouped display by category

2. Update `behavior.ts` types
   - Define `EnvironmentalFactorItem` interface
   - Add `category` field for grouping

3. Integrate with Behavior Analysis form
   - Replace JSON input with new manager
   - Migrate existing data structure

**Acceptance Criteria:**
- Environmental factors stored as structured array
- Each factor has name, description, category
- UI matches Consequences/Symbols pattern
- Easy to add, edit, remove factors

---

### Epic 5.2: AI-Assisted Consequences Generation
**Story Points:** 5

**Tasks:**
1. Create `/api/ai/generate-consequences` endpoint
   - Analyze behavior context (title, description, timeline)
   - Generate 3-5 consequences across timeframes (immediate, long-term, generational)
   - Return structured ConsequenceItem array

2. Add AI button to ConsequencesManager
   - "✨ AI Generate Consequences" button
   - Loading state during generation
   - Preview/edit before accepting
   - Option to merge with existing or replace

**Acceptance Criteria:**
- AI generates diverse consequences
- Covers all timeframes
- Identifies who is affected
- User can review before accepting

---

### Epic 5.3: AI-Assisted Symbols/Signals Generation
**Story Points:** 5

**Tasks:**
1. Create `/api/ai/generate-symbols` endpoint
   - Analyze behavior context
   - Generate 3-5 symbols across types (visual, auditory, social)
   - Provide descriptions and context

2. Add AI button to SymbolsManager
   - "✨ AI Generate Symbols" button
   - Preview before accepting
   - Merge or replace options

**Acceptance Criteria:**
- AI generates relevant symbols for behavior
- Covers different symbol types
- Provides context/usage information
- User can review before accepting

---

### Epic 5.4: Enhanced Target Audience AI Generation
**Story Points:** 8

**Current Problem:** Target audience generation doesn't consider:
- Actions/behaviors themselves
- Users who DO vs. DON'T perform action
- Limitations and obstacles
- Location context

**Tasks:**
1. Update AI prompt context to include:
   - Behavior title, description, complexity
   - Location context (geographic scope, locations)
   - Temporal context (frequency, timing)
   - Eligibility requirements
   - Environmental factors
   - Obstacles/limitations

2. Generate comprehensive audience segments:
   - Current performers (who already does this)
   - Potential performers (who could do this)
   - Barrier-facing groups (who can't do this)
   - Non-performers (who doesn't/won't do this)

3. Add audience characteristics:
   - Demographics
   - Motivations
   - Barriers they face
   - Relationship to behavior

**Acceptance Criteria:**
- AI considers ALL form context
- Generates diverse audience segments
- Identifies barriers and enablers
- Distinguishes doers from non-doers

---

## Next Actions

1. **IMMEDIATE:** Bug fixes
   - [x] Fix timeline generation syntax error
   - [x] Fix framework save validation
   - [x] Deploy fixes

2. **WEEK 11-12:** Phase 5 (Behavior Analysis Enhancements)
   - Prioritize Epic 5.1 (Environmental Factors)
   - Then Epic 5.4 (Target Audiences)
   - Then Epics 5.2 & 5.3 (AI for Consequences/Symbols)

3. **WEEK 13+:** Phase 1 or 2 (based on user feedback)
   - Survey users after Phase 5 completion
   - Prioritize based on requests

4. **ONGOING:** Metrics & iteration
   - Track usage analytics
   - Gather user feedback
   - Iterate based on data
