# Community Integrations API

**Base URL:** `https://researchtools.net/api/integrations`

**Current contract:** `integration-capabilities.v1`

**Rollout state:** Tranche A foundation plus scoped timeline analysis

## Identity boundary

Community integrations use non-interactive service credentials. They are
separate from user JWTs, hashes, guest sessions, bookmarks, and team membership.
A client is bound server-side to one community, private TEAM workspace, system
intake investigation, deployment environment, maximum visibility, and service
principal. Caller headers cannot select another binding and the default workspace
`1` is forbidden.

The principal must be inserted as a new dedicated `users` row with role `service`,
the deterministic non-routable username `service_<client-id>` and email
`service+<client-id>@service.invalid`, null user-hash/account-hash/OIDC identity, and the non-login password sentinel
`SERVICE_AUTH_DISABLED`. A formerly interactive user cannot be promoted to this
role. Schema guards prevent later OIDC/login linkage, workspace membership, public
or personal workspace conversion, ownership changes, and intake-investigation
reassignment. Legacy user routes also reject JWTs carrying the service role.

The bearer grammar is exact and case-sensitive:

```text
Authorization: Bearer rt_svc_<client-id>.<43-character-unpadded-base64url-secret>
```

The client ID matches `[a-z0-9][a-z0-9_-]{15,63}`. The plaintext secret is shown
only when an operator provisions or rotates a credential. D1 stores two bounded
slots (`current` and `next`) containing only an opaque token identifier and a
versioned HMAC-SHA-256 digest. `INTEGRATION_TOKEN_HASH_KEY` is a dedicated Workers
secret and is not interchangeable with JWT, telemetry, or webhook keys.

Any bearer using the reserved `rt_svc_` namespace is terminally handled as a
service credential. Invalid, malformed, expired, or revoked credentials never
fall through to user-hash or guest auto-provisioning.

There is deliberately no public credential-creation API in Tranche A. No client,
principal, production token, or plaintext feature flag is seeded by managed
migrations `0009_community_service_auth.sql` and
`0010_service_principal_identity_compat.sql`. Service features remain disabled unless
`COMMUNITY_INTEGRATIONS_ENABLED` is exactly `true`; absence is false.

## Capability discovery

```http
GET /api/integrations/capabilities
```

No query parameters or request body are accepted. `X-Correlation-ID` is optional;
when present it must be 16–128 characters from `[A-Za-z0-9._:-]`. The server
always generates its own request ID.

Anonymous example:

```bash
curl -sS https://researchtools.net/api/integrations/capabilities
```

Service example (placeholder only):

```bash
curl -sS https://researchtools.net/api/integrations/capabilities \
  -H 'Authorization: Bearer rt_svc_<client-id>.<secret>' \
  -H 'X-Correlation-ID: client-request-0001'
```

Successful responses use `Cache-Control: no-store`, never set cookies, and return:

```json
{
  "schemaVersion": "integration-capabilities.v1",
  "requestId": "req-...",
  "identityType": "service",
  "clientId": "community_client_01",
  "communityId": "community-example",
  "workspaceId": "workspace-example",
  "investigationId": "investigation-example",
  "environment": "production",
  "maximumVisibility": "community",
  "contractVersions": {
    "capabilities": "integration-capabilities.v1",
    "timelineAnalysis": "timeline-analysis.v1"
  },
  "scopes": ["community.research.execute"],
  "capabilities": {
    "anonymousAnalysis": true,
    "publicBcw": true,
    "timelineAnalysis": true,
    "communityIngest": false,
    "jobStatus": false,
    "artifactRead": false,
    "projectionRead": false,
    "persistentWorkspace": false,
    "researchQuestions": false,
    "cop": false,
    "behaviorIntake": false,
    "claimMatch": false,
    "feedJobs": false,
    "webhookManagement": false
  },
  "limits": {}
}
```

`timelineAnalysis` is the first service-consuming capability. It is true only
when compiled server support, `COMMUNITY_INTEGRATIONS_ENABLED=true`, D1 and
OpenAI runtime readiness, valid tenant state, and the exact
`community.research.execute` scope all agree. Its contract version is emitted
only while the operation is enabled. The additive `timelineAnalysis` capability
key is omitted while false so pre-extension strict v1 clients remain compatible;
new clients normalize an omitted key to false. All other service-consuming
capabilities remain false. A route file, URL, configured token, or scope alone
is never proof of executable support.

## Exact scopes

| Scope | Capability |
|---|---|
| `community.events.write` | `communityIngest` |
| `community.jobs.read` | `jobStatus` |
| `community.artifacts.read` | `artifactRead` |
| `community.projections.read` | `projectionRead` |
| `community.claims.execute` | `claimMatch` |
| `community.research.execute` | `timelineAnalysis`, `researchQuestions` |
| `community.cop.write` | `cop` |
| `community.behavior.write` | `behaviorIntake` |
| `community.feeds.manage` | `feedJobs` |
| `community.webhooks.manage` | `webhookManagement` |

No wildcard scope exists. `persistentWorkspace` is binding readiness rather than
an independent permission and remains false until an executable persistent
service route ships.

## Content-analysis bridge

`anonymousAnalysis: true` means the public, non-persistent URL-analysis route is
runtime-ready. It does not mean the service bearer is accepted by the legacy user
authorization path. Today:

- an `rt_svc_` credential may call capability discovery and use public URL-only
  Content Intelligence analysis; it does not authorize Content Intelligence
  supplied content or persistence;
- a scoped `rt_svc_` credential may call versioned timeline analysis with URL or
  supplied content when `timelineAnalysis` is advertised;
- a provisioned first-party `X-Service-Key` selects a separate bounded analysis
  rate bucket but grants no identity, scope, or workspace authority;
- the Signal/RSS Content Intelligence supplied-content bridge still uses a
  separate legacy user credential; timeline supplied content uses the scoped
  service bearer, while the first-party key remains rate classification only;
- no integration should send a caller-selected workspace with an `rt_svc_`
  credential or infer durable service support from `anonymousAnalysis`.

The full transitional contract is documented in
[`CONTENT-INTELLIGENCE-API.md`](CONTENT-INTELLIGENCE-API.md). This bridge is not a
replacement for the planned scoped service compute/ingestion adapters. Clients
must keep capability-gated service operations distinct from public analysis and
legacy user-authenticated calls.

## Timeline analysis

Reusable v1 materials: [JSON Schema](./schemas/timeline-analysis.v1.schema.json),
[service error schema](./schemas/integration-error.v1.schema.json),
[OpenAPI operation and discovery](./openapi/timeline-analysis.v1.json), and
[generic server client](../../examples/timeline-client/README.md).
The [frozen synthetic corpus](../../benchmarks/timeline/corpus-v1/manifest.json)
reproduces contract behavior; it does not establish historical extraction quality.


```http
POST /api/tools/extract-timeline
Authorization: Bearer rt_svc_<client-id>.<secret>
Content-Type: application/json
```

The service principal must hold `community.research.execute`, and discovery must
advertise both `timelineAnalysis: true` and contract version
`timeline-analysis.v1`. Service callers must send `schemaVersion`; the legacy
body is intentionally rejected for service identity.

```json
{
  "schemaVersion": "timeline-analysis.v1",
  "url": "https://publisher.example/2026/09/story",
  "content": {
    "text": "Optional analysis-grade recovered article text",
    "title": "Recovered title",
    "publishedAt": "2026-09-08",
    "source": "publisher-feed"
  }
}
```

The optional supplied text is limited to 100 KiB, the complete JSON request is
limited to 112 KiB, and both are evaluated before the model is called. Accepted source labels are
`bot-scrape`, `content-intelligence`, `publisher-feed`, and `browser-render`.
The response returns provenance (`contentSource`, `sourceMode`, method, quality,
word count, and fallback attempts) and preserves event date precision. The
server never fills a missing or invalid event date with its current date.

Clients may try local recovery only after `422 content_unavailable`: reuse an
already-completed content analysis first, then a bounded publisher feed, then an
approved browser renderer, and submit the resulting text once. Do not perform
recovery on `401`, `403`, `429`, network errors, or `502`; those states are not
evidence that the publisher content was unavailable.

`Authorization` and `X-Service-Key` have independent meanings. The `rt_svc_`
bearer grants scoped service identity. `X-Service-Key` only selects a recognized
first-party rate tier where a route supports it and never grants identity or
scope. Do not place either secret in the other's header.

## Errors

Failures use `integration-error.v1`:

```json
{
  "schemaVersion": "integration-error.v1",
  "requestId": "req-...",
  "error": {
    "code": "invalid_service_token",
    "message": "The service credential is invalid or inactive.",
    "retryable": false
  }
}
```

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `invalid_request` | Query parameters or invalid request syntax |
| 401 | `authentication_required` | A supplied credential is not a service credential |
| 401 | `invalid_service_token` | Unknown, malformed, revoked, disabled, or wrong-environment credential |
| 401 | `expired_service_token` | A matching credential is expired |
| 403 | `scope_denied` | The service identity lacks the operation's exact scope or feature enablement |
| 403 | `workspace_denied` | `X-Workspace-ID` conflicts with the server binding |
| 413 | `invalid_request` | Timeline request body exceeds 112 KiB |
| 422 | `content_unavailable` | No analysis-grade timeline source was available; bounded recovery may be attempted |
| 502 | `upstream_invalid_response` | The timeline model response failed strict validation; retryable, but not a scrape-recovery signal |
| 405 | `method_not_allowed` | Method is unsupported (`GET` for capability discovery; `POST` for timeline analysis) |
| 503 | `auth_datastore_unavailable` | D1, key configuration, or bound identity state cannot be trusted |

`503` includes `Retry-After: 2`. Error responses never include credentials,
digests, SQL, raw private URLs, or tenant identifiers.
