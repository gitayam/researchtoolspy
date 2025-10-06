# Citations Generator Tool - Implementation Plan

**Created:** October 2, 2025
**Status:** ✅ COMPLETE (Phase 1)
**Priority:** High (Sprint 3, Tool #2)
**Estimated Time:** 6-8 hours (4 hours completed)

---

## 🎯 Goal

Build a comprehensive citations generator that can:
1. Generate citations from datasets in multiple formats (APA, MLA, Chicago, Harvard)
2. Support various source types (website, book, journal, report, etc.)
3. Auto-populate from dataset metadata
4. Batch generate citations for multiple sources
5. Export to various formats (plain text, BibTeX, RIS, EndNote)
6. Copy individual or batch citations to clipboard

---

## 📋 Features

### Phase 1: Basic Citation Generation (2-3 hours) ✅ COMPLETE
- [x] Manual input form with all required fields
- [x] Support for 4 citation styles (APA 7th, MLA 9th, Chicago 17th, Harvard)
- [x] Support for 5 source types (Website, Book, Journal Article, Report, News Article)
- [x] Real-time citation preview
- [x] Copy to clipboard
- [x] In-text citation generation
- [x] Dynamic form fields based on source type
- [x] Multiple author support
- [x] Citation formatters for all styles

### Phase 2: Dataset Integration (1-2 hours)
- [ ] Import from existing datasets
- [ ] Auto-populate fields from dataset metadata
- [ ] Link generated citations back to datasets
- [ ] Save citations with datasets

### Phase 3: Batch Processing (1-2 hours)
- [ ] Batch citation generation
- [ ] Citation library management
- [ ] Multi-select and copy
- [ ] Export entire bibliography

### Phase 4: Advanced Features (1-2 hours)
- [ ] BibTeX export
- [ ] RIS export (for EndNote, Zotero, Mendeley)
- [ ] In-text citation generator
- [ ] Citation validation
- [ ] Duplicate detection

---

## 🏗️ Architecture

### Frontend Components

```
src/pages/tools/
  └── CitationsGeneratorPage.tsx (Main page)

src/components/tools/
  ├── CitationForm.tsx (Input form)
  ├── CitationPreview.tsx (Live preview)
  ├── CitationLibrary.tsx (Saved citations list)
  └── CitationExport.tsx (Export options)

src/types/
  └── citations.ts (Type definitions)
```

### Backend API

```
functions/api/tools/
  └── citations.ts (Citation generation endpoint)

Functions needed:
  - POST /api/tools/citations/generate - Generate citation(s)
  - GET /api/tools/citations - List saved citations
  - DELETE /api/tools/citations/:id - Delete citation
  - GET /api/tools/citations/export - Export in various formats
```

---

## 🔧 Technical Stack

### Citation Formatting
- **Custom formatters** for each citation style (lightweight, no dependencies)
- **Field mapping** for different source types
- **Validation** for required fields per style

### Supported Formats
1. **APA 7th Edition** (American Psychological Association)
2. **MLA 9th Edition** (Modern Language Association)
3. **Chicago 17th Edition** (Author-Date and Notes-Bibliography)
4. **Harvard** (Author-Date system)

### Supported Source Types
1. **Website** - URL, author, title, date, access date
2. **Book** - Author, title, publisher, year, ISBN
3. **Journal Article** - Author, title, journal, volume, issue, pages, DOI
4. **Report** - Author, title, institution, year, report number
5. **News Article** - Author, title, publication, date, URL

---

## 📝 API Specification

### POST /api/tools/citations/generate

**Request:**
```typescript
{
  sourceType: 'website' | 'book' | 'journal' | 'report' | 'news',
  citationStyle: 'apa' | 'mla' | 'chicago' | 'harvard',
  fields: {
    // Common fields
    authors?: Array<{ firstName: string; lastName: string }>,
    title: string,
    year?: string,

    // Website specific
    url?: string,
    accessDate?: string,
    publisher?: string,

    // Book specific
    edition?: string,
    isbn?: string,
    place?: string,

    // Journal specific
    journalTitle?: string,
    volume?: string,
    issue?: string,
    pages?: string,
    doi?: string,

    // Report specific
    institution?: string,
    reportNumber?: string
  },
  datasetId?: number  // Optional link to dataset
}
```

**Response:**
```typescript
{
  id: string,
  sourceType: string,
  citationStyle: string,
  citation: string,  // Formatted citation
  inTextCitation?: string,  // In-text format (Author, Year)
  fields: object,
  datasetId?: number,
  createdAt: string
}
```

---

## 🎨 UI Design

### Layout

```
┌─────────────────────────────────────────────┐
│  Citations Generator                         │
├─────────────────────────────────────────────┤
│                                             │
│  [APA v] [MLA] [Chicago] [Harvard]         │
│                                             │
│  Source Type: [Website v]                  │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Author(s)                             │ │
│  │ [+] Add Author                        │ │
│  │                                       │ │
│  │ Title: [_________________]            │ │
│  │ URL: [____________________]           │ │
│  │ Access Date: [___________]            │ │
│  │ Publication Date: [______]            │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  📋 Preview:                                │
│  ┌───────────────────────────────────────┐ │
│  │ Author, A. A. (2025). Title of work. │ │
│  │ https://example.com                   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Copy] [Save to Library] [Import Dataset] │
└─────────────────────────────────────────────┘

Citation Library:
┌─────────────────────────────────────────────┐
│  Recent Citations                            │
├─────────────────────────────────────────────┤
│  □ Smith, J. (2024). Research methods...    │
│  □ Jones, M. (2023). Data analysis in...    │
│  □ Brown, K. (2025). Introduction to...     │
│                                             │
│  [☑ Select All] [Copy Selected] [Export]   │
└─────────────────────────────────────────────┘
```

---

## 🚀 Implementation Steps

### Step 1: Create Type Definitions ✅ (Next)
```typescript
// src/types/citations.ts
export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'harvard'
export type SourceType = 'website' | 'book' | 'journal' | 'report' | 'news'

export interface Author {
  firstName: string
  lastName: string
  middleName?: string
}

export interface CitationFields {
  authors: Author[]
  title: string
  year?: string
  // ... other fields
}

export interface Citation {
  id: string
  sourceType: SourceType
  citationStyle: CitationStyle
  citation: string
  inTextCitation?: string
  fields: CitationFields
  datasetId?: number
  createdAt: string
}
```

### Step 2: Build Citation Formatters (2 hours)
Implement formatting logic for each citation style:
- APA 7th formatter
- MLA 9th formatter
- Chicago 17th formatter
- Harvard formatter

### Step 3: Build UI Components (2 hours)
- Citation form with dynamic fields
- Real-time preview
- Author management (add/remove)
- Style selector tabs
- Source type dropdown

### Step 4: Build API Endpoint (1 hour)
- `/api/tools/citations/generate` endpoint
- Field validation
- Citation formatting
- Response structure

### Step 5: Integration & Testing (1 hour)
- Dataset integration
- Copy to clipboard
- Save to library
- Export functionality

---

## 📚 Citation Format Examples

### APA 7th Edition
```
Website:
Author, A. A. (Year, Month Day). Title of work. Site Name. URL

Book:
Author, A. A. (Year). Title of book (Edition). Publisher.

Journal:
Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, Volume(Issue), pages. https://doi.org/xxx
```

### MLA 9th Edition
```
Website:
Author Last Name, First Name. "Title of Work." Site Name, Date, URL.

Book:
Author Last Name, First Name. Title of Book. Publisher, Year.

Journal:
Author Last Name, First Name. "Article Title." Journal Name, vol. #, no. #, Year, pp. ##-##.
```

### Chicago 17th Edition (Author-Date)
```
Website:
Author Last Name, First Name. Year. "Title of Work." Site Name. Accessed Month Day, Year. URL.

Book:
Author Last Name, First Name. Year. Title of Book. Place: Publisher.

Journal:
Author Last Name, First Name. Year. "Article Title." Journal Name Volume (Issue): pages.
```

### Harvard
```
Website:
Author Last Name, Initial. (Year) 'Title of work', Site Name. Available at: URL (Accessed: Day Month Year).

Book:
Author Last Name, Initial. (Year) Title of book. Edition. Place: Publisher.

Journal:
Author Last Name, Initial. (Year) 'Article title', Journal Name, Volume(Issue), pp. pages.
```

---

## ⚠️ Implementation Notes

### Field Requirements by Style

**APA:**
- Required: Author(s), Year, Title
- Website: URL, access date optional
- Journal: DOI strongly recommended

**MLA:**
- Required: Author(s), Title
- Year optional but recommended
- Container titles for nested sources

**Chicago:**
- Required: Author(s), Year, Title
- Publisher and place for books
- Access date for online sources

**Harvard:**
- Required: Author(s), Year, Title
- Similar to APA but different punctuation
- Access date for online sources

### Author Name Formatting

**APA:** Last, F. M.
**MLA:** Last, First Middle.
**Chicago:** Last, First Middle
**Harvard:** Last, F.M.

### Validation Rules
- At least one author required (or "Anonymous")
- Title is always required
- Year required for most styles
- URL required for website sources
- DOI recommended for journal articles

---

## 🎯 Success Criteria

✅ User can select citation style (APA/MLA/Chicago/Harvard)
✅ User can select source type (Website/Book/Journal/Report/News)
✅ User can input all required fields
✅ User can add multiple authors
✅ Citation updates in real-time as fields are filled
✅ User can copy formatted citation to clipboard
✅ User can import dataset to pre-fill fields
✅ User can save citation to library
✅ User can export bibliography in multiple formats

---

## 📈 Future Enhancements

- Support for more citation styles (IEEE, Turabian, AMA)
- Support for more source types (podcast, video, social media, interview)
- Annotated bibliography generation
- Citation checker/validator
- Plagiarism detection integration
- Zotero/Mendeley import/export
- Chrome extension for quick citation

---

## ✅ Implementation Summary (October 2, 2025)

### Completed

**Files Created:**
1. `src/types/citations.ts` - Complete type definitions for citation system
2. `src/utils/citation-formatters.ts` - Citation formatting logic for 4 styles
3. `src/pages/tools/CitationsGeneratorPage.tsx` - Full UI with form and preview
4. `src/routes/index.tsx` - Updated with citations-generator route

**Features Implemented:**
- ✅ 4 citation styles (APA, MLA, Chicago, Harvard)
- ✅ 5 source types (Website, Book, Journal, Report, News)
- ✅ Dynamic form fields per source type
- ✅ Multiple author management
- ✅ Real-time citation preview
- ✅ In-text citation generation
- ✅ Copy to clipboard functionality
- ✅ Clean, responsive UI with tabs
- ✅ Form validation and error handling

**Deployment:**
- ✅ Built successfully (712KB bundle)
- ✅ Deployed to Cloudflare Pages
- ✅ Live at: https://cloudflare-react-nextjs-to-v.researchtoolspy.pages.dev/dashboard/tools/citations-generator

**Status**: Phase 1 complete and production-ready

**Next Steps:**
- Phase 2: Dataset integration (auto-populate from existing datasets)
- Phase 3: Batch processing and citation library
- Phase 4: BibTeX/RIS export and advanced features

---

**Previous Status**: Ready to implement
**Current Status**: Phase 1 deployed and operational ✅
