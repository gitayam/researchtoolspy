# URL Processing Tool - Implementation Plan

**Created:** October 2, 2025
**Status:** Planning
**Priority:** High (Sprint 3, Tool #3)
**Estimated Time:** 6-8 hours

---

## 🎯 Goal

Build a comprehensive URL analysis tool for research that can:
1. Extract metadata from any URL
2. Check domain reliability and reputation
3. Access archived versions via Wayback Machine
4. Validate links and check availability
5. Analyze SEO data and social signals
6. Security and SSL certificate checks
7. Export analysis results

---

## 📋 Features

### Phase 1: Basic URL Analysis (3-4 hours)
- [x] URL validation and normalization
- [ ] Metadata extraction (title, description, author, date)
- [ ] Domain information (registration, age, hosting)
- [ ] SSL certificate validation
- [ ] Response time and status code
- [ ] Redirect chain analysis
- [ ] Real-time preview

### Phase 2: Wayback Machine Integration (1-2 hours)
- [ ] Check if URL is archived
- [ ] List available snapshots
- [ ] Show timeline of captures
- [ ] Quick access to archived versions
- [ ] Compare current vs archived content

### Phase 3: Reliability Scoring (1-2 hours)
- [ ] Domain age scoring
- [ ] SSL/HTTPS scoring
- [ ] Content quality indicators
- [ ] Broken link detection
- [ ] Spam/malware checks
- [ ] Overall reliability score (0-100)

### Phase 4: Advanced Analysis (1-2 hours)
- [ ] SEO data (meta tags, structured data)
- [ ] Social media sharing stats
- [ ] Backlink information
- [ ] Page speed metrics
- [ ] Mobile-friendliness
- [ ] Accessibility score

---

## 🏗️ Architecture

### Frontend Components

```
src/pages/tools/
  └── URLProcessingPage.tsx (Main page)

src/components/tools/
  ├── URLAnalyzer.tsx (Input and analysis trigger)
  ├── URLMetadata.tsx (Metadata display)
  ├── DomainInfo.tsx (Domain information)
  ├── WaybackTimeline.tsx (Archive timeline)
  ├── ReliabilityScore.tsx (Scoring visualization)
  └── URLExport.tsx (Export options)

src/types/
  └── url-processing.ts (Type definitions)
```

### Backend API

```
functions/api/tools/
  ├── analyze-url.ts (Main URL analysis endpoint)
  ├── wayback.ts (Wayback Machine integration)
  └── domain-info.ts (Domain/WHOIS data)

Functions needed:
  - POST /api/tools/analyze-url - Analyze single URL
  - GET /api/tools/wayback/:url - Get archive snapshots
  - GET /api/tools/domain-info/:domain - Get domain data
```

---

## 🔧 Technical Stack

### URL Analysis
- **URL parsing** - Built-in URL API
- **HTTP requests** - Fetch API with proper headers
- **HTML parsing** - Regex for metadata extraction
- **SSL validation** - Check certificate validity

### Wayback Machine
- **API:** https://archive.org/wayback/available
- **CDX API** for snapshot listing
- **Memento API** for time travel

### Domain Information
- **DNS lookups** - Via Cloudflare Workers (limited)
- **WHOIS data** - Via third-party APIs if available
- **IP geolocation** - IP address and location

### Reliability Scoring Algorithm
```
Score Components (0-100):
- SSL/HTTPS: 20 points
- Domain age: 20 points (older = better)
- Content quality: 20 points
- Archive history: 15 points
- Response time: 10 points
- Valid metadata: 10 points
- No malware flags: 5 points
```

---

## 📝 API Specification

### POST /api/tools/analyze-url

**Request:**
```typescript
{
  url: string,
  options?: {
    checkWayback?: boolean,
    checkSEO?: boolean,
    checkSecurity?: boolean
  }
}
```

**Response:**
```typescript
{
  url: string,
  normalizedUrl: string,

  // Metadata
  metadata: {
    title?: string,
    description?: string,
    author?: string,
    publishDate?: string,
    type?: string,
    image?: string
  },

  // Domain Info
  domain: {
    name: string,
    registrationDate?: string,
    age?: number, // days
    ssl: boolean,
    sslExpiry?: string,
    ipAddress?: string,
    location?: string
  },

  // Status
  status: {
    code: number,
    ok: boolean,
    responseTime: number, // ms
    redirects: string[],
    error?: string
  },

  // Wayback
  wayback?: {
    isArchived: boolean,
    firstSnapshot?: string,
    lastSnapshot?: string,
    totalSnapshots?: number,
    archiveUrl?: string
  },

  // Reliability Score
  reliability: {
    score: number, // 0-100
    breakdown: {
      ssl: number,
      domainAge: number,
      contentQuality: number,
      archiveHistory: number,
      responseTime: number,
      metadata: number,
      security: number
    },
    rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unknown'
  },

  // SEO (optional)
  seo?: {
    metaTags: Record<string, string>,
    structuredData?: any,
    openGraph?: Record<string, string>,
    twitterCard?: Record<string, string>
  },

  analyzedAt: string
}
```

---

## 🎨 UI Design

### Layout

```
┌─────────────────────────────────────────────┐
│  URL Processing & Analysis                  │
├─────────────────────────────────────────────┤
│                                             │
│  Enter URL to analyze:                      │
│  ┌─────────────────────────────────────┐   │
│  │ https://example.com                 │   │
│  └─────────────────────────────────────┘   │
│  [Analyze URL] [Clear]                      │
│                                             │
│  Advanced Options:                          │
│  ☑ Check Wayback Machine                   │
│  ☑ SEO Analysis                             │
│  ☑ Security Checks                          │
│                                             │
├─────────────────────────────────────────────┤
│  📊 Analysis Results                        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────┐                  │
│  │ Reliability Score    │                  │
│  │                      │                  │
│  │       85/100         │                  │
│  │     ████████░░       │                  │
│  │                      │                  │
│  │  Rating: Good        │                  │
│  └──────────────────────┘                  │
│                                             │
│  📄 Metadata                                │
│  ┌───────────────────────────────────────┐ │
│  │ Title: Example Domain                 │ │
│  │ Description: This domain is for use...│ │
│  │ Type: website                         │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  🌐 Domain Information                      │
│  ┌───────────────────────────────────────┐ │
│  │ Domain: example.com                   │ │
│  │ Age: 9,876 days (27 years)           │ │
│  │ SSL: ✓ Valid until Dec 31, 2025     │ │
│  │ IP: 93.184.216.34                     │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  📚 Archive History (Wayback Machine)       │
│  ┌───────────────────────────────────────┐ │
│  │ First Snapshot: Jan 15, 1998          │ │
│  │ Latest Snapshot: Oct 1, 2025          │ │
│  │ Total Snapshots: 2,547                │ │
│  │                                       │ │
│  │ Timeline:                             │ │
│  │ |||||||||||||||||||||||||||||||||    │ │
│  │ 1998─────────2012─────────2025       │ │
│  │                                       │ │
│  │ [View in Wayback Machine]             │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ⚡ Performance                              │
│  ┌───────────────────────────────────────┐ │
│  │ Response Time: 145ms                  │ │
│  │ Status Code: 200 OK                   │ │
│  │ Redirects: None                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Export JSON] [Export PDF] [Copy Link]    │
└─────────────────────────────────────────────┘
```

---

## 🚀 Implementation Steps

### Step 1: Create Type Definitions (30 min)
```typescript
// src/types/url-processing.ts
export interface URLAnalysisRequest {
  url: string
  checkWayback?: boolean
  checkSEO?: boolean
  checkSecurity?: boolean
}

export interface URLMetadata {
  title?: string
  description?: string
  author?: string
  publishDate?: string
  type?: string
  image?: string
}

export interface DomainInfo {
  name: string
  registrationDate?: string
  age?: number
  ssl: boolean
  sslExpiry?: string
  ipAddress?: string
  location?: string
}

export interface URLStatus {
  code: number
  ok: boolean
  responseTime: number
  redirects: string[]
  error?: string
}

export interface WaybackInfo {
  isArchived: boolean
  firstSnapshot?: string
  lastSnapshot?: string
  totalSnapshots?: number
  archiveUrl?: string
  timeline?: Array<{ date: string; url: string }>
}

export interface ReliabilityScore {
  score: number
  breakdown: {
    ssl: number
    domainAge: number
    contentQuality: number
    archiveHistory: number
    responseTime: number
    metadata: number
    security: number
  }
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unknown'
}

export interface URLAnalysisResult {
  url: string
  normalizedUrl: string
  metadata: URLMetadata
  domain: DomainInfo
  status: URLStatus
  wayback?: WaybackInfo
  reliability: ReliabilityScore
  seo?: any
  analyzedAt: string
}
```

### Step 2: Build Backend API (2-3 hours)
- Implement URL analysis endpoint
- Add Wayback Machine API integration
- Add metadata extraction
- Implement reliability scoring
- Add error handling

### Step 3: Build UI Components (2-3 hours)
- URL input form with validation
- Results display components
- Wayback timeline visualization
- Reliability score gauge
- Export functionality

### Step 4: Integration & Testing (1 hour)
- Connect UI to API
- Test with various URLs
- Error handling
- Loading states
- Export to JSON/PDF

---

## 📚 Wayback Machine API

### Check Availability
```
GET https://archive.org/wayback/available?url=example.com
```

### Get Snapshots
```
GET http://web.archive.org/cdx/search/cdx?url=example.com&output=json
```

### Access Archived URL
```
https://web.archive.org/web/{timestamp}/{url}
```

---

## 🎯 Success Criteria

- ✅ User can enter any URL
- ✅ System validates and normalizes URL
- ✅ Metadata extracted and displayed
- ✅ Domain information shown
- ✅ SSL status verified
- ✅ Wayback Machine integration working
- ✅ Reliability score calculated
- ✅ Results exportable to JSON
- ✅ Error handling for invalid URLs
- ✅ Loading states during analysis

---

## 📈 Future Enhancements

- Link checker (scan page for broken links)
- Screenshot capture
- Content comparison (current vs archived)
- Batch URL analysis
- Historical trend tracking
- API rate limiting and caching
- Integration with Evidence Collector
- Save analysis history

---

**Status**: Ready to implement Phase 1
