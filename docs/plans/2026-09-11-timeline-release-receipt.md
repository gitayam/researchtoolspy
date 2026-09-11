# Timeline stage release receipt

Later complete browser snapshot saving and migration 0012 are recorded in the [browser release receipt](./2026-09-11-timeline-browser-release-receipt.md). This receipt preserves the earlier stage.

TL-00 and TL-02 are released on [researchtools.net](https://researchtools.net/dashboard/tools/timeline). The human-only TL-03 artifact/revision API is deployed; full TL-03 remains in progress until scoped service access and durable browser integration pass acceptance.

Accepted source: `6e832e734b0e28d7fe189c5b76d6e68112fe894d`. GitHub `origin/main` and GitLab `gitlab/main` were fast-forwarded to this exact SHA and confirmed remotely. The primary dirty checkout was preserved. This receipt and availability updates form a documentation-only follow-up; the deployed source remains the accepted SHA.

## Verification

Five TypeScript checks, 86 API/contract tests, 42 Chromium/mobile Safari checks, the production Vite build and Pages Functions bundle passed on `9e886806975ca2d029ff2b012ec101588708e282`. Its final release verifier rejected Cloudflare's schema-only sequence-reset directive. The accepted follow-up changes only that verifier to record and skip the exact `DELETE FROM sqlite_sequence` directive, while rejecting arbitrary DML.

Targeted sandbox validation of the corrected verifier passed against the actual schema-only production export and migration 0011. It exercised compiled create/commit/history routes, workspace and human/service authorization, exact retry replay, stale heads, real D1 rollback, immutable history and static fallback. Application/build inputs are unchanged; all 145 artifact files match the original build. Independent review accepted source and validation inheritance at the exact accepted SHA.

Builds and candidate execution ran in a credential-free, network-disabled container. Production data backups and authentication were never mounted there. Only the schema-only export and migration names were supplied. No external outbound attempts occurred. The existing Vite large-chunk warning remains.

## Production result

- Managed migration `0011_timeline_foundation.sql` applied successfully; no migrations remain pending.
- All nine affected tables and 218 column, foreign-key, index, trigger and definition records match rehearsal; all 23 baseline schema checks still pass.
- A restricted full database backup and Time Travel bookmark were recorded before application. Backup contents and signed URLs stay private.
- Pages deployment `559225c0-4529-49ae-b02b-71cb21058c34` serves [the accepted release](https://559225c0.researchtoolspy.pages.dev) from branch `main`, source `6e832e734b0e28d7fe189c5b76d6e68112fe894d`. Publisher used the prebuilt package with `--no-bundle` from staging without Functions source.
- Fifteen read-only checks passed on each of the deployment and production URLs, including HTML asset references, exact asset hashes, timeline route authentication and conditional-write CORS headers. Production checks made no content writes or model calls. Required secret names remain present.
- Unrelated Workers and Signal/RSS were not deployed.

Whole-package manifest SHA-256: `7a3db65c3ee8a15a4e2af5d7962a54396c29a5e856ecf18a3c8aa1b9981b01fe`. Structured hashes, command summaries, distinct release states and smoke checks are in the [JSON receipt](./2026-09-11-timeline-release-receipt.json).

Application rollback target is deployment `50bfb755-827f-4879-901e-473035118f9e`. Retain additive timeline tables and immutable history when reverting application code; never automatically restore the whole database.

## Remaining delivery

Scoped service access and durable browser saving remain pending within TL-03. TL-01 and TL-04–TL-18 are not released. The [implementation register](./2026-09-11-timeline-implementation-register.md) retains their full acceptance criteria.
