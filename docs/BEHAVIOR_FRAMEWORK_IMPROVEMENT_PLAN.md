# Behavior Framework Improvement Plan

> **Status:** ✅ Shipped. All 12 prioritized findings (P0-1, P1-1 through P1-4, P2-1 through P2-5, P3-1, P3-2) implemented across commits `c0f8250bb`, `1cb573a18`, `a434edcd7`, and follow-up review-fix commits. See the **Implementation Status** table below.
>
> **Original status:** Research output. Severity-prioritized findings on the gap between the live tool and the canonical sources.

## Implementation Status

| ID | Severity | Item | Status | Commit |
|---|---|---|---|---|
| P0-1 | P0 | AI tool layering banner + Save-as-COM-B CTA + sessionStorage prefill receiver | ✅ Shipped | `c0f8250bb`, prefill receiver in review-fix |
| P1-1 | P1 | APEASE Evaluation component + form integration | ✅ Shipped + wired | `c0f8250bb`, `a434edcd7` |
| P1-2 | P1 | BCT Taxonomy v1 (93 BCTs, 16 groupings, function map) | ✅ Shipped | `c0f8250bb` |
| P1-3 | P1 | Audience-agnostic helper text on all 8 Behavior sections | ✅ Shipped | `c0f8250bb` |
| P1-4 | P1 | `linked_behavior_id` required (client + server validation) | ✅ Shipped | `c0f8250bb`, server check in review-fix |
| P2-1 | P2 | Location required visual badges + helper text | ✅ Shipped | `c0f8250bb` |
| P2-2 | P2 | "Create COM-B Analysis for this Behavior" handoff CTA | ✅ Shipped | `c0f8250bb` |
| P2-3 | P2 | BCW 8-Step Stepper component | ✅ Shipped + wired | `c0f8250bb`, `a434edcd7` |
| P2-4 | P2 | Mode of Delivery component + form integration | ✅ Shipped + wired | `c0f8250bb`, `a434edcd7` |
| P2-5 | P2 | `evidence_sources` typed enum on COM-B assessments | ✅ Shipped | `c0f8250bb` |
| P3-1 | P3 | Behaviour & Theory glossary + form integration | ✅ Shipped + wired | `c0f8250bb`, `a434edcd7` |
| P3-2 | P3 | COM-B central tenet quote + form integration | ✅ Shipped + wired | `c0f8250bb`, `a434edcd7` |

## Post-Ship Review Fixes (this iteration)

After integration, /team-review surfaced these gaps that have been addressed:

- **W1**: AI tool's "Save as COM-B Analysis" button was orphan (sessionStorage write with no receiver) → added `useEffect` reader in `GenericFrameworkForm.tsx` that pre-populates title, description, and selected interventions when navigating with `?prefill=ai-tool`.
- **W2**: P1-4 was client-only validation, bypassable → added server-side check in `functions/api/frameworks.ts` for both POST and PUT paths that enforces `data.linked_behavior_id` on `comb-analysis` framework type.
- **S1**: APEASE rating buttons missing `aria-pressed` → added on all 18 buttons (3 ratings × 6 criteria).
- **S2**: BCWStepper current step missing `aria-current="step"` → added.
- **S3**: APEASE + BCWStepper not mobile-responsive → APEASE label/question now stacks at <640px, ratings wrap; Stepper steps wrap on small screens.
- **S4**: No tests for new components → added `tests/e2e/smoke/comb-analysis-form.spec.ts` covering BCWStepper, COMBCentralTenet, BehaviourTheoryGlossary, APEASEEvaluation, ModeOfDeliveryForm, BCTSelector, plus aria-pressed and aria-current="step" verification.

## Follow-on Improvement: BCT taxonomy now wired (P1-2 v2)

The original P1-2 shipped the **data**: `src/utils/bct-taxonomy.ts` with all 93 BCTs and the
function-to-BCT map. But no UI surfaced it. This is now closed:

- New component `src/components/frameworks/BCTSelector.tsx` — picks BCTs grouped by the 16 BCTTv1
  groupings, with a "Recommended for your selected intervention functions" panel surfacing the
  most-frequently-used BCTs per BCW Guide Table 3.3 first.
- New section `bct_selection` in `comb-analysis` framework config (between APEASE and Mode of Delivery).
- Wired into both `GenericFrameworkForm` (interactive) and `GenericFrameworkView` (read-only).
- State persists as `data.selected_bcts: string[]` (BCT ids like `'1.1'`, `'2.3'`).

Now BCW Steps 5 → 6 → 7 → 8 are all walkable in one form: pick functions, pick policies (existing),
score APEASE, pick BCTs, define Mode of Delivery.

## Sources

This plan is grounded in three canonical references:

1. **Irregularpedia wiki — *Behavior Analysis*** at <https://irregularpedia.org/general/behavior-analysis/>. The wiki page was rewritten to mirror the live tool's data model and explicitly states the architectural principle: *"Behavior Analysis = BEHAVIOR + LOCATION."* Source markdown: `apps/wiki/src/content/docs/general/behavior-analysis.md` in the IrregularChat monorepo.
2. **Michie, Atkins, West (2014).** *The Behaviour Change Wheel: A Guide to Designing Interventions.* Silverback Publishing. ISBN 978-1-912141-08-1. ([behaviourchangewheel.com](https://www.behaviourchangewheel.com/))
3. **Michie, West, Campbell, Brown, Gainforth (2014).** *ABC of Behaviour Change Theories.* Silverback Publishing. ISBN 978-1-912141-05-0. ([behaviourchangetheories.com](https://www.behaviourchangetheories.com/))
4. **Department of the Army.** *TM 3-53.11 Influence Process Activity: Target Audience Analysis*, Chapter 2. (Doctrinal basis for the eight-section behavior-analysis structure.)

The wiki page is the single most useful working summary because it explicitly maps the canonical material onto the live tool's section keys.

## The Architecture (per Canon)

| Layer | Framework | Question | Status in Tool |
|---|---|---|---|
| **L1** | **Behavior Analysis** (`/dashboard/analysis-frameworks/behavior`) | *What happens, where, when, with what consequences and symbols?* — audience-agnostic | ✅ Implemented; needs hardening |
| **L2** | **COM-B Analysis** (`/dashboard/analysis-frameworks/comb-analysis`) | *For this audience, what's missing/present/competing in C, O, M?* | ⚠ Implemented; missing APEASE, BCTs, Mode of Delivery |
| **L3** | **BCW Intervention Design** | *Given the diagnosis, what intervention will work, and how will we deliver it?* | ❌ Partial — function/policy mapping exists, but Steps 7 & 8 are missing |
| **AI** | **Behavior Analysis Tool** (`/dashboard/behavior-analysis-tool`) | Fast-path AI diagnosis | ⚠ Bypasses L1 — produces L2 output without L1 input |

Layer separation is the architectural commitment. Every P0 and P1 finding below traces back to one of these layers being violated, missing, or confused with another.

---

## Prioritized Findings

### P0 — Blocks correct use

#### P0-1. AI Behavior Tool bypasses canonical layering

**What canon says:** A Behavior Analysis must come before any COM-B Analysis. *"A single behavior analysis can spawn multiple COM-B analyses, each applying a different audience lens."* [(wiki, "Architectural Position")](https://irregularpedia.org/general/behavior-analysis/)

**What the tool does:** `src/pages/BehaviorAnalysisToolPage.tsx` produces a COM-B diagnosis directly from a free-text behavior description with no behavior-analysis link, no location enforcement, and no temporal/eligibility model. Two fixed audience contexts (`intelligence` vs `product`) collapse the audience analysis into the input rather than producing an L2 artifact.

**Why this is P0:** Users who use this tool will produce one-off audience-specific diagnoses that are disconnected from any reusable behavior library. Every diagnosis is orphaned. The whole "many analyses link to one behavior" reusability promise breaks.

**Concrete fix:**

- **Option A (preferred):** Refactor the tool to require selecting/creating a Behavior Analysis first. The AI then produces a COM-B Analysis that automatically sets `linked_behavior_id` and `linked_behavior_title`. Persist results.
- **Option B (faster):** Keep the tool as a *quick-look preview* but add a banner: *"This is a preview, not a saved analysis. To produce a reusable analysis, [start with a Behavior Analysis](/dashboard/analysis-frameworks/behavior/create)."* Add a *"Save as COM-B Analysis"* button that requires the user to first link or create a Behavior Analysis.
- Either way: ensure all persisted COM-B Analyses have a non-null `linked_behavior_id`.

**Files:** `src/pages/BehaviorAnalysisToolPage.tsx`, `src/hooks/useBehaviorAI.ts`, COM-B Analysis create flow.

---

### P1 — Major fidelity gaps

#### P1-1. APEASE evaluation has type stubs but no UI

**What canon says:** APEASE (Affordability, Practicability, Effectiveness/cost-effectiveness, Acceptability, Side-effects/safety, Equity) is the **filter that selects which intervention to deliver**. BCW Guide Table 1 (pp. 18–20) gives full definitions. *"A candidate intervention that fails APEASE on any single criterion should be reworked or discarded — not 'compensated for' by strength on the other five."* [(wiki)](https://irregularpedia.org/general/behavior-analysis/)

**What the tool does:** `src/utils/behaviour-change-wheel.ts:71` defines `apease_assessment` fields in `PolicyRecommendation` but no UI prompts the user to score interventions or policies on APEASE. Step 7 of the BCW process is effectively skipped.

**Concrete fix:** Add an **APEASE Evaluation** section after the user has selected candidate intervention functions in COM-B Analysis. Six-row scorecard per intervention with high/medium/low rating + free-text rationale per criterion. Carry the scores into the saved COM-B Analysis under `selected_interventions[].apease_assessment`. Block "publish" until at least one intervention has all six APEASE fields.

**Files:** `src/components/frameworks/BCWRecommendations.tsx`, COM-B Analysis flow, `src/types/behavior-change-wheel.ts`.

---

#### P1-2. BCT Taxonomy v1 (93 BCTs, 16 groupings) is absent

**What canon says:** BCW Guide Step 7 requires selecting **Behaviour Change Techniques** — observable, replicable, irreducible "active ingredients" of an intervention. BCTTv1 contains 93 BCTs in 16 expert-card-sorted groupings. Table 3.3 maps each intervention function to most-frequently-used BCTs. *"The 93 BCTs are the smallest unit compatible with retaining the proposed mechanism of change."* [(wiki, "Behaviour Change Techniques")](https://irregularpedia.org/general/behavior-analysis/)

**What the tool does:** No BCT selection anywhere. The tool stops at intervention functions (Step 5) and policy categories (Step 6). Step 7 is silently skipped.

**Concrete fix:**

1. Create `src/utils/bct-taxonomy.ts` with the canonical 93 BCTs, 16 groupings, definitions, and examples (verbatim from BCTTv1 / [UCL site](https://www.ucl.ac.uk/health-psychology/BCTtaxonomy/)).
2. Map each intervention function to its most-frequently-used and less-frequently-used BCTs (BCW Guide Table 3.3, pp. 145–160).
3. After APEASE evaluation, add a **Select Behaviour Change Techniques** section with grouped accordion UI. Bold the most-frequently-used BCTs for each selected intervention function; allow custom selection beyond.
4. Persist as `selected_bcts: { bct_id, function, custom_notes }[]` on COM-B Analysis.

**Files:** new `src/utils/bct-taxonomy.ts`, COM-B Analysis types, COM-B Analysis flow.

---

#### P1-3. Audience-agnostic discipline is unenforced in Behavior Analysis

**What canon says:** *"The behavior analysis must stay objective… [audience-specific] claim belongs in a downstream COM-B analysis."* The wiki provides a concrete checklist of phrases that flag layer-mixing: *"the user is too busy"*, *"young people don't care about"*, *"customers struggle with"*. [(wiki, "Audience-Agnostic Discipline — A Checklist")](https://irregularpedia.org/general/behavior-analysis/)

**What the tool does:** `BehaviorBasicInfoForm.tsx`, `BehaviorTimeline.tsx`, and the prompt-question text in `framework-configs.ts:'behavior'` contain no helper text or validation discouraging audience-specific framing. Users will routinely leak L2 content into L1 sections.

**Concrete fix:**

1. **Helper text** under each major section header: *"Describe what's true regardless of who performs the behavior. Audience-specific judgements (e.g. 'nurses are too busy') belong in a downstream [COM-B Analysis](/dashboard/analysis-frameworks/comb-analysis)."*
2. **Soft warning regex** on save: scan free-text fields for audience-leak phrases (*"users struggle"*, *"target audience"*, *"is too busy"*, *"resist"*, *"don't care"*) and surface a non-blocking warning offering to defer the claim to a COM-B Analysis.
3. The wiki's checklist (4 questions) can be rendered as a pre-save modal: *"Run each section through this filter before publishing…"*

**Files:** `src/components/frameworks/BehaviorBasicInfoForm.tsx`, `src/config/framework-configs.ts`, new save-time linter.

---

#### P1-4. `linked_behavior_id` is supported but not enforced as required

**What canon says:** A COM-B Analysis without a behavior link is architecturally invalid — it has no anchor. The wiki: *"Each candidate audience becomes the subject of a separate COM-B Analysis that links back to this behavior analysis."*

**What the tool does:** COM-B `setup` section provides `BehaviorSelector` and accepts `linked_behavior_id`, but the field is *not required* in validation. Users can save an orphan COM-B Analysis. The reverse direction (Behavior Analysis → list of COM-B Analyses linked to it) is not surfaced in the Behavior view.

**Concrete fix:**

1. Make `linked_behavior_id` a **required field** at COM-B Analysis save time. Block submission if empty.
2. Add a **"COM-B Analyses linked to this Behavior" panel** in the Behavior Analysis view (`GenericFrameworkView.tsx`) — list each linked COM-B Analysis with its target audience and quick-link. This is the L1↔L2 navigation the wiki implies.
3. Update `usage_count` in `BehaviorMetadata` from this reverse relationship so the public catalog can rank reusability.

**Files:** COM-B Analysis form validation, `src/components/frameworks/GenericFrameworkView.tsx`, COM-B Analysis save endpoint.

---

### P2 — Completeness / discoverability gaps

#### P2-1. Location-context enforcement is type-level only

**What canon says:** *"Location is REQUIRED — be as specific as possible!"* (wiki opening callout) Location *defines* the behavior — voting in California ≠ voting in Lagos.

**What the tool does:** `BehaviorBasicInfoForm.tsx` shows an orange warning when `specific_locations` is empty but does not *block* save. The validation is visual, not enforced.

**Concrete fix:** Hard-required validation: cannot save Behavior Analysis without `geographic_scope` set AND at least one entry in `specific_locations[]`. Render the validation error inline + at the top of the form.

---

#### P2-2. Section 8 → COM-B handoff CTA is missing

**What canon says:** Section 8 (*Potential Target Audiences*) is explicitly a handoff: each candidate becomes a separate COM-B Analysis.

**What the tool does:** Lists candidates but offers no affordance to start the next-layer analysis. Users must navigate manually.

**Concrete fix:** For each entry in `potential_audiences[]`, render a **"Create COM-B Analysis for [audience]"** button that routes to `/dashboard/analysis-frameworks/comb-analysis/create?behavior_id={this.id}&audience={candidate}` and pre-fills both `linked_behavior_id` and `target_audience.name`.

---

#### P2-3. The 8-step BCW process is invisible to the user

**What canon says:** BCW Guide is structured as 8 explicit steps in 3 stages. Pedagogy depends on users seeing where they are in the process.

**What the tool does:** Sections in COM-B Analysis follow the right order but aren't labelled with their canonical step numbers. Users have no roadmap.

**Concrete fix:** Add a horizontal stepper at the top of COM-B Analysis: *"Step 4: Identify what needs to change → Step 5: Intervention functions → Step 6: Policy categories → Step 7: BCTs → Step 8: Mode of delivery."* Each step links to a glossary entry citing the BCW Guide chapter/page.

---

#### P2-4. Mode of Delivery (Step 8) is absent

**What canon says:** BCW Guide Step 8 captures *who delivers, when, how often, in what setting* — face-to-face vs broadcast vs internet vs print, group vs individual, single-shot vs repeated.

**What the tool does:** No UI section.

**Concrete fix:** Add a final section in COM-B Analysis: **Mode of Delivery** with fields for delivery mode (multi-select), frequency, duration, setting, who delivers. Required before "publish".

---

#### P2-5. COM-B-D (Behavioural Diagnosis Form) is not surfaced as such

**What canon says:** BCW Guide Box 1.9 defines the COM-B-D — a structured behavioural diagnosis form requiring evidence sources for each judgement. The wiki notes the COM-B Analysis section currently in the tool is *"comparable to"* COM-B-D but doesn't explicitly mirror it.

**What the tool does:** `WheelAssessmentPanel` collects `evidence_notes` and `supporting_evidence[]`. The structure is close to COM-B-D but doesn't require source-typing (RCT, interview, lit review, theoretical analysis).

**Concrete fix:** Add an `evidence_type` enum to `supporting_evidence[]`: `randomized_controlled_trial | observational_study | interview | focus_group | literature_review | theoretical_analysis | expert_judgement | other`. Display the diagnosis output as a printable "COM-B-D Diagnosis Form" with citation block.

---

#### P2-6. No reverse linkage view from Behavior Analysis

(Covered under P1-4 fix #2 — reused here as a P2 view-layer task if P1-4 is split.)

---

### P3 — Pedagogy and depth

#### P3-1. Definitions of *behaviour* and *theory* not present

**What canon says:** Consensus Delphi definitions from ABC of Behaviour Change Theories (Ch. 1):

> **Behaviour:** *"anything a person does in response to internal or external events. Actions may be overt (motor or verbal) and directly measurable or covert (activities not viewable but involving voluntary muscles) and indirectly measurable; behaviours are physical events that occur in the body and are controlled by the brain."*
>
> **Theory:** *"a set of concepts and/or statements with specification of how phenomena relate to each other. Theory provides an organising description of a system that accounts for what is known, and explains and predicts phenomena."*

**Concrete fix:** Glossary panel in the framework header (collapsible). Quote both definitions verbatim with citation to ABC of Behaviour Change Theories.

---

#### P3-2. The COM-B central tenet is not quoted

**What canon says:** BCW Guide p. 50:

> *"Changing the incidence of any behaviour of an individual, group or population involves changing one or more of the following: capability, opportunity, and motivation relating either to the behaviour itself or behaviours that compete with or support it."*

**Concrete fix:** Display this quote as a callout when entering the COM-B Analysis create form. Citation to BCW Guide.

---

#### P3-3. TDF (Theoretical Domains Framework, 14 domains) mapping not offered

**What canon says:** BCW Guide Step 4a — optional elaboration of COM-B into 14 TDF domains for finer-grained diagnosis.

**Concrete fix (low priority):** Add an "Advanced: TDF domains" toggle in each COM-B component assessment that reveals the relevant TDF domains (e.g. Psychological Capability → Knowledge, Cognitive and interpersonal skills, Memory/Attention/Decision Processes, Behavioural regulation). Cite Cane, O'Connor & Michie (2012).

---

#### P3-4. Intervention function definitions are condensed

**What canon says:** BCW Guide Table 2.1 has full definitions. The tool's `INTERVENTION_DESCRIPTIONS` in `src/utils/behaviour-change-wheel.ts` has condensed one-sentence summaries.

**Concrete fix:** Add an info-icon next to each intervention name in the wheel UI that opens a popover with the full BCW Guide definition + worked example.

---

## Compliance Wins (No Action Required)

The audit confirmed several places where the tool is **already canon-compliant** — call these out so they don't get rewritten:

- **All 9 intervention functions** are correctly enumerated in `behaviour-change-wheel.ts:31-71` with the canonical names: education, persuasion, incentivisation, coercion, training, restriction, environmental restructuring, modelling, enablement.
- **All 7 policy categories** are correctly enumerated: communication/marketing, guidelines, fiscal measures, regulation, legislation, environmental/social planning, service provision.
- **The COM-B↔Function mapping matrix** in `COM_B_INTERVENTION_MAP` matches BCW Guide Table 2.3 cell-by-cell.
- The data model `behavior.ts` already supports the full audience-agnostic structure (geographic scope, settings, temporal context, eligibility, complexity, timeline forks, consequence valence/timeframe, symbol media, etc.) that the wiki page documents.

---

## Implementation Sequencing

A defensible build order:

1. **P0-1** (architectural) — decide AI tool's role. Without this decision, every other layer fix is fragile.
2. **P1-4** (linked_behavior_id required) — locks in the L1↔L2 contract.
3. **P1-3** (audience-agnostic discipline) — protects L1 quality going forward.
4. **P1-1** (APEASE) — fills the L3 gap that blocks intervention selection.
5. **P1-2** (BCT taxonomy) — finishes Step 7. Requires a substantial taxonomy import + UI.
6. **P2-1, P2-2** (location enforcement, handoff CTAs) — high-leverage UX fixes.
7. **P2-3, P2-4** (8-step stepper, Mode of Delivery) — completes the visible BCW process.
8. **P2-5** (evidence typing) and all **P3** items — polish and pedagogy.

Each P0/P1 item should be brainstormed before implementation. The plan above is *what to fix*, not *how* — the *how* requires user-flow design decisions that this audit deliberately did not make.

---

## Citations Inline

This plan cites three sources that should be referenced in any in-app help or commit messages that result from it:

- **Wiki (operational summary):** <https://irregularpedia.org/general/behavior-analysis/>
- **BCW Guide (canon for COM-B, BCW, APEASE, BCTs, 8-step):** Michie, Atkins, West (2014).
- **ABC of Behaviour Change Theories (canon for definitions, theory criteria, 83-theory catalogue):** Michie, West, Campbell, Brown, Gainforth (2014).

The wiki page is the most actionable single reference because it explicitly maps the canonical material onto this codebase's section keys, types, and component names.
