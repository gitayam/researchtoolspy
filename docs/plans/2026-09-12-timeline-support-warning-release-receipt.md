# Timeline final-support warning release

[Timeline](https://researchtools.net/dashboard/tools/timeline) now warns before a change removes the final active support from an event with a saved corroborated assessment. Analyst and Narrative editors list all affected events, including shared assertions and downstream ancestry outside the current view. Already-stale corroborated assessments are included.

**Keep support** and Escape cancel without changing data. **Apply change** confirms the reviewed operation; if evidence or event context changed while the dialog was open, nothing is applied and a retry notice appears. Confirmed changes preserve saved assessments and earlier reviews, while the existing display qualifies corroboration as needing review. Losing one of several supports can require renewed review without triggering the final-support warning. No source-truth inference or automatic review renewal occurs.

Accepted/deployed source `aeefb10128f58f7cb973638290b0fa53a18e4a16` landed on both main refs without force. Deployment `9ded586f-b693-44c6-8dee-bb4014ef9170` serves [the accepted build](https://9ded586f.researchtoolspy.pages.dev); these receipts and roadmap changes are documentation-only follow-up.

Five type checks, 144 API/contract checks and 90 desktop/mobile browser checks passed, followed by frontend/worker builds and actual production-schema compiled rehearsal. Focused checks cover direct/shared/transitive support loss, derivation changes, stale assessments, remaining support, cancellation JSON identity, relation/retraction/unlink, stale context refusal, private save/reopen, immutable prior versions and access-loss cleanup. Representative light/dark desktop/mobile warning captures were independently reviewed; this is not an exhaustive accessibility audit.

Independent review compared all 146 staged files; inventory SHA256 `b8365236594a244f1a3b8064e98a3f05665670770d009384b2f1489fdb60c0de`. Publishing used `--no-bundle`. Twenty-one read-only checks passed on each deployment and production URL. All 13 migration names and 386 catalog entries across 14 tables remain unchanged. No API, snapshot schema, migration, credential or permission change was required.

The [JSON receipt](./2026-09-12-timeline-support-warning-release-receipt.json) records fingerprints and recovery, including the corrected test-harness import. Previous deployment `efc6c3f1-700b-4bbc-b63a-d1e91334cd9a` reads identical snapshots but lacks this warning; preserve saved data and immutable revisions. Older pre-epistemic codecs remain incompatible with classified snapshots. Existing size limits and Vite large-chunk warning remain. Primary checkout untouched.

**TL-04 remains partial.** Broader source-store support, handling/export policy, authenticated peer review and dedicated judgment services remain pending.

## Subsequent deployment

The [compact source coverage release](./2026-09-12-timeline-source-coverage-release-receipt.md) adds read-only event summaries with the same snapshot format. This receipt retains historical warning evidence; the newer receipt records current deployment.
