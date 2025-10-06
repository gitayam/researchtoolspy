# Research Tools Platform

A comprehensive intelligence analysis and research platform built with React, TypeScript, and Cloudflare Pages.

## Overview

This application provides military intelligence analysts and researchers with a suite of analytical tools and frameworks including:

- **Analysis Frameworks**: COG Analysis, ACH, BCW, Deception Detection, Starbursting
- **Content Intelligence**: URL analysis, entity extraction, Q&A system, citation generation
- **Intelligence Management**: Evidence tracking, actor/entity management, investigation teams
- **Report Generation**: PDF, PowerPoint, Excel exports with professional formatting
- **Multi-language Support**: English and Spanish interfaces

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

- **Development Guide**: `Cloudflare_React_Development_Guide.md` - Best practices for Cloudflare Workers development
- **Lessons Learned**: `lessonslearned-gpt-cloudflare-workers.md` - GPT + Cloudflare Workers integration notes
- **Implementation Status**: `docs/COG_IMPLEMENTATION_STATUS.md` - Current roadmap and feature status
- **Archive**: `archive/` - Historical planning documents, implementation summaries, and old status updates

## Archive Structure

Historical documentation has been organized into the `archive/` directory:

- `archive/planning/` - Feature planning documents and roadmaps
- `archive/implementations/` - Completed implementation summaries
- `archive/status-updates/` - Historical status reports and progress updates

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
