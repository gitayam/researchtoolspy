# Scraping modernization — evidence, hypotheses, and execution plan

**Date:** 2026-08-30 (production observations through 2026-08-31 UTC) · **Status:** proposed

**Scope:** single-URL extraction, multi-page collection, social-media collection, metadata extraction, and the observability/security boundary shared by those paths

## Decision

Do **not** replace the current stack with Scrapling yet.

The next direction is:

1. Secure and consolidate every outbound URL path behind one scraping gateway.
2. Add per-attempt telemetry before changing fetch strategy.
3. Make the existing Cloudflare Browser Run integration measurable and test it on blocked/JavaScript-heavy pages.
4. Benchmark a proven semantic content extractor (Trafilatura and Readability are the first candidates) against the current regex/first-block extractor.
5. Run Scrapling as a pinned, isolated Container experiment. Promote it only if it recovers a material share of pages that still fail the winning HTTP + Browser Run path.
6. Use Scrapling's adaptive selectors only for repeated, domain-specific extraction profiles. They require a saved baseline and persistent state, so they are not a general solution for arbitrary research URLs.

The target is a measured fallback ladder, not a growing chain of unobservable scrapers:

`policy/SSRF gate -> cache -> platform/PDF adapter -> direct HTTP -> semantic extraction -> Browser Run -> optional Scrapling experiment -> explicit archive retrieval`

Authentication walls, paywalls, CAPTCHA challenges, robots exclusions, and publisher content-use signals are policy outcomes, not bugs to bypass. Social platforms should use approved APIs/providers wherever possible.

## What was checked

### Production logs and D1 analytics

All queries were read-only and aggregate-only. No production URL or extracted content was printed.

For the 30 days ending 2026-08-31 UTC:

| Signal | Observation | Interpretation |
|---|---:|---|
| `event_logs` rows | 195 | The sink is intentionally low-volume, not request analytics. |
| `content-intelligence/analyze-url` hard-failure warnings | 194 | This is the only scraping route with useful persisted failure coverage. |
| Distinct failed URLs | 179 | Failures are broad, not one URL being retried repeatedly. |
| Retried failed URLs | 13 | 15 events were repeats; maximum was 4 failures for one URL. |
| Explicit 401/403/429 failures | 161 / 194 (83.0%) | Access/rate behavior dominates the recorded terminal failures. |
| Unextractable 2xx article bodies | 10 / 194 (5.2%) | The visible parser-only failure class is much smaller. |
| Persisted `content_analysis` rows | 130 | These are retained normal/full results, not all successful requests. |
| Distinct domains in those rows | 81 | The success sample is not confined to a few sites. |
| Mean stored processing duration | 7.61 s | This combines fetching, extraction, and AI; no stage timing exists. |
| Maximum stored processing duration | 23.42 s | There is no p95 stage breakdown. |
| `social_media_extractions` rows | 0 in 30 days; 4 all-time | This table does not demonstrate current route usage. |

Recorded hard-failure reasons:

| Terminal reason | Count |
|---|---:|
| HTTP 403 | 82 |
| HTTP 429 | 55 |
| HTTP 401 | 21 |
| HTTP 999 | 14 |
| Article content could not be extracted | 10 |
| PDF download HTTP 403 | 3 |
| HTTP 520 | 3 |
| HTTP 404 | 3 |
| HTTP 400 / 526 / internal error | 3 |

The 83.0% figure includes the three PDF 403s and does not assume what HTTP 999 means.

Seven-day D1 query insights show active use of the content-analysis path (128 content-deduplication checks and 122 `content_analysis` insert queries). They do **not** establish a success rate: quick-mode successes are returned without being persisted, expired rows are deleted, cache/dedup paths differ, and all other scraper routes lack terminal outcome metrics.

### Observability gaps

- [`event-log.ts`](../../functions/api/_shared/event-log.ts) explicitly supports low-volume errors/warnings only. It cannot answer request volume, success rate, fallback recovery, cache hit rate, latency distribution, or cost.
- 194 of 195 recent event rows contain the raw submitted URL in context. Query strings can contain sensitive tokens or research intent; operational logs should store a keyed URL hash instead.
- [`analyze-url.ts`](../../functions/api/content-intelligence/analyze-url.ts) returns `content_source`, `fallback_attempts`, and `extraction_quality`, but does not persist them with `content_analysis`.
- The browser-renderer Worker was deployed, but [`workers/browser-renderer/wrangler.toml`](../../workers/browser-renderer/wrangler.toml) has no persisted observability configuration and [`index.ts`](../../workers/browser-renderer/src/index.ts) does not record strategy, timing, outcome, or `X-Browser-Ms-Used`.
- Pages Function logs are live streams rather than retained logs. The current `console.*` calls therefore do not provide historical evidence. The reviewed scraping paths contain more than 100 `console.error`/`console.warn` calls, while only the `analyze-url` hard-failure branch and selected COP/Apify errors reach D1.
- SearXNG metrics are disabled (`enable_metrics: false`), the AI-gateway metrics helper is a stub, and no product-analytics client was found.

### Code and correctness findings that gate scraper expansion

1. **Resolved — public SSRF path:** [`url-enrichment.ts`](../../functions/api/_shared/url-enrichment.ts) now uses the static-only bounded `scrapeUrl()` path, whose shared fetch policy validates DNS answers, redirect hops, address ranges, MIME type, response bytes, and total duration. Public follow-on analysis is ephemeral (`save_link:false`) and carries no synthetic credentials.
2. **Inconsistent SSRF coverage:** `tools/analyze-url`, `tools/scrape-metadata`, `extract-claims`, `extract-timeline`, and `rage-check` also fetch caller-controlled URLs without the shared check. The existing lexical `isPrivateUrl()` does not validate every redirect hop, DNS answers/rebinding, IPv6/reserved ranges, credentials, or ports.
3. **Timeout silently ignored:** [`web-scraper.ts`](../../functions/api/web-scraper.ts) passes `signal` to `enhancedFetch()`, but [`browser-profiles.ts`](../../functions/utils/browser-profiles.ts) neither accepts nor forwards it. Other callers pass `headers` that are also ignored.
4. **Worker code is outside TypeScript validation:** `tsconfig.app.json` includes only `src`; the `functions/`, `workers/`, and `containers/` TypeScript paths are not checked by the main build.
5. **Authorization scope:** `analyze-url`'s `load_existing` branch selects only by analysis ID, without user/workspace scope.
6. **COP ingestion is not idempotent:** every successful poll can insert the same Apify dataset again, and the supplied run ID is not registered to the COP session at start time.
7. **Browser fallback is too narrow:** a Browser Run attempt occurs for a 2xx response judged thin/empty, but not for a direct HTTP 403. The largest observed failure class therefore never tests the existing renderer against the original URL.
8. **Fallback provenance is lossy:** archive.ph, Wayback, and SMRY may produce a different or older document, but the source/fallback chain is not stored with the persisted analysis.
9. **The 150-word gate is not a quality metric:** it prevents short results from being persisted, but cannot identify a long login page, navigation shell, duplicated boilerplate, or wrong archived article.
10. **Many implementations have drifted:** at least twelve route/shared paths implement some combination of URL validation, headers, retries, social handling, extraction, rendering, caching, and errors. Security, timeout, quality, and response behavior differ by route.

These are preconditions, not optional cleanup. A more capable fetcher behind the current public URL path would increase the SSRF blast radius.

## Technology review

| Option | Best fit here | Main constraint | Direction |
|---|---|---|---|
| Cloudflare Browser Run | JavaScript rendering and eligible direct-fetch failures; `/crawl` for bounded multi-page jobs | Must meter browser milliseconds and distinguish policy failures | **Use and measure first**; the service binding already exists. |
| Trafilatura | Main-text and metadata extraction from fetched HTML | Python/container hop and cold-start cost | **Benchmark first candidate** against current extractor and Readability. |
| Mozilla Readability | Main-text extraction in a JS-compatible service | Needs a DOM implementation in the Worker or container | **Benchmark first candidate**; choose on quality/latency, not familiarity. |
| Scrapling 0.4.x | TLS/browser impersonation, hard sites, repeated-domain spiders, adaptive selectors | Python + browser footprint; beta classifier; rapid breaking releases; adaptive mode needs a saved baseline/state | **Isolated experiment**, not default path. |
| Crawlee | Durable queues, sessions, proxies, adaptive HTTP/Playwright crawling | Duplicates Cloudflare `/crawl` for current scale and adds another orchestrator | Defer until multi-page jobs outgrow Browser Run. |
| Apify / approved platform APIs | Social-media collection and maintained platform-specific adapters | Vendor cost, provider limits, terms, and idempotent ingestion | Keep behind a normalized social adapter and measure provider outcomes. |
| Firecrawl / Zyte | Managed fallback if owning browser operations is not worthwhile | Data handling, vendor cost/lock-in; Firecrawl self-hosting is a larger stack | Revisit only if the in-platform experiment misses its SLOs. |
| Crawl4AI | RAG-oriented Markdown/structured extraction | Another browser service and larger operational surface | Benchmark only if Markdown structure is a demonstrated requirement. |
| Lightpanda | Potential future low-cost browser runtime | Upstream labels it beta/WIP and warns many sites may fail/crash | Do not use in production yet. |

Scrapling is a credible candidate, but its “adaptive” feature is selector relocation for known sites: first save element properties (`auto_save`), then retrieve/match them later, using SQLite by default. That is valuable for maintained source profiles, not arbitrary one-off article extraction. Its current changelog also shows frequent browser/fetcher fixes and breaking changes; pinning and regression tests are mandatory.

## Falsifiable hypotheses

Every hypothesis has a decision attached so an inconclusive pilot cannot quietly become permanent architecture.

| ID | Hypothesis | Test and minimum sample | Falsified when | Decision if falsified |
|---|---|---|---|---|
| H1 | Across all scraper entry points, at least 70% of hard failures occur in fetch/access policy before parsing. | Instrument every terminal attempt for 14 days and at least 100 failures. | The cross-route share is below 70%. | Prioritize semantic extraction/quality before adding fetch transports. |
| H2 | Browser Run recovers at least 35% of **eligible** direct-fetch 403/JavaScript-shell failures with p95 added scrape latency <=12 s and cost <=$0.001 per recovered document. | Canary on at least 100 eligible requests; never treat 401, robots/content-signal denial, or CAPTCHA as eligible. | Any recovery, latency, quality, or cost gate fails. | Keep rendering limited to 2xx thin shells; evaluate an approved provider only for demonstrated gaps. |
| H3 | Trafilatura or Readability improves macro main-text F1 by at least 8 percentage points and metadata F1 by at least 5 points over the current extractor, with <=2% false-success and <=300 ms warm added extraction latency. | Paired run on the versioned 200+ page corpus and a held-out set. | Neither candidate clears all gates with a 95% paired confidence interval. | Improve the current extractor using the failure corpus instead of adding a container dependency. |
| H4 | Static-first plus conditional rendering matches browser-first accepted-content quality on at least 95% of pages while using at least 60% fewer browser seconds. | Run both strategies on the authorized benchmark corpus; reuse stored HTML for extractor comparisons. | Quality equivalence or browser-saving gate fails. | Broaden browser-first routing only for the page classes that show a measured benefit. |
| H5 | Pinned Scrapling `Fetcher`/`StealthyFetcher` adds at least 10 absolute percentage points of recovery after the winning HTTP + Browser Run path, with <=2x p95 latency, <=2% false-success, and no policy bypass. | Isolated Container on at least 100 residual failures, with exact dependency lock and three repeated runs. | Recovery delta, stability, quality, latency, or policy gate fails. | Do not ship Scrapling as a general fallback. Keep it out of the production request path. |
| H6 | For repeated-domain profiles, Scrapling adaptive relocation cuts selector breakage by at least 50% across historical/current snapshots with <2% wrong-element relocation. | Select at least three high-value recurring domains and test versioned snapshots plus synthetic DOM mutations. | Breakage reduction or false-relocation gate fails. | Use explicit versioned selectors and monitoring instead of adaptive state. |
| H7 | Fetch + extraction account for less than 30% of successful normal-mode p95 latency; AI stages dominate. | Record stage timers for at least 200 successful normal requests. | Fetch/extract is >=30% of p95. | Make fetch/extractor latency a primary optimization target; otherwise optimize AI separately. |
| H8 | The 150-word gate admits fewer than 2% wrong/login/boilerplate pages and rejects fewer than 5% valid short documents. | Human-label accepted/rejected benchmark outputs; evaluate a composite quality score. | Either error bound is exceeded. | Replace the single threshold with versioned content-type-aware quality scoring. |
| H9 | Most product demand enters through `content-intelligence/analyze-url`; each duplicate scraper route contributes <10% of scrape attempts. | Route-level request/outcome metrics for 30 days. | Any route contributes >=10%, or has a distinct required contract. | Preserve it as a thin adapter over the gateway; otherwise deprecate after a compatibility window. |

Candidate adoption uses paired tests and confidence intervals, not a single live run. Extractor tests use stored snapshots so they do not multiply traffic to publishers. Live fetch tests obey per-domain concurrency, backoff, robots/content signals, and explicit page limits.

## Measurement contract

### Runtime analytics

Use a `SCRAPE_ANALYTICS` Workers Analytics Engine binding for one non-blocking data point per attempt and one terminal data point per request. It is designed for aggregate, high-cardinality time-series queries and is supported by Pages Functions.

Do not store raw URLs, query strings, response bodies, prompts, cookies, tokens, IPs, or user agents.

Recommended dimensions:

- schema version, route, purpose, page/content class
- fetch strategy and extractor version
- provider, attempt number, terminal outcome, normalized error code, HTTP status class
- cache result, fallback reason, policy result, response content type
- HMAC URL/domain identifiers for correlation; tenant/workspace HMAC as the sampling index

Recommended numeric measures:

- count, total/fetch/render/extract/AI milliseconds
- response bytes, extracted words, quality score
- Browser Run milliseconds (`X-Browser-Ms-Used`) and estimated cost
- retry count, fallback count, cache hit, accepted/rejected flag

Keep `event_logs` for operator-actionable errors, security events, and provider outages. Replace raw URL context with a keyed URL hash, bounded error code, and request correlation ID. The browser-renderer Worker should enable persisted structured logs at a sampled rate; Pages continues to use Analytics Engine plus the D1 error sink because Pages tail logs are not retained.

### Durable provenance

Persist the method that produced any saved analysis:

- `source_mode`: live, supplied, provider, or archive
- `fetch_strategy` and `extractor_version`
- final content URL/snapshot identity appropriate for the user-facing record
- bounded attempt summary and policy result
- quality scorer version/score and content hash

Do not rely on telemetry retention for research provenance.

### Dashboard and alerts

The first dashboard must answer:

1. Attempts and success rate by route, strategy, page class, and normalized error.
2. Fallback recovery: “failed method A, succeeded method B.”
3. p50/p95 total and stage latency.
4. False-success/manual-rejection and thin-content rates.
5. Cache hit, retries per success, Browser Run seconds, provider cost per success.
6. Top repeated failures by HMAC and domain class without revealing the URL.
7. Social provider success/limits and COP ingest duplicates prevented.

Alert on a 15-minute or minimum-volume window: success drop >=15 percentage points, p95 latency doubling, provider 401/403/429 spike, browser cost budget exceeded, telemetry terminal-event coverage <99%, or any private-network/redirect guard violation.

## Target architecture

### One gateway, thin product adapters

Create one internal `ScrapeGateway` contract used by every product endpoint:

```text
ScrapeRequest
  url, purpose, mode, content limits, crawl limits, user/workspace context

ScrapeResult
  status, normalized error, content + metadata, provenance,
  attempt list, quality result, timings, cost, cache result, policy result
```

The gateway owns URL normalization, SSRF/redirect checks, timeouts, size limits, content-type routing, caching, retries/backoff, policy, extraction, fallback selection, quality scoring, telemetry, and stable error taxonomy. Existing endpoints keep their public response shapes initially and translate to/from this contract.

### Status-aware fallback policy

- **401:** authentication required; never “stealth” around it.
- **403:** one Browser Run experiment only when content is public and policy permits; otherwise provider/manual-content path.
- **429/503:** honor `Retry-After`, apply jittered per-domain backoff, and avoid immediate multi-profile amplification.
- **404:** terminal for live content; offer explicit historical/archive retrieval separately.
- **5xx/network timeout:** bounded retry, then eligible renderer/provider fallback.
- **2xx thin/JS shell:** renderer, then semantic extractor and quality scorer.
- **social/PDF:** route to their dedicated adapters before generic HTML handling.

Archive content is a separate provenance mode, not an invisible replacement for the live document. Remove “bypass” language from the implementation/docs.

### Multi-page collection

Use Cloudflare `/crawl` first for explicit bounded collection jobs:

- declare only the required `crawlPurposes` (normally `search` and/or `ai-input`)
- default `render: false`, escalating only for page classes proven to need rendering
- require include/exclude patterns, max pages, depth, total byte/time budgets, and cancellation
- store job ownership and make polling/ingestion idempotent

Adopt Crawlee or Scrapling's spider framework only if `/crawl` cannot meet a measured queue/session/proxy requirement.

## Execution plan

### Phase 0 — Safety and correctness (ship before new fetch capability)

- [ ] Introduce a shared safe outbound URL primitive. Permit only HTTP(S); reject credentials and disallowed ports; normalize IPv4/IPv6; resolve and reject private/reserved/link-local destinations; validate every redirect manually; cap redirect count, bytes, and duration.
- [ ] Enforce the same policy at both the Pages gateway and browser/container service boundaries.
- [ ] Route public URL enrichment and every authenticated scraper tool through it.
- [ ] Scope `load_existing` to the authenticated user/workspace.
- [ ] Make `enhancedFetch` accept/forward standard `RequestInit` fields or remove it; add deterministic abort tests.
- [ ] Add a Functions/Workers TypeScript project to the build and CI.
- [ ] Register COP/Apify runs to session/workspace/user at start, verify ownership on poll, and add an idempotency key/unique source identity to evidence ingestion.
- [ ] Fix the web-scraper dataset response/auth contract and rename the metadata-completeness “reliability” score.
- [ ] Stop putting raw URLs in `event_logs`; purge them at the normal 30-day retention boundary or perform an approved earlier redaction migration.

**Exit gate:** all caller-controlled fetches pass redirect-aware SSRF tests; Worker code type-checks; repeated polling cannot duplicate evidence; no raw URL is newly written to logs.

### Phase 1 — Telemetry baseline

- [ ] Define the error taxonomy and versioned `ScrapeResult`/attempt schema.
- [ ] Add the Analytics Engine binding to Pages, browser renderer, and any scraping Container.
- [ ] Instrument all existing paths without changing strategy.
- [ ] Record Browser Run usage headers and propagate the attempt result to the gateway.
- [ ] Persist extraction provenance/quality on saved analyses.
- [ ] Build saved queries/dashboard and a daily aggregate report.
- [ ] Measure for at least 14 days and 100 failures; publish the baseline with confidence bounds.

**Exit gate:** >=99% of scraper requests have exactly one terminal metric; H1, H7, and H9 can be evaluated.

### Phase 2 — Reproducible benchmark

- [ ] Create a 200-300 URL corpus of authorized/public pages stratified across static articles, JavaScript apps, public WAF-blocked pages, legitimate short documents, PDFs, multilingual pages, structured pages, and social URLs.
- [ ] Store sanitized HTML/expected metadata and version the corpus. Keep a held-out set.
- [ ] Human-label main content, title, author, date, expected live/archive identity, and policy outcome.
- [ ] Implement adapters for current extraction, Trafilatura, Readability, Browser Run, and Scrapling.
- [ ] Report hard success, false success, main-text precision/recall/F1, metadata F1, structure retention, p50/p95 latency, bytes, retries, browser seconds, and cost.
- [ ] Run live reliability tests three times with polite per-domain scheduling; run extractor tests primarily from snapshots.

**Exit gate:** H2-H6 and H8 have enough evidence for explicit go/no-go decisions.

### Phase 3 — Cloudflare-native winning path

- [ ] Replace regex/first-block extraction with the benchmark winner, or improve the current extractor if H3 is falsified.
- [ ] Implement the status-aware Browser Run fallback and quality re-check.
- [ ] Propagate `X-Browser-Ms-Used`; enforce per-request and monthly browser budgets.
- [ ] Replace random, internally inconsistent browser headers with a tested stable client policy. Treat transport/TLS impersonation as a separate Scrapling experiment.
- [ ] Make archives user-visible, explicit, and provenance-preserving.
- [ ] Normalize PDF and social adapters behind the gateway.

**Rollout:** 5% -> 25% -> 100% of eligible fallback traffic, with automatic rollback on the gates below.

### Phase 4 — Route consolidation

- [ ] Convert `analyze-url`, `web-scraper`, AI URL scrape, metadata/citation scrape, claims, timeline, RageCheck, and URL enrichment into thin gateway adapters.
- [ ] Remove duplicate fetch/retry/extraction code only after response-contract tests cover each adapter.
- [ ] Decide each low-use route from H9; deprecate with telemetry and a compatibility window.
- [ ] Reconcile and rewrite scraping/API documentation from generated contracts and tested behavior.

**Exit gate:** one implementation owns policy/fetch/fallback/quality; endpoint adapters own only product-specific AI and response formatting.

### Phase 5 — Scrapling Container experiment

- [ ] Build a dedicated least-privilege Container; do not add browser dependencies to the OSINT agent.
- [ ] Pin the exact Scrapling version and lock dependency hashes. Run its upstream test subset plus this project's corpus before upgrades.
- [ ] Expose only the required HTTP/dynamic/stealth operations through an authenticated internal contract. Do not expose arbitrary CDP URLs, persistent browser profiles, filesystem paths, or a public MCP server.
- [ ] Repeat SSRF/policy enforcement inside the Container; cap tabs, memory, response bytes, redirects, per-domain concurrency, and time.
- [ ] Enable robots behavior for crawls and honor `Retry-After`; keep stealth behind a feature flag and approved-domain/purpose policy.
- [ ] Store adaptive-selector fingerprints in an external persistent store; do not depend on a Container's local SQLite lifecycle.
- [ ] Evaluate H5 and H6. Promote only the exact modes/domains that clear their gates.

**Exit gate:** a written adopt/defer decision with recovery delta, false-success, latency, resource, cost, maintenance, and policy evidence.

### Phase 6 — Multi-page jobs and operational hardening

- [ ] Add an owned, cancellable crawl-job record with idempotent result ingestion.
- [ ] Pilot Browser Run `/crawl`; track `browserSecondsUsed`, skipped/disallowed URLs, and content-signal outcomes.
- [ ] Add per-tenant/domain budgets, circuit breakers, provider health, and runbooks.
- [ ] Run weekly quality sampling and a monthly dependency/provider review.
- [ ] Re-evaluate Crawlee/managed providers only from a documented SLO gap.

## Release and rollback gates

A candidate cannot progress if any of these occur:

- private/reserved address or unsafe redirect is fetched
- incorrect/login/boilerplate content acceptance exceeds 2%
- p95 total scrape latency regresses by >25% without the agreed recovery benefit
- hard success improves by <5 absolute percentage points on the target cohort
- Browser Run/provider cost per successful document exceeds the configured budget
- 5xx rate rises by >2 absolute percentage points
- terminal telemetry coverage is below 99%
- evidence ingestion creates a duplicate on repeated poll/retry
- policy-denied content is reclassified as a technical failure and retried through stealth

Rollback is a strategy flag change, not a redeploy: every new fetcher/extractor is registered by version, and the prior strategy remains available through the canary period.

## Recommended issue/PR order

1. `SCRAPE-01` — safe outbound URL/redirect primitive + coverage inventory.
2. `SCRAPE-02` — Functions/Workers TypeScript build and timeout contract fixes.
3. `SCRAPE-03` — auth scoping + COP run ownership/idempotency + dataset contract.
4. `SCRAPE-04` — privacy-safe Analytics Engine schema and instrumentation.
5. `SCRAPE-05` — benchmark corpus, gold labels, adapters, and report.
6. `SCRAPE-06` — Browser Run eligible-status fallback, usage metering, and canary.
7. `SCRAPE-07` — semantic extractor winner and versioned quality scorer.
8. `SCRAPE-08` — gateway migration for existing endpoint adapters.
9. `SCRAPE-09` — Scrapling Container experiment and decision record.
10. `SCRAPE-10` — bounded `/crawl` jobs, budgets, and runbook.

## Primary sources

- [Scrapling repository](https://github.com/D4Vinci/Scrapling), [current changelog](https://github.com/D4Vinci/Scrapling/blob/main/CHANGELOG.md), [fetcher comparison](https://scrapling.readthedocs.io/en/latest/fetching/choosing.html), and [adaptive-selector design](https://scrapling.readthedocs.io/en/latest/parsing/adaptive.html)
- [Cloudflare Browser Run `/crawl`](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/), [API](https://developers.cloudflare.com/api/resources/browser_rendering/), [pricing](https://developers.cloudflare.com/browser-run/pricing/), and [limits](https://developers.cloudflare.com/browser-run/limits/)
- [Workers Analytics Engine example](https://developers.cloudflare.com/workers/examples/analytics-engine/), [limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/), and [Pages binding support](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Cloudflare Pages logging limitations](https://developers.cloudflare.com/pages/functions/debugging-and-logging/)
- [Trafilatura repository](https://github.com/adbar/trafilatura), [core API](https://trafilatura.readthedocs.io/en/latest/corefunctions.html), and [evaluation](https://trafilatura.readthedocs.io/en/latest/evaluation.html)
- [Bevendorff et al., “An Empirical Comparison of Web Content Extraction Algorithms”](https://downloads.webis.de/publications/papers/bevendorff_2023c.pdf)
- [Crawlee adaptive crawler](https://crawlee.dev/python/api/next/class/AdaptivePlaywrightCrawler) and [guides](https://crawlee.dev/python/docs/guides)
- [Crawl4AI repository](https://github.com/unclecode/crawl4ai), [Firecrawl repository](https://github.com/firecrawl/firecrawl), [Zyte API](https://docs.zyte.com/zyte-api/usage/reference.html), and [Lightpanda repository](https://github.com/lightpanda-io/browser)
