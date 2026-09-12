# Stored Content Research passage import release

Analysts can import an exact passage from their own complete stored Content Research extraction into an opened private [Timeline](https://researchtools.net/dashboard/tools/timeline). The resolver checks ownership, current private-workspace write access, retention, the full content hash and one exact quote match. The quote remains separate from analyst assertion wording; its locator retains content/quote hashes, UTF-16 range and match time.

Accepted/deployed source: `48e84443c161e57b18d2edd0309acd8155ceb5c0`. Both main refs were pushed without force. Deployment `62e1c677-6c3c-434c-9c5f-1ff7ffed6e20` serves [the reviewed build](https://62e1c677.researchtoolspy.pages.dev). These receipts and API/roadmap updates are a documentation-only follow-up.

## User flow and trust

Save a timeline to a private workspace, then reopen it. Expand an event's evidence and enter the stored analysis ID and exact quote. Preview the match, supply separate assertion wording and relation, then choose **Import matched passage**. The browser checks the current content hash again before applying. Save changes to retain the passage in an immutable workspace revision.

Private imports stay out of automatic browser draft storage. Workspace or identity loss clears private content and discards late responses. Changed content, expired/incomplete/hash-mismatched sources, ambiguous quotes, conflicting source IDs and duplicate passage IDs are refused without overwriting existing evidence. Import never sets corroboration or confidence.

Matching a stored extraction does not certify source truth or create authenticated historical provenance. Downloaded JSON/Markdown locators remain recorded references. Only complete owned records in the exact workspace are supported; chunk reconstruction, other source stores and service-identity imports are outside this slice. The existing evidence wire schema and whole-snapshot permissions remain unchanged.

## Acceptance

- Five TypeScript checks, 116 API/contract tests and 72 desktop/mobile browser checks passed on the exact accepted source. Real D1 fixtures cover authority changes, canonical retention states, Unicode offsets, unique matches, changed previews, private save/reopen, unchanged browser drafts and delayed responses after sign-out.
- Vite and Pages Functions builds passed. The compiled worker matched a synthetic stored passage against the production schema, refused unauthorized/stale requests, left source rows unchanged and retained imported passages through human/service workspace snapshot saves.
- Independent review accepted runtime isolation and all 145 identical staged files. Package inventory SHA-256: `9ac2c04ce622086dbca2cc4b273030ce4c61f2069da7d064d6887e68782f6385`. Publishing used the verified prebuilt package with `--no-bundle`.
- Nineteen read-only checks passed on each deployment/production URL. These include exact asset hashes, anonymous API denial, source-resolver denial and CORS. No live source content was read and no production content was written by the probes.
- No migration or production D1 mutation was performed. All 13 migration names and 366 schema details across 13 source/timeline/credential tables remain unchanged. Existing secret names and unrelated application bindings were preserved.

Full fingerprints are in the [JSON receipt](./2026-09-11-timeline-source-import-release-receipt.json); the resolver contract is in [Timeline Artifacts](../api/TIMELINE-ARTIFACTS.md).

## Corrections and scope

An initial migration-inventory read returned Cloudflare internal error 7500; retry succeeded. Review tightened retained-record expiry rules and uniform inaccessible-record responses before acceptance. The focused run passed 30 checks; a delayed-response sign-out regression was then added before the complete gate. Review added an explicit wait for response settlement; the superseded full run was stopped and the exact-source gate restarted. Live smoke corrected a no-store expectation on middleware-handled OPTIONS; resolver POST no-store and the preflight allowlist were verified separately. Existing Vite large-chunk warnings remain.

The primary checkout was untouched. External authenticated worker lanes remain unqualified and were not bypassed. Previous deployment `da6b9380-ba08-485f-bf65-6d5de2eefd6b` understands the unchanged evidence snapshots but has no import resolver/UI.

**TL-04 remains in progress.** Broader source-store support, dedicated judgment services and authenticated peer review remain pending. No cross-product handoff or later checkpoint is claimed.
