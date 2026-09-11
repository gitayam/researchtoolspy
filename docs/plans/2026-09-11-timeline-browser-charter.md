# Timeline browser persistence continuation

Baseline: 0bd8ea70bdc542dade2603e4fd446deb632c26a0, freshly fetched and equal on
canonical origin/main and mirror gitlab/main. Shared integration worktree remains
researchtoolspy-timeline-foundation-20260911; primary dirty checkout is preserved.

Outcome: authenticated humans can save and reopen the complete browser timeline
workspace, including narrative, original extraction and stable event IDs. Audience:
registered human in a private workspace, /dashboard/tools/timeline. Guests retain
local drafts/export. Explicit saves, honest pending/error states, stale-head conflict
protection, no silent overwrite or partial/lossy saves. This is a user-visible
TL-03 consumer slice; external service scopes and other checkpoints remain pending.

Recon gate before implementation: shipped storage only accepts event-candidate.v1.
Determine a forward-compatible immutable snapshot representation and safe migration;
never edit applied0011 or mislabel a workspace as an event candidate. Freeze the
schema/API/UI seams after inspecting the existing constraints and lifecycle.

Owner owns integration, client/UI, charter, verification, Git and publication.
Native dependency_review is read-only storage/migration design reviewer; native
validator_review is independent read-only acceptance reviewer. Workers share files,
do not commit, execute candidate code on host or touch production. Provider tasks
will receive exact file ownership after contracts are fixed. External authenticated
model lanes remain unqualified and are not used.

Verification: real Miniflare D1 migrations and compiled routes, browser save/reopen
and failures in Chromium/mobile Safari, existing node scripts/verify-timeline.mjs
inside the qualified credential-free no-network container. Preserve original draft
and state on network failure, permissions loss, conflict or malformed responses.

User authorization continues: clean fast-forward pushes to both main refs and Pages
deployment after independent exact-SHA review and sandbox verification. Necessary
reviewed additive migrations require production-schema rehearsal, restricted backup
and managed apply. Never deploy unrelated Workers or dirty primary changes. Publisher
uses the verified prebuilt package without executing candidate scripts. Stop on
remote divergence, unsafe migration or failed real-runtime acceptance.
