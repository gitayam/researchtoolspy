# Timeline source evaluation release

[Timeline evidence](https://researchtools.net/dashboard/tools/timeline) now supports **Source evaluation**: separate access, reliability, credibility, currency, completeness, possible-bias and possible-deception factors, each with rationale. The editor and narrative evidence view display assessments and changed-input notices. Markdown includes rationale and stale-input qualification; JSON and private saved snapshots retain the complete evaluation.

An open evaluation draft stays tied to its opening source inputs. Source/assertion edits preserve recorded evaluations and mark them for review. Evaluation changes also stale applicable corroboration and judgment reviews. No score or automatic truth/independence/confidence decision is introduced. Reviews are analyst-entered, not authenticated peer review.

Accepted/deployed source `639f2cab66b81b48f3069dfa0348021e6855b7ce` landed on both main refs without force. Deployment `5eaf67bd-31a6-440f-80d1-cb54e366b8ac` serves [the accepted build](https://5eaf67bd.researchtoolspy.pages.dev); this receipt and roadmap changes are documentation-only follow-up.

Five type checks, 134 API/contract checks and 82 desktop/mobile browser checks passed, followed by frontend/worker builds and actual production-schema compiled rehearsal. New checks cover strict rejection, legacy bytes/bases, complete ancestry, changed inputs, immutable evaluation history, malformed writes, separate canonical/wire size limits, editor rationale, keyboard operation, private save/reopen, frozen draft inputs, assertion edits, Narrative and JSON round trips. Compiled human/service snapshots preserve evaluations and hashes.

Independent review compared all 146 staged files; inventory SHA256 `fb4945e23e7a64cebda8e8cf66776c4aee0c29695173b7252ecde033e8e69705`. Publishing used `--no-bundle`. Twenty-one read-only checks passed on each deployment and production URL. All 13 migration names and 386 catalog entries across 14 tables remain unchanged. No new route, migration, credential or permission was added. Representative light/dark desktop/mobile evaluation captures were reviewed; this is not an exhaustive accessibility audit. Existing mobile navigation overlays the Possible bias rationale in the tall mobile captures; those images do not fully expose that rationale.

The [JSON receipt](./2026-09-12-timeline-source-evaluation-release-receipt.json) records fingerprints and recovery. Previous deployment `3774773e-7dc2-4dd1-8ca5-5b134119c842` rejects evaluation-bearing snapshots: preserve immutable data and use compatible readers or a forward fix. Existing size limits and Vite large-chunk warnings remain. Primary checkout untouched.

**TL-04 remains partial.** Broader source-store support, authenticated peer review and dedicated judgment services remain pending.
