# Cross Table — Customizable Comparison Matrix

**Date:** 2026-03-12
**Status:** Approved
**Route:** `/dashboard/tools/cross-table`

## Overview

A customizable cross-comparison matrix tool for structured analysis. Supports pre-built templates (CARVAR, COA Comparison, etc.) and fully custom matrices. Features multiple scoring methods, AHP pairwise weight derivation, sensitivity analysis, collaborative Delphi scoring, and AI-assisted analysis.

## Templates

Eight built-in templates, plus blank custom:

| Template | Default Rows | Default Columns | Default Scoring |
|----------|-------------|-----------------|-----------------|
| **CARVAR** | Targets | Criticality, Accessibility, Recuperability, Vulnerability, Effect, Recognizability | 1-5 Numeric |
| **COA Comparison** | Courses of Action | User-defined criteria (mission success, risk, logistics, speed, etc.) | 1-10 Numeric |
| **Weighted Scoring** | Alternatives | User-defined criteria | 1-5 Numeric |
| **Pugh Matrix** | Concepts | User-defined criteria | Ternary (+/0/-) |
| **Risk Assessment** | Risks/Threats | Likelihood, Impact, Detectability | 1-5 Numeric |
| **Kepner-Tregoe** | Alternatives | Musts (go/no-go) + Wants (weighted) | Per-column (see below) |
| **Prioritization** | Items | Urgency, Importance (or custom) | 1-5 Numeric |
| **Blank Custom** | User-defined | User-defined | User-selected |

All templates are fully customizable after creation — rows, columns, scoring method, and weights can all be modified.

### Kepner-Tregoe Per-Column Scoring

Kepner-Tregoe requires two scoring modes within one matrix: binary go/no-go for "Must" criteria and 1-10 numeric for "Want" criteria. This is supported via a per-column `scoring_override` field in the config JSON. Columns with `scoring_override` use that method instead of the matrix-level default. Only Musts that pass (all "yes") proceed to Want scoring — the UI grays out Want scores for rows that fail any Must.

## Architecture

**Composable Engine + UI Layer** — separate pure TypeScript engine from React UI.

### Engine (`src/lib/cross-table/`)

| Module | Purpose |
|--------|---------|
| `types.ts` | All TypeScript interfaces — `CrossTable`, `CrossTableConfig`, `Score`, `ScoringMethod`, `WeightingConfig`, etc. |
| `engine/scoring.ts` | Score normalization across methods, scale conversion, aggregation (sum, mean, weighted) |
| `engine/weighting.ts` | Manual weights, equal distribution, weight normalization, validation (sum to 1.0) |
| `engine/ahp.ts` | AHP matrix construction, eigenvalue approximation, consistency ratio (CR) check, weight extraction. **Max 12 criteria** — UI prevents AHP mode with >12 columns (12 criteria = 66 pairwise comparisons, the practical upper limit). |
| `engine/sensitivity.ts` | One-at-a-time weight perturbation (±10-50%), tornado diagram data, break-even point calculation |
| `engine/ranking.ts` | Rank alternatives by weighted score, handle ties, compute dominance relationships |
| `engine/delphi.ts` | Multi-scorer aggregation — per-cell median, IQR, Kendall's W coefficient, round-over-round comparison |
| `engine/templates.ts` | Template config objects — each defines default rows, columns, scoring method, weights, descriptions |

**Key engine behaviors:**

- **AHP consistency**: Computes CR via eigenvalue approximation. CR > 0.10 triggers a warning that pairwise comparisons are inconsistent. Limited to 12 criteria max.
- **Score normalization**: All scoring methods normalize to 0-1 for cross-method comparison. Numeric: `(value - min) / (max - min)`. Traffic light: R=0, A=0.5, G=1. Ternary: -=0, 0=0.5, +=1. Binary: no=0, yes=1. ACH: II=0, I=0.25, N=0.5, C=0.75, CC=1.
- **Sensitivity**: Perturbs each weight independently while redistributing remainder proportionally. Outputs per-criterion sensitivity coefficient and rank-change thresholds.
- **Delphi**: Per-cell median + IQR across scorers. Kendall's W for overall concordance (0=no agreement, 1=perfect agreement). Cells with IQR > 1.5 flagged as "high disagreement."

### UI Components (`src/components/cross-table/`)

| Component | Purpose |
|-----------|---------|
| `CrossTableEditor.tsx` | Main editor shell — tab navigation, state via `useReducer` + single context provider (`CrossTableContext`) for matrix data, scores, weights, UI state |
| `CrossTableToolbar.tsx` | Title, template badge, status, AI/Scorers/Export/Share action buttons |
| `MatrixGrid.tsx` | Interactive scoring table — inline cell editing, row/column add/remove/reorder via drag. Reorder triggers config save. Reorder disabled when Delphi scoring is active. |
| `ScoreCell.tsx` | Single cell — click to score (renders input appropriate to scoring method), right-click for notes, heat-map color scaling. Optional confidence micro-slider (0-1) shown on hover for Delphi mode. |
| `WeightsPanel.tsx` | Manual weight sliders with normalization, equal distribution button, AHP wizard trigger, weight bar chart |
| `AHPWizard.tsx` | Step-through dialog for pairwise comparisons — 1-9 scale slider per pair, shows progress and running CR. Disabled if >12 criteria. |
| `ResultsPanel.tsx` | Ranked horizontal bar chart, radar/spider chart overlay for top 3, dominance matrix, score waterfall breakdown |
| `SensitivityPanel.tsx` | Tornado diagram (Recharts), interactive weight sliders with live rank recalculation, break-even table |
| `ConsensusPanel.tsx` | Delphi heatmap — cells colored by IQR, Kendall's W gauge, per-scorer completion %, round history |
| `AIInsightsPanel.tsx` | AI summary, challenge mode output, sensitivity narrative, blind spot list, loading states |
| `TemplateSelector.tsx` | Card-based template picker dialog on create — shows template description, default criteria, preview |
| `ScorerToggle.tsx` | Segmented control to switch view: Your scores / Other analyst / Merged (median) view |
| `ScorerView.tsx` | Stripped-down editor for invited Delphi participants — shows only Matrix tab + submit button. No weights, no results, no AI. Renders at `/cross-table/:id/score`. |

**Page component:** `CrossTablePage.tsx` in `src/pages/tools/` — list view with create button, loads editor for existing tables.

### Tab Structure

| Tab | Content | When Visible |
|-----|---------|-------------|
| **Matrix** | The scoring grid | Always |
| **Weights** | Weight configuration (manual/AHP) | Always |
| **Results** | Rankings, charts, dominance | When ≥1 row and ≥1 column scored |
| **Sensitivity** | Tornado diagram, break-even | When results available + ≥2 criteria with weights |
| **Consensus** | Delphi agreement metrics | When ≥2 scorers have submitted scores |
| **AI Insights** | AI-generated analysis | Always (generates on demand) |

### Save Behavior

- **Autosave** for config changes (row/column add/remove/reorder, weight adjustments, display settings) — debounced 1s `PUT /api/cross-table/[id]`
- **Explicit save** for scores — dirty cells tracked locally, batch upserted on "Save Scores" button or tab change. Visual indicator shows unsaved score count.
- This prevents excessive API calls while ensuring structural changes aren't lost.

## Data Model

### Table: `cross_tables`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID (TEXT for sharing/collaboration compatibility) |
| `user_id` | INTEGER | NOT NULL | Owner (FK to users) |
| `title` | TEXT | NOT NULL | Analysis title |
| `description` | TEXT | | Optional context/objective |
| `template_type` | TEXT | NOT NULL | `carvar`, `coa`, `weighted`, `pugh`, `risk`, `kepner-tregoe`, `prioritization`, `blank` |
| `config` | TEXT | NOT NULL | JSON — rows, columns, scoring config, weighting config, display options |
| `status` | TEXT | NOT NULL DEFAULT 'draft' | `draft`, `scoring`, `complete` |
| `is_public` | INTEGER | DEFAULT 0 | Public sharing flag |
| `share_token` | TEXT | UNIQUE | For public share links |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

### Table: `cross_table_scores`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `cross_table_id` | TEXT | NOT NULL, FK | References `cross_tables.id` ON DELETE CASCADE |
| `row_id` | TEXT | NOT NULL | References row in config JSON |
| `col_id` | TEXT | NOT NULL | References column in config JSON |
| `user_id` | INTEGER | NOT NULL | Who scored — enables Delphi multi-scorer |
| `round` | INTEGER | NOT NULL DEFAULT 1 | Delphi round number — incremented when owner initiates a new round |
| `score` | REAL | | Numeric value (null if unscored) |
| `confidence` | REAL | DEFAULT 1.0 | 0-1, scorer's confidence in this score |
| `notes` | TEXT | | Per-cell analyst notes |
| `created_at` | TEXT | NOT NULL | ISO 8601 |
| `updated_at` | TEXT | NOT NULL | ISO 8601 |

**Unique constraint:** `(cross_table_id, row_id, col_id, user_id, round)` — one score per cell per analyst per round.

**Indexes:**
- `idx_scores_table` on `(cross_table_id)` — list all scores for a table
- `idx_scores_table_user` on `(cross_table_id, user_id)` — filter by scorer
- `idx_scores_table_round` on `(cross_table_id, round)` — filter by Delphi round

### Table: `cross_table_scorers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `cross_table_id` | TEXT | NOT NULL, FK | References `cross_tables.id` ON DELETE CASCADE |
| `user_id` | INTEGER | | NULL until invite is accepted |
| `invite_token` | TEXT | UNIQUE | Token for invite link (separate from `share_token`) |
| `status` | TEXT | NOT NULL DEFAULT 'invited' | `invited`, `accepted`, `scoring`, `submitted` |
| `invited_at` | TEXT | NOT NULL | ISO 8601 |
| `accepted_at` | TEXT | | ISO 8601 |

**Unique constraint:** `(cross_table_id, user_id)` — one entry per scorer per table (where user_id is NOT NULL).

**Invite link flow:**
1. Owner calls `POST /api/cross-table/[id]/scorers` with `{ user_id }` (direct) or `{}` (generates invite link)
2. Direct invite: row created with `user_id` set, status `invited`
3. Link invite: row created with `user_id` NULL, `invite_token` generated. Link resolves to `/dashboard/tools/cross-table/:id/score?invite=TOKEN`
4. When scorer opens invite link: `POST /api/cross-table/[id]/scorers/accept` with `{ invite_token }` — sets `user_id` from auth, status `accepted`
5. Completion % = (scored cells for user in current round) / (total cells in matrix)

### Config JSON Schema

```json
{
  "rows": [
    { "id": "r1", "label": "Target Alpha", "description": "" }
  ],
  "columns": [
    {
      "id": "c1",
      "label": "Criticality",
      "weight": 0.25,
      "description": "How critical is this target to enemy operations?",
      "scoring_override": null
    }
  ],
  "scoring": {
    "method": "numeric",
    "scale": { "min": 1, "max": 5 },
    "labels": null
  },
  "weighting": {
    "method": "manual",
    "ahp_pairs": []
  },
  "display": {
    "show_totals": true,
    "sort_by_score": false,
    "color_scale": "red-green"
  },
  "delphi": {
    "current_round": 1,
    "results_released": false
  }
}
```

**Column `scoring_override`:** Optional per-column scoring config. When set, overrides the matrix-level `scoring.method` for that column. Used by Kepner-Tregoe (Musts use `{ "method": "binary" }`, Wants use `{ "method": "numeric", "scale": { "min": 1, "max": 10 } }`). Available for any template — users can mix scoring methods in custom matrices too.

**Scoring methods:** `numeric` (custom min/max), `likert` (with custom labels), `traffic` (R/A/G), `ternary` (+/0/-, for Pugh), `binary` (yes/no), `ach` (CC/C/N/I/II).

**Weighting methods:** `manual` (user sets sliders), `equal` (auto-distribute), `ahp` (pairwise comparison derived, max 12 criteria).

**Color scales:** `red-green` (low=green, high=red — for threats), `green-red` (low=red, high=green — for desirability), `blue` (monochrome intensity), `none`.

## API Endpoints

All under `functions/api/cross-table/`.

### CRUD

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/cross-table` | List user's tables. Query params: `?status=`, `?template_type=`, `?page=`, `?limit=` |
| `POST` | `/api/cross-table` | Create. Body: `{ title, description?, template_type, config? }`. If template_type is not `blank`, merges user config over template defaults. |
| `GET` | `/api/cross-table/[id]` | Get full table with config. |
| `PUT` | `/api/cross-table/[id]` | Update config, title, description, status. Partial updates supported. |
| `DELETE` | `/api/cross-table/[id]` | Delete table + cascade all scores. Owner only. |

### Scoring

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/cross-table/[id]/scores` | Get scores. Query: `?user_id=`, `?round=` to filter. |
| `PUT` | `/api/cross-table/[id]/scores` | Batch upsert. Body: `{ scores: [{ row_id, col_id, score, confidence?, notes? }] }`. Uses requesting user's `user_id` and current round from config. |

### Collaboration / Delphi

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/cross-table/[id]/scorers` | Invite scorer. Body: `{ user_id }` (direct) or `{}` (generates invite link). Returns scorer record with invite URL if link-based. **Requires auth** (`requireAuth`). |
| `POST` | `/api/cross-table/[id]/scorers/accept` | Accept invite link. Body: `{ invite_token }`. **Requires auth.** |
| `GET` | `/api/cross-table/[id]/scorers` | List scorers with completion percentage per round. |
| `GET` | `/api/cross-table/[id]/consensus` | Server-computed: per-cell median, IQR, Kendall's W, disagreement flags for current round. **Requires auth** (owner only). |
| `POST` | `/api/cross-table/[id]/rounds` | Owner advances to next Delphi round. Increments `config.delphi.current_round`. Optionally releases previous round results (`{ release_results: true }`). **Requires auth** (owner only). |

### AI

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/cross-table/[id]/ai/suggest-criteria` | Body: `{ topic }`. Returns `{ criteria: [{ label, description, weight_rationale }] }`. |
| `POST` | `/api/cross-table/[id]/ai/insights` | Generates summary, challenge analysis, blind spots from completed matrix. |
| `POST` | `/api/cross-table/[id]/ai/score-suggest` | Body: `{ row_id, col_id }` or `{ all: true }`. Returns suggested scores with rationale. |

### Export & Sharing

Export is **client-side** — the browser generates files directly using jsPDF, ExcelJS, pptxgenjs, and docx libraries. No server endpoint needed. Charts are rendered from the same Recharts data already in the UI.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/cross-table/[id]/share` | Generate/regenerate share token. Returns `{ share_token, url }`. |
| `GET` | `/api/public/cross-table/[token]` | Public read-only JSON — full matrix with merged results. Rendered by the SPA at `/public/cross-table/:token`. |

### Auth Pattern

- **Single-user CRUD** (list, create, get, update, delete, scores, AI, share): `getUserIdOrDefault` for guest mode compatibility
- **Collaboration endpoints** (scorers, consensus, rounds, accept invite): `requireAuth` — Delphi requires real user identity
- Owner check on all mutations. Scorers can only PUT their own scores.

## AI Integration

Uses `callOpenAIViaGateway()` with gpt-4o-mini (per project conventions).

### Suggest Criteria

- **Input:** Topic string + template_type for context
- **System prompt:** Includes template description, existing criteria if any, scoring method
- **Output:** Array of criteria objects — validated field-by-field
- **UX:** User reviews list, accepts/rejects/edits each before adding to matrix

### Score Suggestions

- **Input:** Full matrix context (all row labels, column labels, existing scores for context)
- **Output:** Per-cell `{ suggested_score, confidence, rationale }`
- **UX:** Displayed as ghost/dimmed values in unscored cells. Analyst clicks to accept (promotes to real score) or types to override. Never auto-fills.
- **Rationale:** Shown in tooltip on hover over ghost score

### Insights & Challenge Mode

- **Summary:** Narrative analysis — top-ranked alternatives, key differentiators, surprises
- **Challenge mode:** Devil's advocate questioning — flags low-confidence scores, potential biases (anchoring, recency, availability), questions uniform scoring patterns
- **Sensitivity narrative:** Plain-language explanation of sensitivity results
- **Blind spot detection:** Compares user's criteria against template defaults and common criteria for the topic — identifies potentially missing dimensions

### Validation

All AI responses validated field-by-field. Never spread raw LLM output. Fallback to empty/default values on parse failure. Error state shown in UI with retry option.

## Collaborative Scoring (Delphi)

### Flow

1. Owner creates matrix, defines structure (rows, columns, scoring method, weights)
2. Owner invites scorers via `POST /scorers` (direct user_id or invite link)
3. Invited scorers accept and access the scorer-only view (`ScorerView.tsx` at `/:id/score`)
4. Each scorer independently scores the matrix (sees only their own scores). Scores are saved with `round = config.delphi.current_round`.
5. Owner views individual scorer results or merged (median) view on Matrix tab via `ScorerToggle`
6. Consensus tab shows agreement metrics — Kendall's W, per-cell IQR heatmap
7. Owner optionally releases results and advances to next round (`POST /rounds`). Scorers can then see previous round consensus and re-score.

### Round Management

- Scores are tagged with a `round` number. Current round lives in `config.delphi.current_round`.
- Advancing a round: owner calls `POST /api/cross-table/[id]/rounds`. This increments the round counter. Previous round scores are preserved (immutable).
- Scorers in round N+1 can optionally see round N consensus (if `results_released = true`) to inform their re-scoring.
- Consensus endpoint accepts `?round=` param to view any historical round.

### Aggregation

- **Per-cell:** Median (robust to outliers) + IQR (spread measure)
- **Overall:** Kendall's W coefficient of concordance (0 = no agreement, 1 = perfect)
- **Disagreement threshold:** IQR > 1.5 (on normalized 0-5 scale) flagged as high disagreement
- **Confidence weighting:** Optional — weight each scorer's contribution by their stated confidence

### Visibility Rules

- Scorers see only their own scores until owner releases round results
- Owner sees all scores, individual and merged views
- Public share shows merged/consensus view only

## Export

**Client-side generation** using jsPDF, ExcelJS, pptxgenjs, and docx (new dependencies to add). Charts rendered from existing Recharts component data.

| Format | Content |
|--------|---------|
| **PDF** | Matrix grid, weighted totals, ranking, charts (results + sensitivity tornado), AI insights if generated |
| **Excel** | Sheet 1: Full matrix with formulas. Sheet 2: Weights + AHP matrix. Sheet 3: Results + rankings. Sheet 4: Raw scores (all scorers if Delphi). |
| **DOCX** | Narrative report — title, methodology, matrix table, results summary, sensitivity findings, AI insights |
| **PPTX** | Slide 1: Title + methodology. Slide 2: Matrix. Slide 3: Results chart. Slide 4: Sensitivity tornado. Slide 5: Key findings. |

## Routing

```
/dashboard/tools/cross-table              → List view (all user's cross tables)
/dashboard/tools/cross-table/new          → Template selector → create
/dashboard/tools/cross-table/:id          → Editor (tabs: Matrix, Weights, Results, Sensitivity, Consensus, AI)
/dashboard/tools/cross-table/:id/score    → Scorer-only view (ScorerView.tsx — Matrix tab + submit, no weights/results/AI)
/public/cross-table/:token               → Public read-only view
```

## Non-Goals (Explicitly Out of Scope)

- Entity/evidence linking (this is a standalone tool, not a framework)
- COP integration
- Real-time collaborative editing (scorers work independently, not simultaneously)
- Custom scoring method plugins (templates are config-driven, not plugin-driven)
- Version history / undo-redo beyond browser undo
