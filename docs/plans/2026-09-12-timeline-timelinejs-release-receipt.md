# TimelineJS selected-narrative export release

[Timeline](https://researchtools.net/dashboard/tools/timeline) now offers **Export TimelineJS** from either view. The preview shows exportable, selected and omitted event counts, explains losses and downloads a matching complete ResearchTools backup. Both files use the same captured open workspace, including unsaved edits. Changed inputs disable both downloads until refresh.

Only selected events with recorded absolute dates are eligible. Year/month/day precision is retained without invented date parts. Unknown, relative and position-only events are listed as omitted; recorded wallclock times identify the narrative timezone without conversion. TimelineJS sorts chronologically, so narrative order may change and transitions are omitted. HTML-facing text is escaped and autolinking disabled; chapters become distinct flat groups, without fabricated eras or media. Qualified assessments remain explicit.

The [official JSON format](https://timeline.knightlab.com/docs/json-format.html) informed the adapter. This release checks the documented output shape and actual downloaded bytes; it does not install or validate a TimelineJS renderer. The presentation cannot restore a workspace. The companion preserves the complete workspace, including unselected/private records and evidence/review history.

Accepted/deployed source `86202310b3f9e4b0a95487a88850b14d822346c3` landed on both main refs without force. Deployment `d1a610f0-3876-4381-82ac-685730dfd32b` serves [the accepted build](https://d1a610f0.researchtoolspy.pages.dev); these receipts and roadmap changes are a documentation-only follow-up.

Five type checks, 155 API/contract checks and 98 desktop/mobile browser checks passed, followed by frontend/worker builds and actual production-schema compiled rehearsal. Six adapter cases cover selection, dates/times, omitted placement, identities/groups, hostile markup and unchanged inputs/qualified assessments. Browser checks cover matching downloaded files, disabled empty exports, stale-preview refresh, private history preservation and representative light/dark desktop/mobile dialog captures.

Independent review compared all 146 staged files; inventory SHA256 `cfb96858244a99c447c97db0de7fe7c590453cde1beba9e79d4836f5a8b5969d`. Publishing used `--no-bundle`. Twenty-one read-only checks passed on each deployment and production URL. All 13 migration names and 386 catalog entries across 14 tables remain unchanged. No API, snapshot schema, migration, credential or permission change was required.

The [JSON receipt](./2026-09-12-timeline-timelinejs-release-receipt.json) records fingerprints and any failed attempts. Previous deployment `58710a88-8e09-4c96-9aed-e7233a6d2d32` reads identical snapshots but lacks TimelineJS export; preserve saved data and immutable revisions. Existing size limits and Vite large-chunk warning remain. Visual review is representative, not an exhaustive accessibility audit. Primary checkout untouched.

**TL-17 remains partial.** A pinned/self-hosted renderer, immutable authorized publication/revocation, richer narrative/composite/plan/comparison snapshots and their dependencies remain pending. TL-04 RSS coverage and broader source stores also remain pending.

## Subsequent deployment

The [self-hosted renderer release](./2026-09-12-timeline-renderer-release-receipt.md) adds optional isolated presentation with the same snapshot format. This receipt retains historical export evidence; the newer receipt records current deployment.
