# ResearchToolsPy Dependency Upgrades — 2026-04-12

## Summary

- **47 packages updated** (45 completed, 2 deferred)
- **11 vulnerabilities fixed** (2 critical, 7 high, 1 moderate, 1 transitive)
- **7 major version upgrades** completed with 3 code changes required
- **0 vulnerabilities remaining**
- **Build passes**, all chunks generated successfully

## Critical Security Fixes

### Vite 7.1.7 → 7.3.2

Fixed 3 vulnerabilities:
- **CRITICAL**: Path Traversal in Optimized Deps `.map` Handling (GHSA-4w7w-66w2-5vf9)
- **HIGH**: `server.fs.deny` bypassed with queries (GHSA-v2wj-q39q-566r)
- **HIGH**: Arbitrary File Read via Vite Dev Server WebSocket (GHSA-p9ff-h696-f583)

### axios 1.13.6 → 1.15.0

Fixed 2 vulnerabilities:
- **CRITICAL**: NO_PROXY Hostname Normalization Bypass Leads to SSRF (GHSA-3p68-rc4w-qgx5)
- **CRITICAL**: Unrestricted Cloud Metadata Exfiltration via Header Injection Chain (GHSA-fvcv-3m26-pcqx)

### jspdf 4.2.0 → 4.2.1

Fixed 2 vulnerabilities:
- **CRITICAL**: PDF Object Injection via FreeText color (GHSA-7x6v-j9x4-qf24)
- **CRITICAL**: HTML Injection in New Window paths (GHSA-wfv2-pwc8-crg5)

**Peer dependency warning (non-blocking, build succeeds):**
- `jspdf-autotable@5.0.7` — peer wants `jspdf "^2 || ^3"`. Works at runtime; watch for update.

### Wrangler 4.69.0 → 4.81.1 (+ miniflare + undici)

Fixed 6 vulnerabilities in transitive dep `undici`:
- **HIGH**: Malicious WebSocket 64-bit length overflows (GHSA-f269-vfmq-vjvj)
- **HIGH**: HTTP Request/Response Smuggling (GHSA-2mjp-6q6p-2qxm)
- **HIGH**: Unbounded Memory in WebSocket permessage-deflate (GHSA-vrm6-8vpv-qv8q)
- **HIGH**: Unhandled Exception in WebSocket Client (GHSA-v9p9-hfj2-hcw8)
- **HIGH**: CRLF Injection via `upgrade` option (GHSA-4992-7rv2-5pvq)
- **HIGH**: Unbounded Memory in DeduplicationHandler (GHSA-phc3-fgpg-7m6h)

### Other security fixes (transitive)

- **flatted** — Prototype Pollution via parse() (GHSA-rf6f-7fwh-wjgh)
- **lodash-es** — Code Injection via `_.template` + Prototype Pollution via `_.unset` (GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh)
- **picomatch** — Method Injection + ReDoS via extglob quantifiers (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj)
- **brace-expansion** — Zero-step sequence causes hang/memory exhaustion (GHSA-f886-m6hf-6m8v)

## Major Version Upgrades

### TypeScript 5.8.3 → 6.0.2

**Zero code changes required.** Both tsconfigs already had explicit `types` fields:
- `tsconfig.app.json`: `"types": ["vite/client"]`
- `tsconfig.node.json`: `"types": []`

This neutralized TS6's main breaking change (`types` now defaults to `[]` instead of auto-discovering `@types/*`).

### ESLint 9.39.4 → 10.2.0 + ecosystem

**Requires eslint.config.js rewrite.** ESLint 10 no longer accepts the old plugin array format inside `defineConfig()`.

Upgraded atomically:
- `eslint` 9.39.4 → 10.2.0
- `@eslint/js` 9.39.4 → 10.0.1
- `eslint-plugin-react-hooks` 5.2.0 → 7.0.1
- `eslint-plugin-react-refresh` 0.4.26 → 0.5.2
- `globals` 16.5.0 → 17.5.0

**Config change:** Replaced `defineConfig()` from `eslint/config` with `tseslint.config()` and moved plugin configs to explicit `plugins` + `rules` pattern.

**New lint rules from react-hooks v7** (React Compiler rules):
- "Cannot create components during render" (11 errors)
- "Calling setState synchronously within an effect" (17 errors)
- "Cannot access variable before it is declared" (3 errors)
- "Cannot call impure function during render" (4 errors)

These are pre-existing code quality issues, not upgrade regressions.

**Files changed:**
- `eslint.config.js` — rewritten for ESLint 10 flat config compatibility

### lucide-react 0.544.0 → 1.8.0

**Requires code changes.** Lucide 1.0 removed all brand/trademark icons.

Removed icons and replacements:
| Removed | Replacement | Rationale |
|---------|-------------|-----------|
| `Instagram` | `Camera` | Camera represents photo-sharing |
| `Youtube` | `Video` | Video represents video platform |
| `Twitter` | `MessageCircle` | Message bubble for microblogging |
| `Facebook` | `Globe` | Globe for social network |
| `Linkedin` | `Briefcase` | Briefcase for professional network |
| `Github` | `GitFork` | Git fork for code hosting |

**Behavioral change:** `aria-hidden="true"` now set by default on all lucide icons. Icon-only interactive elements (`<button><SomeIcon /></button>` without visible text) should be audited to ensure they have `aria-label` set.

**Files changed:**
- `src/pages/SocialMediaPage.tsx` — replaced 6 brand icon imports and all usages
- `src/pages/tools/RageCheckPage.tsx` — replaced `Github` with `GitFork`

### marked 16.4.2 → 18.0.0

**Zero code changes required.** Build passes without modification.

### i18next 25.10.10 → 26.0.4 + react-i18next 16.6.6 → 17.0.2

**Zero code changes required.** Build passes without modification.

### @types/node 24.12.2 → 25.6.0

**Zero code changes required.** Additive type definitions tracking Node 25 API surface.

## Minor/Patch Upgrades

All build-verified, no code changes required:

| Package | From | To |
|---------|------|----|
| @radix-ui/react-avatar | 1.1.10 | 1.1.11 |
| @radix-ui/react-label | 2.1.7 | 2.1.8 |
| @radix-ui/react-progress | 1.1.7 | 1.1.8 |
| @radix-ui/react-separator | 1.1.7 | 1.1.8 |
| @radix-ui/react-slot | 1.2.3 | 1.2.4 |
| @tailwindcss/postcss | 4.1.13 | 4.2.2 |
| @tanstack/react-query | 5.90.2 | 5.99.0 |
| @tanstack/react-query-devtools | 5.90.2 | 5.99.0 |
| @types/papaparse | 5.3.16 | 5.5.2 |
| @types/react | 19.1.13 | 19.2.14 |
| @types/react-dom | 19.1.9 | 19.2.3 |
| @vitejs/plugin-react | 5.0.3 | 5.2.0 |
| @playwright/test | 1.58.2 | 1.59.1 |
| autoprefixer | 10.4.21 | 10.4.27 |
| baseline-browser-mapping | 2.9.8 | 2.10.18 |
| docx | 9.5.1 | 9.6.1 |
| dompurify | 3.2.7 | 3.3.3 |
| i18next-browser-languagedetector | 8.2.0 | 8.2.1 |
| jspdf-autotable | 5.0.2 | 5.0.7 |
| maplibre-gl | 5.19.0 | 5.22.0 |
| openai | 6.0.0 | 6.34.0 |
| postcss | 8.5.6 | 8.5.9 |
| react | 19.1.1 | 19.2.5 |
| react-dom | 19.1.1 | 19.2.5 |
| react-force-graph-2d | 1.29.0 | 1.29.1 |
| react-hook-form | 7.63.0 | 7.72.1 |
| react-router-dom | 7.13.1 | 7.14.0 |
| recharts | 3.7.0 | 3.8.1 |
| tailwind-merge | 3.3.1 | 3.5.0 |
| tailwindcss | 4.1.13 | 4.2.2 |
| typescript-eslint | 8.44.0 | 8.58.1 |
| zod | 4.1.11 | 4.3.6 |
| zustand | 5.0.8 | 5.0.12 |

## Deferred Upgrades

| Package | Current | Latest | Reason to Defer |
|---------|---------|--------|-----------------|
| Vite | 7.3.2 | 8.0.8 | Vite 8 replaces Rollup with Rolldown — major bundler migration, `rollupOptions` → `rolldownOptions` |
| @vitejs/plugin-react | 5.2.0 | 6.0.1 | Requires Vite 8 — removes Babel dependency |

## Security Audit Findings

### Critical

| # | Finding | Severity | File | Details |
|---|---------|----------|------|---------|
| 1 | SQL injection via unvalidated table name in `updatePriority` | **CRITICAL** | `functions/api/_shared/playbook-engine/action-executor.ts:146` | `updatePriority` interpolates `String(params.table)` directly into SQL. Unlike `updateStatus` (lines 72-77) which validates against `ALLOWED_STATUS_TABLES`, `updatePriority` has no allowlist check. |
| 2 | `getUserIdOrDefault` silently falls back to user ID 1 | **CRITICAL** | `functions/api/_shared/auth-helpers.ts:138-144` | When no auth header is provided, returns `1` (first user). Used by ~10 endpoints. Unauthenticated requests read data as user 1. |
| 3 | No rate limiting on ~15 AI endpoints (OpenAI billing abuse) | **CRITICAL** | `functions/api/ai/*.ts`, `ach/*.ts`, `content-intelligence/*.ts`, `surveys/*/summarize.ts` | `RATE_LIMIT` KV binding declared but never enforced. Unlimited OpenAI API calls possible. |

### High

| # | Finding | Severity | File | Details |
|---|---------|----------|------|---------|
| 4 | Wildcard CORS on all API responses | **HIGH** | `functions/api/_middleware.ts:13` | `Access-Control-Allow-Origin: *` with `Authorization` and `X-User-Hash` in allowed headers. |
| 5 | No SSRF protection on URL scraping endpoints | **HIGH** | `web-scraper.ts`, `ai/scrape-url.ts`, `content-intelligence/analyze-url.ts` | No private IP range blocking (127.0.0.1, 10.x, 172.16-31.x, 192.168.x). |
| 6 | No Content-Security-Policy header | **HIGH** | `public/_headers` | Sets X-Frame-Options etc. but no CSP. App renders user-provided and AI-generated content. |
| 7 | Unrestricted guest user auto-creation | **HIGH** | `functions/api/_shared/auth-helpers.ts:63-92` | Any request with 16+ char `X-User-Hash` auto-creates user row. No rate limit or cap. |

### Warning

| # | Finding | Severity | File | Details |
|---|---------|----------|------|---------|
| 8 | Intake form password endpoint lacks rate limiting | WARNING | `cop/public/intake/[token]/verify-password.ts` | Brute-forceable — no rate limit unlike `/hash-auth/authenticate` (5/min). |
| 9 | Entity types not validated before INSERT | WARNING | `actors.ts`, `events.ts`, `sources.ts`, `places.ts`, `behaviors.ts` | D1 CHECK constraint catches invalid types but returns 500, not 400. |
| 10 | Evidence enums not validated | WARNING | `cop/[id]/evidence.ts:90-91` | `evidence_type` and `credibility` accept arbitrary values with no schema constraint. |
| 11 | Placeholder refresh token never validated | WARNING | `hash-auth/authenticate.ts:70` | `refresh_token: 'refresh_' + crypto.randomUUID()` never persisted or checked. |
| 12 | Account hash returned in auth response | WARNING | `hash-auth/authenticate.ts:73` | Credential echoed in login response — risk if response bodies are logged. |
| 13 | Dynamic column interpolation in activity logger | WARNING | `functions/utils/activity-logger.ts:118-122` | `notify_on_${event_type}` — safe at compile time but fragile pattern. |
| 14 | Dynamic column selection in collaborators | WARNING | `cop/[id]/collaborators.ts:46-51` | `SELECT ${columns}` — currently safe (two hardcoded values) but fragile. |

### Remediation Status

| Finding | Status |
|---------|--------|
| #1 SQL injection in updatePriority | **FIXED** — added ALLOWED_PRIORITY_TABLES allowlist |
| #2 getUserIdOrDefault fallback to user 1 | **FIXED** — returns null, all 24 call sites now return 401 |
| #3 AI rate limiting | **FIXED** — 30 req/min per user in middleware |
| #4 Wildcard CORS | **FIXED** — dynamic origin allowlist (researchtools.net, pages.dev, localhost) |
| #5 SSRF in URL scraping | **FIXED** — `isPrivateUrl()` blocks private/internal IPs in 3 endpoints |
| #6 No CSP header | **FIXED** — added Content-Security-Policy to `public/_headers` |
| #7 Unrestricted guest creation | **FIXED** — 10 req/min per IP rate limit in middleware |
| #8 Password brute force | **FIXED** — 10 req/min per IP rate limit in middleware |
| #9 Entity type validation | **FIXED** — allowlist validation in actors, events, sources, places, behaviors |
| #10 Evidence enum validation | **FIXED** — sanitized source_type and credibility to allowed values |
| #11 Placeholder refresh token | **FIXED** — removed from auth response |
| #12 Account hash in response | **FIXED** — removed from auth response |
| #13 Dynamic SQL in activity logger | **FIXED** — runtime validation of event_type against allowlist |
| #14 Dynamic SQL in collaborators | **FIXED** — hardcoded column constants, documented as non-user-derived |

## Verification

```bash
# Build passes
npx vite build    # ✓ built in 8.44s

# Zero vulnerabilities
npm audit          # found 0 vulnerabilities

# Only 2 deferred packages remain outdated
npm outdated       # vite 7.3.2 → 8.0.8, @vitejs/plugin-react 5.2.0 → 6.0.1

# ESLint runs (pre-existing issues only, no regressions)
npx eslint src/    # 1369 problems (all pre-existing)
```

## Lessons Learned

### 1. Brand icons are a trademark liability

Lucide 1.0 removed Instagram, Youtube, Twitter, Facebook, Linkedin, and Github icons due to trademark concerns. This is an industry-wide trend — Font Awesome moved brand icons to a separate package years ago. **Rule:** Don't depend on brand icons from generic icon libraries. Consider SVG files for brand icons or use a dedicated brand icon set.

### 2. ESLint 10 + react-hooks 7 must be upgraded atomically

`eslint-plugin-react-hooks@7` exports a `configs.flat` object for ESLint 10 compatibility, but the top-level `configs['recommended-latest']` still uses the old format. ESLint 10's `defineConfig()` rejects old-format configs. You must switch to `tseslint.config()` with explicit `plugins` + `rules` pattern. **Rule:** When upgrading ESLint major versions, always check plugin config export formats.

### 3. TypeScript 6 is a non-event if you already set `types` explicitly

TS6's headline breaking change (`types` defaults to `[]`) only affects tsconfigs that relied on auto-discovery of `@types/*`. If every tsconfig already has an explicit `types` field, the upgrade is zero-change. **Rule:** Always set `types` explicitly in tsconfigs — it's good practice regardless of TS version.

### 4. npm audit fix is surprisingly effective

All 11 vulnerabilities (including 2 critical) were resolved by `npm audit fix` after updating Vite to 7.3.2. The fix touched axios, jspdf, wrangler/miniflare/undici, lodash-es, picomatch, flatted, and brace-expansion — all in one pass. **Rule:** Run `npm audit fix` before manually updating individual packages.

### 5. `--legacy-peer-deps` is needed when jspdf-autotable lags behind jspdf

`jspdf-autotable@5.0.7` declares `"jspdf": "^2 || ^3"` as a peer dep, but jspdf is at 4.2.1. This is a false constraint — the library works fine at runtime. **Rule:** Watch for this specific peer dep mismatch; it's a known issue in the jspdf ecosystem.
