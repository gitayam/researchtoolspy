# 📊 Content Intelligence Tool - Implementation Plan

## Overview

Unified OSINT tool for URL analysis, content extraction, entity recognition, and intelligent question-answering. Replaces and consolidates:
- Content Extraction Page
- Batch Processing Page
- URL Processing Page
- Web Scraping endpoints
- Social Media integration

---

## ✅ Features Implemented

### Phase 1 - Core Foundation (COMPLETED)

| Feature | Status | File |
|---------|--------|------|
| Database Schema | ✅ Done | `schema/migrations/014-content-intelligence.sql` |
| TypeScript Types | ✅ Done | `src/types/content-intelligence.ts` |
| URL Analysis Backend | ✅ Done | `functions/api/content-intelligence/analyze-url.ts` |

### Features Included in Backend:

1. **✅ URL Content Extraction**
   - 15-second timeout with AbortController
   - HTML parsing & text cleaning
   - Metadata extraction (title, author, date)
   - SHA-256 content hashing

2. **✅ Word Frequency Analysis**
   - 2-10 word phrase extraction
   - Stop word filtering
   - Top 10 phrases with percentages
   - Ready for word cloud visualization

3. **✅ Bypass/Archive Links (Instant)**
   - 12ft.io paywall bypass
   - Archive.is archival
   - Wayback Machine
   - Google Cache
   - Outline reader
   - **Generated immediately** (no API calls, appear while processing)

4. **✅ Social Media Detection**
   - Auto-detect: Twitter/X, Facebook, Instagram, LinkedIn, TikTok, YouTube, Reddit
   - Platform-specific handling ready
   - Integration point for existing social media functions

5. **✅ Entity Extraction with GPT**
   - People, organizations, locations
   - Frequency counts
   - gpt-5-mini model (fast, cheap)
   - Error handling & fallbacks

6. **✅ Summary Generation**
   - 200-250 word AI summaries
   - Key facts extraction
   - Timeout protection

7. **✅ Link Saver with Notes/Reminders**
   - Save links with or without processing
   - Add notes & tags
   - Set reminders
   - Link to full analysis

---

## 🚧 Phase 2 - Frontend & Advanced Features (TODO)

### Immediate Next Steps:

#### 1. Main Content Intelligence Page
**File:** `src/pages/tools/ContentIntelligencePage.tsx`

```tsx
Features needed:
- ✅ URL input with validation
- ✅ Quick save button (save link without processing)
- ✅ Process & analyze button
- ✅ Batch URL input (paste multiple)
- ✅ Processing progress indicator
- ✅ Quick Actions bar (bypass/archive links)
  - Should appear IMMEDIATELY when URL entered
  - Links clickable while processing happens
- ✅ Tab navigation (Overview, Word Analysis, Entities, Q&A, Starbursting)
```

#### 2. Word Cloud Visualization
**File:** `src/components/content-intelligence/WordCloud.tsx`

```tsx
Library: react-wordcloud or d3-cloud
Features:
- Interactive word cloud from top_phrases
- Click word to highlight in content
- Export as image
```

#### 3. Saved Links Library
**Files:**
- `src/components/content-intelligence/SavedLinksLibrary.tsx`
- `functions/api/content-intelligence/saved-links.ts` (CRUD endpoints)

```tsx
Features:
- List all saved links with search/filter
- Tags & reminder display
- Quick actions: Analyze, Edit Note, Delete
- Reminder notifications
```

#### 4. Starbursting Integration
**File:** `functions/api/content-intelligence/starbursting.ts`

```tsx
Features:
- Single link → auto-populate Starbursting framework
- Multiple links → prompt which to use
- Pass content to /api/starbursting endpoint
- Pre-fill central_topic, context from content
- Return session_id and redirect to Starbursting page
```

#### 5. Question-Answering System
**File:** `functions/api/content-intelligence/answer-question.ts`

```tsx
Features:
- User asks question about content
- Hybrid search: regex + semantic (GPT)
- Extract relevant excerpts
- Confidence scoring
- Flag missing data
- Show source paragraphs
```

**Search Strategy:**
```typescript
1. Regex search for exact keyword matches
2. Semantic search with GPT:
   - "Given this question and content, extract the answer"
   - Return answer + source excerpts + confidence
3. Combine results
4. Identify data gaps
```

---

## 🏗️ Architecture Overview

### Data Flow:

```
User enters URL
    ↓
Generate bypass/archive links INSTANTLY ← Display immediately
    ↓
[Background] Fetch URL content (15s timeout)
    ↓
Extract metadata + clean text
    ↓
Calculate content hash
    ↓
[Parallel Processing]
    ├─→ Word frequency analysis (local, fast)
    ├─→ Entity extraction (GPT, ~3s)
    └─→ Summary generation (GPT, ~3s)
    ↓
Save to database
    ↓
[Optional] Save to link library
    ↓
Return complete analysis
```

### Processing Modes:

| Mode | Features | Time | Use Case |
|------|----------|------|----------|
| **Quick** | Metadata + top 5 phrases + bypass links | <5s | Fast preview |
| **Full** | + Entities + Summary + Word cloud | 10-15s | Standard analysis |
| **Forensic** | + Archive screenshots + Chain of custody | 20-30s | Legal evidence |

---

## 🔗 API Endpoints

### Already Implemented:

```
POST /api/content-intelligence/analyze-url
  Request: { url, mode: 'quick'|'full'|'forensic', save_link: boolean }
  Response: ContentAnalysis object
```

### TODO - Implement:

```
POST /api/content-intelligence/save-link
  Request: { url, title, note, tags, reminder_date }
  Response: { id, saved_link }

GET /api/content-intelligence/saved-links
  Query: ?search=&tags=&page=&limit=
  Response: { links: SavedLink[], total }

PUT /api/content-intelligence/saved-links/:id
  Request: { note, tags, reminder_date }
  Response: { updated: SavedLink }

DELETE /api/content-intelligence/saved-links/:id
  Response: { success: boolean }

POST /api/content-intelligence/answer-question
  Request: { analysis_id, question }
  Response: QuestionAnswer object

POST /api/content-intelligence/starbursting
  Request: { analysis_ids: number[], title }
  Response: { session_id, redirect_url }

GET /api/content-intelligence/analysis/:id
  Response: ContentAnalysis object
```

---

## 🎨 UI Component Structure

```
ContentIntelligencePage.tsx
├── InputSection
│   ├── URL input field
│   ├── "Quick Save" button
│   ├── "Analyze" button
│   └── Batch mode toggle
│
├── QuickActionsBar (appears immediately)
│   ├── 12ft.io bypass
│   ├── Archive.is
│   ├── Wayback Machine
│   ├── Google Cache
│   ├── Screenshot
│   └── Save Link
│
├── ProcessingStatus
│   ├── Progress bar
│   └── Current step indicator
│
└── ResultsTabs
    ├── OverviewTab
    │   ├── Title, author, date
    │   ├── Summary
    │   ├── Key entities preview
    │   └── Actions: Save as Evidence, Citation, Export
    │
    ├── WordAnalysisTab
    │   ├── Top 10 phrase chart
    │   ├── Word cloud
    │   └── Export CSV
    │
    ├── EntitiesTab
    │   ├── People list with counts
    │   ├── Organizations list
    │   ├── Locations list
    │   └── Export JSON
    │
    ├── QATab
    │   ├── Question input
    │   ├── Answer display
    │   ├── Source excerpts
    │   └── Missing data warnings
    │
    └── StarburstingTab
        ├── Single link → Launch button
        ├── Batch → Select links
        └── Recent sessions list
```

---

## 🔌 Integration Points

### 1. **Social Media Functions**
When social media URL detected:
```typescript
if (socialMediaInfo) {
  // Use existing social media API
  const socialData = await fetch('/api/social-media', {
    method: 'POST',
    body: JSON.stringify({ url, platform: socialMediaInfo.platform })
  })
  // Merge with content analysis
}
```

### 2. **Starbursting Framework**
```typescript
async function launchStarbursting(analysisIds: number[]) {
  // Fetch content from analysis IDs
  const contents = await fetchAnalyses(analysisIds)

  // Call existing Starbursting API
  const session = await fetch('/api/starbursting/create', {
    method: 'POST',
    body: JSON.stringify({
      title: `Analysis of ${contents.length} sources`,
      central_topic: contents[0].title,
      context: contents.map(c => c.summary).join('\n\n'),
      request_ai_questions: true
    })
  })

  // Redirect to Starbursting page
  navigate(`/frameworks/starbursting/${session.session_id}`)
}
```

### 3. **Evidence System**
```typescript
function saveAsEvidence(analysis: ContentAnalysis) {
  return {
    title: analysis.title,
    description: analysis.summary,
    who: analysis.entities.people.map(p => p.name).join(', '),
    what: analysis.summary,
    when_occurred: analysis.publish_date,
    where_location: analysis.entities.locations.map(l => l.name).join(', '),
    source_url: analysis.url,
    source_classification: 'primary', // Could be determined by GPT
    evidence_type: mapToEvidenceType(analysis),
    credibility: calculateCredibility(analysis),
    tags: [...analysis.entities.people.map(p => p.name), ...analysis.entities.organizations.map(o => o.name)]
  }
}
```

---

## 📝 Implementation Checklist

### Backend (Cloudflare Functions):

- [x] Main analysis endpoint with GPT
- [x] Word frequency analysis
- [x] Entity extraction
- [x] Summary generation
- [x] Bypass/archive URL generation
- [x] Social media detection
- [x] Database persistence
- [ ] Saved links CRUD endpoints
- [ ] Question-answering endpoint
- [ ] Starbursting integration endpoint
- [ ] Screenshot capture (Puppeteer)
- [ ] Batch processing queue

### Frontend (React + shadcn/ui):

- [ ] Main ContentIntelligencePage
- [ ] InputSection component
- [ ] QuickActionsBar component
- [ ] ProcessingStatus component
- [ ] OverviewTab component
- [ ] WordAnalysisTab component
- [ ] EntitiesTab component
- [ ] QATab component
- [ ] StarburstingTab component
- [ ] SavedLinksLibrary component
- [ ] WordCloud visualization
- [ ] Export functions (JSON, CSV, PDF)

### Testing:

- [ ] Test with news articles
- [ ] Test with social media posts
- [ ] Test with academic papers
- [ ] Test with PDFs
- [ ] Test batch processing
- [ ] Test timeout scenarios
- [ ] Test GPT error handling

---

## 🚀 Deployment Steps

1. **Database Migration**
   ```bash
   npx wrangler d1 execute research-tools-db \
     --file=schema/migrations/014-content-intelligence.sql \
     --remote
   ```

2. **Environment Variables**
   - `OPENAI_API_KEY` - Already set in Cloudflare dashboard

3. **Deploy Functions**
   ```bash
   npm run deploy
   ```

4. **Update Navigation**
   - Add "Content Intelligence" to tools menu
   - Remove old: Content Extraction, Batch Processing, URL Processing
   - Or keep as legacy with deprecation notice

---

## 🎯 Success Metrics

- **Speed**: <15s for full analysis
- **Accuracy**: Entity extraction >90% precision
- **UX**: Bypass links appear <1s
- **Reliability**: <1% timeout failures
- **Storage**: <500KB per analysis in DB

---

## 📚 Documentation TODO

- [ ] User guide with screenshots
- [ ] API documentation
- [ ] Word frequency algorithm explanation
- [ ] Q&A search methodology
- [ ] Starbursting integration guide

---

## 🔮 Future Enhancements

### Phase 3 (Advanced):

1. **Image Analysis**
   - Reverse image search
   - EXIF data extraction
   - Manipulation detection

2. **Historical Comparison**
   - Compare current vs archived versions
   - Highlight changes
   - Timeline visualization

3. **Multi-Source Verification**
   - Cross-reference claims across multiple sources
   - Fact-checking integration
   - Source reliability scoring

4. **Network Analysis**
   - Link graph visualization
   - Related content discovery
   - Citation networks

5. **AI Enhancements**
   - Claim extraction & verification
   - Bias detection
   - Sentiment analysis
   - Language translation

---

## 🐛 Known Issues & Limitations

1. **JavaScript-heavy sites**: May not extract content from dynamic sites
   - **Solution**: Implement Puppeteer/Playwright for rendering

2. **Paywalled content**: Bypass links may not work for all sites
   - **Solution**: Provide multiple bypass options

3. **Rate limiting**: Some sites may block automated requests
   - **Solution**: Implement delays, rotating user agents

4. **GPT costs**: Entity extraction costs ~$0.001 per request
   - **Solution**: Cache results, offer non-GPT fallback

5. **Large documents**: 10KB limit for GPT
   - **Solution**: Chunk processing for longer content

---

## 📞 Support & Maintenance

- **Primary Developer**: [Your Name]
- **Documentation**: This file + inline code comments
- **Issue Tracking**: GitHub Issues
- **Updates**: Weekly during active development

---

**Last Updated**: 2025-10-06
**Version**: 1.0.0
**Status**: Phase 1 Complete, Phase 2 In Progress
