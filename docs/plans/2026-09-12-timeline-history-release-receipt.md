# Saved revision history

[Timeline](https://researchtools.net/dashboard/tools/timeline) now offers **Load revision history** after a successful private save/open. Revisions show their number, timestamp and full ID, newest first. **Load older revisions** reads 20 at a time, up to 100 in memory. Pagination stays pinned; **Refresh history** deliberately starts again at the current head.

**Inspect revision** validates its pinned browser snapshot before **Preview selected revision** offers presentation and exports. These actions do not replace the working timeline, change its save head or include unsaved edits. Scope changes clear history; unavailable or malformed revisions fail closed. The existing last-saved preview remains separate. No new API, schema, permission or public sharing is introduced. **TL-17 remains partial.**

Accepted source `c1fbfbfb4c43fe1d0df194913afd8cc8b8e4e095` landed on both main refs and deployed as `bf86e234-77eb-46a9-8dfe-a382e3c639bf` at [the accepted build](https://bf86e234.researchtoolspy.pages.dev). This is a documentation-only follow-up to that runtime.

Planned isolated regression partitions passed 54 browser checks (40 durable and 14 renderer/export), 19 contract checks (eight renderer, six adapter and 5 history) and five type checks, followed by frontend/worker builds and compiled actual-production-schema rehearsal. The full unrelated API suite is not claimed. Exact run identities, deduplicated completed cases and preserved failures appear in the [JSON receipt](./2026-09-12-timeline-history-release-receipt.json).

The first candidate passed focused checks. Visual review found that mobile captures obscured selected-preview controls, and the historical fixture had no exportable date. The owner stopped its broader run (11 completed cases, none counted), corrected only the test fixture and captures, and reran all accepted checks at the corrected source. Production code did not change.

All 155 staged files were independently compared; inventory SHA256 `9ed304f065bdd6022f8e6759fa8eed73409477f2c94b42cef946f3cba298b31b`. Prebuilt deployment used `--no-bundle`. Thirty read-only checks passed at each deployment/production URL, including exact owned renderer asset bytes. Renderer assets and headers are unchanged, so no new edge-browser replay was performed. All 13 migrations and 386 catalog entries across 14 tables remain unchanged; existing secret names are preserved.

Previous deployment `928c14a5-d9e7-4621-aa2f-76b7ac04fee7` reads identical data and previews the last saved/opened revision but lacks this history browser. Preserve snapshots and history. Primary checkout untouched; visual coverage is representative, not an exhaustive accessibility audit.
