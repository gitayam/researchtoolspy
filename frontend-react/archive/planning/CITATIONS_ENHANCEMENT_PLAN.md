# Citations Generator Enhancement Plan

**Created:** October 2, 2025
**Status:** Planning Phase 2-4
**Priority:** High
**Reference:** ZoteroBib (zbib.org) functionality model

---

## 🎯 Current Status

**Phase 1 Complete ✅**:
- Basic citation generation (4 styles)
- 5 source types
- URL auto-fill/scraping
- Copy to clipboard
- Real-time preview

**What's Missing**:
1. Citation library (save multiple citations)
2. Batch operations (copy all, sort, organize)
3. Persistent storage (come back later)
4. Citation-to-Evidence workflow
5. Integration with Evidence Collector
6. Integration with Dataset Library

---

## 📋 Phase 2: Citation Library (ZBib-style)

### Goals
Build a citation library where users can:
- Add multiple citations and see them in a list
- Sort and organize citations
- Copy individual or all citations
- Save citations to browser storage
- Export bibliography in multiple formats
- Edit existing citations
- Delete citations

### Features

#### 2.1 Citation Library UI (2-3 hours)
```
┌─────────────────────────────────────────────┐
│  My Citation Library                        │
│  [+ Add New Citation]                       │
├─────────────────────────────────────────────┤
│                                             │
│  Bibliography (5 citations)                 │
│  Style: [APA 7th v]  Sort: [Date v]        │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ 1. Egan, M. (2025). Elizabeth Warren  │ │
│  │    calls for Trump to release...      │ │
│  │    CNN. https://...                    │ │
│  │    [Edit] [Delete] [→ Evidence]        │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ 2. Smith, J. (2024). Research methods │ │
│  │    in qualitative analysis...          │ │
│  │    [Edit] [Delete] [→ Evidence]        │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Copy All] [Export Bibliography]          │
│  [Clear Library] [Save as Dataset]         │
└─────────────────────────────────────────────┘
```

#### 2.2 Citation Library Storage
**Technology**: Browser LocalStorage + D1 Database (for logged-in users)

**Schema**:
```typescript
interface CitationLibrary {
  id: string
  userId?: string  // null for anonymous
  name: string
  description?: string
  citations: SavedCitation[]
  createdAt: string
  updatedAt: string
}

interface SavedCitation {
  id: string
  citationStyle: CitationStyle
  sourceType: SourceType
  fields: CitationFields
  citation: string
  inTextCitation: string
  addedAt: string
  notes?: string
  tags?: string[]
}
```

#### 2.3 Sorting & Filtering
- Sort by: Date added, Author name, Title, Source type
- Filter by: Source type, Citation style, Tags
- Search: Full-text search across citations

#### 2.4 Batch Operations
- **Copy All** - Copy entire bibliography to clipboard
- **Select Multiple** - Checkbox selection for batch operations
- **Delete Multiple** - Bulk delete
- **Change Style** - Apply different citation style to all
- **Export All** - Export to various formats

#### 2.5 Export Formats
- **Plain Text** - Simple text format
- **RTF** - For Microsoft Word
- **HTML** - For web publishing
- **BibTeX** - For LaTeX users
- **RIS** - For EndNote, Zotero, Mendeley
- **JSON** - For programmatic access
- **CSV** - Spreadsheet format

---

## 📋 Phase 3: Citation-to-Evidence Workflow

### Goals
Enable users to easily convert citations into evidence items by filling in the claim field and other metadata.

### Features

#### 3.1 "Add as Evidence" Button
Each citation in the library has a button to convert it to evidence:

```
Citation Card:
┌───────────────────────────────────────┐
│ Smith, J. (2024). Research methods... │
│ [Edit] [Delete] [→ Add as Evidence]   │
└───────────────────────────────────────┘

Clicking "Add as Evidence" opens modal:
┌───────────────────────────────────────┐
│  Create Evidence from Citation        │
├───────────────────────────────────────┤
│                                       │
│  Title: Research methods in...        │
│  Source: Journal of Research (2024)   │
│  Citation: Smith, J. (2024)...       │
│                                       │
│  ⬇ Fill in Evidence Details          │
│                                       │
│  Claim: [________________________]   │
│  Type: [Academic Paper v]             │
│  Credibility: [●●●●○ 4/5]            │
│  Tags: research, methods, qualitative │
│  Notes: [________________________]   │
│                                       │
│  [Cancel] [Create Evidence]           │
└───────────────────────────────────────┘
```

#### 3.2 Pre-filled Evidence Fields
When creating evidence from citation, auto-fill:
- **Title** - From citation title
- **Source** - From citation source (journal, website, etc.)
- **Author** - From citation authors
- **Date** - From citation date
- **URL** - If available
- **Citation** - Full formatted citation
- **Type** - Inferred from source type (journal → academic, website → web_article)

**User only needs to add**:
- Claim (required)
- Credibility rating (optional)
- Tags (optional)
- Notes (optional)

#### 3.3 Reverse Workflow: Evidence-to-Citation
Also enable adding citations to existing evidence:

```
Evidence Detail Page:
┌───────────────────────────────────────┐
│  Evidence: Climate change impacts     │
├───────────────────────────────────────┤
│  Citation: [Not set]                  │
│  [+ Generate Citation]                │
└───────────────────────────────────────┘

Clicking generates citation from evidence metadata
```

---

## 📋 Phase 4: Evidence & Dataset Integration

### 4.1 Evidence Collector Integration

**Add Citation Tab to Evidence Collector**:
```
Evidence Collector Page:
[📄 Manual Entry] [🔗 From URL] [📚 From Citation] [📦 Bulk Import]

From Citation Tab:
┌───────────────────────────────────────┐
│  Select from Citation Library         │
│                                       │
│  [x] Smith, J. (2024)...              │
│  [ ] Egan, M. (2025)...               │
│  [ ] Brown, K. (2023)...              │
│                                       │
│  Selected: 1 citations                │
│  [Import as Evidence] [Cancel]        │
└───────────────────────────────────────┘
```

**Features**:
- Import citations from library as evidence
- Batch import multiple citations
- Map citation fields to evidence fields
- Preserve citation formatting

### 4.2 Dataset Library Integration

**Create Dataset from Citations**:
```
Citation Library:
┌───────────────────────────────────────┐
│  My Citation Library (5 citations)    │
│  [Export as Dataset]                  │
└───────────────────────────────────────┘

Clicking opens:
┌───────────────────────────────────────┐
│  Create Dataset from Citations        │
├───────────────────────────────────────┤
│  Dataset Name: [Research Sources]     │
│  Description: [Citations for...]      │
│  Type: [Bibliography v]                │
│  Tags: research, citations             │
│                                       │
│  Include:                              │
│  ☑ Full citations (5 items)           │
│  ☑ Metadata (authors, dates, etc.)    │
│  ☑ URLs (where available)             │
│  ☑ Notes and tags                     │
│                                       │
│  [Create Dataset] [Cancel]             │
└───────────────────────────────────────┘
```

**Dataset Schema Extension**:
```typescript
interface Dataset {
  // ... existing fields
  type: 'web_article' | 'academic_paper' | 'bibliography' | ...
  bibliography?: {
    citations: SavedCitation[]
    style: CitationStyle
  }
}
```

### 4.3 Framework Integration

**Link Citations to Framework Analyses**:
- SWOT Analysis → Cite sources for strengths/weaknesses
- ACH Analysis → Cite evidence sources
- All frameworks → Bibliography section

```
SWOT Analysis Editor:
┌───────────────────────────────────────┐
│  Strengths                            │
│  • Strong market position             │
│    Source: [+ Add Citation]           │
└───────────────────────────────────────┘
```

---

## 📋 Phase 5: Git Workflow & Continuous Integration

### 5.1 Git Strategy

**Branch Structure**:
- `main` - Production-ready code
- `cloudflare/react-nextjs-to-vite` - Current development branch
- `feature/*` - Feature branches
- `release/*` - Release candidates

**Commit Strategy**:
- Commit after each completed feature/component
- Use conventional commits format
- Tag releases with semantic versioning

**Commit Format**:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Examples**:
```bash
feat(citations): add citation library with local storage
feat(citations): implement citation-to-evidence workflow
feat(citations): add export to BibTeX and RIS formats
fix(citations): correct APA author formatting for 3+ authors
docs(citations): update enhancement plan with zbib features
```

### 5.2 Tagging Strategy

**Tag Format**: `v<major>.<minor>.<patch>`

**Current Tags** (proposed):
- `v1.0.0` - Initial infrastructure complete
- `v1.1.0` - All 16 frameworks operational
- `v1.2.0` - Evidence system (Phases 1-3)
- `v1.3.0` - Basic tools (Content Extraction, Citations)
- `v1.4.0` - Advanced tools (URL Processing, Batch Processing)
- `v1.5.0` - Citations Library (Phase 2)
- `v1.6.0` - Citation-Evidence Integration (Phase 3-4)
- `v2.0.0` - Full production release

### 5.3 Continuous Commits Workflow

**After Each Feature**:
```bash
# 1. Stage changes
git add <files>

# 2. Commit with conventional format
git commit -m "feat(citations): add citation library storage"

# 3. Continue working
# (Push to remote periodically)

# After multiple related commits, create tag
git tag -a v1.5.0 -m "Citations Library feature complete"
git push origin cloudflare/react-nextjs-to-vite --tags
```

**Benefits**:
- Clean history
- Easy rollback
- Clear feature tracking
- Release management
- Deployment tracking

---

## 🚀 Implementation Timeline

### Phase 2: Citation Library (6-8 hours)
**Week 1**:
- [ ] Design citation library UI (1h)
- [ ] Implement local storage (1h)
- [ ] Build citation list component (2h)
- [ ] Add sort/filter functionality (1h)
- [ ] Implement batch operations (2h)
- [ ] Add export formats (1-2h)
- [ ] **Git**: Commit + tag `v1.5.0`

### Phase 3: Citation-to-Evidence (3-4 hours)
**Week 1-2**:
- [ ] Design citation-to-evidence modal (30m)
- [ ] Implement field mapping (1h)
- [ ] Build evidence creation flow (1.5h)
- [ ] Add reverse workflow (evidence → citation) (1h)
- [ ] Testing and refinement (30m)
- [ ] **Git**: Commit + tag `v1.5.1`

### Phase 4: Integration (4-5 hours)
**Week 2**:
- [ ] Evidence Collector integration (1.5h)
- [ ] Dataset Library integration (1.5h)
- [ ] Framework integration (1h)
- [ ] Testing cross-feature workflows (1h)
- [ ] **Git**: Commit + tag `v1.6.0`

### Phase 5: Git Workflow Setup (1 hour)
**Ongoing**:
- [ ] Set up conventional commits (15m)
- [ ] Create retrospective tags for existing work (15m)
- [ ] Document git workflow (15m)
- [ ] Set up CI/CD hooks (optional) (15m)

**Total Estimated Time**: 14-18 hours

---

## 🎯 Success Criteria

### Phase 2: Citation Library
- ✅ Users can add multiple citations
- ✅ Citations persist in browser storage
- ✅ Sort by author, date, title
- ✅ Copy all citations at once
- ✅ Export to 5+ formats (TXT, RTF, BibTeX, RIS, JSON)
- ✅ Edit and delete citations
- ✅ Change citation style for entire library

### Phase 3: Citation-to-Evidence
- ✅ One-click "Add as Evidence" button
- ✅ Pre-filled evidence form from citation
- ✅ User only adds claim + credibility
- ✅ Evidence created with full citation attached
- ✅ Reverse workflow (evidence → citation)

### Phase 4: Integration
- ✅ Import citations to Evidence Collector
- ✅ Create datasets from citation libraries
- ✅ Link citations to framework analyses
- ✅ Seamless data flow between all features

### Phase 5: Git Workflow
- ✅ Conventional commit format established
- ✅ Tags for all major features
- ✅ Clear version history
- ✅ Easy rollback capability

---

## 📊 Database Schema Updates

### New Tables

```sql
-- Citation Libraries
CREATE TABLE citation_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Saved Citations
CREATE TABLE saved_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  citation_style TEXT NOT NULL,
  source_type TEXT NOT NULL,
  fields JSON NOT NULL,
  citation TEXT NOT NULL,
  in_text_citation TEXT NOT NULL,
  notes TEXT,
  tags TEXT, -- JSON array
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (library_id) REFERENCES citation_libraries(id) ON DELETE CASCADE
);

-- Citation-Evidence Links
CREATE TABLE citation_evidence_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citation_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (citation_id) REFERENCES saved_citations(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_citation_libraries_user ON citation_libraries(user_id);
CREATE INDEX idx_saved_citations_library ON saved_citations(library_id);
CREATE INDEX idx_citation_evidence_citation ON citation_evidence_links(citation_id);
CREATE INDEX idx_citation_evidence_evidence ON citation_evidence_links(evidence_id);
```

---

## 🔄 Migration Path

1. **Current users** (no saved citations) → Start fresh with library
2. **Browser storage** → Export before clearing/switching browsers
3. **Future**: Sync to D1 database when logged in
4. **Anonymous users**: Library stored in localStorage only
5. **Logged-in users**: Sync to D1 + localStorage for offline access

---

**Next Steps**:
1. Review and approve this plan
2. Update CURRENT_STATUS_AND_ROADMAP.md
3. Begin Phase 2 implementation
4. Set up git tagging workflow
5. Start continuous commits

**Status**: Ready for review and implementation
