# Chunked stored extraction import release

Opened private [Timelines](https://researchtools.net/dashboard/tools/timeline) can now import passages beyond the stored prefix of larger Content Research extractions. The existing import flow verifies every chunk's size, index and hash, the parent prefix and the complete content hash before accepting one exact quote.

Accepted/deployed source: `f0a613b3ca9d1fd6c42cf82cda6eccc4cbbdf1c9`. Both main refs were pushed without force. Deployment `397e28ca-1e7b-4b37-a361-ecd0fe5019c3` serves [the accepted build](https://397e28ca.researchtoolspy.pages.dev); these receipts and API/roadmap changes are documentation-only follow-up.

The resolver reads parent metadata and a bounded chunk projection in one authorized database snapshot. It accepts canonical sets of 3–8 chunks, up to 409600 UTF-16 units and 512000 UTF-8 bytes. Partial, extra, malformed, oversized or inconsistent sets are rejected. Existing short-record behavior and the evidence wire format remain unchanged. Matching stored text does not certify source truth or create authenticated historical provenance.

Five type checks, 123 API/contract checks and 74 desktop/mobile browser checks passed, followed by frontend/worker builds and compiled production-schema rehearsal. Browser acceptance imported a quote at offset 112000, saved/reopened it and kept automatic draft bytes unchanged. The compiled worker also refused missing chunks and retained the recorded passage in existing human/service immutable snapshots.

Independent review accepted all 145 identical staged files; inventory SHA256 `d05d9a3cd82cf09dcc2baf3800ce6b18ffb6630b93d29d59baad079aca763b25`. Publishing used the prebuilt package with `--no-bundle`. Nineteen read-only live checks passed on each deployment/production URL. All 13 migration names and 386 catalog entries across 14 source/chunk/timeline/credential tables remain unchanged. No production D1 mutation, migration, source fetch, model call or credential change was performed.

The [JSON receipt](./2026-09-11-timeline-chunk-import-release-receipt.json) records exact fingerprints and recovery; [Timeline Artifacts](../api/TIMELINE-ARTIFACTS.md) documents bounds. The primary checkout was untouched and unqualified external worker lanes were not bypassed. Previous deployment `62e1c677-6c3c-434c-9c5f-1ff7ffed6e20` retains the unchanged evidence snapshots but cannot resolve chunked sources. Existing Vite large-chunk warnings remain.

**TL-04 remains partial.** Broader source-store support, dedicated judgment services and authenticated peer review remain pending.

## Subsequent deployment

The [source picker release](./2026-09-11-timeline-source-picker-release-receipt.md) adds explicit recent-title selection before the existing resolver. This receipt retains the historical chunk-import results; the newer receipt records the current deployment. TL-04 remains partial.
