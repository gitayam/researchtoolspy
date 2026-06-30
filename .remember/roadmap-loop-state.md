# Roadmap loop state

Durable state for the `/roadmap-step` loop. The stop condition (2 consecutive no-change
iterations) reads `no_change_streak` from here, so it survives session death / `/clear`.

iteration: 73
no_change_streak: 0
last_item: COP-12 chunk 3 — console.error → logEvent in all layers/* handlers
last_result: SHIPPED (v0.22.68, ff8b30de8). 13 console.error replaced across 10 layers/* files. Running total: 65 of ~130 replaced. Prod HTTP 401 live.

>>> COP-12 progress: chunk 4 BUILDING (alerts/task-templates/poo-estimates/playbooks-rules/assets/task-deps/rfis-answers/playbooks-[pbId]/evidence-tags/rfis-[rfiId]) <<<

Remaining AUTO items:
  AUTO:
    - COP-12 chunk 4 (in flight) — ~35 calls in 10 files
    - COP-12 chunk 5 (final) — ~22 calls in 17 files (remaining after chunk 4)
    - 58 referenced-empty tables sweep (TD-06 follow-up)
  DECISION-GATED:
    - E-6e: Turnstile site key
    - E-7b/E-16: entity extraction threshold + dedup policy
    - COP-4: evidence↔persona data model
    - Deception AI server-side move
    - COM-B canon
    - F-1..F-10 OSINT tooling
