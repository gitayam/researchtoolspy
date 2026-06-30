# Roadmap loop state

Durable state for the `/roadmap-step` loop. The stop condition (2 consecutive no-change
iterations) reads `no_change_streak` from here, so it survives session death / `/clear`.

iteration: 75
no_change_streak: 0
last_item: COP-12 COMPLETE — all 5 chunks done, zero console.error in functions/api/cop/
last_result: SHIPPED (v0.22.70, ce26fd812). 21 final calls replaced. Total: ~121 across 57 files. Whole-COP sweep test confirms zero remaining. Prod HTTP 401 live.

>>> LOOP RE-EVALUATION (§1 stop checks): <<<
Remaining AUTO items:
  AUTO:
    - 58 referenced-empty tables sweep (TD-06 follow-up) — scope needed before running;
      incomplete features (cop_playbooks, social_media_jobs, investigation_*, comments, etc.)
      — activate or remove dead endpoints. Needs endpoint audit before loop unit.
  DECISION-GATED:
    - E-6e: Turnstile site key (prerequisite for file upload in forms)
    - E-7b/E-16: entity extraction threshold + dedup policy
    - COP-4: evidence↔persona data model
    - Deception AI server-side move
    - COM-B canon
    - F-1..F-10 OSINT tooling
    - COP-5b/5c: persona-to-actor, playbook editor

ASSESSMENT: Only one meaningful AUTO item remains (58-table sweep), and it needs
scoping before it can be an unattended loop unit. Most remaining items are DECISION-GATED.
The §1 stop check for "backlog empty" is approaching — the loop should STOP or surface
the 58-table sweep for scoping, then stop.
