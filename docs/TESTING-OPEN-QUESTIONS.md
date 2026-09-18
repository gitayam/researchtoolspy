# Testing — what is settled, and what is still open

Written 2026-09-18, after the pass that took the suite from a reported "1694 passed, 0 failed"
(which was actually 65 failures, hidden by a bad grep) to 2089 passed with one known flake.

## Settled

- **The suite is green.** 2089 passed / 100 skipped / 1 failed on proxmox, 3 min 24 s. The
  one failure passes in isolation — see *Open, ranked* below.
- **Run it on proxmox**, via `~/.claude/scripts/remote-playwright.sh`. Not a preference: a
  contended laptop run of this same commit reported **402 failures that do not exist**.
- **Read results from the JSON reporter.** The line reporter's `N failed` line does not match
  the obvious greps; that is how 65 failures were once reported as zero.
- **`e2e:smoke` is blocking in CI** (`allow_failure: true` removed), runs on merge requests as
  well as main, uses an image matching the lockfile, and installs webkit as well as chromium.
- **mobile-safari runs only specs that open a browser** (40 of 212 files, detected by scanning
  for the `page`/`context`/`browser` fixtures). The other ~172 were re-running identical pure
  assertions under a phone profile.

## Open, ranked by what it would cost to be wrong

### 1. `behavior-timeline-editor.spec.ts:10` fails in the suite, passes alone

`[mobile-safari] › authors and saves advanced event fields in the canonical schema`. Fails in
every full run (uncapped, `--cpus=56`, `--cpus=32`); passes 4/4 in 27.7 s when run by itself.

Two candidate causes, and they need different fixes:
- **Order dependence** — another spec leaves state (localStorage, a draft, a route mock) that
  this one inherits. Test with `--repeat-each` and with a shuffled order.
- **Timing sensitivity** — it is simply slow enough to lose under parallel load.

Do not mark it `fixme` until it is classified. An order-dependent failure is a real bug in
either the spec or the code under test, and it is the kind that eventually bites in CI.

### 2. Nothing starts the API the dev server proxies to

`vite.config.ts` proxies `/api` → `localhost:8788`, but `playwright.config.ts` starts only the
two Vite servers. Every unmocked API call in a browser test therefore hits a dead proxy, and
a full run emits hundreds of `ECONNREFUSED 127.0.0.1:8788` lines.

Unknown, and worth knowing: **how many specs silently depend on that call failing fast?** A
spec that asserts an empty state may be passing because the request errored, not because the
code handles emptiness. Adding a third `webServer` for `wrangler pages dev` would change the
behaviour of those specs — which is the point, but it needs measuring before and after, not
assuming. Check first whether `wrangler pages dev` runs in the Playwright container at all
(it needs D1 bindings and outbound network).

### 3. The CI job has never run in its new form

Blocking, MR-triggered, v1.60 image, chromium + webkit. All four changed together and none has
executed. The first merge request will tell us; watch that pipeline specifically. Most likely
failure: the job's own 45 m timeout against `workers: 1` in CI.

### 4. Flake rate is unmeasured

One green run is not evidence of a stable suite. Run the full suite 5× back to back on
proxmox and count how many specs fail at least once. That number decides whether `retries: 2`
in CI is masking a real problem.

### 5. The Delphi back-compat path is untested against real rows

`isDelphiActive` reads three generations of config. The unit spec covers all three, but both
production tables store the middle generation (`{current_round: 1, results_released: false}`,
no `enabled`) and were **not** re-read after deploy to confirm they now render as ordinary
matrices with add/remove/reorder restored. Verify in the UI against table
`ae969508-4f99-4bfb-9fc8-48f6f088cd8b` ("Location", 12 scores).

### 6. `functions/api/discovery/search.ts` is unverified

Written, never typechecked, never called — no route wiring, no UI, no test. It queries five
tables whose columns were confirmed against production, but the handler itself has not run
once. Either finish it (typecheck, a spec, palette wiring) or delete it; leaving it is the
worst of the three.

### 7. Two specs are quarantined

`cop-wizard` (10 failing, 0 passing) is guarded, and one consensus-spinner spec is
`test.fixme`. Both are debt with a note, not fixes.

## Local fallback, if proxmox is unreachable

Say so out loud, use `--workers=2`, and run **one** suite at a time. Two concurrent runs on
the laptop is the exact condition that produces the phantom failures.
