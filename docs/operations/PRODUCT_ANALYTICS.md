# Product analytics runbook

**Dataset:** `researchtoolspy_product_metrics_v1`

**Schema:** `product.metric.v1`

**Browser intake:** `POST /api/analytics/events`

This dataset answers product questions that edge request logs cannot: how many
people opened a feature, whether they reached its API, whether the operation
succeeded, and whether a save prompt led to conversion. It keeps browser guests,
authenticated people, first-party integrations, and synthetic checks in separate
segments. It is not a replacement for scraping-stage metrics or error logs.

## Privacy and trust boundary

- `index1` is an HMAC-SHA256 actor ID generated with the dedicated
  `PRODUCT_TELEMETRY_KEY` Pages secret. The secret must not be reused for auth or
  `SCRAPE_TELEMETRY_KEY`; separate keys prevent joining the datasets.
- No URL, route parameter, page title, referrer, query, content, prompt, IP,
  workspace ID, guest ID, user hash, bearer token, or free-form error is written.
- Routes become closed `feature` and `action` values before emission. Unmapped
  pages and APIs are omitted, making a new taxonomy entry a reviewed code change.
- Browser collection honors Global Privacy Control and Do Not Track.
- Missing bindings, missing keys, malformed identity, and Analytics Engine write
  failures are no-ops. They never alter the product/API response.
- The intake accepts at most 10 closed-taxonomy events and 16 KiB per request.
  Middleware limits it to 120 requests per IP per minute without writing IPs to
  Analytics Engine; the existing short-lived KV rate-limit bucket still uses the
  IP as an abuse-control key.
- Anonymous traffic without a ResearchTools guest session is omitted. This keeps
  scanners out of adoption counts but means users who block the first-party
  intake are not counted.

Actor precedence is: recognized ResearchTools/headless synthetic user agent,
trusted service identity, guest session, authenticated user hash/JWT subject or
session credential. Deployment probes use `ResearchTools-Deploy-Probe/1.0`, so
even a probe carrying a service key remains in the `synthetic` segment.

Configure the production pseudonymization key without printing it:

```bash
openssl rand -base64 48 | pnpm exec wrangler pages secret put \
  PRODUCT_TELEMETRY_KEY --project-name=researchtoolspy
```

Rotating the key deliberately breaks actor continuity. Record the rotation time
and do not calculate distinct-user windows across it.

## Column map

| Column | Meaning | Values |
| --- | --- | --- |
| `index1` | Pseudonymous actor | 64-character HMAC hex |
| `blob1` | Schema | `product.metric.v1` |
| `blob2` | Event | `page_view`, `intent`, `api_request` |
| `blob3` | Feature | Closed list in `product-analytics-contract.ts` |
| `blob4` | Action | Closed list such as `view`, `analyze`, `save_gate` |
| `blob5` | Surface | `browser`, `api` |
| `blob6` | Actor type | `guest`, `authenticated`, `service`, `synthetic` |
| `blob7` | Outcome | `accepted`, `succeeded`, `rejected`, `unauthorized`, `rate_limited`, `failed` |
| `blob8` | HTTP status class | `none`, `2xx`, `3xx`, `4xx`, `5xx` |
| `blob9` | HTTP method | Closed method or `none` |
| `double1` | Count | `1` |
| `double2` | Duration | API milliseconds; `0` for browser events |
| `double3` | HTTP status | API status; `0` for browser events |

Use `_sample_interval` for event counts and weighted latency. Distinct actor
counts are exact only while the dataset is unsampled; treat them as estimates if
Cloudflare begins sampling at higher volume.

## Core queries

Run through the Cloudflare Analytics Engine SQL API using a token restricted to
`Account Analytics: Read`.

The repository provides the same reports as repeatable commands. Set
`PRODUCT_ANALYTICS_DAYS` to change the default 30-day window:

```bash
npm run analytics:product:mau
npm run analytics:product:features
npm run analytics:product:outcomes
npm run analytics:product:integrity
```

Human monthly active actors (the canonical MAU definition):

```sql
SELECT
  blob6 AS actor_type,
  count(DISTINCT index1) AS active_actors
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND blob2 = 'page_view'
  AND blob6 IN ('guest', 'authenticated')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY actor_type
ORDER BY actor_type
```

Feature discovery/adoption by people, excluding bots and integrations:

```sql
SELECT
  blob3 AS feature,
  blob2 AS event,
  count(DISTINCT index1) AS actors,
  sum(_sample_interval) AS events
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND blob6 IN ('guest', 'authenticated')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY feature, event
ORDER BY actors DESC, feature, event
```

Tool/API outcome and latency by human vs service traffic:

```sql
SELECT
  blob3 AS feature,
  blob6 AS actor_type,
  blob7 AS outcome,
  sum(_sample_interval) AS requests,
  quantileExactWeighted(0.50)(double2, _sample_interval) AS p50_ms,
  quantileExactWeighted(0.95)(double2, _sample_interval) AS p95_ms
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND blob2 = 'api_request'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY feature, actor_type, outcome
ORDER BY requests DESC
```

Guest save intent and completed conversion are both API-independent events:

```sql
SELECT
  blob2 AS event,
  blob4 AS action,
  blob7 AS outcome,
  count(DISTINCT index1) AS actors,
  sum(_sample_interval) AS events
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND blob3 = 'authentication'
  AND blob6 IN ('guest', 'authenticated')
  AND (blob4 = 'save_gate' OR blob4 = 'convert')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY event, action, outcome
ORDER BY event, action, outcome
```

Synthetic and service traffic must be monitored separately, never subtracted
from a combined total after the fact:

```sql
SELECT
  blob6 AS actor_type,
  blob3 AS feature,
  blob7 AS outcome,
  sum(_sample_interval) AS requests
FROM researchtoolspy_product_metrics_v1
WHERE blob1 = 'product.metric.v1'
  AND blob2 = 'api_request'
  AND blob6 IN ('service', 'synthetic')
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY actor_type, feature, outcome
ORDER BY requests DESC
```

## Falsifiable product hypotheses

Use a 14-day window and require at least 100 relevant API attempts before making
a product or reliability decision.

1. **Discovery:** at least 20% of human actors who view a tool page make a
   corresponding API request. Falsified below 20%; improve onboarding/CTA before
   changing extraction infrastructure.
2. **Reliability:** at least 75% of human content-intelligence and timeline API
   requests succeed, with fewer than 10% rejected and fewer than 5% rate-limited.
   Falsified by any threshold; inspect scraping metrics by stage/provider next.
3. **Guest value:** guests can reach successful tool outcomes without signing
   in. Falsified if authenticated success is healthy while guest success is at
   least 15 percentage points lower; audit guest authorization/workspace paths.
4. **Save proposition:** at least 10% of guest actors who trigger `save_gate`
   subsequently complete `convert`. Falsified below 10%; test the login/bookmark
   explanation rather than forcing authentication earlier.
5. **Measurement integrity:** human MAU contains no deployment/smoke identities,
   and mapped API volume has one terminal product point per response. Falsified
   by a synthetic UA classified as human or coverage below 99% in a controlled
   probe set.

Do not interpret an empty dataset as zero use. First confirm the binding and
secret, send a labeled synthetic page/API probe, and verify its point appears.
Cloudflare edge analytics remains the gross request denominator; scraping
analytics explains extraction mechanics; D1 durable-object counts validate saved
work. These three sources should agree on direction but do not share identities.
