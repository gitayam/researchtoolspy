# Analytic Capability Expansion — Design & Implementation Plan (2026-06-19)

> Companion to [`docs/ROADMAP.md`](../ROADMAP.md) → "Capability expansion." Research-backed plan for three new analytic workstreams: **(A)** Structured Analytic Technique (SAT) coverage, **(B)** a Game Theory / Strategic Interaction module, **(C)** a Quantitative & Reliability Analysis module. Written so a future Claude agent can pick up any workstream and code it without re-deriving the architecture.

**Source research:** four parallel research streams (SAT landscape vs. Heuer & Pherson; game-theory computation/feasibility; social-science statistics tooling; codebase architecture recon) — 2026-06-19. Sources cited inline per workstream.

---

## Architecture you must know first (applies to all three)

The codebase has **three extension tiers** (verified recon — file:line pointers below). Pick the right tier per feature; do not over-build.

| Tier | When | How | Effort | Reference impl |
|---|---|---|---|---|
| **1 — Config-only framework** | A new framework that is just sections of text or Q&A items | Add one entry to `src/config/framework-configs.ts`; export a page fn from `src/pages/frameworks/index.tsx`; add 4 routes in `src/routes/index.tsx`. `GenericFrameworkForm`/`GenericFrameworkView` render it. AI auto-populates from each section's `promptQuestions[]`. | ~30 min | any of SWOT/PEST/DIME |
| **2 — Bespoke framework Form/View** | Single analysis needing a matrix, scoring, viz, or custom export, but standard persistence | New `XForm.tsx`/`XView.tsx` in `src/components/frameworks/`; routed by `framework_type` string; persists via `/api/frameworks` into `framework_sessions.data` (JSON) | 4–8 h | COG (`COGForm`, `COGVulnerabilityMatrix`, `COGNetworkVisualization`, `COG*Export`), Deception |
| **3 — Standalone tool page + own table/endpoints** | Cross-cutting module with its own data model, multi-panel UI, heavy custom logic | New `src/pages/tools/XPage.tsx` + `functions/api/<x>/*.ts` + `src/types/x.ts`; route under `tools/`; own D1 table | 1–2 days | **`src/pages/tools/CrossTablePage.tsx`, `EquilibriumAnalysisPage.tsx`, `HamiltonRulePage.tsx`** |

**Key files:**
- Config registry + section shape: `src/config/framework-configs.ts`; types in `src/types/frameworks.ts` (`FrameworkConfig`, `FrameworkSection`, item types `TextFrameworkItem` / `QuestionAnswerItem` / `StakeholderItem`).
- Generic form/view: `src/components/frameworks/GenericFrameworkForm.tsx` + `GenericFrameworkView.tsx`. AI assist via `AIFieldAssistant` (reads `promptQuestions`).
- Persistence: `framework_sessions` table (`schema/d1-schema.sql` ~L48) — **`user_id` INTEGER**, `framework_type` TEXT, `data` TEXT(JSON `{ section_key: [items] }`). CRUD at `functions/api/frameworks.ts` (`GET/POST/PUT/DELETE`, workspace-scoped via `workspace_id` query/header).
- AI egress: **always** `callOpenAIViaGateway` (`functions/api/_shared/ai-gateway.ts`) — never call OpenAI directly. Validate `choices[0].message.content` before `JSON.parse`, strip fences, build output field-by-field (never spread raw LLM output).
- Existing **tools family** (the home for B and C): `src/pages/tools/` with routes under `tools/` in `src/routes/index.tsx` (~L459) and a sidebar entry in `src/components/layout/dashboard-sidebar.tsx`.

**Existing strategic/evolutionary tools** (do not duplicate — Game Theory complements these):
- `functions/api/equilibrium-analysis/analyze.ts` + `src/pages/tools/EquilibriumAnalysisPage.tsx` — AI detection of **behavioral** equilibria from longitudinal rate data (resistors/enablers, rate deltas). NOT game-theoretic Nash equilibrium.
- `functions/api/hamilton-rule/analyze.ts` + `src/pages/tools/HamiltonRulePage.tsx` — kin-selection cooperation (relatedness·benefit > cost) over an actor network.

**Project constraints (non-negotiable, from CLAUDE.md + Cloudflare lessons):**
- Workers CPU limit 10 s (free) / 30 s (paid). **Push heavy math client-side** (browser), keep Workers to CRUD + bounded AI calls.
- D1 bounded by a daily cron — **any new high-write table ships with a retention `DELETE` in the same PR** (see `workers/cron/`).
- D1: lowercase snake_case; `framework_sessions` uses `user_id`; entity tables use `created_by`+`workspace_id`. Apply+verify migrations on local D1 before `--remote`; back up first.
- AI model default `gpt-5.4-mini`; `gpt-5.4-nano` for classification/short JSON. No `temperature` on `gpt-5.4-*`.

---

## Workstream A — Structured Analytic Technique (SAT) coverage

**Why:** The platform already implements a deep SAT set (ACH, COG, Deception/SATS, Starbursting, COM-B, Causeway, plus configs for `kac`, `5whys`, `carver`, `ooda`, `abcde`, `surveillance`, `fundamental-flow`, `vrio`, `trend`). Measured against the Heuer & Pherson catalog (~66 techniques) and the CIA Tradecraft Primer, the biggest *remaining gaps* are in **scenarios/indicators, challenge analysis, and decision support** — and almost all are **Tier-1 config-only** additions that reuse the existing engine and AI auto-population. High value, near-zero risk.

> Sources: Heuer & Pherson, *Structured Analytic Techniques for Intelligence Analysis* (3rd ed., SAGE); CIA *Tradecraft Primer* (2009, cia.gov); Pherson SAT taxonomy (pherson.org); RAND RR1408 (value of SATs).

**Already present — verify, don't rebuild:** `kac` (Key Assumptions Check) exists as a config. **Task:** confirm it captures the full Heuer protocol per assumption — `importance` (H/M/L), `support_level` (well/partially/assumed), and an `invalidates_analysis` flag — and extend the config/item shape if it's text-only.

### A1 — Tier-1 quick wins (config-only; ship as one batch)

Each is a new entry in `framework-configs.ts` (sections + `promptQuestions`) + page export + routes. AI auto-population works for free via `promptQuestions`. No schema change (stored in `framework_sessions.data`).

| Technique | Sections (item shape) | Gap filled | AI-assist prompt angle |
|---|---|---|---|
| **What-If Analysis** | premise · causal_chain · early_warning_signs · implications (Q&A) | Reframing / challenge analysis | "Assume [outcome]. What event chain over [timeframe] makes it plausible? Early warning signs?" |
| **Premortem Analysis** | failure_statement · failure_modes · contributing_factors · prevention_measures (Q&A) | Structured failure-mode analysis | "The analysis proved wrong. Generate 8 distinct reasons why." |
| **Red Hat Analysis** | adversary_profile · perceived_threat · available_options · most_likely_choice · constraints · wildcard_actions (Q&A) | Adversary-perspective modeling | Seed `adversary_profile` from a linked `actors` row's description/behavior |
| **Pros-Cons-Faults-and-Fixes** | pros · cons · faults_in_pros · fixes_for_cons (text) | Structured option appraisal | One structured JSON call per option |
| **Devil's Advocacy / Red Team** | consensus_position · strongest_counter_case · rebuttals · residual_doubts (Q&A) | Formal challenge process | "Argue the strongest case against [consensus]." |
| **Force Field Analysis** | driving_forces · restraining_forces (text + optional 1–5 strength per item) | Change/barrier assessment | Score each force's strength |
| **Structured Self-Critique** | checklist of "ways this could be wrong" (text + checkbox) | QA discipline | AI generates critique items |

**Definition of done (A1):** each technique selectable from the frameworks list; create/edit/view/list all work; AI populate fills sections; appears in i18n (en + es). *Pattern to copy:* `SwotPage` in `src/pages/frameworks/index.tsx`.

### A2 — Indicators / Signposts of Change (+ Validator) — highest-value SAT

The single most broadly useful gap. Slightly more than config because items carry a **status badge** and a **diagnostic score**.

- **Data model:** per-indicator item `{ id, indicator_text, linked_scenario, observable_condition, status: 'watching'|'triggered'|'not_observed', diagnostic_score: 1–5 }`. Stored in `framework_sessions.data` (JSON). The score+status pattern already exists in `DeceptionScoringForm` — reuse it.
- **UI:** a Q&A section per scenario/hypothesis; each item shows the status badge + score. Mostly generic form + a small item-field extension.
- **Linkage:** a `triggered` indicator should surface on the ACH matrix (notification). Indicators feed Workstream-A scenario techniques.
- **AI:** given ACH hypotheses or scenario titles, generate 5–8 candidate indicators per hypothesis; the **Validator** asks the AI to score each indicator's diagnosticity (does it point to exactly one scenario?).

### A3 — Matrix-widget techniques (Tier-2; one shared component)

Two techniques need an editable grid. Build **one reusable `<AnalyticMatrix>`** (rows × cols, editable cells) on the shadcn `Table` primitive — the COG `CrossTablePage`/`COGVulnerabilityMatrix` is the reference.

- **Multiple Scenarios Generation** — 2×2 from two key drivers (each with two divergent values) → 4 named scenario cells `{ title, description, key_assumptions[], indicators[] }`. AI drafts each cell's narrative. Feeds A2 indicators.
- **Cross-Impact Matrix** — N×N of user variables; each cell `{ direction: +/0/−, strength: 0–3, rationale }`. Pairs directly with completed PMESII-PT / DIME / DOTMLPF analyses (how does Political change cascade into Military/Economic?). AI pre-scores cells; analyst overrides.
- **Weighted Ranking / Decision Matrix** (optional, same widget) — options × weighted criteria → scored ranking. Reuses COG scoring arithmetic.

### A — Explicitly avoid / defer (low value or high cost for this stack)
- **Delphi** (needs multi-user async rounds/anonymization — misaligned with current model), **Argument Mapping** (heavy tree-viz lib; ACH already covers evidence-vs-hypothesis), **full Morphological Analysis** (combinatorial UI blow-up — Cross-Impact/scenarios cover the need), **standalone Bayesian** (analysts rarely have clean priors; R-export off-ramp exists), **Structured Analogies** (needs a curated case DB to be trustworthy), **Cone of Plausibility** (overlaps Multiple Scenarios — add later as a viz mode of the same data), **AIMS** (a writing checklist, not an analytic technique — at most a session-header widget).

---

## Workstream B — Game Theory / Strategic Interaction module

**Why:** Strategic analysts model adversaries, deterrence, escalation, alliance behavior. The platform already has a *strategic/evolutionary* tool family (Hamilton's Rule, Equilibrium Analysis) but **no classical game theory** — normal-form payoff matrices, Nash equilibria, mixed strategies, or formal **ESS/replicator dynamics**. This is net-new, complements the existing tools, and the ESS/replicator angle ties into the evolutionary theme already present.

**Feasibility verdict:** **No viable npm Nash solver exists** (Gambit/Nashpy are C++/Python; JS packages are abandoned or visualization-only). Implement a **~200-LOC dependency-free TypeScript solver** for small games. **All computation runs client-side** — the Workers CPU limit is irrelevant; Workers only do CRUD + (optional) AI payoff estimation.

> Sources: Gambit (gambit-project.org); Nashpy docs (algorithm reference — support/vertex enumeration, Lemke-Howson, replicator dynamics); McGill COMP-553 support-enumeration notes; Stanford ESS notes (Jones). All algorithms below are standard and citable.

**Tier:** **3 — standalone tool page.** Build `src/pages/tools/GameTheoryPage.tsx`; do **not** retrofit `GenericFrameworkForm` (payoff-matrix shape is fundamentally different). Model the cell editor on `CrossTablePage`. Confirm the persistence choice against how `HamiltonRulePage`/`EquilibriumAnalysisPage` persist; default recommendation: reuse `framework_sessions` with `framework_type = 'game_theory_normal'` (no migration).

### B — Solver module (`src/lib/game-theory/solver.ts`, pure TS, zero deps)

Implement and unit-test (against known games — PD pure NE = (Defect,Defect); symmetric Chicken mixed NE = V/C):

1. **IESDS** — iterated elimination of strictly dominated strategies. O(passes·(m²n+mn²)); fine ≤10×10.
2. **Pure NE enumeration** — precompute per-column/row best responses; emit profiles that are mutual best responses. Label **risk-dominant** and **Pareto-efficient** NE.
3. **2×2 mixed NE (closed form)** — opponent-indifference: `q=(d−b)/(a−b−c+d)`, `p=(h−g)/(e−f−g+h)`; valid iff both in (0,1).
4. **Support enumeration (general m×n)** — over support pairs, solve the indifference linear system (Gaussian elimination) + best-response verification. **Hard-cap m,n ≤ 6** at input validation (6×6 ≈ 4 ms worst case; reject larger).
5. **Replicator dynamics (RK4)** — `dxᵢ/dt = xᵢ·((Ax)ᵢ − xᵀAx)`, project to simplex each step; dt=0.05, T=1000, sample every 10 steps for charting. <1 ms at m=5.
6. **ESS check** — pure: `A[i][i]>A[j][i]` ∀j, or (= and `A[i][j]>A[j][j]`); mixed: Nash + post-entry advantage (or negative eigenvalues of the replicator Jacobian on the simplex tangent space).

### B — MVP scope (2-player normal-form analyzer)

- **UI:** payoff-matrix editor (rows=player-1 strategies, cols=player-2; each cell `(p1, p2)`, inline-editable labels & payoffs). Results panel: pure NE (gold border on cells), mixed NE, Pareto-efficient cells (green dot), dominated strategies (struck-through labels), plain-language stability note.
- **Templates (the real value — analysts compare their scenario to a canon):** Prisoner's Dilemma (arms control / defection), Chicken / Hawk-Dove (brinkmanship), Stag Hunt (coalition/collective action), Deterrence (compellence), Battle of the Sexes (burden-sharing), + blank custom. Ship as a `GameTemplate[]` with an `analystNote` per template.
- **Data model (JSON in `framework_sessions.data`):** `{ game_type:'normal_form', players:[..], strategies:{row:[],col:[]}, payoffs:{row:[[]], col:[[]]}, template, notes, results:{pure_ne, mixed_ne, pareto_efficient, dominant_strategies, iesds, stability_notes} }`. Store computed `results` to avoid recompute on load.
- **Guardrail:** reject >6 strategies/player at the UI layer.

### B — Stretch (sequence after MVP is stable)
1. **AI payoff estimation** (first stretch — high value, low risk): analyst describes a scenario → `gpt-5.4-mini` via gateway returns `{ row, col, rationale }`, validated field-by-field; label outputs "AI-estimated, analyst-verified." Endpoint `functions/api/game-theory/estimate-payoffs.ts`.
2. **ESS / replicator simulator** — initial-population sliders + time-series chart (Recharts, already in stack) + simplex viz for 3-strategy games. The evolutionary-stability centerpiece; ties to Hamilton/Equilibrium tools.
3. **Iterated PD** — strategy tournament (AllC/AllD/Tit-for-Tat/Grim/Random), discount factor δ, folk-theorem threshold line.
4. **Extensive-form / backward induction** — game-tree editor (reuse `react-force-graph-2d` or custom SVG), SPE via DFS.
5. **Sensitivity / "what stays stable"** — sweep a payoff ±Δ, recompute equilibria, show which NE are robust vs. fragile (heat map).

### B — Integration
Link a game session to a `cop_session` via the existing `linked_frameworks` JSON; strategy labels can reference `actors` (same `workspace_id`); attach `evidence_items` to payoff cells to document estimates; CSV export of matrix + results (extend `ExportButton`); document a "export CSV → run in Gambit/Nashpy locally" off-ramp for large games.

---

## Workstream C — Quantitative & Reliability Analysis module

**Why:** Analysts bring survey data, coded datasets, and tabular evidence. The platform already does **multi-analyst claim/evidence coding** (COP sessions) and has an 8-dimension SATS credibility instrument — so **inter-rater reliability (IRR)** and **scale reliability** are uniquely high-value here and **no OSINT platform offers them natively.** This is the differentiator; general descriptive/inferential stats round it out.

**Feasibility verdict:** Target **in-browser TypeScript stats** (client-side compute; Workers do CRUD only). **Do NOT bundle WebR/Pyodide in a Worker** (WebR core ~25–35 MB > Worker limit). Reserve **WebR in a browser Web Worker** as a feature-flagged escape hatch for advanced models (SEM/CFA/multilevel) later; keep the existing **R-script export** path for power users.

> Sources: simple-statistics docs; mljs (ml-pca, ml-regression-multivariate-linear, ml-matrix); `krippendorff` + `label-score` npm; jStat; WebR / r-wasm docs; Cloudflare Python Workers (Pyodide curated list excludes scipy/statsmodels). Method value ranking validated against social-science methods literature (PMC).

**Tier:** **3 — standalone tool page.** `src/pages/tools/QuantitativeAnalysisPage.tsx` + `functions/api/quantitative/*.ts`. **New D1 tables** (ship with retention cron):
- `quantitative_datasets` — CSV metadata + R2 key (large CSVs go to R2, not D1).
- `analysis_runs` — `method`, `parameters` (JSON), `results` (JSON), generated R script, timestamps. **Add a 90-day `DELETE` cron** in the same PR (project convention — bounded D1).

**Libraries to add** (`package.json`): `simple-statistics` (~8 KB), `ml-pca` + `ml-regression-multivariate-linear` + `ml-matrix`, `krippendorff`, `label-score`, `jstat` (p-value lookups). All client-side.

### C — Phase 1 MVP: "Quantitative Analysis"
Upload CSV (or select an existing Dataset) → run + render with existing chart components:
- **Descriptives** (mean/median/sd/quartiles, frequency tables) — `simple-statistics`.
- **Correlation matrix** (Pearson/Spearman) — high value on SATS numeric scores, confidence ratings, frequencies.
- **Cross-tab + chi-square + Cramér's V** — immediately useful on entity/source attribute tables (~5 LOC over `simple-statistics`).
- **Group comparison** — independent t-test / Mann-Whitney; one-way ANOVA (jStat F-dist).
- **Simple OLS regression** — coefficient + fit.
Persist each run to `analysis_runs`; offer a "Download R script" button (pre-populated template extending `docs/r-scripts/`).

### C — Phase 2: Reliability Engine (highest unique value — consider doing first)
- **Inter-rater reliability:** Cohen's κ (2 raters), Fleiss' κ (3+), **Krippendorff's α** (any data level, missing-data tolerant) — via `label-score` + `krippendorff`. Input = rater×item×code (pull directly from COP claim/evidence coding). Surface Landis–Koch interpretation in plain language.
- **Cronbach's α** (~10 LOC) — validate the SATS 8-dimension credibility instrument's internal consistency.

### C — Phase 3: Multivariate
Multiple OLS (+ VIF), logistic regression (+ ROC/AUC — e.g., predict claim verification from evidence features), PCA (scree plot; AI-labeled components via a gateway call on the loadings) — via mljs.

### C — Phase 4 (stretch, feature-flagged): WebR browser panel
"Run in R" on any result → load WebR in a browser Web Worker → execute the generated R script → return tables/plots. Unlocks EFA/CFA/SEM/multilevel (`psych`, `lavaan`, `lme4`) without server compute.

### C — Priority order for this audience
1. IRR (κ / Krippendorff's α) — 2. Cross-tab + χ² + Cramér's V — 3. Correlation matrix — 4. Cronbach's α — 5. Descriptives — 6. Logistic regression — 7. PCA — 8. EFA/CFA/SEM → R-export/WebR only (academic; defer).

---

## Suggested sequencing (rides on top of the hardening track in ROADMAP "Now")

1. **A1 SAT quick-wins** (one batch) + **A-verify `kac`** — days, near-zero risk, immediate analyst value. Good warm-up that exercises the config path.
2. **A2 Indicators/Signposts** — high value; small item-schema extension.
3. **C Phase 2 Reliability Engine** — the unique differentiator; smaller surface than the full stats MVP; reuses COP coding data.
4. **B Game Theory MVP** (solver + 2-player analyzer + templates) — flagship net-new module; then AI payoff estimation, then ESS/replicator.
5. **A3 matrix widgets** (Multiple Scenarios, Cross-Impact) + **C Phase 1 stats MVP** — as capacity allows.
6. Stretch goals (B extensive-form/sensitivity; C multivariate/WebR) — later.

**Per-workstream guardrails recap:** new high-write tables (C) ship with a retention cron; all AI via `callOpenAIViaGateway` with field-by-field validation; heavy math client-side; migrations applied+verified locally before `--remote` with a backup first.
