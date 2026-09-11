# Generic timeline service client

`client.ts` is a dependency-free, server-side TypeScript reference implementation. It imports no Signal, RSS, browser guest or ResearchTools UI code. Copy this directory into a server project with modern Fetch, Web Streams, AbortController and TextEncoder support. Never distribute service credentials to a browser. The operator must provision a scoped `rt_svc_` credential; browser guest access is a separate product feature.

```ts
import { createTimelineClient, TimelineClientError } from './client'

const client = createTimelineClient({
  baseUrl: 'https://researchtools.net',
  serviceToken: tokenFromYourServerSecretStore,
  // fetch: customFetch, // optional; must honor redirect: 'manual'
  timeoutMs: 30_000,
})
const result = await client.analyze({ url: 'https://publisher.example/article' }, {
  correlationId: 'your-correlation-id-001',
  signal: abortController.signal,
})
if (result.outcome === 'no_events') {
  // Valid analysis of available content with no datable events.
}
```

The frozen named API is `createTimelineClient(options)` returning:

- `discover(callOptions?): Promise<TimelineCapabilities>`: validates scoped service discovery; it may report timeline unavailable.
- `analyze(input: TimelineInput, callOptions?): Promise<TimelineResult>`: validates input, discovers current support, checks exact scope/version, then submits once.

Options are `{ baseUrl: string, serviceToken: string, fetch?: typeof fetch, timeoutMs?: number }`. Call options are `{ signal?: AbortSignal, correlationId?: string }`. `TimelineInput` is `{ url, content?: { text, source, title?, publishedAt? } }`; the client adds `schemaVersion`. Exported `TimelineClientError` contains stable `code`, optional HTTP `status`, `retryable`, optional `requestId`, `correlationId`, and integer `retryAfterSeconds`. It intentionally omits arbitrary server messages, transport causes, raw URLs, request headers and credentials. `isTimelineResult`, `isIntegrationError`, `datePrecision`, `TIMELINE_VERSION` and `TIMELINE_LIMITS` are exported for consumers/tests. Response objects retain additive wire fields.

Supply recovered text using one of `bot-scrape`, `content-intelligence`, `publisher-feed`, or `browser-render`. Text is limited to 100 KiB UTF-8 and the serialized JSON request to 112 KiB, including escaped characters. The client rejects excess instead of silently truncating. Title is at most 500 UTF-16 code units. Publication dates accept calendar-valid year/month/day or strict ISO timestamps as the endpoint does. Supplied content still passes the server quality floor. Returned event titles/descriptions are bounded to 200/500 UTF-16 code units, with at most 100 events.

The base URL must be a trusted operator-selected HTTPS origin without a path, credentials, query or fragment. This reference client conservatively rejects literal IPs and common private hostname suffixes for both origin and source URLs, while the server may support safe public literal IPs. It does not fetch publisher URLs itself or resolve DNS. The server remains responsible for publisher DNS/redirect policy; the client host's trusted DNS and egress configuration remain responsible for the configured API origin. These lexical checks are not an SSRF boundary for arbitrary API origins.

Every request uses omitted ambient credentials, manual redirects and no-store cache. All 3xx/opaque/observed redirects are rejected, so the standard Fetch implementation cannot forward the bearer to another host. An injected fetch is trusted code and must respect the request options. Each discovery or extraction request, including response streaming, has its own 1–120000 ms deadline (default 30000); therefore `analyze` may take twice that deadline. Bodies are limited to 1 MiB, require JSON content type and valid UTF-8, and are canceled on overflow or abort. Discovery is repeated for each analysis to avoid caching stale readiness.

The client never retries, submits as a guest, fetches content, writes an artifact or follows a redirect. Only a typed `422 content_unavailable` can justify a caller's explicitly bounded source-recovery workflow: reuse existing analysis, then an approved bounded feed/renderer, and resubmit once. `retryable` is information for the caller, not a retry command. Authentication/scope errors, 429, network failures and invalid model output must not trigger additional scraping. Middleware currently emits flat 429 and sometimes flat retryable 503; these map to `rate_limited` and `service_unavailable`. Nested `integration-error.v1` preserves its typed code. Unknown error bodies map to `http_error`; malformed/oversized/non-JSON bodies yield protocol errors.

Schemas are in `docs/api/schemas`, with draft-07 declared explicitly; OpenAPI 3.1 is in `docs/api/openapi/timeline-analysis.v1.json`. Standard JSON Schema checks shapes, enums, required fields and outcome consistency. Calendar semantics, UTF-8 request budgets, UTF-16 limits and DNS safety require additional runtime checks. Published schemas allow additive responses and reject extra request fields. The synthetic corpus at `benchmarks/timeline/corpus-v1` is not historical gold or proof of model quality.

Validation from the repository root, in the credential-free validator only:

```sh
npm exec -- playwright test --config=playwright.timeline.config.ts timeline-reference-client.spec.ts timeline-fixtures.spec.ts --project=chromium
npm exec -- tsc -p tsconfig.timeline-client.json --noEmit
```

Ajv is a test-only dependency used to compile actual published schemas and validate route outputs and counterexamples. The fixture suite mocks the model transport; no live publishers/models or service credentials are used. The dedicated Playwright configuration starts a fresh Vite server at 127.0.0.1:5189. Complete baseline timeline/service suites, full type checks and build are integration-owner acceptance gates; source inspection alone is not a passing receipt.
