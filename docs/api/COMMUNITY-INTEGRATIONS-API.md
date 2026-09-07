# Community Integrations API

**Base URL:** `https://researchtools.net/api/integrations`

**Current contract:** `integration-capabilities.v1`

**Rollout state:** Tranche A foundation; service-consuming operations are not enabled

## Identity boundary

Community integrations use non-interactive service credentials. They are
separate from user JWTs, hashes, guest sessions, bookmarks, and team membership.
A client is bound server-side to one community, private TEAM workspace, system
intake investigation, deployment environment, maximum visibility, and service
principal. Caller headers cannot select another binding and the default workspace
`1` is forbidden.

The principal must be inserted as a new dedicated `users` row with role `service`,
null email/user-hash/account-hash/OIDC identity, and the non-login password sentinel
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
principal, production token, or plaintext feature flag is seeded by migration
`0009_community_service_auth.sql`. Service features remain disabled unless
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
    "capabilities": "integration-capabilities.v1"
  },
  "scopes": ["community.events.write"],
  "capabilities": {
    "anonymousAnalysis": true,
    "publicBcw": true,
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

Tranche A reports every service-consuming capability as false because no existing
product route accepts this service principal yet. This is intentional: a route
file, base URL, configured token, or scope alone is not proof of executable
support. A later tranche can enable a capability only when compiled server
support, the exact feature flag, required runtime bindings, valid tenant state,
the exact scope, and any authoritative budget all agree. Contract versions and
nonzero limits are omitted while their operation is disabled.

## Exact scopes

| Scope | Capability |
|---|---|
| `community.events.write` | `communityIngest` |
| `community.jobs.read` | `jobStatus` |
| `community.artifacts.read` | `artifactRead` |
| `community.projections.read` | `projectionRead` |
| `community.claims.execute` | `claimMatch` |
| `community.research.execute` | `researchQuestions` |
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
  analysis, but it cannot authorize supplied content or persistence;
- a provisioned first-party `X-Service-Key` selects a separate bounded analysis
  rate bucket but grants no identity, scope, or workspace authority;
- the Signal/RSS supplied-content bridge therefore uses a separate legacy user
  credential for identity and the first-party key only for rate classification;
- no integration should send a caller-selected workspace with an `rt_svc_`
  credential or infer durable service support from `anonymousAnalysis`.

The full transitional contract is documented in
[`CONTENT-INTELLIGENCE-API.md`](CONTENT-INTELLIGENCE-API.md). This bridge is not a
replacement for the planned scoped service compute/ingestion adapters. Clients
must keep capability-gated service operations distinct from public analysis and
legacy user-authenticated calls.

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
| 403 | `workspace_denied` | `X-Workspace-ID` conflicts with the server binding |
| 405 | `method_not_allowed` | Method is not `GET` or `OPTIONS` |
| 503 | `auth_datastore_unavailable` | D1, key configuration, or bound identity state cannot be trusted |

`503` includes `Retry-After: 2`. Error responses never include credentials,
digests, SQL, raw private URLs, or tenant identifiers.
