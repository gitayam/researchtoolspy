# Remarks Planning API

**Contract:** `remarks-plan.v1` · **Status: implemented**
(`functions/api/research/plan-remarks.ts`, `functions/api/_shared/remarks-contract.ts`).
It is live only where capability discovery advertises it, so clients gate on
discovery, never on this document: an older deployment simply does not
advertise `remarksPlanning`. Design note:
[`../plans/2026-10-07-remarks-planner-design.md`](../plans/2026-10-07-remarks-planner-design.md).

Plans spoken remarks against a declared time slot: a BRIEF Map in, and out
come a word budget, clock marks, pace warnings, a drafted script or answer
cards, placement and fact checks, and a written-submission skeleton. It is
org-neutral: the caller supplies its own voice, and service callers never
persist anything here.

Machine-readable materials: [JSON Schema](./schemas/remarks-plan.v1.schema.json)
and [OpenAPI](./openapi/remarks-plan.v1.json). The route's real responses are
validated against that schema in `tests/e2e/smoke/remarks-planning.spec.ts`, so
the document cannot drift from the code without a failing test.

## Who can call it

| Caller | Auth | Persists? | Enablement |
|---|---|---|---|
| ResearchTools user | session / JWT / hash via `requireAuth` | Optional: `saveToFramework: true` writes a `brief-map` framework session and returns its `id` | `ENABLE_AI_FEATURES=true` for `script`/`trim` modes |
| Scoped service (faydta.com and others) | `Authorization: Bearer rt_svc_<client-id>.<secret>` | Never. `saveToFramework: true` is `400 invalid_request`; the only write is the credential's `last_used_at` | `COMMUNITY_INTEGRATIONS_ENABLED=true`, `REMARKS_SERVICE_ENABLED=true`, scope `community.research.execute` |

The bearer grammar, identity boundary, correlation header, and error document
are the same as every other scoped route; see
[`COMMUNITY-INTEGRATIONS-API.md`](COMMUNITY-INTEGRATIONS-API.md). Keep the
credential server-side. A browser, extension, or static page must never hold
it; faydta.com calls from its Pages Functions, not from React.

### Discover before calling

```http
GET /api/integrations/capabilities
Authorization: Bearer rt_svc_<client-id>.<secret>
```

Proceed only when **all** of these hold:

- `identityType` is `service`
- `capabilities.remarksPlanning` is `true`
- `contractVersions.remarksPlanning` is `remarks-plan.v1`
- `scopes` contains `community.research.execute`

Omission of any field means unavailable. Discovery also advertises the
limits below under `limits` as positive integers:
`remarksRequestBytes`, `remarksScriptChars`, `remarksBranchItems`,
`remarksVoiceChars`.

## Endpoint

```http
POST /api/research/plan-remarks
Content-Type: application/json
Authorization: Bearer rt_svc_<client-id>.<secret>
X-Correlation-ID: <optional, 16–128 chars of [A-Za-z0-9._:-]>
```

One endpoint, four modes. Two of them call no model and are deterministic:
the same input always returns the same output, so a client may cache them.

| `mode` | Needs | Calls a model | Returns |
|---|---|---|---|
| `budget` | `venue` | no | the resolved venue, budget table, allocation, and pace warnings. Show this **before** anyone drafts. |
| `script` | `venue`, `map` | yes | everything in `budget` plus a drafted `script` (or `answerCards` for `qa_only`), counts, placement, fact guard, written submission |
| `trim` | `venue`, `map`, `script` | yes | the caller's script shortened to budget, with the same checks. Wording outside the cut is preserved; see "What trim may change" |
| `check` | `venue`, `script`, optional `map` | no | counts, estimated seconds, warnings, placement, and (with `map`) fact guard for a script the caller wrote or rehearsed |

### Limits

| Limit | Value | On breach |
|---|---|---|
| Request body | 32 KiB UTF-8, measured after read; `Content-Length` is also checked | `413 invalid_request` |
| `script` | 6,000 characters | `400 invalid_request` |
| `voice` | 2,000 characters | `400 invalid_request` |
| Items per map branch | 12; each item 500 characters | `400 invalid_request` |
| `venue.secondsTotal` | 30 to 3,600 | `400 invalid_request` |
| Model input (`script`/`trim`) | bounded by the above; nothing is truncated silently | n/a |

Nothing is ever truncated to fit. Over a limit is a refusal that names the
limit, so a plan is never built from the first half of a map.

## Request

```json
{
  "schemaVersion": "remarks-plan.v1",
  "mode": "script",
  "venue": {
    "format": "statement",
    "bodyName": "Fayetteville City Council public forum",
    "audience": "city council",
    "secondsTotal": 180,
    "secondsHard": true,
    "questionReserveSeconds": 0,
    "questionsLikelyFrom": [],
    "pace": { "preset": "podium" }
  },
  "map": {
    "headline": "DTA asks Council for comparable downtown and citywide police response-time data before October 13.",
    "background": [
      "Downtown Alliance: 26-year volunteer business league; members pay the downtown Municipal Service District tax."
    ],
    "relevance": [
      "At the June 9 Downtown Watch, FCPD asked businesses to call 911 because calls for service justify presence downtown."
    ],
    "information": [
      { "fact": "A witness reported a 20-plus-minute wait after calling about someone being jumped on Hay Street.", "date": "2026-09", "place": "Hay Street", "source": "DTA email to the City Clerk" },
      { "fact": "Two other calls reported waits of about 36 and 40 minutes.", "source": "DTA email to the City Clerk" }
    ],
    "ending": "Comparable response-time data, the status of the downtown officer position, and a Council member at Downtown Watch on October 13 at 6 p.m.",
    "follow_up": [
      { "question": "What about the panhandling ordinance?", "answer": "It is with the city attorneys through Councilman Davis and the city manager. Response time is the gap it will not close." },
      { "question": "Which code section defines downtown?", "answer": "Section 24-132 defines the Core Downtown Area as the Municipal Service District." }
    ]
  },
  "voice": "Warm, plain-spoken, and civic. Lead with the bottom line. Attribute commitments to DTA, not individuals. Never invent a date, amount, or name; write [date] instead."
}
```

### `venue` (required in every mode)

| Field | Type | Required | Notes |
|---|---|---|---|
| `format` | `statement` \| `statement_with_questions` \| `qa_only` \| `open_discussion` | yes | Decides what the clock buys. See the table below. |
| `secondsTotal` | integer 30–3600 | yes | The posted allotment. |
| `secondsHard` | boolean | yes | `true` when a chair enforces it with a clock. Hard targets 92% of the slot; soft targets 100%. |
| `questionReserveSeconds` | integer ≥ 0 | when `format` is `statement_with_questions` | Time held back for questions. Omit on other formats; sending a non-zero value on `statement` is `400`. |
| `questionsLikelyFrom` | array of `chair` \| `members` \| `staff` \| `press` \| `public` \| `partners` | no | Ranks prepared answers. |
| `pace` | `{ "preset": "deliberate" \| "podium" \| "conversational" }` **or** `{ "measured": { "words": int, "seconds": int } }` | yes | The server computes the rate and reports it back. A bare `wpm` number is rejected: the rate must be derived from something the user chose or measured. |
| `audience` | string ≤ 200 | no | Used in the prompt only. |
| `bodyName` | string ≤ 200 | no | Appears in the written-submission header. |

| `format` | Script seconds | Follow-up branch becomes | Response carries |
|---|---|---|---|
| `statement` | `secondsTotal × factor` | the written submission | `script` |
| `statement_with_questions` | `(secondsTotal − questionReserveSeconds) × factor` | prepared answers | `script` and `answerCards` |
| `qa_only` | 0 | answer cards, 30 s each | `answerCards` only; `script` is `null` |
| `open_discussion` | 60 × factor | answer cards | `script` (the opening) and `answerCards` |

`factor` is 0.92 for a hard clock and 1.0 for a soft one. The arithmetic,
so two implementations cannot disagree: `scriptSeconds = floor(seconds ×
factor)`, `targetWords = floor(seconds × factor × wpm ÷ 60)`, `maxWords =
floor(secondsTotal × wpm ÷ 60)`, and `estimatedSeconds = round(wordCount ÷
wpm × 60)`. For 180 seconds, hard, at 135: 165 seconds, 372 target, 405
maximum. The default
`questionReserveSeconds`, if the field is omitted on
`statement_with_questions`, is `round(secondsTotal / 3)`; the resolved value
is always echoed.

### `pace` presets

| preset | words/min | Use when |
|---|---|---|
| `deliberate` | 120 | Recording, older audience, poor microphone, non-native listeners |
| `podium` | 135 | A prepared statement read at a lectern. The documented default, never a silent one |
| `conversational` | 150 | Unscripted answers and Q&A cards |
| `measured` | computed | `words ÷ seconds × 60` from the speaker's own timed read, rounded. Preferred after the first rehearsal |

### `map` (required for `script` and `trim`; optional for `check`)

| Branch | Type | Notes |
|---|---|---|
| `headline` | string ≤ 300 | The ask as one sentence: a verb and a date. |
| `background` | string[] | What the audience does not already know. |
| `relevance` | string[] | Why now, why them. |
| `information` | array of string **or** `{ fact, date?, place?, source? }` | Two or three facts. `source` is never spoken; it is the fact guard's evidence that the fact was supplied, and it is printed in the written submission. |
| `ending` | string ≤ 500 | The ask again with the deadline and what success looks like. |
| `follow_up` | array of string **or** `{ question, answer? }` | Statement formats: the written submission. Question formats: prepared answers. An item with no `answer` in a question format raises `answers_unbudgeted`. |

### Other fields

| Field | Type | Notes |
|---|---|---|
| `script` | string ≤ 6,000 | Required for `trim` and `check`. |
| `voice` | string ≤ 2,000 | A caller-supplied system preamble. This is how an organisation's brand voice reaches the model without ResearchTools storing it. Ignored in `budget` and `check`. |
| `saveToFramework` | boolean | Users only. `true` from a service credential is `400`. |

## Response

```json
{
  "schemaVersion": "remarks-plan.v1",
  "requestId": "req-…",
  "correlationId": "dta-remarks-2026-10-05-0001",
  "id": null,
  "mode": "script",
  "venueResolved": {
    "format": "statement",
    "secondsTotal": 180,
    "secondsHard": true,
    "scriptSeconds": 165,
    "questionReserveSeconds": 0,
    "wpm": 135,
    "paceSource": "preset:podium",
    "targetFactor": 0.92
  },
  "budget": {
    "targetWords": 372,
    "maxWords": 405,
    "marks": [
      { "atSeconds": 60, "words": 135 },
      { "atSeconds": 120, "words": 270 },
      { "atSeconds": 165, "words": 372 }
    ],
    "allocation": [
      { "section": "who", "words": 45 },
      { "section": "ask", "words": 30 },
      { "section": "evidence", "words": 178 },
      { "section": "doing", "words": 63 },
      { "section": "ask_again", "words": 45 },
      { "section": "thanks", "words": 11 }
    ],
    "answerCards": null
  },
  "warnings": [
    { "code": "no_measured_rate", "severity": "info", "message": "This plan uses the podium preset (135 words a minute). Time one read of any 200 words and resubmit with a measured pace." }
  ],
  "script": "…",
  "answerCards": null,
  "wordCount": 361,
  "estimatedSeconds": 160,
  "askPlacement": { "inFirstTwoSentences": true, "inLastSentence": true, "beforeFirstMark": true },
  "factGuard": [],
  "writtenSubmission": {
    "title": "Written comment for the record — Fayetteville City Council public forum",
    "lines": ["…"]
  },
  "model": { "used": true, "tier": "cheap" }
}
```

| Field | Notes |
|---|---|
| `id` | Framework session id for a user who saved; always `null` for a service caller. |
| `venueResolved.paceSource` | `preset:<name>` or `measured`. Always present, so a log line can show what rate a plan assumed. |
| `budget.targetWords` | What to write to. `maxWords` is the hard ceiling at the full allotment; crossing it is `over_budget`. |
| `budget.marks` | Clock marks for the margin of a printed script. The last mark is the script's end, not the allotment's. |
| `budget.answerCards` | `{ count, wordsEach, secondsEach }` for formats with questions, else `null`. |
| `warnings[]` | Advisory, returned together, never auto-fixed. `severity` is `info` or `warning`. Codes are listed below and are stable; messages are not. |
| `script` / `answerCards` | Exactly one of them is populated for `statement` and `qa_only`; both for the mixed formats. `answerCards[]` items are `{ question, answer, words, seconds }`. |
| `estimatedSeconds` | `wordCount ÷ wpm × 60`, rounded. Compare with `venueResolved.scriptSeconds`. |
| `askPlacement` | Whether the headline's sense appears in the first two sentences, the last sentence, and before the first clock mark. Computed by matching at least half of the headline's content words (minimum two), not by exact string. A sentence under four words ("Good evening.") does not count toward the first two. |
| `factGuard[]` | `{ text, kind, position }` for every number, date, year, dollar amount, or capitalised run in the script that appears nowhere in the map. `kind` is `number` \| `date` \| `year` \| `money` \| `name`. Matching ignores case and punctuation, and splits hyphens, so "20-plus-minute" in the map supports "20 minutes" in the script. Bare numbers from 1 to 12 are not flagged ("two calls", "3 things"). A capitalised word that opens a sentence is not treated as a name. Empty means nothing unsupported was found; it does not mean the script is true. |
| `writtenSubmission` | A one-page memo skeleton: header, the ask, the facts with their sources, then every Follow-up item. Plain text lines, no markup. |
| `model` | `{ used, tier }`. `used` is `false` for `budget` and `check`. |

### Warning codes

| code | severity | Fires when |
|---|---|---|
| `over_budget` | warning | `wordCount > maxWords`. `detail.overrunSeconds` says by how much at the resolved rate. |
| `near_budget` | info | `wordCount` is between `targetWords` and `maxWords`. |
| `pace_assumes_fast` | warning | Resolved rate above 150. Nervous speakers run 10–20% faster at the podium. |
| `pace_assumes_slow` | info | Resolved rate below 110. |
| `no_measured_rate` | info | `pace` was a preset. |
| `ask_lost_if_cut` | warning | The ask is not before the first clock mark. |
| `ask_not_last` | info | The ask is not in the last sentence. |
| `no_question_reserve` | warning | `statement_with_questions` with a zero reserve. |
| `answers_unbudgeted` | warning | A question-format Follow-up item has no answer, or its answer exceeds its card. `detail.index` names it. |
| `sentence_too_long` | info | Any sentence over 30 words. `detail.sentences` lists their indexes. |
| `audience_will_not_respond` | info | `statement` format and the script asks a question outside quotation marks. |
| `fact_unsupported` | warning | `factGuard` is non-empty. One warning, with the count. |

### What `trim` may change

`trim` removes and tightens; it does not rephrase facts. The server verifies
the result the way it verifies a draft: every specific in the output must
exist in the map, and the headline must still be in the first two sentences
and the last. A trim that fails those checks is returned as
`502 upstream_invalid_response` with `retryable: true`, and the caller's
original script is untouched. The client should retry once, then fall back
to a human edit.

## Errors

Service callers receive `integration-error.v1`; see the shared table in
[`COMMUNITY-INTEGRATIONS-API.md`](COMMUNITY-INTEGRATIONS-API.md#errors). The
codes this route uses:

| HTTP | code | Meaning here |
|---|---|---|
| 400 | `invalid_request` | Missing or malformed `venue`, `map`, `script`, or `mode`; a field over its limit; `saveToFramework` from a service; a reserve on a format that has none |
| 401 | `authentication_required` / `invalid_service_token` / `expired_service_token` | As shared |
| 403 | `scope_denied` | Missing `community.research.execute`, or either enablement flag is off |
| 405 | `method_not_allowed` | Anything but `POST` |
| 413 | `invalid_request` | Body over 32 KiB |
| 429 | flat middleware error | Gateway rate limit, metered as `service:<clientId>`. Not `integration-error.v1`. Do not retry in a loop |
| 502 | `upstream_invalid_response` | The model's draft or trim failed validation. Retryable once |
| 503 | `auth_datastore_unavailable` | With `Retry-After: 2` |

Error bodies never echo the map, the script, or the voice text.

Users on the interactive site receive the legacy flat `{ "error": "…" }`
shape the rest of `/api/research` returns.

## Calling from faydta.com

**Connecting a new caller** is two operator steps. Provision the credential:

```sh
INTEGRATION_TOKEN_HASH_KEY=<from the operator's record> \
  node scripts/provision-service-client.mjs \
  --client-id dta_admin_portal_01 --community-id faydta \
  --scope community.research.execute --days 365 --out /tmp/dta-client.sql
source ./scripts/cloudflare-account.sh
npx wrangler d1 execute researchtoolspy-prod --remote --file=/tmp/dta-client.sql
```

Then store the printed token as the caller's secret (for faydta.com:
`RESEARCHTOOLS_SERVICE_TOKEN` on the `dta-admin` Pages project). The token is
shown once.


The credential lives in a Pages secret on the admin project and is used only
from `apps/admin/functions`. The browser never sees it. A minimal client:

```ts
// apps/admin/functions/lib/researchtools.ts
const BASE = 'https://researchtools.net'

export interface RemarksPlanRequest { /* mirror of remarks-plan.v1 request */ }
export interface RemarksPlanResponse { /* mirror of remarks-plan.v1 response */ }

export async function planRemarks(
  env: { RESEARCHTOOLS_SERVICE_TOKEN: string },
  body: RemarksPlanRequest,
  correlationId: string,
): Promise<RemarksPlanResponse> {
  const res = await fetch(`${BASE}/api/research/plan-remarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEARCHTOOLS_SERVICE_TOKEN}`,
      'X-Correlation-ID': correlationId,
    },
    body: JSON.stringify({ schemaVersion: 'remarks-plan.v1', ...body }),
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status >= 300 && res.status < 400) throw new Error('unexpected redirect')
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json?.error?.code ?? 'http_error'), { status: res.status, json })
  return json as RemarksPlanResponse
}
```

Rules the caller must keep:

- **Discover first**, at least once per deploy, and treat a missing
  `remarksPlanning` capability as "feature off" in the UI, not as an error.
- **Run `budget` before showing the form**, so the writer sees the container
  before filling it. Run `check` after every timed rehearsal with
  `pace.measured`.
- **Supply `voice` from the organisation's own brand record** (for DTA,
  `buildBrandSystemPrompt()`), never from user input.
- **Never retry 401/403/429 automatically.** Retry `502` once. `retryable`
  is information, not a command.
- **Store the result yourself.** The service path persists nothing. DTA
  attaches the map, the script, and the written submission to its own
  meeting record.
- **Keep the correlation id in your logs.** It is echoed in every error and
  in discovery, and it is the only key an operator on either side can match.
- **Do not send names you have not been given permission to speak.** The
  fact guard checks that specifics came from the map; it cannot know whether
  they may be said aloud.

A `curl` smoke check against a deployment that advertises the capability:

```sh
curl -sS https://researchtools.net/api/research/plan-remarks \
  -H "Authorization: Bearer $RESEARCHTOOLS_SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-ID: smoke-remarks-0001' \
  -d '{"schemaVersion":"remarks-plan.v1","mode":"budget",
       "venue":{"format":"statement","secondsTotal":180,"secondsHard":true,"pace":{"preset":"podium"}}}'
```

Expected: `200`, `budget.targetWords` of 372, one `no_measured_rate` info
warning, `model.used` false.

## Other services

Nothing here is specific to Fayetteville or to DTA. A Signal bot, an RSS
reader, or another civic group's portal calls the same route with its own
credential, its own voice, and its own venue. Presets for named bodies (the
Fayetteville forum's 180-second hard clock, for example) are a caller-side
concern in v1; whether they become shared data is an open decision in the
design note.

## Versioning

`remarks-plan.v1` is additive on the response and strict on the request:
unknown request fields are `400`, new response fields may appear without a
version bump, warning codes are only ever added. A change to a limit, a
format's rule, or the allocation ratios is a new contract version advertised
in discovery.
