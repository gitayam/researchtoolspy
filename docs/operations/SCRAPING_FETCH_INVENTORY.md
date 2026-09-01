# Scraping Outbound-Fetch Inventory

**Audited baseline:** canonical `origin/main` SHA `28ec2a9bed90503b1743a7f88bc1e4c19f92b1d3`; INV-003 updated on the `codex/scraping-tools-analyze-20260831` integration milestone

**Last reviewed:** 2026-08-31

**Scope:** Cloudflare Pages Functions that accept, recover, or derive a URL from caller-controlled data and then fetch it, navigate it, or send it to a scraping provider.

This inventory records the current implementation, including unsafe legacy paths. It is not an allowlist and does not assert that an endpoint is safe merely because it is authenticated or uses a fixed upstream hostname. The accompanying static smoke test pins each row to source evidence so adapter changes require an explicit inventory update.

## Status vocabulary

- `unsafe-direct`: arbitrary or provider-returned URL reaches raw `fetch`; DNS, redirects, response type, or body size are not governed by the shared policy.
- `unsafe-enhanced`: arbitrary URL reaches `enhancedFetch`; browser headers/retries exist, but it follows redirects automatically and has no DNS or body policy.
- `unsafe-shared`: route delegates to the current shared scraper, which still uses legacy navigation on this audited baseline.
- `safe-text`: caller URL uses the bounded shared text-fetch policy; any separate renderer boundary is tracked independently.
- `safe-document`: caller URL uses the bounded text/PDF router with MIME-specific streaming limits and PDF signature validation.
- `safe-pdf`: caller URL uses the bounded PDF adapter with MIME and `%PDF-` signature validation.
- `safe-multi-source`: caller and fixed provider/archive URLs use purpose-specific bounded adapters with exact-host constraints; dynamic rendering is disabled where applicable.
- `safe-image`: caller URL uses the bounded image adapter with exact-host, MIME, signature, and byte validation before cache or persistence.
- `delegated-safe`: the route delegates caller URL handling to a local endpoint whose current outbound path is policy-bounded; caller credentials and persistence intent must remain explicit.
- `delegated-unsafe`: the route calls another local endpoint whose current outbound behavior is unsafe; authorization forwarding must also be verified.
- `constrained-provider`: the outbound hostname is constructed by the server for a named provider, but input validation, returned-URL handling, and response budgets are not yet centralized.
- `third-party-job`: the Worker sends a caller URL to a scraping vendor rather than navigating it locally; target policy and data disclosure still require controls.
- `bounded-provider-job`: caller disclosure is limited to exact approved platform URLs and a fixed provider origin; provider redirects, response MIME/bytes, request duration, paid request size, authorization, and idempotency are bounded.

## Entry-point inventory

| ID | Route or consumer | URL provenance | Auth exposure | Current mechanism | Status | Required target adapter |
| --- | --- | --- | --- | --- | --- | --- |
| INV-001 | `POST /api/web-scraper` (`functions/api/web-scraper.ts`) | JSON `body.url` | authenticated | bounded `safeFetchText` with manual redirect validation | `safe-text` | enforcing egress boundary; preserve API error envelope |
| INV-002 | `POST /api/tools/scrape-metadata` (`functions/api/tools/scrape-metadata.ts`) | JSON `body.url` | authenticated | bounded `safeFetchText` with manual redirect validation | `safe-text` | enforcing egress boundary; preserve API error envelope |
| INV-003 | `POST /api/tools/analyze-url` (`functions/api/tools/analyze-url.ts`) | JSON `body.url`; archive services return snapshot metadata | authenticated | bounded text fetch plus exact-host bounded Wayback availability/CDX adapters; automatic archive writes disabled | `safe-multi-source` | enforcing egress boundary; preserve analysis envelope |
| INV-004 | `POST /api/tools/extract` (`functions/api/tools/extract.ts`) | JSON `body.url` | authenticated | bounded `safeFetchDocument` with 2 MiB text and 10 MiB validated PDF modes | `safe-document` | enforcing egress boundary; preserve extraction envelope |
| INV-005 | `POST /api/tools/extract-claims` (`functions/api/tools/extract-claims.ts`) | JSON `url`; archive APIs return snapshot URLs | authenticated | bounded primary and exact-host cache/archive adapters under a 30-second chain deadline; unsafe DNS/redirect denial is terminal before provider disclosure; returned Wayback URLs require exact HTTPS archive identity | `safe-multi-source` | enforcing egress boundary; make archive substitution explicit in product policy |
| INV-006 | `POST /api/tools/extract-timeline` (`functions/api/tools/extract-timeline.ts`) | JSON `body.url` | authenticated | bounded static text fetch with validated redirects, 2 MiB response ceiling, and final-URL extraction provenance; Browser Run disabled | `safe-text` | enforcing egress boundary; renderer remains gated pending top-level, redirect, frame, worker, WebSocket, and subresource enforcement |
| INV-007 | `POST /api/ai/scrape-url` (`functions/api/ai/scrape-url.ts`) | JSON `url` | authenticated | bounded text fetch; exact social-host classification before optional provider disclosure; bounded exact-host Twitter oEmbed fallback | `safe-multi-source` | enforcing egress boundary; keep provider response budgets isolated in INV-026 |
| INV-008 | `POST /api/content-intelligence/analyze-url` (`functions/api/content-intelligence/analyze-url.ts`) | JSON `url`; redirects/archive results | public ephemeral analysis with per-IP budget; authenticated owner/editor workspace required only for persistence | bounded HEAD/text/PDF adapters; exact-host archive/shortener policy; dynamic rendering disabled; anonymous supplied-content bypass denied | `safe-multi-source` | enforcing egress boundary; measured renderer stays gated |
| INV-009 | `POST /api/content-intelligence/saved-links` (`functions/api/content-intelligence/saved-links.ts`) | JSON `url` | authenticated | bounded title fetch and credential-allowlisted same-origin analysis delegation | `safe-text` | enforcing egress boundary; preserve delegation envelope |
| INV-010 | `GET /api/content-intelligence/twitter-image-proxy` (`functions/api/content-intelligence/twitter-image-proxy.ts`) | query `url` | public | exact `pbs.twimg.com` bounded image adapter; binding-backed hourly request budget; versioned cache; per-client/hourly and global/daily R2 archival budgets that fail closed for writes | `safe-image` | enforcing egress boundary; migrate eventually-consistent KV request budget to precise Rate Limiting binding if burst volume warrants |
| INV-011 | `POST /api/tools/rage-check` (`functions/api/tools/rage-check.ts`) | JSON `url` | authenticated | shared bounded static text/oEmbed scraper with exact social-provider classification; Browser Run disabled | `safe-multi-source` | enforcing egress boundary; keep provider response budgets isolated in INV-026 |
| INV-012 | `POST /api/surveys/public/:token/submit` (`functions/api/surveys/public/[token]/submit.ts`) | public form fields whose schema type is `url` | public token/Turnstile/rate-limit controls | background static-only `enrichResponseUrls` → bounded `scrapeUrl` plus public ephemeral safe analysis; no paid provider, renderer, fake auth, or persistence intent | `safe-multi-source` | enforcing egress boundary; preserve non-blocking enrichment semantics |
| INV-013 | `POST /api/cop/public/intake/:token/submit` (`functions/api/cop/public/intake/[token]/submit.ts`) | public intake fields whose schema type is `url` | public token/Turnstile/rate-limit controls | same shared static-only bounded enrichment contract as INV-012 | `safe-multi-source` | same controls as INV-012 |
| INV-014 | `POST /api/surveys/public/:token/preview-url` (`functions/api/surveys/public/[token]/preview-url.ts`) | JSON `url` | public token plus optional password | lexical/private-literal validation, then public ephemeral `analyze-url` with `save_link: false` and no synthetic credentials | `delegated-safe` | enforcing egress boundary; preserve minimal preview envelope |
| INV-015 | `POST /api/tools/batch-process` (`functions/api/tools/batch-process.ts`) | `items[].source` for URL items | authenticated | internal dispatch to analyze/extract/metadata routes | `delegated-unsafe` | preserve caller auth and require each target route's safe adapter |
| INV-016 | `POST /api/frameworks/pmesii-pt/import-url` (`functions/api/frameworks/pmesii-pt/import-url.ts`) | JSON `body.url` | authenticated | internal content-analysis request | `delegated-unsafe` | correct authenticated internal route backed by safe fetch |
| INV-017 | `POST /api/content-intelligence/starbursting` (`functions/api/content-intelligence/starbursting.ts`) | stored analysis URL originally supplied by a caller | authenticated | authenticated internal `/api/ai/scrape-url` request backed by bounded direct fetch and exact social-host provider classification | `delegated-safe` | enforcing egress boundary; preserve caller authorization |
| INV-018 | `POST /api/cop/:id/scrape` (`functions/api/cop/[id]/scrape.ts`) | JSON `body.urls[]` or search query | authenticated owner/editor/admin | reserves an idempotent paid run, permits at most 25 exact platform post URLs or a 500-character query, and uses the fixed-host bounded Apify JSON client | `bounded-provider-job` | enforce account-level spend alerts and retain authenticated ownership checks on polling/ingest |
| INV-019 | `POST /api/content-intelligence/social-extract` (`functions/api/content-intelligence/social-extract.ts`) | JSON social URL parsed into platform identifiers | authenticated | server-constructed YouTube/Instagram/Twitter/provider URLs; some returned media URLs | `constrained-provider` | exact platform parsers, fixed-host adapters, bounded returned-URL fetches |
| INV-020 | `POST /api/content-intelligence/social-media-extract` (`functions/api/content-intelligence/social-media-extract.ts`) | JSON social URL parsed into platform identifiers | authenticated | fixed oEmbed/downloader APIs plus provider-returned caption/media URLs | `constrained-provider` | per-provider allowlists and bounded media/transcript adapters |
| INV-021 | `POST /api/content-intelligence/git-repository-extract` (`functions/api/content-intelligence/git-repository-extract.ts`) | JSON repository URL parsed into owner/path | authenticated | server-constructed GitHub/GitLab/Bitbucket API URLs | `constrained-provider` | exact origin parser and fixed-host repository adapters |
| INV-022 | `POST /api/tools/geoconfirmed` (`functions/api/tools/geoconfirmed.ts`) | JSON URL or conflict/search fields | authenticated | path is parsed, then fixed `https://geoconfirmed.org/api` provider routes | `constrained-provider` | exact input hostname plus fixed-host/body-bounded provider adapter |
| INV-023 | `POST /api/content-intelligence/domain-country` (`functions/api/content-intelligence/domain-country.ts`) | hostname parsed from JSON `url` | authenticated | fixed `ip-api.com` lookup with hostname in path | `constrained-provider` | HTTPS provider adapter, input normalization, response budget |
| INV-024 | `POST /api/content-intelligence/virustotal-lookup` (`functions/api/content-intelligence/virustotal-lookup.ts`) | domain parsed from JSON `url` | authenticated | fixed VirusTotal API hostname | `constrained-provider` | fixed-host provider adapter and normalized domain contract |
| INV-025 | PDF helper (`functions/api/content-intelligence/pdf-extractor.ts`) | arbitrary URL passed by analyze-url | inherits caller route | bounded `safeFetchPdf` with 10 MiB, MIME, and `%PDF-` checks | `safe-pdf` | enforcing egress boundary; keep provider fallback isolated |
| INV-026 | social helper (`functions/api/_shared/apify-social.ts`) | URL passed by scrape routes/shared scraper | inherits caller route | exact Twitter/TikTok post classifier; bounded Twitter oEmbed; fixed-origin Apify client with manual redirects, timeouts, JSON MIME and streaming byte ceilings | `bounded-provider-job` | account-level spend alerts; keep disclosure optional and route-budgeted |

## Type-check boundary

`npm run type-check:scraping-surface` compiles 24 Pages Function or scraping-helper roots, the shared safe-content and observability contracts, and their transitive imports with Cloudflare Workers types. It is intentionally named for the inventoried scraping surface; it is not a claim that every Pages Function compiles.

One inventoried route root remains an explicit exclusion because fixing it crosses this corrective workstream's ownership boundary:

| Excluded root | Existing type debt | Owner required |
| --- | --- | --- |
| `functions/api/content-intelligence/git-repository-extract.ts` | Node `Buffer` use and browser-only `import.meta.env` logger dependency under the Worker type surface | content-intelligence/runtime owner |

These exclusions are still represented in the static inventory test and must not be described as type-checked. Removing an exclusion requires adding the root to `tsconfig.scraping-functions.json` and making the focused command pass without masking Worker/runtime incompatibilities.

## Maintenance rule

Any change that adds a caller-controlled fetch, redirect resolution, browser navigation, media/PDF download, provider-returned URL fetch, or third-party scrape submission must update this inventory and `tests/e2e/smoke/scraping-fetch-inventory.spec.ts` in the same commit. A migration from an unsafe status must update both the source marker and this table; do not leave a route marked safe while a legacy adapter remains reachable.
