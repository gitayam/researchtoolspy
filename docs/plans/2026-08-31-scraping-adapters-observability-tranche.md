# Scraping Adapters and Observability Tranche Charter

**Status:** implementation integrated and locally verified; Milestones 0 and 1 remain in progress

**Delivery class:** integration-enabling

**Canonical remote/ref:** `origin/main`

**Fresh canonical SHA:** `e8c41a1a4c0078f03bf2c3cdbd2685c1ec273df7`
**Recorded:** 2026-08-31, America/New_York

## Outcome

Add the bounded binary, HEAD, PDF, image, and document-fetch contracts needed to migrate unsafe direct callers, plus a versioned privacy-safe scrape-observability contract that can prove exactly-once terminal accounting before an Analytics Engine binding is activated. After the shared adapter joins, migrate a bounded set of direct callers while preserving successful public response envelopes.

## Delivery delta

This tranche does not add a user-visible feature. It reduces the number of caller-controlled raw fetch paths, makes size/type/signature failures deterministic, and creates an executable telemetry seam for the next route-adoption tranche. A policy-invalid upstream error body can intentionally become a generic safe failure instead of preserving that upstream body's status-specific message.

## Non-goals

- Production deployment, remote D1 mutation, secret changes, Analytics Engine dataset creation, or Cloudflare Gateway changes.
- Claiming that DNS validation pins the address used by Cloudflare `fetch()`.
- Enabling dynamic Browser Run navigation, Container scraping, Scrapling, or new paid-provider behavior.
- Replacing existing endpoint response envelopes with the internal scrape contract.
- Repository-wide lint cleanup or unrelated dependency upgrades.

## Baseline and operational invariants

- `HEAD`, `origin/main`, and their merge base are `e8c41a1a4c0078f03bf2c3cdbd2685c1ec273df7`; divergence is `0/0`.
- `gitlab/main` is `3f0eba98e33f2e2077367acbd553309eceedccbd`, exactly 11 commits behind the canonical branch and 0 ahead.
- The primary checkout is clean.
- Root dependency authority is `package-lock.json`; Container authority is `containers/package-lock.json`.
- Latest managed migration is `0006_scraping_auth_idempotency.sql`, SHA-256 `0332af69ddf01cbf46a166a0e4c006592c6af1badd32bd0e4189ceba53b868e4`.
- Baseline `npm run type-check` and `npm run build` pass. The build retains the existing large-chunk warning.
- The previous full-lint baseline has 2,882 findings; this tranche uses focused lint plus regression comparison and does not expand lint scope.

## Falsifiable tranche hypotheses

### H-ADAPTER-1

For each migrated caller, every caller-derived request and redirect is rejected before the mocked transport when DNS answers are private/mixed; text stops at 2 MiB, PDFs at 10 MiB with MIME and `%PDF-` signature agreement, images at 8 MiB with exact-host and MIME/signature agreement, and HEAD never consumes a body.

The hypothesis is false if any behavioral test reaches transport after a denied address/redirect, accepts an oversized or mismatched body, follows an image redirect outside its exact allowlist, leaks authentication to an external origin, or changes a public success/error envelope.

### H-OBS-1

Every scrape execution accepted by the observation wrapper emits exactly one terminal metric, and a missing or failing metric sink changes neither its result nor its thrown error.

The hypothesis is false if a success/failure/throw/timeout branch emits zero or multiple terminal metrics, an emitted metric contains a forbidden raw identifier or free-form payload, or sink failure changes execution behavior.

### H-EGRESS-1 (blocked experiment)

If a service-only scraping Worker uses Workers VPC and an account-scoped Gateway L4 policy, no rebinding, redirect, mixed A/AAAA, or IPv6 case can connect to a non-global address, and Gateway logs contain the actual denied destination.

This cannot be accepted from repository tests. It requires authorized account configuration, a private canary, and live Gateway evidence. Until then, the application-layer DNS check remains defense in depth and dynamic Browser Run navigation remains blocked.

## Frozen seam contracts

- `safeFetchText` remains externally compatible.
- Text, bytes, and HEAD modes share one URL, DNS, redirect, deadline, header, and cleanup transport loop.
- Exact-host constraints apply to the initial URL and every redirect.
- Content adapters reject MIME/signature disagreement using the existing normalized safe-fetch error vocabulary.
- Internal `scrape.v1` result contracts do not replace product endpoint envelopes.
- Metrics are closed, versioned objects with enums, opaque keyed identifiers, and finite numeric measures only; raw URLs, hosts, query strings, response bodies, prompts, cookies, tokens, IPs, user agents, user IDs, workspace IDs, and free-form errors/messages are structurally excluded.
- Telemetry is non-blocking and terminal emission is state-machine-owned, not copied into individual return branches.
- No Analytics Engine binding is added until a separate authorized configuration/deployment gate supplies the dataset and dedicated HMAC key.

## Semantic dependency and ownership

```text
shared safe-content foundation ----> direct caller migrations ----> inventory/type-check join
observability contracts -------------------------------------------> route adoption (later tranche)
Workers VPC/Gateway live proof ------------------------------------> enforcing egress activation (blocked)
```

| Workstream | Owned paths | Prohibited overlap | Join order |
|---|---|---|---:|
| Safe-content foundation | `_shared/safe-fetch.ts`, new `_shared/safe-content.ts`, safe-fetch/content tests | routes, inventory, roadmap, config | 1 |
| Observability contract | new `_shared/scrape-contract.ts`, new `_shared/scrape-metrics.ts`, observability tests | routes, Wrangler, migrations, event logs, roadmap | 2 |
| Direct caller migration | assigned route files and route-specific tests after foundation joins | shared adapters, observability files, inventory | 3 |
| Integration | inventory, focused tsconfig, roadmap/charter, seam fixes, final verification | unrelated application files | final |

High-conflict seams are `safe-fetch.ts`, `analyze-url.ts`, `saved-links.ts`, `tsconfig.scraping-functions.json`, and the fetch inventory. They remain single-owner or integrator-only.

## Observable exit gates

1. Behavioral tests cover private/mixed DNS, unsafe redirect, exact-host redirect escape, body limits, MIME/signature mismatch, HEAD cleanup, and public controls.
2. At least INV-002, INV-004, and INV-025 use the shared bounded adapters while preserving their documented API contracts.
3. Observability tests prove privacy constraints and exactly-once terminal emission across success, normalized failure, thrown error, duplicate finish, and failing sink paths.
4. The inventory and its static synchronization test describe only the migration actually completed.
5. `npm run type-check`, `npm run build`, focused Playwright, focused ESLint, and `git diff --check` pass; any baseline regression is called out explicitly.
6. An independent read-only review finds no unresolved P0/P1 issue in the integrated diff.
7. No deploy, remote migration, secret change, Analytics Engine dataset creation, Gateway mutation, or dynamic Browser Run activation occurs.

## Run ledger

| Event | Evidence |
|---|---|
| Fresh canonical fetch | `origin/main` fetched/pruned at `e8c41a1a4c0078f03bf2c3cdbd2685c1ec273df7`; local divergence `0/0` |
| Mirror fetch | `gitlab/main` fetched/pruned; canonical is 11 ahead/0 behind |
| Primary checkout | clean `main`; reserved for user work |
| Integration worktree | `codex/scraping-adapters-observability-20260831` at `/Users/sac/Git/researchtoolspy-wt-scraping-adapters-observability` |
| Safe-content worktree | `codex/scraping-safe-content-20260831` at `/Users/sac/Git/researchtoolspy-wt-safe-content` |
| Observability worktree | `codex/scraping-observability-contract-20260831` at `/Users/sac/Git/researchtoolspy-wt-observability` |
| Baseline type-check | `npm run type-check` passed |
| Baseline build | `npm run build` passed with existing large-chunk warning |
| Integration install | `npm ci` passed; npm reported the existing 16 audit findings (1 low, 4 moderate, 11 high) |
| Joined provider commits | safe content `50a0714fa`; observability `a664fba85`; streaming correction `7cc89bbe8`; tools `9a8b67b5f`; PDF `d0cf167c3`; observability hardening `4744545fa` |
| Integrated focused tests | final suite passed 67/67 on Chromium with one worker |
| Integrated type-check | `npm run type-check` passed, with the new shared contracts added as explicit scraping-surface roots |
| Integrated build | `npm run build` passed with the existing large-chunk warning |
| Focused lint | shared adapters/contracts and all new focused tests passed ESLint; migrated legacy route files add no findings over their pre-existing baseline |
| Independent review | final read-only review found no P0/P1 issue; two P2 contract edges were either hardened (request/result correlation) or documented (policy-invalid upstream error envelope) |
| External mutation | none authorized or performed |

## Close decision

The tranche is accepted as an integration-enabling increment. Local evidence supports H-ADAPTER-1 for the migrated paths and H-OBS-1 for the add-only observation wrapper. It does not support H-EGRESS-1, production terminal coverage, or a claim that the scraping system is globally safe.

Four inventory entries now use bounded shared adapters: INV-001, INV-002, INV-004, and INV-025. The remaining 22 direct, delegated, renderer, provider, archive, social, or media paths retain their documented migration status.

## Remaining blockers and next join gates

1. Run the authorized Workers VPC/Gateway rebinding and private-canary experiment. Do not activate an egress service or dynamic Browser Run without destination-IP enforcement evidence.
2. Migrate the high-value content-intelligence paths (INV-008 through INV-010), including authenticated same-origin delegation, exact image hosts, and removal of the three focused type-check exclusions.
3. Replace raw URL extraction logs with dedicated-key HMAC identifiers before connecting production scrape metrics.
4. Add the `SCRAPE_ANALYTICS` binding and dedicated telemetry HMAC secret only in an authorized configuration/deployment tranche; then adopt `observeScrape` route by route and measure terminal coverage.
5. Preserve the safe fail-closed behavior where a non-2xx upstream body violates MIME or size policy; decide whether product adapters should normalize those exceptional failures to their historical 400 envelope before broad route consolidation.
