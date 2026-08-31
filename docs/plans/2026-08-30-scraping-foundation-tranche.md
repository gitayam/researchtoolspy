# Scraping Foundation Tranche Charter

**Status:** implementation integrated; Milestone 0 remains in progress
**Delivery class:** safety foundation  
**Canonical remote/ref:** `origin/main`  
**Fresh canonical SHA:** `3f0eba98e33f2e2077367acbd553309eceedccbd`  
**Recorded:** 2026-08-30, America/New_York

## Outcome

Establish the first bounded outbound-request implementation, inventory the complete scraping surface, expand its repeatable Worker verification boundary, and close the highest-risk ownership/idempotency correctness gaps before adding new rendering backends. Full entry-point migration remains a follow-on Milestone 0 tranche.

## Non-goals

- Production deployment, remote D1 mutations, or secret changes.
- Browser Run, Scrapling, semantic extraction, job orchestration, or a provider marketplace.
- Analytics Engine dashboards and benchmark-corpus execution; those remain the next roadmap gates.
- Unrelated cleanup in the application or user-owned changes in the primary checkout.

## Contract freeze

- One shared outbound-request policy owns protocol, credential, host/address, redirect, timeout, body-size, and content-type checks.
- Redirects are followed manually and every hop is revalidated.
- Request options are explicit, typed, and backwards-compatible at API boundaries.
- Authentication-derived user identity is the only ownership identity trusted by protected routes.
- COP ingestion has a stable idempotency key enforced by the local schema.
- Public API response envelopes remain compatible unless a test demonstrates an existing contradiction.

## Ownership and join order

| Workstream | Owned paths | Prohibited overlap | Join order |
|---|---|---|---:|
| URL safety | `functions/api/_shared/safe-fetch.ts`, shared fetch callers, focused tests | auth/COP routes, project config | 1 |
| Worker contract | browser-profile/request types, `web-scraper.ts`, TypeScript/test config | shared safe-fetch primitive, auth/COP routes | 2 |
| Correctness | analyze-url auth path, COP scrape-run routes, migrations, focused tests | fetch primitive, build config | 3 |
| Integration | roadmap/charter, conflict resolution, repository-wide verification | user-owned script edits | final |

The integration owner may edit any tranche-owned file only to resolve seams or verification failures. The primary checkout's pre-existing `scripts/cop-api.sh` and `scripts/setup-defcon-cop.sh` modifications are explicitly out of scope.

## Observable exit gates

1. Tests reject loopback, private/link-local ranges, credential-bearing URLs, unsafe redirect hops, oversized bodies, and disallowed content types.
2. The web scraper and shared direct-HTML scraper use the bounded safety contract; the inventory identifies every remaining migration target without mislabeling it safe.
3. A repeatable command type-checks the inventoried scraping Functions surface and documents its three explicit exclusions.
4. Cross-user cached-result access is impossible in focused tests.
5. Repeating the same COP import is idempotent under a local disposable D1 database.
6. Root build/type-check/lint and focused tests pass, or pre-existing baseline failures are documented with exact commands.
7. No deployment or remote mutation occurs.

## Run ledger

| Event | Evidence |
|---|---|
| Fresh fetch | `origin/main` fetched and pruned; local/canonical divergence `0/0` |
| Merge base | `3f0eba98e33f2e2077367acbd553309eceedccbd` |
| Primary checkout | intentionally dirty; unrelated user script edits preserved |
| Integration worktree | `codex/scraping-foundation-20260830` at `/Users/sac/Git/researchtoolspy-wt-scraping-foundation` |
| URL-safety worktree | `codex/scraping-safe-fetch-20260830` at `/Users/sac/Git/researchtoolspy-wt-safe-fetch` |
| Worker-contract worktree | `codex/scraping-worker-contract-20260830` at `/Users/sac/Git/researchtoolspy-wt-worker-contract` |
| Correctness worktree | `codex/scraping-correctness-20260830` at `/Users/sac/Git/researchtoolspy-wt-correctness` |
| Baseline install | `npm ci` passed; npm reported 16 dependency audit findings (1 low, 4 moderate, 11 high) |
| Baseline type-check | `npm run type-check` passed |
| Baseline lint | `npm run lint` failed with 2,882 pre-existing repository findings (2,789 errors, 93 warnings) |
| Joined provider commits | URL safety `c9e03aa05`; Worker contract `18dc55d3a`; correctness `e73c68e70`; review corrections through `d45f6d99e` and `48374cae1` |
| Adversarial review | two independent read-only review rounds found and drove fixes for redirect credential replay, IPv6 gaps, workspace-role bypass, metadata poisoning, migration placement, paid-run replay, D1 statement budgets, and dataset auth/provenance |
| Focused tests | final integrated Playwright suite passed 46/46 on Chromium with one worker |
| Integrated type-check | `npm run type-check` passed, including `type-check:scraping-surface` |
| Integrated build | `npm run build` passed with the existing large-chunk warning |
| Focused lint | new policy, idempotency, inventory, and test files passed targeted ESLint |
| Full lint | remains at the baseline failure: 2,882 pre-existing findings; no repository-wide lint cleanup was attempted |
| Local migration | managed `0006_scraping_auth_idempotency.sql` passed in disposable local D1; no remote migration ran |
| External changes | no push, deploy, production migration, secret change, or remote service mutation |

## Close decision and remaining blockers

This tranche is accepted as a meaningful safety-foundation increment, but Milestone 0 is not deploy-complete:

1. Cloudflare's application fetch still resolves independently after DNS policy validation. Connection-time rebinding defense requires an enforcing egress service that resolves and connects to the same validated address.
2. Browser Renderer must enforce top-level, redirect, iframe, and subresource policy inside its own boundary.
3. The inventory contains 25 additional direct, delegated, renderer, provider, PDF, social, or archive paths that still need purpose-specific adapter migration.
4. The metadata-completeness field is still named `reliability_score`, raw-URL event-context replacement is not complete, and three scraping Function roots remain outside the focused type-check.
5. A crash after a paid-request reservation but before Apify run persistence leaves an `initiating` request requiring operator/provider reconciliation. Identical retries are blocked to prevent duplicate spend.

The next implementation tranche is the enforcing egress boundary plus direct/PDF/provider adapter migration. `SCRAPE-04` telemetry/log analytics follows against those stable contracts; it must include explicit metrics for policy denials, stuck paid-request reservations, duplicate prevention, and inventory coverage.
