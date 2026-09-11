# Timeline browser snapshot release

Complete browser timeline saving is live at [Timeline Analysis](https://researchtools.net/dashboard/tools/timeline). Sign in, choose a private saving workspace, then use **Save timeline**. Keep the saved link to reopen on another device. A snapshot preserves narrative, notes, source extraction, original event data and stable IDs. This slice supports 60 KiB snapshots; larger local timelines remain editable/exportable and are rejected before upload without truncation.

Accepted/deployed source: `2960d0da8594c6498c008bdb9450c0d1561257f5`. Both GitHub `origin/main` and GitLab `gitlab/main` were fast-forwarded and confirmed at that SHA. The commit containing this receipt and availability updates is a documentation-only follow-up; it does not represent a different runtime deployment. The primary dirty checkout remains untouched.

## Acceptance

All five TypeScript checks, 90 API/contract tests, 54 browser-project checks, Vite build and compiled Pages Functions passed on `dcd406e40442e57b016b219c08f63e53ba48ebb6`. Chromium and mobile Safari exercised the UI through actual D1 route handlers, including save/reopen/downloaded-byte round trips, lost create/commit responses, refreshed credentials with exact retry keys/body/head, stale conflicts, malformed reads, explicit copies, oversize rejection without requests, guest restriction, eligibility loss and preserved local drafts. Desktop/mobile screenshots were inspected.

The catalog-preservation verifier passed at `6339605e4eb249c01ba5c102a64c402ee4f30d36` against the same byte-verified artifact and actual production-schema export. The final source then corrected browser eligibility for D1 numeric inactive values. Application TypeScript and all 12 durable-browser project checks passed again, testing both `false` and `0`, followed by fresh Vite/Functions builds and guarded schema/compiled HTTP/static/catalog checks. The unchanged 90 API checks, other 42 browser checks and remaining four type checks inherit the full run.

Both reviewers accepted their source/runtime boundaries. All 145 initial original/rehearsed files were independently rehashed; the owner verified the final fresh package against staging. Builds ran without credentials or external network; only schema-only SQL and applied migration names entered the validator. The final rehearsal uses the frozen pre-0012 export; production migration was not repeated.

## Production result

- Migration `0012_timeline_workspace_snapshots.sql` applied through the managed mechanism. Applied 0011 was unchanged.
- All nine tables and 219 schema details match rehearsal; every prior catalog object is preserved. All 23 baseline checks pass, migration-time row counts are unchanged, and no rebuild backup tables remain.
- Populated upgrade tests additionally prove exact old-history preservation and rollback of an injected failure midway through the table rebuild. Production timeline tables were empty at the migration boundary.
- A restricted full database backup and Time Travel record were captured before application; only their redacted hashes are retained here.
- Pages deployment `5b0ac276-e52e-4436-9cf9-a4ba5a421a5c` serves [the accepted build](https://5b0ac276.researchtoolspy.pages.dev) on branch main. The authenticated publisher uploaded the prebuilt package using `--no-bundle` from staging without Functions source.
- Fifteen read-only checks passed on each deployment/production URL: asset references and exact asset bytes, timeline authentication and conditional-write CORS. Required secret names remain present. No production content writes or model calls were used as probes.
- The initial `6339605` release URL briefly returned 404, then passed all checks. The final corrected deployment passed all 15 checks on both URLs. No rollback was needed.

Package manifest SHA-256: `035b034fc639b977fa60ece8f00b81547d8ff15bbf2cae62a030b0c25ca12d64`. Exact hashes, states, migration evidence and check records are in the [JSON receipt](./2026-09-11-timeline-browser-release-receipt.json). Initial test-harness routing and TypeScript integration failures were corrected; the existing Vite large-chunk warning remains.

## Limits and recovery

Full TL-03 remains in progress: scoped external-service access is still pending. The [implementation register](./2026-09-11-timeline-implementation-register.md) retains the remaining checkpoints. No Signal/RSS or unrelated Worker release is included.

Snapshots use one immutable typed object through the existing revision/manifest mechanism. Saving is explicit; stale heads preserve the open edits, and lost-response retries use the original operation. Opened private content stays in memory and clears on identity/workspace eligibility changes without overwriting the earlier local draft.

Application rollback target: `459ebfb8-6231-46b3-b452-8e73b4d3a5af`. That previous application supports snapshots but lacks the numeric-inactive cleanup correction. Preserve all stored history and restore a compatible application; do not narrow the schema, delete snapshots or automatically restore the whole database.
