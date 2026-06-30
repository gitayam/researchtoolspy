# Roadmap loop state

Durable state for the `/roadmap-step` loop. The stop condition (2 consecutive no-change
iterations) reads `no_change_streak` from here, so it survives session death / `/clear`.

iteration: 63
no_change_streak: 0
last_item: #20 — entity-edit type field read-only in edit mode
last_result: SHIPPED (v0.22.58, 3858ae71b). EntityCreateForm renderSelect() extended with disabled/hint. All 5 type selectors pass disabled: isEdit. Visual opacity+cursor-not-allowed, aria-disabled, helper hint "Type cannot be changed after creation." cop-entity-type-readonly.spec.ts 18/18. Deployed (HTTP 200), pushed origin (gitlab 502).

>>> PREV ITER 62: E-11 (v0.22.57, 08c88862e) — journalist drop-spot mode, full anonymity (D-E4). <<<

>>> 🎯 D-E8 COMPLETE (iters 50–55, v0.22.47–.51) — evidence_items is the SOLE canonical evidence store. <<<

>>> 🎯 E CAPABILITY LARGELY COMPLETE: E-1..E-11 shipped (22 units across v0.22.27–.57). Remaining E items: <<<
  (a) DECISION-GATED: E-7b/E-16 (entities→actors on promote, needs confidence threshold + dedup policy); E-6e (Turnstile keys → upload go-live); E-8 (needs E-6e)
  (b) E-11 depth: D-E5 (return codename), D-E6 (dedup), D-E7 (drop retention) — all DECISION-gated
  (c) E-13 DEFERRED (sync→async citation lib refactor, 8+ consumers — deliberate effort, not loop unit)

>>> LOOP RE-EVALUATION (§1 stop checks): <<<
Remaining AUTO backlog is now very thin:
  AUTO (no user decision needed):
    - COP-12 chunked console→logEvent sweep (130 console.error/58 files — noted as "do in ~10-file chunks"; needs user greenlight for a chunk)
    - #21 scrape apifyError discarded (scrape.ts ~:132, log via logEvent sink)
    - #18 COP error-path toasts (polish sweep — user-facing toasts on high-traffic COP failures)
    - #19 research/forms/list workspace authz (security: client-supplied workspaceId not server-validated; security-review route)
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
