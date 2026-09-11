# Timeline implementation register

Date: 2026-09-11

Status: TL-00 and TL-02 released. The human API and complete browser snapshot saving slices of TL-03 are deployed; the full TL-03 checkpoint remains in progress. GitHub and GitLab main contain the accepted release, and production migrations 0011 and 0012 are applied.

This register translates the [platform roadmap](./2026-09-11-timeline-evidence-narrative-roadmap.md)
into independently verifiable releases. Each checkpoint includes API behavior,
consumer behavior, persistence where applicable, and evidence of verification.
A type declaration or migration alone does not complete a checkpoint.

## Baseline and ownership

ResearchTools owns extraction, investigation artifacts, evidence assessments,
composition, comparisons, planning, and reviewed publication. Signal owns its
command orchestration and current community graph. RSS owns article/story
presentation and requests the existing shared article workflow.

The initial audit found `timeline-analysis.v1`, a browser-local timeline workspace,
Behavior Timeline nested paths, and separate ACH/Cross Table components.
That initial audit did not find the proposed durable timeline route family or composition,
comparison, planning, and publication services. Existing COP timeline/task
tables are integration inputs; their existence does not complete these services.

Existing unrelated changes in the ResearchTools worktree include analytics and
deployment work. Preserve those changes and avoid coupling timeline delivery to
their release.

## Delivery checkpoints

Current delivery state (2026-09-11):

- **TL-00: released.** Frozen JSON schemas/OpenAPI, generic service client,
  synthetic fixture manifest and scoring rubric are implemented. All 67 focused
  contract tests and five TypeScript checks pass; production build passes.
  Fixtures exercise the real route with mocked model output; this is not a
  live-provider or historical corpus quality evaluation.
- **TL-02: released.** Narrative metadata, chapters, selection, stable links,
  strict local import and draft recovery pass Chromium and mobile Safari acceptance,
  including real downloaded-byte round trips. All 42 browser-project checks pass.
- **TL-03: in_progress; human API and browser snapshot saving deployed.** Private workspace auth,
  artifact/default branch, stable event-candidate identities, immutable versions,
  transactional revisions, exact retry replay and pinned history are implemented.
  The combined 90 API/contract checks, 54 browser checks and all five TypeScript checks/build pass.
  Actual managed-chain and seeded-prefix upgrade tests pass in Miniflare D1 with
  synthetic prerequisites. Release rehearsal additionally imported the actual
  production schema and exercised the compiled Pages worker with synthetic users.
  Migrations 0011 and 0012 are applied; all nine affected tables and 219 schema
  details match rehearsal, with existing catalog and row counts preserved.
  Complete browser snapshots up to 60 KiB support explicit save/reopen, conflict
  handling and exact retries through real D1 routes in both browsers. Scoped
  external-service access remains pending; this does not complete full TL-03.
- **TL-01 and TL-04–TL-18: pending.** No delivery of these checkpoints or cross-app changes is claimed.

See the [browser release receipt](./2026-09-11-timeline-browser-release-receipt.md)
for current snapshot deployment and its limits. See the [release receipt](./2026-09-11-timeline-release-receipt.md) for main pushes,
production deployment and verification. See the [continuation receipt](./2026-09-11-timeline-continuation-receipt.md) for prior local
acceptance and the [foundation receipt](./2026-09-11-timeline-foundation-receipt.md)
for historical attempts. The continuation resolves the earlier browser limitations.
The table retains the complete acceptance requirements for each checkpoint.

| ID | Scope and concrete deliverable | Prerequisites | Completion evidence |
| --- | --- | --- | --- |
| TL-00 | Freeze extraction request/response/error schemas and a generic client; version fixture manifest and scoring rubric | Existing extraction contract | Current responses validate; URL/content/no-events/error cases reproduced without Signal/RSS components |
| TL-01 | Align RSS and Signal source-count, importance, and build/open/refresh labels; retain oldest/latest and contents navigation | TL-00 | Rendered article/story/command fixtures show consistent labels and destinations |
| TL-02 | Narrative fields, chapter outline, selected-event presentation, evidence deep links | Existing local workspace | Browser interaction preserves event IDs, chronological preference, original extraction, and export round trip |
| TL-03 | Durable workspace authorization, artifact root/default branch, stable object IDs, immutable object versions, transactional revisions | TL-00 | Two-workspace isolation, retry replay, stale-write rejection, historical replay, and runtime schema checks |
| TL-04 | Source assertions, passage references, provenance, source-dependence review, judgments and dissent | TL-03 | Conflicting and derivative sources remain retrievable; independent-evidence decisions have reviewed rationale |
| TL-05 | Secure RSS/Signal handoff into a durable investigation with source lineage and return links | TL-01, TL-03, TL-04 | Single-use/expiry/audience tests plus article, multi-article, and story-snapshot round trips |
| TL-06 | Rich temporal claims, intervals, clocks, stable sorting/cursors, explicit extraction v2 | TL-00, TL-04 | Exact/partial/relative/unknown and conflicting-time fixtures preserve precision; v1 stays compatible |
| TL-07 | World/knowledge chronology and versioned diagnostic, assumptions-check, information-check, and ACH runs | TL-04, TL-06 | Historical cutoff reconstruction and immutable run inputs; individual review and dissent preserved |
| TL-08 | Scopes, memberships, pinned composition links, clock mappings, bounded projection, navigation | TL-03, TL-06 | Reused-child, overlap, cycle, uncertain-anchor, restricted-child, and projection-replay fixtures |
| TL-09 | Behavior adapter, reusable templates/instances, default-branch tracking and child update review | TL-07, TL-08 | Legacy nested paths retain mapped IDs; separate occurrences retain evidence; updating child does not change saved host |
| TL-10 | Revision/account comparisons and N-way hypothesis matrices; preregistered criteria, observations, coverage, evaluation cells | TL-07, TL-08 | Contradiction versus missing-collection cases, reviewer disagreement, sensitivity, hindsight cutoff, and identity review |
| TL-11 | Protected working branches, semantic merge proposals/resolutions, two-parent revisions, shallow/deep composite forks | TL-03, TL-08, TL-10 | Conflicting edits, multiple bases, stale heads, partial selection, repeated merge, and child-link conflicts replay correctly |
| TL-12 | Basic plan objectives/tasks/milestones, owners, explicit timezone, approved baseline/current forecast/actual, run of show | TL-03, TL-06 | State transitions and baseline variance reproduced; completed work retains distinct observed-outcome references |
| TL-13 | Dependencies/calendars/resources, critical path/float, operational periods, plan options and plan/outcome comparisons | TL-10, TL-12 | Known schedules and infeasible schedules, resource conflicts, missed deadlines, rollover, and option selection verified |
| TL-14 | Indicators, collection workflow, scenarios, decision prompts, incremental community revisions and candidate review | TL-05, TL-07, TL-10, TL-12 | No-event refresh, correction/retraction, delayed report, absent observation, and changed-indicator cases |
| TL-15 | Async processing, polling, cancellation/retry semantics, signed webhooks, generic client examples | TL-03; each supported domain checkpoint | Durable job state, duplicate delivery, revoked credentials, partial source failure, and budget/limit behavior |
| TL-16 | Rights-aware media/maps and accessible explanatory plots | TL-06, TL-08 | Broken/blocked media fallback, timestamp/source/credit preservation, keyboard navigation |
| TL-17 | Narrative, composite, plan, and comparison snapshots; immutable published JSON; explicit TimelineJS/lossy exports | TL-02, TL-04, TL-08, TL-10, TL-12 | Pinned dependency manifests, publication authorization/revocation, export warnings, browser and generic-client reads |
| TL-18 | Full corpus and cross-surface release rehearsal with release evidence | TL-00 through TL-17 | Recorded outputs for every roadmap demo and exit gate; migrations rehearsed; enabled capabilities match working routes |

Async job infrastructure may ship before TL-14 for long-running comparisons or
projections. Domain operations become discoverable only when their own
prerequisites pass. Media work can proceed independently after TL-06/TL-08.

## Decisions needed in the implementation contracts

1. Use schema discriminators with concrete enum members and conditional fields.
   The roadmap's pipe-separated illustrative JSON strings are explanatory
   notation, not valid domain values for production requests.
2. Create the default branch and immutable revision infrastructure in TL-03.
   User-created branches and merges arrive in TL-11. Composition can pin
   revisions or track the default branch before arbitrary branches exist.
3. Use composite workspace/artifact/object/version foreign keys or equivalent
   enforced constraints. Validate referenced revisions belong to the expected
   artifact and every object is readable by the caller.
4. Store one immutable typed payload per object version. Domain indexes and
   projections reference that version; avoid two independently editable copies
   in generic and domain-specific tables.
5. A revision commit atomically writes object versions, changes, parent edges,
   and its manifest, then advances the branch only if its expected head matches.
   A failed precondition publishes no partial revision. Reusing an idempotency
   key with different request content returns a conflict.
6. Define knowledge cutoffs by clock and audience. Publication time, analyst
   receipt time, and system ingestion time are different questions. A source
   published earlier does not establish that a particular analyst knew it then.
   Comparison input includes this selected clock policy and unknown-clock rules.
7. Temporal relations over uncertain bounds return definite, possible, or
   unresolved results with the bounds used. Define endpoint inclusivity and
   instant-versus-interval behavior before implementing overlap queries.
8. A composite manifest keys rendered instances by composition path plus source
   object/version. Preserve repeated instances while deduplicating shared
   evidence lineage. An aggregate episode and its detailed children must not
   double-count occurrences or independent evidence in comparisons.
9. Tracking links record selectors and resolved revisions separately. A host
   refresh creates a new manifest. Child revision changes never modify a saved
   parent or propagate publication permission.
10. Introduce plan comparison modes with TL-12/TL-13, after plan resources exist.
    Earlier comparison discovery lists only executable research modes.
11. Critical-path calculation requires a declared working calendar, duration
    units, dependency semantics, constraints, and status cutoff. Resource
    feasibility is reported separately; incomplete schedules return warnings
    instead of invented zero durations or reassuring results.
12. Pre-register expected results and coverage rules where prospective testing
    is possible. Label retrospective criteria. A failed probabilistic forecast
    is a scored outcome, not logical disproof of a hypothesis. Strict
    contradictions identify which proposition and assumptions are inconsistent.
13. Withdraw/retract through new versions. Retention or deletion that removes
    source content leaves a policy-permitted tombstone; reproduce the historical
    manifest while clearly stating unavailable evidence.
14. Migrate legacy IDs through an explicit mapping manifest. Existing substeps
    and forks lack their own IDs, so allocate new IDs once and record their
    original artifact revision/path; do not imply those IDs existed previously.

## Release record template

For each checkpoint record the implementation paths, contract/schema versions,
migration identifier, tests and fixture outputs, capability flags, compatibility
results, and known limitations. Use these states:

- `pending`: implementation has not started.
- `in_progress`: concrete changes exist but the completion gate has not passed.
- `verified_local`: implementation and relevant local checks pass.
- `enabled_staging`: deployed integration and consumer checks pass in staging.
- `released`: intended consumers can use it and release verification passes.

Never infer `released` from documentation, a type definition, a passed isolated
unit test, or an existing route filename. Record production enablement
separately from local completion.

## Release and migration sequence

Add tables and constraints through the managed migration mechanism after
rehearsing against representative schemas. Deploy compatible readers with new
capabilities disabled; backfill legacy IDs/provenance through a restartable
job with counts and error reports. Enable writes for the tested capability,
then its first-party and generic consumers. Keep old readers during the declared
compatibility window and compare old/new exports on frozen fixtures.

Rollback disables the new capability and consumers while preserving committed
revisions and legacy routes. Avoid rollback migrations that destroy user-created
timelines. Compatibility failures require a corrected forward migration or
adapter before re-enablement.

TL-18 requires the extraction, investigation, composition, comparison, planning,
historical-knowledge, living-story, and external API demonstrations in the parent
roadmap. It also requires a replayable account of the chosen baselines, source
snapshots, input revisions, expected results, and actual results for each case.
