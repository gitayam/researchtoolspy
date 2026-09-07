# Content Intelligence Analysis API

**Last updated:** 2026-09-07

**Endpoint:** `POST https://researchtools.net/api/content-intelligence/analyze-url`

**Response contract:** legacy, unversioned JSON

**Extraction selection policy:** `analysis-candidate.v1`

This endpoint extracts a public URL and runs ResearchTools content analysis. It
also supports a bounded supplied-content path for trusted callers whose own
permitted egress obtained an article body that ResearchTools could not fetch.

The response is intentionally ephemeral for anonymous callers. Authentication,
workspace write authority, and rate-limit classification are separate decisions.

## Access profiles

| Caller | URL analysis | Supplied content | Durable ResearchTools write |
|---|---:|---:|---:|
| Anonymous HTTP client | yes | no | no |
| Dashboard guest session | yes | yes while the guest session is active | temporary guest workspace only |
| User hash or supported user session/JWT | yes | yes | only with an owned or editor/admin workspace |
| First-party Signal/RSS bridge | yes | yes when it also presents a valid legacy user credential | only when that user has write authority; integrations should normally omit the workspace |
| Scoped `rt_svc_` service principal | public URL behavior only | no | no |

The scoped service identity currently authorizes only
`GET /api/integrations/capabilities`. It is deliberately reserved from legacy
user authentication. An `rt_svc_` bearer therefore does not make
`content_text` legal and cannot select or write a user workspace. Capability
discovery continues to report all service-consuming operations as false.

The current Signal/RSS integration is a transition bridge:

- `Authorization: Bearer <legacy-user-credential>` supplies identity for the
  supplied-content path;
- `X-Service-Key: <provisioned-first-party-key>` selects the bounded
  first-party rate bucket;
- `X-Service-Key` grants no identity, scope, workspace access, or persistence;
- callers should omit `X-Workspace-ID` unless they explicitly intend to persist
  into a workspace the authenticated user can edit.

Do not use a hard-coded workspace such as `1`. The server ignores a workspace
that the resolved user cannot write, but a valid hard-coded workspace can cause
an integration that requested `save_link: false` to persist a normal/full
analysis row.

## Rate limits

The public content-analysis budget is **12 requests per hour per source IP** and
applies to both anonymous and ordinary authenticated callers. A recognized
first-party caller is instead metered by service identity with a default bounded
budget of **600 requests per hour**. Operators can lower or raise that budget
with `SERVICE_ANALYSIS_HOURLY_LIMIT`.

The first-party rate class is not unlimited and is not an authorization signal.
Unknown `X-Service-Key` values receive the public IP budget. Clients must stop on
`429`; retrying archive or bypass URLs spends more analysis budget and cannot
repair quota exhaustion.

Every accepted analysis request returns `X-Analysis-Meter: public` or
`X-Analysis-Meter: service`, including a request rejected with `429`. This is an
operational classification receipt, not proof of authentication or permission.
Browsers may read it because the header is included in
`Access-Control-Expose-Headers`.

## Request headers

| Header | Required | Meaning |
|---|---:|---|
| `Content-Type: application/json` | yes | Request encoding. |
| `X-User-Hash` | no | Preferred user credential for scripts that need supplied content or persistence. |
| `Authorization: Bearer ...` | no | Supported user JWT/session/hash transport. Reserved `rt_svc_` credentials do not resolve as users. |
| `X-Workspace-ID` | no | Persistence target; accepted only for an owner or editor/admin. It is not caller-created authority. |
| `X-Guest-Session` | browser only | Active seven-day dashboard guest identity. Not a permanent integration credential. |
| `X-Service-Key` | first-party only | Deployment-provisioned rate classification. It does not authenticate the request. |

Credentials and ResearchTools headers are never forwarded to the destination
being scraped.

## Response headers

| Header | Values | Meaning |
|---|---|---|
| `X-Analysis-Meter` | `public` \| `service` | Rate bucket selected for this request. Present on this endpoint after middleware classification, including quota responses. It grants no authority and must not be used as an authentication result. |

First-party callers should record this header with the HTTP status. A missing
header indicates an older or misrouted deployment; `public` with a supplied
service key indicates that the key is absent from `TRUSTED_ANALYSIS_KEYS`, is
malformed, or was not delivered in `X-Service-Key`.

## Request body

```json
{
  "url": "https://example.com/article",
  "mode": "normal",
  "save_link": false,
  "load_existing": false
}
```

| Field | Type | Required | Default | Contract |
|---|---|---:|---|---|
| `url` | string | for new analysis | — | Public HTTP(S) target. It may be omitted only for an authenticated `load_existing` request with `analysis_id`. Private/internal destinations are rejected. |
| `mode` | `quick` \| `normal` \| `full` | no | `normal` | `quick` returns summary-oriented output. `normal` and `full` currently run the same analysis set; consumers must not infer extra fields solely from `full`. |
| `save_link` | boolean | no | `false` | Creates a saved-link record only when the user and workspace may write. It does not control normal/full analysis-row persistence. |
| `link_note` | string | no | — | Note for a saved-link record. |
| `link_tags` | string[] | no | — | Tags for a saved-link record. |
| `load_existing` | boolean | no | `false` | Loads only when paired with `analysis_id`; otherwise a new analysis proceeds. |
| `analysis_id` | number \| string | with `load_existing` | — | Owner-only saved analysis identifier. A caller-supplied workspace does not broaden this lookup. |
| `content_text` | string | no | — | Caller-supplied article body. Requires an accepted user/guest identity and at least 150 words. |
| `content_title` | string | no | — | Optional supplied title; truncated to 500 characters. |
| `content_source` | `bot-scrape` | no | — | Compatibility hint. Accepted supplied text is normalized to `bot-scrape` provenance by the server. |

Supplied text is sanitized and bounded server-side. Clients should send no more
than 100 KiB of UTF-8 text; the server also caps its working string at 102,400
characters. A body below 150 whitespace-delimited words returns `422` before an
AI call.

### Public URL example

```bash
curl --request POST 'https://researchtools.net/api/content-intelligence/analyze-url' \
  --header 'Content-Type: application/json' \
  --data '{
    "url": "https://example.com/article",
    "mode": "quick",
    "save_link": false,
    "load_existing": false
  }'
```

### Signal/RSS supplied-content example

This path is for a server-side caller that is already authorized to process the
source content. The first-party key and user credential are separate secrets.

```bash
curl --request POST 'https://researchtools.net/api/content-intelligence/analyze-url' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${RESEARCHTOOLS_API_TOKEN}" \
  --header "X-Service-Key: ${RESEARCHTOOLS_SERVICE_KEY}" \
  --data '{
    "url": "https://example.com/article",
    "mode": "normal",
    "save_link": false,
    "load_existing": false,
    "content_title": "Example article",
    "content_text": "<at least 150 words of article text>",
    "content_source": "bot-scrape"
  }'
```

Do not send a browser guest credential, a user workspace, or either secret to
the source URL. Do not use supplied content to evade authentication, paywalls,
CAPTCHAs, robots exclusions, or publisher content-use signals.

## Successful response

All newly computed success responses include extraction provenance:

```json
{
  "url": "https://example.com/article",
  "url_normalized": "https://example.com/article",
  "content_hash": "sha256-hex-without-a-prefix",
  "title": "Example article",
  "author": "Example Reporter",
  "publish_date": "2026-09-07T12:00:00Z",
  "domain": "example.com",
  "extracted_text": "...",
  "summary": "...",
  "word_count": 842,
  "entities": {},
  "sentiment_analysis": {},
  "keyphrases": [],
  "topics": [],
  "processing_mode": "normal",
  "processing_duration_ms": 3170,
  "content_source": "original",
  "fallback_attempts": ["original"],
  "extraction_quality": {
    "thin": false,
    "word_count": 842
  },
  "is_persisted": false,
  "persistence_notice": "Public analysis completed without saving. Sign in and select a workspace to save or share results."
}
```

The response is not currently wrapped in a versioned envelope. Consumers must
treat these fields as optional unless their selected mode guarantees them:

| Field group | `quick` | `normal` / `full` |
|---|---:|---:|
| URL, title/author/date when found, extracted text, summary, word count | yes | yes |
| `content_hash`, bypass/archive URLs, provenance, quality, persistence status | yes | yes |
| `url_normalized`, phrases, entities, links, sentiment, keyphrases, topics | no | yes |
| `id` | no | only when a normal/full analysis row was persisted |
| `saved_link_id` | only when link save succeeded | only when link save succeeded |
| `claim_analysis` | no | currently `null`; use the claims tool for explicit claim extraction |

`normal` and `full` analyses persist an analysis row whenever the resolved user
has a writable workspace, even when `save_link` is false. `save_link` controls a
separate library link. Quick mode does not save an analysis row; it can create a
saved link when explicitly requested and authorized.

`content_source` is currently one of `original`, `archive.ph`, `wayback`,
`smry.ai`, or `bot-scrape`; consumers should also tolerate the reserved provider
value `apify`. `fallback_attempts` is ordered and describes stages attempted, not
a list of successful sources.

## Failure responses and caller behavior

| HTTP | Meaning | Caller action |
|---:|---|---|
| 400 | Invalid JSON, missing URL, or denied private/internal destination | Fix the request; do not retry unchanged. |
| 401 | Supplied content or saved-analysis loading lacks a user identity | Repair the legacy user credential or use URL-only public analysis. `X-Service-Key` cannot fix this. |
| 404 | Requested saved analysis is not owned by the authenticated user | Do not retry or probe other workspaces. |
| 422 | Supplied text is too short, or every permitted extraction candidate failed transport/quality | Inspect provenance. Supply independently obtained permitted content only when authorized. |
| 429 | Public or first-party analysis budget exhausted | Stop immediately; retry after the budget window. Do not enter a bypass ladder. |
| 500 | Analysis/database/provider failure | Retry with bounded exponential backoff only when the operation is safe to repeat. |

Quality rejection uses an explainable body:

```json
{
  "error": "Insufficient article content for reliable analysis",
  "code": "INSUFFICIENT_CONTENT",
  "content_source": "archive.ph",
  "fallback_attempts": ["original", "archive.ph", "wayback", "smry.ai"],
  "extraction_quality": {
    "thin": true,
    "word_count": 73,
    "reason": "too_short"
  },
  "bypass_urls": {},
  "archive_urls": {}
}
```

When a `422` includes a non-empty `fallback_attempts`, ResearchTools already ran
its bounded server recovery chain. Signal/RSS clients must not submit those same
archive or wrapper URLs as fresh analyses: that repeats the entire chain, adds
latency, and spends quota without adding a new extraction method. A separately
permitted local extractor may instead submit its article body once through
`content_text`; successful provenance will be `bot-scrape`.

## Integration and observability requirements

Signal, RSS, Discourse, and other automated callers should record or persist:

- HTTP status and a caller-generated opaque correlation ID;
- `X-Analysis-Meter` (`public` or `service`);
- `content_source`, ordered `fallback_attempts`, and `extraction_quality`;
- `processing_duration_ms`, `word_count`, and `is_persisted`;
- the terminal class: success, insufficient content, authentication, quota,
  timeout, or provider/server failure.

Do not write raw URLs, query strings, article bodies, credentials, user/group
identifiers, or free-form upstream errors to operational telemetry. The current
endpoint does not return a versioned request ID, so callers must not assume that
`X-Correlation-ID` will be echoed. A versioned envelope, generated client, and
shared fixtures remain prerequisites for replacing this legacy bridge with a
scoped service analysis operation.
