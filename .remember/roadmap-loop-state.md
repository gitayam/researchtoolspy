# Roadmap loop state

Durable state for the `/roadmap-step` loop. The stop condition (2 consecutive no-change
iterations) reads `no_change_streak` from here, so it survives session death / `/clear`.

iteration: 62
no_change_streak: 0
last_item: E-11 — journalist drop-spot mode (anonymous tip-line)
last_result: SHIPPED (v0.22.57, 08c88862e). Migration 112 (intent col on survey_drops, applied remote, verified). Separate drop-submit.ts endpoint (186 LOC) — zero header reads for IP/UA, Turnstile fail-open, always {ok:true/false}. Builder Survey/Drop toggle. PublicDropFormPage (/drop/:slugOrToken). e11-drop-spot.spec.ts 31/31 incl. privacy source-guards. Deployed (HTTP 200), pushed origin (gitlab 502).

D-E4 DECIDED: full anonymity — no IP hash, no user-agent, not even for rate-limiting. A blocked tip is worse than spam.

>>> PREV ITER 61: COP-5a (v0.22.56, 7916483d2) — "View Log" button on playbooks opens modal via CopPlaybookLog; fetchPlaybookLog injectable helper. <<<

>>> 🎯 D-E8 COMPLETE (iters 50–55, v0.22.47–.51) — evidence_items is the SOLE canonical evidence store. <<<

>>> 🎯 E CAPABILITY LARGELY COMPLETE: E-1..E-11 shipped (22 units across v0.22.27–.57). Remaining E items: <<<
  (a) DECISION-GATED: E-7b/E-16 (entities→actors on promote, needs confidence threshold + dedup policy); E-6e (Turnstile keys → upload go-live); E-8 (needs E-6e)
  (b) E-11 depth: D-E5 (return codename), D-E6 (dedup), D-E7 (drop retention) — all DECISION-gated
  (c) E-13 DEFERRED (sync→async citation lib refactor, 8+ consumers — deliberate effort, not loop unit)

>>> LOOP RE-EVALUATION (§1 stop checks): <<<
Now/Next actionable-unblocked backlog is thin. Remaining:
  AUTO (no user decision needed):
    - COP-12 chunked console→logEvent sweep (130 console.error/58 files — noted as "do in ~10-file chunks"; if user greenlights a chunk it's doable)
    - #17 window.open audit (auth-required /api/* exports via browser nav → must use fetch+Blob; COP-1 pattern)
    - #20 entity-edit type selector no-op (actors/sources PUT ignore `type` in UPDATE SET; make read-only or add to PUT)
  DECISION-GATED:
    - E-7b/E-16 (confidence threshold + dedup policy for entity extraction at promote)
    - E-6e (Turnstile keys — ops/dashboard action)
    - COP-4 (evidence↔persona data model — new table or JSON column?)
    - Deception AI server-side move (Now#2)
    - COM-B canon (Now#2)
    - F-1..F-10 OSINT tooling (D-F1/F2/F3 gating the most valuable ones)
  DEFERRED (large refactors):
    - E-13 (citation lib sync→async, 8+ consumers)
    - COP-12 (full 58-file sweep — do in named chunks per user request)

GATES: §0 pre-flight + wrangler pages functions build (functions/) + back up prod D1 before migrations. GITLAB DOWN since iter20 (origin/GitHub current).
