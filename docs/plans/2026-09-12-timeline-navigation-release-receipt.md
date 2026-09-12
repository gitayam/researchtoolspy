# Timeline presentation search and jump

[Timeline](https://researchtools.net/dashboard/tools/timeline) now lets readers search the presentation's native event list by title, recorded date and displayed text, clear the query and use **Show in presentation** to jump by stable event ID. No-results feedback is explicit. Search changes list visibility only; selection, slide membership, chronology and exports remain unchanged.

Query and disclosure survive theme/start/retry frame replacement; old jump commands do not replay. The native list remains usable if rendering fails, while jump actions wait for successful loading. The existing isolated self-hosted renderer and 100-event bound remain; no public publishing service is added.

Accepted source `ae238e63ed03b103553491a6f10b8fd4a672cdf8` landed on both main refs and deployed as `9d1d77c6-7225-4980-81f0-c24d7c8df0c7` at [the accepted build](https://9d1d77c6.researchtoolspy.pages.dev). These documents are a documentation-only follow-up; runtime stays at that source.

At this exact source, the initial bounded run completed five type checks and 163 API/contract checks before timing out during mobile browser execution. A second isolated run reran the interrupted and remaining suites and produced fresh frontend/worker builds and compiled actual-production-schema rehearsal. Matching completed cases by file, line, column and project against the explicit 106-case inventory establishes all 106 browser checks (53 per project) across the two runs; no single full-green run is claimed. Eight renderer contracts and focused browser flows cover search, clear, no match, duplicate titles, partial dates, stable-ID jumps, invalid/stale messages, replacement frames and preservation. Captured production HTML and headers also passed isolated Chromium/WebKit replay including stable-ID jump and blocked edge scripts.

All 155 staged files were independently compared; inventory SHA256 `52cd03af6c4daf0066dfde36aed662ec6a3eaefd561e54f375e5c58a42a97935`. Prebuilt publication used `--no-bundle`. Thirty read-only checks passed at each deployment/production URL, checking eight raw renderer assets and exact owned shell bytes with only CSP-blocked Cloudflare additions. All 13 migrations and 386 catalog entries across 14 tables remain unchanged. No API, schema, header, dependency or permission changes were introduced.

The [JSON receipt](./2026-09-12-timeline-navigation-release-receipt.json) records source-bound validation, recovery, visual limits and live replay fingerprints. Previous deployment `971c8e13-acd6-4f1c-bc55-5829ac10c2af` reads identical data but lacks these navigation controls. Preserve saved snapshots and history. Primary checkout untouched; representative screenshots are not an exhaustive accessibility audit.

**TL-17 remains partial:** immutable authorized publication/revocation and richer snapshot types remain pending. **TL-04 remains partial:** RSS coverage and broader source stores remain pending.

## Subsequent deployment

The [saved-revision presentation release](./2026-09-12-timeline-saved-presentation-release-receipt.md) adds preview and export of the last successfully saved/opened snapshot. This receipt retains historical navigation validation; the newer receipt records the current deployment.
