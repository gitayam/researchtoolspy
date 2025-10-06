# URL Scraping & AI Analysis Integration Plan

## 🎯 Objective
Enable users to submit URLs that get scraped, summarized by GPT-5-nano, and intelligently populate framework fields with extracted information.

## 📋 Core Requirements
1. URL submission interface
2. Backend web scraping (extract text from articles/pages)
3. GPT-5-nano summarization and structured extraction
4. Auto-populate framework fields
5. AI refinement of populated fields
6. Question generation based on scraped content

## 🔍 Use Cases

### **Primary Frameworks** (Highest Value)

#### **1. Starbursting (5W + How)**
**Why it's perfect:** Designed for asking who/what/when/where/why/how questions
- **URL Input:** News article, report, or event description
- **AI Extraction:**
  - Who: Identify actors, stakeholders, organizations
  - What: Extract key actions, events, claims
  - When: Parse dates, timelines, sequences
  - Where: Extract locations, geography
  - Why: Infer motivations, reasons, objectives
  - How: Identify methods, processes, techniques
- **Pre-fill:** 3-5 questions per category
- **User Refinement:** Add context, ask follow-up questions

#### **2. DIME Framework**
**Why it's perfect:** Analyzes power instruments in geopolitical scenarios
- **URL Input:** Geopolitical news, policy announcements, conflict reports
- **AI Extraction:**
  - Diplomatic: Treaties, negotiations, alliances mentioned
  - Information: Media narratives, propaganda, messaging
  - Military: Force deployments, capabilities, operations
  - Economic: Sanctions, trade, economic pressure
- **Pre-fill:** Extract relevant statements/facts for each dimension
- **User Refinement:** Add analysis, connect to other intelligence

#### **3. Causeway Analysis (PUTAR)**
**Why it's perfect:** Threat analysis from news/intelligence
- **URL Input:** Threat reports, incident descriptions, security briefings
- **AI Extraction:**
  - Problem: Identify the issue/threat
  - Undesired Actor: Extract bad actors, adversaries
  - Target Audience: Identify who's being influenced/threatened
  - Remedy: Extract proposed solutions, countermeasures
  - Story: Summarize the narrative
- **Pre-fill:** Initial PUTAR components
- **User Refinement:** Develop critical capabilities/requirements

#### **4. Deception Detection (SATS)**
**Why it's perfect:** Analyze claims and narratives for deception
- **URL Input:** Suspicious claims, propaganda, misinformation
- **AI Extraction:**
  - Scenario: Extract the claim/narrative being assessed
  - MOM: Identify potential motives/opportunities/means
  - POP: Note if historical patterns mentioned
  - MOSES: Flag source vulnerabilities
  - EVE: Assess consistency indicators
- **Pre-fill:** Scenario and initial indicators
- **User Refinement:** Deep analysis, scoring, assessment

### **Secondary Frameworks** (Good Value)

#### **5. COG (Center of Gravity)**
- **URL Input:** Military/strategic analysis, force assessments
- **Extract:** Centers of gravity, capabilities, requirements, vulnerabilities

#### **6. PMESII-PT**
- **URL Input:** Country reports, regional analysis, OSINT
- **Extract:** Political, Military, Economic, Social, Information, Infrastructure, Physical, Time factors

#### **7. SWOT Analysis**
- **URL Input:** Company news, market analysis, competitor reports
- **Extract:** Strengths, Weaknesses, Opportunities, Threats

#### **8. Behavior Analysis**
- **URL Input:** Social research, behavioral studies, field reports
- **Extract:** Basic info, timeline, motivations, obstacles, consequences

## 🏗️ Architecture

### **Backend Components**

#### **1. Web Scraping API** (`/api/ai/scrape-url`)
```typescript
POST /api/ai/scrape-url
{
  "url": "https://example.com/article",
  "framework": "starbursting" | "dime" | "causeway" | etc.
}

Response:
{
  "url": "...",
  "title": "Article Title",
  "content": "Full text content...",
  "summary": "GPT-5-nano summary...",
  "extractedData": {
    // Framework-specific extracted fields
  },
  "metadata": {
    "publishDate": "...",
    "author": "...",
    "source": "..."
  }
}
```

**Implementation:**
- Use Cloudflare Workers fetch to get HTML
- Parse HTML to extract main content (remove ads, nav, footers)
- Send to GPT-5-nano for summarization
- Use framework-specific extraction prompts

#### **2. Extraction Prompts** (Framework-Specific)

**Starbursting Extraction Prompt:**
```
Extract information from this article and generate 5W+How questions:

Article: {content}

Return JSON:
{
  "who": ["Question 1?", "Question 2?", ...],
  "what": ["Question 1?", "Question 2?", ...],
  "when": ["Question 1?", "Question 2?", ...],
  "where": ["Question 1?", "Question 2?", ...],
  "why": ["Question 1?", "Question 2?", ...],
  "how": ["Question 1?", "Question 2?", ...]
}
```

**DIME Extraction Prompt:**
```
Analyze this content for DIME framework elements:

Article: {content}

Extract:
{
  "diplomatic": ["fact 1", "fact 2", ...],
  "information": ["fact 1", "fact 2", ...],
  "military": ["fact 1", "fact 2", ...],
  "economic": ["fact 1", "fact 2", ...]
}
```

### **Frontend Components**

#### **1. URL Input Component** (`AIUrlScraper.tsx`)
```typescript
interface AIUrlScraperProps {
  framework: string
  onExtract: (data: ExtractedData) => void
}

// Features:
- URL input field
- Framework selection (auto-detect from context)
- "Analyze URL" button
- Loading state with progress
- Preview extracted data
- "Accept & Populate" button
```

#### **2. Integration Points**

**GenericFrameworkForm:**
- Add `<AIUrlScraper>` above basic info card
- On extract: populate section fields with extracted items
- Show indicator for AI-populated fields

**DeceptionForm:**
- Add URL scraper to scenario tab
- Pre-fill scenario, initial MOM/POP/MOSES/EVE indicators

**SwotForm:**
- Add URL scraper
- Extract and populate strengths/weaknesses/opportunities/threats

## 🚀 Implementation Phases

### **Phase 1: Core Infrastructure** (1-2 hours)
- [ ] Create `/api/ai/scrape-url` endpoint
- [ ] Implement HTML parsing and content extraction
- [ ] Basic GPT-5-nano summarization
- [ ] Create `AIUrlScraper` component

### **Phase 2: Framework-Specific Extraction** (2-3 hours)
- [ ] Starbursting extraction prompts
- [ ] DIME extraction prompts
- [ ] Causeway extraction prompts
- [ ] Deception extraction prompts
- [ ] Structured JSON parsing

### **Phase 3: Form Integration** (1-2 hours)
- [ ] Integrate into GenericFrameworkForm
- [ ] Integrate into DeceptionForm
- [ ] Integrate into SwotForm
- [ ] Visual indicators for AI-populated fields

### **Phase 4: Enhancements** (1-2 hours)
- [ ] Multiple URL support (batch scraping)
- [ ] URL history/cache
- [ ] Source citation tracking
- [ ] Export with sources

## 📊 User Flow

```
1. User navigates to framework form (e.g., Starbursting)
2. Clicks "Import from URL" button
3. Enters URL (e.g., news article)
4. AI scrapes URL → extracts text → summarizes with GPT-5-nano
5. AI analyzes content for framework-specific information
6. Preview shows extracted questions/data
7. User reviews and clicks "Accept & Populate"
8. Form fields auto-fill with extracted content
9. User can:
   - Edit AI-populated fields
   - Use AI assistant for refinement
   - Generate follow-up questions
   - Add manual context
10. Complete analysis with AI + human insight
```

## 🔒 Security & Error Handling

- **Rate Limiting:** Max 10 URL scrapes per user per hour
- **Content-Length Limits:** Max 100KB of text content
- **Error States:**
  - Invalid URL
  - Unreachable URL (404, timeout)
  - Paywalled/blocked content
  - Failed extraction
  - AI generation errors
- **Privacy:** Don't store full URL content, only summaries
- **Citation:** Always cite source URL in analysis

## 📈 Success Metrics

1. **Adoption:** % of analyses using URL import
2. **Time Savings:** Reduction in form completion time
3. **Quality:** Analysis depth/completeness metrics
4. **Accuracy:** User edits vs AI population ratio

## 🎯 Future Enhancements

1. **Multi-source synthesis:** Combine multiple URLs
2. **PDF support:** Extract from PDF documents
3. **Image analysis:** OCR and visual content extraction
4. **API integrations:** Twitter, news APIs, RSS feeds
5. **Automated monitoring:** Track URLs for updates
6. **Contradiction detection:** Flag conflicting information across sources

## 🏁 Phase 1 Implementation Details

### Files to Create:
1. `functions/api/ai/scrape-url.ts` - Backend scraping endpoint
2. `src/components/ai/AIUrlScraper.tsx` - URL input component
3. `src/lib/ai/url-extraction.ts` - Extraction logic and prompts
4. `src/lib/ai/html-parser.ts` - HTML content extraction

### Files to Modify:
1. `src/components/frameworks/GenericFrameworkForm.tsx` - Add URL scraper
2. `src/components/frameworks/DeceptionForm.tsx` - Add URL scraper
3. `src/components/frameworks/SwotForm.tsx` - Add URL scraper
4. `src/components/ai/index.ts` - Export new component

---

**Grade: 9.5/10**

**Strengths:**
✅ Solves real workflow problem (manual data entry)
✅ Leverages AI for intelligent extraction
✅ Framework-agnostic design
✅ User maintains control (preview/edit)
✅ Builds on existing AI infrastructure

**Implementation Priority:** 🔥 HIGH - Significant user value
