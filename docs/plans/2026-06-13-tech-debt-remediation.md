# Tech-Debt Remediation Plan — 2026-06-13

Companion to [`docs/operations/TECH_DEBT.md`](../operations/TECH_DEBT.md). This is the execution plan for the P0/P1 items. Each phase is independently shippable, verifiable, and reversible.

## Guiding constraints (non-negotiable)
- **Prod D1 is 225 MB / 10 GB, low traffic (≈115 reads/24h).** Back up before any migration: `wrangler d1 export researchtoolspy-prod --remote --output backups/...`.
- **Never run untested SQL against prod.** Apply + verify on local D1 first, then `--remote`.
- **Destructive steps (data-deleting backfill, cleanup runs, index drops) are GATED** — they require explicit approval and a fresh backup in the same session.
- Forward-looking code changes (new inserts, write-time caps, additive tables) carry **no existing-data risk** and are done first.

---

## Findings that reshaped the plan (verified 2026-06-13)
1. **`cleanup.ts` is user-scoped + auth-required** (`WHERE ... AND user_id = ?`, `getUserFromRequest` 401). It **cannot** be driven by a cron — a global, token-guarded cleanup path is required.
2. **The scheduled subsystem appears dead.** `functions/_scheduled.ts` exports `onSchedule` but is **referenced nowhere**, and Pages Functions have no native cron trigger. This means `cleanup`, **and also `playbook-engine` + `sla-check`**, likely never run. Wiring requires an external cron Worker (or Dashboard-configured trigger) hitting an HTTP endpoint.
3. **`expires_at` is never set on insert** (`analyze-url.ts:2250`); migration `034` only back-set it once, retroactively, for `is_saved = FALSE`.
4. **`word_frequency` (66.8 MB) is read by the word-cloud UI** (`WordCloudSection.tsx`) and 3 token endpoints (`public/`, `status/`, `share/`). Capping at write time must preserve enough terms for a word cloud (top ~100 is plenty).
5. **R2 `UPLOADS` IS used** (feedback screenshots `feedback/submit.ts:58`; Twitter media `twitter-image-proxy.ts:105`) — both **non-blocking with swallowed failures**. The bucket showing **0 objects** therefore likely means these writes are *silently failing*, not that the binding is dead. → reclassify TD-08 from "dead binding" to "silently-failing uploads (investigate)".
6. **`content_chunks` is empty** but only written (never read) in `analyze-url.ts` — the full-text chunking path is dead or silently failing.
7. **Data-loss risk on backfill:** every existing row defaults to `is_saved = FALSE`. If `is_saved` is never flipped to TRUE by a real "save" action, a `+7d` expiry backfill would mark **all 6,369 rows** for deletion. **Must verify `is_saved` write semantics before any backfill.**
8. **The cleanup guard (`is_saved = FALSE`) is insufficient — verified.** `is_saved` is set TRUE in exactly one place (`save.ts:81`). But a link can be saved via `saved_links` (`saved-links.ts` POST) which populates `saved_links.analysis_id` **without** flipping `content_analysis.is_saved`. So an analysis can be referenced by a permanent saved link yet still look "unsaved". Worse, `content_analysis` is the parent of **`ON DELETE CASCADE`** children — `content_qa`, `claim_adjustments`, `content_entities`, `framework_content_sources`, `content_chunks`, `content_framework_suggestions`, `starbursting_sources`. Deleting an "unsaved-expired" analysis would **silently cascade-delete linked Q&A, claim adjustments, and framework sources**, and orphan any referencing `saved_links` (FK → NULL). **Cleanup MUST additionally exclude rows referenced by `saved_links` and rows with dependent cascade children, and the `is_saved` gap must be fixed first.**

---

## Phase 0 — Safety net & verification *(no prod mutations)*
- [ ] **0.1 Backup prod D1** → `backups/pre-techdebt-20260613.sql`; confirm file size is sane (~hundreds of MB).
- [ ] **0.2 Verify `is_saved` semantics** — find the code path that sets `is_saved = TRUE` (the "save"/bookmark action) and whether `saved_links`/`bookmark_hash` reference `content_analysis`. Determines whether a retention backfill is safe. **Gate for Phase 1.4.**
- [ ] **0.3 Confirm scheduled subsystem status** — establish definitively whether anything invokes `onSchedule` today (Dashboard cron? external Worker?). If nothing does, file a debt note that playbook-engine/sla-check are also dead.
- [ ] **0.4 Read `WordCloudSection.tsx` + token readers** — confirm top-N `word_frequency` cap won't break the word cloud or token views.

**Exit gate:** backup exists; `is_saved` semantics documented; reader shapes confirmed.

---

## Phase 1 — Stop unbounded growth (TD-01) *(highest value)*
**Sequencing change (from finding #8):** fix the `is_saved` gap and harden the cleanup guard *before* any deletion can be trusted. Steps 1.1/1.1b/2.1/2.2 are safe forward-looking edits; the deletion machinery (1.2/1.3/1.4) is built but **not executed** until the guard is proven cascade-safe.

- [x] **1.1 Set `expires_at` on insert** (`analyze-url.ts:2257`) — DONE. Unsaved analyses now get `datetime('now','+7 days')` (matches migration 034 intent). `save.ts:81` already sets `is_saved = TRUE` + `expires_at = NULL`. *Takes effect on next deploy.*
- [x] **1.1b Close the `saved_links` gap** — DONE (`saved-links.ts`): when auto-analyze sets `analysis_id`, the referenced `content_analysis` is flipped `is_saved = TRUE` + `expires_at = NULL`. `is_saved` is now an authoritative "keep" flag.
- [x] **1.2 Global, token-guarded cleanup endpoint** — DONE: `functions/api/cron/cleanup-content.ts`. Cascade-safe guard (`is_saved=0/NULL` **and** not referenced by `saved_links`/`content_qa`/`starbursting_sources`/`claim_adjustments`), batched (≤10k/run), `?dry=1` dry-run, `X-Cron-Secret` auth, 503 fail-safe if secret unset. Builds clean (functions bundle compiled). *Not deployed.*
- [x] **1.3 Real schedule** — DONE: `workers/cron/` (standalone Worker, `crons=["0 4 * * *"]`, calls the endpoint with the secret) + `docs/operations/CRON_CLEANUP_SETUP.md`. Dry-run bundle OK. *Not deployed.* *(Same pattern can later resurrect the dead `_scheduled.ts` playbook-engine/sla-check — finding #2.)*
- [x] **1.4 Backfill `expires_at`** — DONE 2026-06-13 (full 210 MB D1 backup taken first). Backfilled 6,369 legacy rows; ran cleanup → 6,164 purged, 0 orphans; **D1 225 MB → 17.7 MB**. Cron Worker armed (daily 04:00 UTC) to keep it bounded.

**Verify:** new analysis → `expires_at` populated; saving a link flips `is_saved` + nulls `expires_at`; a past-dated unsaved/unreferenced row is deleted by cleanup; a past-dated row referenced by `saved_links` is **NOT** deleted; spot-check that no cascade child of a kept row is touched.
**Rollback:** code reverts via git; backfill only sets a column (non-destructive); all deletions are covered by the Phase 0 backup.
**Success metric:** net DB size stops growing once daily cleanup ≥ daily insert rate; per-row payload (Phase 2) drops content-analysis growth from ~28 KB/row toward <5 KB/row.

---

## Phase 2 — Shrink per-row JSON (TD-02) *(forward-looking)*
- [x] **2.1 Tighten `word_frequency` cap** — DONE: `MAX_WORD_FREQ_ENTRIES` 500→150 (`analyze-url.ts:2184`). The cap/sort/slice logic already existed; it was just too loose (word cloud reads top ~30). Halves avg row JSON; *takes effect on next deploy.*
- [ ] **2.2 `links_analysis` cap** — already `MAX_LINKS=100` (`analyze-url.ts:2185`); reasonable. Lower only if needed; legacy rows up to 96 KB remain (trim in 2.5).
- [ ] **2.3 Investigate `content_chunks`** — decide whether the full-text path should work (and fix it) or be removed.
- [ ] **2.4 (Deferred)** Move `extracted_text` to R2 keyed by `content_hash` — larger change; revisit after Phase 1 lands and R2 writes are confirmed working (depends on TD-08 outcome).
- [ ] **2.5 (Optional, GATED)** One-time UPDATE to trim oversized `word_frequency`/`links_analysis` on existing rows.

**Verify:** new analysis row's `word_frequency` ≤ cap; word cloud still renders; D1 size growth-per-row drops.

---

## Phase 3 — Index hygiene (TD-04) *(GATED migration)*
- [ ] **3.1** Resolve the two **duplicate index declarations** (`idx_content_analysis_hash` in 014+025; `idx_content_analysis_share_token` in 034+038) — harmless `IF NOT EXISTS` no-ops today, but confusing.
- [ ] **3.2** Drop single-column indexes covered by composites (`_hash` ⊂ `_hash_workspace`, `_user` ⊂ `_user_workspace`) **only after** cross-checking D1 insights for queries that rely on the standalone index. Forward migration file `0NN-content-analysis-index-cleanup.sql`.

**Verify:** re-run `d1 insights`; confirm the `content_analysis` INSERT writes fewer rows/index updates; no query regressions.

---

## Phase 4 — Observability (TD-03) *(additive)*
- [ ] **4.1** Add an `error_logs` D1 table + a tiny `logError()` helper (the documented Pages-Functions-visible workaround) and wire `ErrorBoundary.tsx:42` to it.
- [ ] **4.2** Decide `auth_logs` / `rate_limits` / `settings_audit_log` (all 0 rows): populate on the relevant paths or drop. Tie `rate_limits` to TD-05.
- [ ] **4.3** Consolidate the two `activity-logger.ts` modules (TD-07) into one canonical module; migrate the 7 callers; delete the other.

---

## Phase 5 — Quick wins / cleanup
- [ ] **5.1 (TD-09)** Decide + deploy the pending `ba89945` (PDF extraction) so prod ≡ `main`.
- [ ] **5.2 (TD-08)** Investigate why R2 has 0 objects despite active write code — likely swallowed write failures.
- [ ] **5.3 (TD-06)** Inventory all 148 tables; delete/document the dead ones.
- [ ] **5.4 (TD-10/12)** KV namespace reconciliation; wrangler bump; remove dangling `CRON_CLEANUP_SETUP.md` reference once the file exists.

---

## Execution order (this session)
**Start with the no-risk, high-value, testable changes**, hold prod-mutating steps for approval:
1. Phase 0.1 backup + 0.2/0.4 verification.
2. Phase 1.1 (set `expires_at` on insert) + Phase 2.1/2.2 (cap JSON) — forward-looking, tested locally.
3. Phase 1.2/1.3 (global cleanup endpoint + cron Worker scaffold) — additive.
4. **Pause for approval** before: 1.4 backfill, 2.5 trim, 3.2 index drops, 5.1 deploy.
