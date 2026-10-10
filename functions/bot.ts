/**
 * GET /bot — what the ResearchTools product-price fetcher is and how to reach
 * us. Product mode of /api/web-scraper sends
 * "ResearchTools/1.0 (+https://researchtools.net/bot)" so a store operator who
 * sees it in their logs can find this page.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ResearchTools fetcher</title>
<style>
  :root { color-scheme: light dark; --fg: #1d2330; --bg: #ffffff; --muted: #5b6475; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e6e9ef; --bg: #14171c; --muted: #9aa3b2; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1rem; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  code { font-size: 0.9em; }
  p.small { color: var(--muted); font-size: 0.9rem; }
</style>
</head>
<body>
<main>
<h1>ResearchTools fetcher</h1>
<p>Requests with the user agent <code>ResearchTools/1.0 (+https://researchtools.net/bot)</code> come from
<a href="https://researchtools.net">ResearchTools</a>. A signed-in user asked us to read the price and stock of one
product page, usually to check a parts list.</p>
<p>For each such request we fetch that page once. On Shopify, WooCommerce and Magento stores we may also make one or
two read-only <code>GET</code> requests to the same store's public product JSON (for example
<code>/products/&lt;handle&gt;.js</code>, <code>/wp-json/wc/store/v1/products/&lt;id&gt;</code> or a
<code>/graphql</code> product query) to read per-variant prices. We never post forms, add to carts, log in, or try to
get past bot protection: if a store blocks the request, we report that it is blocked.</p>
<p>We do not crawl. There is no link following and no scheduled re-fetching from this agent.</p>
<p class="small">To ask us to stop fetching your store, or about anything else, open an issue at
<a href="https://github.com/gitayam/researchtoolspy/issues">github.com/gitayam/researchtoolspy</a>.</p>
</main>
</body>
</html>
`

export async function onRequestGet(): Promise<Response> {
  return new Response(PAGE, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
