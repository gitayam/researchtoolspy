# Evidence System Migration Plan

**Created:** October 1, 2025
**Status:** In Progress - Phase 1
**Priority:** Critical

---

## 🎯 Executive Summary

**Problem:** Current "Evidence" system is actually a "Dataset/Source Library" - it stores where information comes from, not the analyzed evidence itself.

**Solution:**
1. Rename current Evidence → Datasets (Phase 1)
2. Build true Evidence Items system (Phase 2-4)

---

## 📊 Conceptual Model

### Datasets (Current "Evidence")
**What:** Sources of information
**Examples:**
- Research papers, government databases, APIs
- News articles, census data, congressional records
- "Where the data comes from"

### Evidence Items (NEW)
**What:** Analyzed facts extracted from datasets
**Examples:**
- "Meeting between Person A and B at Embassy X on Jan 15, 2025"
- "HR 1234 proposed by Senator Y on date Z"
- "Shoes found at door during tactical operation"
- "Economic indicator changed by 15% in Q4"

### Citations (NEW)
**What:** Links evidence to datasets with context
**Examples:**
- Evidence Item #123 → Dataset #45, Page 12, Quote: "..."
- Proper citation format (APA, MLA, Chicago)

---

## 🗄️ Database Schema Changes

### Phase 1: Rename Evidence → Datasets

**Step 1:** Create new datasets table (copy of evidence)
```sql
CREATE TABLE datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  source TEXT NOT NULL,
  tags TEXT,
  metadata TEXT,
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Additional dataset-specific fields
  source_name TEXT,
  source_url TEXT,
  author TEXT,
  organization TEXT,
  publication_date TEXT,
  access_date TEXT,
  reliability_rating TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
)
```

**Step 2:** Migrate data from evidence to datasets
```sql
INSERT INTO datasets SELECT * FROM evidence
```

**Step 3:** Rename framework_evidence → framework_datasets
```sql
CREATE TABLE framework_datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
  UNIQUE(framework_id, dataset_id, section_key)
)

INSERT INTO framework_datasets (framework_id, dataset_id, section_key, relevance_note, created_at, created_by)
SELECT framework_id, evidence_id, section_key, relevance_note, created_at, created_by
FROM framework_evidence
```

**Step 4:** Drop old tables (after verification)
```sql
DROP TABLE framework_evidence
DROP TABLE evidence
```

### Phase 2: Create Evidence Items System

**Evidence Items Table:**
```sql
CREATE TABLE evidence_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Core
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  summary TEXT,

  -- Classification
  evidence_type TEXT NOT NULL, -- observation, document_excerpt, statement, event, measurement, artifact
  category TEXT, -- tactical, operational, strategic

  -- 5 W's + How
  who_involved TEXT, -- JSON array
  what_happened TEXT,
  when_occurred TEXT, -- ISO timestamp or range
  where_occurred TEXT, -- JSON: {lat, lng, address, region}
  why_significant TEXT,
  how_obtained TEXT,

  -- Assessment
  reliability TEXT NOT NULL, -- A-F
  credibility TEXT NOT NULL, -- 1-6
  confidence_level TEXT, -- high, medium, low
  corroboration_count INTEGER DEFAULT 0,
  contradiction_count INTEGER DEFAULT 0,

  -- Relationships
  dataset_ids TEXT, -- JSON array
  related_evidence_ids TEXT, -- JSON
  contradicts_evidence_ids TEXT, -- JSON
  corroborates_evidence_ids TEXT, -- JSON

  -- Framework Categories
  pmesii_dimensions TEXT, -- JSON: [political, military, economic, social, infrastructure, information, physical_env, time]
  dime_domains TEXT, -- JSON: [diplomatic, information, military, economic]
  actor_types TEXT, -- JSON: [individual, organization, government, military, civilian]

  -- Metadata
  tags TEXT, -- JSON
  keywords TEXT, -- JSON
  sensitivity_level TEXT, -- public, sensitive, classified

  -- Tracking
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  verified_by INTEGER,

  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
)
```

**Citations Table:**
```sql
CREATE TABLE evidence_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  page_number TEXT,
  quote TEXT,
  context TEXT,
  citation_format TEXT, -- APA, MLA, Chicago
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
)
```

**Framework Evidence Linking:**
```sql
CREATE TABLE framework_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  weight REAL DEFAULT 1.0, -- How important this evidence is
  supports BOOLEAN DEFAULT 1, -- Does it support or contradict
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  UNIQUE(framework_id, evidence_id, section_key)
)
```

---

## 🔄 API Changes

### Phase 1: Rename Evidence API

**OLD:** `/api/evidence`
**NEW:** `/api/datasets`

**Transition Strategy:**
- Rename function file: `evidence.ts` → `datasets.ts`
- Keep `/api/evidence` as alias for backward compatibility (temporary)
- Update all frontend calls to use `/api/datasets`

**OLD:** `/api/framework-evidence`
**NEW:** `/api/framework-datasets`

### Phase 2: Create Evidence Items API

**NEW:** `/api/evidence-items`
- GET / - List evidence items (with filters)
- GET /:id - Get single evidence
- POST / - Create evidence
- PUT /:id - Update evidence
- DELETE /:id - Delete evidence
- POST /:id/citations - Add citation
- GET /:id/citations - Get citations
- GET /:id/related - Get related evidence
- POST /:id/corroborate - Mark as corroborating
- POST /:id/contradict - Mark as contradicting

**NEW:** `/api/framework-evidence`
- Links frameworks to evidence_items (not datasets)

---

## 🎨 UI/UX Changes

### Phase 1: Rename Components

**Navigation:**
```
OLD:
└── Evidence Collector

NEW:
└── Dataset Library
```

**Later (Phase 2):**
```
Evidence & Intelligence
├── Evidence Items (NEW - main analysis)
├── Dataset Library (renamed)
└── Citations (NEW)
```

**Components to Rename:**
1. `src/pages/EvidencePage.tsx` → `src/pages/DatasetPage.tsx`
2. `src/components/evidence/EvidenceForm.tsx` → `src/components/datasets/DatasetForm.tsx`
3. `src/components/evidence/EvidenceSelector.tsx` → `src/components/datasets/DatasetSelector.tsx`
4. `src/components/evidence/EvidenceBadge.tsx` → `src/components/datasets/DatasetBadge.tsx`
5. `src/types/evidence.ts` → `src/types/dataset.ts`

**Route Changes:**
```
OLD: /dashboard/evidence
NEW: /dashboard/datasets
```

### Phase 2: New Evidence Components

**Create:**
- `src/pages/EvidencePage.tsx` (NEW - for evidence items)
- `src/components/evidence/EvidenceItemForm.tsx`
- `src/components/evidence/EvidenceItemCard.tsx`
- `src/components/evidence/EvidenceDetail.tsx`
- `src/components/evidence/EvidenceTimeline.tsx`
- `src/components/evidence/EvidenceMap.tsx`
- `src/components/evidence/CitationManager.tsx`
- `src/types/evidence-item.ts`

---

## 📋 Implementation Checklist

### Phase 1: Rename & Restructure ✅ Starting Now

#### Database
- [ ] Create datasets table
- [ ] Migrate data from evidence to datasets
- [ ] Create framework_datasets table
- [ ] Migrate data from framework_evidence
- [ ] Verify data integrity
- [ ] Drop old tables

#### API
- [ ] Rename /api/evidence → /api/datasets
- [ ] Rename /api/framework-evidence → /api/framework-datasets
- [ ] Update all API logic
- [ ] Test all endpoints

#### Types
- [ ] Rename evidence.ts → dataset.ts
- [ ] Update type definitions
- [ ] Update imports across codebase

#### Components
- [ ] Rename EvidenceForm → DatasetForm
- [ ] Rename EvidenceSelector → DatasetSelector
- [ ] Rename EvidenceBadge → DatasetBadge
- [ ] Update component logic
- [ ] Update imports

#### Pages
- [ ] Rename EvidencePage → DatasetPage
- [ ] Update route configuration
- [ ] Update navigation sidebar
- [ ] Update all links

#### Framework Integration
- [ ] Update GenericFrameworkForm to use datasets
- [ ] Update framework views
- [ ] Test framework-dataset linking

#### Testing
- [ ] Test dataset CRUD operations
- [ ] Test dataset-framework linking
- [ ] Test all UI interactions
- [ ] Verify no broken functionality

### Phase 2: Evidence Items System (Next)
- [ ] Create evidence_items table
- [ ] Create evidence_citations table
- [ ] Create new framework_evidence table
- [ ] Build /api/evidence-items
- [ ] Build EvidenceItemForm
- [ ] Build Evidence page
- [ ] Build citation management
- [ ] Integrate with frameworks

---

## 🎯 Success Metrics

### Phase 1 Complete When:
- [x] All "Evidence" references changed to "Datasets"
- [ ] Dataset CRUD fully functional
- [ ] Dataset-Framework linking works
- [ ] No UI breaks or regressions
- [ ] Navigation and routes updated

### Phase 2 Complete When:
- [ ] Evidence items can be created with 5 W's
- [ ] Evidence can cite datasets
- [ ] Evidence can be linked to frameworks
- [ ] Corroboration/contradiction tracking works
- [ ] Timeline and map views functional

---

**Last Updated:** October 1, 2025
**Next Review:** After Phase 1 completion
