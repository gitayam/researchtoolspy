# Timeline source assertion release

The first TL-04 slice is deployed at [ResearchTools Timeline](https://researchtools.net/dashboard/tools/timeline). Analysts can record source-specific claims, quote/locator snapshots and temporal wording; link supporting, contrary or contextual assertions; record derivation; and retract or restore assertions. Existing local drafts, JSON exports and private immutable workspace saves retain this evidence.

Accepted/deployed source: `d9baedaec8ddff3a673199a2f4041c240c0ebf2b`. Both main branches were pushed without force and confirmed at that SHA before deployment. This receipt and API/roadmap updates are a documentation-only follow-up.

## Review behavior

New corroboration requires active support from two disjoint complete recorded source lineages, no active contradiction, and a current analyst review of independence and compatibility with rationale. Shared intermediaries and retracted ancestors cannot manufacture independence. Changes to relevant event wording, source metadata, assertions, passages, clocks or links invalidate the review.

Legacy raw assessments and historical payloads remain readable and unchanged. Unsupported `corroborated` values display **Corroboration needs review** and are sent to AI review as `unreviewed` in a request copy. Source and quote records are analyst-entered snapshots, not independently verified provenance or peer certification. No automatic source fetch occurs.

## Acceptance and deployment

- Five TypeScript checks, 104 API/contract tests and 60 Chromium/mobile-Safari checks passed on the exact accepted source. Browser coverage includes authoring/review, stale and shared-origin refusal, actual downloaded JSON, draft recovery, event deletion, and browser-to-D1 saves/reopen.
- Vite build, Pages Functions compilation and compiled human/service routes passed against a fresh production-schema export. All 12 timeline/credential table catalogs stayed unchanged after the route rehearsal; no pending migration or external outbound attempt occurred.
- Independent review accepted source, isolation and all 145 identical build/staging files. Package inventory SHA-256: `5a9caa7d789a60f67dc32998256fe8b2e6726a27f7f9ada514a5851ed5d848f0`.
- Deployment `8acc362b-fc26-4a8d-90bc-440263ac63d0` serves [the accepted build](https://8acc362b.researchtoolspy.pages.dev). The publisher uploaded the prebuilt package with `--no-bundle`.
- Seventeen readonly live checks passed on each deployment/production URL, including exact asset hashes, unauthorized timeline reads, CORS, anonymous discovery and malformed service-token rejection. Required secret names remain present. Production probes made no authenticated content writes or model calls.
- No database migration or mutation was performed. All 13 migration names and 282 schema details across 12 tables remain unchanged and match rehearsal.

Full fingerprints, states, commands and private-receipt hashes are in the [JSON receipt](./2026-09-11-timeline-evidence-release-receipt.json). Wire fields, limits and compatibility are documented in [Timeline Artifacts](../api/TIMELINE-ARTIFACTS.md).

## Corrections and remaining scope

Review corrected an unchanged legacy event save that added implicit placement, shared-intermediary dependence, and unsupported AI assessment transfer. Browser checks corrected explicit select labels and a Narrative locator. Overlapping browser validators exhausted initial deadlines; trace review showed continued progress. The final complete run used one validator and a bounded 120-second authoring scenario. Existing Vite chunk-size warnings remain.

The team never modified the primary checkout. Another process committed its previously dirty analytics work during validation; this release used the clean timeline integration worktree. External authenticated worker lanes remain unqualified and were not bypassed.

Previous deployment: `3b8fd9ff-a400-4858-976b-b33f9315c315`. Its strict workspace codec rejects the new optional evidence field. Prefer compatible application recovery and preserve saved evidence/schema/history; do not strip evidence to satisfy an older codec.

**TL-04 remains in progress.** Separate judgments/dissent and verified source-store import are the next evidence work. TL-01 and TL-05–TL-18 remain pending; no cross-product handoff or later roadmap feature is claimed.

## Subsequent deployment

The [judgment release](./2026-09-11-timeline-judgment-release-receipt.md) adds scoped analytic judgments and retained dissent to this evidence foundation. Its receipt records the current deployment and checks; the results above remain the historical source-assertion release. TL-04 remains partial, with verified source-store import and authenticated peer review still pending.
