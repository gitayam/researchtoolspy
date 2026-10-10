# ResearchTools Web Scraper API

**Last updated:** 2026-10-10
**Endpoint:** `POST https://researchtools.net/api/web-scraper`  
**Authentication:** required

The Web Scraper API extracts metadata and optionally bounded semantic article text, or structured product and price data, from one public HTTP(S) page. It is a static-fetch endpoint: it does not execute page JavaScript (except product mode's opt-in render fallback, below) or attempt to bypass authentication, CAPTCHAs, robots/content policy, or access controls.

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
| `content.html` | string | one of the two | The product page HTML. Platform data embedded in it (WooCommerce variations, Magento `spConfig`, BigCommerce `BCData`) is read the same way as for a fetched page. |
| `content.shopify_json` | object | one of the two | The parsed body of `<product-url>.js` (prices in integer cents) or `<product-url>.json` (decimal-string prices, with or without the `product` wrapper). |

`content` exists for stores that refuse Cloudflare egress — many Shopify stores answer it with HTTP `429` while serving a residential connection normally. The combined size of `content.html` and serialized `content.shopify_json` is limited to 2 MiB, the same bound as a fetched response; larger content returns `413`. Malformed `content` (not an object, wrong field types, or neither field non-empty) returns `400`. Supplied content is reported as `content_source: "supplied"`: the response states what that content says, not that the store currently says it.

Without `content`, the endpoint fetches `url` with the user agent `ResearchTools/1.0 (+https://researchtools.net/bot)` (product mode does not imitate a browser; [`/bot`](https://researchtools.net/bot) explains the agent to store operators). It may then make read-only `GET` requests to the **same hostname only** (10-second deadline, at most 3 redirects, 2 MiB each, same user agent):

| Platform | When | Request |
|---|---|---|
| Shopify | page looks like Shopify and the path is `/products/<handle>` | `<product-url>.js` (variant titles, cents, availability, `compare_at_price`) |
| WooCommerce | the page did not already give every offer's stock, or its variations form deferred them (`data-product_variations="false"`, more than WooCommerce's ajax threshold) | `/wp-json/wc/store/v1/products/<id>`, then for a variable product `/wp-json/wc/store/v1/products?type=variation&parent=<id>&per_page=100`. The id comes from the page's `wp-json/wp/v2/product/<id>` link, the variations form, or the `postid-<id>` body class. Prices are minor units divided by `currency_minor_unit`. |
| Magento 2 | the page is Magento and its offers came from `spConfig` or lack SKU/stock | one `GET /graphql?query={products(filter:{url_key:{eq:"…"}})…}` (child SKU, price, `stock_status`). Many stores disable GraphQL; a failure changes nothing. |

A failed platform request is not an error; extraction continues from the HTML.

**Render fallback (off by default).** When the deployment sets `PRODUCT_BROWSER_FALLBACK=1`, a fetched page that returned `2xx`, is not a bot-challenge interstitial (`Just a moment…`, `cf-chl-`, Incapsula, PerimeterX, DataDome markers), and produced **no offers** is rendered once by the `researchtools-browser-renderer` Worker (Cloudflare Browser Run `content`, `mode: "html"`, images/media/fonts/stylesheets blocked) and extracted again. If the render yields offers the response says `content_source: "rendered"`; otherwise the static result is returned unchanged. Browser Run identifies itself and does not pass bot protection, so challenged or blocked stores still need `content`.

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
    "currency_ambiguous": false,
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
    "extractor_version": "product.v2"
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
| `offers[].regular_price` | Present only when the store states a higher list price for the offer: a schema.org `priceSpecification` with `priceType` `StrikethroughPrice`/`ListPrice`/`MSRP`, Shopify `compare_at_price`, WooCommerce `regular_price`, Magento `oldPrice`/`regular_price`, BigCommerce non-sale/RRP price. `price` is always the current (sale) price. |
| `offers[].aggregate` | Present only when the page publishes a schema.org `AggregateOffer` without individual offers: `price` is `lowPrice`, and `aggregate` carries `high_price` and `offer_count`. |
| `product.sources` | Sources that contributed, in priority order: `json-ld` (schema.org `Product`/`ProductGroup` + `hasVariant`, `Offer`, `AggregateOffer`, `priceSpecification`, `@graph`), `shopify` (product JSON), `woo-variations` (WooCommerce `data-product_variations` in the page), `magento-spconfig` (Magento 2 `spConfig`/`jsonConfig` in the page), `woo-store-api`, `magento-graphql` (the platform requests above), `bigcommerce-bcdata` (`BCData.product_attributes` in the page), `microdata-meta` (the schema.org microdata item tree, including text-content prices and one offer per `Offer` item), `og-meta` (`product:price:amount`, `og:price:amount`, `product:availability`). Prices come from the highest-priority source that has any, except that a variant-level source with several offers (Shopify, WooCommerce, Magento) replaces a higher source that has only one. Other sources only fill missing fields (variant titles, stock, SKU, list price), matched by variant id, SKU or variant title. A product-level summary offer listed beside its own variants is dropped. |
| `product.currency_ambiguous` | `true` when `currency` was read from a symbol several currencies share (`$`, `kr`, `¥`, `Rs`, `C$`) and the page states no ISO code anywhere. A `<html lang>` region or country TLD may have picked a better guess (`$` on `en-CA` → `CAD`), but it remains a guess. |
| `product.confidence` | 0–1 heuristic for how structured the price evidence was (structured data with an unambiguous currency and availability scores high; agreeing structured sources add to it; a lone meta price scores low; no offers is `0`). It is not a statement that the price is current or that the seller is reliable. |
| `product.extractor_version` | `product.v2`. |
| `product.price_range` | Min/max across offers (including an `AggregateOffer` high price), or `null` when there are no offers. |
| `content_source` | `fetched`, `supplied`, or `rendered` (render fallback). |
| `matched_offer` | Present only when `match` was sent. The best offer, with `match_score`, or `null` when nothing matches. |

When a page has no recognizable structured price, the response is still `200` with `success: true` and `offers: []`. A variant title is the store's own label (the group name, and a trailing ` - Site name`, are stripped from it); when no source names a variant, the offer's SKU is used as its title.

BigCommerce `BCData` describes the default option selection; when it reports the product in stock while the page's schema data says `OutOfStock` for the same price (themes mark the not-yet-selected default that way), the offer is reported `in_stock`. Per-option BigCommerce prices are not available without a `POST`, which this endpoint never makes; supply `content` for them.

### Price and currency parsing

Numbers in structured fields (JSON-LD, microdata `content`, platform JSON) are read as `.`-decimal literals: `"1.299"` is 1.299. Display text (microdata text content, a price string with a symbol) is parsed with an algorithm ported from [scrapinghub/price-parser](https://github.com/scrapinghub/price-parser) (BSD-3-Clause): a separator followed by exactly three digits groups thousands (`Rp 31.500` → 31500, `£1.299` → 1299), a number followed by `%` is skipped, `Free` is 0, `.75 €` and `35€ 99` parse, and the number next to the currency symbol wins (`2 x $5.00` → 5, `Save 20% now $15.99` → 15.99, `Was $20 Now $15` → 15). A decimal separator stated by the platform (Magento `priceFormat.decimalSymbol`, WooCommerce Store API, Shopify `money_format`) overrides the guess. On price-parser's labelled corpus (1,035 amount cases) the parser scores 1035/1035; `product.v1` scored 1016/1035.

### Variant matching

`match` and offer titles are tokenized with number+unit pairs canonicalized (`KV920`, `920 kv`, `920KV` → `920kv`; also mAh, GHz, mm, inch, S, V, A, W, g, pc, pair), and letter/digit runs split (`Propeller1045` → `propeller`, `1045`). Rules:

- Every number in `match` must appear in the offer title (or the product name) when the offer title contains numbers. A contradicting number (`1750KV` against a `920KV` variant) disqualifies the offer.
- Matching numbers score higher than matching words; a SKU contained in `match` scores highest.
- A tie between offers with the same price and currency (for example CW/CCW motors) returns the first and sets `ambiguous_same_price: true`. Any other tie, or no positive score, returns `null` — a guessed variant is worse than none when verifying a price.

### Product mode errors and telemetry

Validation errors use the common `{"error": "…"}` envelope (`400`, or `413` for oversized content) and happen before any fetch. Upstream failures use the same envelope and statuses as other modes; an upstream `403`/`429` in product mode adds a suggestion to retry with `content`, and a `429` is reported as `"The website is rate limiting automated access"`.

Telemetry follows the other modes (purpose `structured-extraction`). A supplied-content request records one `extract` attempt with strategy `supplied` and source mode `supplied`; a fetched request records the page fetch, each optional platform JSON fetch (Shopify `.js`, WooCommerce Store API, Magento GraphQL), the extract, and, with the render fallback, a `render` attempt (strategy and provider `browser-renderer`) and a second extract. An extraction with no offers is recorded as `extract_failed` even though the HTTP response is `200`.

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
