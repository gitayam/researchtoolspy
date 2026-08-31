# Scraping Content-Intelligence Tranche Charter

**Status:** accepted, merged to canonical `main`, and production-deployed

**Delivery class:** safety foundation

**Canonical remote/ref:** `origin/main`

**Fresh canonical SHA:** `aedf1d31e9041e803f18b311dbf95122ce97965c`

**Recorded:** 2026-08-31, America/New_York

## Outcome and demo delta

Migrate outbound paths INV-008, INV-009, and INV-010 to bounded purpose-specific adapters, remove ungoverned Browser Run navigation from the content-intelligence analysis path, replace raw-URL failure logs with keyed opaque identifiers and normalized errors, and bring the two excluded content-intelligence routes into the focused Worker type-check.

The product UI and successful API envelopes deliberately remain unchanged. The next user-visible gate is measured, policy-safe renderer recovery after the enforcing-egress experiment and benchmark—not another unmeasured fallback.

## Non-goals

- Production deployment, remote database mutation, secret creation, Analytics Engine dataset/binding changes, Workers VPC/Gateway configuration, or live rebinding tests.
- Dynamic Browser Run navigation, Container scraping, Scrapling, benchmark promotion, or a new paid-provider path.
- Migrating inventory paths outside INV-008 through INV-010.
- Persisting per-request metrics before a dedicated telemetry HMAC key and Analytics Engine binding are authorized.
- Repository-wide lint or unrelated content-intelligence cleanup.

## Baseline and operational facts

- `HEAD`, `origin/main`, and their merge base are `aedf1d31e9041e803f18b311dbf95122ce97965c`; divergence is `0/0` after a fresh fetch.
- `gitlab/main` is `3f0eba98e33f2e2077367acbd553309eceedccbd`, 18 commits behind canonical and 0 ahead.
- The primary checkout is clean. The integration worktree is `codex/scraping-content-intelligence-20260831` at `/Users/sac/Git/researchtoolspy-wt-content-intelligence`.
- Root dependency authority is `package-lock.json`; Container authority is `containers/package-lock.json`.
- Latest managed migration is `0006_scraping_auth_idempotency.sql`, SHA-256 `0332af69ddf01cbf46a166a0e4c006592c6af1badd32bd0e4189ceba53b868e4`.
- The previous joined SHA passed 67 focused scraping tests, full type-check, focused lint, and production build. Full-lint baseline remains 2,882 findings.
- No schema or dependency change is in scope, so migration and lockfile seams are prohibited.

## Falsifiable hypotheses

### H-CI-FETCH-1

For INV-008 through INV-010, no caller-controlled or provider-derived URL reaches raw Worker `fetch`; every GET/HEAD/redirect uses the shared public-address, deadline, content-type, and streaming-byte policy, while fixed archive and image providers enforce exact hosts. The analyze path performs zero Browser Run calls.

The hypothesis is false if a mixed/private DNS answer or redirect reaches target transport, a fixed-host redirect escapes its allowlist, an oversized/wrong-type body is accepted, an invalid cache entry bypasses validation or leaks arbitrary headers, external requests receive caller credentials, or the renderer binding is invoked.

### H-CI-LOG-1

Every new extraction-failure event contains a normalized closed error code and opaque correlation; it contains no raw URL, hostname, query, free-form upstream reason, response body, user token, or workspace identifier. When the dedicated telemetry key is absent, URL/domain identifiers are omitted rather than weakly hashed.

The hypothesis is false if recursive inspection finds a forbidden key/value or recognizable input URL/reason in the event payload.

### H-CI-TYPE-1

`content-intelligence/analyze-url.ts` and `saved-links.ts` compile as explicit roots under the Cloudflare Worker scraping surface without masking missing fields, unknown JSON, Node-only APIs, or unresolved symbols.

The hypothesis is false if either route remains excluded or requires weakening the focused compiler configuration.

## Frozen contracts

- `analyze-url` keeps its authenticated ownership/workspace behavior and successful response envelope.
- Short-link HEAD requests use `safeFetchHead`; matching is by exact normalized hostname, not substring.
- Direct HTML and fixed-provider text use `safeFetchText`; PDF remains through `safeFetchPdf` via the existing helper.
- Archive.ph and Wayback requests are exact-host constrained on every redirect. Wayback timestamps are accepted only in the expected numeric format.
- Dynamic renderer calls are removed from INV-008 until an enforcing boundary is proven. Thin content follows the existing deterministic 422/bypass response path.
- `saved-links` title lookup uses bounded HTML. Its same-origin analysis call forwards only `Authorization`, `X-User-Hash`, and `X-Workspace-ID`, has a deadline, and treats JSON as a typed/validated response.
- The public image proxy accepts only exact `pbs.twimg.com` HTTPS URLs, fetches via `safeFetchImage`, returns/R2-caches only validated bounded bytes, derives the object suffix from validated MIME rather than caller text, and accepts versioned cache hits only with bounded allowed image metadata while reconstructing an allowlisted response header set.
- Failure logs use the existing dedicated-key opaque identifier builder. `JWT_SECRET` is never reused as telemetry key material.
- Product response compatibility is evaluated on successful and ordinary upstream-failure paths; a policy-invalid upstream body may map to a generic safe failure.

## Dependency and ownership

```text
existing safe adapters + opaque IDs
  -> analyze/log provider -----+
  -> saved-links provider -----+-> inventory + typecheck join -> review -> verification
  -> image-proxy provider -----+
```

| Workstream | Owns | Must not edit | Join order |
|---|---|---|---:|
| Analyze/log | `analyze-url.ts`, `_extraction-log.ts`, extraction-log test, new analyze safety test | saved-links, image proxy, shared adapters/contracts, config/docs | 1 |
| Saved links | `saved-links.ts`, new saved-links safety test | analyze/log, image proxy, shared adapters/contracts, config/docs | 2 |
| Image proxy | `twitter-image-proxy.ts`, new image-proxy safety test | analyze/log, saved-links, shared adapters/contracts, config/docs | 3 |
| Integration | inventory/static test, focused tsconfig, roadmap/charter, seam fixes | unrelated application and lock/schema files | final |

`analyze-url.ts` is the highest-conflict seam and has one editing owner. The shared safe-fetch/content/metric contracts are frozen consumers-only dependencies in this tranche.

## Verification matrix

| Gate | CWD | Command | Expected proof |
|---|---|---|---|
| Provider focused | provider worktree | assigned Playwright specs with `--project=chromium --workers=1` | behavioral contract |
| Inventory seam | integration worktree | inventory plus all new route specs | source/status agreement |
| Worker compile | integration worktree | `npm run type-check:scraping-surface` then `npm run type-check` | both exclusions removed without compiler weakening |
| Focused lint | integration worktree | ESLint on new/shared touched tests and regression comparison for legacy routes | no new findings |
| Build | integration worktree | `npm run build` | production bundling |
| Diff | every worktree | `git diff --check` | clean patch |

## Exit gates

1. INV-008 through INV-010 have behavioral denial tests and no raw caller-derived fetch or renderer call remains reachable in their owned path.
2. Exact-host, MIME/signature, byte, redirect, and credential-isolation cases pass.
3. Extraction-failure logs are privacy-safe with and without a dedicated telemetry key.
4. `analyze-url.ts` and `saved-links.ts` are explicit focused type-check roots; the inventory documents only the remaining exclusion.
5. Successful endpoint shapes and ordinary upstream failures remain compatible in focused tests.
6. Focused tests, full type-check, production build, focused lint/regression comparison, and diff checks pass.
7. Independent review finds no unresolved P0/P1 issue.
8. No deploy, remote migration, secret, Analytics Engine, Gateway, or production mutation occurs.

## Run ledger

| Event | Evidence |
|---|---|
| Fresh canonical fetch | `origin/main` at `aedf1d31e9041e803f18b311dbf95122ce97965c`; divergence `0/0` |
| Mirror fetch | `gitlab/main` is 18 behind/0 ahead |
| Merge base | `aedf1d31e9041e803f18b311dbf95122ce97965c` |
| Primary checkout | clean `main`; reserved for user work |
| Integration worktree | `/Users/sac/Git/researchtoolspy-wt-content-intelligence`, branch `codex/scraping-content-intelligence-20260831` |
| Analyze/log provider | joined as `2321d1e02`; P1 correction joined as `84588abb6`; constrained PDF OCR compatibility joined as `628ba53d3`; provider redirect containment joined as `d09bbd8cd` |
| Saved-links provider | joined as `356799ce9`; redirect credential-containment correction joined as `e7bac30f6` |
| Image-proxy provider | joined as `19e5c056a`; cache metadata/body trust and replacement-order corrections joined as `a0f184de2`, `15f67be80`, and `1ef40e075` |
| Provider verification | analyze correction 13/13; constrained PDF/OCR redirect corrections 16/16; image cache correction 10/10; saved-links correction 6/6; Worker type-checks, focused lint/regression comparisons, and diff checks passed in provider worktrees |
| Integrated focused tests | final 12-spec suite passed 98/98 on Chromium with one worker |
| Integrated type-check | `npm run type-check` passed; the focused Worker surface now includes 24 inventoried roots with one explicit exclusion |
| Integrated build | `npm run build` passed with the existing large-chunk warning |
| Focused lint | changed helpers/routes without inherited debt and all touched focused tests passed; analyze-url/pdf-extractor retain only their measured 25/13 pre-existing findings |
| Independent review | multiple read-only rounds found and closed four release seams; final review at `d09bbd8cd` found no P0/P1 and recommended release |
| Residual operational risk | the public image proxy remains unauthenticated and has no binding-backed abuse/write budget; its fixed one-second cache-read budget can also cause safe refetch churn on unusually slow large hits |
| Tranche implementation phase | no external mutation was authorized or performed before acceptance |
| Canonical release | merged through `28ec2a9be`; included in Pages production deployment `680dda8a-1e2d-49a3-aabf-03fd42bbb747` on 2026-08-31 |
| Production verification | canonical site, Pages domain, preview deployment, and `/api/health` returned 200; protected analyzer returned the expected unauthenticated 401 |

## Close decision

Accept this tranche as a safety-foundation increment. Local evidence supports H-CI-FETCH-1, H-CI-LOG-1, and H-CI-TYPE-1 for INV-008 through INV-010: direct, archive, PDF/OCR, saved-link, image, cache, and redirect paths are bounded and credential-contained; extraction failure events are normalized and privacy-safe; and both formerly excluded routes compile under the Worker surface.

This is not evidence that the repository-wide scraping surface is complete or that DNS validation alone prevents connection-time rebinding. Dynamic Browser Run remains disabled on this path, the enforcing-egress experiment remains a release gate for rendering, Analytics Engine/telemetry bindings remain unprovisioned, one content-intelligence Worker root remains excluded, and the public image proxy must gain binding-backed abuse/write budgets before higher-volume promotion.
