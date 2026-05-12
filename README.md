# ResearchToolsPy

Intelligence analysis and research platform built on Cloudflare Pages.
Live at [researchtools.net](https://researchtools.net).

Provides analysts a workspace for structured analytic techniques (ACH, COG, COM-B,
Starbursting, SWOT, PEST, PMESII-PT, DIME, DOTMLPF, Stakeholder, Causeway,
Deception/SATS), content intelligence (URL/PDF/social-media extraction with AI
entity extraction), evidence and entity management, network analysis with exports
to Gephi/Neo4j/Maltego/i2 ANB, and a Common Operating Picture (COP) workspace
for multi-source incident analysis.

## Stack

- **Frontend** — React 19 · TypeScript 6 · Vite 7 · Tailwind 4 · shadcn/ui (Radix)
- **Backend** — Cloudflare Pages Functions (Workers runtime)
- **Database** — Cloudflare D1 (SQLite at the edge)
- **Storage** — Cloudflare R2 (images, exports)
- **AI** — OpenAI (gpt-5.4-mini default) via AI Gateway
- **i18n** — `react-i18next` (English, Spanish)
- **Tests** — Playwright (E2E)

## Quick start

```bash
npm install

# Dev runs two processes — wrangler proxies API on :8788, vite serves UI on :5173
npm run dev:wrangler     # terminal 1 — Pages Functions
npm run dev:vite         # terminal 2 — frontend (proxies /api to 8788)

# Verify
npm run type-check
npm run lint
npm run test:e2e:smoke
```

> The combined `npm run dev` script uses `&` and is unreliable on wrangler 4.40+.
> Use the two-process form above.

## Project layout

```
.
├── src/                  React app
│   ├── components/       UI components (grouped by domain: ach, cop, frameworks, ...)
│   ├── pages/            Route components
│   ├── lib/              Client-side libraries (ai, api, exports, reports)
│   ├── hooks/            React hooks
│   ├── stores/           Zustand stores
│   └── locales/          en, es translations
├── functions/            Cloudflare Pages Functions (server)
│   └── api/              REST endpoints grouped by domain
├── schema/               D1 schema + migrations
├── public/               Static assets, _headers, _redirects, _routes.json
├── containers/           Containerized services (osint-agent, searxng)
├── scripts/              Shell utilities (cop-api.sh, pre-deployment-check.sh)
├── tests/                Playwright E2E
└── docs/                 Documentation (see below)
```

## Deploy

```bash
./deploy.sh                  # migrate + build + deploy (recommended)
./deploy.sh --dry-run        # build + verify, no deploy
./deploy.sh --skip-migrate   # build + deploy, no D1 migrations

# Watch logs
npx wrangler pages deployment tail --project-name=researchtoolspy
```

The deploy script handles a subtle gotcha: Cloudflare Pages bundles `functions/`
relative to the deploy directory, so the script copies `functions/` into `dist/`
before `wrangler pages deploy dist/`. Do **not** deploy from repo root.

## Environment

Local: `.env` (gitignored). See `.env.example` if added.

Production secrets are stored as Cloudflare environment variables and bindings
in `wrangler.toml`:
- `OPENAI_API_KEY` (secret) — required for AI features
- D1 binding `DB` → `researchtoolspy-prod`
- R2 binding `R2_BUCKET` → image storage
- AI Gateway endpoint for cached/observable OpenAI calls

## Documentation

| Area | Path |
|---|---|
| API reference | [`docs/api/`](docs/api/) |
| Framework guides | [`docs/frameworks/`](docs/frameworks/) — ACH, COM-B / behavior, framework auto-population |
| Integrations | [`docs/integrations/`](docs/integrations/) — Gephi, Neo4j, Maltego, i2 ANB, R, social-media extraction |
| Operations | [`docs/operations/`](docs/operations/) — D1 migrations, accessibility, Cloudflare/general lessons learned, changelog |
| Implementation plans | [`docs/plans/`](docs/plans/) — phase plans, design docs |
| Upgrades | [`docs/upgrades/`](docs/upgrades/) — dependency upgrade reports |
| Cypher queries | [`docs/neo4j-queries/`](docs/neo4j-queries/) |
| R scripts | [`docs/r-scripts/`](docs/r-scripts/) |

For Claude Code workflows, see [`CLAUDE.md`](CLAUDE.md) — covers the `cop-api.sh`
shell helpers (`cop_sessions`, `cop_add_rfi`, `cop_add_evidence`, etc.) and the
key API conventions.

## Database

D1 (SQLite). Schema lives in [`schema/d1-schema.sql`](schema/d1-schema.sql) with
incremental changes in [`schema/migrations/`](schema/migrations/).

```bash
# Apply migrations remotely
npm run migrate:prod

# Ad-hoc query (remote)
npx wrangler d1 execute researchtoolspy-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Conventions:
- Tables and columns are `lowercase_snake_case` (PascalCase causes silent FK
  failures in D1).
- Entity types (`actors.type`, `places.type`, ...) must be **uppercase** — D1
  CHECK constraints enforce this.
- Entity tables (`actors`, `sources`, `events`, `places`, `behaviors`,
  `evidence_items`, relationships) use `created_by` and `workspace_id`.
- Framework tables (`framework_sessions`, `mom_assessments`) use `user_id`.

## Contributing

- **Commits** — conventional commits (`feat(scope):`, `fix(scope):`,
  `chore(scope):`, ...).
- **Branches** — short-lived, named for the work (`fix/cop-share-auth`).
- **Before pushing** — `npm run type-check && npm run lint && npm run test:e2e:smoke`.
- **PRs** — Renovate handles dependency updates; security CVEs block CI via
  `audit-ci` (high/critical).

## License

Proprietary — All rights reserved.
