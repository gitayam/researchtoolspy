# Scraping Foundation Tranche Charter

**Status:** in progress  
**Delivery class:** safety foundation  
**Canonical remote/ref:** `origin/main`  
**Fresh canonical SHA:** `3f0eba98e33f2e2077367acbd553309eceedccbd`  
**Recorded:** 2026-08-30, America/New_York

## Outcome

Make every server-side scrape entry point use a bounded, policy-enforced request contract, make the Workers code part of the repeatable TypeScript verification surface, and close the highest-risk ownership/idempotency correctness gaps before adding new rendering backends.

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
2. Every in-scope outbound fetch supplies a timeout and uses the shared safety contract.
3. A repeatable command type-checks the Pages Functions surface and catches unsupported request-option fields.
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
| Milestone branches/worktrees | recorded after isolated worktrees are created |
| Verification | recorded at tranche close with exact commands and observed outcomes |

