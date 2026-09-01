# Scraping observability runbook

**Dataset:** `researchtoolspy_scrape_metrics_v1`  
**Schema:** `scrape.metric.v1`  
**Instrumented routes:** `POST /api/content-intelligence/analyze-url`,
`POST/GET /api/cop/:id/scrape`

The `SCRAPE-04` production baseline measures whether the main analysis extractor
and authenticated COP provider jobs can emit one terminal outcome per accepted
request without retaining raw URLs, search queries, provider run IDs, domains,
tenant identifiers, content, prompts, tokens, or IPs.

## Privacy and failure contract

- `index1` and all correlation fields are HMAC-SHA256 identifiers created with
  the dedicated `SCRAPE_TELEMETRY_KEY` Pages secret.
- The key is not an application authentication secret and must not be declared
  in `wrangler.toml` or reused for another purpose.
- Missing bindings, missing keys, and write failures disable telemetry without
  changing the scrape response.
- Free-form errors never enter Analytics Engine. Only the closed normalized
  error taxonomy in `scrape-contract.ts` is emitted.
- D1 `event_logs` remains reserved for actionable hard failures and upstream
  outages; it is not the request denominator.

The binding is deployed from `wrangler.toml`. Configure or rotate the production
HMAC key without printing it:

```bash
openssl rand -hex 32 | pnpm exec wrangler pages secret put \
  SCRAPE_TELEMETRY_KEY --project-name=researchtoolspy
```

The deployment gate verifies that both the binding declaration and production
secret name exist.

## Column map

Attempt points use `blob1..blob14` for schema, event, route, purpose, stage,
strategy, provider, outcome, error code, HTTP status class, content type class,
opaque request ID, opaque URL ID, and opaque domain ID. `double1..double5` are
count, ordinal, duration milliseconds, response bytes, and extracted words.
`double6..double8` are items read, items written, and duplicates prevented.

Terminal points use `blob1..blob11` for schema, event, route, purpose, outcome,
error code, terminal stage, final strategy, opaque request ID, opaque URL ID,
and opaque domain ID. `double1..double5` are count, attempt count, total
milliseconds, quality score, and accepted (`0` or `1`).

## Baseline queries

Use the Cloudflare Analytics Engine SQL API with an API token limited to
`Account Analytics: Read`. These queries account for Analytics Engine sampling.

Requests, success, and terminal coverage inputs for the last 24 hours:

```sql
SELECT
  blob3 AS route,
  blob5 AS outcome,
  sum(_sample_interval) AS requests,
  quantileExactWeighted(0.50)(double3, _sample_interval) AS p50_ms,
  quantileExactWeighted(0.95)(double3, _sample_interval) AS p95_ms
FROM researchtoolspy_scrape_metrics_v1
WHERE blob1 = 'scrape.metric.v1'
  AND blob2 = 'terminal'
  AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY route, outcome
ORDER BY route, outcome
```

Failure classification:

```sql
SELECT
  blob3 AS route,
  blob6 AS error_code,
  blob7 AS terminal_stage,
  sum(_sample_interval) AS failures
FROM researchtoolspy_scrape_metrics_v1
WHERE blob1 = 'scrape.metric.v1'
  AND blob2 = 'terminal'
  AND blob5 = 'failed'
  AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY route, error_code, terminal_stage
ORDER BY failures DESC
```

Attempt/provider health and latency:

```sql
SELECT
  blob5 AS stage,
  blob6 AS strategy,
  blob7 AS provider,
  blob8 AS outcome,
  blob9 AS error_code,
  blob10 AS http_status_class,
  sum(_sample_interval) AS attempts,
  quantileExactWeighted(0.95)(double3, _sample_interval) AS p95_ms
FROM researchtoolspy_scrape_metrics_v1
WHERE blob1 = 'scrape.metric.v1'
  AND blob2 = 'attempt'
  AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY stage, strategy, provider, outcome, error_code, http_status_class
ORDER BY attempts DESC
```

COP/Apify throughput, ingestion, and duplicate prevention:

```sql
SELECT
  blob5 AS stage,
  blob7 AS provider,
  blob8 AS outcome,
  sum(_sample_interval * double6) AS items_read,
  sum(_sample_interval * double7) AS items_written,
  sum(_sample_interval * double8) AS duplicates_prevented,
  quantileExactWeighted(0.95)(double3, _sample_interval) AS p95_ms
FROM researchtoolspy_scrape_metrics_v1
WHERE blob1 = 'scrape.metric.v1'
  AND blob2 = 'attempt'
  AND blob3 = 'cop-scrape'
  AND timestamp > NOW() - INTERVAL '1' DAY
GROUP BY stage, provider, outcome
ORDER BY stage, provider, outcome
```

COP telemetry begins only after authentication, authorization, canonical input
validation, and paid-request fingerprinting. Each HTTP invocation gets a unique
opaque request ID; retries of the same logical job share an opaque URL ID. A
deduplicated paid start is a successful `cache` attempt with
`duplicates_prevented=1` and makes no provider call. Provider job states
`FAILED`, `ABORTED`, `TIMING-OUT`, and `TIMED-OUT` remain failed terminal metrics
even when the status poll itself returned HTTP `200`.

Fallback recovery is the number of successful terminal requests with more than
one attempt (`double2 > 1`), grouped by final strategy (`blob8`). Duplicate
contention for a paid reservation is measured by attempt `double8`; duplicate
terminal request IDs (`blob9`) must remain zero. Query any duplicate IDs before
using terminal events as the success denominator.

## Falsifiable rollout gate

For each day, compare accepted scrape requests from the route edge counter with
distinct terminal request IDs. The hypothesis passes only after at least 14 days
and 100 terminal failures with at least 99% terminal coverage. It fails if raw
identifiers appear, analytics changes endpoint behavior, terminal duplicates are
non-zero, or coverage is below 99%. Until that evidence exists, do not promote a
renderer/provider strategy based on this dataset.

Initial alerts are operational review thresholds, not yet automated:

- success rate decreases by 15 percentage points after minimum volume;
- p95 total latency doubles;
- provider `401`/`403`/`429` classifications spike;
- terminal coverage falls below 99%;
- any post-validation SSRF/redirect denial occurs.

Cloudflare references: [Pages Analytics Engine bindings](https://developers.cloudflare.com/pages/functions/bindings/#analytics-engine), [SQL API and sampling](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/).
