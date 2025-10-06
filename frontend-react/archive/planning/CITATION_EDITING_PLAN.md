# Citation Editing Flow Plan

**Created:** October 2, 2025
**Reference:** Zotero citation management workflow
**Priority:** High - Core library functionality

---

## 🎯 Current State

### What We Have ✅
- Citation Library displaying saved citations
- Copy, Delete, Add to Evidence buttons
- Citation Generator page for creating new citations

### What's Missing ❌
- Edit existing citations
- Load citation data back into form
- Update saved citations
- Visual feedback for edited citations

---

## 📊 Zotero's Editing Flow Analysis

### Zotero Desktop Approach
```
Library View:
┌────────────────────────────────────────┐
│  My Library                            │
├────────────────────────────────────────┤
│  ├─ Article 1                          │  ← Click to select
│  ├─ Book 2                             │
│  ├─ Website 3          [Selected]      │
└────────────────────────────────────────┘

Right Panel (Item Details):
┌────────────────────────────────────────┐
│  Info | Notes | Tags | Related        │
├────────────────────────────────────────┤
│  Item Type:  [Website      ▼]         │
│  Title:      [__________________]      │
│  Authors:    [__________________]      │  ← Inline editing
│             [+ Add Author]             │
│  URL:        [__________________]      │
│  Date:       [__________________]      │
│  ...                                   │
│                                        │
│  Citation Style: [APA 7th ▼]          │
│  ┌──────────────────────────────────┐ │
│  │ Generated Citation Preview       │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**Key Features:**
1. **Live editing** - Changes save automatically
2. **Inline form** - Edit directly in library view
3. **Real-time preview** - Citation updates as you type
4. **Persistent context** - Stay in library, don't navigate away

### Zotero Web Approach
- Click citation → Opens in editing mode
- Side panel with all fields
- Save/Cancel buttons
- Navigate back to library

---

## 🎨 Proposed Approaches for Our App

### Option A: Inline Expansion (Zotero-like) ⭐ RECOMMENDED
**Pros:**
- Stay in library context
- Quick edits
- No navigation
- Modern UX

**Cons:**
- More complex state management
- Larger component

**Flow:**
```
Citation Library:
┌─────────────────────────────────────────────────────────┐
│  1. Smith, J. (2024). Research methods...               │
│     [Edit] [Copy] [Evidence] [Delete]                   │
└─────────────────────────────────────────────────────────┘
        ↓ Click [Edit]
┌─────────────────────────────────────────────────────────┐
│  Editing Citation #1                                     │
├─────────────────────────────────────────────────────────┤
│  Source Type: [Website ▼]   Style: [APA 7th ▼]         │
│                                                          │
│  Title: [Research methods in qualitative analysis____]  │
│                                                          │
│  Authors:                                                │
│    First: [John___] Last: [Smith___] [Remove]           │
│    [+ Add Author]                                        │
│                                                          │
│  Year: [2024] Month: [__] Day: [__]                     │
│  URL: [https://example.com_________________]             │
│  ...                                                     │
│                                                          │
│  Preview:                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Smith, J. (2024). Research methods in...         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  [Cancel] [Save Changes]                                 │
├─────────────────────────────────────────────────────────┤
│  2. Doe, A. (2023). Another citation...                 │
└─────────────────────────────────────────────────────────┘
```

### Option B: Modal Editor
**Pros:**
- Focused editing environment
- Clean separation of concerns
- Easier to implement

**Cons:**
- Requires clicking through modal
- Less modern feel

**Flow:**
```
Click [Edit] → Modal opens with form → Edit → Save → Modal closes
```

### Option C: Navigate to Generator Page
**Pros:**
- Reuse existing form
- Full-featured editing
- Familiar environment

**Cons:**
- Loses library context
- Requires navigation
- Less efficient for quick edits

---

## 🏗️ Recommended Implementation: Option A (Inline Expansion)

### Phase 1: Core Edit Functionality (2-3 hours)

#### 1.1 Update Citation Library Component State
```typescript
const [editingId, setEditingId] = useState<string | null>(null)
const [editForm, setEditForm] = useState<SavedCitation | null>(null)
```

#### 1.2 Add Edit Button
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleEdit(citation)}
  title="Edit Citation"
>
  <Edit className="h-4 w-4" />
</Button>
```

#### 1.3 Create Inline Edit Form
```tsx
{editingId === citation.id ? (
  <CitationEditForm
    citation={editForm}
    onChange={setEditForm}
    onSave={() => handleSave(editForm)}
    onCancel={() => setEditingId(null)}
  />
) : (
  <CitationDisplay citation={citation} />
)}
```

#### 1.4 Create CitationEditForm Component
New file: `src/components/tools/CitationEditForm.tsx`

Features:
- All citation fields
- Dynamic field visibility based on source type
- Real-time citation preview
- Author management (add/remove)
- Style switcher
- Save/Cancel buttons

```tsx
interface CitationEditFormProps {
  citation: SavedCitation
  onChange: (citation: SavedCitation) => void
  onSave: () => void
  onCancel: () => void
}

export function CitationEditForm({ citation, onChange, onSave, onCancel }: CitationEditFormProps) {
  // Form state mirroring CitationsGeneratorPage
  const [fields, setFields] = useState(citation.fields)
  const [style, setStyle] = useState(citation.citationStyle)
  const [sourceType, setSourceType] = useState(citation.sourceType)

  // Generate live preview
  const { citation: preview } = generateCitation(fields, sourceType, style)

  return (
    <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
      {/* Form fields matching CitationsGeneratorPage */}
      {/* Live preview */}
      {/* Save/Cancel buttons */}
    </div>
  )
}
```

#### 1.5 Update Citation Library Utils
Add `updateCitation()` function in `citation-library.ts`:
```typescript
export function updateCitation(id: string, updates: Partial<SavedCitation>): void {
  const library = getLibrary()
  const index = library.citations.findIndex(c => c.id === id)
  if (index !== -1) {
    library.citations[index] = { ...library.citations[index], ...updates }
    saveLibrary(library)
  }
}
```

### Phase 2: Enhanced UX (1-2 hours)

#### 2.1 Visual Indicators
- Show "Editing..." badge
- Highlight edited citation
- Smooth expand/collapse animation
- Unsaved changes warning

#### 2.2 Keyboard Shortcuts
- `Escape` - Cancel editing
- `Cmd/Ctrl + Enter` - Save changes
- `Tab` - Navigate between fields

#### 2.3 Validation
- Required fields (title, author)
- Date validation
- URL format validation
- Show validation errors inline

#### 2.4 Auto-save Option
- Optional: Save on blur (like Google Docs)
- Visual indicator: "Saving..." → "Saved"

### Phase 3: Advanced Features (Optional, 1-2 hours)

#### 3.1 Batch Edit
- Select multiple citations
- Edit common fields (style, tags)
- Apply changes to all selected

#### 3.2 Edit History
- Track changes to citations
- Undo/Redo functionality
- View edit history

#### 3.3 Duplicate Citation
- "Duplicate" button
- Creates copy for editing
- Useful for similar sources

---

## 🎯 User Flow Comparison

### Before (Current)
```
User wants to fix typo in author name:
1. Delete citation from library
2. Remember all the details
3. Go to generator page
4. Re-enter all fields
5. Fix the typo
6. Save new citation
❌ 6 steps, data loss risk
```

### After (With Edit)
```
User wants to fix typo in author name:
1. Click [Edit] button
2. Form expands with all fields populated
3. Fix the typo
4. Click [Save]
✅ 4 steps, no data loss
```

---

## 📝 Implementation Checklist

### Must Have (Priority 1) ⭐
- [ ] Add Edit button to each citation
- [ ] Create CitationEditForm component
- [ ] Implement inline expansion/collapse
- [ ] Add updateCitation() to utils
- [ ] Real-time preview in edit mode
- [ ] Save/Cancel functionality
- [ ] Form validation

### Should Have (Priority 2)
- [ ] Visual editing indicators
- [ ] Smooth animations
- [ ] Keyboard shortcuts (Escape, Enter)
- [ ] Unsaved changes warning
- [ ] Success/error feedback

### Nice to Have (Priority 3)
- [ ] Auto-save on blur
- [ ] Edit history/undo
- [ ] Batch edit
- [ ] Duplicate citation
- [ ] Quick edit mode (just title/author)

---

## 🔄 Alternative: Hybrid Approach

For quick edits while keeping full editor available:

### Quick Edit (Inline)
- Click citation → Inline form appears
- Edit commonly changed fields (title, author, date)
- Limited fields for speed

### Full Edit (Navigate)
- Click "Full Edit" button
- Navigate to generator page with pre-populated fields
- All fields available
- Can scrape URL again
- Return to library after save

**Best of both worlds:**
- Quick fixes in library
- Complex edits in dedicated page

---

## 🚀 Recommended Approach

**Start with Phase 1: Inline Expansion**
- Provides 80% of value
- Matches Zotero UX
- Modern, efficient workflow
- Good foundation for future enhancements

**Add Phase 2 polish**
- Animations and feedback
- Keyboard shortcuts
- Validation

**Phase 3 as needed**
- Based on user feedback
- Nice-to-have features

---

## 📊 Implementation Timeline

- **Phase 1 Core:** 2-3 hours
- **Phase 2 Polish:** 1-2 hours
- **Total:** 3-5 hours

**Estimated Completion:** Same day

---

## 🎨 Visual Design Notes

### Editing State Visual Treatment
```
Normal Citation:
┌─────────────────────────────────────┐
│ 1. Smith, J. (2024). Title...       │ ← White/gray background
│    [📝 Edit] [📋 Copy] [✓ Evidence] │
└─────────────────────────────────────┘

Editing Mode:
┌─────────────────────────────────────┐
│ ⚡ Editing Citation #1               │ ← Blue accent
├─────────────────────────────────────┤
│ [Expanded form with all fields]     │ ← Light blue background
│ [Live preview]                      │ ← Bordered preview box
│ [❌ Cancel] [💾 Save Changes]       │ ← Action buttons
└─────────────────────────────────────┘
```

### Icons
- Edit: Pencil (Edit icon from lucide-react)
- Save: Check or Save icon
- Cancel: X icon
- Preview: Eye icon

---

## 🔧 Technical Considerations

### State Management
- Use local component state for editing
- Update global library state on save
- Don't mutate original until save

### Performance
- Only render edit form for active citation
- Lazy load form if needed
- Debounce preview regeneration

### Accessibility
- Focus management (auto-focus first field)
- ARIA labels for screen readers
- Keyboard navigation support
- Clear error messages

---

## 📚 References

- Zotero: https://www.zotero.org
- Mendeley editing flow
- EndNote web interface
- Google Docs inline editing pattern
