# Content Intelligence ↔ Citation Generator Integration

## Overview

Seamlessly create academic citations from analyzed web content with one click. The Content Intelligence tool now integrates with the Citation Generator to auto-populate citation fields from analyzed URLs.

## Features

### 🎯 Smart Citation Data Extraction

Automatically extracts citation-ready metadata from analyzed content:
- **Author names** - Parsed and formatted (First, Middle, Last)
- **Title** - Article/page title
- **Publication date** - Year, month, day components
- **Domain/Site name** - Source website
- **Access date** - Current date in proper format
- **Source type detection** - Auto-classifies as Website, News, Journal, or Report

### 📍 Integration Points

#### 1. **Analysis Overview Tab**
- "Create Citation" button in the top-right corner
- Appears immediately after analysis completes
- Pre-populates citation form with all available metadata

#### 2. **Saved Links Library**
- Citation icon button next to each processed link
- Quick access without re-analyzing
- Works for all saved links with completed analysis

### 🔄 Workflow

```
Content Analysis → Extract Metadata → Citation Generator → Formatted Citation
      ↓                    ↓                    ↓                    ↓
  Analyze URL      Parse author, title,    Auto-populate      Copy/Save citation
                    date, source type          fields         (APA/MLA/Chicago/Harvard)
```

## Technical Implementation

### Files Created

#### `/src/utils/content-to-citation.ts`
Core integration utility with the following functions:

```typescript
// Extract citation data from ContentAnalysis
extractCitationData(analysis: ContentAnalysis, url?: string): CitationData

// Determine source type (website, news, journal, report)
determineSourceType(analysis: ContentAnalysis): SourceType

// Parse author names into structured format
parseAuthors(authorString?: string): Author[]

// Parse dates into year/month/day components
parseDate(dateString?: string): { year, month, day }

// Create URL parameters for navigation
createCitationParams(citationData: CitationData): URLSearchParams
```

### Source Type Detection Logic

**News Articles**: Domains containing `news`, `times`, `post`, `guardian`, `reuters`, `cnn`, `bbc`, `npr`

**Academic/Journal**: Domains containing `journal`, `academic`, `.edu`, `research`, `pubmed`, `scholar`

**Reports**: Domains containing `.gov`, `.org`, `report`, `whitepaper`

**Default**: Website

### Author Name Parsing

Supports multiple formats:
- **"Last, First"** → Splits on comma
- **"First Last"** → First + Last name
- **"First Middle Last"** → All components parsed
- **Single name** → Treated as last name

### Data Flow

```
ContentIntelligencePage.tsx (Line 192-209)
          ↓
   handleCreateCitation()
          ↓
   extractCitationData() - content-to-citation.ts
          ↓
   createCitationParams()
          ↓
   navigate() to CitationsGeneratorPage with URL params
          ↓
   useEffect() loads params - CitationsGeneratorPage.tsx (Line 60-87)
          ↓
   Form fields auto-populated
```

## Usage Examples

### Example 1: News Article
**Input**: https://www.nytimes.com/2025/01/15/technology/ai-research.html

**Extracted**:
- Source Type: `news`
- Title: "New AI Research Breakthrough"
- Author: "Smith, John"
- Publication: "The New York Times"
- Date: 2025-01-15
- Access Date: October 6, 2025

**Generated Citation (APA)**:
```
Smith, J. (2025, January 15). New AI Research Breakthrough. The New York Times.
Retrieved October 6, 2025, from https://www.nytimes.com/2025/01/15/technology/ai-research.html
```

### Example 2: Research Website
**Input**: https://research.example.edu/papers/quantum-computing

**Extracted**:
- Source Type: `journal` (contains .edu)
- Title: "Quantum Computing Advances"
- Author: "Johnson, Alice"
- Site: "research.example.edu"
- Year: 2025

**Generated Citation (MLA)**:
```
Johnson, Alice. "Quantum Computing Advances." Research.example.edu, 2025,
research.example.edu/papers/quantum-computing. Accessed 6 Oct. 2025.
```

### Example 3: Government Report
**Input**: https://www.example.gov/reports/climate-2025

**Extracted**:
- Source Type: `report`
- Title: "Climate Analysis Report 2025"
- Institution: "example.gov"
- Year: 2025

## User Interface

### Analysis Results - "Create Citation" Button

```
┌─────────────────────────────────────────────────────┐
│ Overview Tab                                        │
│ ┌───────────────────────────────────────────────┐   │
│ │ Article Title          [Create Citation ▸]   │   │
│ │ By Author Name                               │   │
│ │ Published: 2025-01-15                        │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ Summary:                                            │
│ Article summary text...                             │
└─────────────────────────────────────────────────────┘
```

### Saved Links Library - Citation Icon

```
┌─────────────────────────────────────────────────────┐
│ Recently Saved Links                                │
│ ┌───────────────────────────────────────────────┐   │
│ │ Article Title                                 │   │
│ │ https://example.com/article                   │   │
│ │ Tags: research, ai                            │   │
│ │                                               │   │
│ │ [Re-analyze] [📖 Citation]                   │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Benefits

✅ **Time Saving** - No manual data entry for citations
✅ **Accuracy** - Metadata extracted directly from source
✅ **Consistency** - Standardized citation formats
✅ **Research Workflow** - Seamless from analysis to citation
✅ **Multiple Formats** - Supports APA, MLA, Chicago, Harvard

## Future Enhancements

- [ ] Bulk citation export for multiple analyzed links
- [ ] Direct export to bibliography management tools (Zotero, Mendeley)
- [ ] Citation editing history tracking
- [ ] DOI/ISBN lookup integration
- [ ] BibTeX/RIS export formats
- [ ] Citation quality validation

## Error Handling

- **Missing metadata**: Falls back to minimal citation with URL
- **Invalid dates**: Uses year only if available
- **No author**: Allows empty author field (org name used instead)
- **Social media**: Treated as website with platform noted

## Testing Checklist

- [x] Click "Create Citation" from analysis overview
- [x] Click citation icon from saved link
- [x] URL parameters correctly populate form fields
- [x] Author name parsing for various formats
- [x] Date extraction and formatting
- [x] Source type auto-detection
- [x] Navigation maintains context
- [x] Toast notifications display correctly

## Code Quality

- ✅ TypeScript strict mode compliance
- ✅ No build errors or warnings
- ✅ Proper error handling and user feedback
- ✅ Type-safe parameter passing
- ✅ Clean separation of concerns

---

**Created**: 2025-10-06
**Last Updated**: 2025-10-06
**Status**: ✅ Production Ready
