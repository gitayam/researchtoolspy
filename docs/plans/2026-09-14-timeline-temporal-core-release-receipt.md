# Calendar temporal core

The timeline now has a reusable internal calendar-claim parser and bounds helper, consumed by the existing timing review. It validates date, interval, relative and unknown claims while preserving recorded display text and precision. Existing date entry and timing-review behavior remain intact; this release adds no new UI.

Recorded units produce half-open calendar bounds. Interval endpoints are inclusive recorded units: overlapping mixed precision yields a conservative possible extent, never a certain duration. Definitely reversed endpoints are rejected. Relative and unknown claims remain unresolved rather than acquiring dates from workspace order. This is an internal foundation, not interval persistence, a public API or workspace/extraction v2. **TL-06 remains in progress**; versioned interval authoring is the next visible gate, with circa dates, clock mappings and extraction v2 pending. TL-17 remains partial and TL-13 planning is not delivered.

Accepted source `726efc7dece526ac254f3350c0c741a87f03c55e` is on both main refs and deployed as `2e00f37d-c550-47d1-ba55-9d6147d1d3be` at [the accepted build](https://2e00f37d.researchtoolspy.pages.dev). Exactly 77 distinct checks passed: 34 browser-project checks and 43 contracts, plus five type checks, frontend/worker builds and the compiled production-schema gate. The final focused cases count once. The [JSON receipt](./2026-09-14-timeline-temporal-core-release-receipt.json) records exact identities and evidence hashes; prior stage counts are historical, not current proof.

Seven new temporal contract tests accompany the existing timing, ordering, presentation, date-entry and backup checks. Existing device captures remain verified. Bounded native providers and independent review verified the final source, runtime and all 155 package files. No failed temporal-core-stage run was recorded.

Prebuilt publication used `--no-bundle`. Thirty read-only checks passed at each deployment and production URL. All 14 tables, 386 catalog rows, 13 migrations and secret names are unchanged. The entire public renderer tree, scripts, fonts, vendor assets, CSP and headers match the baseline; independent review and exact live owned-byte checks support omitting a fresh edge-script replay. No API or schema changes were introduced.

Previous deployment `f8accda7-42c2-4490-9aff-2a9906f3bc4b` reads the same saved formats and retains date entry, timing review, presentation and scheduling, but lacks the reusable calendar core. Visual review is representative, not exhaustive accessibility certification or user testing; the full unrelated API suite is not claimed. Primary checkout untouched.

## Subsequent deployment

The [local interval authoring release](./2026-09-14-timeline-interval-entry-release-receipt.md) adds recorded endpoints and local workspace/draft v2. Private interval saving and TimelineJS interval rendering remain unavailable. This receipt retains historical temporal-core validation.
