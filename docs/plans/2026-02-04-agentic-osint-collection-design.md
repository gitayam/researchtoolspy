# Agentic OSINT Collection System Design

**Created:** 2026-02-04
**Status:** Approved for Implementation
**Author:** Brainstorming Session

---

## Overview

This document describes the design for integrating agentic AI agents into the ResearchTools platform to automate the intelligence cycle, starting with the **Collection** phase via an OSINT Collector agent backed by SearXNG metasearch.

### Goals

1. Automate source discovery using SearXNG on Cloudflare Containers
2. Use CrewAI agents for intelligent query expansion and relevance scoring
3. Maintain human-in-the-loop via triage UI before full analysis
4. Integrate seamlessly with existing Content Intelligence pipeline

### Intelligence Cycle Mapping

| Cycle Phase | Agent Role | Status |
|-------------|------------|--------|
| Planning & Direction | Requirements Manager | Future |
| **Collection** | **OSINT Collector** | **This Design** |
| Processing | Indexer Agent | Future |
| Analysis | Pattern Analyst | Future |
| Dissemination | Report Writer | Future |
| Feedback | Quality Reviewer | Future |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Research Question / Topic Input                                 │   │
│  │  "Investigate North Korean cryptocurrency operations 2023-2024" │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                      CLOUDFLARE WORKERS                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐   │
│  │ Collection       │    │ Job Queue        │    │ Results        │   │
│  │ Orchestrator     │───►│ (D1 + Durable   │───►│ Aggregator     │   │
│  │                  │    │  Objects)        │    │                │   │
│  └──────────────────┘    └──────────────────┘    └────────────────┘   │
│           │                                              │             │
├───────────┼──────────────────────────────────────────────┼─────────────┤
│           ▼           CLOUDFLARE CONTAINERS              ▼             │
│  ┌──────────────────┐                        ┌──────────────────┐     │
│  │ SearXNG          │                        │ CrewAI Agent     │     │
│  │ (Search Engine)  │◄──────────────────────►│ (OSINT Collector)│     │
│  │ 1GB RAM          │                        │ 2GB RAM          │     │
│  └──────────────────┘                        └──────────────────┘     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                      APPROVAL INTERFACE                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Source Triage View                                              │   │
│  │  ☑ [News] NK Crypto Heist - Reuters (Relevance: 94%)            │   │
│  │  ☑ [Academic] Blockchain Analysis Paper (Relevance: 87%)        │   │
│  │  ☐ [Social] Reddit speculation thread (Relevance: 34%)          │   │
│  │  [Analyze Selected] [Dismiss] [Save All Raw]                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Container Specifications

| Container | Image | RAM | vCPU | Port | Max Instances |
|-----------|-------|-----|------|------|---------------|
| SearXNG | searxng/searxng | 1GB | 1 | 8080 | 3 |
| OSINT Agent | custom/osint-agent | 2GB | 1 | 8000 | 5 |

---

## SearXNG Engine Categories

### News & Media
- Google News, Bing News, DuckDuckGo News
- Yahoo News, Qwant News, Brave News, Mojeek

### Academic & Research
- Google Scholar, Semantic Scholar, arXiv
- PubMed, CORE, BASE, Crossref, OpenAlex

### Social & OSINT
- Reddit, Hacker News, GitHub
- Stack Exchange, Lemmy, Mastodon, Lobste.rs

### Government & Legal
- PACER (courts), Congress.gov, regulations.gov
- FOIA libraries, State court records, Federal Register

### Corporate & Financial
- SEC EDGAR, OpenCorporates, Crunchbase
- LinkedIn (public), Bloomberg (public), Yahoo Finance

### Technical & Infrastructure
- Shodan, Censys, VirusTotal
- URLScan, WHOIS, DNS lookups

### Archives & Historical
- Wayback Machine, Archive.today
- Google Cache, Common Crawl

---

## OSINT Collector Agent Design

### Agent Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     OSINT COLLECTOR AGENT                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INPUT: "Investigate North Korean cryptocurrency operations 2023-2024" │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: QUERY EXPANSION (GPT-5)                                │   │
│  │                                                                  │   │
│  │  Base query → Derived search queries by category:               │   │
│  │                                                                  │   │
│  │  NEWS:     "Lazarus Group crypto theft 2024"                    │   │
│  │            "DPRK cryptocurrency sanctions"                       │   │
│  │                                                                  │   │
│  │  ACADEMIC: "state-sponsored cryptocurrency theft attribution"   │   │
│  │            "blockchain forensics North Korea"                   │   │
│  │                                                                  │   │
│  │  GOVERNMENT: "OFAC DPRK crypto sanctions"                       │   │
│  │              "UN Security Council North Korea report"           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: PARALLEL SEARCH EXECUTION                              │   │
│  │                                                                  │   │
│  │  SearXNG API calls (concurrent per category):                   │   │
│  │  Rate limiting: 2 req/sec to avoid engine blocks                │   │
│  │  Deduplication: URL-based with hash                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: RELEVANCE SCORING (GPT-5-mini)                         │   │
│  │                                                                  │   │
│  │  For each result, score 0-100 based on:                         │   │
│  │  ├─ Title/snippet match to research question (40%)              │   │
│  │  ├─ Source authority (domain reputation) (25%)                  │   │
│  │  ├─ Recency (time decay for dated content) (20%)                │   │
│  │  └─ Content type match (15%)                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  OUTPUT: 50-200 scored results ready for triage UI                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### LLM Selection Strategy

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Query expansion | `gpt-5` | Complex reasoning for decomposing research questions |
| Relevance scoring | `gpt-5-mini` | Good balance, high volume |
| Bulk processing | `gpt-5-nano` or Local | Cost-effective for mass operations |
| Synthesis/analysis | `gpt-5` | Deep reasoning for cross-source patterns |
| Fallback | `irregularbot:latest` | Local LLM when cost-sensitive or offline |

---

## Triage UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COLLECTION JOB: "North Korean cryptocurrency operations"               │
│  Status: ✓ Complete │ 147 sources found │ 12 duplicates removed        │
│  Time: 45 seconds │ Engines: 24 │ Categories: 6                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FILTER: [All ▼] [News ▼] [Academic ▼] [Gov ▼]  SORT: [Relevance ▼]   │
│  BULK: [Select All >70%] [Deselect All] [Invert]                       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ☑ 94% │ NEWS │ reuters.com                              2024-01-15    │
│  │      "Lazarus Group Linked to $600M Crypto Heist"                   │
│  │      North Korean hackers connected to Ronin bridge attack...       │
│  │      [Preview] [Wayback] [Similar]                                  │
│                                                                         │
│  ☑ 91% │ GOV │ treasury.gov                              2024-02-01    │
│  │      "OFAC Sanctions DPRK Crypto Wallets"                           │
│  │      Office of Foreign Assets Control designates 3 wallet...        │
│  │      [Preview] [Wayback] [Similar]                                  │
│                                                                         │
│  ... more results                                                       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  SELECTED: 23 sources │ Est. analysis cost: ~$0.12 │ Time: ~3 min      │
│                                                                         │
│  [▶ Analyze Selected]  [Save Raw to Library]  [Export URLs]            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Workflow Actions

| Action | What Happens |
|--------|--------------|
| **Analyze Selected** | Sends to batch processor → Content Intelligence → Entity extraction |
| **Save Raw to Library** | Stores URL + metadata in `saved_links` without full analysis |
| **Export URLs** | Download as CSV/JSON for external tools (Maltego, i2) |
| **Preview** | Quick iframe/modal view of source without leaving triage |
| **Similar** | Re-query SearXNG with this source's title for related content |

---

## Post-Triage Data Flow

```
USER CLICKS "Analyze Selected" (23 sources)
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: BATCH PROCESSOR (Existing)                            │
│  /api/tools/batch-process                                       │
│  • Parallel workers (1-5 concurrent)                            │
│  • Each URL → Content Intelligence analysis                     │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: CONTENT INTELLIGENCE (Existing)                       │
│  Extracts: entities, claims, sentiment, key phrases, citations  │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: ENTITY AGGREGATION (New Enhancement)                  │
│  Cross-source entity consolidation with confidence scoring      │
│  Relationship inference between entities                        │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4: STORAGE & LINKING                                     │
│  D1: saved_links, content_analysis, actors, relationships       │
└─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 5: FRAMEWORK SUGGESTIONS (New)                           │
│  Recommend: ACH, COG, PMESII-PT based on content type           │
│  One-click framework creation with pre-populated entities       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Container: SearXNG

**Dockerfile:**
```dockerfile
FROM searxng/searxng:latest
COPY settings.yml /etc/searxng/settings.yml
EXPOSE 8080
```

**settings.yml:** Configures 70+ engines across all categories with rate limiting.

### Container: OSINT Agent

**Dockerfile:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Dependencies:**
- crewai>=0.28.0
- langchain>=0.1.0
- langchain-openai>=0.0.5
- langchain-community>=0.0.20
- openai>=1.10.0
- fastapi>=0.109.0
- uvicorn>=0.27.0
- httpx>=0.26.0
- pydantic>=2.5.0

### Wrangler Configuration

```toml
[[containers]]
class_name = "SearXNGContainer"
image = "./containers/searxng"
max_instances = 3

[[containers]]
class_name = "OSINTAgentContainer"
image = "./containers/osint-agent"
max_instances = 5

[[durable_objects.bindings]]
name = "SEARXNG"
class_name = "SearXNGContainer"

[[durable_objects.bindings]]
name = "OSINT_AGENT"
class_name = "OSINTAgentContainer"
```

### Database Schema

```sql
-- migrations/056-collection-jobs.sql

CREATE TABLE collection_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  query TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, running, complete, error
  results_count INTEGER DEFAULT 0,
  batch_job_id TEXT,              -- Links to analysis batch job
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE collection_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  category TEXT,                  -- news, academic, government, etc.
  source_domain TEXT,
  relevance_score INTEGER,        -- 0-100
  published_date TEXT,
  engine TEXT,                    -- Which SearXNG engine found it
  approved BOOLEAN DEFAULT false,
  approved_at TEXT,
  FOREIGN KEY (job_id) REFERENCES collection_jobs(id)
);

CREATE INDEX idx_results_job ON collection_results(job_id);
CREATE INDEX idx_results_relevance ON collection_results(relevance_score DESC);
CREATE INDEX idx_results_category ON collection_results(category);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collection/start` | POST | Initiate collection job |
| `/api/collection/[jobId]/status` | GET | Poll job status |
| `/api/collection/[jobId]/results` | GET | Get paginated triage results |
| `/api/collection/[jobId]/approve` | POST | Approve selected sources for analysis |
| `/api/collection/callback` | POST | Receive results from container |

---

## File Structure

```
researchtoolspy/
├── containers/                          # NEW DIRECTORY
│   ├── searxng/
│   │   ├── Dockerfile
│   │   └── settings.yml
│   └── osint-agent/
│       ├── Dockerfile
│       ├── requirements.txt
│       └── main.py
├── functions/api/collection/            # NEW DIRECTORY
│   ├── start.ts
│   ├── callback.ts
│   └── [jobId]/
│       ├── status.ts
│       ├── results.ts
│       └── approve.ts
├── src/pages/tools/
│   └── CollectionPage.tsx               # NEW FILE
├── src/types/
│   └── collection.ts                    # NEW FILE
├── schema/migrations/
│   └── 056-collection-jobs.sql          # NEW FILE
└── wrangler.toml                        # MODIFIED (add containers)
```

---

## Implementation Phases

| Phase | Tasks | Effort |
|-------|-------|--------|
| **1. Infrastructure** | Set up Cloudflare Containers, deploy SearXNG, configure engines | 2-3 days |
| **2. OSINT Agent** | Build CrewAI container, test query expansion + scoring | 3-4 days |
| **3. Worker API** | Collection endpoints, job queue, callback handling | 2-3 days |
| **4. Frontend** | Collection page, triage UI, integration with Content Intelligence | 3-4 days |
| **5. Integration** | Connect to existing batch processor, entity extraction, frameworks | 2-3 days |

**Total Estimated Effort:** 12-17 days

---

## Environment Variables

```bash
# .env additions for researchtoolspy

# Cloudflare Containers
SEARXNG_CONTAINER_URL=http://searxng:8080
OSINT_AGENT_URL=http://osint-agent:8000

# LLM Configuration
OPENAI_API_KEY=...           # Already configured
LOCAL_AI_URL=...             # From existing Signal bot setup
LOCAL_AI_MODEL=irregularbot:latest
```

---

## Future Enhancements

After this Collection phase is complete, the next agents to implement:

1. **Requirements Manager** - Parse research questions into PIRs, recommend frameworks
2. **Indexer Agent** - Cross-source entity consolidation, relationship inference
3. **Pattern Analyst** - Framework auto-population, contradiction detection
4. **Report Writer** - Executive summary generation, briefing slides
5. **Quality Reviewer** - Fact-checking, gap detection, re-tasking loop

---

## References

- [Cloudflare Containers Public Beta](https://blog.cloudflare.com/containers-are-available-in-public-beta-for-simple-global-and-programmable/)
- [Cloudflare Containers Docs](https://developers.cloudflare.com/containers/)
- [SearXNG Documentation](https://docs.searxng.org/)
- [CrewAI Documentation](https://docs.crewai.com/)
- [SearXNG Docker Setup](https://github.com/searxng/searxng-docker)
