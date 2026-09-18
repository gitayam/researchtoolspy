# Testing — what is settled, and what is still open

Written 2026-09-18, after the pass that took the suite from a reported "1694 passed, 0 failed"
(which was actually 65 failures, hidden by a bad grep) to 2089 passed with one known flake.

## Settled

- **The suite is green.** 2090 passed / 100 skipped / **0 failed** on proxmox, 3 min 30 s.
- **Run it on proxmox**, via `~/.claude/scripts/remote-playwright.sh`. Not a preference: a
  contended laptop run of this same commit reported **402 failures that do not exist**.
- **Read results from the JSON reporter.** The line reporter's `N failed` line does not match
  the obvious greps; that is how 65 failures were once reported as zero.
- **`e2e:smoke` is blocking in CI** (`allow_failure: true` removed), runs on merge requests as
  well as main, uses an image matching the lockfile, and installs webkit as well as chromium.
- **mobile-safari runs only specs that open a browser** (37 of 212 files). The detector is
  anchored to `async ({ page }) =>` rather than any brace containing `page`, because a loose
  match also catches ordinary local destructures (`const { context } = contextFor(url)`) and
  `browserName`, which tells a test its engine without opening anything. The other ~175 were
  re-running identical pure assertions under a phone profile.

## Open, ranked by what it would cost to be wrong

### ~~1. `behavior-timeline-editor.spec.ts:10`~~ — classified and fixed

Kept here as a worked example of classifying before silencing.

`[mobile-safari] › authors and saves advanced event fields in the canonical schema` failed in
every full run and passed alone. Three runs separated the two candidate causes:

| Scope | Result |
|---|---|
| The spec by itself | 4 passed, 27.7 s |
| The whole mobile-safari project (275 tests) | **275 passed, 0 failed** |
| Full suite (+1541 chromium specs beside it) | `Test timeout of 30000ms exceeded` |

Passing with its own project's 275 tests but failing beside chromium's rules out order
dependence — and so does the spec itself, which clears `localStorage` in `beforeEach` and
mocks every route in-test. It is simply long: 31 sequential interactions, several waiting out
a Radix Select close animation, against a 30 s budget. The recorded failure is the click on
the HAPA phase combobox waiting for the element to become *stable*, not a missing element or
a failed assertion.

Fixed with `test.slow()` **inside the test body** — at describe level it would have slowed
every test in the group, which is not what was measured. Full suite after: 2090 passed, 0
failed.

### 2. Nothing starts the API the dev server proxies to

`vite.config.ts` proxies `/api` → `localhost:8788`, but `playwright.config.ts` starts only the
two Vite servers. Every unmocked API call in a browser test therefore hits a dead proxy, and
a full run emits hundreds of `ECONNREFUSED 127.0.0.1:8788` lines.

**Bounded, but not closed.** Of the 37 spec files that open a browser, exactly **one**
(`comb-analysis-form.spec.ts`) mocks no routes at all. The other 36 mock selectively, so
calls they do not name — `/api/analytics/events` and `/api/workspaces` are the two that show
up loudest in the log — still reach the dead proxy.

What is still unknown is whether any *assertion* depends on that failure. A spec asserting an
empty state may be passing because the request errored, not because the code handles
emptiness. Adding a third `webServer` for `wrangler pages dev` would change the behaviour of
those specs — which is the point, but it needs measuring before and after, not assuming.
Check first whether `wrangler pages dev` runs in the Playwright container at all (it needs D1
bindings and outbound network).

### 3. The CI job has never run in its new form

Blocking, MR-triggered, v1.60 image, chromium + webkit. All four changed together and none has
executed. The first merge request will tell us; watch that pipeline specifically. Most likely
failure: the job's own 45 m timeout against `workers: 1` in CI.

### 4. Flake rate is unmeasured

One green run is not evidence of a stable suite. Run the full suite 5× back to back on
proxmox and count how many specs fail at least once. That number decides whether `retries: 2`
in CI is masking a real problem.

### 5. Delphi back-compat — verified as far as it can be without a browser session

Both production tables store the middle config generation
(`{current_round: 1, results_released: false}`, no `enabled`), confirmed by query. Against
that input `isDelphiActive` returns `false` deterministically — `current_round > 1` is false
and `results_released === true` is false — so both render as ordinary matrices with
add/remove/reorder restored. The deployed chunk (`assets/CrossTablePage-*.js`) contains the
new control: "Start Delphi", "Advance to round", "Scored as an ordinary matrix".

What is left is only the visual confirmation, which needs an authenticated session. Open
table `ae969508-4f99-4bfb-9fc8-48f6f088cd8b` ("Location", 12 scores) and check that Add row
and Add criterion are present, and that the Consensus tab offers Start Delphi.

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
