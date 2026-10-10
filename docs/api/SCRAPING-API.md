# ResearchTools Web Scraper API

**Last updated:** 2026-10-10
**Endpoint:** `POST https://researchtools.net/api/web-scraper`  
**Authentication:** required

The Web Scraper API extracts metadata and optionally bounded semantic article text, or structured product and price data, from one public HTTP(S) page. It is a static-fetch endpoint: it does not execute page JavaScript or attempt to bypass authentication, CAPTCHAs, robots/content policy, or access controls.

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
| `extract_mode` | `metadata` \| `summary` \| `full` \| `product` | no | `metadata` | `metadata` returns page metadata only. `summary` and `full` also return bounded plain text; `summary` adds the first 500 characters when the text is longer than 500 characters. `product` returns structured product/offer data with a different response shape — see [Product mode](#product-mode). |
| `create_dataset` | boolean | no | `false` | Attempts to create a dataset for the authenticated user. Dataset failure does not fail extraction; `dataset_id` is present only when creation succeeds. |

Unsupported `extract_mode` values or non-boolean `create_dataset` values return
`400` before a scraping attempt begins. `content` and `match` are accepted only
with `extract_mode: "product"`; sending either with another mode returns `400`.

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
    "published_date": "2026-09-04T12:00:00Z",
    "metadata": {
      "keywords": ["research", "example"],
      "og_title": "Example article",
      "og_description": "An example article description.",
      "og_image": "https://www.example.com/image.jpg",
      "og_type": "article",
      "extractor_version": "heuristic.v2",
      "extraction_method": "article",
      "extraction_quality": {
        "version": "article-quality.v2",
        "accepted": true,
        "score": 100,
        "reasons": [],
        "paragraphCount": 12,
        "textToMarkupRatio": 0.64,
        "linkDensity": 0.03
      }
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
| `title` | string | when found | Semantic title selected from article JSON-LD, Open Graph, Twitter metadata, or HTML title. |
| `description` | string | when found | Semantic description selected from article JSON-LD or page metadata. |
| `author` | string | when found | Author selected from article JSON-LD or page metadata. |
| `published_date` | string | when found | Publication time selected from article JSON-LD or page metadata. |
| `metadata` | object | always | Extracted keywords, supported Open Graph fields, extractor version/method, and explainable extraction-quality signals. |
| `metadata_completeness_score` | number | always | Integer from 0 through 100 measuring supported metadata coverage. It is not source credibility or information reliability. |
| `content` | object | `summary`/`full` modes | Semantic article/main/paragraph text, word count, and optional summary. Navigation, headers, footers, forms, scripts, and styles are excluded where recognized. Text is capped at 10,000 characters. |
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

`metadata.extraction_quality` is an extraction diagnostic, not a source-quality
or factual-reliability judgment. Its versioned signals currently include
paragraph count, text-to-markup ratio, link density, short login/paywall
markers, and structured short-document acceptance. Consumers must tolerate
additional quality signals in future versions.

## Product mode

`extract_mode: "product"` returns the product and every priced offer (variant) on one product page, for checking a price or a buy link. It uses the same authentication, URL validation, SSRF guards, and fetch limits as the other modes.

### Request

```json
{
  "url": "https://holybro.com/products/spare-parts-x500-v2-kit",
  "extract_mode": "product",
  "match": "Propeller 1045 (2 pair)",
  "content": {
    "html": "<!doctype html>…",
    "shopify_json": { "title": "Spare Parts-X500 V2 Kit", "variants": [ … ] }
  }
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `url` | string | yes | The product page. Same validation as other modes. When `content` is sent it must be `https://`. |
| `match` | string | no | 1–300 characters describing the wanted variant, e.g. `"2216 KV920 CW motor"`. Adds `matched_offer` to the response. |
| `content` | object | no | Page content the caller already fetched. When present **nothing is fetched**; `url` is used only for attribution and resolving relative links. |
| `content.html` | string | one of the two | The product page HTML. |
| `content.shopify_json` | object | one of the two | The parsed body of `<product-url>.js` (prices in integer cents) or `<product-url>.json` (decimal-string prices, with or without the `product` wrapper). |

`content` exists for stores that refuse Cloudflare egress — many Shopify stores answer it with HTTP `429` while serving a residential connection normally. The combined size of `content.html` and serialized `content.shopify_json` is limited to 2 MiB, the same bound as a fetched response; larger content returns `413`. Malformed `content` (not an object, wrong field types, or neither field non-empty) returns `400`. Supplied content is reported as `content_source: "supplied"`: the response states what that content says, not that the store currently says it.

Without `content`, the endpoint fetches `url`. If the page looks like a Shopify storefront and its path is `/products/<handle>`, it also fetches `<product-url>.js` from the **same hostname only** (10-second deadline, at most 3 redirects, 2 MiB) to obtain variant titles and availability. A failed `.js` fetch is not an error; extraction continues from the HTML.

### Response

```json
{
  "success": true,
  "url": "https://holybro.com/products/spare-parts-x500-v2-kit",
  "domain": "holybro.com",
  "content_source": "fetched",
  "product": {
    "name": "Spare Parts-X500 V2 Kit",
    "brand": "PCBA",
    "sku": "31063",
    "image": "https://holybro.com/cdn/shop/products/….jpg",
    "currency": "USD",
    "offers": [
      {
        "title": "Propeller1045(2pair)",
        "price": 11.59,
        "currency": "USD",
        "availability": "out_of_stock",
        "sku": "530084",
        "url": "https://holybro.com/products/spare-parts-x500-v2-kit?variant=41591073669309",
        "image": "https://holybro.com/cdn/shop/products/….jpg"
      }
    ],
    "sources": ["json-ld", "shopify"],
    "confidence": 1,
    "price_range": { "low": 2.59, "high": 30.59, "currency": "USD" },
    "extractor_version": "product.v1"
  },
  "matched_offer": {
    "title": "Propeller1045(2pair)",
    "price": 11.59,
    "currency": "USD",
    "availability": "out_of_stock",
    "sku": "530084",
    "url": "https://holybro.com/products/spare-parts-x500-v2-kit?variant=41591073669309",
    "image": "https://holybro.com/cdn/shop/products/….jpg",
    "match_score": 5,
    "ambiguous_same_price": false
  },
  "extracted_at": "2026-10-10T18:00:00.000Z"
}
```

Unlike the other modes, the product result is at the top level, not under `data`. `url`/`domain` are the final URL after redirects (or the submitted URL for supplied content).

| Field | Description |
|---|---|
| `product.offers[]` | One entry per priced offer or variant, up to 250. `price` is a number in **major units** (dollars, not cents). `availability` is `in_stock`, `out_of_stock`, `preorder` (includes back-order), or `unknown`. `currency` is an ISO 4217 code or `null` when the page does not state one. `url` is the offer/variant link when known. |
| `offers[].aggregate` | Present only when the page publishes a schema.org `AggregateOffer` without individual offers: `price` is `lowPrice`, and `aggregate` carries `high_price` and `offer_count`. |
| `product.sources` | Sources that contributed, in priority order: `json-ld` (schema.org `Product`/`ProductGroup` + `hasVariant`, `Offer`, `AggregateOffer`, `@graph`), `shopify` (product JSON), `microdata-meta` (`itemprop` price/priceCurrency/availability), `og-meta` (`product:price:amount`, `og:price:amount`, `product:availability`). Prices come from the highest-priority source that has any; lower sources only fill missing fields such as variant titles. |
| `product.confidence` | 0–1 heuristic for how structured the price evidence was (structured data with currency and availability scores high; a lone meta price scores low; no offers is `0`). It is not a statement that the price is current or that the seller is reliable. |
| `product.price_range` | Min/max across offers (including an `AggregateOffer` high price), or `null` when there are no offers. |
| `content_source` | `fetched` or `supplied`. |
| `matched_offer` | Present only when `match` was sent. The best offer, with `match_score`, or `null` when nothing matches. |

When a page has no recognizable structured price, the response is still `200` with `success: true` and `offers: []`. A variant title is the store's own label; when a theme's JSON-LD omits variant names and no Shopify JSON is available, the offer's SKU is used as its title.

### Variant matching

`match` and offer titles are tokenized with number+unit pairs canonicalized (`KV920`, `920 kv`, `920KV` → `920kv`; also mAh, GHz, mm, inch, S, V, A, W, g, pc, pair), and letter/digit runs split (`Propeller1045` → `propeller`, `1045`). Rules:

- Every number in `match` must appear in the offer title (or the product name) when the offer title contains numbers. A contradicting number (`1750KV` against a `920KV` variant) disqualifies the offer.
- Matching numbers score higher than matching words; a SKU contained in `match` scores highest.
- A tie between offers with the same price and currency (for example CW/CCW motors) returns the first and sets `ambiguous_same_price: true`. Any other tie, or no positive score, returns `null` — a guessed variant is worse than none when verifying a price.

### Product mode errors and telemetry

Validation errors use the common `{"error": "…"}` envelope (`400`, or `413` for oversized content) and happen before any fetch. Upstream failures use the same envelope and statuses as other modes; an upstream `403`/`429` in product mode adds a suggestion to retry with `content`, and a `429` is reported as `"The website is rate limiting automated access"`.

Telemetry follows the other modes (purpose `structured-extraction`). A supplied-content request records one `extract` attempt with strategy `supplied` and source mode `supplied`; a fetched request records the page fetch, the optional Shopify `.js` fetch, and the extract. An extraction with no offers is recorded as `extract_failed` even though the HTTP response is `200`.

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
