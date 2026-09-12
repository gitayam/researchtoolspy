# Timeline evaluation input comparison release

[Timeline evidence](https://researchtools.net/dashboard/tools/timeline) now includes **Compare evaluation inputs**. Analysts can see recorded and current claim wording, quotations, locators, source details, clocks and complete assertion ancestry. Changed fields and added/removed input records are labeled explicitly; missing dates remain unrecorded. The disclosure is available in Analyst and Narrative evidence panels.

The comparison matches stable IDs and validates both input snapshots. Opening it never renews an evaluation or changes exports, private draft bytes or saved content. It displays analyst-entered snapshots, not authenticated source truth or a reconstruction of past knowledge. Added/removed labels describe input membership, not deletion of evidence.

Accepted/deployed source `413422cc85de256510538df410c5e60b74870b3b` landed on both main refs without force. Deployment `05666348-d3b1-44ad-ae6c-e619112ab047` serves [the accepted build](https://05666348.researchtoolspy.pages.dev); this receipt and roadmap changes are documentation-only follow-up.

Five type checks, 134 API/contract checks and 84 desktop/mobile browser checks passed, followed by frontend/worker builds and actual production-schema compiled rehearsal. Focused browser checks exercise keyboard disclosure, old/current publisher and claim text, removed and newly selected ancestors, retracted inputs, absent dates, private save/reopen and unchanged exports/draft bytes. Representative light/dark desktop/mobile source comparison captures were reviewed; they hide fixed app chrome and descendants only during capture and do not constitute an exhaustive accessibility audit.

Independent review compared all 146 staged files; inventory SHA256 `4a34444534bcf61b58324b237efe1c256a9c0e5348652efa1c92e36bfa7e674b`. Publishing used `--no-bundle`. Twenty-one read-only checks passed on each deployment and production URL. All 13 migration names and 386 catalog entries across 14 tables remain unchanged. This stage changes no backend route, schema, snapshot payload or permission.

The [JSON receipt](./2026-09-12-timeline-evaluation-inputs-release-receipt.json) records fingerprints and recovery. Previous deployment `5eaf67bd-31a6-440f-80d1-cb54e366b8ac` supports identical evaluation data but lacks this comparison. Preserve saved snapshots and immutable history. Existing size limits and Vite large-chunk warnings remain. Primary checkout untouched.

**TL-04 remains partial.** Broader source-store support, authenticated peer review and dedicated judgment services remain pending.

## Subsequent deployment

The [epistemic types release](./2026-09-12-timeline-epistemic-types-release-receipt.md) separates assertion classification from status and includes classification in recorded/current inputs. This receipt retains historical comparison evidence; the newer receipt records current deployment.
