# Evidence-First Timeline Platform Roadmap

**Status:** Proposed implementation roadmap

**Date:** 2026-09-11

**Execution status:** TL-00, TL-02 and TL-03 are released. Human APIs, complete
browser snapshots and independently scoped service read/write are deployed on both
main refs with migrations 0011–0013. Existing service grants are unchanged. See the
[service release receipt](./2026-09-11-timeline-service-release-receipt.md).
Three bounded TL-04 slices are also deployed: analyst-entered source assertions,
passage snapshots, declared derivation, explicit corroboration review, scoped
analytic judgments, retained self-attributed dissent and exact passage import
from complete owned Content Research extractions into opened private timelines.
Likelihood and analytical confidence remain separate; reviews preserve the judgment
version they addressed. Import verifies stored-text equality, not source truth or
authenticated historical provenance. TL-04 remains in progress: broader source-store
support, dedicated judgment services and authenticated peer review are pending.
See the [source import release receipt](./2026-09-11-timeline-source-import-release-receipt.md),
preceding [judgment release receipt](./2026-09-11-timeline-judgment-release-receipt.md)
and [evidence release receipt](./2026-09-11-timeline-evidence-release-receipt.md).
The remaining proposed capabilities below are not shipped merely because their
contracts are described here.
Delivery checkpoints and dependency corrections are maintained in the
[implementation register](./2026-09-11-timeline-implementation-register.md).

**Scope:** External API consumers, Signal commands, RSS article and story
timelines, ResearchTools Event Timeline extraction and analyst workspace,
evidence linkage, analytic judgments and structured tradecraft, living-timeline
updates and warning, multi-scale temporal composition, falsifiable comparison,
versioned fork/merge, event and operational planning, narrative presentation,
publishing, and demo corpus.

**Related work:**

- [Timeline Investigation and Framework Integration Plan](./2026-09-08-timeline-investigation-integration.md)
- [COP Timeline Hub Design](../superpowers/specs/2026-03-13-timeline-hub-design.md)
- [Community Integrations API](../api/COMMUNITY-INTEGRATIONS-API.md)
- [ResearchTools Roadmap](../ROADMAP.md)

## Reading and executing this roadmap

- [Implementation register](./2026-09-11-timeline-implementation-register.md):
  checkpoints, prerequisites, contract decisions, verification, and release state.
- [Outcome](#outcome) and [product decisions](#product-decisions): scope and
  semantics for research, narrative, planning, comparison, and composition.
- [External API access](#external-api-access): current availability and future
  service contracts.
- [Target information model](#target-information-model): identities, evidence,
  temporal claims, revisions, composition, tests, and decisions.
- [Delivery roadmap](#delivery-roadmap): all ten phases and their exit gates.
- [Case-study corpus](#case-study-and-demo-corpus) and [demo scripts](#demo-scripts):
  extraction, investigation, nested behavior, comparison, planning, and updates.
- [Quality gates](#cross-cutting-quality-gates), [success measures](#success-measures),
  and [implementation order](#recommended-implementation-order): acceptance and sequencing.

The register resolves implementation dependencies across the thematic phases.
Its checkpoint status records implementation progress; phase descriptions and
illustrative payloads state intended behavior and do not establish availability.

## Outcome

The IrregularChat timeline ecosystem should support four complementary jobs
without confusing them:

1. An **analyst ledger** that preserves every relevant event, gap, source,
   uncertainty, correction, and hypothesis.
2. A **narrative view** that selects and sequences only the events needed to
   explain a coherent chronological account.
3. A **plan view** that turns objectives into scheduled, assigned, dependent
   work and compares the approved plan with execution without recasting planned
   actions as events that already happened.
4. A **comparison lab** that can align different accounts, test competing
   explanations or plans against shared evidence, and review changes between
   versions without erasing disagreement, uncertainty, or provenance.

A chronology is an input to analysis, not the conclusion. The ledger must also
preserve the explicit chain from source assertion to event assessment to
assumption, alternative hypothesis, indicator, and analytic judgment. Those
objects may be displayed together, but they must never be flattened into one
undifferentiated list of “events.”

Within a ResearchTools investigation, the analyst ledger is authoritative for
analyst edits and narrative selection. Narrative view references ledger events
by stable ID; it does not copy them into a second source of truth. This is a
scoped authority: it does not replace the Signal community event graph or the
immutable `timeline-analysis.v1` extraction result.

Plan view is another projection of the investigation, but its objectives,
tasks, milestones, dependencies, assignments, baselines, and contingencies are
separate plan objects. Completing a task can link it to an Activity Timeline
entry or assessed real-world event; it does not convert the plan item in place
or erase what was originally intended.

Three kinds of divergence must remain separate. A **lineage branch** is a
working-copy fork from an immutable revision. An **analytic alternative** is a
competing explanation or future pathway evaluated against evidence. A **plan
option** is a possible course of action evaluated against objectives,
constraints, risks, and expected effects. They may use one comparison engine,
but creating, selecting, or merging one must never imply the same action for the
others.

Timelines must also be composable across scale. A major incident can contain an
episode-level chronology, overlay several organizations' simultaneous activity,
and link a Behavior Analysis sequence for one actor or repeated behavior. The
parent does not absorb those records. It stores a typed, revision-aware
composition link and can render a bounded projection with drill-down, synchronized
time, and explicit uncertainty.

This incorporates the central editorial guidance from
[Knight Lab TimelineJS](https://timeline.knightlab.com/docs/index.html): keep a
reader-facing timeline focused, choose material with a strong chronological
shape, treat each event as part of the larger narrative, and include the buildup
that makes pivotal moments understandable. Knight Lab recommends no more than
about 20 slides for a timeline a reader is expected to click through. The full
analyst ledger can be much larger; the default narrative view should not be.

## Current cross-product map

Audited against the Signal, RSS, and ResearchTools implementations on
2026-09-11:

| Surface | Current user-facing language | What it displays today | Authority and scope |
| --- | --- | --- | --- |
| External service API | `timelineAnalysis` capability and `timeline-analysis.v1` | Versioned article metadata, up to 100 dated event candidates, extraction provenance, and model status | Synchronous, non-persistent compute for an operator-provisioned service principal with `community.research.execute` |
| Signal single-source command | `!timeline <url>` and `Timeline: <title>` | Up to 60 extracted/synthesized dated events, article summary, key actors, gaps, related coverage, and an RSS `#timeline` link | Command/orchestration surface; persists the article result and community graph but is not an analyst workspace |
| Signal multi-source command | `!timeline <url1> <url2> …` and `Merged timeline` | Canonical event clusters from up to four requested articles with per-cluster source counts | Temporary chat rendering of the shared community graph |
| Signal story command | `!story <topic>` and `Story: <label>` | The latest 30 of the matching canonical events, corpus coverage, related topics, analysis state, and an RSS story link | Read-only query over the shared community graph |
| RSS article page | `Article timeline`, `Build this article’s timeline`, `Generate timeline`, or `Try timeline again` | A compact article summary, date/title events, importance marks, key actors, gaps, and questions when at least three dated events exist | Stored article display blob produced by the Signal pipeline; the action already invokes the same server workflow as `!timeline` |
| RSS story page | `Story so far`, with `Timeline` in the page contents | Cross-article canonical events grouped into periods, source counts, entities, oldest/latest sort, search/filter controls, freshness checks, and source-corpus coverage | Read-only community record from Signal/Postgres; it is not yet an editorial narrative |
| ResearchTools dedicated tool | `Timeline Analysis`, `Start with what you know`, `Extract an article`, `Save timeline`, and `Open saved timeline` | Immutable extraction, Basic/Robust analyst workspace, narrative chapters, source assertions, owned stored-passage import, analytic judgments, retained dissent, gaps, questions, findings, AI suggestions, sort and jump navigation | Local drafts for guests; complete private immutable workspace snapshots up to 60 KiB for active humans, with revision guards and saved links. Scoped service APIs are available with separately assigned read/write grants. |
| ResearchTools Content Research | `Create a source-backed timeline`, `Generate Timeline`, and `Open Dedicated Tool` | The same ResearchTools timeline workspace, using already-extracted article text | Analysis entry point; avoids a second fetch but does not create a community story event |
| ResearchTools planning | No dedicated planning surface today | No objectives, scheduled work, dependencies, assignments, baselines, or plan-versus-actual view | Explicitly unimplemented; future Plan view belongs to a durable investigation artifact and must not be inferred from forecast events |
| ResearchTools ACH and Cross Table | Separate hypothesis/evidence scoring and generic decision matrices | ACH stores hypotheses, evidence links, integer consistency scores, and derived diagnosticity/likelihood displays; Cross Table supports options, criteria, several scoring scales, weighting, sensitivity, and Delphi rounds | Useful presentation/calculation components, but neither is linked to immutable timeline revisions, knowledge cutoffs, source assertions, collection coverage, or semantic fork/merge |
| ResearchTools Behavior Timeline | `Behavior Timeline`, inline sub-steps/forks, and `Link Behavior` | An ordered actor-decision sequence with free-text/relative time, psychological-state and COM-B hypotheses, recursive fork paths, and a linked Behavior Analysis ID plus cached title/type | Framework-local JSON and editor state; child paths have no independent revision/provenance, and links do not pin a behavior artifact revision or define how its clock maps into an investigation timeline |
| RSS entity and ResearchTools COP views | `Activity Timeline` or `Timeline` | Activity counts, investigation actions, or system events | Aggregate or operational/audit chronology, not the Event Timeline product |

The present service flow is:

```text
ResearchTools timeline-analysis.v1 extraction service
        ↓
Signal !timeline or RSS “Generate timeline” orchestration
        ↓
article timeline blob + Signal/Postgres canonical community event graph
        ↓
Signal chat preview + RSS /link article view + RSS /story community view

ResearchTools browser UI ──calls the same extraction service──→ local analyst overlay
```

This means RSS already initiates the Signal article-timeline workflow from an
eligible `/link/:id` page. The missing connection is a separate, explicit way
to continue an article or cross-article story as an investigation inside
ResearchTools. The roadmap must not relabel the existing RSS generation action
as if it opened ResearchTools.

## Naming and action contract

Use the word **timeline** as the family name, then add a qualifier that tells the
user what kind of timeline they are looking at:

| Term | Reserved meaning |
| --- | --- |
| **Timeline Analysis** | ResearchTools catalog/tool-family name |
| **Article timeline** | Dated-event extraction from one source article |
| **Merged timeline** | A bounded multi-article result requested in Signal |
| **Story so far** or **story timeline** | RSS cross-article community event record for a topic |
| **Investigation timeline** | ResearchTools analyst-owned working artifact |
| **Narrative view** | Curated reader presentation selected from an investigation timeline |
| **Plan view** or **planning timeline** | Authorized future work: objectives, milestones, scheduled tasks, assignments, dependencies, decision points, and contingencies |
| **Comparison view** | A reproducible projection that names its inputs, revisions, cutoff, alignment decisions, method, and unresolved differences |
| **Composite timeline** | A bounded view over two or more named temporal scopes or pinned timeline revisions; it is a projection, not a new global source of truth |
| **Temporal scope** | A named episode, phase, behavior sequence, source account, operational period, or track within one timeline artifact |
| **Child timeline** or **temporal facet** | A separately governed timeline artifact linked into a host scope for expansion, context, behavior, planning, or another typed purpose |
| **Lineage branch** | A mutable working pointer forked from one immutable artifact revision; not a hypothesis or plan option |
| **Analytic alternative** | A competing explanation or scenario evaluated against common observations and tests |
| **Plan option** | A candidate course of action evaluated against objectives, assumptions, constraints, risks, and expected effects |
| **Activity timeline** | COP, entity, or system activity history; never an article/story synonym |

Avoid using **Story view** for the future ResearchTools presentation mode. RSS
already uses `Story` and `Story so far` for the cross-article community page;
**Narrative view** makes the editorial function explicit.

Use verbs consistently:

- **Build article timeline** starts extraction/synthesis for one article.
- **Open article timeline** navigates to an existing RSS `#timeline` section.
- **Refresh article timeline** deliberately rebuilds an existing article result.
- **Explore story timeline** opens the RSS cross-article `Story so far` record.
- **Continue in ResearchTools** opens or imports an investigation timeline.
- **Open Narrative view** enters the curated presentation of an investigation.
- **Open Plan view** enters the schedule for intended work; **Schedule action**
  creates a plan item but never executes the action.
- **Compare** creates or opens a reproducible comparison; it does not mutate an
  input.
- **Fork working copy** creates a lineage branch from a named revision;
  **Create alternative** creates an analytic or planning candidate without
  copying shared facts.
- **Propose merge** opens a reviewable merge request; only **Apply approved
  merge** creates a two-parent revision.
- **Expand timeline** opens a same-artifact temporal scope in context; **Open
  child timeline** navigates to the independently governed artifact.
- **Overlay timeline** adds a pinned or explicitly tracking temporal facet to a
  composite view; it never copies or merges the child by implication.

Do not use a generic **Start timeline** button when the action's destination is
ambiguous. A creation action and a cross-product navigation/import action must
remain visibly separate.

## External API access

Signal and RSS should be reference clients of a reusable timeline service, not
the only privileged ways to reach it. Newsrooms, research teams, incident
response systems, case-management products, archives, data pipelines, and
approved agents should be able to use the same bounded contracts.

### What integrations can use now

The current server-to-server path is documented in the
[Community Integrations API](../api/COMMUNITY-INTEGRATIONS-API.md):

1. Discover `timelineAnalysis` and its contract version with
   `GET /api/integrations/capabilities`.
2. Use an operator-provisioned `rt_svc_` bearer bound to one community,
   workspace, investigation, environment, visibility ceiling, and service
   principal.
3. Hold the exact `community.research.execute` scope.
4. Call `POST /api/tools/extract-timeline` with
   `schemaVersion: timeline-analysis.v1` and either a safe HTTP(S) URL or a URL
   plus bounded supplied article text.

The v1 service contract is synchronous and non-persistent. It accepts up to
100 KiB of supplied text in a request of at most 112 KiB, analyzes at most
64,000 selected characters, and returns no more than 100 normalized events.
Every event has a precision-preserving year, month, or day; invalid dates are
rejected. Success includes extraction/model provenance, and service failures
use `integration-error.v1` with server request and optional caller correlation
IDs.

This is an **event-candidate extraction API**, not a verification, narrative,
canonicalization, or publishing API. Its output has no stable event IDs,
event-level evidence locators, intervals, timezones, revisions, cross-source
identity, or durable artifact. Consumers must not label v1 events corroborated
or treat model importance as narrative role.

Current onboarding is also intentionally limited: credentials are provisioned
by an operator, capability discovery is the only proof that a service operation
is enabled, the discovered `limits` object does not yet advertise timeline
quota/concurrency, and there is no self-service credential API. Browser guest
access through ResearchTools is a separate user experience and must not be
presented as anonymous third-party API access.

### Functionality that is not reusable yet

Several capabilities visible in first-party products are not current public
service contracts:

- Signal adds a second synthesis step for summary, key actors, importance marks,
  gaps, questions, chat formatting, and related coverage.
- Signal/Postgres performs community event matching and powers multi-URL
  `!timeline` plus cross-article `!story` queries.
- ResearchTools `timeline-assist.v1` generates reviewable gaps, questions, and
  hypotheses, but is intentionally a browser/analyst endpoint and is not
  advertised as a service capability.
- The ResearchTools Basic/Robust overlay, manual draft, findings, and handoffs
  are browser state rather than durable APIs.
- RSS story data and its graph are product-specific read models, not stable
  integration contracts.

External clients must not scrape those interfaces or infer support from their
existence. Promote reusable behavior into explicit, versioned capabilities:

- `timelineAnalysis` for one-source candidate extraction;
- a future `timelineReview` for non-mutating gap/question/narrative-role
  suggestions tied to supplied event IDs;
- a future `timelineResolution` for multi-source candidate matching with scores
  and reasons, never silent investigation merges;
- a future `timelineArtifacts` for durable investigation lifecycle;
- a future `timelineComposition` for named temporal scopes, revision-pinned
  child links, clock/anchor mappings, bounded composite projections, and
  reusable timeline-template instances;
- a future `timelineComparison` for revision diffs, independently authored
  chronology alignment, ACH-style alternative matrices, falsification tests,
  and plan-versus-outcome evaluation;
- a future `timelineBranching` for immutable lineage branches, semantic merge
  proposals, conflicts, resolutions, and two-parent merge revisions;
- a future `timelinePlanning` for objectives, plan items, dependencies,
  baselines, operational periods, and plan-versus-actual reads; and
- a future `timelinePresentation` for immutable reads and exports.

Signal should eventually consume the same review/preview contracts offered to
other clients instead of retaining a permanently privileged synthesis schema.
The existing Signal implementation remains the compatibility client while those
contracts are extracted and benchmarked.

### Supported integration modes

| Mode | Consumer example | Required product behavior |
| --- | --- | --- |
| Extract only | CMS, newsroom plugin, notebook, one-off research script | Return a versioned immutable analysis result with provenance and no persistence |
| Bring your own content | Licensed archive, transcript system, browser extension, internal document pipeline | Accept bounded text plus acquisition metadata without fetching the source again |
| Build an investigation | Case-management or research platform | Create a durable timeline, import candidates, attach evidence, and preserve external IDs under workspace authorization |
| Multi-source processing | Monitoring pipeline or incident-response system | Run bounded asynchronous jobs, preserve per-source lineage, and return candidate matches rather than silently merging analyst artifacts |
| Structured analysis | Intelligence, risk, fact-checking, or investigative platform | Read/write judgments, assumptions, alternatives, indicators, and auditable technique runs without recasting them as events |
| Compose temporal views | Investigation, COP, behavior framework, program dashboard, or case-management system | Link same-artifact scopes or independently versioned timelines, map relative anchors, and request a bounded roll-up/drill-down projection without copying child records |
| Compare or challenge | Team A/Team B, peer review, fact-checking, model evaluation, or audit | Compare named immutable revisions or aligned artifacts, register disconfirming observations, and preserve unresolved differences |
| Plan an event or operation | Event team, incident-management system, newsroom, research project, or operations center | Create objectives, operational periods, tasks, assignments, dependencies, decision points, baselines, and status updates without executing external actions |
| Follow updates | News monitor, source archive, or alerting system | Compare against a recorded revision, emit changes, and support polling or signed webhooks |
| Present or embed | Publisher, briefing portal, or public report | Read an immutable published version or request a TimelineJS-compatible export without exposing private analyst state |
| Agent or MCP tool | Approved research agent operating for a user or workspace | Discover capabilities, use least-privilege delegated authority, cite evidence, and submit all mutations for review |

### API layers and ownership

Do not overload one extraction endpoint with every lifecycle operation. The
platform should expose seven separable layers:

| Layer | Contract responsibility | Side effects |
| --- | --- | --- |
| Analysis | Convert one source into evidence-linked event candidates | None beyond bounded operational telemetry/cache |
| Artifact | Create/read/update investigation timelines, events, questions, evidence links, narrative selections, and revisions | Authorized durable writes with audit |
| Composition and projection | Define temporal scopes, revision-aware child links, relative-time mappings, template instances, and bounded multi-timeline projections | Link/view state only; never mutates or recursively merges a child artifact |
| Comparison and lineage | Align immutable inputs, evaluate alternatives, fork working branches, and review semantic merge proposals | Comparison reads are non-mutating; an approved merge creates a new revision but never rewrites either parent |
| Planning | Create/read/update objectives, operational periods, plan items, dependencies, assignments, decisions, contingencies, baselines, and status | Authorized plan-state changes only; never performs the scheduled real-world action |
| Job and subscription | Process multiple sources, refresh watched inputs, and calculate revision differences | Asynchronous, idempotent, workspace-scoped writes |
| Presentation | Read published versions and produce first-party, TimelineJS JSON, or compact preview representations | No mutation of the underlying investigation |

`timeline-analysis.v1` remains supported for existing consumers. The eventual
`timeline-analysis.v2` should continue to be a compute contract rather than
quietly creating an artifact. Resource-oriented artifact and job routes should
be introduced separately. Illustrative route families, subject to an API design
review, are:

```text
POST   /api/tools/extract-timeline                 # v1/v2 stateless analysis
POST   /api/tools/review-timeline                  # non-mutating suggestions
POST   /api/timelines                              # create investigation artifact
GET    /api/timelines/{timelineId}                 # artifact metadata
PATCH  /api/timelines/{timelineId}                 # If-Match protected update
GET    /api/timelines/{timelineId}/events          # cursor/filter/sort read
POST   /api/timelines/{timelineId}/sources         # attach/import source
GET    /api/timelines/{timelineId}/assertions      # source-specific claims
GET    /api/timelines/{timelineId}/judgments       # conclusions and uncertainty
POST   /api/timelines/{timelineId}/technique-runs  # auditable SAT workspace
GET    /api/timelines/{timelineId}/technique-runs  # runs and immutable inputs
GET    /api/timelines/{timelineId}/indicators      # warning/monitoring state
POST   /api/timelines/{timelineId}/scopes          # named episode/phase/track
POST   /api/timelines/{timelineId}/compositions    # link scope or child revision
GET    /api/timelines/{timelineId}/compositions    # authorized composition graph
POST   /api/timelines/{timelineId}/instances       # instantiate temporal template
GET    /api/timelines/{timelineId}/projection      # bounded resolved composite
POST   /api/timelines/{timelineId}/alternative-sets # hypothesis/scenario/plan candidates
POST   /api/timelines/{timelineId}/test-criteria    # preregister observables/falsifiers
POST   /api/timeline-comparisons                    # diff/alignment/matrix/evaluation
GET    /api/timeline-comparisons/{comparisonId}/differences
POST   /api/timeline-comparisons/{comparisonId}/alignments
POST   /api/timelines/{timelineId}/lineage-branches # fork from named revision
POST   /api/timelines/{timelineId}/merge-requests   # semantic three-way proposal
POST   /api/timeline-merge-requests/{mergeId}/resolutions
POST   /api/timeline-merge-requests/{mergeId}/apply # approved two-parent revision
POST   /api/timelines/{timelineId}/plans            # create planning projection
GET    /api/timelines/{timelineId}/plan-items       # tasks/milestones/decisions
POST   /api/timelines/{timelineId}/plan-baselines   # immutable approved snapshot
GET    /api/timelines/{timelineId}/plan-variance    # baseline/current/actual
GET    /api/timelines/{timelineId}/revisions       # immutable history
GET    /api/timelines/{timelineId}/changes         # compare from revision
POST   /api/timeline-jobs                          # async extract/refresh/merge review
GET    /api/timeline-jobs/{jobId}                  # status and result reference
POST   /api/timelines/{timelineId}/publications    # immutable published version
GET    /api/timelines/{timelineId}/exports/{format}
```

List endpoints must use opaque cursor pagination and stable secondary ordering,
not unbounded event arrays or offset pagination. Sort direction is a query/view
choice and never changes artifact order. Mutation routes require idempotency
keys where a retry could duplicate an event, source, job, revision, or
publication, and must use optimistic concurrency through ETags or explicit
revision preconditions.

### Timeline analysis v2 contract goals

The next analysis version should add only what a source-analysis client needs:

- a client request key for safe retry and an optional opaque client reference;
- generic supplied-content acquisition metadata instead of forcing every
  external caller into the first-party `bot-scrape`, `content-intelligence`,
  `publisher-feed`, or `browser-render` vocabulary;
- retrieval time, canonical/final URL, media type, content hash, language, and
  optional rights/usage metadata;
- instants, partial dates, intervals, named timezones, circa/relative/unknown
  temporal claims, and original display text;
- distinct event-occurrence, source-observation, report/publication, and
  retrieval clocks when the input supplies them, without filling absent clocks
  from one another;
- response-scoped stable event IDs or versioned fingerprints that do not claim
  global identity;
- event-level evidence locators such as passage IDs or bounded character/page/
  transcript offsets;
- source-assertion identifiers so a consumer can preserve two conflicting
  source chronologies without forcing them into one normalized event claim;
- explicit `reported` epistemic type, without inferred corroboration;
- warnings for truncated input, selected excerpts, rejected events, unresolved
  relative dates, or unsupported precision; and
- deterministic ordering and JSON Schema validation.

Narrative roles, analyst assessments, cross-source merge decisions, corrections,
and publication state belong to the artifact layer. A compute response may
suggest narrative roles only under a distinct opt-in contract that cites source
event IDs and cannot publish or mutate an investigation.

### Authentication, scopes, and capability discovery

Keep the current non-interactive service credential boundary for server-side
integrations. Never place an `rt_svc_` secret in a webpage, browser extension,
mobile application, Signal message, or client-distributed package. Third-party
browser experiences must call their own backend or use a later delegated-user
authorization flow with PKCE and narrowly scoped, short-lived tokens.

Add an administrator-facing onboarding path before general availability to
create, rotate, expire, and revoke service credentials; choose exact scopes;
assign budgets and rate/concurrency limits; restrict allowed origins or webhook
destinations where applicable; and inspect a content-free audit log. Plaintext
secrets are shown once and are never retrievable later.

Continue using `community.research.execute` for v1/v2 stateless extraction. Do
not reuse broad `community.events.write` or COP scopes for investigation
editing. Add explicit least-privilege scopes before durable routes ship, for
example:

- `community.timelines.read`;
- `community.timelines.write`;
- `community.timeline_compositions.read`;
- `community.timeline_compositions.write`;
- `community.timeline_comparisons.read`;
- `community.timeline_comparisons.write`;
- `community.timeline_merges.approve`;
- `community.timeline_plans.read`;
- `community.timeline_plans.write`;
- `community.timelines.publish`; and
- the existing `community.jobs.read` and `community.webhooks.manage` only when
  those capabilities are actually executable.

Capability discovery must remain authoritative and advertise contract versions,
enabled operations, content/event/batch limits, concurrency, retention, webhook
support, supported structured-technique identifiers, and accepted export
formats. Planning capability discovery must also identify supported dependency
types, status vocabularies, maximum plan size, and whether baseline, critical-
path, or calendar export is available. Comparison discovery must identify
supported comparison types, candidate and cell vocabularies, maximum input and
candidate counts, alignment methods, merge-conflict types, and whether
branch/merge writes are enabled. An endpoint existing in source code or a client
possessing a scope is not proof that the operation is available.
Composition discovery must identify supported scope/composition kinds,
coordinate systems and interval relations, pinned/tracking policies, maximum
expansion depth and resolved-node count, projection formats, and whether
template instantiation is enabled.
Tenant, workspace, investigation, environment, and visibility bindings remain
server-side authority; caller headers cannot broaden them.

Before general availability, enforce per-client and per-community request,
concurrency, token/cost, and storage budgets. Return the applicable limit class
and retry window without exposing another tenant's usage. Do not promise a
public pricing model until usage and corpus benchmarks establish sustainable
costs.

### Asynchronous jobs, updates, and webhooks

Keep single-source v1 analysis synchronous for compatibility while it remains
within a bounded request duration. Use `202 Accepted` jobs for multi-source
analysis, large document sets, refresh, comparison, large composite projection,
or any task likely to exceed an interactive request window.

Job responses should include job ID, status URL, operation, submitted time,
expiry/retention, and retry guidance. Status transitions are monotonic and
terminal results refer to immutable analysis or artifact revisions. A repeated
idempotency key returns the original job instead of starting another model run.

Support signed, replay-resistant webhooks only after polling is stable. Useful
events include:

- `timeline.analysis.completed`;
- `timeline.update.candidates_ready`;
- `timeline.indicator.changed`;
- `timeline.judgment.revised`;
- `timeline.plan.baselined`;
- `timeline.plan.variance_changed`;
- `timeline.comparison.ready`;
- `timeline.test.evaluation_changed`;
- `timeline.merge.conflicts_ready`;
- `timeline.merge.applied`;
- `timeline.composition.child_revision_available`;
- `timeline.composition.projection_ready`;
- `timeline.revision.created`;
- `timeline.published`; and
- `timeline.correction.published`.

Webhook payloads should contain IDs, revision numbers, status, and authorized
links by default—not private event text. Signatures, timestamp tolerance,
delivery IDs, retry schedule, dead-letter visibility, and consumer deduplication
must be documented and tested.

Planning endpoints and webhooks manage representations of intended work. They
must not send messages, reserve resources, modify calendars, dispatch personnel,
or invoke another system merely because a task becomes due or an indicator
changes. Any future execution connector needs its own capability, authorization,
approval policy, idempotency contract, and audit trail.

### Developer experience and compatibility

Before calling the service generally available:

- publish OpenAPI 3.1 and JSON Schemas generated or checked against the same
  TypeScript contract used by the endpoint;
- provide minimal curl, TypeScript, and Python examples for URL and supplied-
  content analysis, error handling, polling, and pagination;
- provide a non-production sandbox credential and frozen sample sources with no
  billable or private side effects;
- add consumer-driven contract tests for Signal, RSS, a generic server client,
  and at least one SDK;
- document rate limits, `Retry-After`, timeouts, safe retries, data retention,
  model/version change policy, and cost/usage accounting;
- publish a changelog and deprecation window; additive fields remain safe to
  ignore, while breaking changes require a new schema version; and
- return machine-readable `rate_limited`, `conflict`, and
  `precondition_failed` errors before exposing durable or asynchronous routes.

The API should return contract-defined JSON data, not rendered HTML. Presentation
clients choose their own layout, while the presentation/export layer can provide
first-party HTML and TimelineJS JSON as explicit formats. CSV may be offered as
a lossy convenience export but must never be the round-trip format for
uncertainty, evidence, relations, or revision history.

MCP servers and agent tools should be thin adapters over these same contracts.
They discover capabilities, preserve request and revision IDs, expose evidence
references, and require confirmation for mutations; they must not scrape the
ResearchTools UI or maintain an incompatible timeline schema.

## Intelligence-tradecraft gap audit

The roadmap was checked against public CIA structured-analysis guidance, ODNI
analytic and sourcing standards, UK Defence intelligence doctrine and
professional standards, U.S. Army event-template doctrine, and UK policing
analysis guidance. These sources agree on a useful boundary: chronology helps
an analyst organize and inspect information, but rigor comes from exposing the
reasoning, uncertainty, source quality, alternatives, and information gaps that
connect the chronology to a judgment.

The most relevant findings are:

- For a timeline workflow, the CIA tradecraft primer's most relevant techniques
  are **Key Assumptions Check**, **Quality of Information Check**, **Indicators
  or Signposts of Change**, and **Analysis of Competing Hypotheses**. Its ACH
  method emphasizes inconsistent and diagnostically useful evidence,
  sensitivity to critical evidence, expected-but-absent evidence, deception,
  and continued monitoring of weaker hypotheses.
- ACH provides the right comparison shape: alternatives are evaluated together
  against the same evidence, and evidence that is inconsistent with one or only
  a few alternatives is more useful than evidence compatible with all of them.
  This argues for an evidence-by-alternative matrix and explicit falsification
  criteria, not parallel narrative pages or a single blended score.
- ODNI ICD 203 requires products to describe source quality, explain
  uncertainty, distinguish information from assumptions and judgments,
  consider alternatives, show the logical argument, and explain why a judgment
  changed or remained stable. It also separates likelihood of an outcome from
  confidence in the basis for that judgment.
- ODNI ICD 206 and ICS 206-01 make citations retrievable and attach them to the
  specific judgment, estimate, alternative, or confidence statement that
  depends on them. Dynamic public or commercial sources that materially shape
  a conclusion need preservable records, not only live URLs.
- UK JDP 2-00 treats structured techniques as aids to human reasoning and as an
  audit trail that supports review, replication, sharing, and analyst handoff.
  It distinguishes source confidence, outcome probability, and analytical
  confidence, and records what information was available at a given time and
  where it originated.
- Army event templates and matrices connect a possible course of action to
  expected indicators, time, place or condition, and decision points. They are
  warning and collection-planning products, not ordinary historical events.
- The GAO Schedule Assessment Guide treats an integrated schedule as a model of
  all work required to reach major events. It calls for logically sequenced
  activities, resources and realistic durations, a valid critical path and
  float, schedule-risk analysis, updates from actual progress, and a controlled
  baseline against which variance is measured.
- FEMA incident action planning separates incident priorities and objectives
  from strategies, tactics, work assignments, resources, safety, and results.
  The plan is renewed for explicit operational periods, giving fast-moving
  operations a review cadence instead of one endlessly edited schedule.
- Operations doctrine adds decision points, branches, and sequels so that a base
  plan can adapt when anticipated conditions, opportunities, or disruptions
  occur. These are authorized choices in a plan, not predictions that one
  branch will happen.
- UK policing guidance uses thematic sequence lanes—people, groups, places,
  vehicles, communications, and other evidence streams—to find behavioral
  patterns, gaps, and discrepancies. It also expects version control, an audit
  trail, and peer or managerial review.
- Heuer and Pherson's **Chronologies and Timelines** technique is explicitly
  diagnostic: ordering events should make patterns, relationships, anomalies,
  information gaps, and unexplained periods easier to test. The product should
  prompt that analysis rather than stopping after it draws the chart.
- Multi-scale timelines must preserve the analytical status of their parts. A
  Behavior Timeline step may be an analyst model of an actor's decision process,
  while an investigation event is a claim about the world and a plan item is
  intended work. Putting them on one time axis can clarify their relationship,
  but must not make their epistemic types interchangeable.

The resulting product gaps and roadmap decisions are:

| Priority | Gap in the prior roadmap | Required capability |
| --- | --- | --- |
| P0 | An event can summarize several sources, but the source-specific claims disappear beneath it | Add immutable source assertions with their own wording, temporal claim, locator, origin, and report/acquisition clocks; an assessed event links to one or more assertions |
| P0 | `occurredAt` and `learnedAt` alone do not reconstruct what happened versus what analysts could know at the time | Add switchable **World chronology** and **Knowledge chronology** views over shared objects, preserving observed, reported, published, retrieved, analyst-recorded, and communicated times when available |
| P0 | Events, evidence, and notes exist, but a major analytic conclusion is not a first-class object | Add analytic judgments with scope, as-of date, supporting and contrary evidence, reasoning, alternatives, assumptions, likelihood, and separately stated analytical confidence |
| P0 | Source count can be corrected without establishing whether sources are independent | Model source derivation and possible circular reporting; run a Quality of Information Check before permitting a strong corroboration claim |
| P0 | Planned work could be represented as forecast or manually entered “events” | Add a distinct Plan view and typed plan objects; a proposed or scheduled action never appears as an observed event or analytic forecast |
| P1 | Questions and hypotheses exist, but assumptions are not registered or periodically challenged | Add an assumption register with confidence basis, dependency, invalidation conditions, owner, last-reviewed date, and impact if wrong |
| P1 | Hypotheses are suggestions rather than a comparative analytic workspace | Add an ACH overlay with evidence-by-hypothesis consistency, diagnosticity, sensitivity, expected-but-absent evidence, and deception notes; do not reduce it to an unexplained score |
| P0 | Existing ACH integer scores and derived `0–100` “likelihood” are disconnected from timeline revisions and can be mistaken for calibrated probability | Preserve the existing ACH scale through an adapter, label its calculated result as a heuristic inconsistency ranking, and make categorical evaluation, evidence, rationale, cutoff, collection coverage, and analyst judgment canonical in the timeline comparison model |
| P0 | “Compare timelines” could mean change history, conflicting accounts, alternative explanations, or plan performance | Add explicit `revision_diff`, `cross_timeline_alignment`, `alternative_matrix`, and `plan_outcome` comparison types with different inputs, outputs, and permissions |
| P0 | A missing event can appear to falsify a hypothesis even when nobody could have observed it | Gate negative evidence on an observation window, collection state, source or sensor capability, coverage, and analyst-reviewed `observed_absent`; `not_collected` and `collection_failed` remain inconclusive |
| P1 | Expected observations and success criteria can be rewritten after results are known | Add immutable, revision-bound test criteria with observables, thresholds or categorical outcomes, time/place/population scope, required coverage, and candidate-specific disconfirmation meaning |
| P1 | Timeline history is linear and cannot preserve independent work or merge provenance | Add lineage branches over an immutable revision DAG, object-level semantic changes, three-way merge from a common ancestor, typed conflicts, reviewed resolutions, and two-parent merge revisions |
| P1 | Two independently created timelines lack common object identity | Add reviewable alignment groups for same event, partial overlap, different event, unresolved identity, and split/merge cases; automated matching only proposes candidates and records method/version/features |
| P0 | Behavior Timeline forks recursively embed copied `TimelineEvent[]` paths, while `Link Behavior` stores an ID plus cached title/type | Replace recursive timeline documents with stable path/scope references and a versioned composition link to a Behavior Analysis artifact; keep cached labels display-only and migrate inline paths without losing IDs |
| P0 | A parent timeline cannot state whether a linked child is pinned or follows future edits | Add explicit `pinned_revision` and `track_branch` policies; every saved/published projection records the exact child revisions it resolved, and tracking changes arrive as reviewable update candidates |
| P1 | Relative behavior time such as `T+30min` cannot be placed safely on an absolute incident chronology | Add coordinate systems plus explicit anchor mappings; unresolved or conflicting anchors stay local and never acquire invented absolute precision |
| P1 | A single flat event list cannot express containment and simultaneous activity across individual, group, organizational, and operational scales | Add named temporal scopes and typed composition relations for expansion, overlap, context, behavior, source account, and plan/activity facets; use interval relations and lanes without copying child objects |
| P1 | A recurring behavior model and one real occurrence of it can be mistaken for the same timeline | Separate reusable temporal templates from pinned instances; each occurrence has its own anchor, parameters, identity, evidence, and actual timing without mutating the template |
| P1 | Recursive expansion can leak restricted child data or create cycles and unbounded reads | Enforce handling-aware traversal, acyclic containment, cycle-safe contextual graphs, depth/node budgets, placeholders for unauthorized children, and pinned publication manifests |
| P1 | A living timeline detects new events but does not operate as an indicators-and-warning system | Add scenario-linked indicators and signposts with expected presence/absence, observation state, trend, threshold, source, collection status, and the judgment they would change |
| P1 | Gaps are prose and do not drive collection | Promote selected gaps into collection requirements with priority, owner, due/review date, linked judgment/hypothesis/indicator, and open/satisfied/uncollectable state |
| P1 | Revision history captures event edits but not changes in analytic reasoning | Add a judgment change log, challenge/dissent record, reviewer sign-off, and a concise explanation of what new evidence or reasoning changed the assessment |
| P2 | Future events and forecasts can still look like ordinary timeline entries | Create distinct scenario/pathway lanes for backcasting, alternative futures, and antecedent conditions; observed events may satisfy or contradict a pathway step but never silently become forecast nodes |
| P2 | Visibility exists at artifact scope, but sensitive source material can leak through evidence or export | Add workspace-defined handling labels at source/assertion/evidence/event level and policy-aware redaction or tearline exports; do not imitate government classification markings in the public product |
| P1 | There is no objective-to-work structure | Model objective → strategy/approach → task or milestone, with owner, assignment, location, operational period, resources, constraints, risk/safety notes, and definition of done |
| P1 | Editing dates would erase what the team originally approved | Preserve immutable schedule baselines plus current forecast and actual start/finish values, variance reason, change approval, and revision history |
| P1 | A flat list cannot show whether the plan is executable | Add dependency types, lag, constraints, cycle detection, critical-path/float calculation, resource conflicts, and schedule-risk annotations; keep calculations explainable |
| P1 | Warning indicators do not yet drive authorized planning choices | Link indicators or conditions to decision points, branch plans, contingencies, and sequels; an indicator prompts a decision but does not execute the branch |
| P2 | Long-running operations need a repeatable planning rhythm | Add operational periods with objectives, assignments, resource/safety review, briefing/publish state, status capture, and rollover into the next period |

Do not implement every named structured analytic technique as a bespoke feature.
The first supported set should be the techniques that directly operate on the
timeline evidence graph: chronology diagnostics, Key Assumptions Check, Quality
of Information Check, ACH, and Indicators/Signposts. Premortem, What If?,
backcasting, and alternative futures can then share a generic scenario-pathway
model. Red Team or Team A/Team B work primarily needs the common challenge,
dissent, and technique-run audit model rather than a separate timeline schema.

## Product decisions

### 1. Keep the first-party ResearchTools workspace

TimelineJS is a presentation benchmark and a future interoperability target,
not the ResearchTools system of record or analyst interface. The current
workspace already contains investigation-specific concepts that TimelineJS does
not model: unanswered questions, cited findings, analyst assessments, tentative
hypotheses, relative placement, framework handoffs, and future audit history.

ResearchTools should therefore:

- apply TimelineJS editorial principles in the first-party narrative editor;
- add a TimelineJS-compatible JSON adapter after the internal schema is stable;
- preserve ResearchTools-only evidence and review data in the authoritative
  investigation artifact and in a companion ResearchTools export; and
- never require a public Google Sheet or third-party CDN to present private
  workspace data.

If the TimelineJS runtime is later embedded, use a pinned or self-hosted build
after license, privacy, accessibility, security, and performance review.

### 2. Make chronology selectable, not destructive

The shipped **Oldest first / Latest first** controls on RSS and ResearchTools
change display order only. They must never rewrite event dates, canonical graph
membership, manual sequence placement, narrative order, or event IDs. Persist a
preference only as surface-specific view state.

Narrative view should normally open at the narrative beginning. A live incident
or monitoring timeline may intentionally open at the latest event. TimelineJS's
[`start_at_end`](https://timeline.knightlab.com/docs/options.html) behavior is a
useful compatibility target for that choice.

### 3. Treat navigation as an outline of the argument

The current products already have two different navigation layers: the RSS
`Story guide` links to major page sections and periods, while ResearchTools
`Timeline contents` links to workspace sections and individual events. Preserve
that distinction and add a third, narrative layer:

1. **Page contents** — network, timeline, related coverage, and sources on RSS;
   overview, AI review, event sequence, and next steps in ResearchTools.
2. **Timeline navigator** — periods and event jumps for moving through the full
   record.
3. **Narrative outline** — editorial chapters or eras that explain how the
   account develops.

Extend the existing controls into a compact narrative outline with:

- title, one-paragraph framing, scope, timezone, and data-through timestamp;
- chapters or eras with short claims about what changes in each period;
- event count, source coverage, open-gap count, and last update;
- track filters for parallel actors or domains; and
- stable, copyable deep links to chapters and events.

The outline should help a reader understand the shape of the story before
opening individual events, not merely repeat every event headline.

### 4. Keep research, interpretation, and prediction visibly distinct

Every event must distinguish:

- **epistemic type:** observed, reported, analyst inference, hypothesis, or
  forecast;
- **assertion status:** unreviewed, corroborated, disputed, corrected, or
  retracted; and
- **narrative role:** context, buildup, turning point, response, consequence, or
  resolution.

Chronological adjacency is not causation. Relations such as `possibly_causes`
remain explicit analyst assertions with supporting evidence, not system facts.

### 5. Keep Event, Plan, and Activity timelines separate

The Article, Story, and Investigation timelines concern events in the world.
Plan view concerns intended work, approval, assignment, and schedule. The COP
Timeline is an operational record of real-world events plus investigation
activity, and the entity Activity Timeline is an aggregate chart. They may link
through stable IDs and share evidence or artifact references, but must not
collapse into one schema or duplicate events into each panel payload.

### 6. Define authority by scope, not by one global “canonical” claim

Authority is always named by scope:

| Scope | Authority |
| --- | --- |
| One extraction request | Immutable ResearchTools `timeline-analysis.v1` result |
| Community cross-article record | Signal/Postgres `timeline_canonical_events` graph |
| One analyst investigation | Durable ResearchTools investigation timeline, once implemented |
| External consumer-owned record | The consumer's own artifact; ResearchTools request/event references provide lineage but do not make it a ResearchTools investigation |

RSS renders the community record; it does not own another copy. Signal commands
orchestrate and preview it; chat messages are not records. A ResearchTools
investigation may import references to community event IDs and then record its
own assessments, edits, questions, evidence, and narrative selection. Importing
must not mutate the community graph, and later community updates must enter the
investigation as reviewable candidates.

An extract-only API client may store and transform its own copy under its own
governance. ResearchTools guarantees the analysis contract and lineage it
returned, not the correctness, update policy, publication, or later mutation of
that downstream copy.

Source count is not an epistemic assessment. Until source independence and
claim equivalence are evaluated, RSS and Signal should say **reported by 2+
sources** or **matched across sources**, not **corroborated**. Likewise, the
current high/critical importance mark must not be labeled `watershed` or
`turning point`; importance and narrative role are separate fields.

### 7. Model the analytic argument separately from the chronology

An event answers **what is claimed to have happened**. An analytic judgment
answers a scoped question about meaning, cause, consequence, or likely future
development. A judgment may cite multiple events and evidence passages, expose
its assumptions and alternatives, and record both supporting and contrary
information. It is never inferred merely from neighboring events or source
volume.

When a judgment makes an estimative claim, represent two different ideas:

- **likelihood** describes the assessed chance of the event or development; and
- **analytical confidence** describes how sound and stable the basis for that
  likelihood is, with a rationale based on information quality, analytic rigor,
  gaps, complexity, and volatility.

Do not combine these into one percentage, color, or “confidence score.” A
workspace may select an approved verbal probability vocabulary, but the API
must also preserve the vocabulary/version used and must not translate between
different institutional yardsticks without an explicit mapping.

### 8. Make structured techniques reproducible overlays

A structured-technique run is an auditable view over an immutable input
revision, not a mutation of the event ledger. Record the technique, analytic
question, input artifact revision, selected events/evidence, participants,
facilitator if any, timestamps, method-specific entries, conclusions, and later
review. Analysts can accept individual outputs into judgments, assumptions,
indicators, or collection requirements through explicit actions.

AI may help populate a draft matrix or flag anomalies, but it must not choose
the winning hypothesis, assign source independence, set a watch condition, or
raise a judgment's confidence without analyst review.

### 9. Keep four temporal modes distinct

The workspace should support four related but non-interchangeable modes:

1. **Historical reconstruction** — assessed real-world events and disputed
   source assertions ordered by when they occurred.
2. **Knowledge reconstruction** — what sources reported and what an analyst or
   organization knew, assessed, or communicated at each point in time.
3. **Warning and scenarios** — future pathways, expected indicators, absent
   indicators, triggers, and collection or decision points.
4. **Planning and execution** — authorized objectives, tasks, milestones,
   assignments, dependencies, operational periods, decisions, and contingencies,
   compared with actual progress.

They may share sources, entities, and evidence, but future pathway steps must
never render as completed events, and a possible scenario must never be mistaken
for an approved plan. “Not observed” must also remain different from “observed
absent” and “not collected”; otherwise a collection gap will be misrepresented
as negative evidence.

### 10. Treat review, dissent, and handoff as product data

The durable artifact should retain peer review, structured challenge, material
dissent, and analyst handoff records. Published views should disclose material
alternative judgments and what would change the main assessment without
exposing private comments or identities. The audit trail must be able to show
which evidence and technique-run revision supported a judgment at publication
time and why a later version changed.

### 11. Make Plan view a controlled schedule, not an action engine

Plan view should be useful for a conference run of show, research project,
incident response, newsroom deployment, or other operation without pretending
to replace a specialist project-management, dispatch, or command system. Its
core contract is:

```text
objective → approach → task/milestone → assignment/resources
          ↘ decision point → branch/contingency

approved baseline → current forecast → actual execution
```

The UI should offer a phase/operational-period outline, a run-of-show or table
view, and a dependency/Gantt view only when the data supports it. **Oldest
first / Latest first** remains useful for event records; Plan view should lead
with **Next action**, **Current operational period**, **Upcoming**, and
**Overdue/blocked**, while still supporting deterministic chronological order.

Plan state never executes external work. Calendar invitations, notifications,
resource reservations, messages, publishing, dispatch, or automation require a
separate integration and explicit authority. Marking a task complete records a
status and optional actual time; it does not prove that the intended real-world
outcome occurred.

### 12. Separate lineage branches from competing alternatives

Do not implement “branch” as one generic clone operation. The durable structure
should be:

```text
timeline artifact
├── shared temporal, evidence, entity, and analytic objects
├── lineage branches
│   └── revision DAG for independent editing and reviewed merge
└── alternative sets
    ├── analytic alternatives: competing explanations or scenarios
    └── plan options: candidate courses of action
```

A lineage branch contains a changing working projection of an artifact. An
alternative set contains multiple candidates evaluated at once against common
facts, evidence, criteria, and observations. Shared facts should be referenced,
not copied into every candidate. Selecting a plan option is a decision; rejecting
an hypothesis is an assessment; merging a lineage branch is a version-control
operation. None implies either of the others.

Fork intents must be explicit: `private_working_copy`, `team_a_team_b`,
`analytic_challenge`, `narrative_variant`, or `integration_staging`. Scenario
and plan alternatives use `alternativeSet` instead of a lineage fork unless the
authors genuinely need independently editable artifact histories.

### 13. Give each comparison question its own contract

“Compare” should open a wizard that asks what question the user is answering,
then creates an immutable comparison run:

| Question | Comparison type | Unit of comparison | Primary result |
| --- | --- | --- | --- |
| What changed between versions? | `revision_diff` | Stable object ID and field | Added, removed, modified, moved, split, merged, or reclassified objects since the base |
| Where do accounts agree or conflict? | `cross_timeline_alignment` | Reviewed event/assertion alignment group | Shared, unique-to-input, partial-overlap, temporal conflict, claim conflict, and unresolved identity |
| Which explanation is least inconsistent with the evidence? | `alternative_matrix` | Evidence/test × analytic alternative | Categorical consistency, contradiction, diagnosticity, sensitivity, and unresolved collection gaps |
| Which plan option best satisfies the decision criteria? | `plan_option_matrix` | Objective/constraint/risk/test × plan option | Tradeoffs, must-pass failures, assumption exposure, sensitivity, and authorized selection record |
| What happened compared with the approved plan? | `plan_outcome` | Plan item/objective/measure × observation | Baseline/current/actual variance, execution status, observed effect, and unresolved attribution |

Every comparison pins exact artifact, branch, and revision references; the
world-time interval; an optional **knowledge cutoff**; filters; handling policy;
alignment or evaluation method/version; and the analyst who accepted each
non-mechanical judgment. Changing an input, cutoff, matching policy, or matrix
cell creates a new comparison revision rather than silently changing a saved
result.

Pairwise diff is not enough for ACH. `alternative_matrix` and
`plan_option_matrix` must support an N-way candidate set so each observation is
evaluated against all reasonable alternatives on the same row. Conversely,
cross-timeline alignment must not imply that aligned events are corroborated;
source independence and claim compatibility remain separate assessments.

### 14. Make falsifiability an observation contract

The useful prompt is not merely **What supports this?** It is **If this claim,
assumption, scenario, or intended effect were wrong, what observable result
would count against it, by when, and were we actually capable of seeing that
result?** Model that chain explicitly:

```text
candidate alternative
  → proposition or assumption
  → test criterion registered at revision R
  → expected result for each candidate
  → collected observation plus coverage assessment
  → categorical evaluation and rationale
  → analyst judgment or authorized planning decision
```

A test criterion needs a human-readable observable and, when appropriate, a
structured measurement specification: operator, threshold or category, unit,
aggregation, population/location, start/end window, minimum detection or
collection coverage, and expiry/review time. Each candidate maps that result to
`required`, `consistent`, `neutral`, `inconsistent`, or `potentially_disqualifying`
with a rationale recorded before the result is known where practical.

An observation separately records `observed_present`, `observed_absent`,
`not_observed`, `ambiguous`, `not_collected`, `collection_failed`, or
`not_applicable`, along with the source assertions, evidence, collection method,
temporal coverage, geographic/population coverage, and quality limitations.
`not_observed` means collection found no positive observation but cannot support
an absence claim; only an adequately covered `observed_absent` result can count
as negative evidence. Repetition of the same originating report does not create
independent observations.

Evaluation cells should default to the categorical ACH vocabulary
`strongly_inconsistent`, `inconsistent`, `neutral`, `consistent`,
`strongly_consistent`, `not_applicable`, or `indeterminate`, plus rationale and
reviewer. A calculated contradiction count, diagnosticity value, weighted
decision score, or sensitivity result is a transparent projection over those
cells—not a probability and never an automatic winner.

Falsification state should therefore be cautious: `untested`, `not_refuted`,
`weakened`, `potentially_falsified`, `rejected_by_review`, `revived`, or
`inconclusive`. A probabilistic hypothesis is rarely “proven false” by one row;
the system should show which proposition failed and the analyst decision that
changed the parent alternative. A plan itself is not true or false: its
assumptions and expected effects can be contradicted, its tasks can be executed
or not, and its objectives can be evaluated against independently observed
measures.

Knowledge chronology makes this substantially more useful. Analysts should be
able to recompute a comparison **as known at time T**, hiding observations not
yet reported or available, then contrast that result with the retrospective
matrix. This exposes hindsight, late evidence, and judgment drift.

### 15. Merge semantic objects through a three-way review

Use a revision directed acyclic graph rather than a mutable history list. A
normal revision has one parent; an applied merge has two parents. A branch is a
named mutable pointer to an immutable head revision. Fork records the source
revision exactly, and published or signed-off revisions are never rebased or
rewritten.

A merge compares **base**, **target head**, and **source head** at stable-object
and typed-field level. Store semantic operations such as `create_object`,
`revise_object`, `tombstone_object`, `link`, `unlink`, `split_identity`,
`combine_identity`, and `reclassify`; an optional RFC 6902 patch may describe
the byte-level field change but is not enough to explain its analytic meaning.

Auto-merge only independent, non-overlapping changes that pass authorization,
handling, referential-integrity, and schema checks. Require explicit resolution
for at least:

- divergent times, precision, claim text, epistemic state, likelihood,
  confidence, evidence role, or causal relation;
- delete-versus-edit, reclassification, event split/combine, and competing
  source-identity decisions;
- alternative selection, plan approval/baseline, task completion, branch
  activation, or objective/outcome assessment; and
- any change that would weaken handling, redact provenance, disclose a
  restricted relationship, create a dependency cycle, or violate a signed-off
  revision.

Each conflict retains base/source/target values, conflict type, affected object
and paths, available evidence, proposed resolution, resolver, rationale, and
resolved-at revision. The resulting merge revision cites both parents and the
merge request. “Keep both” is a first-class resolution for genuinely disputed
claims, times, or judgments; disagreement is data, not merge debris.

Timelines without shared lineage cannot use a three-way merge initially. They
first need reviewable alignment groups proposed from stable external references,
source-assertion links, time uncertainty, entities, locations, and claim
similarity. Every automated match records method/version and features. Analysts
can mark `same_occurrence`, `partial_overlap`, `describes_part_of`,
`different_occurrence`, or `unresolved`; only reviewed alignments may feed a
later semantic merge.

### 16. Reuse ACH and Cross Table as projections, not the source of truth

The current ACH schema stores an integer for each hypothesis/evidence cell, and
the UI derives a relative `0–100` `likelihood` from inconsistency ordering. Keep
that behavior compatible for existing analyses, but label it **relative
inconsistency ranking**, not calibrated likelihood. Import it through a
versioned adapter that retains the original scale, score, credibility,
relevance, notes, scorer, and timestamp.

The generic Cross Table can render analytic alternatives or plan options and
can supply weighting, sensitivity, and Delphi components. Its rows, columns,
averages, and rankings must remain a projection of canonical candidates,
criteria, and evaluations because the present table does not preserve evidence
lineage, time/knowledge cutoff, collection coverage, preregistration, or
artifact revision. In particular, never average categorical ACH judgments into
a new canonical cell or translate a decision score into estimative likelihood.

### 17. Compose timelines through scopes and links, not recursive documents

Use three levels of temporal structure:

1. **Inline detail** for a few non-addressable explanatory sub-steps that have
   no independent time, evidence, permissions, comparison, or reuse.
2. **Temporal scope** for an addressable episode, phase, track, source account,
   behavior sequence, or operational period whose members remain objects in the
   same artifact.
3. **Child timeline artifact** when the material has separate ownership,
   permissions, framework semantics, revision history, reuse, or publication.

Promote inline details to a scope or child artifact as soon as they need stable
IDs, their own evidence/time, independent editing, nested expansion, comparison,
or reuse. Do not recursively embed full event arrays. A composition graph is
required because one behavior analysis may be relevant to several incidents,
one source chronology may inform several investigations, and overlapping scopes
do not form a strict tree.

Containment edges must remain acyclic. Overlay, context, account, and behavior
links may form a general graph, but traversal must detect repeated nodes and
cycles rather than recursively rendering forever.

Keep the composition graph, temporal/event-relation graph, evidence graph, and
revision DAG separate even when the same artifacts participate in all four. A
child link is not a revision parent, temporal overlap is not containment, and an
evidence link is not permission to expand an artifact.

### 18. Separate composition role from temporal relation

A composition link needs two independent semantics:

| Composition role | Meaning |
| --- | --- |
| `expands` | A child scope supplies finer-grained steps for an aggregate parent event or phase |
| `contains` | A host interval structurally owns a same-artifact child scope |
| `overlays` | An independently meaningful timeline is shown alongside the host over a shared or intersecting window |
| `behavior_of` | A Behavior Analysis models an actor's decisions/actions relevant to a host actor, event, or interval |
| `account_of` | A source-specific chronology describes some or all of a host episode without becoming the assessed chronology |
| `contextualizes` | A child supplies relevant external background but is not part of the host's event identity |
| `operationalizes` | A plan or activity timeline is related to a real-world episode while remaining intended work or execution history |
| `instantiates` | A concrete occurrence derives from a reusable temporal template |

Separately record the temporal relationship as `before`, `after`, `meets`,
`met_by`, `overlaps`, `overlapped_by`, `starts`, `started_by`, `during`,
`contains`, `finishes`, `finished_by`, `equals`, `inside`, `disjoint`, or
`unresolved`. Compute a relation only when both temporal extents support it and
retain the source precision and uncertainty used. Structural `contains` and
temporal `contains` are different fields even when both happen to apply.

A Behavior Timeline is an analytical facet: its goal formation, intention,
coping, psychological-state, and COM-B entries are typed behavior steps and
assessments, not automatically observed events. Link a behavior step to the
event/source assertions that support it through `observed_in`, `supported_by`,
or `contradicted_by`. The composition itself is not evidence.

### 19. Map clocks explicitly and preserve local time domains

Every timeline or scope declares one time domain:

- `absolute` for calendar/clock time with named timezone where applicable;
- `anchor_relative` for offsets such as `T+30 minutes`;
- `ordinal` for known sequence without elapsed time;
- `recurring_template` for a reusable pattern awaiting instantiation; or
- `mixed` only when every node retains its own explicit temporal-claim kind.

Composition uses one or more anchor mappings between a child anchor and a host
instant, interval boundary, event, or milestone. A single valid mapping can place
an offset sequence. Multiple anchors may validate or constrain the mapping; if
they disagree, show a mapping conflict rather than stretching the child to fit.
Do not infer arbitrary time scaling, timezone, precision, or duration.

An ordinal child may appear inside a host window as ordered but unplaced steps.
A relative child without a valid host anchor stays on a local `T±` axis. Mapping
an uncertain parent anchor propagates that uncertainty to the composite
projection and never upgrades a child's temporal precision.

### 20. Preserve child autonomy across revision, fork, merge, and publication

A composition chooses `pinned_revision` or `track_branch`:

- `pinned_revision` always resolves one immutable child revision and is required
  for publications, approved plan briefs, comparison inputs, and signed-off
  analysis.
- `track_branch` follows an authorized child's branch for a live working view,
  but every host revision records the exact child head last resolved. A newer
  child head creates an update candidate; it does not silently rewrite the host.

Forking a composite timeline is shallow by default: the new host branch retains
the same pinned child references. A deep fork must be an explicit, bounded
operation that names every child to copy, checks authority, creates derivation
links, and reports children that remain shared. Merging a host never recursively
merges child artifacts; conflicting child revision selectors are host-link
conflicts, and any child merge occurs in the child's own lineage.

Unlinking a child removes only the composition edge. It never deletes the child.
If a child is deleted, revoked, moved, or becomes inaccessible, retain a
handling-safe tombstone/placeholder and the last authorized provenance rather
than cascading deletion or serving stale cached content.

### 21. Make composite projections bounded and reproducible

A composite projection is a read model with a root revision, expansion policy,
resolved-input manifest, traversal order, filters, knowledge cutoff, time-mapping
results, warnings, and content hash. It never becomes a second editable copy of
its inputs.

The UI should support:

- a macro timeline with collapsed child/facet cards and coverage indicators;
- expand-in-place for a bounded same-artifact scope;
- **Focus child** with breadcrumbs back to the host;
- synchronized lanes or small multiples for overlapping timelines;
- an overview brush that updates every compatible absolute-time lane while
  leaving relative/ordinal lanes visibly local; and
- explicit controls for relationship kind, scale, expansion depth, and whether
  tracking children have newer revisions available.

Roll-ups such as child count, temporal extent, completion, evidence coverage, or
status must name their derivation method and input revisions. Never average
epistemic state or confidence. A parent's asserted time and status remain
separate from a derived child minimum/maximum or plan/activity roll-up.

Flattened export is an explicit lossy projection. Prefix or scope IDs to prevent
collisions, retain a manifest mapping every rendered item to its artifact/object
revision, and warn when local clocks, overlapping eras, behavior assessments,
permissions, alternatives, or child relations cannot be represented.

## Current ResearchTools baseline

The September 2026 timeline work already provides:

- article extraction and manual-first timelines;
- absolute, relative, time-only, and sequence-only event placement;
- seven-day browser-local manual drafts;
- immutable extracted events with an editable analyst overlay;
- source versus analyst provenance and original-event retention;
- basic and robust modes;
- event assessment, analyst notes, interval gaps, questions, and cited answers;
- opt-in AI gap, question, and hypothesis suggestions that require review;
- explicit handoffs to Agentic Research, ACH, and Behavior Analysis;
- Markdown copy and `timeline-workspace.v1` JSON export;
- oldest/latest display sorting; and
- top-of-page section and event navigation.

Across the three products, the principal gaps are a deliberate handoff into the
ResearchTools analyst workspace, event-level evidence, scoped cross-system IDs,
durable artifacts, revisions, stronger temporal semantics, parallel tracks,
narrative curation, reproducible comparison and semantic branch/merge, planning
objects and Plan view, media, publishing, and measured multi-source resolution.

## Display responsibilities

The surfaces should share event lineage and terminology, not identical layouts:

| Surface | Display responsibility | Default ordering and density | Primary next action |
| --- | --- | --- | --- |
| External API client | Consumer-owned presentation that preserves required provenance, uncertainty, data cutoff, truncation warnings, and source-count semantics | Chosen by the consumer through explicit sort/filter parameters; omitted parameters use documented deterministic defaults | Fetch more pages, inspect evidence, or open an authorized/public version URL |
| Signal | Fast chat preview and link-out, not the complete research, composition, or comparison interface | Article previews chronological; living-story previews latest first. Replace today's possible 60-event article or 30-event story dump with a tested compact budget, initially 12 events, and always state `Showing X of Y` when truncated. A shared comparison gets a short change/disagreement summary; a public composite gets only its host summary and bounded child links, never recursive chat expansion | Open the complete RSS record, authorized composite, or comparison |
| RSS article page | Read-only record of what one article contributed | Chronological source extraction; compact summary plus full supported event list, with no claim that it is a curated narrative | Open source, refresh deliberately, or continue in ResearchTools |
| RSS `Story so far` | Shared community record and coverage monitor | Full canonical record with period navigation, filter/search, and explicit oldest/latest sort; remember preference locally without changing graph order. A later public feature may compare two immutable community revisions or expose reviewed, pinned public episode/substory child links, but cannot expose private children, branches, or merge controls | Inspect evidence/source coverage, open a public child, compare public revisions, or import a versioned snapshot into ResearchTools |
| ResearchTools Analyst view | Full editable investigation ledger | Complete working sequence, gaps, questions, evidence, and assessments; oldest/latest affects display only | Research, assess, edit, or select for Narrative view |
| ResearchTools Narrative view | Curated explanatory presentation | Normally chronological and no more than about 20 selected events; live narratives may deliberately start at the latest event | Read, present, publish, or return to Analyst view |
| ResearchTools Composite view | Multi-scale host with expandable scopes and revision-aware child facets | Macro events stay readable; children open collapsed, focused, or in synchronized lanes according to compatible time domains and authorized projection limits | Expand a scope, focus/open a child, review its resolved revision, or compare overlays |
| ResearchTools Comparison view | Full revision diff, account alignment, alternative/test matrix, and merge review | Pins exact inputs and cutoff; offers aligned lanes, change list, matrix, and branch graph without letting visual sort affect ancestry or evaluation | Review alignment/evidence, revise an evaluation, fork a working copy, or propose/resolve a merge |
| ResearchTools Plan view | Intended work and plan-versus-actual management | Current operational period and next action first, with optional run-of-show and dependency views; baseline/current/actual dates remain distinct | Approve, assign, update, reforecast, create/compare a plan option, or review variance |
| COP/Activity timeline | Operational awareness and audit | Appropriate operational ordering; never inherits narrative curation controls by default | Open the linked investigation object |

The proposed Signal preview budget is a message-design target, not a data cap.
The full result continues to be stored and linked. Measure message readability
and truncation before fixing the final count; do not select only the newest
events and call that a narrative. A useful preview should retain required
context, buildup, turning points, and current consequence.

Each interactive page should distinguish:

- **Contents** for the page's major sections;
- **Timeline navigator** for periods and events in the full record; and
- **Narrative outline** for the chapters of a curated account.

Plan view adds a separate **Plan outline** for objectives, phases or operational
periods, next decisions, critical/blocked work, assignments, and resource or
safety issues. It should not reuse the Narrative outline as a task list.

Composite view adds a bounded **Scope navigator** with breadcrumbs, child type,
time domain, relationship, resolved revision, and restricted/update state. The
top contents area should show useful first-level scopes and counts, not eagerly
expand an unbounded recursive tree.

These interaction contracts should be shared in documentation and tests even
where the implementations cannot share a component directly because RSS uses
server-rendered templates and ResearchTools uses React.

## Target information model

The exact API is a design task, but `timeline-workspace.v2` should be able to
represent the following concepts without inventing precision:

| Concept | Minimum fields | Purpose |
| --- | --- | --- |
| Artifact framing | `title`, `summary`, `scope`, `timezone`, `dataThrough`, `updatedAt` | States what the timeline covers and how current it is |
| Artifact scope | `timelineKind`, `sourceSystem`, `externalRefs[]` | Distinguishes article, community-story, investigation, behavior, plan, activity, and reusable-template records without pretending they are interchangeable; narrative and composite views remain projections over pinned revisions |
| Analytic tasking | `question`, `decisionContext`, `audience`, `scope`, `timeHorizon`, `requirements[]` | Keeps the chronology relevant to the question and records what the work is intended to inform |
| Temporal claim | `kind`, `start`, `end`, `precision`, `timezone`, `displayText`, `relativeTo` | Supports instants, intervals, circa, relative, and unknown time |
| Event identity | stable local `id`, `revision`, `origin`, `original`, `externalRefs[]` | Supports links, updates, scoped deduplication, and audit without treating IDs from different systems as equal |
| Event meaning | `title`, `summary`, `narrativeRole`, `whyItMatters` | Makes the event contribute to the larger account |
| Epistemic state | `epistemicType`, `assertionStatus`, `confidenceRationale` | Separates facts, reports, interpretations, disputes, and forecasts |
| Evidence | `evidenceRefs[]`, each with source, locator/passage, and support/contradict role | Grounds claims below the whole-article level |
| Source assertion | `id`, `sourceRef`, `claimText`, `temporalClaim`, `observedAt`, `reportedAt`, `publishedAt`, `retrievedAt`, `locator`, `derivesFrom[]` | Preserves what each source actually claimed, its clocks, and possible source dependence beneath an assessed event |
| Source evaluation | `assertionRef`, `access`, `reliability`, `credibility`, `currency`, `completeness`, `possibleBias`, `possibleDeception`, `rationale`, `reviewedAt` | Records the factors behind an information-quality judgment instead of treating a source count as quality |
| Analytic judgment | `id`, `claim`, `scope`, `asOf`, `likelihood`, `analyticConfidence`, `confidenceBasis`, `eventRefs[]`, `evidenceRefs[]`, `contraryEvidenceRefs[]`, `assumptionRefs[]`, `alternativeRefs[]`, `changeIndicators[]` | Makes the conclusion, inferential chain, uncertainty, and change conditions reviewable |
| Assumption | `id`, `statement`, `confidenceBasis`, `supportsJudgmentRefs[]`, `invalidationConditions[]`, `impactIfWrong`, `owner`, `reviewedAt` | Makes stated and hidden premises challengeable over time |
| Hypothesis or scenario | `id`, `statement`, `kind`, `status`, `likelihood`, `assumptionRefs[]`, `pathwayStepRefs[]` | Keeps competing explanations and possible futures distinct from observed events |
| Indicator or signpost | `id`, `scenarioRefs[]`, `description`, `polarity`, `expectedWindow`, `state`, `trend`, `threshold`, `sourceAssertionRefs[]`, `lastCheckedAt`, `changesJudgmentRefs[]` | Supports monitoring, warning, and explicit expected/absent/unknown evidence states |
| Collection requirement | `id`, `question`, `priority`, `owner`, `dueAt`, `linkedObjectRefs[]`, `status`, `resolutionEvidenceRefs[]` | Turns important gaps into directed, reviewable research work |
| Technique run | `id`, `technique`, `question`, `inputRevision`, `participants[]`, `entries`, `resultRefs[]`, `createdAt`, `reviewedAt` | Makes chronology diagnostics, assumptions checks, source checks, ACH, and indicator work reproducible |
| Review and dissent | `id`, `kind`, `objectRef`, `reviewer`, `position`, `rationale`, `createdAt`, `resolvedAt` | Preserves peer review, challenge, alternative views, and handoff without overwriting the main judgment |
| Temporal scope | `id`, `artifactRef`, `kind`, `title`, `memberMode`, `memberObjectRefs[]`, `filter`, `declaredExtent`, `timeDomain`, `handling` | Names an addressable episode, phase, behavior sequence, track, source account, or operational period without copying its members |
| Scope membership | `scopeRef`, `objectRef`, `role`, `order`, `effectiveRevisionRef` | Allows objects to participate in several overlapping scopes while retaining one stable identity |
| Composition link | `id`, `hostScopeOrObjectRef`, `childArtifactRef`, `childScopeRef`, `role`, `revisionPolicy`, `pinnedRevisionRef`, `trackedBranchRef`, `projectionPolicy`, `handling` | Links a same-artifact scope or independently governed child timeline with explicit purpose and revision behavior |
| Temporal anchor mapping | `id`, `compositionRef`, `childAnchorRef`, `hostAnchorRef`, `offset`, `timezone`, `mappingStatus`, `uncertainty`, `rationale` | Maps relative child time onto a host without inventing precision or silently resolving conflicting anchors |
| Timeline template | `id`, `artifactRef`, `templateKind`, `parameterSchema`, `timeDomain`, `rootScopeRef`, `revisionRef` | Represents a reusable behavior, process, playbook, or sequence independently of any occurrence |
| Timeline instance | `id`, `templateRevisionRef`, `hostRef`, `anchorMappings[]`, `parameters`, `occurrenceWindow`, `actualObjectRefs[]`, `status` | Creates a distinct occurrence with its own identity, anchor, evidence, actual timing, and revision history |
| Composite projection | `id`, `rootRevisionRef`, `resolvedInputManifest[]`, `expansionPolicy`, `knowledgeCutoff`, `filters`, `mappingResults[]`, `warnings[]`, `methodVersion`, `contentHash` | Makes a bounded multi-timeline read model reproducible without becoming a mutable source of truth |
| Derived roll-up | `id`, `compositionOrScopeRef`, `metric`, `value`, `method`, `methodVersion`, `inputRevisionRefs[]`, `calculatedAt`, `warnings[]` | Keeps child extent/count/status/evidence summaries distinct from asserted parent facts |
| Lineage branch | `id`, `artifactRef`, `name`, `intent`, `forkedFromRevisionRef`, `headRevisionRef`, `createdBy`, `protectionPolicy` | Gives an independent working line a named head without treating it as a hypothesis or rewriting its base |
| Artifact revision | `id`, `artifactRef`, `parentRevisionRefs[]`, `createdBy`, `createdAt`, `reason`, `contentHash`, `mergeRequestRef` | Forms an immutable revision DAG; ordinary revisions have one parent and reviewed merges have two |
| Semantic change | `id`, `revisionRef`, `objectRef`, `operation`, `changedPaths[]`, `beforeVersionRef`, `afterVersionRef`, `reason` | Records the meaning of create/revise/tombstone/link/unlink/split/combine/reclassify changes instead of relying only on blob diff |
| Alternative set | `id`, `kind`, `question`, `sharedBaselineRevisionRef`, `candidateRefs[]`, `status`, `decisionAuthority` | Groups competing hypotheses, scenarios, or plan options that must be evaluated together |
| Alternative candidate | `id`, `alternativeSetRef`, `statement`, `status`, `propositionRefs[]`, `assumptionRefs[]`, `pathwayOrPlanRefs[]`, `derivedFromRefs[]` | Represents one explanation or option without copying common facts and evidence |
| Testable proposition | `id`, `kind`, `statement`, `polarity`, `scope`, `temporalClaim`, `candidateRefs[]`, `assumptionRefs[]` | Makes the particular descriptive, causal, forecast, requirement, or effect claim being tested explicit |
| Test criterion | `id`, `propositionRefs[]`, `observable`, `measurementSpec`, `window`, `requiredCoverage`, `registeredRevisionRef`, `registeredAt`, `owner`, `status` | Precommits what result would bear on a claim, when it must be observable, and how adequate collection will be judged |
| Candidate expectation | `criterionRef`, `candidateRef`, `expectedResult`, `evaluationIfObserved`, `disconfirmationStrength`, `rationale`, `registeredRevisionRef` | Builds the ACH-style matrix before outcomes are known and distinguishes diagnostic from non-discriminating observations |
| Observation and coverage | `id`, `criterionRef`, `state`, `value`, `unit`, `eventRefs[]`, `sourceAssertionRefs[]`, `evidenceRefs[]`, `method`, `coverage`, `limitations`, `observedAt`, `recordedAt` | Separates observed presence/absence from ambiguity, non-collection, collection failure, and inadequate coverage |
| Evaluation cell | `id`, `criterionRef`, `candidateRef`, `observationRefs[]`, `assessment`, `rationale`, `evaluatedBy`, `round`, `perspective`, `evaluatedAt`, `inputRevisionRefs[]`, `supersedes`, `consensusOfRefs[]` | Stores individual and explicitly facilitated consensus judgments without averaging away disagreement |
| Comparison run | `id`, `comparisonType`, `inputRevisionRefs[]`, `baseRevisionRefs[]`, `knowledgeCutoff`, `worldWindow`, `scope`, `method`, `methodVersion`, `alignmentPolicy`, `status`, `resultRevision` | Makes a diff, alignment, matrix, or plan/outcome comparison reproducible at a defined time and cutoff |
| Alignment group | `id`, `comparisonRef`, `members[{inputRef,objectRef}]`, `relation`, `timeRelation`, `confidence`, `method`, `features`, `reviewStatus`, `rationale` | Relates independently created objects without claiming identity or corroboration by similarity alone |
| Comparison difference | `id`, `comparisonRef`, `alignmentRef`, `kind`, `memberRefsByInput`, `changedPaths[]`, `materiality`, `handling`, `reviewStatus` | Supports filterable unique-to-input, changed, timing, contradiction, split/combine, and unresolved results across two or more inputs |
| Merge request | `id`, `artifactRef`, `sourceBranchRef`, `targetBranchRef`, `baseRevisionRefs[]`, `virtualBaseRevisionRef`, `sourceHeadRef`, `targetHeadRef`, `comparisonRef`, `selectedChangeRefs[]`, `status`, `requiredApprovals[]` | Freezes the merge bases, two heads, optional derived base, and proposed scope before a reviewer can apply it |
| Merge conflict and resolution | `id`, `mergeRequestRef`, `objectRef`, `conflictType`, `baseValue`, `sourceValue`, `targetValue`, `resolution`, `resolvedValue`, `evidenceRefs[]`, `resolvedBy`, `rationale` | Preserves epistemic, temporal, identity, handling, plan, and field conflicts plus the human choice |
| Selection or rejection decision | `id`, `alternativeSetRef`, `candidateRef`, `action`, `basisComparisonRef`, `authority`, `decidedAt`, `rationale`, `reviewAt` | Keeps plan-option selection or analytic rejection distinct from calculation and lineage merge |
| Planning frame | `id`, `planKind`, `title`, `intent`, `timezone`, `owner`, `status`, `approval`, `currentBaselineRef` | Defines whether the plan is an event, project, incident, or operation and who can approve it |
| Plan objective | `id`, `priority`, `statement`, `measure`, `target`, `dueAt`, `status` | Keeps intended outcomes separate from the tasks used to pursue them |
| Plan item | `id`, `kind`, `title`, `objectiveRefs[]`, `plannedStart`, `plannedEnd`, `forecastStart`, `forecastEnd`, `actualStart`, `actualEnd`, `owner`, `assignment`, `resourceRefs[]`, `location`, `status`, `definitionOfDone` | Represents a task, milestone, decision, briefing, or contingency without turning it into a historical event |
| Plan dependency | `predecessorRef`, `successorRef`, `type`, `lag`, `constraint`, `rationale` | Supports sequencing, cycle checks, critical path, float, and explainable schedule effects |
| Decision and branch | `id`, `condition`, `indicatorRefs[]`, `options[]`, `decisionAuthority`, `decisionBy`, `selectedOption`, `selectedAt` | Connects new information to an authorized choice without auto-executing a branch |
| Operational period | `id`, `start`, `end`, `objectiveRefs[]`, `assignmentRefs[]`, `resourceReview`, `riskSafetyReview`, `briefingState`, `statusSummary` | Gives fast-moving operations a bounded planning, briefing, execution, and review cadence |
| Plan baseline and variance | `id`, `planRevision`, `approvedBy`, `approvedAt`, `basis`, `criticalPath`, `riskSummary`, `variance[]` | Preserves the approved schedule while comparing it with current forecast and actual execution |
| Structure | `chapterId`, `trackIds[]`, `actorIds[]`, `locationIds[]`, `relations[]` | Enables outline, grouping, filtering, and parallel threads |
| Presentation | `narrativeIncluded`, `narrativeOrder`, `transition`, `mediaRefs[]` | Curates a reader view without copying the event |
| Knowledge history | `occurredAt`, `observedAt`, `reportedAt`, `publishedAt`, `retrievedAt`, `recordedAt`, `communicatedAt`, `revisionReason`, `supersedes` | Supports world/knowledge chronology, postmortems, living timelines, and corrections without inventing missing clocks |
| Handling | `visibility`, `handlingTags[]`, `redactionPolicy`, `exportability`, `retention` | Prevents a publish or export action from leaking restricted workspace evidence |

Media references should support URL or internal asset ID, caption, credit,
rights/usage note, and alternative text. This follows TimelineJS's
[media model](https://timeline.knightlab.com/docs/json-format.html) while adding
the governance needed for an authenticated research workspace.

### Proposed composition contract shape

Composition should reference a child and its temporal mapping rather than nest
the child's object array:

```json
{
  "schemaVersion": "timeline-composition.v1",
  "id": "comp_...",
  "host": {
    "artifactId": "tl_parent",
    "scopeId": "scope_incident",
    "objectId": null
  },
  "child": {
    "artifactId": "tl_behavior",
    "scopeId": "scope_decision_sequence",
    "revisionSelector": {
      "mode": "pinned_revision | track_branch",
      "revisionId": "rev_child_42",
      "branchId": null,
      "lastResolvedRevisionId": "rev_child_42"
    }
  },
  "compositionRole": "expands | contains | overlays | behavior_of | account_of | contextualizes | operationalizes | instantiates",
  "temporalPlacement": {
    "childTimeDomain": "absolute | anchor_relative | ordinal | recurring_template | mixed",
    "temporalRelation": "overlaps | during | contains | before | after | unresolved",
    "anchors": [
      {
        "childAnchorRef": "event_behavior_start",
        "hostAnchorRef": "event_incident_start",
        "offset": "PT0S",
        "mappingStatus": "asserted | derived | conflicting | unresolved",
        "uncertainty": null
      }
    ]
  },
  "projectionPolicy": {
    "defaultState": "collapsed | expanded | lane",
    "maxDepth": 2,
    "maxResolvedObjects": 250,
    "includeObjectTypes": ["behavior_step", "assessed_event"],
    "rollupMethod": "composition-rollup.v1"
  },
  "handling": {
    "visibilityCeiling": "workspace",
    "redactionPolicyRef": "policy_..."
  }
}
```

The `lastResolvedRevisionId` makes a tracking link honest about what the host
actually displayed. A newer child head changes availability state, not the
saved host projection. Every publication or comparison converts resolved
tracking inputs into an immutable manifest before it is signed or shared.

### Proposed comparison contract shape

The public contract should reference exact immutable inputs rather than embedding
mutable copies. A compact `timeline-comparison.v1` envelope can use this shape:

```json
{
  "schemaVersion": "timeline-comparison.v1",
  "id": "cmp_...",
  "comparisonType": "revision_diff | cross_timeline_alignment | alternative_matrix | plan_option_matrix | plan_outcome",
  "inputs": [
    {
      "artifactId": "tl_...",
      "branchId": "br_...",
      "revisionId": "rev_...",
      "label": "Team A"
    }
  ],
  "baseRevisionIds": ["rev_... or empty for independent artifacts"],
  "worldWindow": { "start": "...", "end": "..." },
  "knowledgeCutoff": "... or null",
  "scope": {
    "objectTypes": ["source_assertion", "assessed_event", "judgment"],
    "trackIds": [],
    "query": null
  },
  "method": {
    "id": "semantic-object-compare",
    "version": "1",
    "parameters": {},
    "modelRef": null
  },
  "alternativeSetId": null,
  "status": "queued | running | review_required | complete | failed",
  "resultRevision": 1,
  "createdBy": "principal_...",
  "createdAt": "..."
}
```

Test criteria and cells remain independent resources so a new observation does
not rewrite a preregistered expectation:

```json
{
  "criterion": {
    "id": "test_...",
    "observable": "What specifically would be seen or measured?",
    "measurementSpec": {
      "valueType": "boolean | number | category",
      "operator": "present | absent | eq | lt | lte | gt | gte | in",
      "threshold": null,
      "unit": null,
      "aggregation": null
    },
    "window": { "start": "...", "end": "...", "timezone": "..." },
    "requiredCoverage": {
      "method": "...",
      "minimum": "...",
      "populationOrArea": "..."
    },
    "registeredRevisionId": "rev_..."
  },
  "expectations": [
    {
      "candidateId": "alt_...",
      "expectedResult": "...",
      "evaluationIfObserved": "potentially_disqualifying",
      "rationale": "..."
    }
  ],
  "evaluation": {
    "candidateId": "alt_...",
    "observationIds": ["obs_..."],
    "assessment": "strongly_inconsistent | inconsistent | neutral | consistent | strongly_consistent | not_applicable | indeterminate",
    "rationale": "...",
    "evaluatedBy": "principal_...",
    "inputRevisionIds": ["rev_..."]
  }
}
```

### Durable storage shape

For D1/SQLite, use normalized identity and lineage tables with typed domain
tables, rather than one giant timeline JSON document or an entity-attribute-
value table:

- `timeline_artifacts`, `timeline_lineage_branches`, `timeline_revisions`, and
  `timeline_revision_parents` hold artifact identity and the revision DAG;
- `timeline_scopes`, `timeline_scope_memberships`, `timeline_compositions`, and
  `timeline_composition_anchors` hold named subsets, cross-artifact links,
  revision selectors, roles, and time mappings without recursive object copies;
- `timeline_templates`, `timeline_instances`,
  `timeline_projection_snapshots`, `timeline_projection_inputs`, and
  `timeline_rollups` hold reusable temporal models, concrete occurrences, and
  reproducible bounded read projections;
- `timeline_objects` holds stable scoped object identity and type, while
  `timeline_object_versions` holds immutable typed payload versions, schema
  version, canonical content hash, creator, and time;
- `timeline_revision_changes` links a revision to semantic operations and before/
  after object versions; periodic immutable snapshots may accelerate reads but
  are derived, not authoritative;
- `timeline_alternative_sets`, `timeline_alternatives`,
  `timeline_testable_propositions`, `timeline_test_criteria`, and
  `timeline_candidate_expectations` hold pre-observation analytic structure;
- `timeline_observations`, `timeline_observation_evidence`, and
  `timeline_evaluations` hold collected results, coverage, evidence, and
  categorical matrix cells;
- `timeline_comparisons`, `timeline_comparison_inputs`,
  `timeline_alignment_groups`, `timeline_alignment_members`, and
  `timeline_differences` hold reproducible derived comparisons;
- `timeline_merge_requests`, `timeline_merge_changes`,
  `timeline_merge_conflicts`, `timeline_merge_resolutions`, and
  `timeline_decisions` hold proposed integration and authorized human choices;
  and
- existing ACH and Cross Table IDs are retained in external-reference/adapter
  tables so migration never fabricates new evidentiary meaning.

Index branch heads, revision parents, stable object plus revision, comparison
inputs, candidate plus criterion, unresolved conflicts, observation window, and
knowledge cutoff. If finding a common ancestor becomes expensive, add a derived
`timeline_revision_ancestors` closure table with depth; validate it against the
authoritative parent edges rather than making it the only history.

Core invariants are:

1. Containment edges are acyclic; all projection traversals are cycle-safe and
   bounded by authorized depth, node, and byte limits.
2. Every saved composite projection, comparison, publication, and evaluation
   resolves to an immutable manifest of input revisions, including children
   reached through tracking links.
3. A composition link never changes a child's ownership, permissions,
   epistemic type, object identity, or revision history; unlink never deletes.
4. Temporal anchor mapping never upgrades child or host precision, and an
   unresolved mapping never emits an invented absolute timestamp.
5. Registered criteria and candidate expectations are immutable; amendments
   create new versions and preserve whether they were made before or after an
   observation became available.
6. At most one current evaluation exists per evaluator/round/criterion/
   candidate/comparison revision. Individual cells remain available when a
   facilitator records a separate consensus cell; superseded cells remain
   auditable.
7. Negative evidence cannot be created from `not_collected`, `not_observed`,
   `collection_failed`, ambiguous, expired, or insufficient-coverage states.
8. A merge revision has exactly two distinct parent revisions and an approved,
   fully resolved merge request; a normal revision has exactly one parent except
   the artifact root.
9. Stable object identity survives field edits; split/combine operations create
   new identities and explicit derivation links rather than recycling IDs.
10. Every computed roll-up, time mapping, ranking, diagnosticity, alignment
   candidate, and diff records
   its algorithm/model version, parameters, input hashes, warnings, and time.
11. Composition, comparison, and merge authorization uses the most restrictive applicable
   handling policy; even difference counts or alignment existence can be
   sensitive and must not leak to an unauthorized target.

The existing `unreviewed|corroborated|disputed|hypothesis` field should migrate
without losing meaning. `hypothesis` becomes an epistemic type, while review
status remains a separate assertion-status dimension.

In the durable model, source assertions, assessed events, analytic judgments,
and future scenario steps become separate object types. The transitional
`epistemicType: hypothesis|forecast` values remain readable for compatibility,
but new durable clients should create hypothesis/scenario objects and link them
rather than inserting future possibilities into the historical event stream.

## Delivery roadmap

### Phase 0 — Benchmark corpus and measurement

**Goal:** Make quality measurable before changing extraction or adding
multi-source automation.

Deliverables:

- Add a versioned fixture manifest containing source URL, retrieval timestamp,
  publisher timezone, data-through timestamp, usage constraints, and expected
  capabilities exercised.
- Store permitted source snapshots or compact test excerpts; do not make demos
  depend on a live page remaining unchanged.
- Create analyst-reviewed gold source assertions and assessed events with
  accepted temporal precision, available occurrence/report/knowledge clocks,
  evidence locators, track, epistemic type, and required/optional status.
- Separate frozen regression fixtures from an explicitly labeled live Iran
  demonstration.
- Add evaluation output for event recall, false events, date/precision accuracy,
  evidence attribution, duplicate reduction, incorrect merges, and unsupported
  narrative statements.
- Add fixtures with circular reporting, conflicting timestamps, a corrected
  source, expected-but-absent evidence, and a later judgment change. Score
  source-dependency detection and ensure “not collected” is never graded as
  observed absence.
- Add small reviewed technique fixtures for chronology diagnostics, a Key
  Assumptions Check, a Quality of Information Check, ACH, and an indicators
  matrix. The expected result is an inspectable reasoning record, not one
  supposedly correct automated answer.
- Add synthetic planning fixtures for a public event run of show and a
  multi-period incident exercise. Include approved baselines, current forecasts,
  actuals, dependency cycles, critical-path/float expectations, resource
  conflicts, blocked and carried work, decision branches, and attempted
  external side effects that must remain inert.
- Add comparison fixtures covering a linear revision diff, two independently
  authored but partially overlapping chronologies, an ACH-style three-candidate
  matrix, a plan-option matrix, and plan-versus-outcome review. Include temporal
  uncertainty, split/combine identity, delete/edit and epistemic conflicts,
  shared-origin evidence, a preregistered disconfirming observation, adequate
  observed absence, and missing collection that must remain inconclusive.
- Add composition fixtures for an incident with an expandable episode, two
  overlapping organizational timelines, an anchor-relative Behavior Timeline,
  an ordinal source account, a recurring behavior template with two occurrences,
  one child reused by multiple hosts, a containment cycle, conflicting anchors,
  a tracking-child update, and an unauthorized child.
- Add cross-surface contract fixtures proving that Signal `!timeline`, RSS
  **Build article timeline**, and ResearchTools **Extract an article** preserve
  the same extraction lineage even though each surface renders it differently.
- Publish/check a `timeline-analysis.v1` JSON Schema and OpenAPI operation, plus
  one generic server-side reference client that has no Signal/RSS dependency.
- Measure current Signal chat lengths and the RSS community matcher before
  setting preview limits or widening automatic clustering.

Exit gates:

- Every fixture has provenance and an `as of` timestamp.
- Required gold-event recall is at least 90% on the core corpus.
- At least 98% of extracted required events preserve the accepted date/time
  precision; false precision is counted as an error.
- At least 95% of extracted required events retain the correct source.
- Conflicting source assertions remain independently retrievable and no test
  fixture gains a stronger status solely because two derivative reports repeat
  the same originating claim.
- Planning fixtures reproduce baseline variance and critical-path results,
  reject cycles, preserve rollover history, and produce no real-world side
  effect.
- Comparison fixtures reproduce the same differences from the same immutable
  inputs, never count uncollected data as contradiction, and never silently
  resolve a reviewed identity, epistemic, handling, or merge conflict.
- Composition fixtures reproduce the same flattened projection manifest,
  reject containment cycles and false-precision mappings, preserve local clocks,
  and reveal no unauthorized child metadata.
- A new integration can discover, authenticate, submit URL and supplied-content
  requests, handle `no_events` and every documented error, and correlate a
  request using only published API materials.
- OpenAPI, JSON Schema, TypeScript contract, endpoint normalization, and frozen
  response fixtures agree on required fields, limits, and enums.
- Do not auto-merge community events into an investigation artifact or widen the
  existing Signal community matcher's scope until evaluation achieves at least
  30% duplicate reduction with fewer than 2% incorrect merges.

### Phase 1 — Cross-product language, handoff, and narrative foundation

**Goal:** Make it obvious what each action creates or opens, then turn a list of
events into an intentional narrative without weakening the analyst record.

Deliverables:

- On every eligible RSS news-item card and `/link/:id` page, use **Build article
  timeline** when no result exists, **Building article timeline…** while work is
  queued, **Open article timeline** when it is ready, and **Refresh article
  timeline** only as a deliberate rebuild action. Preserve explicit signed-in,
  unavailable, and not-enough-dated-events states.
- Keep that RSS action on the existing shared Signal pipeline. It must populate
  the RSS article page and community graph just as `!timeline` does; it must not
  be described as opening a ResearchTools investigation.
- Add the separate secondary action **Continue in ResearchTools** to eligible
  RSS article pages and, after story-snapshot import exists, **Investigate this
  story in ResearchTools** to `/story/:slug` pages.
- Replace the RSS filter label **Corroborated · 2+** with **Reported by 2+
  sources** and replace Signal's **corroborated across sources** language with
  **matched across sources** until the evidence gate supports the stronger
  claim.
- Rename RSS importance tooltips from **turning point/watershed** to
  **critical/high importance** until explicit narrative roles exist.
- Align Signal headings with RSS: **Article timeline: <title>** for one source,
  **Merged timeline: <count> sources** for multiple sources, and **Story so far:
  <label>** for `!story`. Command names remain `!timeline` and `!story`.
- Give every Signal preview an honest durable destination. A single-source reply
  links to its RSS article timeline and `!story` links to its RSS story page. A
  multi-source reply must say it is a transient merged preview until it can
  offer a versioned **Continue in ResearchTools** handoff for the source set; it
  must not imply that a merged RSS artifact was saved.
- Retain a link back to the originating RSS article or story and treat an
  imported article as a source to inspect, not automatic evidence for every
  extracted event.
- Add artifact title, framing summary, analytic question, intended use, scope,
  timezone, and data-through date. Include compact **What this establishes**
  and **What remains uncertain** blocks when analytic judgments exist.
- Add `narrativeRole`, `whyItMatters`, optional transition, chapter/era, and
  `narrativeIncluded` fields to the analyst overlay.
- Add **Analyst view / Narrative view** switching.
- Extend the top contents area into a chapter outline with event deep links.
- Default new narrative views to no more than 20 selected events; warn rather
  than block when editors exceed the guideline.
- Show prompts for missing context or buildup before a turning point.
- Allow deliberate narrative order while visibly warning when it departs from
  time order. The ledger always retains its working chronological placement.

The ResearchTools handoff should use a versioned `timeline-handoff.v1` envelope
resolved through a short-lived opaque handoff ID. The ID must be audience-bound,
expiring, single-use where practical, and unable to grant broader account or
workspace access. Validate `returnUrl` against allowed origins and routes. Do
not put article bodies, event arrays, service credentials, or private workspace
data in a query string. The minimum payload is:

```json
{
  "schemaVersion": "timeline-handoff.v1",
  "intent": "investigate_article | investigate_article_set | investigate_story_snapshot",
  "sourceSystem": "rss | signal",
  "returnUrl": "https://rss.irregulars.io/...",
  "articles": [
    {
      "rssLinkId": "optional",
      "url": "optional",
      "title": "optional",
      "publishedAt": "optional"
    }
  ],
  "story": {
    "slug": "optional",
    "revision": "optional",
    "dataThrough": "optional"
  },
  "externalEventRefs": []
}
```

The existing ResearchTools `?url=` route remains a safe public fallback that
prefills **Extract an article** and waits for user action. It is not an import,
does not auto-run analysis, and does not carry community event identity.

Exit gates:

- Editing narrative metadata never duplicates or mutates the underlying event.
- The RSS build/open state is present and keyboard accessible on every supported
  news-item surface and produces the same stored community result as the Signal
  article workflow, subject to the same eligibility and authentication rules.
- **Continue in ResearchTools** creates or preloads an investigation separately,
  preserves the RSS return link and source lineage, and never rewrites the
  community graph.
- Single-article, multi-article, and story-snapshot handoffs pass contract,
  expiry, replay, audience, return-URL, and authorization tests. Every Signal
  result either links to a durable destination or says that it is a transient
  preview.
- Every narrative event has a narrative role and a concise explanation of why
  it is included.
- A reader can understand scope, chronology, and major transitions from the top
  outline.
- Analyst view states the question being answered; Narrative view never implies
  that a chronological list alone proves a cause, motive, or forecast.
- Narrative view is keyboard navigable, responsive, screen-reader labeled, and
  usable with reduced motion.

### Phase 2 — Durable artifact API, evidence, and provenance

**Goal:** Make each consequential claim inspectable and make investigation
timelines safely usable by authorized products beyond the first-party UI.

Deliverables:

- Implement a shared evidence-reference contract with stable evidence and
  passage IDs, URL snapshot metadata, source title, publisher, publication
  time, locator, and supports/contradicts role.
- Add immutable source assertions beneath assessed events. Preserve the source's
  claim wording, temporal claim, locator, relevant clocks, retraction/recall
  state, and derivation from another source when known.
- Add a source-evaluation and dependency model for access, reliability,
  credibility, currency, completeness, possible bias/deception, and circular or
  derivative reporting. Keep the component factors and rationale visible;
  avoid an unexplained composite credibility score.
- Add workspace-scoped create/read/update APIs for investigation timelines using
  timeline-specific read/write scopes, idempotency keys on creates, and
  ETag/revision preconditions on updates.
- Build stable object identities, immutable typed object versions, semantic
  change records, and the one-parent revision history needed before branching.
  Use a revision-parent relation that can later admit reviewed two-parent merges
  without migrating or rewriting existing history; do not advertise branching
  until Phase 5 authorization and conflict handling pass.
- Add cursor-paginated event, source, evidence-link, question, and revision reads;
  never require clients to download an unbounded artifact to render one page.
- Advertise the durable artifact contract, scopes, and dynamic limits through
  capability discovery only after the full route and authorization matrix is
  executable.
- Attach one or more evidence references directly to events and findings.
- Split epistemic type from assertion status and expose both in the UI.
- Add first-class analytic judgments, assumptions, alternative hypotheses,
  collection requirements, reviews/dissents, and technique-run records with
  stable IDs and revision history.
- Store estimative likelihood separately from analytical confidence and require
  a confidence-basis statement when a confidence level is used.
- Require evidence plus explicit analyst action to mark an external claim
  corroborated or promote a finding to an event.
- Require an explicit source-independence decision before **corroborated** is
  available; duplicated wire copy, syndicated stories, and reports citing the
  same unnamed origin remain one source lineage unless independently supported.
- Display compact source coverage on RSS and in Narrative view, with the
  complete evidence trail in Analyst view.
- Warn before removing the final support for a corroborated event.
- Add workspace-defined handling labels and export/redaction policy for source,
  assertion, evidence, event, and judgment objects. A public narrative is a
  separately reviewed representation, not an implicit downgrade of everything
  in its parent artifact.

Dependencies:

- Authenticated, workspace-scoped Timeline create/read/update endpoints.
- Optimistic versioning and 100% authorization coverage on artifact writes.
- Content Research passage IDs and Evidence Library backlinks.

Exit gates:

- Every published external event has at least one inspectable evidence
  reference or is prominently marked unsupported.
- Disputed events show supporting and contradicting evidence separately.
- A reader can expand an assessed event into the distinct source assertions
  behind it, including conflicting dates or wording and known derivation.
- Every published analytic judgment links to its evidence and reasoning,
  identifies material contrary evidence and assumptions, and keeps likelihood
  distinct from analytical confidence.
- AI suggestions never acquire corroborated status or source provenance by
  implication.
- A two-source circular-reporting fixture cannot pass the corroboration gate,
  and restricted evidence cannot leak through publication, TimelineJS export,
  API expansion, search indexing, or webhook metadata.
- Cross-tenant read/write/publish attempts fail closed, stale revisions return a
  machine-readable precondition error, and safe retries cannot duplicate an
  artifact, event, evidence link, or revision.
- A generic service client and the ResearchTools UI produce equivalent artifact
  state through the same public contract.
- Replaying semantic changes from the root or an approved snapshot reproduces
  the same content hashes and current projection; no edit mutates an earlier
  object version or revision.

### Phase 3 — Rich time, tracks, relations, and diagnostic tradecraft

**Goal:** Handle incident chronologies and parallel event streams without
flattening or inventing time, then make the patterns and gaps reviewable.

Deliverables:

- Release `timeline-analysis.v2` only after its JSON Schema, v1 compatibility
  behavior, evidence-locator semantics, and migration guide are reviewed.
- Support exact timestamps through milliseconds where the source warrants it,
  named timezones, partial dates, bounded intervals, circa dates, relative time,
  and explicit unknown time.
- Preserve source display text while normalizing a separate value for sorting.
- Permit multiple source assertions about one event to retain different times,
  precision, and sequence. An analyst-selected working time must cite the
  assertions or reasoning behind it and must not overwrite the variants.
- Add parallel tracks for actors, organizations, geography, or analytical
  domains, with multi-select filters. Allow configurable entity/evidence lanes
  such as people, groups, places, communications, vehicles, or sensor streams
  without hard-coding those domains into the base event schema.
- Add event relations: `precedes`, `overlaps`, `supports`, `contradicts`, and
  analyst-asserted `possibly_causes`.
- Add zoom and density controls, simultaneous-event grouping, and compact
  period/era summaries.
- Add a chronology-diagnostics overlay that records candidate patterns,
  correlations, anomalies, temporal gaps, discrepant accounts, changes in
  tempo, and possible intervention or collection points. These are analyst
  annotations, not generated facts or causal conclusions.
- Add versioned technique-run workspaces for Key Assumptions Check, Quality of
  Information Check, and ACH. ACH must preserve each evidence/hypothesis cell,
  consistency assessment, diagnosticity, sensitivity to critical evidence,
  expected-but-absent evidence, possible deception, and hypotheses retained for
  monitoring.
- Keep latest/oldest selection independent of filters and deep links.
- Return page cursors and stable secondary sort keys from API event reads so
  clients receive deterministic results when dates or sequence positions tie.
- Extract the safe, non-mutating parts of browser `timeline-assist.v1` into a
  separately versioned `timelineReview` service capability. Suggestions must
  reference supplied event IDs, distinguish questions from hypotheses, cite the
  inputs they use, and never imply that a mutation occurred.

Exit gates:

- Round-trip export never changes precision, timezone, interval, or unknown
  status.
- Existing `timeline-analysis.v1` callers continue to receive the exact v1
  contract; selecting v2 is explicit and never inferred from headers or newly
  added request fields.
- `timelineReview` stays absent from discovery until service authentication,
  bounded inputs, refusal/error behavior, prompt-injection handling, and
  consumer contract tests are complete.
- A multi-track fixture can be read both as one chronology and as isolated
  threads without duplicating events.
- No relation or visual proximity is presented as causal without an explicit
  analyst assertion.
- Re-running a technique against the same artifact revision preserves the
  previous run, names the method/version and participants, and produces
  reviewable differences instead of silently replacing the earlier reasoning.
- An ACH result cannot be summarized as a ranking without exposing the matrix,
  contrary evidence, sensitivity, and method used to reach it.

### Phase 4 — Temporal composition and multi-scale timelines

**Goal:** Let an investigation contain, overlay, and drill into behavior,
source-account, plan, activity, episode, and other temporal scopes without
copying their records, flattening their meanings, or inventing shared time.

Deliverables:

- Add named same-artifact temporal scopes with stable IDs, typed purpose,
  explicit or rule-based membership, declared extent, time domain, and handling.
  Objects may belong to multiple overlapping scopes without being duplicated.
- Add `timelineComposition` and typed `expands`, `contains`, `overlays`,
  `behavior_of`, `account_of`, `contextualizes`, `operationalizes`, and
  `instantiates` links. Keep composition role distinct from temporal interval
  relation and evidence/causal relations.
- Add `pinned_revision` and `track_branch` child selectors. Resolve tracking
  links to exact revision manifests for every saved projection; surface newer
  child heads as update candidates rather than mutating the host.
  Initially track only the default branch created with the durable artifact in
  Phase 2; tracking arbitrary working branches becomes available in Phase 5.
- Add absolute, anchor-relative, ordinal, recurring-template, and mixed time
  domains plus explicit child-to-host anchor mappings. Propagate uncertainty and
  detect missing, inconsistent, timezone-conflicting, or precision-increasing
  mappings.
- Add bounded composition reads with depth, node, byte, relationship, object-
  type, track, time-window, and knowledge-cutoff controls. Prevent N+1 traversal,
  repeated-node expansion, containment cycles, and unauthorized-child leakage.
- Add macro, expand-in-place, focus-with-breadcrumb, synchronized-lane, and
  small-multiple views. Relative or ordinal children remain visibly local when
  they cannot join the host's absolute axis.
- Add deterministic derived roll-ups and projection manifests. Show asserted
  parent time/status separately from child-derived extent, completion, evidence
  coverage, or other summary.
- Add temporal templates and instances for recurring behaviors, processes,
  playbooks, and runbooks. Each instance pins a template revision, supplies
  parameters and anchors, and receives its own actual/evidence identity.
- Migrate Behavior Timeline compatibility carefully. Continue reading inline
  `sub_steps`, recursive `forks[].path`, and cached `linked_behavior_*` fields;
  write new addressable behavior steps/pathways as scope/alternative objects and
  link a durable Behavior Analysis by artifact plus revision. Cached labels stay
  display-only.
- Treat behavior decision type, psychological state, motivation mode, and COM-B
  target as behavior-domain objects or assessments. They may cite investigation
  events as observations but never become assessed real-world events solely
  because they appear inside the parent timeline.
- Make composite forks shallow by default. Offer a separately confirmed,
  bounded deep fork that enumerates copied children and derivation links; never
  recursively fork or merge an unknown graph.
  These fork operations ship with Phase 5 branch support; Phase 4 establishes
  the composition contracts and fixtures they require.
- Require separate composition read/write authorization and enforce the most
  restrictive child handling policy. Render an honest restricted/unavailable
  placeholder without cached title, count, extent, or relationship details that
  would leak protected information.

Exit gates:

- A same-artifact scope and a cross-artifact child render without copying or
  changing any member object's stable identity, provenance, or epistemic type.
- Containment-cycle fixtures fail clearly; contextual/overlay cycles terminate
  safely; all traversals enforce advertised depth, node, and response-size
  limits.
- Absolute, valid anchor-relative, unresolved relative, ordinal, and conflicting
  multi-anchor fixtures preserve expected placement and precision through API,
  UI, export, and comparison.
- A Behavior Timeline with sub-steps, nested legacy fork paths, linked behavior,
  psychological-state hypotheses, and COM-B targets migrates and round-trips
  without losing IDs or recasting analysis as observed fact.
- One child artifact can appear in several authorized hosts without cloning it;
  unlinking one composition does not alter or delete the child or other links.
- A tracking child update leaves the saved host projection unchanged, creates a
  reviewable availability state, and produces a new resolved manifest only when
  deliberately refreshed.
- Publications and comparisons reject unresolved tracking selectors and pin
  exact authorized child revisions plus projection method/version.
- Shallow fork creates no child copies. Deep fork copies exactly the reviewed
  child set, preserves derivation, and reports shared, copied, skipped,
  unauthorized, and failed children without partial hidden mutation.
- Unauthorized children and derived relations remain undiscoverable except for
  a policy-approved generic placeholder; composite exports and errors obey the
  same gate.
- Macro, expanded, focused, and overlapping-lane views remain keyboard
  navigable, usable without color, and understandable through accessible scope,
  relation, local-time, and breadcrumb labels.

### Phase 5 — Comparison, falsification, and semantic branch/merge

**Goal:** Let analysts compare versions, accounts, hypotheses, and outcomes;
state what evidence could disconfirm a claim; and collaborate through forks and
reviewed merges without flattening disagreement or provenance.

Deliverables:

- Add `timelineComparison` for `revision_diff`,
  `cross_timeline_alignment`, `alternative_matrix`, `plan_option_matrix`, and
  `plan_outcome`. Every run pins immutable inputs, method/version, world window,
  knowledge cutoff, handling policy, and result revision.
  Advertise only the first three modes in Phase 5. Plan comparison modes become
  executable with Phase 6 plan resources and pass their gates there.
- Add **Compare revisions** with a temporal overlay and object-level change list.
  Group changes into content, time/precision, evidence, epistemic state,
  identity, structure, narrative, plan, and handling categories rather than
  presenting an undifferentiated JSON diff.
- Add **Compare accounts** for two or more independently authored timelines.
  Generate
  candidate alignment groups with reasons, then require review for same,
  partial-overlap, part-of, different, unresolved, split, and combine identity
  decisions.
- Add an N-way **Compare alternatives** matrix over shared evidence,
  observations, and test criteria. Highlight inconsistent and diagnostically
  differentiating rows, critical-evidence sensitivity, expected-but-absent
  evidence, possible source dependence/deception, and remaining collection
  gaps. Keep all reasonable alternatives visible after ranking.
- Preserve each analyst's matrix cells and rationale. A Delphi summary, median,
  disagreement flag, or facilitated consensus is a derived or separately
  approved view; never replace individual judgments with an average.
- Add **What would change or disconfirm this?** to assumptions, propositions,
  hypotheses, scenarios, plan assumptions, and expected plan effects. Support
  immutable registered criteria, candidate expectations, measurement windows,
  coverage requirements, collection links, observations, and categorical
  evaluations.
- Add an **As known at** cutoff to comparison and technique views. Recompute the
  matrix from information available by that knowledge time while retaining the
  retrospective view as a separately labeled comparison.
- Adapt existing ACH analyses into the shared alternative/evaluation model while
  preserving their original integer cells and scale. Rename the derived ACH
  percentage in new comparison surfaces to **relative inconsistency ranking**;
  do not present it as a calibrated likelihood.
- Use Cross Table as an optional matrix/sensitivity/Delphi renderer for plan
  options and other decisions, backed by canonical candidates, criteria, and
  evaluations rather than copied rows and scores.
- Add protected lineage branches forked from a named revision, a branch graph,
  ahead/behind counts, and reviewable merge requests. Branch names and intent
  are metadata; the authoritative history is the immutable revision DAG.
- Implement semantic three-way merge from the best common ancestor or ancestors.
  Record every best base. If criss-cross history yields several, either require
  an explicit base decision or construct a versioned virtual base through the
  same conservative conflict rules; never pick one silently. Auto-merge only
  safe non-overlapping edits; block on typed identity, temporal, epistemic,
  evidence, handling, planning, delete/edit, or dependency conflicts until an
  authorized reviewer supplies a resolution and rationale.
- Apply a merge as a new two-parent revision. Preserve source and target branch
  heads, the frozen proposal, rejected changes, kept-parallel disagreements,
  approvals, and all conflict resolutions.
- Add separate permissions for reading comparisons, editing evaluations,
  creating branches, proposing merges, resolving protected conflicts, and
  applying merges. Preflight derived-data handling before revealing comparison
  output or moving any object to the target branch.

Exit gates:

- The same input revisions, cutoff, method/version, and parameters yield the
  same mechanical diff and diagnostic calculations, with stable pagination and
  content hashes.
- A three-way fixture finds its expected common ancestor(s), handles a multiple-
  base fixture explicitly, and distinguishes
  changes made only on source, only on target, identically on both, and
  incompatibly on both.
- An applied merge has exactly two parents, never rewrites either parent, and
  can reproduce every accepted, rejected, combined, and kept-parallel choice.
- No epistemic, identity, time/precision, handling, plan-approval, or
  delete/edit conflict is auto-resolved; stale branch heads invalidate the
  proposal with a machine-readable precondition failure.
- Independent timelines cannot merge on an automated similarity score alone;
  reviewed alignments retain match features, method/version, and dissent.
- An N-way matrix evaluates the same evidence and tests against every candidate,
  retains `indeterminate` and `not_applicable`, and exposes all calculations and
  sensitivity inputs without declaring an automatic winner.
- `not_collected`, `not_observed`, `collection_failed`, ambiguous, expired, or
  inadequate-coverage observations cannot count as absence or falsification.
- Editing a criterion after its outcome is knowable creates a visibly later
  version; the original preregistered expectation remains available.
- Existing ACH analyses round-trip through the adapter without changing their
  original cell values, and no relative inconsistency percentage is labeled or
  exported as probability.
- Comparison output, existence, counts, notifications, merge previews, and
  errors do not reveal objects or relationships outside the caller's handling
  and workspace authority.
- Compare, matrix, branch, and conflict-resolution views are keyboard navigable,
  usable without color, and provide an accessible text/table alternative to
  overlays and branch graphs.

### Phase 6 — Planning timelines and operational periods

**Goal:** Let a team plan an event, project, incident response, or operation on
the same temporal canvas without confusing intended work with observed events
or possible futures.

Deliverables:

- Add **Plan view** only to durable, authorized investigation artifacts. Plan
  objects share evidence/entity references with the analyst ledger but use
  separate IDs, types, permissions, revisions, and status vocabularies.
- Provide **Basic planning** for objectives, phases, tasks, milestones, owner,
  scheduled window, timezone, status, definition of done, and notes. This should
  support an ordinary event run of show without requiring project-management
  expertise.
- Provide **Advanced planning** for typed dependencies and lag, constraints,
  assignments, resource references, decision points, branches/contingencies,
  operational periods, risk/safety notes, and schedule-risk annotations.
- Let teams create several **Plan options** over one shared objective,
  constraint, resource, risk, and test set. Compare must-pass failures,
  tradeoffs, assumption exposure, expected effects, and sensitivity before an
  authorized selection; adoption creates a derived plan revision and preserves
  every unselected option and the decision basis.
- Add outline, run-of-show table, calendar-scale timeline, and dependency/Gantt
  views over the same plan objects. Preserve an accessible table and text
  explanation for every relationship or critical-path result.
- Add **Current operational period**, **Next action**, **Upcoming**,
  **Overdue**, **Blocked**, and **Unassigned** filters. Chronological direction
  remains a display choice and never changes dependency order or priority.
- Validate dependency cycles, impossible milestone ordering, unsupported
  constraint combinations, missing timezones, and resource conflicts. Critical
  path and float are calculated only from a complete-enough dependency network
  and expose the calculation basis and warnings.
- Add explicit plan lifecycle states such as `draft`, `under_review`,
  `approved`, `active`, `superseded`, `completed`, and `cancelled`; add plan-item
  states such as `proposed`, `scheduled`, `in_progress`, `blocked`, `completed`,
  `skipped`, and `cancelled`.
- Create immutable approved baselines. Keep baseline, current forecast, and
  actual start/end values separate, and require a reason plus author/revision
  for changes that create material variance.
- Add operational periods with bounded start/end, current objectives,
  assignments, resource and risk/safety review, briefing state, status summary,
  and deliberate rollover. Carried work preserves its original item identity
  and records why it moved.
- Model links from indicators and collection requirements to decision points;
  activate condition-change prompts when Indicators/Signposts ship in Phase 7.
  Show applicable branch options and decision authority, but never select or
  execute a branch automatically.
- Allow a completed plan item to link to one or more Activity Timeline records,
  evidence items, or assessed events. Preserve the plan item and original
  baseline so the team can compare intent, execution, and outcome.
- Evaluate plan assumptions and expected effects through the shared test-
  criterion and observation model. A `plan_outcome` comparison traces objective
  → measure → planned work → actual execution → observed effect while leaving
  causal attribution as a separate analyst judgment.
- Advertise `timelinePlanning` only when planning routes, schemas, scopes,
  baseline semantics, authorization, and audit are executable. Keep calendar,
  project-management, and incident-command exports versioned and explicitly
  lossy where their models cannot preserve ResearchTools planning state.

Exit gates:

- Planned, forecast, scenario, observed-event, and activity records remain
  distinguishable in API types, visual treatment, accessible labels, search,
  export, and audit history.
- Approving or reforecasting a plan never rewrites an immutable baseline;
  plan-versus-current-versus-actual variance is reproducible from revisions.
- Dependency-cycle fixtures fail clearly, and critical-path/float fixtures
  produce deterministic results with an inspectable calculation basis.
- A task marked completed does not automatically create a real-world event or
  assert that its objective was achieved.
- Selecting a plan option records authority and rationale and creates a derived
  plan revision; it does not delete alternatives, masquerade as a lineage merge,
  or execute the selected work.
- Rollover to a new operational period preserves unfinished assignments,
  decisions, risks, and reasons without duplicating them.
- Planning reads and writes pass cross-workspace, stale-revision, retry,
  handling, publication, and least-privilege authorization tests.
- A due task, changed indicator, or selected branch never triggers an external
  action without a separately enabled and authorized execution integration.
- A basic event plan remains usable from keyboard and mobile without loading
  the advanced dependency graph or every historical revision.

### Phase 7 — Living timelines, knowledge reconstruction, and warning

**Goal:** Let an ongoing story change safely as sources and events accumulate,
while showing what was knowable when and what indicators could change the
assessment next.

Deliverables:

- Add artifact `as of`, `data through`, last-checked, and last-changed values.
- Add durable community-story revision IDs. The RSS one-minute freshness token
  can tell an open page that something changed, but it is not sufficient lineage
  for an investigation import or a published narrative.
- Add stable event fingerprints and candidate-match review for new RSS/source
  material.
- Show **new since your last view**, changed, corrected, disputed, and retracted
  states.
- Maintain append-only event revision history with who/what/when/reason and a
  readable before/after comparison.
- Expand beyond simple bitemporal `occurredAt`/`learnedAt` semantics. Preserve
  distinct observed, reported, published, retrieved, analyst-recorded, and
  communicated clocks when available, with unknown values left unknown.
- Add **World chronology / Knowledge chronology** switching. The first orders
  assessed events by occurrence; the second can reconstruct what reporting and
  judgments were available, revised, and communicated at a chosen cutoff.
- Add append-only judgment history that states whether a major judgment is new,
  consistent, strengthened, weakened, or changed and identifies the evidence,
  assumption, or reasoning responsible. Preserve material dissent across
  versions.
- Add Indicators/Signposts workspaces linked to hypotheses or scenarios. Each
  indicator records expected presence or absence, observation state
  (`observed_present`, `observed_absent`, `not_observed`, `not_collected`, or
  `not_applicable`), trend, threshold, last check, source assertions, and the
  judgments it could change.
- When new material falls inside a registered criterion's observation window,
  suggest an observation and show which alternative cells may need review.
  Preserve the comparison's prior result revision; do not automatically change
  a categorical evaluation, reject an alternative, or rewrite a criterion.
- When an indicator linked to an active plan changes materially, create a
  reviewable decision item that shows the base plan, applicable branches,
  decision authority, deadline, and downstream schedule effect. Do not change
  the plan until an authorized user records the decision.
- Let analysts promote a material gap into a prioritized collection requirement
  with owner, due/review date, and resolution evidence. Closing a gap updates
  the requirement; it does not silently revise a judgment.
- Add distinct warning/scenario pathways for alternative futures, What If?,
  premortem, and backcasting. Pathway steps can identify antecedent conditions,
  expected windows, location or condition, indicators, collection priorities,
  and decision points. They remain visually and structurally separate from
  historical events.
- Support a watch condition or concern state only through an explicit,
  workspace-defined method. Indicator counts alone must not automatically set
  likelihood, analytical confidence, or an alert severity.
- Generate a reviewable update digest; never silently rewrite a published
  narrative.
- Keep community ingestion and investigation review distinct: Signal/RSS may
  continue updating the shared community graph, while an imported ResearchTools
  snapshot changes only when an analyst requests **Check community updates** and
  accepts candidates.
- Permit source refresh to suggest additions, changes, or duplicates in an
  investigation while leaving all mutations under analyst control until merge
  benchmarks pass.
- Record whether an investigation follows an RSS article, a versioned RSS story
  snapshot, or neither. Never infer a live subscription merely because an
  external event reference exists.
- Add `202 Accepted` asynchronous timeline jobs for multi-source analysis,
  refresh, comparison, and candidate resolution, with polling before webhooks.
- Make `timelineResolution` return candidate event pairs/clusters with scores,
  match features, source membership, and a stable review token. It may update the
  community graph under its existing policy but cannot merge an investigation
  timeline without a separately authorized analyst/client decision.
- Add idempotent job submission, monotonic status transitions, bounded retention,
  cancellation rules, terminal result references, and advertised concurrency/
  batch limits.
- Add signed update webhooks only after polling passes reliability gates. Keep
  payloads metadata-first and require consumers to fetch authorized content.

Exit gates:

- Re-running extraction against an unchanged source is idempotent.
- Updates preserve existing event IDs and deep links whenever identity is
  unchanged.
- An investigation imported from RSS can identify the exact community-story
  revision it used and can compare against a later revision without auto-editing
  analyst work.
- A corrected early report remains inspectable and is not mistaken for the
  current claim.
- The live Iran demo clearly identifies its cutoff, update time, and revisions.
- A postmortem fixture can reproduce both the later best-known world sequence
  and the incomplete knowledge sequence available at an earlier cutoff without
  rewriting either one.
- Scenario steps, absent indicators, and completed events cannot be confused by
  visual style, API type, screen-reader label, or TimelineJS export.
- Changing an indicator generates a reviewable assessment prompt and optional
  notification, never an automatic change to a published judgment.
- A new observation produces a comparison revision or review queue item and can
  be examined at both the prior and current knowledge cutoff without altering
  the preregistered expectation.
- Repeated job submissions with one idempotency key cause one model workload and
  return the original job reference.
- Polling and webhook clients converge on the same terminal revision, duplicate
  webhook delivery is safe, and revoked credentials stop future reads and
  deliveries.

### Phase 8 — Media, maps, and explanatory context

**Goal:** Use supporting material when it clarifies the chronology.

Deliverables:

- Add rights-aware images, documents, audio/video timestamps, captions, credits,
  and alternative text.
- Synchronize map locations and timeline selection for geographically meaningful
  cases.
- Allow compact charts for variables that change alongside events, such as
  service recovery, seismic sequence, or market/shipping indicators.
- Label observed versus forecast data and preserve the forecast issue time.
- Keep media optional; it must support the event's role rather than decorate the
  interface.

Exit gates:

- Missing or blocked media does not make the narrative unusable.
- Every published media item has credit, accessibility text, and a recorded
  usage basis.
- Charts expose source, unit, time basis, and data cutoff.

### Phase 9 — Publishing and TimelineJS interoperability

**Goal:** Produce a shareable, accessible narrative while retaining the richer
research artifact and the RSS community record.

Deliverables:

- Add authenticated preview, publish/unpublish, immutable version, and stable
  event/chapter URLs.
- Add a separate immutable **Plan brief** for approved plan versions. Plan
  sharing is private by default, requires explicit audience and handling review,
  and cannot reuse public Narrative-view settings or RSS publication state.
- Add an immutable **Comparison brief** that pins its input revisions, cutoff,
  method/version, reviewed alignments/evaluations, material differences,
  unresolved conflicts, and caveats. It is private by default; public release is
  a separately redacted representation and cannot expose branch or alternative
  content through counts, links, or omitted-row hints.
- Add an immutable **Composite view snapshot** that pins the root revision,
  authorized child revisions, scope filters, anchor mappings, expansion policy,
  roll-up methods, and traversal limits. A public snapshot includes only
  explicitly reviewed children and never continues tracking a branch.
- Add a first-party read-only ResearchTools narrative route and embeddable
  presentation. It represents an analyst-published investigation version, not a
  competing reconstruction of the RSS community `Story so far` page.
- Let RSS link to or embed a specific published ResearchTools narrative version
  while continuing to expose its full canonical event record, network, coverage
  status, and source corpus. Label the two choices **Narrative** and **Full
  record** rather than presenting them as interchangeable.
- Add a TimelineJS-compatible JSON export/adapter based on Knight Lab's
  [JSON format](https://timeline.knightlab.com/docs/json-format.html).
- Provide a companion ResearchTools JSON export containing evidence, review,
  revision DAG, comparison, test/evaluation, merge, relation, and planning fields
  that TimelineJS cannot express. TimelineJS export presents one selected
  narrative revision; it does not encode competing alternatives or merge them.
- Treat TimelineJS groups and eras as a limited flat presentation adapter, not
  nested-timeline support. Export one selected scope or an explicitly flattened
  bounded projection; warn when overlapping eras, local relative clocks,
  composition roles, or drill-down relationships cannot survive the mapping.
- Offer plan-specific calendar, run-of-show CSV/PDF, or incident/project adapter
  exports only through explicit formats. These exports never imply that a task
  was dispatched, accepted by an assignee, or completed in the destination.
- Evaluate a pinned/self-hosted TimelineJS renderer as an optional presentation
  mode; do not make it a dependency of editing or evidence review.
- Record published version, data-through date, source coverage, and corrections
  policy on the reader-facing page.
- Expose immutable published-version JSON for authorized or intentionally public
  API consumers with explicit visibility, cache, CORS, and revocation behavior.
- Advertise supported export media types and versions through capability
  discovery; return `406` for unsupported formats rather than silently changing
  representation.

Proposed interoperability mapping:

| ResearchTools | TimelineJS |
| --- | --- |
| Artifact title and framing | Title slide `text` |
| Temporal start/end and precision | `start_date` / `end_date` |
| Human-readable temporal claim | `display_date` |
| Event headline and narrative summary | Event `text` |
| Media, caption, credit, alt text | `media` |
| Track label | `group` |
| Chapter period | `eras` |
| Stable, scope-qualified investigation event ID | `unique_id` |
| Open a live timeline at the newest event | `start_at_end` option |

Exit gates:

- Published narratives can be reproduced from an immutable artifact version.
- Shared plan briefs can be reproduced from an immutable approved baseline and
  do not reveal superseded, restricted, or unapproved planning material.
- Shared comparison briefs can be reproduced from their immutable inputs and do
  not reveal restricted alternatives, evidence, conflicts, or derived
  relationships.
- Shared composite snapshots can be reproduced from their resolved-input
  manifest and reveal neither newer tracking heads nor unauthorized child
  identity, metadata, counts, or relationships.
- TimelineJS export validates and preserves ordering, dates, IDs, groups, eras,
  and accessible media metadata.
- Private artifacts are not sent through public spreadsheets or unapproved
  third-party services.
- Narrative pages and RSS embeds meet the same keyboard, screen-reader,
  responsive, reduced-motion, security, and content-sanitization gates as the
  main product.

## Case-study and demo corpus

Use published chronologies to test distinct failure modes. The corpus is a
product benchmark, not a claim that every source can be redistributed in full.

| Case | What it tests | Intended demonstration |
| --- | --- | --- |
| [NASA Apollo 13 accident chronology](https://www.nasa.gov/history/detailed-chronology-of-events-surrounding-the-apollo-13-accident/) | Exact mission elapsed time, sub-minute sequencing, buildup, intervention, and resolution | A concise story derived from a much denser ledger |
| [CrowdStrike preliminary post-incident review](https://www.crowdstrike.com/en-us/blog/falcon-content-update-preliminary-post-incident-report/) | Deployment, detection, rollback, recovery, and causal explanation in a short incident | Fastest end-to-end extraction and story demo |
| [NTSB Dali / Key Bridge final report](https://www.ntsb.gov/investigations/AccidentReports/Reports/MIR2540.pdf) and [public docket](https://data.ntsb.gov/Docket?ProjectID=193991) | Seconds-level events, engineering evidence, recordings, interviews, parallel tracks, and source locators | Evidence-rich advanced investigation demo |
| [9/11 Commission Chapter 1](https://911commission.gov/report/911Report_Ch1.htm) | Simultaneous aircraft, agency, and command tracks with explicit evidentiary basis | Parallel-track and chapter navigation demo |
| [January 6 Select Committee timeline](https://www.govinfo.gov/content/pkg/GPO-J6-DOC-CTRL0000930981/pdf/GPO-J6-DOC-CTRL0000930981.pdf) | Preliminary reports later superseded or corrected | Revision and epistemic-status demo |
| [CIA: Predicting the Soviet Invasion of Afghanistan](https://www.cia.gov/resources/csi/books-monographs/predicting-the-soviet-invasion-of-afghanistan/) | Reconstructs what was collected, when it was obtained, how it was interpreted, and what was communicated, then compares that record with the later-known operational sequence | World-versus-knowledge chronology, judgment-change, and postmortem demo |
| [CIA Kinetic Predictive Analytic Technique](https://www.cia.gov/resources/csi/studies-in-intelligence/volume-66-no-4-december-2022/combating-surprise-introducing-the-kinetic-predictive-analytic-technique/) | Antecedent pathways, dynamic capabilities, indicators, information gaps, and framework revision, including a 1979 Iran warning case | Scenario-pathway and indicators demo kept separate from the live Iran event record |
| [CIA Tradecraft Primer — Analysis of Competing Hypotheses](https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf) | Simultaneous evidence-by-alternative evaluation, disconfirmation, diagnostic evidence, sensitivity, expected-but-absent evidence, and continued monitoring | N-way timeline-alternative matrix and falsification fixture |
| [GAO Schedule Assessment Guide](https://www.gao.gov/products/gao-16-89g) | Integrated activities, dependencies, critical path, float, risk, progress updates, and controlled baselines | Advanced schedule, explainable variance, and plan-quality fixture |
| [FEMA Incident Action Planning Guide](https://www.fema.gov/sites/default/files/2020-07/Incident_Action_Planning_Guide_Revision1_august2015.pdf) and [ICS forms](https://training.fema.gov/emiweb/is/icsresource/icsforms/) | Objectives, assignments, resources, safety, operational periods, status, and planning-cycle handoff | Operational-period, plan brief, and incident-planning interoperability fixture |
| [WHO COVID-19 interactive timeline](https://www.who.int/emergencies/diseases/novel-coronavirus-2019/interactive-timeline) and [text chronology](https://www.who.int/news/item/29-06-2020-covidtimeline) | Long-running updates, filters, data cutoffs, and institutional response | Living-timeline and filtered-story demo |
| [USGS earthquake sequence product](https://www.usgs.gov/programs/earthquake-hazards/science/earthquake-sequence-product) | Time plus geography and observed events versus forecasts | Map, forecast-state, and changing-data demo |
| [CFR U.S.–Iran confrontation tracker](https://www.cfr.org/global-conflict-tracker/conflict/confrontation-between-united-states-and-iran) | Ongoing contested reporting, sources per entry, last-updated state, and navigation | Primary live-update demo for the RSS story |
| [Guardian Iran war visual chronology](https://www.theguardian.com/world/ng-interactive/2026/aug/28/how-the-iran-war-unfolded-every-attack-and-oil-price-change-visualised) | Linked military, diplomatic, shipping, and market tracks | Multi-domain story and chart benchmark |
| [ACLED event API schema](https://acleddata.com/api-documentation/acled-endpoint) | Structured event types, actors, locations, and temporal precision at volume | Import and filtering stress case, subject to access terms |

The initial reliable demo set should use Apollo 13, CrowdStrike, the WHO text
chronology, 9/11 Commission HTML, and CFR. PDF-heavy, dynamic, mapped, and
high-volume sources belong in the advanced ingestion suite.

## Demo scripts

### 90-second product demo — CrowdStrike

1. On the RSS article page, use **Build article timeline** and show that the same
   stored result is reachable from Signal `!timeline`.
2. Open the compact RSS Article timeline, then choose the separate **Continue in
   ResearchTools** action.
3. Show the imported source lineage and complete ResearchTools Analyst view.
4. Switch between oldest-first and latest-first without changing the artifact.
5. Select the small set of buildup, turning-point, response, and recovery events.
6. Switch to Narrative view, navigate from the chapter outline, and inspect one
   event's evidence and why-it-matters text.

### Two-minute external API demo — CrowdStrike

1. Call capability discovery with an operator-provisioned sandbox service
   credential and verify `timelineAnalysis` plus `timeline-analysis.v1`.
2. Submit the frozen CrowdStrike URL or permitted fixture text with a caller
   correlation ID.
3. Validate the returned schema and show date precision, extraction provenance,
   rejected-event count, and deterministic oldest-first ordering.
4. Render the same JSON in a small client with an oldest/latest display choice;
   no ResearchTools or RSS component is required.
5. Show the current `no_events`, content-unavailable, and retryable-model paths
   without resubmitting on terminal errors; add the machine-readable rate-limit
   path when that contract ships.
6. State clearly that v1 is non-persistent candidate extraction. Repeat the demo
   with artifact creation, jobs, revisions, and export only as those advertised
   capabilities ship.

### Four-minute investigation demo — Key Bridge or Apollo 13

1. Import a frozen fixture and show exact-time preservation.
2. Filter parallel operational and response tracks.
3. Open an evidence locator and a disputed or uncertain interpretation.
4. Record a gap, launch research, and review the returned finding.
5. Promote only a sourced finding, then add it to the story.
6. Publish an immutable version and open its deep link.

### Five-minute composition demo — behavior within an incident

1. Open a compact incident timeline and expand one aggregate episode without
   replacing the macro chronology or copying its detailed child events.
2. Attach a durable Behavior Analysis as `behavior_of` one actor during the
   episode. Pin its revision and map behavior `T+0` to an uncertain parent event
   anchor; show the propagated uncertainty rather than an invented timestamp.
3. Focus the behavior child and inspect goal formation, intention, coping, and
   COM-B/psychological-state assessments alongside their supporting or contrary
   observed events. Make clear that the assessments are not world events.
4. Overlay an independently governed source-account chronology and an
   organizational response timeline in synchronized lanes. Show shared,
   overlapping, local-ordinal, and unresolved-time portions without merging
   their identities.
5. Instantiate one reusable behavior template twice at different host anchors;
   preserve distinct occurrence identity, evidence, actual timing, and outcome.
6. Advance the tracked Behavior Analysis branch. Show **child update available**
   while the saved host projection remains pinned to its prior resolved manifest.
7. Refresh deliberately, compare the two composite manifests, and publish a
   bounded snapshot whose child revisions and time mappings are reproducible.

### Six-minute comparison demo — competing incident chronologies

1. Open a frozen incident timeline at revision R and create Team A and Team B
   lineage branches from that exact base.
2. On Team A, revise an uncertain time and add a source assertion. On Team B,
   split one compound event and retain a conflicting account.
3. Compare both heads with R. Show independent edits, the temporal conflict,
   split identity, shared evidence, and the result **as known at** the original
   cutoff versus retrospectively.
4. Create three analytic alternatives without cloning the timeline. Register
   one discriminating expected observation and the collection coverage needed
   for absence to count against an alternative.
5. Add one adequately observed absence and one uncollected result. Show the
   first as potentially disconfirming and the second as `indeterminate`, then
   inspect the matrix's relative inconsistency and sensitivity without calling
   either a probability or automatic winner.
6. Propose a Team B → Team A merge. Accept safe non-overlapping additions,
   retain both disputed temporal claims, and resolve the split explicitly with
   evidence and rationale.
7. Apply the approved merge and show its two parents, unchanged source heads,
   resolution audit, and reproducible post-merge comparison.

### Four-minute planning demo — event run of show

1. Create a Plan view for a public briefing, conference session, or product
   launch; state the objective, timezone, success measure, and approval owner.
2. Add preparation tasks, gates, the live milestone sequence, assignments, and
   definitions of done in Basic planning.
3. Add dependencies in Advanced planning, inspect the critical path and float,
   and resolve one impossible ordering or resource conflict.
4. Approve an immutable baseline, then move a current forecast time and show the
   affected downstream work and variance without changing the baseline.
5. Record actual start/end for one task and link it to an Activity Timeline
   entry; show that the plan item remains distinct from evidence that the event
   occurred or the objective succeeded.
6. Export a read-only run of show and confirm that no invitation, message,
   reservation, or external action was sent.

### Five-minute planning demo — incident operational period

1. Load a synthetic FEMA-style exercise fixture with incident priorities,
   objectives, assignments, resources, and risk/safety notes for one operational
   period.
2. Use **Current operational period** and **Next action** rather than latest-first
   event ordering; open the plan outline and briefing view.
3. Change a public-source indicator linked to a decision point and show the base
   plan plus branch options, authority, deadline, and expected schedule impact.
4. Record an authorized branch selection without dispatching or executing it.
5. Close the period with a status summary and roll unfinished work into the next
   period with item identity and rollover reasons preserved.
6. Compare baseline, current forecast, actual activity, and assessed outcome as
   four distinct layers.

### Five-minute tradecraft demo — Soviet invasion of Afghanistan postmortem

1. Load the frozen declassified CIA case fixture and state the analytic question
   and historical cutoff being reconstructed.
2. Show **World chronology** using the later best-supported sequence, then move
   the cutoff and switch to **Knowledge chronology** to show what reporting and
   judgments were actually available at the time.
3. Expand one assessed event into conflicting or incomplete source assertions
   and their report/retrieval clocks.
4. Open a Key Assumptions Check and ACH run, including contrary and
   expected-but-absent evidence rather than only the favored explanation.
5. Promote an information gap into a collection requirement and link indicators
   that would have changed the judgment.
6. Compare two judgment versions, preserving the earlier assessment and
   explaining which new evidence, assumption, or reasoning caused the change.

### Living-story demo — Iran

1. Run Signal `!story iran` as the compact preview and follow its link to the RSS
   `Story so far` page.
2. Use the RSS period navigator, source filters, and oldest/latest sort on the
   full community record.
3. Import the displayed community revision into ResearchTools and show its
   visible `as of` timestamp and RSS return link.
4. Check for community updates and review new, changed, and duplicate candidates
   without auto-editing the investigation.
5. Preserve a corrected early report in revision history and show military,
   diplomatic, energy, and shipping tracks independently.
6. Publish an update digest and a newly versioned narrative without breaking old
   RSS, investigation, or narrative links.
7. Optionally open a separate warning overlay with public-source indicators and
   alternative pathways. Keep these visually distinct from completed events and
   never present an unobserved indicator as evidence of absence.

## Cross-cutting quality gates

### Editorial

- A narrative has a clear scope, beginning, development, and current ending.
- Narrative view defaults to 20 or fewer events; additional events require a
  deliberate editorial choice.
- Each selected event has a narrative role and `why it matters` statement.
- Buildup and consequences are represented when needed to understand a turning
  point.
- Generated transitions cite their source event IDs and require analyst review.

### Evidence and AI

- A source reference is not treated as proof unless it supports the event claim.
- Source assertions remain distinguishable from assessed events and analytic
  judgments; every consequential inferential link is inspectable.
- Source volume never stands in for source quality or independence, and known
  derivative/circular reporting is visible before corroboration is permitted.
- Search results remain candidates; findings remain separate until promoted.
- Hypotheses, forecasts, and analyst inferences never appear as observed facts.
- Estimative likelihood and analytical confidence use separate fields, labels,
  and rationale. Neither is inferred from an importance mark, narrative role,
  source count, or model probability.
- Major judgments identify material assumptions, contrary evidence,
  alternatives, gaps, and indicators that would change the assessment.
- AI may suggest events, roles, chapters, summaries, and possible duplicates,
  or draft technique entries, but may not silently mutate, merge, corroborate,
  choose a hypothesis, change a confidence level, set a warning state, publish,
  or delete them.
- Unsupported generated claims are rejected, not softened into uncited prose.

### Time and change

- Unknown, approximate, interval, relative, and exact time survive every
  round-trip.
- Publisher timezone, viewer timezone, and normalized sort value are not
  conflated.
- Event occurrence, source observation/report/publication, retrieval,
  analyst-recorded, and communication time remain distinguishable; unknown
  clocks stay unknown.
- World chronology, Knowledge chronology, and warning/scenario pathways use
  distinct object types and accessible visual treatment.
- `not_collected`, `not_observed`, and `observed_absent` indicators are never
  conflated.
- Every living timeline shows its data cutoff and last material update.
- Corrections and retractions remain visible in history and exports.
- A changed major judgment explains its relationship to the prior version and
  preserves material dissent.

### Temporal composition

- Inline detail, same-artifact scope, independently governed child timeline,
  reusable template, and concrete instance remain distinct structures.
- Composition role, temporal interval relation, evidence relation, causal
  assertion, and lineage relation are separate fields and UI labels.
- A child retains its artifact/object IDs, revision history, ownership,
  handling, epistemic types, and native time domain wherever it is rendered.
- Absolute alignment requires compatible clocks or explicit anchors. Relative,
  ordinal, mixed, and unresolved child time never receives false calendar
  precision from its host.
- Tracking links record the last resolved revision and never silently change a
  saved projection. Publications, comparisons, baselines, and signed-off views
  pin every resolved child input.
- Containment is acyclic. All graph traversal is cycle-safe, authorization-
  aware, and bounded by depth, node, byte, and execution limits advertised in
  capability discovery.
- Parent roll-ups expose method/version, input revisions, and warnings; child
  confidence, epistemic state, completion, and outcome are never naively
  averaged into the parent.
- Shallow fork does not copy children, deep fork is explicit and enumerated, and
  a host merge never recursively merges a child artifact.
- A composition link is not evidence, corroboration, causation, containment of
  authority, or permission to disclose the child.

### Comparison, falsification, and merge

- Revision diff, independent-account alignment, alternative evaluation, plan-
  option comparison, and plan/outcome review are distinct comparison types with
  explicit inputs and result vocabularies.
- Lineage branches, analytic alternatives, scenario pathways, plan options, and
  plan contingencies use distinct IDs and actions; UI shorthand never collapses
  them into a generic branch.
- Every comparison pins immutable revisions, knowledge cutoff, world window,
  method/version, parameters, and handling policy. Recalculation creates a new
  result revision.
- Independent-account matches remain proposed alignments until reviewed; event
  similarity is neither object identity nor corroboration.
- Every testable disconfirmation claim names an observable, window, expected
  result, candidate-specific meaning, and required collection coverage.
- `not_observed`, `not_collected`, collection failure, and inadequate coverage
  remain inconclusive. Only evidence-qualified `observed_absent` can support an
  absence claim.
- ACH consistency, contradiction, diagnosticity, sensitivity, and ranking are
  inspectable projections. No normalized or weighted score is labeled as a
  calibrated probability or silently copied into estimative likelihood.
- A plan is never labeled true or false. Compare execution and measured effects
  separately, and require an analytic judgment for causal attribution.
- Semantic merges preserve both parents, stable IDs, provenance, rejected
  changes, and kept-parallel disagreements. Protected conflict classes always
  require an authorized, reasoned resolution.

### Planning

- Plan objectives, tasks, milestones, decisions, and contingencies use plan
  object types; they never enter the observed-event stream by presentation
  shortcut.
- Planned, current-forecast, and actual times remain distinct, and every
  approved baseline is immutable and reproducible.
- Dependencies are typed, cycle-checked, and inspectable. Critical path, float,
  resource-conflict, and schedule-risk results expose inputs, warnings, and the
  calculation time instead of appearing as unexplained AI conclusions.
- Completing a task records execution status, not proof that the objective or
  intended external outcome occurred.
- Operational periods have explicit bounds, objectives, assignments, resource
  and risk/safety review, briefing state, closeout, and traceable rollover.
- Branches and contingencies name their trigger/condition and decision authority;
  indicator changes create review work but cannot approve or execute a branch.
- Plan views disclose timezone, data/status cutoff, current baseline, approval
  state, and whether resource data is complete enough to detect conflicts.
- External calendar, messaging, reservation, dispatch, publishing, and automation
  side effects remain disabled unless separately authorized and audited.

### UX, performance, and accessibility

- Every cross-product action says whether it builds, opens, refreshes, or
  imports; **Start timeline** is not used as an ambiguous catch-all.
- Signal previews state their ordering and say `Showing X of Y` when truncated;
  the linked RSS page exposes the full stored record.
- RSS source-count labels do not claim corroboration, and importance indicators
  do not claim a narrative role.
- Sort, filter, focus, and narrative selection are independent and recoverable.
- Comparison cutoff, alignment, overlay order, matrix sort, and accepted merge
  changes are independent controls. Latest/oldest sorting never changes matrix
  evaluation, branch ancestry, or merge direction.
- Expansion depth, lane order, child focus, and latest/oldest ordering apply to
  the current view/scope only; they never rewrite scope membership, child time,
  anchor mappings, or the resolved-input manifest.
- Plan filters, chronological direction, priority, and dependency order are
  independent; **Next action** and **Current operational period** do not rewrite
  scheduled dates or the approved baseline.
- Deep links remain stable across sorting and non-identity-changing edits.
- A 1,000-event analyst ledger remains filterable and navigable without forcing
  all events into the Narrative view DOM at once.
- Focus order, headings, landmarks, labels, contrast, reduced motion, and mobile
  layouts are tested before publishing.
- The Basic run-of-show table remains fully usable without the visual Gantt or
  dependency graph, including on mobile and with assistive technology.

### Privacy and security

- Do not log titles, event text, questions, notes, evidence URLs, narrative
  prose, branch names, alternative statements, test criteria, evaluation
  rationale, merge conflicts, scope/child titles, anchor details, behavior
  assessments, plan objectives, task text, assignees, resource names, or
  operational locations in product analytics.
- Record only artifact/request IDs, coarse actions, performance, and error
  classes.
- Authorize every durable read, write, publish, and version operation against
  the workspace.
- Authorize plan approval, assignment, baseline creation, branch selection, and
  status changes separately from read access and narrative publication.
- Authorize comparison reads, evaluation edits, branch creation, merge proposal,
  conflict resolution, and merge application separately. The target branch's
  policy cannot be bypassed by access to the source branch.
- Authorize composition links and every resolved child independently. Cache,
  roll-up, count, search, comparison, error, and webhook paths must not reveal a
  child that the current caller cannot read.
- Enforce source/evidence/object handling and redaction policy on expansion,
  search, export, publication, webhook delivery, and model input—not only on the
  parent artifact route.
- Sanitize imported markup and restrict media/embed origins.
- Keep service credentials on trusted backends. Do not enable wildcard browser
  CORS for credentialed private APIs; use explicit origins for approved public
  representations and delegated user authorization for browser integrations.
- Do not return caller-supplied source bodies in analysis responses, errors,
  webhooks, analytics, or routine operational logs.

### API reliability and compatibility

- Capability discovery precedes every service workflow and is the only runtime
  statement of enabled contracts, scopes, and limits.
- Contract versions are explicit in request and response bodies. Breaking
  changes never ship as additive-looking v1 fields with altered semantics.
- Stateless analysis remains separate from durable mutations. A successful
  extraction cannot silently create or modify a timeline artifact.
- Structured-technique runs name their method/version and immutable input
  artifact revision. Method-specific schemas are discoverable and unknown
  technique identifiers fail explicitly instead of falling back to free-form
  model output.
- Comparison schemas version input references, cutoff semantics, alignment and
  difference vocabularies, evaluation cells, algorithms, and merge-conflict
  rules. An RFC 6902 patch may be accepted as a transport detail only when it is
  paired with `If-Match` and a typed semantic change; it is never the sole merge
  audit record.
- Composition schemas version scope membership, relation vocabularies, revision
  selectors, time domains, anchor mappings, traversal limits, resolved manifests,
  template instantiation, and roll-up methods. Unknown relations or unsafe
  expansion requests fail explicitly instead of flattening or guessing.
- Planning schemas version objectives, item/dependency types, status transitions,
  baseline semantics, variance calculations, and operational-period rollover.
  Invalid transitions and dependency cycles fail explicitly.
- Every mutation and long-running job is safe to retry through idempotency keys;
  every update detects stale revisions through `If-Match` or an equivalent
  precondition.
- `429`, `503`, job-pending, terminal failure, and partial-source outcomes expose
  machine-readable retry behavior. Only explicitly retryable operations are
  retried automatically.
- OpenAPI, JSON Schemas, SDK models, implementation contracts, and frozen
  examples run through the same conformance suite before release.
- Service-level objectives are established separately for synchronous analysis,
  artifact reads/writes, jobs, published reads, and webhooks; one fast cached
  route must not hide failures in another layer.
- No planning endpoint has an implicit real-world execution side effect; API
  examples and SDK names use `schedule`, `record`, `approve`, or `select`, never
  `send`, `dispatch`, or `execute`, unless a separate integration defines that
  behavior.

## Success measures

Measure by artifact mode and source type without collecting content:

- RSS article-build starts, ready/insufficient/error outcomes, and opens;
- Signal-to-RSS opens and RSS-to-ResearchTools handoff completion, recorded as
  coarse action counts without article URLs or titles;
- provisioned API clients with `timelineAnalysis` enabled, successful first
  request rate, and time from credential delivery to first valid response;
- API success/error/latency and `no_events` rates by contract version and
  acquisition mode, without logging source URLs or content;
- idempotency replays, prevented duplicates, revision conflicts, job completion
  time, webhook delivery/retry success, and consumer contract-test pass rate;
- share of timelines reaching two events or one explicit gap;
- share of extracted timelines curated into a narrative;
- median selected narrative-event count and percentage exceeding 20;
- percentage of published events with inspectable evidence;
- percentage of assessed events whose underlying source assertions and known
  derivation are inspectable;
- percentage of narrative events with narrative role and why-it-matters text;
- percentage of published major judgments with evidence, assumptions,
  alternatives, contrary information, likelihood/confidence separation, and
  explicit change conditions;
- source-dependency false-positive/false-negative rate on the frozen corpus;
- indicator-state accuracy, stale-indicator rate, open collection requirements,
  and median time from material indicator change to analyst review;
- percentage of technique runs tied to an immutable input revision and retained
  through the next judgment version;
- percentage of composite projections with complete resolved-input manifests,
  bounded traversal, and reproducible content hashes;
- composition-cycle rejection, maximum-depth/node enforcement, projection
  latency by resolved object count, and repeated-node suppression;
- anchor-mapping resolution/conflict rate and false-precision rate, with a
  release gate of zero invented absolute times from unresolved relative or
  ordinal children;
- tracking-child update acceptance/rejection rate, stale-child visibility, and
  percentage of publications/comparisons that resolve every child to an exact
  revision;
- legacy Behavior Timeline migration/round-trip success, including nested path
  IDs, linked behavior revisions, and preservation of assessment versus observed-
  event semantics;
- unauthorized child identity/metadata/count/relationship disclosures across
  projection, search, export, comparison, webhook, cache, and error fixtures,
  with a release gate of zero;
- percentage of saved comparisons with immutable input revisions, explicit
  knowledge cutoff, method/version, and reproducible result hash;
- gold-fixture precision/recall for alignment candidates and reviewed event
  identity, plus incorrect semantic-merge rate;
- percentage of material alternative claims with a preregistered observable,
  window, candidate expectation, and collection-coverage rule;
- share of negative-evidence evaluations backed by adequate `observed_absent`
  coverage, with a release gate of zero falsification findings derived from
  `not_observed`, `not_collected`, or collection failure;
- unresolved conflict age, merge-review time, stale-head rejections, conflict
  escape rate, and percentage of merge revisions with reproducible two-parent
  provenance;
- frequency with which **As known at** changes the retrospective alternative
  ranking or judgment, used to measure hindsight exposure rather than analyst
  performance;
- percentage of active plans with an approved baseline, timezone, owner, and
  objective-linked tasks;
- dependency-cycle rejection rate, critical-path calculation coverage/warnings,
  overdue and blocked plan items, resource-conflict review time, and schedule
  variance against baseline;
- operational-period closeout and rollover completion, including the share of
  carried items with a recorded reason;
- number of attempted or accidental external side effects from planning-only
  routes, with a release gate of zero;
- Signal preview event count, truncation frequency, and click-through to the full
  RSS record;
- community-revision imports, update checks, and accepted/rejected candidates;
- correction latency and number of broken deep links after updates;
- analyst approval/rejection rates for AI suggestions and duplicate candidates;
- extraction recall, false-event rate, temporal-precision accuracy, and source
  attribution on the frozen corpus; and
- demo-fixture pass rate in release checks.

## Non-goals

- Replacing the analyst workspace with TimelineJS.
- Offering unrestricted anonymous compute or exposing service credentials in
  client-side applications.
- Describing `timeline-analysis.v1` output as verified, canonical, durable, or
  publication-ready.
- Replacing the Signal community graph and ResearchTools investigation store
  with one ambiguous global timeline database.
- Treating a public Google Sheet as storage for private research.
- Automatically turning chronological adjacency into causation.
- Treating a repeated or syndicated claim as independent corroboration.
- Mixing source assertions, assessed events, analytic judgments, and future
  scenario steps into one event type for display convenience.
- Automatically selecting a winning hypothesis, calculating likelihood or
  analytical confidence from indicator counts, or presenting an ACH score as a
  substitute for analyst reasoning.
- Treating relative ACH inconsistency, Cross Table ranking, diagnosticity, or a
  model match score as calibrated probability, truth, or automatic rejection.
- Treating missing collection as evidence that an expected event did not occur.
- Letting an analyst rewrite a registered falsification criterion after seeing
  the result without retaining and labeling both versions.
- Using one generic “branch” object for edit history, analytic alternatives,
  scenarios, plan options, and plan contingencies.
- Recursively embedding complete child event arrays inside parent events or
  using cached child titles/types as authoritative linked records.
- Treating a composition link, overlapping display, shared anchor, or child
  membership as evidence, corroboration, causation, or shared epistemic state.
- Inventing an absolute time, timezone, duration, or precision to force a
  relative or ordinal behavior/source timeline onto the host axis.
- Silently advancing tracking child links in saved comparisons, publications,
  approved plans, or signed-off analysis.
- Deep-forking, recursively merging, cascade-deleting, or broadening access to a
  linked child because its host was forked, merged, deleted, or shared.
- Treating TimelineJS groups or eras as an authoritative nested/composite
  timeline model, especially where eras overlap or child clocks remain local.
- Automatically merging independently created timelines from text/time
  similarity, or resolving disputed time, identity, evidence, epistemic,
  handling, plan, or delete/edit conflicts without review.
- Rewriting published or signed-off history through rebase, squash, force-move,
  or in-place mutation of a revision or object version.
- Implementing every intelligence structured analytic technique as a separate
  product workflow before the shared technique-run and review model is proven.
- Replacing specialist project-portfolio, workforce, logistics, dispatch,
  ticketing, calendar, or incident-command systems.
- Treating a planned date as a forecast, a completed task as proof of outcome,
  or an approved branch as authorization for an external system to act.
- Automatically rescheduling work, assigning people, reserving resources,
  messaging participants, or executing a contingency because a dependency,
  due time, or indicator changed.
- Automatically merging or publishing AI-generated events before corpus gates
  are met.
- Making every event appear in Narrative view or dumping the full event ledger
  into a Signal message.
- Converting a historical event directly into a COM-B/BCW artifact.
- Claiming a live timeline is complete or final when its data-through date is
  still changing.

## Recommended implementation order

1. Correct misleading cross-product labels for source count, importance, and
   build/open/refresh actions.
2. Freeze and publish the current `timeline-analysis.v1` schema, OpenAPI
   operation, limits, error behavior, and generic reference client.
3. Build the frozen corpus, cross-surface/consumer contract fixtures, and metrics
   before modifying extraction or widening canonical matching. Include source-
   dependency, conflicting-clock, world/knowledge chronology, indicator-state,
   judgment-change, composition-cycle, anchor-mapping, tracking-child,
   Behavior-Timeline migration, revision-diff, cross-timeline-alignment,
   disconfirmation, absence-coverage, merge-conflict, plan-baseline, dependency-
   cycle, resource-conflict, and operational-period fixtures.
4. Ship the RSS-to-ResearchTools handoff, narrative fields, Narrative view, and
   chapter outline on the existing local overlay.
5. Add durable authorized investigation APIs, timeline-specific scopes, and the
   shared evidence-reference layer; introduce source assertions, source
   dependency/evaluation, analytic judgments, assumptions, alternatives,
   collection requirements, review/dissent, and handling policy as typed
   resources. Establish stable object identity, immutable object versions,
   semantic changes, and revision-parent edges before exposing forks.
6. Release `timeline-analysis.v2` with rich time and event evidence locators;
   add assertion clocks, tracks, relations, community revision IDs, and
   investigation history.
7. Add World/Knowledge chronology switching and the shared technique-run model;
   ship chronology diagnostics, Key Assumptions Check, Quality of Information
   Check, and ACH as the first reviewed overlays.
8. Add named temporal scopes, revision-aware composition links, explicit time-
   anchor mapping, bounded composite projections, template instances, and the
   legacy Behavior Timeline adapter. Ship macro/expand/focus/overlap views only
   after cycle, handling, precision, and resolved-manifest fixtures pass.
9. Add typed comparison runs, preregistered test criteria, observation/coverage
   semantics, N-way alternative matrices, and the ACH/Cross Table adapters.
10. Add protected lineage branches, semantic three-way merge, conflict review,
   and two-parent merge revisions only after deterministic diff, alignment, and
   authorization fixtures pass.
11. Ship Basic Plan view with objectives, phases, tasks, milestones, owners,
   timezones, approval state, and immutable baseline/current-forecast/actual
   comparison.
12. Add typed dependencies, critical path and float, resources, plan-option
   comparison, decision points, branches, and operational-period closeout/
   rollover. Keep every planning-only route free of external execution side
   effects.
13. Add Indicators/Signposts, collection workflow, and distinct scenario-
   pathway/backcasting views with reviewable watch conditions; connect material
   indicator changes to alternative re-evaluation and plan-decision review
   without rejecting a hypothesis or selecting a branch.
14. Add asynchronous multi-source jobs, then connect incremental RSS and external
   subscriptions through explicit candidate review.
15. Add polling reliability, followed by signed metadata-first webhooks for
    update candidates, comparisons, indicators, judgments, and publications.
16. Add media/map support where the corpus demonstrates a real need.
17. Publish the first-party narrative route, immutable Composite view snapshot,
    private Plan/Comparison briefs, and immutable published API; integrate the
    narrative with the RSS full record, then add TimelineJS and explicitly lossy
    composition/planning exports and evaluate the optional renderer.

This order produces an early visible improvement while preventing presentation,
composition, or planning automation from outrunning evidence, persistence,
permissions, schedule integrity, and human decision authority.

## Reference guidance

These public intelligence, planning, provenance, versioning, and presentation
references are design inputs, not a claim that ResearchTools is certified for
classified or government intelligence use:

- [CIA: A Tradecraft Primer — Structured Analytic Techniques for Improving Intelligence Analysis](https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf)
- [CIA: Psychology of Intelligence Analysis](https://www.cia.gov/resources/csi/books-monographs/psychology-of-intelligence-analysis-2/)
- [CIA: Principles of Intelligence Analysis](https://www.cia.gov/resources/csi/static/Article-Principles-of-Intelligence-Analysis-Studies65-4-Dec2021.pdf)
- [CIA: Combating Surprise — Kinetic Predictive Analytic Technique](https://www.cia.gov/resources/csi/studies-in-intelligence/volume-66-no-4-december-2022/combating-surprise-introducing-the-kinetic-predictive-analytic-technique/)
- [ODNI ICD 203: Analytic Standards](https://www.dni.gov/files/documents/ICD/ICD-203.pdf)
- [ODNI ICD 206: Sourcing Requirements for Disseminated Analytic Products](https://www.dni.gov/files/documents/ICD/ICD-206.pdf)
- [ODNI ICS 206-01: Publicly/Commercially Available Information and OSINT citation](https://www.dni.gov/files/documents/ICD/ICS-206-01.pdf)
- [UK Defence JDP 2-00: Intelligence, Counter-intelligence and Security Support to Joint Operations](https://assets.publishing.service.gov.uk/media/653a4b0780884d0013f71bb0/JDP_2_00_Ed_4_web.pdf)
- [UK Professional Development Framework for all-source intelligence assessment](https://www.gov.uk/government/publications/intelligence-analysis-professional-development-framework/the-professional-development-framework-for-all-source-intelligence-assessment)
- [UK College of Policing: Intelligence management — Analysis](https://assets.college.police.uk/s3fs-public/2025-02/Intelligence-management-APP-consultation-supporting-document.pdf)
- [U.S. Army ATP 2-01.3: Intelligence Preparation of the Battlefield, event templates and matrices](https://home.army.mil/wood/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
- [GAO Schedule Assessment Guide](https://www.gao.gov/products/gao-16-89g)
- [FEMA Incident Action Planning Guide](https://www.fema.gov/sites/default/files/2020-07/Incident_Action_Planning_Guide_Revision1_august2015.pdf)
- [FEMA ICS Forms](https://training.fema.gov/emiweb/is/icsresource/icsforms/)
- [U.S. Army ADRP 5-0: The Operations Process](https://www.benning.army.mil/infantry/DoctrineSupplement/ATP3-21.8/PDFs/adrp5_0.pdf)
- [Army University Press: Thriving in the Multidomain Operations Environment](https://www.armyupress.army.mil/Journals/Military-Review/English-Edition-Archives/Mar-Apr-2019/54-Thriving/)
- [W3C PROV Model Primer](https://www.w3.org/TR/prov-primer/)
- [W3C Linking Across Provenance Bundles](https://www.w3.org/TR/prov-links/)
- [W3C/OGC Time Ontology in OWL](https://www.w3.org/TR/owl-time/)
- [W3C OWL-Time interval-relation extensions](https://www.w3.org/TR/vocab-owl-time-rel/)
- [Git merge-base documentation](https://git-scm.com/docs/git-merge-base)
- [RFC 6902: JSON Patch](https://www.rfc-editor.org/rfc/rfc6902.html)
- [SAGE: Structured Analytic Techniques for Intelligence Analysis, 3rd edition overview](https://www.sagepub.com/shop/buy-a-book/structured-analytic-techniques-for-intelligence-analysis-3-255432)
- [TimelineJS documentation and storytelling guidance](https://timeline.knightlab.com/docs/index.html)
- [TimelineJS spreadsheet guidance for groups and eras](https://timeline.knightlab.com/docs/using-spreadsheets.html)
- [TimelineJS JSON format](https://timeline.knightlab.com/docs/json-format.html)
- [TimelineJS options](https://timeline.knightlab.com/docs/options.html)
- [TimelineJS FAQ](https://timeline.knightlab.com/docs/faq.html)
- [TimelineJS JavaScript instantiation](https://timeline.knightlab.com/docs/instantiate-a-timeline.html)
