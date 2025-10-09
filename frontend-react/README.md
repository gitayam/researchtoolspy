# Research Tools Platform

A comprehensive intelligence analysis and research platform built with React, TypeScript, and Cloudflare Pages.

## Overview

This application provides military intelligence analysts and researchers with a suite of analytical tools and frameworks including:

- **Analysis Frameworks**:
  - COG Analysis with network visualization
  - ACH (Analysis of Competing Hypotheses) with inconsistency scoring
  - Behavior Change Wheel (COM-B Analysis)
  - Deception Detection (SATS framework)
  - Starbursting (5W1H question generation)
  - SWOT, PEST, PMESII-PT, DIME, DOTMLPF
  - Stakeholder Analysis, Causeway Analysis
  - Surveillance/ISR Planning, Fundamental Flow Analysis

- **Content Intelligence**:
  - URL analysis with AI-powered entity extraction
  - Automatic Q&A generation from content
  - Word cloud and phrase frequency analysis
  - Citation generation (APA, MLA, Chicago)
  - Social media extraction (Twitter, Instagram, TikTok)
  - PDF text extraction and analysis

- **Intelligence Management**:
  - Evidence collection and linking
  - Actor/entity relationship mapping
  - Source credibility tracking
  - Event timeline management
  - Investigation team collaboration

- **Network Analysis**:
  - Interactive network graph visualization
  - Auto-relationship generation from frameworks
  - Export to Gephi, Neo4j, Maltego, i2 ANB

- **Report Generation**:
  - Professional PDF exports with charts
  - PowerPoint presentations
  - Excel data exports
  - Framework-specific report templates

- **Multi-workspace Support**:
  - Isolated workspaces for different projects
  - Public/private framework sharing
  - Activity feed and notifications
  - Hash-based authentication for guest access

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Backend**: Cloudflare Pages Functions (Workers)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **AI Integration**: OpenAI GPT-4o-mini for analysis
- **i18n**: react-i18next for multi-language support

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

## Documentation

### Essential Docs
- **Lessons Learned**: `docs/LESSONS_LEARNED.md` - Critical bugs, fixes, and best practices
- **Cloudflare Lessons**: `docs/CLOUDFLARE_LESSONS_LEARNED.md` - Workers, Pages, D1 database tips
- **Roadmap**: `ROADMAP_2025.md` - Feature roadmap and future plans
- **Project Status**: `PROJECT_ROADMAP_STATUS.md` - Current development status

### Integration Guides
- `docs/GEPHI_IMPORT_GUIDE.md` - Export to Gephi for network visualization
- `docs/NEO4J_IMPORT_GUIDE.md` - Import data into Neo4j graph database
- `docs/MALTEGO_INTEGRATION_GUIDE.md` - Export to Maltego transforms
- `docs/I2ANB_INTEGRATION_GUIDE.md` - Export to IBM i2 Analyst's Notebook
- `docs/RSTUDIO_INTEGRATION_GUIDE.md` - R integration for statistical analysis

### Feature Documentation
- `docs/COLLABORATION_SYSTEM_DESIGN.md` - Collaboration features architecture
- `docs/INSTAGRAM_EXTRACTION.md` - Social media extraction implementation
- `docs/COG_IMPLEMENTATION_STATUS.md` - Center of Gravity analysis details
- `docs/ACCESSIBILITY.md` - Accessibility features and WCAG compliance

### Archive
Historical documentation has been organized into the `archive/` directory:
- `archive/planning/` - Feature planning documents and roadmaps
- `archive/implementations/` - Completed implementation summaries
- `archive/status-updates/` - Historical status reports and progress updates
- `archive/working-docs-2025/` - Working documents from 2025 development sessions

## Environment Variables

See `.dev.vars.example` for required environment variables:
- `OPENAI_API_KEY` - OpenAI API key for GPT features
- `VIRUSTOTAL_API_KEY` - Optional, for security lookups

## Database

Database schema and migrations are in `schema/migrations/`. The application uses Cloudflare D1 for edge database functionality.

## Deployment

The application is deployed to Cloudflare Pages with automatic deployments on push to main branch.

```bash
# Deploy to production
npm run build
npx wrangler pages deploy dist

# Watch deployment logs
npx wrangler pages deployment tail --project-name=researchtoolspy
```

## License

Proprietary - All Rights Reserved
