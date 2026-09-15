# Timeline implementation register

Approximate recorded dates are delivered: an explicit circa qualifier on a recorded date, carried through workspace v3 without moving events, changing precision or inventing a window. Behaviour timelines now declare one time domain (ordinal or relative T±) with parsed offsets, read-only timing review, and clock mapping onto an analyst-supplied anchor. See the [circa receipt](./2026-09-14-timeline-circa-release-receipt.md). TL-06 remains in progress; evidence-timeline clock mappings and extraction v2 remain pending.

Shared-link previews are delivered: frozen presentation title, description and a dedicated static timeline image appear in initial HTML and prepublication review. Revoked or unavailable links use generic metadata; third-party caches may persist. See the [link-preview receipt](./2026-09-14-timeline-link-preview-release-receipt.md). TL-17 remains in progress.

Recorded-date overlap finding is delivered: choose an event, compare conservative calendar windows and navigate to existing cards without changing the sequence or saved data. Results mean potential overlap only. See the [overlap receipt](./2026-09-14-timeline-overlap-release-receipt.md). TL-06 remains in progress.

Durable recorded intervals are delivered: private save/reopen, exact pending retry and historical v1/v2 preview preserve identity and existing history. See the [durable interval receipt](./2026-09-14-timeline-durable-interval-release-receipt.md). TL-06 remains in progress.

Direct presentation sharing is delivered: explicit publish/copy, standalone anonymous reader and creator revocation, with immutable selected snapshots. See the [sharing release receipt](./2026-09-14-timeline-sharing-release-receipt.md). Private interval workspace saving is delivered in the linked durable interval release.

Date: 2026-09-11

Status: TL-00, TL-02 and TL-03 released. Human APIs, complete browser snapshots and scoped service read/write are deployed. Both main refs contain the accepted release; production migrations 0011–0013 are applied. Existing service credentials and grants are unchanged. TL-04 source assertions, corroboration review, analytic judgments, retained dissent and owned stored-passage import are also deployed; TL-04 remains in progress.

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

Current delivery state (2026-09-12):

- **TL-00: released.** Frozen JSON schemas/OpenAPI, generic service client,
  synthetic fixture manifest and scoring rubric are implemented. All 67 focused
  contract tests and five TypeScript checks pass; production build passes.
  Fixtures exercise the real route with mocked model output; this is not a
  live-provider or historical corpus quality evaluation.
- **TL-02: released.** Narrative metadata, chapters, selection, stable links,
  strict local import and draft recovery pass Chromium and mobile Safari acceptance,
  including real downloaded-byte round trips. All 42 browser-project checks pass.
- **TL-03: released; human API, browser snapshots and scoped service access deployed.** Private workspace auth,
  artifact/default branch, stable event-candidate identities, immutable versions,
  transactional revisions, exact retry replay and pinned history are implemented.
  The combined 97 API/contract checks, 54 browser checks and all five TypeScript checks/build pass.
  Actual managed-chain and seeded-prefix upgrade tests pass in Miniflare D1 with
  synthetic prerequisites. Release rehearsal additionally imported the actual
  production schema and exercised the compiled Pages worker with synthetic users.
  Migrations 0011–0013 are applied. The service release compares all 12 timeline
  and credential tables, with 282 schema details matching rehearsal and existing
  scope rows and timeline counts preserved.
  Complete browser snapshots up to 60 KiB support explicit save/reopen, conflict
  handling and exact retries through real D1 routes in both browsers. Independent
  `timeline.read`/`timeline.write` scopes and current-token replay pass real D1
  and compiled routes. Transaction-time revocation, rotation and malformed-timestamp
  cases additionally pass the actual-D1 race tests.
  No production credential was created or widened.
- **TL-04: in progress; source assertions, judgments, dissent and stored-passage import deployed.**
  Analyst-entered source claims, quote/locator snapshots, supporting/contrary/context
  links, recorded derivation and retractions survive local and durable snapshots.
  Corroboration requires a current independence/compatibility review and disjoint
  complete source lineages. Legacy unsupported labels are qualified in the UI,
  Markdown and AI requests without rewriting saved data. Scoped judgments now retain
  reasoning, assumptions, alternatives, change indicators and supporting/contrary
  references, with qualitative likelihood separate from analytical confidence.
  Self-attributed reviews/dissent retain complete reviewed versions; stale-input
  notices, frozen review drafts and cited-event deletion guards preserve context.
  Opened private timelines can now import an exact passage from a complete owned
  Content Research extraction in the same workspace. The resolver checks current
  access, retention, full-text hash and unique quote match; the recorded locator
  preserves hashes and UTF-16 offsets. Preview is rechecked before import, and
  private passages never enter automatic browser drafts. The current interval-presentation source passed 73 distinct checks (34 browser-project and 39 contract checks), five type checks and fresh build/compiled gates. See the [current receipt](./2026-09-14-timeline-interval-presentation-release-receipt.md). Previous stage counts remain historical; no full unrelated API-suite claim.
  No database migration was required. Broader source-store support, dedicated
  judgment services and authenticated peer review remain pending. Stored-text
  equality is not source truth, authenticated historical provenance or append-only
  review permission.
- **TL-17: partial.** Selected-narrative TimelineJS JSON, matching complete companion, optional self-hosted renderer, explicit frozen public presentation links and creator revocation are delivered. Composite, plan and comparison snapshots and dependency manifests remain pending.
- **TL-06: in progress.** Calendar diagnostics, precision-preserving date entry, calendar extents and local interval authoring with workspace/draft v2 are delivered. Interval presentations are delivered. Durable interval save/reopen and immutable v1/v2 history are delivered. Approximate (circa) recorded dates are delivered as workspace v3, and behaviour timelines declare a time domain with parsed relative offsets and clock mapping onto a supplied anchor; evidence-timeline clock mappings and extraction v2 remain pending.
- **TL-01, TL-05, TL-07–TL-16 and TL-18: pending.** No delivery of these checkpoints or cross-app changes is claimed.

Recorded intervals now appear in TimelineJS slides, accessible lists and JSON with precision-preserving endpoint labels and supported spans. Scheduling retains recorded ranges; private v2 saving was pending at that stage and is delivered in the linked durable interval release. See the [interval presentation receipt](./2026-09-14-timeline-interval-presentation-release-receipt.md).

Analyst Add/Edit event now records inclusive end dates/times with local workspace/draft v2 round trips; interval-free exports remain v1. Private interval saves were unavailable at that stage and are delivered in the linked durable interval release. The complete backup retains intervals; the presentation stage above adds renderer endpoints. TL-06 remains in progress; durable v2 is delivered in the linked durable interval release. See the [local interval receipt](./2026-09-14-timeline-interval-entry-release-receipt.md).

The preceding temporal-core stage added internal calendar claim validation and conservative extents without UI or persisted interval fields. Its historical validation is recorded in the [temporal-core receipt](./2026-09-14-timeline-temporal-core-release-receipt.md); local interval authoring is delivered in the subsequent release above.

Add/Edit event now offers optional recorded day/month/year pickers alongside typed date entry, with explicit precision guidance and no automatic date components. Mode changes and incomplete picker input retain the draft; explicit Save follows existing validation. TL-06 remains in progress. See the [date-entry receipt](./2026-09-14-timeline-date-entry-release-receipt.md).

Analyst view now offers Timing review for relative before/after placements, comparing recorded calendar bounds and linking to the event and anchor without changing data. Uncertain results remain unresolved; this is placement consistency, not evidence verification. TL-06 remains in progress. See the [timing review receipt](./2026-09-14-timeline-timing-review-release-receipt.md).

Timeline presentation now uses a top-aligned reading column, clear date/title/body hierarchy, compact marker labels and 44-pixel navigation controls within a bounded dialog. Full details, schedules and backups remain available. See the [presentation readability receipt](./2026-09-14-timeline-presentation-ui-release-receipt.md).

Automatic presentation scheduling now propagates times through narrative selection with explicit overrides, reset, adjustable spacing and Today/Tomorrow controls. Recorded timestamps remain intact and backward anchors warn about chronological reordering. See the [automatic schedule receipt](./2026-09-13-timeline-schedule-flow-release-receipt.md).

TimelineJS export now offers an opt-in presentation schedule with temporary dates, times and Start/action/Arrive meanings. Dated relative/position events export their recorded dates; placement notes remain explicit. The original ResearchTools backup and saved revisions are unchanged. See the [schedule release receipt](./2026-09-13-timeline-schedule-release-receipt.md).

The timeline workflow now places content before setup, keeps private save/state controls compact, and groups saved versions, history and links behind an explicit disclosure. Present opens eligible Current edits directly; saved and historical previews remain separate. No API, schema, permission or public sharing change is added. See the [workflow release receipt](./2026-09-12-timeline-workflow-release-receipt.md).

Saved revision history now loads private revisions in pinned pages and validates a selected historical snapshot for preview, presentation and export without replacing current work or changing the save head. Refresh is explicit; no public sharing is added. See the [history release receipt](./2026-09-12-timeline-history-release-receipt.md).

Saved-revision preview now presents and exports the last successfully saved/opened private version separately from unsaved edits. Revision identity is explicit; no public sharing is added. See the [saved-presentation release receipt](./2026-09-12-timeline-saved-presentation-release-receipt.md).

Presentation search now filters the native event list and jumps to allowed stable event IDs without changing selection, exports or chronology. Query/disclosure survive frame replacement; old jumps do not replay. See the [navigation release receipt](./2026-09-12-timeline-navigation-release-receipt.md).

Optional self-hosted TimelineJS presentation now renders the frozen selected narrative with beginning/latest controls, keyboard navigation, an accessible event list and isolated local assets. The renderer is bounded to 100 eligible events; exports remain available. See the [renderer release receipt](./2026-09-12-timeline-renderer-release-receipt.md).

TimelineJS selected-narrative export now provides an explicit loss/omission preview and matching complete ResearchTools companion without publishing or changing saved data. Recorded date precision, qualified assessments and escaped text are preserved. **TL-17 is partial:** the adapter is delivered; immutable authorized publication/revocation and richer snapshot types remain pending. See the [TimelineJS release receipt](./2026-09-12-timeline-timelinejs-release-receipt.md).

Compact source coverage now distinguishes linked roles, active support, retractions and withdrawn ancestry in Analyst and Narrative views without changing saved data. Recorded sources do not imply independent confirmation. RSS coverage remains pending. See the [source coverage release receipt](./2026-09-12-timeline-source-coverage-release-receipt.md).

Evidence edits now warn before removing the final active support from a saved corroborated event, including shared ancestry and already-stale assessments. Cancellation preserves data; changed context requires a fresh action. See the [final-support warning release receipt](./2026-09-12-timeline-support-warning-release-receipt.md).

Assertion epistemic type is now explicitly separate from active/retracted status: observation, reported claim, inference or hypothesis. Legacy absence remains Unclassified; classifications persist in snapshots and dependent reviews become stale when inputs change. See the [epistemic types release receipt](./2026-09-12-timeline-epistemic-types-release-receipt.md).

Evaluations now expose a read-only comparison of recorded/current inputs, including changed fields and added/removed source ancestry matched by stable IDs. Opening the comparison does not renew evaluations or modify saved data. See the [evaluation inputs release receipt](./2026-09-12-timeline-evaluation-inputs-release-receipt.md).

Source assertions now retain separate source-evaluation factors and rationale, frozen opening inputs and changed-input notices through local export and private immutable snapshots. Evaluations do not certify truth or replace independence review. See the [source evaluation release receipt](./2026-09-12-timeline-source-evaluation-release-receipt.md).

The workspace now distinguishes events, evidence, questions, judgments and narrative with labeled visual treatments. The event sequence precedes advanced editors; section links and a transient event finder improve navigation without hiding events or changing saved data. See the [visual hierarchy release receipt](./2026-09-12-timeline-visual-hierarchy-release-receipt.md).

The import form now lets analysts explicitly load and select from up to 20 recent owned complete stored analyses by title. Listing is metadata-only and does not certify integrity; exact-quote checks remain mandatory. See the [source picker release receipt](./2026-09-11-timeline-source-picker-release-receipt.md).

Complete larger extractions now support bounded, hash-checked chunk reconstruction, including passages beyond the stored prefix. Incomplete chunk sets fail closed. See the [chunk import release receipt](./2026-09-11-timeline-chunk-import-release-receipt.md).

See the [source import release receipt](./2026-09-11-timeline-source-import-release-receipt.md)
for the preceding short-record import slice, the [judgment release receipt](./2026-09-11-timeline-judgment-release-receipt.md)
for judgments/dissent, and the [evidence release receipt](./2026-09-11-timeline-evidence-release-receipt.md)
for its preceding source-assertion slice. See the [service release receipt](./2026-09-11-timeline-service-release-receipt.md)
for current scoped-service deployment. See the [browser release receipt](./2026-09-11-timeline-browser-release-receipt.md)
for the earlier snapshot release and its limits. See the [release receipt](./2026-09-11-timeline-release-receipt.md) for main pushes,
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
