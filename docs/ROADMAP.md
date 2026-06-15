# ResearchTools.net — Roadmap

**Last updated:** 2026-06-15 · **Current release:** `v0.22.0` · **Prod:** [researchtools.net](https://researchtools.net) (Cloudflare Pages + D1)

This is the living roadmap. Detailed findings live in [`TECH_DEBT.md`](operations/TECH_DEBT.md), the AI safety review in [`AI_REFUSAL_REVIEW.md`](operations/AI_REFUSAL_REVIEW.md), and dated plans in [`plans/`](plans/). Status legend: ✅ done · 🔄 partial · ⬜ planned.

---

## Recently shipped

### v0.22.0 — AI safety, observability & cost control (2026-06-13→15)
- ✅ **AI content-policy refusal handling** — `detectRefusal()` in the gateway; callers return a clean `{declined}` instead of opaque 5xx; defensive analyst framing on intel prompts.
- ✅ **De-biased claim credibility scoring** — removed hardcoded political-affiliation priors in `extract-claim-entities`; now stake/independence/proximity-based.
- ✅ **Single AI egress point** — all ~40 callers routed through `callOpenAIViaGateway`; only the gateway calls OpenAI directly (caching, fallback, org-header forwarding, refusal detection inherited everywhere).
- ✅ **Production observability** — `event_logs` D1 sink (migration 105) + `logEvent()`; backend errors, AI refusals, and **client crashes** (ErrorBoundary → `/api/client-error`) are now visible via secret-guarded `GET /api/cron/event-logs`; pruned >30 days by the daily cron.
- ✅ **Dependency hygiene** — vulns **17 → 3** (within-range updates + `uuid` override for the exceljs transitive). Remaining 3 are build-tooling-only.
- 🔄 **AI rate limiting** — KV-backed limiters (middleware per-user + gateway global) replace an isolate-local in-memory Map. Protects against *sustained* abuse; **not burst-accurate** (KV eventual consistency) — see Now/#1.

### v0.21.0 — Content-analysis retention (2026-06-13)
- ✅ **Bounded D1 growth** — `expires_at` on insert, cascade-safe global cleanup endpoint, daily cron worker (`researchtoolspy-cron`), legacy backfill. **D1 225 MB → ~18 MB.**

---

## Now (highest priority)

1. **Burst-accurate rate limiting** `TD-05` — replace the KV limiters with the **Cloudflare Rate Limiting binding** (`[[ratelimit]]`, strongly consistent) or a **Durable Object** counter. KV is eventually consistent so sub-minute bursts slip through today. *Deploy-gated attempt; revert cleanly if the binding isn't supported on Pages Functions.*
2. **Auth resilience** `NEW (found 2026-06-15)` — `getUserFromRequest` wraps its `SELECT`/auto-provision `INSERT` in a try/catch that returns `null` → **a transient D1 error logs the user out (401)** rather than retrying or returning 503. Observed intermittently under load. Make it distinguish "no such user" (401) from "DB error" (503/retry); consider widening the guest `username`/`email` derivation (currently first 8 hash chars → UNIQUE-collision risk).

### ✅ Done — Tier-1 access gating (2026-06-15)
Recorded, versioned **sensitive-use consent** gate shipped: `user_consents` table (migration 106) + `requireConsent()` 403 + `/api/user/consent` + frontend `fetchWithConsent` dialog. Gates `ai/generate`, `summarize-entity`, `relationships/infer-type`. *Code/build verified + deployed; runtime gate-fire verification was blocked by the intermittent auth issue above (hits untouched endpoints too), so confirm once #2 is addressed.* Follow-up: extend `requireConsent` to PimEyes/face-match + CARVER/COG vuln generation.

## Next

3. **Security/audit log decision** `TD-03b` — populate `auth_logs` / `settings_audit_log` (or route them to `event_logs` and drop the dead tables).
4. **Per-user limiting everywhere** `TD-05` — thread `metadata.user_id` through more gateway callers so per-user (not just global) applies; throttle the Apify scrapers separately.
5. **Schema sprawl cleanup** `TD-06` — inventory the 149 tables, drop the confirmed-dead ones (incl. the unused `rate_limits` table).

## Later

6. **vite 8 / rolldown migration** — clears the 3 remaining build-tooling vulns (esbuild/vite/wrangler). Real migration: `manualChunks` → `advancedChunks` + config types + **browser QA** (maplibre worker risk). Branch-only, when rolldown-vite matures.
7. **Index hygiene** `TD-04` — drop redundant `content_analysis` indexes (write amplification).
8. **Logger consolidation** `TD-07` — merge the two `activity-logger` modules.
9. **R2 uploads verification** `TD-08` — confirm `env.UPLOADS` writes land (0 objects despite active write code = likely silent failures).
10. **JSON column trimming** `TD-02` — trim legacy oversized rows; consider moving `extracted_text` to R2.

---

## Known limitations (accept or fix above)
- **Rate limiting is sustained-abuse only** (KV eventual consistency) — burst-accurate fix is Now/#1.
- **AI endpoints are open to any hash** (`getUserFromRequest` auto-provisions) — mitigated by rate limiting; proper fix is Now/#2.
- **3 build-tooling vulns** persist (not shipped to the runtime Worker) pending the vite 8 migration (Later/#6).

## Operational reference
- **Deploy:** `./deploy.sh` (full, runs migrations) or `./deploy.sh --skip-migrate`. Mirror to both remotes: `git push origin main && git push gitlab main`.
- **Check prod logs:** `GET /api/cron/event-logs` with `X-Cron-Secret` (errors/refusals/rate-limits + 24h summary). Pages Function `console.*` is NOT visible in `wrangler tail` — use the sink.
- **D1 health:** `wrangler d1 info researchtoolspy-prod` (size bounded by the daily cron).
- **Cron:** `researchtoolspy-cron` Worker, daily 04:00 UTC — content retention + `event_logs` pruning. Setup: [`CRON_CLEANUP_SETUP.md`](operations/CRON_CLEANUP_SETUP.md).
