# Timeline stage release

User authorization: on 2026-09-11 the user explicitly requested continuing work,
clean pushes to main, and deployment as stages finish. This supersedes earlier
local-only publication limits for these reviewed timeline stages. It does not
include unrelated dirty primary work or other Worker deployments.

Release source: reviewed continuation b2570e1c1c29b24d81f1c86fd7150351f40de739 plus
migration rollback documentation and release verification. GitHub origin/main is
canonical; GitLab gitlab/main is the mirror. Push only fast-forward accepted
HEAD:refs/heads/main to each; fetch and prove equality. Preserve primary checkout.

Audience and scope: release TL-00 reusable contracts, TL-02 local narrative UI,
and the verified human-only TL-03 API slice. External service scopes and durable
browser saving remain pending. Deploy Pages project researchtoolspy and necessary
additive D1 managed migration only, after production-schema rehearsal and backup.

Owner runs trusted Wrangler read-only inventory/publishing and Git operations.
Candidate builds/tests/bundling run only in the qualified no-network Linux
container. Independent reviewer checks source, release package and release gates.
Do not run deploy.sh on the authenticated controller because it executes candidate
build/test scripts. Preserve its substantive schema, secret-name, backup, migration,
asset, environment and post-release checks through the split release process.

Required sequence: inventory actual production migration tracker/schema and secret
names; add migration-specific rollback notes; rehearse pending actual SQL against
a schema-only production export in disposable D1; run release candidate checks;
prebundle Pages functions and verify compiled routing locally; hash artifact;
fast-forward both main refs; create restricted backup and Time Travel record;
apply only reviewed pending managed files via Wrangler; compare all affected tables,
columns, foreign keys and triggers; publish the prebuilt package from a staging cwd
without functions/ source using --no-bundle, main branch and exact commit metadata;
verify deployment/source SHA, production page/static assets and non-mutating API
checks. No production write probes or auth values in logs. Stop on mismatched
remote history, migration inventory, missing secrets, or failed rehearsal.

Private source-bearing artifacts and database backups stay in a mode-700 local
release directory. Commit only redacted hashes, IDs, command/result summaries and
distinct canonical-landed, mirror-confirmed, migrated and deployed states. Roll
application back to the recorded prior deployment if smoke verification fails;
do not restore the whole database automatically.
