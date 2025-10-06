# Citations Integration with Q&A Frameworks Plan

## Overview
Integrate citation functionality into frameworks with Q&A data (Starbursting, DIME, etc.) to:
1. Auto-generate citations from scraped URLs
2. Allow manual citation addition/editing
3. Include citations in exported reports

## Current State

### Existing Citation System
- **Types**: Website, Book, Journal, Report, News
- **Styles**: APA, MLA, Chicago, Harvard
- **Storage**: Citation Library in localStorage
- **Components**: CitationLibrary, CitationEditForm, CitationsGeneratorPage
- **API**: `/api/evidence-citations.ts`

### Q&A Frameworks
- **Starbursting**: 6 categories (who, what, when, where, why, how) with Q&A pairs
- **DIME**: 4 categories (diplomatic, information, military, economic) with Q&A pairs
- **Data Structure**: `{question: string, answer: string}[]`

## Phase 1: Data Model Extension

### 1.1 Add Citation Reference to Q&A Items

```typescript
// Before:
interface QAItem {
  question: string
  answer: string
}

// After:
interface QAItem {
  question: string
  answer: string
  citationId?: string  // Reference to citation in library
  sourceUrl?: string   // Original URL if auto-generated
  sourceTitle?: string // For display without full citation
  sourceDate?: string  // For display
}
```

### 1.2 Update Framework Types
Update `framework.ts` types to support citation-enabled items:

```typescript
interface FrameworkData {
  // ... existing fields
  citations?: SavedCitation[]  // Local citations for this analysis
}
```

## Phase 2: Auto-Citation from URL Scraping

### 2.1 Enhance URL Scraper (`scrape-url.ts`)
When scraping URLs for Starbursting/DIME, automatically generate citation:

```typescript
interface ScrapeResponse {
  url: string
  title: string
  content: string
  summary: string
  extractedData: Record<string, any>
  metadata: {
    publishDate?: string
    author?: string
    source: string
  }
  citation?: {  // NEW
    id: string
    sourceType: 'website' | 'news'
    citationStyle: 'apa'  // Default
    fields: CitationFields
    citation: string
    inTextCitation: string
  }
}
```

**Implementation**:
1. After scraping URL and extracting metadata
2. Use `generateCitation()` to create citation from:
   - URL → `fields.url`
   - Title → `fields.title`
   - Source → `fields.siteName` or `fields.publication`
   - Publish date → `fields.year/month/day`
   - Author → `fields.authors`
   - Access date → Today's date

3. Attach citation to each Q&A pair generated from that URL

### 2.2 Update Q&A Generation
In `scrape-url.ts`, when generating Q&A data:

```typescript
// Each Q&A item gets citation reference
{
  "who": [
    {
      "question": "Who published 'Article Title' on Newsweek (Nov 2024)?",
      "answer": "Newsweek",
      "citationId": "cit-123-abc",
      "sourceUrl": "https://newsweek.com/...",
      "sourceTitle": "Article Title"
    }
  ]
}
```

## Phase 3: UI Components

### 3.1 Citation Indicator Badge
Add visual indicator when Q&A has citation:

```tsx
<div className="qa-item">
  <div className="flex items-start gap-2">
    <div className="flex-1">
      <p className="font-medium">{item.question}</p>
      <p className="text-gray-600">{item.answer}</p>
    </div>
    {item.citationId && (
      <Badge variant="outline" className="text-xs">
        <BookOpen className="w-3 h-3 mr-1" />
        Source
      </Badge>
    )}
  </div>
  {item.citationId && (
    <div className="mt-2 text-xs text-gray-500">
      {formatCitation(item.citationId)}
    </div>
  )}
</div>
```

### 3.2 Citation Manager Modal
Modal for adding/editing citations for Q&A items:

```tsx
<CitationManagerModal
  qaItem={selectedItem}
  onSave={(citation) => {
    // Update Q&A item with citation
    updateQAItemCitation(citation)
  }}
  onRemove={() => {
    // Remove citation from Q&A item
    removeQAItemCitation()
  }}
>
  {/* Options */}
  - Search existing library
  - Create new citation (manual entry)
  - Auto-generate from URL (if sourceUrl available)
  - Edit existing citation
</CitationManagerModal>
```

### 3.3 Bulk Citation Management
Add button to manage all citations in analysis:

```tsx
<Button variant="outline" onClick={openCitationManager}>
  <BookOpen className="w-4 h-4 mr-2" />
  Manage Citations ({citationCount})
</Button>
```

## Phase 4: Manual Citation Addition

### 4.1 Add Citation Button per Q&A Item
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost" size="sm">
      <MoreVertical className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={openCitationPicker}>
      <BookOpen className="w-4 h-4 mr-2" />
      Add Citation
    </DropdownMenuItem>
    {item.citationId && (
      <>
        <DropdownMenuItem onClick={editCitation}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Citation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={removeCitation}>
          <Trash2 className="w-4 h-4 mr-2" />
          Remove Citation
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

### 4.2 Citation Picker Dialog
Two-tab interface:
1. **Existing**: Select from Citation Library
2. **New**: Create new citation
   - Manual entry form
   - URL auto-generator (fetch metadata)

## Phase 5: Report Generation with Citations

### 5.1 Update Report Generator
Modify report generation to include citations section:

```markdown
# Analysis Report

## Summary
[AI-generated summary]

## Data

### Who Category
**Q:** Who published 'Article Title' on Newsweek (Nov 2024)?
**A:** Newsweek
**Source:** [1]

### References
[1] Author, A. (2024, November). Article title. *Newsweek*. https://newsweek.com/article
[2] ...
```

### 5.2 Citation Formats in Reports
Support multiple citation styles in export:
- APA (default)
- MLA
- Chicago
- Harvard

User can select preferred style in export settings.

### 5.3 In-Text Citations
Use numbered references [1], [2] or author-date (Author, 2024) depending on style.

## Phase 6: AI Summary with Citations

### 6.1 Enhance AI Summary Generation
When generating AI summaries, include source attribution:

```typescript
// In AI summary prompt
"Generate a summary of this analysis. When referencing data from
specific sources, use [Source #] notation. Include all cited sources
in a References section at the end."
```

### 6.2 Citation Tracking in Summaries
- Parse summary for source references
- Link references to citation objects
- Display expandable citations on hover

## Implementation Order

### Sprint 1: Foundation (Week 1)
1. ✅ Update Q&A data model with citation fields
2. ✅ Create utility functions for citation management
3. ✅ Add citation auto-generation to URL scraper

### Sprint 2: UI Components (Week 2)
4. ✅ Build CitationBadge component
5. ✅ Build CitationPicker dialog
6. ✅ Add citation indicators to Q&A displays
7. ✅ Implement manual citation addition flow

### Sprint 3: Bulk Operations (Week 3)
8. ✅ Build CitationManager for analysis
9. ✅ Implement bulk citation operations
10. ✅ Add citation search/filter

### Sprint 4: Reporting (Week 4)
11. ✅ Update report templates with citations section
12. ✅ Add citation style selector to export
13. ✅ Implement in-text citation formatting

### Sprint 5: AI Integration (Week 5)
14. ✅ Enhance AI summary with citation support
15. ✅ Add citation hover/tooltip in summaries
16. ✅ Test and refine citation workflow

## Technical Considerations

### Storage
- **Citations Library**: localStorage (existing)
- **Q&A Citations**: Embedded in framework analysis data
- **Sync**: Auto-add to library when used in analysis

### Data Migration
- Existing analyses without citations: Add `citations: []` field
- Backward compatible: Q&A items work with or without citations

### Performance
- Lazy-load full citation details
- Cache formatted citations
- Index citations by ID for quick lookup

### Validation
- Ensure citation IDs exist in library
- Validate citation data completeness
- Warn on broken citation references

## User Workflows

### Workflow 1: URL Import with Auto-Citations
1. User imports URL in Starbursting
2. System scrapes content and metadata
3. System auto-generates citation from metadata
4. Q&A pairs automatically linked to citation
5. User can review/edit citation
6. Export report includes proper references

### Workflow 2: Manual Citation Addition
1. User creates Q&A manually
2. User clicks "Add Citation" on Q&A item
3. User chooses:
   - Select from library, OR
   - Create new (manual or URL)
4. Citation linked to Q&A item
5. Appears in reports

### Workflow 3: Citation Management
1. User opens Citation Manager
2. Views all citations in current analysis
3. Can:
   - Edit citation details
   - Remove citations
   - Add tags/notes
   - Change citation style
4. Changes reflected in Q&A display and reports

## Future Enhancements

### Phase 2+
- **Citation Suggestions**: AI suggests citations for answers without sources
- **Duplicate Detection**: Warn when adding duplicate citations
- **Citation Validation**: Check DOI/URL validity
- **Import from Zotero/Mendeley**: Import existing citation libraries
- **Collaborative Citations**: Share citation libraries across team
- **Citation Analytics**: Track most-used sources
- **Annotation**: Add highlights/notes to citations
- **Version Tracking**: Track citation edits over time

## Testing Strategy

### Unit Tests
- Citation generation from metadata
- Q&A-citation linking
- Report formatting with citations

### Integration Tests
- End-to-end URL import with citations
- Manual citation workflow
- Export with multiple citation styles

### User Acceptance Tests
- Verify citations display correctly
- Test all citation styles in reports
- Validate AI summary with citations
- Check citation library sync

## Success Metrics
- % of Q&A items with citations
- Citation accuracy (metadata completeness)
- User satisfaction with citation workflow
- Adoption rate of citation features
- Export quality (proper reference formatting)
