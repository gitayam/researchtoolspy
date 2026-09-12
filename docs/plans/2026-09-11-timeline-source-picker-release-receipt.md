# Recent stored source picker release

Opened private [Timelines](https://researchtools.net/dashboard/tools/timeline) can explicitly load up to 20 recent owned complete Content Research records and select an analysis ID by title. Manual ID entry remains available. The existing exact-quote preview and recheck are still required before import; listing does not verify extraction integrity or source truth.

Accepted/deployed source: `c282fcbb0d9170aa882fee0cd308305a7afd962e`. Both main refs were pushed without force. Deployment `096a53e4-549a-4750-9c6f-8ac107053a44` serves [the accepted build](https://096a53e4.researchtoolspy.pages.dev); these receipts and API/roadmap changes are documentation-only follow-up.

The metadata-only endpoint returns sanitized title prefixes and positive analysis IDs, newest ID first, under one final current-human/private-workspace/write/record-owner query. Titles are projected to at most 200 SQLite codepoints, items are limited to 20 and JSON to 65536 bytes. Accessible empty workspaces return an empty list; inaccessible workspaces return 404. No source text, URLs, hashes or chunk data are returned. This is a recent-ID list, not a claim about publication time.

Five type checks, 128 API/contract checks and 78 desktop/mobile browser checks passed, followed by frontend/worker builds and compiled production-schema rehearsal. Browser acceptance selects a long source by title, imports a quote beyond the stored prefix, saves/reopens it and preserves draft bytes. Delayed lists after sign-out or manual-ID edits cannot restore private titles or overwrite the edited ID. Malformed and oversized replies fail closed.

Independent review accepted all 145 identical staged files; inventory SHA256 `e28b3a1b02ee98aee651f0d74b2df90473268d32530950fb662e5f933dbd8857`. Publishing used the prebuilt package with `--no-bundle`. Twenty-one read-only live checks passed on each deployment/production URL. All 13 migration names and 386 catalog entries across 14 source/chunk/timeline/credential tables remain unchanged. No production D1 mutation, migration, source fetch, model call or credential change was performed.

The [JSON receipt](./2026-09-11-timeline-source-picker-release-receipt.json) records exact fingerprints and recovery; [Timeline Artifacts](../api/TIMELINE-ARTIFACTS.md) documents the endpoint. The primary checkout was untouched and unqualified external worker lanes were not bypassed. Previous deployment `397e28ca-1e7b-4b37-a361-ecd0fe5019c3` retains manual-ID short/chunk import but lacks this picker. Existing Vite large-chunk warnings remain.

**TL-04 remains partial.** Broader source-store support, dedicated judgment services and authenticated peer review remain pending.
