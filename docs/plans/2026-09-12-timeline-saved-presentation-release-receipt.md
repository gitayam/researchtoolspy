# Saved-revision presentation

[Timeline](https://researchtools.net/dashboard/tools/timeline) now offers **Preview saved revision** for the last successfully saved or opened private timeline. The card identifies its revision number and full ID. Preview, TimelineJS presentation and both downloads use that retained version, excluding current unsaved edits. It may be older than the server head and remains in memory only.

Successful retries retain the original save attempt. Failed saves or reads retain the previous successful pair; workspace/account/deactivation changes clear it. No new API, schema, permission or public sharing is introduced. **TL-17 remains partial.**

Accepted source `13c2f284bb0e96d6a3f5a90114a2df715a0f2f0b` landed on both main refs and deployed as `928c14a5-d9e7-4621-aa2f-76b7ac04fee7` at [the accepted build](https://928c14a5.researchtoolspy.pages.dev). This is a documentation-only follow-up to that runtime.

Planned isolated regression partitions passed 48 browser checks (34 durable and 14 renderer/export), 14 renderer/export contract checks and five type checks, followed by frontend/worker builds and compiled actual-production-schema rehearsal. The full unrelated API suite is not claimed. Exact run identities, deduplicated completed cases and preserved failures appear in the [JSON receipt](./2026-09-12-timeline-saved-presentation-release-receipt.json).

The first run was deliberately stopped after 53.18 seconds when a late test-provider fixture correction arrived after the initial commit. No failing product assertion had occurred; four completed old-source cases are not counted. The test-only correction explicitly selects the dated event and adds workspace cleanup assertions. All accepted regression and build evidence is bound to the corrected source.

All 155 staged files were independently compared; inventory SHA256 `5b608dd994f94d3ac9d47da1f9e424b42e111d9461fd964f20b3956ca4d1d18a`. Prebuilt deployment used `--no-bundle`. Thirty read-only checks passed at each deployment/production URL, including exact owned renderer asset bytes. Renderer assets and headers are unchanged, so no new edge-browser replay was performed. All 13 migrations and 386 catalog entries across 14 tables remain unchanged; existing secret names are preserved.

Previous deployment `9d1d77c6-7225-4980-81f0-c24d7c8df0c7` reads identical data but lacks saved-revision presentation. Preserve snapshots and history. Primary checkout untouched; visual coverage is representative, not an exhaustive accessibility audit.
