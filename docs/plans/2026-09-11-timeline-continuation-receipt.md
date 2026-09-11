# Timeline continuation delivery receipt

Later publication and deployment are recorded in the [release receipt](./2026-09-11-timeline-release-receipt.md). This receipt preserves its original local-validation state.

2026-09-11. Local branch `work/timeline-foundation-20260911`; primary checkout
preserved. No push, deployment, production migration, service provisioning or flag
change occurred.

The independently reviewed and fully verified implementation is
`38a049d2c68d0b01baa089b565ec4aeaa74d3529`, based on foundation receipt tip
`110184fd854951e38072ff30c120604a19376512`. Later commits contain documentation only.
Independent source reviewer: `validator_review`; API documentation was separately
accepted at `d3694f2329dcfb06f4e0708801f9be67990fd5ea`.

## Delivered and verified locally

TL-02 browser acceptance is complete. Actual downloaded-byte export/import and
recovery checks pass in Chromium and mobile Safari. Tests use the actual mobile
analysis drawer; the long editing journey has a larger total timeout while retaining
all assertions and their existing timeouts. Desktop/mobile screenshots were inspected.

The first TL-03 slice adds private human-authenticated artifact creation, one default
branch, stable event-candidate IDs, immutable versions/history, atomic conditional
revision commits, exact idempotency replay and pinned pagination. Authorization is
checked again within write transactions. Published history rejects append/update/
replace attacks; tombstones cannot be bypassed by selecting old versions. See the
[API reference](../api/TIMELINE-ARTIFACTS.md) and [charter](./2026-09-11-timeline-durable-charter.md).

| Final verification at the implementation SHA | Result |
| --- | --- |
| App, functions, workers, scraping and example TypeScript | All five passed |
| Existing extraction/service and new durable API contracts | 86 passed |
| Chromium and mobile Safari timeline suites | 42 passed |
| Vite production build | Passed; existing large-chunk advisory |
| Actual managed migrations 0001–0011 and seeded 0010→0011 upgrade | Passed in Miniflare D1 |
| Independent source review | Accepted; no blockers |

The owner ran `node scripts/verify-timeline.mjs` in a digest-pinned Playwright 1.60
Linux arm64 container with no external network, capabilities, host credentials or
Docker socket. Source and dependencies were read-only; caches/reports/build output
had dedicated writable locations. The strict boundary canary passed. Dependency
preparation used the lockfile and `npm ci --ignore-scripts` in a separate credential-free
container. The [machine receipt](./2026-09-11-timeline-continuation-receipt.json) includes
exact invocation, image/archive/instruction/runtime/log fingerprints and exit code.
Raw logs, traces, screenshots and migration-hash attachments remain private under
the validator output directory.

## Limits and next work

TL-03 remains a partial checkpoint: service-token scopes/discovery and durable
browser/consumer integration are not implemented. The new artifact API does not
turn the current browser-local workspace into a saved cloud workspace. User and
workspace deletion is restricted by durable references; retention workflows remain
outside this slice.

D1 tests invoke the actual handlers against Miniflare's real D1 binding. Migration
rehearsals apply the actual SQL with explicit synthetic prerequisite tables and
seeded records, not a production-equivalent database catalog. A production-equivalent
rehearsal requires the current schema and applied migration names/hashes. No live
provider, deployed HTTP, or production mutation is claimed.

TL-01 still needs RSS/Signal source-count, importance and build/open/refresh alignment;
read-only recon identified count-as-corroboration and importance-as-narrative-role
labels. That monorepo has its own GitLab-canonical policy and was not edited here.
TL-04 through TL-18 remain pending.

## Recovery and routing notes

The Linux container resolved macOS download/WebKit failures. The first container
attempt exposed a read-only Playwright output-directory issue; dedicated output
configuration fixed it. Real mobile runs exposed desktop-only test navigation and
an insufficient overall budget for the full editing journey. No download assertions
were replaced or skipped. Type checking caught an explicit TextDecoder option, and
the migration test parser caught a missing helper brace; both were corrected before
the final green run.

Native cooperative editors stayed within file ownership and did not run candidate
scripts. The integration owner committed and validated; independent review prompted
published-history seals, replacement guards and tombstone-reuse protection. Start
future browser verification in the qualified container. Keep this successful native
routing; external Claude/Vibe dispatch remains unqualified and was not bypassed.
