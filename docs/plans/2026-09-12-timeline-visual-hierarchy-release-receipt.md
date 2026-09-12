# Timeline visual hierarchy and navigation release

[Timelines](https://researchtools.net/dashboard/tools/timeline) now use stronger event cards and date anchors, teal evidence panels, amber questions/gaps, violet judgments and dissent, indigo narrative controls and a slate private-saving panel. Icons and labels distinguish the types without implying that evidence or claims are verified. The sequence precedes long advanced editors; a workspace navigation bar leads to events, judgments and narrative work.

Implementation also continued with **Find an event**, which filters contents links by title/date wording while leaving the complete sequence visible. Native stable links and keyboard focus are preserved. Search is transient UI state; it does not alter timeline data, exports or private draft bytes.

Accepted/deployed source: `0c64396a39878a79644ead4d412423fdea0ece2a`. Both main refs were pushed without force. Deployment `3774773e-7dc2-4dd1-8ca5-5b134119c842` serves [the accepted build](https://3774773e.researchtoolspy.pages.dev); these receipts and roadmap changes are documentation-only follow-up.

Five type checks, 128 API/contract checks and 80 desktop/mobile browser checks passed, followed by frontend/worker builds and compiled production-schema rehearsal. Representative private fixtures cover mixed known/unknown dates, questions, evidence and retained dissent. Light/dark desktop/mobile screenshots were reviewed, with keyboard section navigation, native event links, complete-sequence preservation and no horizontal page overflow. Full viewport captures include app chrome; tall component captures omit sticky/fixed chrome only during capture. Review covers representative states, not all expanded editors or an instrumented contrast audit. Existing global mobile navigation and the floating widget still overlay viewport edges.

Independent review accepted all 146 identical staged files; inventory SHA256 `a48cd10003bf651a872ac44cf30ed7d91aaf663b6fcbc29761ffaf1354bf193d`. Publishing used `--no-bundle`. Twenty-one read-only live checks passed on each deployment/production URL. All 13 migration names and 386 catalog entries across 14 source/chunk/timeline/credential tables remain unchanged. This stage changes no backend API, schema, credentials or storage contract.

The [JSON receipt](./2026-09-12-timeline-visual-hierarchy-release-receipt.json) records fingerprints, visual evidence and recovery. Previous deployment `096a53e4-549a-4750-9c6f-8ac107053a44` retains identical data/APIs but lacks this visual/navigation update. The primary checkout was untouched. Existing Vite large-chunk warnings remain.

**TL-04 remains partial.** Broader source-store support, dedicated judgment services and authenticated peer review remain pending. This release improves the existing workspace and navigation; it does not claim completion of later roadmap checkpoints.
