# Timeline Investigation and Framework Integration Plan

**Status:** Active

**Date:** 2026-09-08

**Scope:** Timeline, Behavior Analysis, COM-B/Behaviour Change Wheel, ACH,
Agentic Research, Content Research, Evidence, Investigations, and COP.

## Product boundary

The three temporal/behavior artifacts answer different questions and should not
be collapsed into one schema:

| Artifact | Primary question | Canonical unit |
| --- | --- | --- |
| Event Timeline | What happened, when, and what remains unknown? | Dated event, gap, question, finding, source |
| L1 Behavior Analysis | What repeatable action occurs, where, and through which actor decisions? | Behavior + location, sequence step, fork, consequence |
| L2 COM-B / BCW | Why does a specific audience perform that behavior, and what could change it? | Audience-specific deficit, intervention, policy |

Timeline may reveal a behavior worth analyzing, but a historical event is not
automatically a behavior. Behavior Analysis may use timeline evidence, but its
decision sequence is not a historical chronology. COM-B must continue to require
a linked Behavior Analysis; it must not be launched directly from an event.

## Review findings

1. The Event Timeline already has strong fact/inference separation: extracted
   versus analyst events, review assessment, analyst notes, explicit gaps,
   questions, answers, and tentative AI hypotheses.
2. Until this slice, the dedicated tool still required an article before that
   workspace existed. This prevented an analyst from beginning with partial
   knowledge and made gaps a post-extraction feature instead of a research driver.
3. L1 Behavior Analysis has a separate `TimelineEvent` model with sub-steps,
   forks, linked behaviors, decision type, psychological state, coping branches,
   competing behaviors, and optional COM-B target. This is appropriate for an
   actor trajectory, not for source chronology.
4. The `BehaviorTimeline` editor now exposes the richer decision/psychological
   fields in `src/types/behavior.ts` through progressive disclosure. Coping
   plans, competing behaviors, sub-steps, and fork outcomes have complete add,
   edit, remove, summary, and read-only paths. Imported nested fork paths are
   preserved, but recursive nested-path authoring remains a later enhancement.
5. The behavior timeline AI route now uses the full behavior context and existing
   sequence, emits the canonical rich schema, and allowlist-normalizes model
   output before it enters the form. It remains an authenticated Behavior
   Analysis helper and is intentionally separate from Event Timeline AI review.
6. The Behaviour Change Wheel correctly treats COM-B assessment as the center,
   maps deficits to intervention functions, and maps selected interventions to
   policy categories. Its concepts are downstream recommendations, not event
   metadata.
7. Agentic Research accepts a collection query but previously ignored URL query
   parameters. A gap could not carry its question into collection. Evidence and
   framework systems already support source URLs and linked evidence, but Event
   Timeline had no answer-level source reference.

## Investigation loop

```text
Known events → visible interval gaps → research questions → source collection
     ↑                                                       ↓
review status ← supported event promotion ← cited finding / answer
```

Rules:

- A question is never an event.
- A search result is never an answer.
- An answer is never silently promoted to an event.
- A hypothesis is never source evidence.
- Event promotion requires an analyst action and at least one source reference
  in the future durable workflow.
- Guest work may be browser-local and expiring. Server persistence, sharing,
  group work, and durable framework linkage require sign-in and writable
  workspace authorization.

## Shipped in the first slice

- Manual, named Timeline starting point with zero required source documents.
- Robust mode by default for analyst-created timelines.
- Seven-day browser-local manual draft with resume after tool navigation.
- Absolute date/time, before/after-event, and direct sequence placement. Direct
  placement includes first, second, third, second-to-last, last, and exact
  1-based positions. Time-only and sequence-only events remain explicitly
  date-unknown and retain a deterministic order in drafts and exports.
- Questions before, between, or after known events.
- Visible `Record finding` action with answer source URL and title.
- Answer sources preserved in Markdown copy and `timeline-workspace.v1` JSON.
- `Research this question` opens Agentic Research with the question prefilled.
- Explicit navigation to ACH for competing hypotheses and L1 Behavior Analysis
  for repeatable behavior + location.
- Manual timelines can use opt-in AI question/hypothesis assistance without a
  fabricated article URL; the model still receives only the working event data.
  Each AI event includes its authoritative working-position label and optional
  analyst-supplied date/time rather than an inferred date.

## Falsifiable hypotheses and gates

### H1 — Manual-first improves useful timeline creation

**Hypothesis:** Offering “Start with what you know” raises the share of Timeline
sessions reaching two events or one explicit question by at least 25% relative
to article-only entry.

**Falsifier:** No statistically meaningful lift after 200 eligible sessions, or
manual starts produce more than 20% immediate abandonment after naming.

### H2 — Gap-driven handoff improves collection quality

**Hypothesis:** Prefilled collection from a timeline gap produces at least 20%
more analyst-approved results per job than unscoped collection started directly.

**Falsifier:** Approval rate does not improve, or query reformulation exceeds
50%, indicating timeline questions are not collection-ready.

### H3 — Cited findings reduce unsupported promotion

**Hypothesis:** Requiring an explicit finding and displaying its sources before
event promotion keeps unsupported promoted events below 2% on audit.

**Falsifier:** Unsupported promotion exceeds 2%, or analysts routinely attach
irrelevant URLs merely to satisfy the control.

### H4 — Automatic event-to-behavior conversion is unsafe

**Hypothesis:** A deliberate handoff where the analyst defines behavior +
location yields under 5% invalid L1 artifacts; automatic conversion will exceed
that rate.

**Falsifier:** A labeled evaluation shows automatic extraction can produce valid,
audience-agnostic behavior + location artifacts at >=95% precision. Do not ship
automatic conversion before that test.

### H5 — A shared evidence-link contract is worth extracting

**Hypothesis:** A common evidence reference used by Timeline, ACH, Behavior, and
Content Research reduces adapter code and orphaned links by at least 30% without
losing framework-specific fields.

**Falsifier:** Two or more consumers require incompatible semantics or migration
creates >2% broken links. Keep adapters instead of forcing a universal entity.

## Next phases

### Phase 2 — Durable investigation artifact

- Until this phase ships, product copy must describe workspace saving and
  collaboration as unavailable and direct users to JSON export for retention or
  sharing; signing in alone does not make the browser overlay durable.
- Add authenticated Timeline create/read/update endpoints scoped to writable
  workspaces, with optimistic versioning and an append-only audit trail.
- Promote the browser draft only through an explicit sign-in/save action.
- Replace answer-level URL strings with canonical Evidence IDs while retaining
  external URL snapshots for export.
- Add explicit `Promote finding to event`; require date, source, provenance, and
  analyst confirmation.
- Convert open questions into RFI/Answer Packet items and sync their status back
  to the timeline.

### Phase 3 — Tool round trips

- Agentic Research: return approved results to the originating question through
  a signed, workspace-scoped artifact reference.
- Content Research: attach extracted passages/claims as evidence to a question
  or event, never just the page URL.
- ACH: export selected timeline hypotheses plus linked evidence, preserving
  tentative status and stable IDs.
- Evidence Library: show every event/question that consumes an evidence item and
  warn before unlinking the last support for a corroborated event.

### Phase 4 — Framework links

- Add `Analyze as behavior` on selected events only. The handoff asks the analyst
  to define the repeatable action and required location before opening L1.
- Let Behavior Analysis cite historical Timeline events as observations while
  keeping its actor-decision sequence separate.
- Complete the Behavior Timeline editor for decision type, psychological state,
  competing behaviors, coping branches, editable sub-steps, and editable forks.
- Fix and version the behavior timeline AI contract before exposing generation
  again; include the already-built behavior context and validate every field.
- Keep COM-B/BCW reachable only from a valid linked Behavior Analysis.

### Phase 5 — Cross-framework temporal views

- Extend event time without false precision: exact/partial date, bounded
  interval, `circa`, and explicit unknown date. Preserve the original temporal
  claim and normalize only for sorting/filtering.
- Add structured actor, organization, location, and event-relation links
  (`precedes`, `overlaps`, `supports`, `contradicts`, and analyst-asserted
  `possibly_causes`). Do not treat chronological adjacency as causation.
- Investigation/COP: render a read-only union of linked events with filters for
  actor, geography, framework, confidence, and source.
- PMESII-PT/DIME/Stakeholder/COG: link framework findings to event IDs and render
  filtered temporal overlays; do not copy events into each framework payload.
- Add bitemporal fields (`occurred_at` and `learned_at`) once durable ingestion
  exists, so analysts can distinguish when an event happened from when it became
  known.
- Benchmark multi-source event resolution before auto-merge. Required gate:
  >=30% duplicate reduction with <2% incorrect merges on a labeled corpus.

## Analytics and operational checks

Record privacy-safe events only after the durable analytics contract is agreed:

- timeline start type (`manual` or `article`), not the title or question text;
- first event/question completion;
- question-to-collection handoff and approved-result count;
- finding recorded, source attached, and explicit event promotion;
- ACH/Behavior handoff accepted or abandoned;
- draft expiry/resume counts; and
- validation, auth, rate-limit, model refusal, and persistence conflict rates.

Do not log timeline contents, research questions, answers, source URLs, or analyst
notes in product analytics. Operational logs should use request/artifact IDs and
error classes only.
