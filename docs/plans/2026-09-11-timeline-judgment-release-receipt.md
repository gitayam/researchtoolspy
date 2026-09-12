# Timeline analytic judgment and dissent release

Scoped analytic judgments and retained dissent are deployed at [ResearchTools Timeline](https://researchtools.net/dashboard/tools/timeline). Analysts can record reasoning, assumptions, alternatives and change indicators; cite events and supporting/contrary assertions; and state qualitative likelihood separately from analytical confidence. Judgment revisions preserve earlier review snapshots and dissent.

Accepted/deployed source: `4ff6a092a8923f22910312c49f9f856d24c0707b`. Both main branches were pushed without force and confirmed at that SHA. This receipt and API/roadmap changes are documentation-only follow-up. The upstream analytics and header changes at baseline `5951f7a1f5f6de2af97f2eeb109e87162f29d245` remain intact.

## Review and persistence

Relevant cited-input changes produce an explicit stale-judgment notice. Saving a judgment records the new input basis with a required change reason; withdrawal/restoration also requires a reason. Reviews/dissent retain the complete judgment they addressed, including its earlier input basis. An open review draft remains tied to its opening judgment version, with a mismatch notice and submission guard when that version changes.

Deleting an event cited by any current judgment, including a withdrawn one, is blocked before related state changes. Analysts can first edit references; older references inside retained historical review snapshots remain intact. Local drafts, downloaded JSON, Markdown, and existing private human/service workspace saves preserve the records. No standalone judgment route or new object kind was introduced.

Reviewer labels are self-attributed, not verified peer identity or sign-off. The UI retains reviews without edit/delete controls; it does not impose append-only permissions on authorized clients replacing complete snapshots. Earlier saved workspace revisions remain immutable. Likelihood uses a local qualitative vocabulary, not a calibrated numerical probability; confidence is never derived from source count.

## Acceptance and production

- Five TypeScript checks, 109 API/contract tests and 66 Chromium/mobile-Safari checks passed on the exact accepted source. Browser coverage includes editing, stale inputs, frozen review drafts, retained dissent, guarded deletion, reference changes, actual downloaded-byte imports, Markdown and draft recovery. Desktop/mobile rendered views were inspected.
- Vite and Pages Functions builds passed. Compiled human/service save/reopen/replay retained complete judgment/dissent snapshots against a fresh production-schema export. All 12 timeline/credential table catalogs stayed unchanged after the route rehearsal, with zero pending migrations and zero compiled-worker outbound attempts.
- Independent review accepted source, runtime isolation and all 145 identical build/staging files. Package inventory SHA-256: `f2995233ec5bca0354d945e7d7060f2a566f43e76c261cb379d030f193233262`.
- Deployment `da6b9380-ba08-485f-bf65-6d5de2eefd6b` serves [the accepted build](https://da6b9380.researchtoolspy.pages.dev); publication used the reviewed prebuilt package with `--no-bundle`.
- Seventeen readonly checks passed on each deployment/production URL, including exact asset hashes, unauthorized reads, CORS, anonymous capability discovery and malformed service-token rejection. All existing secret names, including product telemetry, remain present. Live probes made no authenticated content writes or model calls.
- No production D1 mutation or migration was performed. All 13 migration names and 282 schema details across 12 tables remain unchanged and match rehearsal.

Full fingerprints and states are in the [JSON receipt](./2026-09-11-timeline-judgment-release-receipt.json). The wire contract and limits are in [Timeline Artifacts](../api/TIMELINE-ARTIFACTS.md).

## Corrections and remaining work

The initial schema export returned an authentication error; reads and export retry succeeded. Initial browser failures matched multiple upstream guest-banner alerts; selectors were scoped. Independent review caught the review-draft retargeting issue. A missing TypeScript assertion signature and a legacy narrative-title selector that matched the new judgment heading were corrected before the complete successful run. Passing the full event list explicitly to Markdown is defensive; the earlier suspicion of an existing filtered-export bug was not confirmed. One attempted rerun reused the previous source snapshot and was stopped; the archive was refreshed and its source verified before final validation. Existing Vite chunk-size warnings remain.

The primary checkout was untouched. External authenticated worker lanes remain unqualified and were not bypassed. Previous deployment `a7bc3a1c-44ad-4cbf-bc53-d880fac3fd56` supports evidence but rejects the new optional analysis field. Prefer compatible recovery and preserve judgment/dissent/evidence snapshots and immutable history; do not strip new fields to satisfy an older codec.

**TL-04 remains in progress.** Verified source-store import, dedicated judgment services and authenticated peer-review semantics remain separate work, along with the later structured-analysis roadmap. No cross-product handoff or later checkpoint is claimed.

## Subsequent deployment

The [stored-source import release](./2026-09-11-timeline-source-import-release-receipt.md) adds exact passage import from complete owned Content Research extractions into opened private timelines. Its receipt records the current deployment and checks; this document remains the historical judgment/dissent release. TL-04 is still partial.
