# Scraping extractor benchmark

This directory holds replayable, non-network fixtures for paired semantic
extractor evaluation. The initial `corpus-v1` pages are synthetic and establish
the manifest and runner contract; they are not evidence that an extractor is
ready for production.

Run the current control and paired Readability candidate:

```bash
npm run benchmark:scraping
```

## Corpus rules

- Store only permitted, synthetic, or appropriately sanitized HTML.
- Never include credentials, cookies, personal workspace data, raw request
  headers, or private URLs.
- Give every fixture a stable ID, page class, expected policy/quality outcome,
  expected metadata, required main-content markers, and forbidden boilerplate.
- Keep live network checks outside this corpus. Live checks must use the normal
  safe-fetch policy and a separate polite test schedule.
- Reserve held-out fixtures that are not used to tune thresholds.

## Adding a candidate

Implement the small `ExtractorCandidate` interface in
`tests/e2e/benchmark/scraping-extractor-benchmark.spec.ts`. Candidates must
receive the same stored HTML and final URL. Do not let an extractor perform its
own fetch during replay. Candidate scorecards are attached to the Playwright
test result. Candidate disagreements are measurements; only the control's
regression contract and a candidate catastrophic-failure floor fail the run.

The full milestone adds human labels and paired scoring for main-text
precision/recall, metadata accuracy, false acceptance, valid-short rejection,
latency, stability, and cost. Promotion gates remain in
`docs/SCRAPING_ROADMAP.md`.
