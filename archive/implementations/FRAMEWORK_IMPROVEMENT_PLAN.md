# Framework & Evidence System Improvement Plan

**Created:** October 1, 2025
**Status:** In Progress
**Priority:** High

---

## 📊 Current State Analysis

### What's Working ✅
- 13 frameworks with basic CRUD operations
- Generic form/view components
- Database persistence
- Search and filtering
- Responsive design

### What Needs Improvement 🔧

#### 1. **Framework Functionality**
- ❌ No evidence linking to frameworks
- ❌ No collaboration features
- ❌ No AI analysis integration
- ❌ No export functionality
- ❌ No duplicate/template features
- ❌ Limited validation
- ❌ No auto-save
- ❌ No version history

#### 2. **Evidence System**
- ❌ Form created but not integrated with Evidence page
- ❌ No evidence CRUD operations
- ❌ No file upload capability
- ❌ No evidence collections
- ❌ No linking evidence to frameworks
- ❌ No evidence tagging/categorization
- ❌ No source citation management

#### 3. **User Experience**
- ❌ No keyboard shortcuts
- ❌ No drag-and-drop
- ❌ No bulk operations
- ❌ No advanced search
- ❌ No sorting options
- ❌ Limited error messages

---

## 🎯 Improvement Plan

### Phase 1: Evidence System Enhancement (Priority 1)

#### 1.1 Complete Evidence CRUD
**Goal:** Make Evidence Collector fully functional and standalone

**Tasks:**
- [ ] Integrate EvidenceForm with EvidencePage
- [ ] Add evidence list display with cards
- [ ] Implement evidence CRUD API integration
- [ ] Add evidence detail view
- [ ] Add evidence editing
- [ ] Add evidence deletion with confirmation
- [ ] Add evidence status workflow (draft → review → verified)

**Components to Create:**
```
/src/components/evidence/
  - EvidenceCard.tsx          (Display evidence in list)
  - EvidenceDetail.tsx        (Full evidence view)
  - EvidenceList.tsx          (Grid/list of evidence)
  - EvidenceFilters.tsx       (Advanced filtering)
  - EvidenceStats.tsx         (Statistics dashboard)
```

**API Endpoints to Use:**
```
GET    /api/evidence           (List all evidence)
GET    /api/evidence?id={id}   (Get single evidence)
POST   /api/evidence           (Create evidence)
PUT    /api/evidence?id={id}   (Update evidence)
DELETE /api/evidence?id={id}   (Delete evidence)
```

#### 1.2 Evidence Collections
**Goal:** Group related evidence together

**Features:**
- Create evidence collections
- Add/remove evidence from collections
- Share collections
- Export collections

**Database Schema:**
```sql
-- Already exists in schema
evidence_collections (
  id, user_id, name, description,
  created_at, updated_at
)

evidence_collection_items (
  id, collection_id, evidence_id,
  order_index, notes
)
```

#### 1.3 Evidence-Framework Linking
**Goal:** Connect evidence pieces to framework analyses

**Features:**
- Link evidence to specific framework sections
- View evidence used in framework
- View frameworks using specific evidence
- Evidence impact tracking

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS framework_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(id)
);
```

**UI Components:**
```
/src/components/evidence/
  - EvidenceLinker.tsx        (Link evidence to frameworks)
  - EvidenceBadge.tsx         (Show linked evidence count)
  - EvidenceSelector.tsx      (Modal to select evidence)
```

---

### Phase 2: Framework Enhancements (Priority 2)

#### 2.1 Evidence Integration in Frameworks
**Goal:** Show and manage evidence within framework views

**Features:**
- View linked evidence in each section
- Add evidence directly from framework form
- Quick evidence preview
- Evidence reliability indicators

**Changes to GenericFrameworkForm:**
```tsx
<SectionCard>
  {/* Existing section content */}

  {/* NEW: Evidence section */}
  <div className="mt-4">
    <Label>Linked Evidence ({linkedEvidence.length})</Label>
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => openEvidenceSelector(section.key)}
      >
        <Link className="h-4 w-4 mr-2" />
        Link Evidence
      </Button>
    </div>
    {linkedEvidence.map(evidence => (
      <EvidenceBadge
        key={evidence.id}
        evidence={evidence}
        onRemove={() => removeEvidence(evidence.id)}
      />
    ))}
  </div>
</SectionCard>
```

#### 2.2 Framework Validation
**Goal:** Improve data quality with validation

**Features:**
- Minimum items per section
- Required sections
- Character limits
- Duplicate detection
- Quality scoring

**Validation Rules:**
```tsx
interface FrameworkValidation {
  minItemsPerSection?: number
  maxItemsPerSection?: number
  requiredSections?: string[]
  minTitleLength?: number
  maxTitleLength?: number
  minDescriptionLength?: number
}

const validationRules: Record<string, FrameworkValidation> = {
  swot: {
    minItemsPerSection: 1,
    requiredSections: ['strengths', 'weaknesses', 'opportunities', 'threats'],
    minTitleLength: 3,
    minDescriptionLength: 10
  },
  pest: {
    minItemsPerSection: 1,
    requiredSections: ['political', 'economic', 'social', 'technological']
  }
}
```

#### 2.3 Framework Templates
**Goal:** Speed up analysis creation

**Features:**
- Pre-filled framework templates
- Industry-specific templates
- Save custom templates
- Share templates

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS framework_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  framework_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data TEXT NOT NULL,
  is_public INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### 2.4 Auto-Save & Version History
**Goal:** Never lose work

**Features:**
- Auto-save every 30 seconds
- Manual save indicator
- Version history
- Restore previous versions
- Compare versions

**Implementation:**
```tsx
// In GenericFrameworkForm
useEffect(() => {
  const autoSaveTimer = setInterval(() => {
    if (hasUnsavedChanges) {
      saveAsDraft()
    }
  }, 30000) // 30 seconds

  return () => clearInterval(autoSaveTimer)
}, [hasUnsavedChanges])
```

---

### Phase 3: Advanced Features (Priority 3)

#### 3.1 Export Functionality
**Goal:** Export analyses in multiple formats

**Formats:**
- PDF (formatted report)
- DOCX (Microsoft Word)
- JSON (data export)
- CSV (spreadsheet)
- Markdown (documentation)

**UI:**
```tsx
<DropdownMenu>
  <DropdownMenuItem onClick={() => exportAs('pdf')}>
    <FileText className="mr-2" />
    Export as PDF
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => exportAs('docx')}>
    <FileText className="mr-2" />
    Export as Word
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => exportAs('json')}>
    <Code className="mr-2" />
    Export as JSON
  </DropdownMenuItem>
</DropdownMenu>
```

#### 3.2 Collaboration Features
**Goal:** Enable team collaboration

**Features:**
- Share framework with team members
- Role-based permissions (view/edit/admin)
- Real-time collaboration indicators
- Comments on sections
- Activity feed
- @mentions

**Database Schema:**
```sql
-- Already exists
framework_collaborators (
  id, framework_id, user_id,
  role, invited_at, accepted_at
)

CREATE TABLE IF NOT EXISTS framework_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  section_key TEXT,
  comment TEXT NOT NULL,
  parent_comment_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 3.3 AI Analysis Integration
**Goal:** AI-powered insights

**Features:**
- AI suggestions for each section
- Completeness scoring
- Bias detection
- Related framework recommendations
- Missing perspective alerts

**API Integration:**
```tsx
const analyzeFramework = async (frameworkData) => {
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      type: frameworkData.framework_type,
      data: frameworkData.data
    })
  })
  return response.json()
}
```

#### 3.4 Advanced Search & Filtering
**Goal:** Find analyses quickly

**Features:**
- Full-text search across all fields
- Filter by multiple criteria
- Save search filters
- Recent searches
- Search suggestions

**Search Interface:**
```tsx
<AdvancedSearch>
  <SearchInput placeholder="Search across all frameworks..." />
  <FilterRow>
    <Select label="Framework Type" />
    <Select label="Status" />
    <Select label="Created By" />
    <DateRange label="Date Range" />
  </FilterRow>
  <TagFilter />
  <SavedSearches />
</AdvancedSearch>
```

---

### Phase 4: UX Improvements (Priority 4)

#### 4.1 Keyboard Shortcuts
**Goal:** Power user efficiency

**Shortcuts:**
```
Ctrl/Cmd + S     → Save
Ctrl/Cmd + N     → New analysis
Ctrl/Cmd + K     → Search
Ctrl/Cmd + E     → Export
Ctrl/Cmd + /     → Show shortcuts
Esc             → Close modals
```

#### 4.2 Drag & Drop
**Goal:** Better item management

**Features:**
- Reorder items within sections
- Drag items between sections
- Drag evidence to sections
- Visual feedback

#### 4.3 Bulk Operations
**Goal:** Manage multiple items efficiently

**Features:**
- Select multiple analyses
- Bulk delete
- Bulk export
- Bulk status change
- Bulk tag

#### 4.4 Enhanced Visualizations
**Goal:** Better data presentation

**Features:**
- Framework comparison charts
- Trend visualization
- Evidence relationship graphs
- Completion progress bars
- Quality scoring meters

---

## 🗓️ Implementation Timeline

### Week 1: Evidence System (Sprint 2)
**Days 1-2:**
- ✅ Complete Evidence CRUD integration
- ✅ Evidence card components
- ✅ Evidence detail view

**Days 3-4:**
- ✅ Evidence collections
- ✅ Evidence linking to frameworks
- ✅ Evidence selector component

**Day 5:**
- ✅ Testing and bug fixes
- ✅ Deploy evidence system

### Week 2: Framework Enhancements (Sprint 3)
**Days 1-2:**
- ✅ Evidence integration in frameworks
- ✅ Framework validation

**Days 3-4:**
- ✅ Auto-save functionality
- ✅ Template system

**Day 5:**
- ✅ Export functionality (PDF, DOCX)
- ✅ Testing and deployment

### Week 3: Advanced Features (Sprint 4)
**Days 1-3:**
- ✅ Collaboration features
- ✅ Comments system
- ✅ Activity feed

**Days 4-5:**
- ✅ Advanced search
- ✅ Keyboard shortcuts
- ✅ Testing

### Week 4: Polish & Launch (Sprint 5)
**Days 1-2:**
- ✅ AI integration
- ✅ Visualizations

**Days 3-4:**
- ✅ Performance optimization
- ✅ Bug fixes
- ✅ Documentation

**Day 5:**
- ✅ Final testing
- ✅ Production deployment

---

## 📈 Success Metrics

### Evidence System
- [ ] Users can create/edit/delete evidence
- [ ] Evidence can be linked to frameworks
- [ ] Evidence collections functional
- [ ] 100% API integration

### Framework Quality
- [ ] All frameworks have validation
- [ ] Auto-save prevents data loss
- [ ] Export works in 3+ formats
- [ ] Templates speed up creation by 50%

### User Experience
- [ ] <2s average page load
- [ ] 90%+ mobile usability
- [ ] Zero critical bugs
- [ ] Keyboard shortcuts documented

---

## 🚀 Next Immediate Actions

1. **Integrate EvidenceForm with EvidencePage** ← START HERE
2. **Create EvidenceCard component**
3. **Add evidence CRUD operations**
4. **Create evidence linking system**
5. **Add evidence to framework views**

---

**Last Updated:** October 1, 2025
**Next Review:** October 8, 2025
