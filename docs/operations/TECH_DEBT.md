# Technical Debt Backlog

> **Generated:** 2026-06-13 from a production logs + analytics review.
> **Data sources:** `wrangler d1 insights/info` (researchtoolspy-prod), `wrangler pages deployment list`, `wrangler r2/kv` inventory, and a codebase sweep of `functions/` + `src/`.
> **Scope of traffic sampled:** very low (115 reads / 72 writes per 24h) — analytics reflect a low-volume window; growth-rate items below matter more than latency items.

This is a living backlog. Each item has a **severity** (impact if left), rough **effort**, and the **evidence** that surfaced it. Work top-down within each priority band.

---

## P0 — Unbounded growth / silent in production

### TD-01 · `content_analysis` retention — ✅ RESOLVED (2026-06-13) `HIGH`
> Fixed & rolled out: `expires_at` set on insert, `saved_links` gap closed, cascade-safe global cleanup endpoint + daily cron Worker armed, legacy rows backfilled, 6,164 ephemeral rows purged. **D1 225 MB → 17.7 MB.** Original analysis below.

- **Evidence:** 6,369 rows; **all 6,369 have `expires_at = NULL`** (0 populated). Oldest row `2025-10-11`, newest `2026-06-13` — nothing has ever been purged. An `idx_content_analysis_expires` index and `functions/api/content-intelligence/cleanup.ts` exist, but **no cron is wired** (`wrangler.toml` only notes "Cron triggers for Pages must be configured via Dashboard"; no `[triggers]`/scheduled handler in code).
- **Impact:** D1 is already **225 MB / 10 GB cap** and climbing one row per analysis. The cleanup design is decorative — `expires_at` is never set on insert, so even if the cron ran it would delete nothing.
- **Fix:** ✅ (a) `expires_at` now set on insert (+7d for unsaved) and ✅ the `saved_links` auto-analyze gap is closed so referenced analyses are kept (`analyze-url.ts`, `saved-links.ts`, pending deploy); remaining: (b) wire a real scheduled trigger via a separate cron Worker + a **cascade-safe** global cleanup endpoint (the existing `cleanup.ts` is user-scoped and its guard is unsafe — see the remediation plan), (c) GATED backfill of `expires_at`. **Effort: M.** See [remediation plan](../plans/2026-06-13-tech-debt-remediation.md).

### TD-02 · Oversized per-row JSON columns dominate the database `HIGH`
- **Evidence:** in `content_analysis` alone — `word_frequency` = **66.8 MB**, `extracted_text` = **61.8 MB**, `links_analysis` = **33.1 MB**, `summary` = 8.7 MB, `entities` = 4.8 MB. `word_frequency` is **larger than the article text itself** (avg ext text ~9.7 KB/row). These ~175 MB are the bulk of the 225 MB database.
- **Nuance (verified):** write-time caps **already exist** (`analyze-url.ts:2182-2186`: `MAX_WORD_FREQ_ENTRIES=500`, `MAX_LINKS=100`, `MAX_TEXT_SIZE=100KB`, `MAX_CLAIMS=50`) but were only added recently (commit `b55c72f`). The bloat is (a) the cap being **too loose** — the word cloud reads only the top ~30 single words yet 500 are stored — and (b) ~47 legacy rows predating the caps (max `word_frequency` = 912 KB).
- **Fix:** ✅ tightened `MAX_WORD_FREQ_ENTRIES` 500→150 (`analyze-url.ts`, pending deploy); remaining: trim the 47 legacy rows (GATED UPDATE), consider moving `extracted_text` to R2 keyed by `content_hash`. **Effort: S done / M remaining.**

### TD-03 · Backend observability is effectively blind `HIGH`
- **Evidence:**
  - **637 `console.error` + 60 `console.warn` + 9 `console.log` in `functions/`**, but the structured logger (`functions/utils/logger.ts`) is imported by **~1 backend file** — the backend logs almost entirely via raw `console.*`.
  - Per Cloudflare's own limitation, **`console.log` in Pages Functions is NOT visible in `wrangler pages deployment tail`** — so those 637 error calls produce logs nobody can read.
  - `auth_logs` table = **0 rows**, `rate_limits` table = **0 rows**, `settings_audit_log` = 0 rows — security/audit tables that record nothing.
  - `src/components/ErrorBoundary.tsx:42` → `// TODO: Send to error tracking service (Sentry, etc.)` — never wired. No error tracking anywhere.
- **Impact:** When something breaks in prod, there is no usable trail — no visible function logs, no error aggregation, empty audit tables.
- **Fix:** ✅ (a) DONE (2026-06-13) — `event_logs` D1 sink (migration 105) + `logEvent()` helper; the AI gateway now records model refusals + gateway-fallback failures; read via secret-guarded `GET /api/cron/event-logs` (with a last-24h summary); pruned >30 days by the daily cron. Remaining: (b) populate `auth_logs`/`settings_audit_log` or drop them; (c) wire `ErrorBoundary.tsx` to a `/api/client-error` endpoint that calls `logEvent` (closes the Sentry TODO). **Effort: S remaining.**

---

## P1 — Cost, correctness, and security hygiene

### TD-04 · `content_analysis` is over-indexed (write amplification) `MED`
- **Evidence:** **14 indexes** on one table (`..._user`, `..._url`, `..._hash`, `..._link`, `..._workspace`, `..._user_workspace`, `..._hash_workspace`, `..._bookmark`, `..._expires`, `..._share_token`, `..._investigation`, `..._has_links`, …). D1 insights show the insert writing **avg 12 rows per INSERT** at **4.3 ms avg** (`queryEfficiency: 0`) — every insert fans out to ~14 index updates.
- **Impact:** slowest write in the system and the most-run write (170×). Several indexes overlap (`_hash` vs `_hash_workspace`, `_user` vs `_user_workspace`).
- **Fix:** drop redundant single-column indexes covered by composite ones; keep only indexes backed by real query patterns (cross-check against D1 insights). **Effort: S.**

### TD-05 · Rate limiting — ✅ AI endpoints now throttled (2026-06-13) `MED`
- **Was:** `checkRateLimit` defined but called nowhere, and `RATE_LIMIT` KV never bound → every AI endpoint unthrottled (OpenAI cost/abuse exposure). The `rate_limits` D1 table is also dead (0 rows).
- **Fixed:** rate limiting enforced centrally in `ai-gateway.ts` (`enforceRateLimit`, reuses bound `CACHE` KV, fail-open): 100/min per user (when caller passes `metadata.user_id`) + 3000/hr global backstop; exceed → `RateLimitError` (callers degrade gracefully) + `event_logs` record.
- **Remaining:** thread `metadata.user_id` through more callers so per-user (not just global) applies everywhere; throttle the non-AI scrapers (Apify) separately; drop the dead `rate_limits` D1 table. **Effort: S.**

### TD-06 · Schema sprawl — ~12+ empty/dead tables out of 148 `MED`
- **Evidence:** 148 user tables; confirmed empty: `content_chunks`, `content_intelligence`, `content_entities`, `research_activity`, `investigation_activity_log`, `social_media_posts`, `settings_audit_log`, `comments`, `user_notifications`, `guest_sessions` (and more likely across the 148). Features scaffolded via migrations, never populated.
- **Impact:** every empty table is migration surface area, schema-doc noise, and ambiguity about what's live. `content_chunks`/`content_intelligence`/`content_entities` being empty suggests a content-intelligence subsystem that was half-built.
- **Fix:** inventory all 148 tables by row count, then either delete the dead ones (with a migration) or document them as intentionally-future. **Effort: M** (mostly judgment).

### TD-07 · Duplicate `activity-logger` implementations `MED`
- **Evidence:** two competing modules — `functions/utils/activity-logger.ts` (161 LOC) and `functions/api/_shared/activity-logger.ts` (109 LOC).
- **Impact:** unclear which is canonical; activity logging behaviour can diverge by endpoint. `activity_feed` has only 47 rows / `cop_activity` 31 — sparse and possibly inconsistent.
- **Fix:** consolidate to one logger module, migrate callers, delete the other. **Effort: S–M.**

---

## P2 — Process and configuration

### TD-08 · R2 `UPLOADS` writes are likely silently failing `MED`
- **Evidence:** `researchtoolspy-uploads` → `object_count: 0`, `bucket_size: 0 B`, created 2025-10-01 — **yet the binding IS used**: `feedback/submit.ts:58` (`env.UPLOADS.put` for screenshots) and `twitter-image-proxy.ts:105` (`env.UPLOADS.put` for media archival). Both writes are **non-blocking with swallowed failures** (`waitUntil`/try-catch).
- **Impact:** 0 objects despite active write code means either these features are never exercised, or — more likely given the swallowed errors — **the writes are failing silently** (e.g. missing Dashboard R2 binding on the Pages project, per the R2 lesson that `wrangler.toml` alone is insufficient for Pages).
- **Fix:** verify the R2 binding is configured in the CF Dashboard (Pages → Settings → Functions), then exercise a feedback-screenshot upload and confirm an object lands. **Effort: S** (investigation first).

### TD-09 · Production is 1 commit behind `main` `MED`
- **Evidence:** last prod deploy = `623e5df` (~1 month ago); `HEAD = ba89945 feat(content-intel): in-Worker PDF extraction via unpdf` is **undeployed**.
- **Impact:** a shipped-to-`main` feature (PDF extraction) isn't live; deploy cadence has lagged ~1 month.
- **Fix:** decide whether `ba89945` is ready, then deploy; consider CI-on-merge so `main` and prod don't drift. **Effort: S.**

### TD-10 · Account-level KV namespace sprawl `LOW`
- **Evidence:** the account holds namespaces from unrelated projects (`career-board-*`, `BLOG_*`) alongside this project's `SESSIONS`/`CACHE`/`AI_CONFIG`. Also present: `ANONYMOUS_SESSIONS`, `AUTH_KV` — not all bound in `wrangler.toml`.
- **Impact:** hard to tell which namespaces this project actually uses; risk of orphaned/duplicate session stores.
- **Fix:** reconcile `wrangler.toml` bindings against the live namespace list; document or delete orphans. **Effort: S.**

### TD-11 · Unimplemented endpoints behind TODOs `LOW`
- **Evidence:** `src/components/settings/WorkspaceManagement.tsx:125` (invite-by-hash), `src/components/frameworks/BehaviorSearchDialog.tsx:48` (`/api/behaviors/search`), `ClaimAnalysisDisplay.tsx:556` (deep deception analysis), plus several `// TODO: toast error` in `cross-table/*` where errors are silently swallowed in the UI.
- **Impact:** dead buttons / silent failures in the UI. ~26 TODO/FIXME total (5 in `functions/`, 21 in `src/`).
- **Fix:** triage — implement, hide the affected controls, or surface the error. **Effort: varies.**

### TD-12 · Minor / watch-list `LOW`
- **D1 read replication disabled** — fine at current traffic; revisit if read volume grows.
- **wrangler 4.81.1** in use vs 4.100.0 available — schedule a bump.
- **D1 compound-SELECT term cap is very low** (a batched 8-table `UNION ALL COUNT` failed with `too many terms in compound SELECT [7500]`) — keep batch/diagnostic queries small; relevant for any future reporting queries.

---

## Suggested order of attack
1. **TD-01 + TD-02** together (retention + JSON bloat) — same code path (content-intelligence save), biggest growth lever.
2. **TD-03** (observability) — you're flying blind; do this before the next big change so you can see its effect.
3. **TD-04** (drop redundant indexes) — quick win, compounds with TD-01/02.
4. **TD-09** (deploy the pending commit) — quick, unblocks the PDF feature.
5. Then **TD-05 → TD-08 → TD-06/07** as capacity allows; **P2 LOW** items as cleanup.
