# Tools Analyze-URL Safety Tranche Charter

**Status:** accepted locally; ready for canonical push

**Delivery class:** safety foundation

**Canonical remote/ref:** `origin/main`

**Fresh canonical SHA:** `28ec2a9bed90503b1743a7f88bc1e4c19f92b1d3`

**Recorded:** 2026-08-31, America/New_York

## Outcome and demo delta

Migrate INV-003, `POST /api/tools/analyze-url`, from automatic redirects and raw archive calls to the existing bounded outbound policy while preserving its authentication and ordinary success/failure response envelopes.

The authenticated URL Analyzer should look unchanged for ordinary analysis. When `checkWayback` finds no snapshot, it will no longer submit the caller URL to Wayback's save endpoint as an implicit third-party write; the response remains a non-archived result and makes that deliberate non-write explicit. The next user-visible gate remains measured extraction quality and governed renderer recovery after enforcing egress is proven.

## Non-goals

- Production deployment, remote database mutation, secret/binding/Gateway changes, or live third-party requests.
- Migrating INV-005 through INV-026, changing shared safe-fetch contracts, or restoring renderer/provider fallbacks.
- Changing metadata/SEO scoring semantics, UI presentation, schema, dependencies, lockfiles, or migrations.
- Claiming that DNS validation alone closes connection-time rebinding; that remains an enforcing-egress gate.

## Baseline and facts

- Fresh `origin/main`, local `main`, and merge base are `28ec2a9bed90503b1743a7f88bc1e4c19f92b1d3`; divergence is `0/0`.
- `gitlab/main` is `3f0eba98e33f2e2077367acbd553309eceedccbd`, 29 commits behind canonical and 0 ahead.
- The primary checkout is clean. Integration uses `/Users/sac/Git/researchtoolspy-wt-tools-analyze-integration`; provider work uses `/Users/sac/Git/researchtoolspy-wt-tools-analyze-provider`.
- Root dependency authority is `package-lock.json`; Container authority is `containers/package-lock.json`. Latest managed migration remains `0006_scraping_auth_idempotency.sql`; neither seam may change.
- This exact baseline passed 98 focused scraping tests, full type-check, focused lint, and production build in the immediately preceding accepted tranche. The existing large-chunk warning and repository-wide lint debt remain unrelated.
- INV-003 currently uses `enhancedFetch`, unbounded `response.text()`, raw archive availability/CDX/save requests, HTTP CDX, and automatic redirects. The save fallback is an external mutation triggered by a read-like analysis request.

## Falsifiable hypotheses

### H-TA-FETCH-1

The primary URL reaches only `safeFetchText` with one total deadline, a 2 MiB text budget, manual redirect validation, and no inbound credentials. Validated final URL and redirect provenance populate the existing status envelope.

False if a private/mixed-DNS or redirected-private destination reaches target transport, a wrong MIME or oversized/stalled body is accepted, caller Authorization/Cookie/user/workspace headers leave the route, or response provenance uses an unvalidated URL.

### H-TA-ARCHIVE-1

When `checkWayback` is enabled, the route contacts only exact HTTPS `archive.org` and `web.archive.org` endpoints through bounded text/JSON fetches; returned snapshot URLs require exact HTTPS Wayback identity and numeric timestamps. No archive-save request is emitted.

False if an unsafe original is disclosed before policy validation, a provider redirect or returned snapshot escapes its exact host, HTTP is used, archive JSON exceeds its budget, malformed timestamps become trusted output, or `/save/` transport occurs.

### H-TA-COMPAT-1

Unauthenticated, missing/invalid URL, ordinary fetch failure, successful analysis, archived, and not-archived outcomes retain their established HTTP status and JSON field shapes except for the explicit removal of automatic archive creation.

False if ordinary callers lose required fields/status semantics or a safe policy error exposes raw upstream response bodies/free-form transport details.

## Frozen contracts

- Authentication remains `getUserFromRequest`; unauthenticated requests return the existing 401 envelope before DNS or transport.
- Missing URL and invalid URL keep their existing 400 envelopes and protocol-normalization behavior.
- Primary fetch uses `safeFetchText` with a 15-second total deadline and the shared 2 MiB text ceiling. The route does not retry independently.
- Archive availability and CDX responses use bounded `safeFetchText` with exact allowed hosts, HTTPS, a 15-second deadline, and a 256 KiB maximum.
- Wayback availability may return only an exact `https://web.archive.org/...` snapshot with a numeric timestamp. CDX uses `https://web.archive.org/cdx/...` and accepts only the expected array rows/timestamps.
- A missing snapshot returns `isArchived: false` and `saveRequested: false`; it performs no `/save/` call.
- No schema, shared-adapter, renderer, provider, lockfile, migration, UI, or deployment change is permitted.

## Ownership and join order

| Workstream | Owns | Must not edit | Provides | Join |
|---|---|---|---|---:|
| Route provider | `functions/api/tools/analyze-url.ts`, new `tests/e2e/smoke/tools-analyze-url-safe-fetch.spec.ts` | shared adapters, inventory/docs/config, other routes, schema/locks | bounded route and behavioral proof | 1 |
| Integration owner | inventory doc/static spec, this charter, verification seams | unrelated application files | roadmap truth and joined proof | 2 |
| Reviewers | read-only cumulative diff | all files | security/compatibility and test-oracle findings | gate |

Native work uses isolated worktrees and separate commits. The provider commits but does not push or deploy. The integration owner alone joins, updates roadmap truth, runs broad verification, and performs any already-authorized canonical push.

## Verification matrix

| Gate | CWD | Command | Proof |
|---|---|---|---|
| Route behavior | provider/integration | Playwright new route spec, Chromium, one worker | denial, bounds, archive identity, compatibility |
| Inventory seam | integration | new route spec plus `scraping-fetch-inventory.spec.ts` | source/status agreement |
| Worker compile | integration | `npm run type-check:scraping-surface` then `npm run type-check` | Worker and workspace contracts |
| Focused lint | integration | ESLint on changed route/spec/docs test; legacy delta comparison if needed | no new findings |
| Build | integration | `npm run build` | production bundling |
| Diff | every worktree | `git diff --check` | clean patches |

## Exit gates

1. INV-003 has behavioral tests for private/mixed DNS, private/cross-host redirects, content type/size/deadline, credential non-forwarding, archive identity, and zero save transport.
2. Ordinary authentication, failure, analysis, archived, and not-archived response shapes remain compatible.
3. Inventory source and static test mark INV-003 safe only after the behavioral route contract passes.
4. Focused tests, full type-check, build, focused lint/regression comparison, and diff checks pass.
5. Independent review finds no unresolved P0/P1.
6. No deploy, production mutation, archive save, secret/binding, schema, lockfile, or migration action occurs.

## Run ledger

| Event | Evidence |
|---|---|
| Fresh canonical fetch | `origin/main` at `28ec2a9bed90503b1743a7f88bc1e4c19f92b1d3`; divergence `0/0` |
| Mirror fetch | `gitlab/main` is 29 behind/0 ahead |
| Primary checkout | clean `main` |
| Integration worktree | `/Users/sac/Git/researchtoolspy-wt-tools-analyze-integration`, branch `codex/scraping-tools-analyze-20260831` |
| Provider worktree | `/Users/sac/Git/researchtoolspy-wt-tools-analyze-provider`, branch `codex/scraping-tools-analyze-provider-20260831` |
| Route provider | joined as `a77e4c3e0`; provider source commit `e253ff9ae6d4fda52f37234813bb6719bfd82985`; corrections joined as `dbf006c4e` and `ccb74b311` from `7c648decd3f16dd09635f6d431f2a9a1f00e801c` and `77e50ea96004b0214ec8d5bcb16b225531bf5b76` |
| Provider verification | corrected suite 12/12; scraping-surface type-check; new spec lint clean; route lint 13 findings versus 18 at baseline; diff check clean; streaming test proves cancellation on first over-budget chunk |
| Review round 1 | blocked metadata compatibility, snapshot identity, and required deadline/oracle coverage; correction added regression tests without weakening the shared adapter |
| Review round 2 | no P0/P1; test-only correction records exact deadlines and proves early archive-stream cancellation |
| Integration install | `npm ci` installed the locked graph; npm reported the unchanged 16 audit findings (1 low, 4 moderate, 11 high) |
| Integrated focused tests | final 13-spec scraping suite passed 110/110 on Chromium with one worker |
| Integrated type-check | `npm run type-check` and the included scraping-surface check passed |
| Integrated build | `npm run build` passed with the existing large-chunk warning |
| Focused lint | new route/inventory specs passed; route has 13 inherited findings versus 18 at baseline, with no new finding over baseline |
| Final review | independent security and test-oracle reviewers found no P0/P1/P2 after corrections and recommended release |
| External mutation | none authorized or performed |

## Close decision

Accept INV-003 as a safety-foundation increment. Local evidence supports H-TA-FETCH-1, H-TA-ARCHIVE-1, and H-TA-COMPAT-1: caller and Wayback metadata requests use bounded policy enforcement, redirects and returned snapshot identity are constrained, credentials remain isolated, deadlines and streaming cancellation are behaviorally exercised, response compatibility is retained, and the read-like route performs no archive-save write.

This does not prove connection-time rebinding resistance without enforcing egress, third-party availability, or safety of the remaining inventory. INV-005 through INV-007 remain the next authenticated unsafe routes; public enrichment remains blocked on tenant-scoped service identity and abuse controls; social/repository providers require separate exact-parser and credential-boundary tranches.
