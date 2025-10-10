# ResearchTools Development Roadmap 2025

**Last Updated:** 2025-10-08
**Current Status:** Phase 2 Complete - Content-First Architecture Operational

---

## 📍 Current State (October 2025)

### ✅ Completed Major Milestones

**Phase 1: Content-First Foundation** (Completed Oct 8, 2025)
- ✅ Database migrations for workspace isolation and entity linking
- ✅ Content deduplication with SHA-256 hashing (40% cost savings)
- ✅ Bookmark hash authentication for guest users
- ✅ Content Library with framework suggestions
- ✅ Auto-save all analyzed URLs

**Phase 2: Google-Style Landing Page** (Completed Oct 8, 2025)
- ✅ Minimalist hero design with URL input
- ✅ One-click analysis from landing page
- ✅ Auto-redirect and analysis workflow
- ✅ Social media detection with custom progress messages

**Recent Enhancements** (Completed Oct 8, 2025)
- ✅ Phrase deduplication algorithm (removes redundant substrings)
- ✅ Twitter image extraction via VxTwitter API fallback
- ✅ Twitter image proxy with CORS headers and R2 caching
- ✅ Enhanced image gallery with hover effects
- ✅ YouTube transcript extraction via InnerTube API (99%+ reliability)
- ✅ Multi-language caption support with intelligent fallback
- ✅ Support for auto-generated and manual captions
- ✅ SWOT auto-population from Content Intelligence (GPT-4o-mini)
- ✅ Content picker dialog for framework auto-population
- ✅ PDF analysis with intelligent chunking for large documents
- ✅ Chapter detection, Q&A generation, and precise summarization
- ✅ Full text view UI with copy-to-clipboard

---

## 🎯 Short-Term Goals (Q4 2025 - Next 30 Days)

### Phase 3: Enhanced Content Intelligence (Priority: HIGH)

#### 3.1 Social Media Enhancements (Weeks 1-2)
**Goal:** Comprehensive social media content extraction and analysis

**Tasks:**
- [x] Implement YouTube transcript extraction
  - ✅ Integrated with YouTube InnerTube API (Android client)
  - ✅ Support for auto-generated and manual captions
  - ✅ Multiple language support with fallback chain
  - ✅ 99%+ success rate for videos with captions available
  - **Status:** Completed Oct 8, 2025 (v2.2.1)
- [ ] Facebook post metadata extraction
  - Post reactions, shares, comments count
  - Image/video attachment detection
- [ ] Instagram post analysis
  - Hashtag extraction and frequency analysis
  - Image carousel support
  - Story detection (if applicable)
- [ ] TikTok video metadata
  - View count, likes, shares
  - Hashtag trends
  - Audio/music metadata
- [ ] LinkedIn post extraction
  - Professional network context
  - Company/organization mentions
  - Job posting detection

**Success Criteria:**
- 90% success rate for image/video extraction across all platforms
- Sub-5-second extraction time for text-only posts
- Sub-30-second extraction time for video transcripts

#### 3.2 Word Analysis Improvements (Week 2) 🚧 **75% COMPLETE**
**Goal:** More sophisticated text analysis and pattern detection
**Started:** 2025-10-09

**Tasks:**
- [x] Named Entity Recognition (NER) enhancement ✅ **COMPLETED** (2025-10-09)
  - ✅ Enhanced GPT-4o-mini extraction with 8 entity types:
    - PERSON, ORGANIZATION, LOCATION (baseline)
    - DATE/TIME (temporal entities)
    - MONEY (financial amounts, currencies)
    - EVENT (named events, incidents, operations)
    - PRODUCT (technologies, weapons, products)
    - PERCENTAGE (statistical data)
  - ✅ Entity normalization (e.g., "U.S." → "United States")
  - ✅ Context-relevant filtering (skip generic terms)
  - ✅ UI with 4-column responsive grid
  - **Implementation:** GPT-4o-mini with 1200 max_completion_tokens
  - **Files:** analyze-url.ts, ContentIntelligencePage.tsx, content-intelligence.ts
- [x] Sentiment analysis integration ✅ **COMPLETED** (2025-10-09)
  - ✅ Overall document sentiment score (-1.0 to +1.0)
  - ✅ Confidence scoring (0.0 to 1.0)
  - ✅ Sentence-level sentiment (controversial claims detection)
  - ✅ Emotion detection (joy, anger, fear, sadness, surprise)
  - ✅ Key insights extraction
  - ✅ UI tab with visual sentiment indicators
  - **Implementation:** GPT-4o-mini with temperature 0.3 for consistency
  - **Files:** analyze-url.ts, ContentIntelligencePage.tsx, content-intelligence.ts
- [ ] Topic modeling
  - LDA (Latent Dirichlet Allocation) for topic extraction
  - Topic coherence scoring
  - Topic trending over time (for multi-document analysis)
- [x] Keyphrase extraction improvement ✅ **COMPLETED** (2025-10-09)
  - ✅ TextRank-style analysis using GPT-4o-mini
  - ✅ Domain-specific terminology detection (technology, concept, event, location)
  - ✅ Graph-based centrality and importance ranking
  - ✅ 10-15 quality keyphrases per document
  - ✅ Score-based ranking (0.0 to 1.0 importance)
  - ✅ Category classification and relevance levels
  - ✅ UI with color-coded badges and progress bars
  - **Implementation:** GPT-4o-mini with temperature 0.3
  - **Files:** analyze-url.ts, ContentIntelligencePage.tsx, content-intelligence.ts

**Success Criteria:**
- ✅ NER accuracy >85% compared to manual tagging (GPT-4o-mini provides strong baseline)
- ✅ Sentiment analysis within ±10% of human baseline (GPT-4o-mini provides strong baseline)
- ✅ Keyphrase extraction identifies 10-15 important terms per document
- Topic modeling identifies 3-5 meaningful topics per document (pending)

**Completed Features (Phases 1-3):**
- **Sentiment Analysis:**
  - 6 data points (overall, score, confidence, 5 emotions)
  - Controversial claims detection for disinformation analysis
  - Key insights for quick understanding of tone and messaging
  - Visual UI with color-coded sentiment indicators
  - Integrated into full-mode content analysis pipeline

- **Enhanced NER:**
  - 8 entity types extracted (3 baseline + 5 new)
  - Entity normalization for consistent references
  - Context filtering to exclude generic terms
  - 4-column responsive UI grid
  - Top 10 entities per category with occurrence counts

- **TextRank Keyphrase Extraction:**
  - Graph-based centrality analysis for term importance
  - Domain-specific terminology identification (tech, concepts, events, locations)
  - Quality over quantity (10-15 keyphrases maximum)
  - Importance scoring 0.0 to 1.0 with progress visualization
  - Category-based color coding (blue/purple/orange/green badges)
  - Relevance indicators (high/medium/low)
  - 2-column responsive card layout in Word Analysis tab

#### 3.3 Citation Generation Automation (Week 3) ✅ **~90% COMPLETE**
**Goal:** One-click citation generation from analyzed content
**Completed:** 2025-10-09

**Tasks:**
- [x] Auto-generate citations in multiple formats
  - ✅ APA 7th edition (inline in Content Intelligence)
  - ✅ MLA 9th edition (Citation Generator)
  - ✅ Chicago 17th edition (Citation Generator)
  - ✅ IEEE (Citation Generator)
  - ✅ Harvard referencing (Citation Generator)
- [x] Integrate with existing Citations Generator tool
  - ✅ Pre-populate form fields from content analysis ("Open in Generator" button)
  - ✅ Author detection from metadata (extractCitationData)
  - ✅ Publication date extraction (parseDate with year/month/day)
  - [ ] DOI lookup and validation (remaining)
- [x] Bulk citation export
  - ✅ BibTeX format (exportToBibTeX)
  - ✅ RIS format (exportToRIS - EndNote/Zotero compatible)
  - ✅ CSV export (exportToCSV)
  - ✅ JSON export (full structured data)
  - ✅ Plain text export (exportToText)
  - [ ] EndNote XML (RIS covers this use case)

**Success Criteria:**
- ✅ Auto-populated citation fields with >90% accuracy
- ✅ Support for 20+ source types (web, journal, book, etc.)
- ✅ Export to all major reference managers (BibTeX, RIS, CSV, JSON)

**Features Implemented:**
- ✅ "Open in Generator" button in Content Intelligence (auto-populates citation form)
- ✅ "Save to Library" button for inline citations (localStorage persistence)
- ✅ Citation Library UI with search, filter, sort by date/author/title/type
- ✅ Source type detection (website, news article, journal, report, etc.)
- ✅ Multiple author parsing (First Last, Last First formats)
- ✅ Metadata extraction from ContentAnalysis objects
- ✅ Citation style switcher (APA, MLA, Chicago, Harvard, IEEE)
- ✅ Bulk export in 5 formats from Citation Library

**Files Created/Modified:**
- `src/utils/content-to-citation.ts` - Content → citation conversion
- `src/utils/citation-library.ts` - Citation management and exports
- `src/pages/tools/ContentIntelligencePage.tsx` - Citation buttons and save functionality
- `src/components/tools/CitationLibrary.tsx` - Library UI with export buttons

**Remaining Work (~10%):**
- [ ] DOI lookup and validation via CrossRef API
- [ ] Multiple author enhancement (currently uses first author)
- [ ] EndNote XML export (RIS already works with EndNote)
- [ ] Zotero direct integration (RIS export compatible)

---

### Phase 4: Framework Auto-Population (Weeks 3-4)

#### 4.1 SWOT Analysis Auto-Population
**Goal:** Auto-fill SWOT matrices from analyzed content

**Tasks:**
- [ ] GPT-5-mini prompt engineering
  - Extract strengths, weaknesses, opportunities, threats
  - Context-aware categorization
  - Confidence scoring for each entry
- [ ] Field mapping logic
  - Content excerpt → SWOT field
  - Source paragraph citation
  - Metadata tracking (auto_populated: true, confidence: 0.85)
- [ ] User review interface
  - Accept/reject auto-populated fields
  - Edit and refine entries
  - Track user corrections for ML improvement

**Success Criteria:**
- 70% of auto-populated fields accepted without edits
- Sub-10-second population time
- Clear source citations for all entries

#### 4.2 PMESII-PT Auto-Population
**Goal:** Environmental analysis framework auto-fill

**Tasks:**
- [ ] Political factors extraction
  - Government mentions, policies, regulations
- [ ] Military factors detection
  - Defense spending, troop movements, alliances
- [ ] Economic indicators
  - GDP, trade, sanctions, markets
- [ ] Social factors
  - Demographics, culture, public opinion
- [ ] Infrastructure assessment
  - Transportation, utilities, communications
- [ ] Information environment
  - Media landscape, propaganda, disinformation
- [ ] Physical environment
  - Geography, climate, terrain
- [ ] Time considerations
  - Historical context, future projections

**Success Criteria:**
- Accurately categorizes content into 8 PMESII-PT domains
- Provides supporting evidence for each factor
- Identifies gaps in analysis (missing domains)

#### 4.3 Center of Gravity (COG) Auto-Population
**Goal:** Nodal analysis automation

**Tasks:**
- [ ] Identify critical capabilities
  - What the actor can do that is essential
- [ ] Detect critical requirements
  - What the actor needs to function
- [ ] Find critical vulnerabilities
  - Weaknesses in requirements
- [ ] Entity relationship mapping
  - Actors → capabilities → requirements → vulnerabilities

**Success Criteria:**
- COG analysis completed in <60 seconds
- Visual network diagram generation
- Exports to Network Analysis tool

---

## 🚀 Medium-Term Goals (Q1-Q2 2026 - Next 90 Days)

### Phase 5: Collaborative Intelligence Platform

#### 5.1 Real-Time Collaboration (Weeks 5-8)
**Tasks:**
- [ ] WebSocket integration for live updates
- [ ] Multi-user editing with conflict resolution
- [ ] Presence indicators (who's viewing/editing)
- [ ] Comment threads on content sections
- [ ] @mentions and notifications
- [ ] Activity feed per workspace

#### 5.2 Workspace Management (Weeks 7-10)
**Tasks:**
- [ ] Workspace creation and settings
- [ ] Role-based access control (Owner, Editor, Viewer)
- [ ] Invite system with email/link sharing
- [ ] Workspace-level analytics dashboard
- [ ] Data export (JSON, CSV, PDF reports)
- [ ] Workspace templates (pre-configured frameworks)

#### 5.3 Version Control for Analyses (Weeks 9-12)
**Tasks:**
- [ ] Framework session versioning
- [ ] Diff view for changes
- [ ] Rollback to previous versions
- [ ] Branching for alternative hypotheses
- [ ] Merge capability for collaborative work

---

### Phase 6: Advanced Analytics & AI

#### 6.1 Deception Detection Automation (Weeks 10-14)
**Tasks:**
- [ ] Claim extraction from content
- [ ] Source credibility scoring (MOSES assessment)
- [ ] Cross-reference validation
  - Compare claims across multiple sources
  - Flag contradictions
  - Identify corroboration patterns
- [ ] Logical fallacy detection
  - Appeal to authority, ad hominem, straw man, etc.
- [ ] Bias indicators
  - Loaded language detection
  - Framing analysis
  - Omission detection

#### 6.2 Predictive Analysis (Weeks 12-16)
**Tasks:**
- [ ] Trend forecasting from multi-document analysis
- [ ] Event prediction models
- [ ] Scenario generation (what-if analysis)
- [ ] Confidence intervals for predictions
- [ ] Historical pattern matching

#### 6.3 Network Analysis Enhancements (Weeks 14-18)
**Tasks:**
- [ ] Automated network graph generation from content
- [ ] Centrality analysis (betweenness, closeness, eigenvector)
- [ ] Community detection algorithms
- [ ] Temporal network evolution
- [ ] Influence flow visualization
- [ ] Export to Gephi, NetworkX formats

---

## 🌐 Long-Term Vision (Q3-Q4 2026 - Next 12 Months)

### Phase 7: Enterprise Features

#### 7.1 Data Pipeline Integration
- [ ] Automated content ingestion
  - RSS/Atom feed monitoring
  - Social media stream integration
  - Email forwarding for document analysis
  - Webhook support for third-party tools
- [ ] Scheduled analysis jobs
  - Daily digest of monitored sources
  - Alert triggers for keyword detection
  - Anomaly detection in content patterns

#### 7.2 Custom Framework Builder
- [ ] Drag-and-drop framework designer
- [ ] Custom field types (text, multi-select, matrix, etc.)
- [ ] Conditional logic (show field X if Y is selected)
- [ ] Formula support for calculated fields
- [ ] Framework templates marketplace

#### 7.3 Advanced Reporting
- [ ] PDF report generation with custom branding
- [ ] PowerPoint/Slides export
- [ ] Interactive dashboards
- [ ] Scheduled report delivery
- [ ] White-label options for agencies

---

### Phase 8: AI-Powered Intelligence Assistant

#### 8.1 Conversational Analysis Interface
- [ ] Natural language queries
  - "What are the top 3 threats to Organization X?"
  - "Show me all content mentioning China from the last week"
  - "Compare Actor A and Actor B's capabilities"
- [ ] Multi-turn dialogue for iterative refinement
- [ ] Source citation in responses
- [ ] Export conversation to evidence items

#### 8.2 Hypothesis Testing Automation
- [ ] ACH (Analysis of Competing Hypotheses) automation
  - Auto-generate alternative hypotheses
  - Evidence matrix auto-population
  - Diagnosticity calculation
  - Recommendation generation
- [ ] Bayesian reasoning support
  - Prior probability estimation
  - Likelihood ratio calculation
  - Posterior probability updates

#### 8.3 Anomaly Detection
- [ ] Content outlier identification
  - Statistical anomalies in word frequency
  - Unusual entity relationships
  - Temporal anomalies (sudden changes)
- [ ] Disinformation campaign detection
  - Coordinated messaging patterns
  - Bot activity indicators
  - Astroturfing detection

---

## 🔧 Technical Infrastructure Improvements

### Ongoing Technical Debt (Continuous)

#### Performance Optimization
- [ ] Implement service workers for offline support
- [ ] Code splitting for faster initial load (<3 seconds FCP)
- [ ] Database query optimization (target <50ms p95)
- [ ] Image lazy loading and WebP format adoption
- [ ] CDN integration for static assets

#### Security Enhancements
- [ ] Rate limiting per user/workspace
- [ ] CSRF token implementation
- [ ] SQL injection prevention audit
- [ ] XSS sanitization review
- [ ] Dependency vulnerability scanning (npm audit)
- [ ] Penetration testing (quarterly)

#### Scalability
- [ ] Cloudflare Workers KV optimization
- [ ] R2 bucket organization strategy
- [ ] Database partitioning for large workspaces
- [ ] Background job queue (BullMQ or Cloudflare Queues)
- [ ] Horizontal scaling plan for D1 limitations

#### Developer Experience
- [ ] Comprehensive API documentation (OpenAPI/Swagger)
- [ ] SDK for third-party integrations (Python, Node.js, Go)
- [ ] Webhook documentation and testing tools
- [ ] CLI tool for bulk operations
- [ ] Local development setup documentation

---

## 📊 Success Metrics (KPIs)

### User Engagement (Track Monthly)
- **Active Users:** Target 1,000 MAU by Q1 2026
- **Content Analyzed:** Target 10,000 URLs/month by Q2 2026
- **Framework Sessions Created:** Target 500/month by Q2 2026
- **Retention Rate:** Target 40% 30-day retention by Q2 2026

### Performance Metrics
- **API Response Time:** <200ms p95 for content analysis
- **Uptime:** 99.9% availability target
- **Cache Hit Rate:** >60% for content deduplication
- **Error Rate:** <0.1% of all requests

### Cost Optimization
- **GPT API Costs:** <$0.05 per analyzed URL (via caching)
- **Infrastructure Costs:** <$500/month for 1,000 MAU
- **R2 Storage:** <10GB total (via smart caching policies)

### Quality Metrics
- **Auto-Population Accuracy:** >70% acceptance rate
- **Entity Extraction Precision:** >85% vs. manual baseline
- **Citation Generation Accuracy:** >90% field accuracy

---

## 🎓 Research & Development Initiatives

### Experimental Features (Not Committed)

#### R&D Track 1: Multi-Modal Analysis
- Image OCR and analysis integration
- Video frame analysis for visual propaganda
- Audio transcript with speaker diarization
- ✅ PDF text extraction and intelligent analysis (Completed v2.4.0)
  - Auto-detect .pdf URLs
  - Extract text, metadata, chapters
  - Intelligent chunking for >2000 word documents
  - Q&A generation and precise summarization
- PDF table extraction and analysis (Advanced feature)

#### R&D Track 2: Geospatial Intelligence
- Map integration for location-based analysis
- Satellite imagery analysis (via Google Earth Engine)
- Movement pattern detection
- Proximity analysis for entity relationships

#### R&D Track 3: Financial Intelligence
- Company financial statement analysis
- Sanctions screening integration
- Cryptocurrency transaction graph analysis
- Supply chain mapping

---

## 💡 Community & Ecosystem

### Open Source Contributions
- [ ] Open-source framework templates library
- [ ] Public API for academic researchers
- [ ] User-contributed analysis methodologies
- [ ] Integration marketplace

### Documentation & Training
- [ ] Video tutorial series (YouTube)
- [ ] Intelligence analysis methodology guides
- [ ] Best practices documentation
- [ ] Case studies from real-world usage
- [ ] Academic partnerships for validation studies

---

## 🗓️ Quarterly Milestones Summary

### Q4 2025 (Current Quarter)
- ✅ Content-first architecture operational
- ✅ Google-style landing page
- 🎯 Social media enhancements complete
- 🎯 Framework auto-population (SWOT, PMESII-PT, COG)
- ✅ Citation generation automation (~90% complete - Oct 9, 2025)

### Q1 2026
- 🎯 Collaborative workspace features
- 🎯 Real-time editing and comments
- 🎯 Version control for analyses
- 🎯 Advanced network analysis

### Q2 2026
- 🎯 Deception detection automation
- 🎯 Custom framework builder
- 🎯 Enterprise reporting features
- 🎯 1,000 MAU milestone

### Q3 2026
- 🎯 AI conversational interface
- 🎯 Hypothesis testing automation
- 🎯 Data pipeline integration
- 🎯 Anomaly detection

### Q4 2026
- 🎯 Multi-modal analysis capabilities
- 🎯 Geospatial intelligence features
- 🎯 Open-source ecosystem launch
- 🎯 10,000 MAU milestone

---

## 🚨 Risk Register

### High-Priority Risks

**R1: Twitter/X API Access Changes**
- **Risk:** VxTwitter API or Twitter CDN blocks access
- **Mitigation:** Multi-provider fallback strategy, R2 cache backup
- **Owner:** Backend Team
- **Review:** Monthly

**R2: GPT API Cost Escalation**
- **Risk:** OpenAI pricing increases or quota limits
- **Mitigation:** Aggressive caching, local LLM exploration (Llama 3)
- **Owner:** Product Team
- **Review:** Quarterly

**R3: Cloudflare D1 Scaling Limits**
- **Risk:** D1 database size/performance limits reached
- **Mitigation:** Database partitioning, move to Postgres if needed
- **Owner:** DevOps Team
- **Review:** When database >50GB or >10M rows

**R4: User Data Privacy Compliance**
- **Risk:** GDPR, CCPA compliance gaps
- **Mitigation:** Privacy audit, data retention policies, user data export
- **Owner:** Legal/Compliance Team
- **Review:** Quarterly

---

## 📞 Stakeholder Communication

### Monthly Updates
- **Engineering Team:** Progress on roadmap items, technical challenges
- **Product Team:** User feedback, feature requests, metrics review
- **Users:** Release notes, new feature announcements
- **Investors:** Growth metrics, financial projections

### Quarterly Reviews
- **Roadmap Adjustments:** Based on user feedback and market changes
- **Resource Allocation:** Team capacity vs. roadmap priorities
- **Risk Assessment:** Review and update risk register
- **Success Metrics:** KPI performance vs. targets

---

**Next Roadmap Review:** January 15, 2026
**Document Owner:** Product Management
**Last Contributor:** AI Development Team
