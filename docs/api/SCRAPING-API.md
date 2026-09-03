# ResearchTools Web Scraper API

**Last updated:** 2026-09-03  
**Endpoint:** `POST https://researchtools.net/api/web-scraper`  
**Authentication:** required

The Web Scraper API extracts metadata and optionally bounded text from one public HTTP(S) page. It is a static-fetch endpoint: it does not execute page JavaScript or attempt to bypass authentication, CAPTCHAs, robots/content policy, or access controls.

## Authentication

For scripts, send the ResearchTools user hash documented in [`API.md`](API.md):

```http
X-User-Hash: <your-16+-character-hash>
```

The web application may supply its normal authenticated session headers. `X-Workspace-ID` is optional and is forwarded only to the same-origin datasets API when `create_dataset` is enabled. Authentication and workspace headers are never sent to the scraped destination.

An unauthenticated request returns:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"error":"Authentication required"}
```

## Request

```json
{
  "url": "https://example.com/article",
  "extract_mode": "summary",
  "create_dataset": false
}
```

| Field | Type | Required | Default | Description |
|---|---|---:|---|---|
| `url` | string | yes | — | Absolute public `http://` or `https://` URL. Embedded credentials, non-default ports, and private/reserved/internal destinations are denied. |
| `extract_mode` | `metadata` \| `summary` \| `full` | no | `metadata` | `metadata` returns page metadata only. `summary` and `full` also return bounded plain text; `summary` adds the first 500 characters when the text is longer than 500 characters. |
| `create_dataset` | boolean | no | `false` | Attempts to create a dataset for the authenticated user. Dataset failure does not fail extraction; `dataset_id` is present only when creation succeeds. |

Unsupported `extract_mode` values or non-boolean `create_dataset` values return
`400` before a scraping attempt begins.

Example:

```bash
curl --request POST 'https://researchtools.net/api/web-scraper' \
  --header 'Content-Type: application/json' \
  --header "X-User-Hash: ${RESEARCHTOOLS_USER_HASH}" \
  --data '{
    "url": "https://example.com/article",
    "extract_mode": "metadata",
    "create_dataset": false
  }'
```

## Successful response

```json
{
  "success": true,
  "data": {
    "url": "https://www.example.com/final-article",
    "domain": "www.example.com",
    "title": "Example article",
    "description": "An example article description.",
    "author": "Example Reporter",
    "metadata": {
      "keywords": ["research", "example"],
      "og_title": "Example article",
      "og_description": "An example article description.",
      "og_image": "https://www.example.com/image.jpg",
      "og_type": "article"
    },
    "metadata_completeness_score": 100,
    "extracted_at": "2026-09-03T16:00:00.000Z"
  }
}
```

`data.url` and `data.domain` describe the final validated URL after redirects, not necessarily the submitted URL.

### Response fields

| Field | Type | Presence | Description |
|---|---|---|---|
| `url` | string | always | Final validated page URL. |
| `domain` | string | always | Hostname from the final validated URL. |
| `title` | string | when found | HTML `<title>` value. |
| `description` | string | when found | Meta description. |
| `author` | string | when found | Meta author. |
| `metadata` | object | always | Extracted keywords and supported Open Graph fields. May be empty. |
| `metadata_completeness_score` | number | always | Integer from 0 through 100 measuring supported metadata coverage. It is not source credibility or information reliability. |
| `content` | object | `summary`/`full` modes | Plain text, word count, and optional summary. Text is capped at 10,000 characters. |
| `dataset_id` | string or number | dataset creation success | Identifier returned by the same-origin datasets API. |
| `extracted_at` | ISO 8601 string | always | Extraction timestamp. |

Content shape:

```json
{
  "text": "Extracted page text...",
  "summary": "First 500 characters when summary mode text exceeds 500 characters...",
  "word_count": 742
}
```

## Metadata completeness score

The score describes whether the scraper found supported metadata fields. It does not evaluate publisher identity, factual accuracy, editorial process, evidence quality, or trustworthiness. Hostname suffixes such as `.gov`, `.edu`, and `.org` do not affect it.

| Extracted field | Points |
|---|---:|
| Title | 20 |
| Description | 20 |
| Author | 15 |
| Keywords | 10 |
| Open Graph title | 10 |
| Open Graph description | 10 |
| Open Graph image | 10 |
| Open Graph type | 5 |
| **Maximum** | **100** |

When a dataset is created, `metadata_completeness_score` is stored inside the dataset metadata. It is not copied into `reliability_rating`; source reliability remains unset for analyst assessment.

## Fetch and safety limits

| Control | Current contract |
|---|---|
| Protocol | HTTP(S) only |
| Ports | Default HTTP/HTTPS ports only |
| DNS | All resolved A/AAAA addresses must be public |
| Redirects | Manual validation at every hop; maximum 5 |
| Total fetch deadline | 15 seconds |
| Response limit | 2 MiB |
| Content | Text/XML/JSON-compatible MIME types accepted by the shared text-fetch policy |
| Extracted text | Maximum 10,000 characters |
| Browser rendering | Disabled |

DNS validation is fail-closed, but application-level DNS checking alone cannot eliminate resolution-to-connection rebinding races. The enforcing-egress boundary tracked in the [scraping roadmap](../SCRAPING_ROADMAP.md) remains required before dynamic browser navigation is enabled.

## Observability and privacy

After authentication and synchronous URL validation, the endpoint emits
non-blocking Analytics Engine metrics for each executed fetch/extract stage and
exactly one terminal outcome. Telemetry records bounded timings, byte/word
counts, status/content-type classes, normalized errors, and metadata
completeness. Request, user, URL, and domain correlation values are HMAC-derived
with the dedicated telemetry key.

Raw URLs, query strings, user IDs, content, extracted metadata, free-form errors,
credentials, and dataset IDs are not written to scraping analytics. A missing
binding/key or an Analytics Engine write failure does not change the API response.
See the [scraping observability runbook](../operations/SCRAPING_OBSERVABILITY.md)
for the schema and baseline queries.

## Errors

Input/authentication errors use the common minimal envelope:

```json
{"error":"Invalid URL"}
```

Fetch/extraction errors may include remediation guidance:

```json
{
  "success": false,
  "error": "Unable to connect to the website",
  "errorType": "network",
  "suggestions": ["Check if the URL is correct and accessible", "Try again later"]
}
```

| Status | Typical condition |
|---:|---|
| `400` | Missing/invalid/unsafe URL, denied destination, excessive redirects/bytes, unsupported content type, or non-success upstream HTTP response |
| `401` | Authentication missing or invalid |
| `405` | Method other than `POST` (`OPTIONS` returns `204`) |
| `408` | Caller cancelled the request |
| `502` | Network connection failure |
| `504` | Fetch deadline exceeded |
| `500` | Internal extraction error or server policy misconfiguration |

Do not depend on `technicalDetails`; it is diagnostic and is not a stable machine-readable contract. Use HTTP status plus `errorType` where present.

## Contract migration: 2026-09-03

The misleading `reliability_score` field was removed and replaced with `metadata_completeness_score`.

| Old contract | Current contract |
|---|---|
| `reliability_score` from 0–10 | `metadata_completeness_score` from 0–100 |
| Included hostname-suffix reputation assumptions | Uses metadata presence only |
| Mapped into dataset `reliability_rating` | Stored only as dataset metadata |

Clients should migrate to the new field directly. No deprecated alias is returned because continuing to expose the old name would misrepresent extraction coverage as source reliability.
