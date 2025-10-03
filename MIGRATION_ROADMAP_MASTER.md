# ResearchToolspy Cloudflare React Migration - Master Roadmap

**Project:** ResearchToolspy Next.js → React + Vite + Cloudflare Pages Migration
**Branch:** `cloudflare/react-nextjs-to-vite`
**Current Status:** ~25% Complete (Phase 1 Infrastructure Done)
**Target Completion:** 4-6 weeks
**Last Updated:** October 3, 2025

---

## 🎯 Executive Summary

### Current State
- **Frontend:** Next.js 15.4.6 with App Router, 139 TypeScript/TSX files
- **Backend:** FastAPI (Python) with SQLite database
- **Features:** 16 analysis frameworks, 7 research tools, hash-based auth
- **Migration Progress:** Infrastructure complete, shell pages created, core functionality pending

### Target State
- **Frontend:** React 19 + Vite + React Router on Cloudflare Pages
- **Backend:** Cloudflare Workers + D1 Database (optional: proxy to FastAPI)
- **Features:** All 16 frameworks, 7 tools, authentication, exports preserved
- **Deployment:** Cloudflare Pages with CI/CD

### Key Migrations Needed
1. **16 Analysis Frameworks** - SWOT, ACH, COG, PMESII-PT, DOTMLPF, Deception, etc.
2. **7 Research Tools** - URL processing, web scraping, citations, batch processing, etc.
3. **Export Functions** - PDF, Word, PowerPoint, Excel generation
4. **Authentication** - Hash-based bookmark system
5. **API Layer** - FastAPI → Cloudflare Workers/Functions
6. **Database** - SQLite → Cloudflare D1 (optional)

---

## 📋 Phase Overview

### Phase 1: Infrastructure & Setup ✅ **COMPLETE**
- [x] Vite + React + TypeScript project created
- [x] Tailwind CSS configured
- [x] React Router with 27 routes
- [x] Layout and navigation components
- [x] Radix UI component library
- [x] TanStack Query setup
- [x] Basic Cloudflare Pages Functions (health, evidence, frameworks)
- [x] D1 database schema
- [x] Wrangler configuration
- [x] Shell pages for all frameworks and tools

### Phase 2: Core Framework CRUD 🚧 **IN PROGRESS** (25%)
- [ ] SWOT Analysis (Priority 1)
- [ ] Basic framework form system
- [ ] Database persistence
- [ ] Framework list/view/edit/delete
- [ ] 5 simple frameworks migrated

**See:** [PHASE_2_FRAMEWORK_CRUD.md](./migration-plans/PHASE_2_FRAMEWORK_CRUD.md)

### Phase 3: Complex Frameworks ⏳ **PENDING**
- [ ] ACH Dashboard (Analysis of Competing Hypotheses)
- [ ] Deception Detection Framework
- [ ] COG (Center of Gravity) with Mermaid diagrams
- [ ] Causeway Analysis
- [ ] PMESII-PT with complex nested data
- [ ] 11 remaining frameworks

**See:** [PHASE_3_COMPLEX_FRAMEWORKS.md](./migration-plans/PHASE_3_COMPLEX_FRAMEWORKS.md)

### Phase 4: Research Tools ⏳ **PENDING**
- [ ] URL Processing Tool
- [ ] Web Scraping Tool
- [ ] Citations Generator
- [ ] Document Processing (CSV, Excel, PDF)
- [ ] Social Media Analysis
- [ ] Batch Processing
- [ ] Content Extraction

**See:** [PHASE_4_RESEARCH_TOOLS.md](./migration-plans/PHASE_4_RESEARCH_TOOLS.md)

### Phase 5: Export & Advanced Features ⏳ **PENDING**
- [ ] PDF Export (jsPDF)
- [ ] Word Export (docx)
- [ ] PowerPoint Export (pptxgenjs)
- [ ] Excel Export (exceljs)
- [ ] Auto-save functionality
- [ ] Collaboration features
- [ ] Evidence linking system

**See:** [PHASE_5_EXPORTS_AND_FEATURES.md](./migration-plans/PHASE_5_EXPORTS_AND_FEATURES.md)

### Phase 6: API Migration ⏳ **PENDING**
- [ ] Cloudflare Workers for compute-heavy operations
- [ ] FastAPI proxy functions
- [ ] D1 database migration (optional)
- [ ] R2 for file uploads
- [ ] KV for caching
- [ ] OpenAI API integration

**See:** [PHASE_6_API_MIGRATION.md](./migration-plans/PHASE_6_API_MIGRATION.md)

### Phase 7: Testing & Deployment ⏳ **PENDING**
- [ ] Unit tests for components
- [ ] Integration tests for API functions
- [ ] E2E tests for critical workflows
- [ ] Performance optimization
- [ ] Bundle size optimization
- [ ] Production deployment
- [ ] CI/CD pipeline
- [ ] Monitoring and analytics

**See:** [PHASE_7_TESTING_DEPLOYMENT.md](./migration-plans/PHASE_7_TESTING_DEPLOYMENT.md)

---

## 📊 Detailed Progress Tracking

### Analysis Frameworks (16 total)

| Framework | Status | Complexity | Priority | ETA |
|-----------|--------|------------|----------|-----|
| SWOT Analysis | 🟡 List Page Only | Low | P0 | Week 1 |
| ACH Dashboard | 🔴 Not Started | High | P1 | Week 2-3 |
| Behavior Analysis | 🔴 Not Started | Medium | P1 | Week 2 |
| Causeway | 🔴 Not Started | High | P2 | Week 3 |
| COG (Center of Gravity) | 🔴 Not Started | High | P1 | Week 2-3 |
| Deception Detection | 🔴 Not Started | Very High | P1 | Week 3-4 |
| DIME | 🔴 Not Started | Medium | P2 | Week 2 |
| DOTMLPF | 🔴 Not Started | Medium | P2 | Week 2 |
| Fundamental Flow | 🔴 Not Started | Medium | P2 | Week 3 |
| PEST | 🔴 Not Started | Low | P2 | Week 2 |
| PMESII-PT | 🔴 Not Started | High | P1 | Week 2-3 |
| Stakeholder Analysis | 🔴 Not Started | Medium | P2 | Week 3 |
| Starbursting | 🔴 Not Started | Low | P2 | Week 2 |
| Surveillance | 🔴 Not Started | Medium | P3 | Week 3 |
| Trend Analysis | 🔴 Not Started | Medium | P2 | Week 3 |
| VRIO | 🔴 Not Started | Low | P2 | Week 2 |

**Legend:**
🔴 Not Started | 🟡 In Progress | 🟢 Complete | P0-P3 Priority | Complexity: Low/Medium/High/Very High

### Research Tools (7 total)

| Tool | Status | Complexity | Priority | ETA |
|------|--------|------------|----------|-----|
| URL Processing | 🔴 Not Started | Medium | P1 | Week 4 |
| Web Scraping | 🔴 Not Started | High | P1 | Week 4 |
| Citations Generator | 🔴 Not Started | Medium | P1 | Week 4 |
| Document Processing | 🔴 Not Started | High | P2 | Week 4 |
| Social Media Analysis | 🔴 Not Started | Medium | P2 | Week 5 |
| Batch Processing | 🔴 Not Started | High | P1 | Week 5 |
| Content Extraction | 🔴 Not Started | Medium | P2 | Week 5 |

### Export Functions (4 total)

| Export Type | Status | Complexity | Priority | ETA |
|-------------|--------|------------|----------|-----|
| PDF (jsPDF) | 🔴 Not Started | Medium | P1 | Week 5 |
| Word (docx) | 🔴 Not Started | Medium | P1 | Week 5 |
| PowerPoint (pptxgenjs) | 🔴 Not Started | Medium | P2 | Week 5 |
| Excel (exceljs) | 🔴 Not Started | Low | P2 | Week 5 |

---

## 🗂️ Detailed Migration Plans

Each phase has a dedicated detailed plan document:

### Phase 2: Framework CRUD Operations
**File:** `migration-plans/PHASE_2_FRAMEWORK_CRUD.md`
**Focus:** Build CRUD operations for simple frameworks first (SWOT, PEST, DIME, etc.)
**Duration:** 1-2 weeks
**Deliverables:**
- Generic framework form component
- SWOT fully functional
- 5 simple frameworks operational
- D1 database integration working

### Phase 3: Complex Frameworks
**File:** `migration-plans/PHASE_3_COMPLEX_FRAMEWORKS.md`
**Focus:** Migrate complex frameworks with visualizations and nested data
**Duration:** 2-3 weeks
**Deliverables:**
- ACH Dashboard with hypothesis matrix
- Deception Detection with indicator tracking
- COG with Mermaid diagrams
- PMESII-PT with nested factors
- Causeway with complex relationships

### Phase 4: Research Tools
**File:** `migration-plans/PHASE_4_RESEARCH_TOOLS.md`
**Focus:** Migrate all 7 research tools
**Duration:** 1-2 weeks
**Deliverables:**
- URL processing with metadata extraction
- Web scraper with configurable selectors
- Citations generator with multiple formats
- Document parsing (CSV, Excel, PDF)
- Batch processing for multiple sources

### Phase 5: Exports & Advanced Features
**File:** `migration-plans/PHASE_5_EXPORTS_AND_FEATURES.md`
**Focus:** Export functions, auto-save, collaboration
**Duration:** 1 week
**Deliverables:**
- PDF export for all frameworks
- Word/PowerPoint exports
- Excel data exports
- Auto-save with debouncing
- Collaboration and sharing features

### Phase 6: API Migration
**File:** `migration-plans/PHASE_6_API_MIGRATION.md`
**Focus:** Backend migration to Cloudflare infrastructure
**Duration:** 1-2 weeks
**Deliverables:**
- Cloudflare Workers for AI operations
- D1 database fully migrated
- R2 for file storage
- KV for session/cache
- OpenAI API integration

### Phase 7: Testing & Deployment
**File:** `migration-plans/PHASE_7_TESTING_DEPLOYMENT.md`
**Focus:** Testing, optimization, production deployment
**Duration:** 1 week
**Deliverables:**
- Unit tests (80%+ coverage)
- E2E tests for critical flows
- Performance optimization
- Production deployment
- CI/CD pipeline

---

## 🔧 Technical Architecture

### Frontend Stack
```
React 19.1.1
├── Vite 6.x (Build tool)
├── TypeScript 5.x
├── React Router 7.9.3 (Navigation)
├── TanStack Query 5.90.2 (Data fetching)
├── Zustand 5.0.8 (State management)
├── Radix UI (Component library)
├── Tailwind CSS 4.1.13 (Styling)
├── React Hook Form 7.63.0 (Forms)
├── Zod 4.1.11 (Validation)
├── Lucide React (Icons)
└── Export Libraries
    ├── jsPDF 3.0.3 (PDF)
    ├── docx 9.5.1 (Word)
    ├── pptxgenjs 4.0.1 (PowerPoint)
    └── exceljs 4.4.0 (Excel)
```

### Backend Stack Options

#### Option A: Cloudflare-Native (Recommended Long-term)
```
Cloudflare Platform
├── Pages (Static hosting + Functions)
├── Workers (Serverless compute)
├── D1 (SQL database)
├── R2 (Object storage)
├── KV (Key-value store)
└── OpenAI API (AI operations)
```

#### Option B: Hybrid (Faster Migration)
```
Hybrid Architecture
├── Cloudflare Pages (Frontend + simple functions)
├── Cloudflare Workers (Proxy to FastAPI)
└── FastAPI Backend (Keep existing)
    ├── SQLite/PostgreSQL
    ├── File uploads
    └── AI operations
```

### Database Schema (D1)

```sql
-- Users (hash-based auth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Framework sessions
CREATE TABLE frameworks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  framework_type TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Evidence items
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  url TEXT,
  tags TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Citations
CREATE TABLE citations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  evidence_id TEXT,
  citation_text TEXT NOT NULL,
  format TEXT, -- APA, MLA, Chicago
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(id)
);
```

---

## 📁 Project Structure

```
researchtoolspy/
├── frontend-react/              # React migration (current work)
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Radix UI components
│   │   │   ├── frameworks/    # Framework-specific components
│   │   │   ├── tools/         # Tool-specific components
│   │   │   └── shared/        # Shared components
│   │   ├── pages/             # Page components (routes)
│   │   │   ├── frameworks/   # Framework pages
│   │   │   ├── tools/        # Tool pages
│   │   │   └── auth/         # Auth pages
│   │   ├── lib/              # Utilities and helpers
│   │   │   ├── api.ts        # API client
│   │   │   ├── exports/      # Export functions
│   │   │   └── utils.ts      # General utilities
│   │   ├── stores/           # Zustand stores
│   │   ├── types/            # TypeScript types
│   │   ├── hooks/            # Custom React hooks
│   │   ├── routes/           # Route configuration
│   │   └── services/         # Business logic
│   ├── functions/            # Cloudflare Pages Functions
│   │   └── api/
│   │       ├── [[path]].ts   # SPA routing handler
│   │       ├── health.ts     # Health check
│   │       ├── frameworks.ts # Framework CRUD
│   │       └── evidence.ts   # Evidence CRUD
│   ├── public/               # Static assets
│   ├── dist/                 # Build output
│   └── wrangler.toml         # Cloudflare configuration
│
├── frontend/                   # Original Next.js (reference)
│   └── src/
│       └── app/               # Next.js App Router
│
├── api/                       # FastAPI backend (optional keep)
│   └── app/
│       ├── api/v1/endpoints/  # API endpoints
│       ├── core/              # Core config
│       ├── models/            # Database models
│       └── services/          # Business logic
│
└── migration-plans/           # Detailed migration plans
    ├── PHASE_2_FRAMEWORK_CRUD.md
    ├── PHASE_3_COMPLEX_FRAMEWORKS.md
    ├── PHASE_4_RESEARCH_TOOLS.md
    ├── PHASE_5_EXPORTS_AND_FEATURES.md
    ├── PHASE_6_API_MIGRATION.md
    └── PHASE_7_TESTING_DEPLOYMENT.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Wrangler CLI (`npm install -g wrangler`)
- Git

### Local Development

```bash
# 1. Navigate to React project
cd /Users/sac/Git/researchtoolspy/frontend-react

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# Access at http://localhost:5173

# 4. Test Cloudflare Pages locally
npm run wrangler:dev
# Access at http://localhost:8788
```

### Working with Database (D1)

```bash
# Create D1 database
npx wrangler d1 create researchtoolspy-db

# Run migrations
npx wrangler d1 execute researchtoolspy-db --file=./schema.sql

# Query database
npx wrangler d1 execute researchtoolspy-db --command="SELECT * FROM frameworks"
```

### Deployment

```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run wrangler:deploy

# Or use Wrangler directly
npx wrangler pages deploy dist --project-name=researchtoolspy
```

---

## 📈 Success Metrics

### Must-Have (Blocking for Production)
- [x] All infrastructure working
- [ ] All 16 frameworks functional
- [ ] All 7 research tools operational
- [ ] Authentication working
- [ ] Export functions generating files
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Production deployment successful

### Nice-to-Have (Post-Launch)
- [ ] PWA features (offline mode)
- [ ] Performance score 90+
- [ ] CI/CD pipeline
- [ ] D1 database fully migrated
- [ ] All Cloudflare features utilized (Workers, KV, R2)
- [ ] Unit test coverage 80%+
- [ ] E2E tests for critical flows

---

## ⏱️ Timeline Estimate

| Phase | Duration | Dependencies | Team Size |
|-------|----------|--------------|-----------|
| Phase 1: Infrastructure | ✅ Complete | - | 1 dev |
| Phase 2: Framework CRUD | 1-2 weeks | Phase 1 | 1-2 devs |
| Phase 3: Complex Frameworks | 2-3 weeks | Phase 2 | 1-2 devs |
| Phase 4: Research Tools | 1-2 weeks | Phase 2 | 1-2 devs |
| Phase 5: Exports & Features | 1 week | Phases 2-4 | 1 dev |
| Phase 6: API Migration | 1-2 weeks | Phases 2-4 | 1 dev |
| Phase 7: Testing & Deployment | 1 week | All phases | 1-2 devs |

**Total Estimated Time:** 4-6 weeks (single developer, full-time)

---

## 🔗 Quick Links

### Documentation
- [Original Migration Plan](./CLOUDFLARE_REACT_MIGRATION_PLAN.md)
- [Current Status Document](./frontend-react/CURRENT_STATUS_AND_ROADMAP.md)
- [Cloudflare Development Guide](./frontend-react/Cloudflare_React_Development_Guide.md)

### External Resources
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [React Router v7 Docs](https://reactrouter.com/en/main)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Vite Docs](https://vite.dev/)

---

## 📝 Notes & Considerations

1. **No Framer Motion:** Per Cloudflare guide, use CSS animations instead
2. **Environment Variables:** Must start with `VITE_` for frontend access
3. **API Strategy:** Start with Cloudflare Functions, migrate compute-heavy to Workers
4. **Testing:** Test after each phase, commit frequently
5. **Error Handling:** Implement proper error boundaries
6. **Accessibility:** Maintain ARIA labels and keyboard navigation
7. **Performance:** Code splitting, lazy loading, bundle optimization

---

**Document Version:** 1.0
**Last Updated:** October 3, 2025
**Maintainer:** Development Team
**Status:** Living Document - Update as migration progresses
