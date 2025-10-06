# Comprehensive Fixes & Enhancements Plan

**Created:** October 2, 2025
**Priority:** High - Multiple critical fixes + enhancements

---

## 🐛 Issues to Fix

### Issue 1: Tools Page Routing ❌
**Problem:** User navigating to `/tools` instead of `/dashboard/tools`
**URL:** https://6441398f.researchtoolspy.pages.dev/tools
**Expected:** https://6441398f.researchtoolspy.pages.dev/dashboard/tools

**Root Cause:** URL path missing `/dashboard` prefix

**Solution:**
- Tools page is correctly routed at `/dashboard/tools`
- Issue is user accessing wrong URL
- Add redirect from `/tools` → `/dashboard/tools`
- Update any links that point to `/tools` without dashboard prefix

### Issue 2: Frameworks Linking to Datasets Instead of Evidence ❌
**Problem:** Framework forms use `DatasetSelector` but should use `EvidenceSelector`
**File:** `src/components/frameworks/GenericFrameworkForm.tsx`

**Current State:**
```typescript
import { DatasetSelector } from '@/components/datasets/DatasetSelector'
import { DatasetBadge } from '@/components/datasets/DatasetBadge'
import type { Dataset } from '@/types/dataset'

linkedDataset: Dataset[]
onLinkDataset: () => void
onRemoveDataset: (datasetId: string) => void
```

**Expected State:**
```typescript
import { EvidenceSelector } from '@/components/evidence/EvidenceSelector'
import { EvidenceBadge } from '@/components/evidence/EvidenceBadge'
import type { EvidenceItem } from '@/types/evidence'

linkedEvidence: EvidenceItem[]
onLinkEvidence: () => void
onRemoveEvidence: (evidenceId: string) => void
```

**Impact:** All frameworks (SWOT, ACH, COG, PMESII-PT, DOTMLPF, etc.)

---

## ✨ Enhancements to Implement

### Enhancement 1: Citation Inline Editing ⭐
**Priority:** High
**Effort:** 2-3 hours
**Status:** Phase 1 implementation

**Requirements:**
1. Edit button on each citation in library
2. Inline expansion with all fields
3. Real-time citation preview
4. Save/Cancel functionality
5. Form validation

### Enhancement 2: Evidence → Citation Reverse Workflow
**Priority:** Medium
**Effort:** 1-2 hours

**Requirements:**
1. "Generate Citation" button in Evidence Collector
2. Extract metadata from evidence fields
3. Create citation from evidence
4. Add to Citation Library

---

## 📋 Implementation Plan

### Phase 1: Critical Fixes (1-2 hours)

#### Fix 1.1: Tools Page Routing
```typescript
// Add to routes/index.tsx
{
  path: '/tools',
  element: <Navigate to="/dashboard/tools" replace />,
}
```

#### Fix 1.2: Framework Evidence Integration
**Files to Update:**
1. `src/components/frameworks/GenericFrameworkForm.tsx`
   - Replace DatasetSelector with EvidenceSelector
   - Replace DatasetBadge with EvidenceBadge
   - Update types from Dataset to EvidenceItem
   - Update API endpoints from `/api/framework-datasets` to `/api/framework-evidence`

2. Create API endpoint: `/api/framework-evidence.ts`
   - Link framework sections to evidence items
   - Mirror structure of framework-datasets API

3. Create `EvidenceBadge` component (if doesn't exist)
   - Similar to DatasetBadge
   - Display evidence title, type, credibility

**Database Schema (if needed):**
```sql
CREATE TABLE framework_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  section_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (framework_id) REFERENCES frameworks(id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
);
```

### Phase 2: Citation Inline Editing (2-3 hours)

#### Step 2.1: Create CitationEditForm Component
**File:** `src/components/tools/CitationEditForm.tsx`

**Features:**
- Full form matching CitationsGeneratorPage
- Dynamic fields based on source type
- Real-time preview
- Author add/remove
- Style switcher

```typescript
interface CitationEditFormProps {
  citation: SavedCitation
  onSave: (updated: SavedCitation) => void
  onCancel: () => void
}
```

#### Step 2.2: Update CitationLibrary Component
**File:** `src/components/tools/CitationLibrary.tsx`

**Changes:**
1. Add Edit button with Pencil icon
2. Add state for editing mode
3. Conditional rendering: edit form vs display
4. Update citation utility function

```typescript
const [editingId, setEditingId] = useState<string | null>(null)

{editingId === citation.id ? (
  <CitationEditForm
    citation={citation}
    onSave={handleSave}
    onCancel={() => setEditingId(null)}
  />
) : (
  <CitationDisplay citation={citation} />
)}
```

#### Step 2.3: Add Update Function
**File:** `src/utils/citation-library.ts`

```typescript
export function updateCitation(id: string, updates: Partial<SavedCitation>): void {
  const library = getLibrary()
  const index = library.citations.findIndex(c => c.id === id)
  if (index !== -1) {
    // Regenerate citation with new data
    const { citation, inTextCitation } = generateCitation(
      updates.fields || library.citations[index].fields,
      updates.sourceType || library.citations[index].sourceType,
      updates.citationStyle || library.citations[index].citationStyle
    )
    library.citations[index] = {
      ...library.citations[index],
      ...updates,
      citation,
      inTextCitation
    }
    saveLibrary(library)
  }
}
```

### Phase 3: Evidence → Citation Workflow (1-2 hours)

#### Step 3.1: Add Button to Evidence Page
**File:** `src/pages/EvidencePage.tsx` or evidence detail view

```tsx
<Button
  variant="outline"
  onClick={() => generateCitationFromEvidence(evidence)}
>
  <FileText className="h-4 w-4 mr-2" />
  Generate Citation
</Button>
```

#### Step 3.2: Create Citation from Evidence
**File:** `src/utils/evidence-to-citation.ts` (new)

```typescript
export function evidenceToCitation(evidence: EvidenceItem): SavedCitation {
  // Extract metadata from evidence
  const authors = evidence.who
    ? [{
        firstName: evidence.who.split(' ')[0] || '',
        lastName: evidence.who.split(' ').slice(-1)[0] || '',
        middleName: ''
      }]
    : [{ firstName: '', lastName: 'Unknown', middleName: '' }]

  // Determine source type
  const sourceType = mapEvidenceTypeToSourceType(evidence.evidence_type)

  const fields: CitationFields = {
    authors,
    title: evidence.title,
    year: evidence.when_occurred?.split('-')[0],
    url: evidence.where_location,
    // Map other evidence fields to citation fields
  }

  const { citation, inTextCitation } = generateCitation(fields, sourceType, 'apa')

  return {
    id: generateCitationId(),
    citationStyle: 'apa',
    sourceType,
    fields,
    citation,
    inTextCitation,
    addedAt: new Date().toISOString(),
    notes: `Generated from evidence: ${evidence.title}`,
    tags: evidence.tags
  }
}
```

#### Step 3.3: Integration
- Add button to evidence detail pages
- Modal or confirmation after generation
- Auto-save to citation library
- Success feedback with link to library

---

## 🎯 Implementation Order

### Priority 1: Critical Fixes (Must Do First) ⚠️
1. ✅ Fix tools page routing
2. ✅ Change frameworks from datasets to evidence

### Priority 2: Core Enhancements
3. ✅ Citation inline editing (Phase 1)
4. ✅ Evidence → Citation workflow

### Priority 3: Polish (If Time)
5. Animation for edit expand/collapse
6. Keyboard shortcuts (Esc, Enter)
7. Batch edit citations
8. Citation duplicate detection

---

## 📊 Timeline Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Fix tools routing | 15 min | Critical |
| Framework evidence integration | 1-2 hours | Critical |
| Citation inline editing | 2-3 hours | High |
| Evidence → Citation | 1-2 hours | High |
| **Total** | **4-7 hours** | **Day 1** |

---

## 🔄 Testing Checklist

### Tools Page
- [ ] Navigate to `/tools` redirects to `/dashboard/tools`
- [ ] Tools list displays correctly
- [ ] Clicking tools navigates to correct pages
- [ ] All tool links work

### Framework Evidence
- [ ] Can link evidence items to framework sections
- [ ] Evidence badges display correctly
- [ ] Can remove linked evidence
- [ ] Evidence persists across sessions
- [ ] All frameworks work (SWOT, ACH, COG, etc.)

### Citation Editing
- [ ] Edit button appears on citations
- [ ] Form expands with all fields populated
- [ ] Can modify all fields
- [ ] Preview updates in real-time
- [ ] Save updates citation correctly
- [ ] Cancel reverts changes
- [ ] Validation works (required fields)

### Evidence → Citation
- [ ] Button appears in evidence view
- [ ] Generates citation with correct data
- [ ] Saves to citation library
- [ ] Success feedback shown
- [ ] Can navigate to library

---

## 📝 Files to Create/Modify

### Create New Files
1. `src/components/tools/CitationEditForm.tsx` - Inline edit form
2. `src/utils/evidence-to-citation.ts` - Evidence→Citation conversion
3. `src/components/evidence/EvidenceBadge.tsx` - Evidence display badge (if needed)
4. `functions/api/framework-evidence.ts` - API for linking evidence to frameworks

### Modify Existing Files
1. `src/routes/index.tsx` - Add redirect for /tools
2. `src/components/frameworks/GenericFrameworkForm.tsx` - Switch to evidence
3. `src/components/tools/CitationLibrary.tsx` - Add edit functionality
4. `src/utils/citation-library.ts` - Add updateCitation()
5. `src/pages/EvidencePage.tsx` - Add "Generate Citation" button

---

## 🚀 Deployment Strategy

1. Commit each major fix separately
2. Test locally before deploying
3. Deploy to Cloudflare Pages
4. Test on production URL
5. Git tag for version tracking

**Tags:**
- v1.6.1 - Critical fixes (tools routing, framework evidence)
- v1.7.0 - Citation editing + Evidence→Citation

---

## 📚 References

- Zotero citation editing UX
- Evidence Collector current implementation
- Framework-datasets API structure
- Citation library localStorage structure
