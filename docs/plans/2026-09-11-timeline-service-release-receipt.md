# Scoped timeline service release

TL-03 is released at [ResearchTools](https://researchtools.net/dashboard/tools/timeline): human APIs, browser save/reopen and scoped service access. `timeline.read` grants the four durable GET routes; `timeline.write` grants create and commit. Neither scope implies the other. Existing credentials and grants were preserved; operators can assign scopes using the [service contract](../api/COMMUNITY-INTEGRATIONS-API.md#durable-timeline-service-scopes-deployed).

Accepted/deployed source: `839a657ca44b0a3fe83ed8e809444a31e8cf53a2`. Both main refs were confirmed at that SHA before deployment. This receipt is a documentation-only follow-up, not another runtime build. The dirty primary checkout remains untouched.

## Acceptance

All five TypeScript checks, 97 API/contract tests, 54 Chromium/mobile-Safari checks, Vite build and Pages Functions compilation passed on the exact source. Rehearsal imported fresh production schema through 0012, applied 0013 plus tracker in one D1 batch, checked catalog preservation and exercised compiled human/service routes and static assets. No external outbound attempt occurred. The reviewer independently verified all 145 build/staging files and the runtime boundary.

Actual-D1 tests cover independent scopes/workspaces, malformed/disabled/revoked/expired/replaced credentials, current/next promotion, exact rotation retries, snapshots, and scope removal or fractional timestamps between preflight and mutation. Failed batches preserve every timeline row. Populated upgrades and injected rebuild failures preserve exact scope rows and historical state. Every service write starts with an exact-token SQL assertion; replays reauthorize before returning stored success. No credential or digest enters history.

## Production result

- Migration 0013 applied atomically; earlier migrations were unchanged. All 12 timeline/credential tables and 282 schema details match rehearsal. Existing scope rows and timeline counts are unchanged, all 23 baseline checks pass, and no rebuild backup remains.
- A restricted full backup and Time Travel record were captured; only redacted hashes are retained in this receipt.
- Deployment `3b8fd9ff-a400-4858-976b-b33f9315c315` serves [the accepted build](https://3b8fd9ff.researchtoolspy.pages.dev) on main. The publisher uploaded the verified prebuilt package with `--no-bundle`.
- Seventeen readonly checks passed on each deployment/production URL: HTML/assets and exact hashes, timeline authorization, conditional-write CORS, anonymous discovery and malformed service-token rejection. Required secret names remain present. No production authenticated content write or model call was used as a probe.

Package inventory SHA-256: `461a9d897e7a2098e04dcb92f4c59c5289a11242a3f1c41bf3efdd3193c0ab9b`. Full states, hashes, commands, migration and smoke evidence are in the [JSON receipt](./2026-09-11-timeline-service-release-receipt.json).

## Recovery and next work

The initial validator was stopped after a fixture finding; corrected focused tests passed, then timestamp parity was tightened before the complete successful run. A transient Time Travel metadata error succeeded on retry. The existing Vite chunk-size warning remains.

Rollback target: `5b0ac276-e52e-4436-9cf9-a4ba5a421a5c`. It supports human snapshots but cannot serve new service operations and rejects tokens containing new scopes. This release assigned no scopes. Preserve schema/history and prefer compatible application recovery; credential changes need separate authorization and database restoration is not automatic.

TL-01 and TL-04–TL-18 remain pending. The next ResearchTools slice is source assertions and evidence provenance; cross-product handoff retains its separate dependencies. Two disjoint providers plus an independent reviewer worked well for this tranche; retain bounded ownership and exact-source validation for the next slice.
