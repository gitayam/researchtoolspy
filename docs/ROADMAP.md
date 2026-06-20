# ResearchTools.net — Roadmap

**Last updated:** 2026-06-19 · **Current release:** `v0.22.0` (+ hardening patches through `v0.22.7`) · **Prod:** [researchtools.net](https://researchtools.net) (Cloudflare Pages + D1)

This is the living roadmap — the single source of truth for "what's next." Detailed findings live in [`TECH_DEBT.md`](operations/TECH_DEBT.md), the AI-safety review in [`AI_REFUSAL_REVIEW.md`](operations/AI_REFUSAL_REVIEW.md), and dated design/implementation plans in [`plans/`](plans/). Status legend: ✅ done · 🔄 partial · ⬜ planned.

---

## Direction

The feature build-out phase is largely behind us. The platform already ships a deep analyst toolkit:

- **12+ structured analytic frameworks** — ACH, COG (with network viz + Excel/PDF/PPT export), COM-B / Behaviour Change Wheel, Deception/SATS, Starbursting, SWOT, PEST, PMESII-PT, DIME, DOTMLPF, Stakeholder, Causeway.
- **Content intelligence** — URL / PDF / social-media extraction with AI entity + claim extraction, deception analysis, and a content library.
- **COP workspace** — multi-source incident analysis (entities, RFIs, evidence, timeline, map markers, hypotheses, personas, scrapers).
- **Intelligence synthesis dashboard**, **investigations & packets**, **evidence/entity management**, **network analysis** with exports to Gephi / Neo4j / Maltego / i2 ANB, and **agentic research collection** (Phases 1–4 complete).

The last month of work has been a deliberate **production-hardening pivot** — AI safety (refusal handling, consent gating, de-biased scoring), observability (`event_logs` sink), cost control (rate limiting), data retention (D1 225 MB → ~18 MB), auth resilience, and content-extraction reliability. **That is the current direction and it should continue:** make what exists trustworthy, observable, bounded, and safe before adding net-new surface area.

**Themes driving prioritization (in order):**
1. **Correctness & safety** of AI output and access (refusals, consent, abuse/cost).
2. **Observability** — never fly blind in prod again.
3. **Bounded cost** — D1 size, AI spend, write amplification.
4. **Reliability** of the content-extraction pipeline (the most-used path).
5. **Debt paydown / schema hygiene** so the next feature wave starts clean.

New features are welcome but should ride on top of this hardened base, not around it.

---

## Recently shipped

### v0.22.7 — Agentic Research hardening: rate-limit + stuck-job timeout (2026-06-19)
- ✅ **`/api/collection/start` is rate-limited** — added to the per-user AI limiter (`AI_RATE_LIMITED_PATHS` in `_middleware.ts`) so spawning an OSINT-agent run counts against the 40/min cap (cost/abuse). Used the exact path, not the broad `/api/collection/` prefix (which would have throttled the IP-keyed callback).
- ✅ **Stuck collection jobs now time out** — a job left `running`/`pending` past 15 min (agent accepted but never called back) is lazily transitioned to a terminal `error` on status read via a **race-safe** UPDATE (WHERE re-checks status+age, so a late callback still wins), so the polling UI stops. Exported pure helper `isCollectionJobStale()` + `@smoke` test (`2e4e75ff6`).

### v0.22.6 — AI endpoints return a clean "declined" on model refusal (2026-06-19)
- ✅ **No more opaque 500 on content-policy refusal** — `swot-auto-populate` and `pmesii-pt/import-url` now check the gateway's `_refusal` marker and return the standard `REFUSAL_BODY` (`{declined:true}`, 200) instead of `JSON.parse`-ing refusal prose into an opaque 500, matching the established `ai/generate.ts` / `ai/cog-analysis.ts` idiom. Contract pinned by `tests/e2e/smoke/ai-refusal-contract.spec.ts` (`detectRefusal` flags refusals + ignores analytical content; `REFUSAL_BODY` shape) (`a19142904`).

### v0.22.5 — Explicit public ACH API contract (2026-06-19)
- ✅ **Public ACH endpoints return an allowlist, not the full row** — the no-auth ACH detail (`public/[token].ts`) and list (`public/index.ts`) endpoints stopped spreading `SELECT *` rows into responses; a dependency-free `serializePublicAnalysis()` (`functions/api/ach/public/_public-fields.ts`) returns only display fields, so the internal `user_id` and any future column are excluded. Prod-verified (public list response carries no `user_id`); unit-tested (`tests/e2e/smoke/ach-public-fields.spec.ts`). `clone.ts` already returned only the new clone's own ids — left as-is (`f08e7f4e3`).

### v0.22.4 — ACH ranks by Heuer disconfirmation (2026-06-19)
- ✅ **Flagship ACH correctness fix** — ACH now ranks hypotheses by **weighted inconsistency** (sum of contradicting scores only; least-disconfirmed = most likely), matching Heuer's method, instead of by **net support** (which rewarded confirmation and produced an inverted "Most Likely"). Fixed on all live paths — `ach-diagnosticity.ts` `calculateHypothesisLikelihoods` (consumed by all 4 ACH export components) and the `ACHMatrix` ranking badge + "Key Principle" text; net/raw sums kept as clearly-labeled secondary signals. Canon pinned by a regression test (`tests/e2e/smoke/ach-ranking.spec.ts`, net-sum-vs-disconfirmation disagreement scenario) (`27f9b502b`).

### v0.22.3 — One canonical audit trail (2026-06-19)
- ✅ **Consolidated to a single written audit/observability trail (`event_logs`)** — dropped the two dead "audit" tables (`auth_logs`, `settings_audit_log`; both **0 rows** in prod, migration 107) that implied coverage that didn't exist, and rerouted the one real security event (`hash_backup_generated` in `settings/hash/backup.ts`) to `event_logs` via `logEvent()` with a new `'audit'` level (the `/api/cron/event-logs` reader now surfaces it). The reroute also **stopped persisting the backup recovery code and the full user hash** (only an 8-char prefix is logged for correlation). Unit-tested via `tests/e2e/smoke/audit-log-sink.spec.ts` (`d10ea56c8`).

### v0.22.2 — Auth resilience: retryable 503 on D1 error (2026-06-19)
- ✅ **Retryable 503 instead of spurious 401** — `resolveHashUser` no longer swallows D1 errors to `null` (which callers mapped to **401**, telling authenticated users to re-auth on a mere DB hiccup under burst load). It now resolves a valid user id or throws `AuthDbError`; `requireAuth` maps that to a **retryable 503** (`Retry-After: 2`), and `functions/api/_middleware.ts` duck-types the same marker as a global chokepoint for the many endpoints that call `getUserFromRequest`/`getUserIdOrDefault` directly (those become 503, not an opaque 500). Genuine no/invalid-hash still → 401 (prod-verified). Unit-tested via `tests/e2e/smoke/auth-resilience.spec.ts` (`3a016c141`).

### v0.22.1 — Content-intel & claims reliability (2026-06-15)
- ✅ **Batched deception analysis** — claim deception scoring is now chunked on both the content-intel and claims live paths (shared engine extracted), fixing JSON-truncation failures on large claim sets (`574e2587d`, `b747388bb`).
- ✅ **Thin/paywalled extraction warnings** — URL extraction now warns up front when content is thin or paywalled, gated on word count to avoid false positives (`108e9698f`, `2b6eab787`).

### v0.22.0 — AI safety, observability & cost control (2026-06-13→15)
- ✅ **AI content-policy refusal handling** — `detectRefusal()` in the gateway; callers return a clean `{declined}` instead of opaque 5xx; defensive analyst framing on intel prompts.
- ✅ **De-biased claim credibility scoring** — removed hardcoded political-affiliation priors in `extract-claim-entities`; now stake/independence/proximity-based.
- ✅ **Single AI egress point** — all ~40 callers routed through `callOpenAIViaGateway`; only the gateway calls OpenAI directly (caching, fallback, org-header forwarding, refusal detection inherited everywhere).
- ✅ **Production observability** — `event_logs` D1 sink (migration 105) + `logEvent()`; backend errors, AI refusals, and **client crashes** (ErrorBoundary → `/api/client-error`) are visible via secret-guarded `GET /api/cron/event-logs`; pruned >30 days by the daily cron.
- ✅ **Tier-1 sensitive-use consent gate** — `user_consents` table (migration 106) + `requireConsent()` 403 + `/api/user/consent` + frontend `fetchWithConsent` dialog. Gates `ai/generate`, `summarize-entity`, `relationships/infer-type`.
- ✅ **Dependency hygiene** — vulns **17 → 3** (within-range updates + `uuid` override for the exceljs transitive). Remaining 3 are build-tooling-only.
- 🔄 **AI rate limiting** — KV-backed limiters (middleware per-user + gateway global) replace an isolate-local in-memory Map. Protects against *sustained* abuse; **not burst-accurate** (KV eventual consistency) — see Now/#1.
- ✅ **Auth resilience** — `getUserFromRequest` hardened against guest-hash collisions (8→32-char prefix) and one transient-D1 retry. **Residual (resolved 2026-06-19):** the transient 401 under burst D1 throttling is now a retryable 503 — see v0.22.2 above.

### v0.21.0 — Content-analysis retention (2026-06-13)
- ✅ **Bounded D1 growth** — `expires_at` on insert, cascade-safe global cleanup endpoint, daily cron worker (`researchtoolspy-cron`), legacy backfill. **D1 225 MB → ~18 MB.**

---

## Now (highest priority)

1. **Burst-accurate rate limiting** `TD-05` — replace the KV limiters with the **Cloudflare Rate Limiting binding** (`[[ratelimit]]`, strongly consistent) or a **Durable Object** counter. KV is eventually consistent so sub-minute bursts slip through today (verified: a 46-request burst was not blocked).
   - *Files:* `functions/_middleware.ts` (per-user limiter), `functions/utils/ai-gateway.ts` (global backstop), `wrangler.toml`.
   - *Done when:* a sub-minute burst over the threshold is rejected with 429; limiter is strongly consistent; falls back cleanly if the binding isn't supported on Pages Functions (deploy-gated attempt, revert cleanly if not).
   - 🔄 *blocked (2026-06-19): needs an architecture call.* The native `[[ratelimit]]` binding is **not** strongly consistent (CF docs: counters are per-machine and updated asynchronously), so it fails the "strongly consistent" acceptance bar, and Pages Functions support for the binding is undocumented. The only mechanism that truly satisfies "strongly consistent" is a **Durable Object** — which on Pages requires standing up a new DO-hosting Worker + a DO migration + a `script_name` binding (a new always-on deployable component + deployment-topology/cost decision the maintainer should own). **Decide:** accept the native binding's per-colo consistency as "good enough" (downgrade the acceptance bar), or invest in the DO Worker.

2. **SAT correctness & safety fixes** `D0` — a 2026-06-19 audit found **bugs in shipped analytic techniques that change the answers analysts get** (theme #1). Full list + file:line + fixes in [`plans/2026-06-19-analytic-capability-expansion.md`](plans/2026-06-19-analytic-capability-expansion.md) → "Workstream D0." Headline items:
   - ✅ **ACH ranking inversion — FIXED** (v0.22.4, `27f9b502b`): now ranks by Heuer disconfirmation (weighted inconsistency) on all live paths; net-sum demoted to secondary. **Residual (still open):** (a) evidence-credibility weighting is a **façade** — `evidence-quality.ts:151–170` hardcodes weights and the TEXT-vs-number bug (`:155`) parses the source *name* as a grade; the real `reliability`/`confidence_level` columns exist but the ACH GET (`functions/api/ach/index.ts:63–75`) never selects them, so the lib/export ranking is currently **unweighted** by evidence quality; (b) `ach-scoring.ts`'s parallel net-sum scoring engine is dead code with the same inversion (delete or align — only its scale constants are used).
   - **Deception AI** runs client-side with a browser-exposed `VITE_OPENAI_API_KEY` (latent key-leak — *verified unset today, no live leak*; move server-side onto the gateway) and **silently returns a fabricated fallback** as if it were real analysis; confidence counts magnitude not coverage; PDF bars render at ⅓ value.
   - **COG** view/matrix/exports **crash** on custom-scored vulnerabilities (unguarded `vuln.scoring.*`); **COM-B** runs two divergent canonical matrices (UI vs `/recommend` API disagree).
   - ✅ **AI-endpoint refusal crashes — FIXED** (v0.22.6, `a19142904`): `swot-auto-populate` + `pmesii-pt/import-url` now check `_refusal` and return a clean `REFUSAL_BODY` (200) instead of an opaque 500. ✅ **ACH public `SELECT *` + spread — FIXED** (v0.22.5, `f08e7f4e3`): public ACH detail+list return an explicit field allowlist (`serializePublicAnalysis`), excluding `user_id`/future columns.
   - *Done when:* each headline bug has a regression test and the technique output matches canon (Heuer disconfirmation, SATS, Eikmeier, BCW Table 3.3).

3. **Agentic Research — review & hardening** `Agentic` — the AI source-collection feature ("Agentic Research", `/dashboard/tools/collection`) works end-to-end (job → external OSINT agent → callback → triage → approve → batch-analyze), but a 2026-06-19 code review found security / reliability / cost gaps. *Files:* `functions/api/collection/*` (`start.ts`, `callback.ts`, `[jobId]/{status,results,approve}.ts`), `src/pages/tools/CollectionPage.tsx`, `functions/api/_middleware.ts`, `schema/` (`collection_jobs` / `collection_results` / `collection_queries`).
   - **[HIGH] Unauthenticated callback** — `functions/api/collection/callback.ts` accepts any POST and inserts results / completes a job for any known `jobId` (no secret/signature; only checks the job row exists). → shared-secret/HMAC the OSINT agent includes. **Cross-system:** the external agent (`OSINT_AGENT_URL`) must send it — coordinate, or do a backward-compatible rollout (accept-unsigned-then-tighten).
   - ✅ **[HIGH] Stuck jobs never time out — FIXED** (v0.22.7, `2e4e75ff6`): jobs `running`/`pending` past 15 min are lazily transitioned to a terminal `error` on status read via a race-safe UPDATE.
   - ✅ **[MED] Collection endpoints not rate-limited — FIXED** (v0.22.7, `2e4e75ff6`): `/api/collection/start` added to the per-user AI limiter.
   - **[MED] No retention** — `collection_jobs` / `collection_results` / `collection_queries` have no cleanup (violates the project "new tables ship with a retention cron" convention). → `expires_at` + cron window (needs a retention-window decision).
   - **[LOW] Hygiene** — `workspace_id` accepted null (isolation); missing-score fallback `relevanceScore || 0.5`; hardcoded 70% select threshold + no score distribution; approve → batch-process cross-origin call forwards no auth.
   - *Done when:* each HIGH item has a fix + regression test, prod-verified; MED/LOW fixed or explicitly captured.

## Next

4. **Per-user limiting everywhere** `TD-05` — thread `metadata.user_id` through more gateway callers so per-user (not just global) limits apply; throttle the Apify scrapers separately from AI calls.
5. **Content-extraction quality** — build on the v0.22.1 thin/paywalled warnings: track extraction-failure reasons in `event_logs`, and decide the fate of the **dead `content_chunks` full-text path** (`analyze-url.ts` writes it, nothing reads it — fix or remove).
6. **Extend consent gating** — apply `requireConsent` to the remaining sensitive paths: PimEyes / face-match and CARVER / COG vulnerability generation.
7. **Schema sprawl cleanup** `TD-06` — inventory the ~148 tables by row count; drop the confirmed-dead ones (incl. the unused `rate_limits` table) with a migration, or document the intentionally-future ones.

## Later

8. **vite 8 / rolldown migration** — clears the 3 remaining build-tooling vulns (esbuild/vite/wrangler). Real migration: `manualChunks` → `advancedChunks` + config types + **browser QA** (maplibre worker risk). Branch-only, when rolldown-vite matures.
9. **Index hygiene** `TD-04` — drop redundant `content_analysis` single-column indexes covered by composites (write amplification: ~14 index updates per insert). Cross-check D1 insights first.
10. **Logger consolidation** `TD-07` — merge the two `activity-logger` modules into one canonical module; migrate the 7 callers.
11. **R2 uploads verification** `TD-08` — confirm `env.UPLOADS` writes land (0 objects despite active write code in `feedback/submit.ts` + `twitter-image-proxy.ts` = likely silent failures; check the Dashboard R2 binding on the Pages project).
12. **JSON column trimming** `TD-02` — one-time GATED trim of legacy oversized `word_frequency` / `links_analysis` rows; consider moving `extracted_text` to R2 keyed by `content_hash`.
13. **CI-on-merge** — deploy `main` automatically so prod and `main` don't drift (TD-09 lagged ~1 month once).
14. **Lint / type-check gate hardening** `Discovered 2026-06-19` — `npm run lint` is red repo-wide (~6.5k pre-existing `no-explicit-any` / `no-unused-vars`, *including* the `tests/e2e/smoke/*.spec.ts` themselves — `eslint.config.js` ignores only `dist` and has no `tests/`/`functions/` overrides), so the lint gate is effectively **non-enforcing**. Separately, `npm run type-check` (`tsc -b`) covers only `src/` + `vite.config.ts` — it does **not** type-check `functions/` or `tests/`, so Pages-Function TS errors surface only at `wrangler` build/deploy time. Add scoped eslint overrides + a `functions/` typecheck step (feeds CI-on-merge #13).
15. **Public-endpoint field-allowlist sweep** `Discovered 2026-06-19` — the ACH public endpoints were returning the full DB row (fixed v0.22.5). Audit the other no-auth/public endpoints for the same `SELECT *` + spread pattern and apply explicit allowlists — notably the COP public share endpoints under `functions/api/cop/public/`. Prevents internal columns (and future columns) from being returned to unauthenticated clients.
16. **Refusal-check sweep across AI gateway callers** `Discovered 2026-06-19` — v0.22.6 fixed `swot-auto-populate` + `pmesii-pt/import-url`, but other `callOpenAIViaGateway` callers that `JSON.parse` the response may still lack a `data?._refusal` guard (→ opaque 500 on refusal). Grep for `callOpenAIViaGateway` + `JSON.parse` without a nearby `_refusal` check and apply the standard `REFUSAL_BODY` guard.

---

## Capability expansion (research-backed — rides on the hardened base)

Net-new analytic capability, scoped against the Heuer & Pherson SAT catalog, game-theory computation feasibility, and social-science stats tooling (research 2026-06-19). **Full coding context — data models, algorithms, file-level patterns, do/don't — is in [`plans/2026-06-19-analytic-capability-expansion.md`](plans/2026-06-19-analytic-capability-expansion.md).** These are the *feature* direction; they ride on top of the hardening track above, not around it.

The codebase has three extension tiers — Tier 1 config-only framework (`framework-configs.ts`, ~30 min), Tier 2 bespoke Form/View (COG/Deception pattern), Tier 3 standalone tool page + own table (`src/pages/tools/` — `CrossTablePage`, `EquilibriumAnalysisPage`, `HamiltonRulePage`). Each item below is tagged with its tier.

- **A · SAT coverage** `Tier 1 (+ small Tier 2)` — the biggest remaining gaps are scenarios/indicators, challenge analysis, and decision support, almost all **config-only** reusing the generic engine + AI auto-population. Ship batch: What-If, Premortem, Red Hat, Pros-Cons-Faults-and-Fixes, Devil's Advocacy, Force Field, Structured Self-Critique. Then **Indicators/Signposts (+Validator)** — highest-value, small item-schema extension. Then matrix-widget techniques (Multiple Scenarios 2×2, Cross-Impact N×N) on one shared `<AnalyticMatrix>`. *Note:* `kac` (Key Assumptions Check) already exists — **verify scope, don't rebuild**. Avoid: Delphi, Argument Mapping, full Morphological, standalone Bayesian (low value / high cost here).
- **B · Game Theory / Strategic Interaction** `Tier 3` — net-new and complements the existing strategic/evolutionary tools (Hamilton's Rule = kin-selection cooperation; Equilibrium Analysis = behavioral equilibria) — neither covers classical Nash / mixed strategies / **ESS / replicator dynamics**. No viable npm solver exists → **~200-LOC dependency-free TS solver** (`src/lib/game-theory/solver.ts`), all compute **client-side** (Workers CPU limit irrelevant). MVP: 2-player normal-form payoff editor + pure/mixed NE + best-response highlight + named templates (Prisoner's Dilemma, Chicken, Stag Hunt, Deterrence, Battle of the Sexes; cap 6×6). Stretch: AI payoff estimation → ESS/replicator simulator → iterated PD → game tree → sensitivity.
- **C · Quantitative & Reliability Analysis** `Tier 3` — **inter-rater reliability is the differentiator** (the platform already does multi-analyst claim/evidence coding; no OSINT tool offers κ / Krippendorff's α natively). In-browser TS stats (`simple-statistics` + mljs + `krippendorff`/`label-score` + jStat) — **do not bundle WebR/Pyodide in a Worker**; WebR-in-browser is a later feature-flagged escape hatch; keep R-export for power users. New D1 tables (`quantitative_datasets`, `analysis_runs`) **ship with a retention cron** (project convention). Phase 1 stats MVP (descriptives, correlation, χ², t-test/ANOVA, OLS); **Phase 2 Reliability Engine** (Cohen's/Fleiss' κ, Krippendorff's α, Cronbach's α — consider doing first); Phase 3 multivariate; Phase 4 WebR.
- **D · Improve / fix / enhance the EXISTING SATs** `mixed` — the audit behind Now/#2. Beyond the D0 correctness/safety bugs, two **high-leverage architecture fixes lift every framework at once**: (1) wire `promptQuestions` + section config into the AI prompt builders (today they're only a frontend accordion; AI endpoints hard-code duplicate maps; only 2 of 18 configs have any promptQuestions) — and (2) unify the **three incompatible evidence-linking systems** (`framework_evidence` vs ACH's `ach_evidence_links` vs claims' `claim_evidence_links` vs COG/SWOT inline JSON) so evidence vetted once is reusable across techniques. Plus: **five configured frameworks are unreachable** (carver, ooda, abcde, kac, 5whys — no route/page); add a generic **scored-item / enum-item type** to fix CARVER (unscored) and KAC (no importance/support); delete dead files (`COGForm.tsx.bak`, unimported `frameworks/AICOGAssistant.tsx`); register the authored-but-unwired i18n `frameworks` namespace. Enhancements: ACH sensitivity + tentative-rejection (Heuer steps 5–6, absent), consolidate ~1.5k LOC of bespoke exporters onto `report-generator.ts`, real COG centrality, DOTMLPF→DOTMLPF-P, PESTLE/DIMEFIL variants.

**Suggested entry point:** **D0 SAT correctness fixes first** (live-feature bugs) → D1 architecture levers (promptQuestions→AI, evidence unification) + route the 5 dead frameworks → A1 SAT quick-wins → A2 Indicators → C-Phase-2 Reliability Engine → B Game Theory MVP. Full rationale + sequencing in the plan doc.

---

## Known limitations (accept, or fix above)
- **ACH ranking is now Heuer-correct** (disconfirmation / weighted-inconsistency, shipped v0.22.4). **Residual:** the credibility weighting feeding it is still a façade, so the lib/export ranking is unweighted by evidence quality (Now/#2). Deception AI still falls back to a fabricated stub when the (unset) client key is absent (Now/#2).
- **Rate limiting is sustained-abuse only** (KV eventual consistency) — burst-accurate fix is Now/#1.
- **AI endpoints are open to any 16+ char hash** (`getUserFromRequest` auto-provisions) — mitigated by rate limiting + Tier-1 consent; deeper fix is real accounts.
- **Tier-1 consent gate's runtime fire is unverified** — the intermittent 401 that blocked this was resolved by the v0.22.2 503 fix (2026-06-19); the runtime fire (403 → consent dialog → success) is now **unblocked but still needs an actual verification pass**.
- **3 build-tooling vulns** persist (not shipped to the runtime Worker) pending the vite 8 migration (Later/#8).

---

## Working with Claude on this roadmap

- **Pick the top unblocked item in "Now."** Each carries file pointers and a "Done when" — treat that as the acceptance test.
- **Verify against prod the way prod actually behaves:** Pages Function `console.*` is NOT visible in `wrangler tail` — use the `event_logs` sink (`GET /api/cron/event-logs` with `X-Cron-Secret`).
- **Never run untested SQL against prod.** Apply + verify on local D1 first, then `--remote`. Back up before any migration: `wrangler d1 export researchtoolspy-prod --remote --output backups/...`.
- **D1 conventions:** lowercase snake_case tables/columns; entity types UPPERCASE (CHECK constraints); entity tables use `created_by`+`workspace_id`, framework tables use `user_id`.
- **Update this file as part of the work** — move shipped items to "Recently shipped" with a date, and keep the header date/release current. Mirror to both remotes: `git push origin main && git push gitlab main`.

## Operational reference
- **Deploy:** `./deploy.sh` (full, runs migrations) or `./deploy.sh --skip-migrate`. Don't deploy from repo root — the script copies `functions/` into `dist/` first.
- **Check prod logs:** `GET /api/cron/event-logs` with `X-Cron-Secret` (errors/refusals/rate-limits + 24h summary).
- **D1 health:** `wrangler d1 info researchtoolspy-prod` (size bounded by the daily cron).
- **Cron:** `researchtoolspy-cron` Worker, daily 04:00 UTC — content retention + `event_logs` pruning. Setup: [`CRON_CLEANUP_SETUP.md`](operations/CRON_CLEANUP_SETUP.md).
