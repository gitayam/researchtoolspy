# Cross-product timeline handoff (TL-05 design)

**Nothing described here is built.** No route, table, migration, scope grant or client
exists for this today, in either repository. This document settles the authorization
contract so it can be reviewed before anything is written, in the same way
[`timeline-analysis-v2-migration.md`](./timeline-analysis-v2-migration.md) settles v2
before it is served.

The checkpoint is TL-05 in the implementation register
(`docs/plans/2026-09-11-timeline-implementation-register.md:154`): *"Secure RSS/Signal
handoff into a durable investigation with source lineage and return links,"* accepted by
*"Single-use/expiry/audience tests plus article, multi-article, and story-snapshot round
trips."* Its listed prerequisites are TL-01, TL-03 and TL-04. TL-03 is released and TL-04
is partially released; **TL-01 is still pending**
(`docs/plans/2026-09-11-timeline-implementation-register.md:90`), which matters for the
labels a reader sees on either side of the boundary but not for the contract below.

## The shape of the problem

A reader is looking at `https://rss.irregulars.io/link/<id>` or
`https://rss.irregulars.io/story/<slug>`, or reading a `!timeline` / `!story` reply in
Signal. They want to continue that material as a durable investigation in ResearchTools,
with the lineage intact and a way back.

The obvious design — the RSS worker or the bot writes a timeline into the reader's
ResearchTools workspace on their behalf — is not available, and that is the single fact
that shapes everything else. A service credential is hard-bound to its own private TEAM
workspace and its own intake investigation
(`functions/api/_shared/service-auth.ts:326-334`, and the `serviceBinding` predicate at
`functions/api/_shared/timeline-artifact-auth.ts:58-77`, which pins
`c.workspace_id = proof.workspaceId`). `requireTimelineWorkspace` rejects any workspace
other than that one (`timeline-artifact-auth.ts:40-45`), and the revision trigger
independently re-checks the same binding in SQL
(`schema/managed-migrations/0013_timeline_service_scopes.sql:46-66`). A service principal
cannot become a workspace member (`service-auth.ts:267`, `NOT EXISTS ... workspace_members`).
The integrations contract states the consequence plainly: *"Service tokens cannot select
another workspace or become human members. A saved link conveys no access."*
(`docs/api/COMMUNITY-INTEGRATIONS-API.md:276-277`).

So the handoff cannot carry authority across the boundary. It carries **material**, and
the authority stays where it already is: the reader's own signed-in ResearchTools session.

That yields the whole design in one sentence: **a service credential stages a bounded
lineage payload; a human redeems it once; the durable artifact is then created by that
human through the existing `POST /api/timelines` + `PATCH` path, unchanged.** No new
write path into the timeline store exists, because the handoff never writes a timeline.

## What crosses, in order

1. The reader clicks **Continue in ResearchTools** on an article or story page, or reads
   a `!timeline` / `!story` reply that ends with a handoff link.
2. The originating surface calls `POST /api/timeline-handoffs` with its `rt_svc_`
   credential. ResearchTools stores the payload and returns an opaque token.
3. The originating surface hands the reader
   `<researchtools-base>/dashboard/tools/timeline#handoff=<token>`.
4. The reader opens it. If they are not signed in, nothing is consumed; the page says so.
   If they are, an explicit button calls `POST /api/timeline-handoffs/{token}/redeem`.
5. Redemption returns the payload exactly once and destroys it. The page turns it into a
   local `timeline-workspace.v1` draft, pre-filled with `timeline-evidence.v1` sources and
   assertions, one of which is the return link.
6. The reader saves it with the existing workspace-saving panel
   (`src/components/timeline/TimelineDurablePanel.tsx:80`, `src/lib/timeline-durable.ts:72`).
   From that point it is an ordinary immutable artifact.

Step 6 is deliberately not automated. Choosing a workspace on the reader's behalf would
mean guessing which private workspace they meant, and `requireTimelineWorkspace` requires
an `EDITOR`/`ADMIN` role in a non-public workspace that a given reader may not have at all
(`timeline-artifact-auth.ts:46-52`). The existing panel already asks that question well.

## 1. The token

**Format.** 64 lowercase hex characters — 32 bytes from `crypto.getRandomValues`, the
same generator and shape as presentation tokens
(`functions/api/_shared/timeline-presentation-store.ts:43`, table CHECK at
`schema/managed-migrations/0014_timeline_presentations.sql:2`). It is opaque: no
structure, no embedded claims, no signature.

**Why not a signed token.** A JWT or HMAC envelope would let a stateless verifier accept
it, but every property this contract actually needs — single use, revocation, audience
recorded at mint, a payload larger than a URL — requires a row to be read anyway. Adding a
signature would add a second secret to rotate and a second failure mode, and buy nothing.
It would also make "tampered" a distinct case with a distinct error, when the honest
behaviour is that a modified token is simply a token that does not exist.

**What it binds to.** Nothing, by itself. The bindings live in the row: the minting
`client_id`, the declared `audience` (and its subject, if any), the `expires_at` assigned
by the database, the `payload_hash`, and the `request_key` that makes minting idempotent.
The token is a lookup key for that row and confers exactly what the row says.

**Where minted.** `POST /api/timeline-handoffs`, authenticated by an `rt_svc_` integration
credential carrying `timeline.write`, resolved by the existing
`getIntegrationPrincipalFromRequest` (`functions/api/_shared/service-auth.ts:272`).
`Idempotency-Key` is required, in the same shape as the artifact routes
(`functions/api/_shared/timeline-artifact-contract.ts:71-75`), so a retried mint returns
the same token instead of stranding the first one.

**Where redeemed.** `POST /api/timeline-handoffs/{token}/redeem`, authenticated by
`requireTimelineHuman` (`timeline-artifact-auth.ts:8`). That function rejects a reserved
`rt_svc_` Authorization and any `X-Guest-Session` header outright
(`timeline-artifact-auth.ts:9`), and rejects any resolved user whose role is `guest` or
`service` (`timeline-artifact-auth.ts:36`).

**It is a POST, and the token is in the URL fragment, for two specific reasons.**
Signal unfurls links; browsers prefetch them; crawlers follow them. A `GET` that consumed
the token would be burned by the sender's own client before the recipient ever tapped it.
And a token in the query string reaches Cloudflare's request logs and the `Referer` of
every subresource the SPA loads; a fragment reaches neither, because browsers never send
it to a server. The landing page reads `window.location.hash`, and clears it with
`history.replaceState` before its first `fetch`.

**How single use is enforced.** By a conditional `UPDATE` — a compare-and-set in the
`WHERE` clause — not by a lock and not by a read-then-write. The redeem handler issues one
`env.DB.batch([...])`, which is one transaction; the codebase already depends on exactly
this and says so at `functions/api/_shared/timeline-presentation-store.ts:93`
(*"D1 batch is one transaction: authorization, quota and key checks cannot race"*), and
uses the same conditional-update idiom for revocation at
`timeline-presentation-store.ts:149` (`... WHERE token=? AND owner_id=? AND revoked_at IS NULL ...`).

```
[0]  SELECT json(CASE WHEN EXISTS(<live-human predicate for :userId>) THEN 'null' ELSE '' END)
[1]  UPDATE timeline_handoffs
        SET redeemed_at = unixepoch(), redeemed_by = :userId
      WHERE token = :token
        AND redeemed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > unixepoch()
        AND (audience = 'researchtools-community.v1'
             OR EXISTS (SELECT 1 FROM users u WHERE u.id = :userId AND u.oidc_sub = audience_subject))
      RETURNING payload, payload_hash, origin_return_url
[2]  UPDATE timeline_handoffs SET payload = NULL
      WHERE token = :token AND redeemed_by = :userId
[3]  SELECT redeemed_at, redeemed_by, revoked_at, expires_at, origin_return_url
       FROM timeline_handoffs WHERE token = :token
```

Statement `[0]` is the aborting-assertion pattern already used for service mutations and
presentation writes (`timeline-artifact-auth.ts:87`,
`timeline-presentation-store.ts:25-27`): a non-human caller yields invalid JSON, which
aborts the entire batch before `[1]` can run. Statement `[1]` is the claim. Statement `[2]`
destroys the payload in the same transaction, after `[1]` has already returned it —
`RETURNING` reflects post-update values, and `payload` is not among the columns `[1]`
updates, so the bytes are captured before they are erased. Statement `[3]` exists only to
produce an accurate error message on failure, and to recover `origin_return_url`, which is
never cleared so that an "already used" response can still point the reader home.

**What makes a second redemption fail:** `AND redeemed_at IS NULL` in `[1]`. Once the
first transaction commits, that predicate is false forever, `[1]` matches zero rows,
`results[1].results` is empty, and the handler returns `409 handoff_already_redeemed`
without touching the payload — which `[2]` has already set to `NULL` in any case. There is
no replay window and no same-principal retry: a lost response means the material must be
requested again from the originating surface, which costs one `!timeline` re-run or one
page reload. That is the price of being able to state "single use" without qualification,
and it is the right trade here because the material is always re-derivable.

**Concurrent redemption (two clicks at once).** D1 serializes write transactions on a
database, so the two batches are ordered rather than interleaved. The first to commit
performs the claim and receives one `RETURNING` row. The second then runs against the
committed state: its `[0]` still passes, its `[1]` matches zero rows, its `[3]` reports a
non-null `redeemed_at`, and it returns `409`. Neither transaction can observe a
half-claimed row, because neither can observe the other's uncommitted writes.

**The primitive was checked before it was relied on.** `wrangler.toml` binds D1 (`DB`),
three KV namespaces, R2, a service binding and two Analytics Engine datasets — **and no
Durable Object**. There is no DO namespace anywhere in this repository, so a DO cannot be
the coordination point. KV cannot be either: the middleware already documents that KV
reads are edge-cached for up to ~60s and that its own rate limiter is therefore
burst-permeable and fail-open (`functions/api/_middleware.ts:10-15`) — acceptable for a
budget, disqualifying for an exactly-once claim. D1's conditional `UPDATE` inside a batch
is the only strongly-consistent atomic primitive in this stack, it is already load-bearing
for branch CAS (`schema/managed-migrations/0011_timeline_foundation.sql:159-164`) and
idempotency (`0011_timeline_foundation.sql:113-126`), and it is what this design uses.

One thing to verify in the first slice rather than assume: `RETURNING` is used in this
codebase (`functions/api/_shared/auth-helpers.ts:80`,
`functions/api/auth/oidc/callback.ts:229`, `functions/api/frameworks/index.ts:57`,
`functions/api/frameworks/behavior/intake.ts:205`,
`functions/api/frameworks/deception/intake.ts:139`), but **never inside `DB.batch()`**.
The Miniflare D1 test must assert that `results[1].results` carries the returned row, and
fall back to a re-`SELECT` of the payload as `[2]` (before the nulling `UPDATE`) if it does
not.

## 2. Expiry

**Thirty minutes from mint.** Long enough for the realistic path — read the Signal message
on a phone, move to a laptop, sign in to ResearchTools through an Authentik redirect that
may itself require MFA, then click. Short enough that a token surviving in a Signal backup
export, a screenshot, or a forwarded message is dead on arrival.

`expires_at` is assigned by the database as `unixepoch() + :ttl` inside the mint
statement, and checked by the database as `expires_at > unixepoch()` inside the redeem
statement. The minting client's clock never enters the computation, and the redeeming
browser's clock never enters the decision. Both columns are `INTEGER` epoch seconds with
`typeof(...)='integer'` CHECKs, matching the discipline already applied to
`integration_client_tokens.not_before` / `expires_at`
(`functions/api/_shared/service-auth.ts:214-218`, SQL predicates at
`0013_timeline_service_scopes.sql:56-59`) rather than the ISO-text columns used where no
SQL comparison happens.

**What an expired link shows.** The landing page has already read the fragment and
attempted nothing. The reader presses the button; the redeem call returns
`410 handoff_expired` with `origin_return_url`. The page renders, in the reader's own
language rather than an error code:

> This handoff link expired. Handoff links last 30 minutes.
> [Open the original story](…) and choose *Continue in ResearchTools* again.

The link in that sentence is the `origin_return_url` from the row — the one field that
survives both expiry and redemption — so the dead end always has an exit. Nothing is
logged about the reader beyond the ordinary product-analytics request record
(`functions/api/_middleware.ts:207-217`); the token is never logged, matching the
presentation store's rule that *"No exception, token or payload is logged or returned"*
(`timeline-presentation-store.ts:17`).

## 3. Audience and scope

### The minting side maps onto `timeline.write`

`timeline.write` already exists (`functions/api/_shared/integration-contract.ts:18`, CHECK
at `0013_timeline_service_scopes.sql:26`) and already means *this credential may cause
durable timeline content to come into existence*. Minting a handoff is a strictly smaller
act than what that scope already permits: `POST /api/timelines` creates a real artifact
row in the credential's own workspace, whereas a mint creates a staged payload attached to
no workspace at all. Everything the mint needs — an active client, a live non-revoked token
in `current` or `next` slot, database-time validity, a bound audience and environment, a
per-token scope row, revocation, rotation — `timeline.write` already carries, enforced by
the same query at `service-auth.ts:286-334`.

So: **no new scope.** The accepted side effect is that a credential provisioned for
handoff minting can also create artifacts in its own service workspace. That is contained
by construction and observable in that workspace; it cannot reach a human's workspace.

Discovery gains one capability name, `timelineHandoffMint`, gated on
`timeline.write` in `REQUIRED_SCOPE` (`integration-contract.ts:79-93`) and advertised only
when the scope, the `COMMUNITY_INTEGRATIONS_ENABLED` flag and the D1 runtime are all
present (`functions/api/integrations/capabilities.ts:88-95`). It is omitted when false,
like the three existing timeline capabilities (`integration-contract.ts:221-223`), so the
`integration-capabilities.v1` document a current consumer sees is byte-identical until the
scope is granted. `timeline-analysis.v1` is untouched: the handoff neither extends nor
consumes the extraction contract.

### The redeeming side maps onto no scope at all

A redeemed token authorizes **exactly one thing**: reading one staged payload, once.

It must **not** authorize, and the design must make each of these impossible rather than
merely unintended:

| Must not | What prevents it |
|---|---|
| Any read of an existing artifact | The redeem route never touches `timeline_artifacts`; the four GET routes still demand `timeline.read` or a human workspace role (`timeline-artifact-auth.ts:92-99`, `timeline-artifact-store.ts:17-28`) |
| Any write to any artifact | Same — creating the artifact is a separate, later, human-authenticated `POST`/`PATCH` with its own `Idempotency-Key` and `If-Match` |
| Selecting or naming a workspace | The payload contains no workspace identifier, and redemption returns no workspace. The reader picks one in the existing panel (`TimelineDurablePanel.tsx:46-50`) |
| Redemption by a guest | `requireTimelineHuman` rejects `X-Guest-Session` (`timeline-artifact-auth.ts:9`) and role `guest` (`:36`) |
| Redemption by a service principal | `isReservedIntegrationAuthorization` short-circuits to `403 human_identity_required` (`timeline-artifact-auth.ts:9`); role `service` is rejected again at `:36` |
| Acting after the minting credential is revoked | The mint row records `client_id`; statement `[1]`'s predicate can be extended to require the client still be `active`, and revocation of the credential is followed by revoking its outstanding handoffs (see failure modes) |
| Being reused | `AND redeemed_at IS NULL` |
| Being transferred to a different person, where the origin knew who the person was | The `audience` check in `[1]` |

### The two audiences

`audience` is declared at mint and is one of exactly two values.

`researchtools-oidc-subject.v1` carries `audience_subject`, an Authentik `sub`.
Redemption requires the redeeming human's `users.oidc_sub` to equal it. Both products
authenticate against the same Authentik instance — ResearchTools through the
`researchtools` provider (`wrangler.toml` `OIDC_ISSUER`) and the RSS reader through the
`irregulars-io` provider (`apps/rss-reader/wrangler.toml:44`) — and ResearchTools already
resolves a returning user by that claim (`functions/api/auth/oidc/callback.ts:148-151`).
**Whether the two providers emit the same `sub` for the same person must be verified
before this audience is used; see Open questions.**

`researchtools-community.v1` carries no subject. Any principal that passes
`requireTimelineHuman` may redeem. This exists because a Signal group reply is visible to
the whole group and there is no one person to bind it to. It is a real widening, and it is
acceptable only because of what the payload contains: public article URLs, public RSS
reader page URLs, titles, publishers, recorded dates. No article body text, no reader
identity, no group identity, no workspace identity. The worst outcome of a leaked
community-audience token is that some other member of the community seeds a timeline draft
from public links — and then loses the race, so the intended recipient asks for a fresh
one.

The RSS reader should mint subject-bound tokens only. It already has an OIDC session
whose `userId` is the `sub` (`apps/rss-reader/src/auth/session.ts:27-44`,
`src/types.ts:30-40`) and already has a login redirect for anonymous readers
(`src/auth/handlers.ts`), so the button should require a session rather than fall back to
the wider audience. The Signal bot mints community-audience tokens for group replies, and
its reply text must say the link is single use and expires in 30 minutes, because in a
group the first tap wins.

**There is no audience that admits a guest, a service principal, or an anonymous visitor.**
This matters more than it looks: the bot's existing ResearchTools identity is a *guest*.
`deriveResearchToolsUserHash(senderAci)`
(`packages/shared-utils/src/bot-utils/researchtools-client.ts:280-295`) produces an
`X-User-Hash` that ResearchTools auto-provisions as a guest account, and
`requireTimelineHuman` rejects guests at `timeline-artifact-auth.ts:36`. A Signal user's
derived hash therefore cannot be the redeeming principal and cannot be used as an audience
subject. The redeemer must be a real signed-in ResearchTools account. Say so in the bot's
reply.

## 4. The lineage payload

The mint body is `timeline-handoff-request.v1`; the redeemed document is
`timeline-handoff.v1`. Both are capped at **65536 bytes**, reusing
`ARTIFACT_LIMITS.requestBytes` (`timeline-artifact-contract.ts:5`) and its bounded
streaming reader (`timeline-artifact-contract.ts:83-104`) rather than inventing a second
limit, so the number already advertised as `timelineRequestBytes`
(`integration-contract.ts:228`) stays the single answer to "how big can a request be".

```json
{
  "schemaVersion": "timeline-handoff.v1",
  "kind": "article",
  "title": "Content update deployed",
  "origin": {
    "product": "irregulars-rss",
    "returnUrl": "https://rss.irregulars.io/link/abc123",
    "returnLabel": "IrregularChat Links — Content update deployed"
  },
  "mintedAt": "2026-09-15T14:02:11.000Z",
  "items": [
    { "url": "https://publisher.example/story", "title": "…", "publisher": "publisher.example",
      "publishedAt": "2024-07-19", "returnUrl": "https://rss.irregulars.io/link/abc123" }
  ],
  "events": [
    { "eventDate": "2024-07-19", "datePrecision": "day", "title": "…", "description": null,
      "category": "event", "importance": "normal", "sourceUrls": ["https://publisher.example/story"] }
  ]
}
```

Bounds, each chosen to match a limit the workspace codec already enforces so that a
payload which mints can always be decoded: `items` ≤ 100 (`src/lib/timeline-evidence.ts:33`
caps `sources` at 100), `events` ≤ 100 (`src/lib/timeline-workspace-codec.ts:107` caps
`source.events` at 100), and the derived assertions ≤ 200
(`src/lib/timeline-evidence.ts:41`). A story with more coverage than that is truncated at
the mint, and the payload says so with a `truncated: true` flag the landing page surfaces
— silently dropping sources would be the one thing a lineage contract must never do.

### The three accepted cases

**Single article.** `kind: "article"`, one item. From the RSS reader, `origin.returnUrl` is
the `/link/<id>` page (`apps/rss-reader/src/index.ts:1293-1294`) and `items[0].url` is the
publisher URL from `Link.url` (`apps/rss-reader/src/types.ts:69`). Events come from
`Link.timeline.events` (`apps/rss-reader/src/types.ts:133-144`) when the article already
has one, and are empty otherwise. From the bot, the same fields are in memory at reply
time in `handleTimelineExtract`
(`selfhost/messaging-apps/signal-messenger/src/src/bot/commands/utility/url-tools.ts:1664`).

**Multi-article.** `kind: "article-set"`, several items, events merged. The bot's
`handleMultiUrlTimeline` (`url-tools.ts:1533-1620`) already computes exactly this: a
canonical-event list with a `source_count` per event and a `MergeArticleResult[]` naming
each contributing article. `origin.returnUrl` is the first article's page, since there is
no single page for an ad-hoc set.

**Story snapshot.** `kind: "story-snapshot"`. `origin.returnUrl` is
`<rss-base>/story/<slug>` — the canonical slug form, because the reader canonicalizes
aliases with a 301 (`apps/rss-reader/src/index.ts:1123-1129`). Items come from
`StoryView.recentLinks`, up to 24 rows carrying url, domain, title and event count
(`selfhost/messaging-apps/signal-messenger/src/src/services/story-query-service.ts:818-822`)
— a list the bot already computes and currently discards without rendering
(`url-tools.ts:2027-2072`). Events come from `StoryView.events`, each with `sourceCount`.
The snapshot also carries `coverage.eventCount` and `coverage.sourceCount` so the reader can
see that they took a slice of a larger, moving body of coverage, and `storyRevision` (the
FNV-1a digest at `apps/rss-reader/src/utils/story-revision.ts:13-23`) so the slice is
identifiable later.

### What deliberately does not cross

**Article body text.** The bot holds the full `extracted_text` at reply time
(`researchtools-client.ts`, `ContentAnalysisData.extracted_text`), and `extract-timeline`
already accepts supplied content with `source: 'publisher-feed'`
(`functions/api/tools/extract-timeline.ts:78-80`). Carrying it would save a re-fetch. It
is still excluded, for one reason that is not about size: supplied content to
`extract-timeline` is transient, whereas a handoff payload is **stored at rest** for the
expiry window. Storing publisher body text in a third product's database for thirty
minutes is a rights and retention decision, and it is not one this contract needs to make
— the reader can run extraction themselves from the seeded draft, through the ladder that
already exists. If a later revision wants it, it should arrive as an explicit
`content` block with its own review, not by accident.

**Anything identifying the requester or the channel.** No Signal ACI, no phone number, no
`groupId`, no derived `X-User-Hash`, no rss-reader session or feed token. The bot's
`!drop`-style anonymity carve-out (`researchtools-client.ts:305-307`) exists for a reason
and this path respects it by default rather than by exception.

**Anything ResearchTools-side.** No workspace id, no artifact id, no user id. The payload
is written by a service credential that has no business knowing those, and a payload that
named them would be a lateral-movement primitive.

**Any analyst judgment.** No `assessment` other than `unreviewed`, no
`TimelineEvidenceReview`, no `TimelineSourceEvaluation`, no `TimelineJudgments`. The RSS
reader's corroboration count ("also reported by N other sources",
`url-tools.ts:1849-1888`) is carried as a fact on the event, never as an independence
review — `reviews` is an analyst's conclusion about source dependence
(`src/lib/timeline-evidence.ts:75-83`) and a cross-product import has no standing to make
it.

## 5. The return link, and how it survives

The return link is not a column and not metadata. It is a
**`timeline-evidence.v1` source record inside the workspace payload**, which means it is
inside the content that gets hashed into an immutable revision.

On redemption the page builds a `timeline-workspace.v1` export
(`src/types/timeline-workspace.ts:200-205`) whose `analystWorkspace.evidence` is:

- `sources[0]` — the originating surface itself:
  `{ id: "handoff:origin", url: origin.returnUrl, title: origin.returnLabel,
  publisher: <hostname of returnUrl>, retrievedAt: mintedAt }`.
- `sources[1..n]` — one per item, with the publisher URL, title, publisher, `publishedAt`
  and `retrievedAt`.
- `assertions[]` — one per (event, item) pair, `epistemicType: "reported_claim"`,
  `status: "active"`, `derivesFrom: []`, `claimText` the event title, `temporalClaim` the
  recorded date text as the origin stated it, and a `passage` whose `quote` is empty and
  whose `locator` reads, in full: *"Recorded in the IrregularChat links reader as part of
  story `<slug>` at `<mintedAt>`. Aggregated listing, not a verified quotation from the
  source."* The codec permits an empty `quote` but requires a non-blank `locator`
  (`src/lib/timeline-evidence.ts:53`), and that sentence is the honest thing to put there.
- `links[]` — `relation: "supports"` from each event to its assertion.
- `reviews[]` — empty, per the previous section.

Workspace events are `origin: "source"`, `assessment: "unreviewed"`, `modified: false`,
`analystNote: ""`. The workspace `source` block is
`{ schemaVersion: "timeline-manual.v1", title }`, because the handoff ran no extraction and
claiming `timeline-analysis.v1` would fabricate a `requestId`, an extraction quality score
and a model status that nothing produced.

**Why this survives.** `workspaceVersionForEvents`
(`src/lib/timeline-workspace-codec.ts:8-12`) returns `timeline-workspace.v1` for this
content, because it selects the version from content and the seeded draft has neither
`recordedEnd` nor `dateApproximate`. So `prepareTimelineSave`
(`src/lib/timeline-durable.ts:38-46`) commits `kind: "timeline-workspace.v1"`, the payload
passes `validArtifactPayload` (`timeline-artifact-contract.ts:46-55`) through the same
strict per-version key allow-list as any hand-built v1
(`timeline-workspace-codec.ts:152`), and the export bytes of a handoff-seeded timeline are
indistinguishable from those of one typed by hand. **No persisted shape changes, so no new
workspace version is needed.** Every later revision re-puts the whole workspace object
(`timeline-durable.ts:41`, object id `browser-workspace` at `:6`), so the source record —
and with it the return link — is carried into every revision and is recoverable from any
of them through `GET /api/timelines/{id}/objects?revisionId=…`.

**No hardcoded hostnames.** `origin.returnUrl` is built by the minting side from its own
configuration: the RSS worker from `env.SITE_URL` (`apps/rss-reader/wrangler.toml:41`),
the bot from `RSS_READER_URL()`
(`url-tools.ts:787-791`, `process.env.RSS_READER_URL || "https://rss.irregulars.io"`).
ResearchTools stores and echoes that string and never composes it. In the other direction
the bot builds the handoff URL from `RESEARCHTOOLS_API_URL` using the existing `rtBaseUrl()`
shape (`selfhost/messaging-apps/signal-messenger/src/src/bot/commands/utility/frameworks.command.ts:97-100`),
and the RSS worker needs a new `RESEARCHTOOLS_URL` var of the same kind. The
ResearchTools-side deep link to the saved artifact is already derived, not literal
(`src/lib/timeline-durable.ts:90-92`, `window.location.origin`).

One thing to avoid copying: `apps/rss-reader/src/templates/link-detail.ts:868` hardcodes
`https://rss.irregulars.io/link/…` rather than reading `env.SITE_URL`, unlike the story
page (`apps/rss-reader/src/index.ts:1141-1144`). The handoff must use the configured value.

## 6. Failure modes

| Case | What the reader sees | What is logged |
|---|---|---|
| **Revoked** (minting credential revoked, or the handoff explicitly revoked) | `403 handoff_revoked` → *"This handoff link was withdrawn."* plus the return link | One structured line: token prefix (first 8 hex), `client_id`, `revoked_at`. Never the full token, never the payload (`timeline-presentation-store.ts:17`) |
| **Replayed** (second redemption, same or different person) | `409 handoff_already_redeemed` → *"This link was already opened. Ask for a fresh `!timeline`, or open [the story] and choose Continue in ResearchTools again."* | Token prefix, `redeemed_at`, and whether `redeemed_by` matched the caller. A mismatch is the interesting signal and should be countable |
| **Tampered** (any edit to the 64 hex characters) | `404 handoff_not_found`, identical in wording and timing to a token that never existed | Token prefix only. A malformed token (wrong length or non-hex) is rejected before any query, as presentations do (`timeline-presentation-store.ts:35-38`) |
| **Wrong audience** (subject-bound token, different signed-in person) | `403 handoff_audience_denied` → *"This link was prepared for a different account. Sign in as that account, or open [the story] and start a new handoff."* Crucially **not** consumed — the audience check is inside `[1]`'s `WHERE`, so a mismatched redeemer never sets `redeemed_at` and the intended recipient can still use it | Token prefix, audience kind, and that a mismatch occurred. Never the subject value of either side |
| **Clock skew** | Nothing. Both the assignment and the check of `expires_at` happen in SQL against `unixepoch()`, so no client clock participates. A skewed browser clock can only mis-render the countdown, never change the decision | — |
| **ResearchTools down at mint** | RSS: the button posts to the worker, which returns its own page with *"ResearchTools is not reachable right now. The story is unchanged; try again shortly."* Signal: `deps.featureDisabled('handoff to ResearchTools')`, the existing calm one-liner. The `!timeline` / `!story` reply itself still sends, minus the handoff line — the handoff must never be able to suppress the answer | `503`/timeout with the correlation id the capability client already sends (`researchtools-capabilities.ts:1027-1095`) |
| **ResearchTools down at redeem** | `503 datastore_unavailable` with `Retry-After: 2`, matching the artifact envelope (`timeline-artifact-contract.ts:133-137`), and *"Try again in a moment — your link has not been used."* True, because `[0]`/`[1]` abort atomically | Standard 503 record |
| **RSS down** | The handoff is unaffected — it is already staged at ResearchTools and contains everything needed. Only the return link 404s later, which is visible as a dead source URL in the evidence panel and nowhere else. The seeded timeline is complete without it | — |
| **Payload fails its hash check on redemption** | `503 datastore_unavailable`, treated as corrupt storage exactly as `objectDocument` does (`timeline-artifact-store.ts:173`) | Token prefix and `payload_hash` mismatch — this should page someone |

## 7. Storage

One forward-only migration, `0016_timeline_handoffs.sql`, modelled directly on
`0014_timeline_presentations.sql`: one table, one index, an insert guard, an update guard
that permits only the legal transitions, and a delete guard that permits none.

```sql
CREATE TABLE timeline_handoffs (
  token TEXT PRIMARY KEY NOT NULL CHECK(length(token)=64 AND token NOT GLOB '*[^0-9a-f]*'),
  client_id TEXT NOT NULL,
  minted_by INTEGER NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  audience TEXT NOT NULL
    CHECK(audience IN ('researchtools-community.v1','researchtools-oidc-subject.v1')),
  audience_subject TEXT,
  origin_return_url TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
  payload TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  redeemed_at INTEGER,
  redeemed_by INTEGER REFERENCES users(id),
  revoked_at INTEGER,
  UNIQUE(client_id, request_key),
  CHECK((audience='researchtools-oidc-subject.v1') = (audience_subject IS NOT NULL)),
  CHECK(typeof(created_at)='integer' AND typeof(expires_at)='integer' AND expires_at > created_at),
  CHECK((redeemed_at IS NULL) = (redeemed_by IS NULL)),
  CHECK(payload IS NULL OR length(CAST(payload AS BLOB)) <= 65536)
);
```

The insert guard re-uses the `0013` service predicate verbatim to require that
`minted_by` is a live service principal whose client holds `timeline.write` at insert time,
so a direct SQL insert cannot forge a handoff any more than it can forge a revision. It
also enforces a per-client quota of unredeemed, unexpired, unrevoked rows — the same idea
as the 20-link presentation quota (`0014_timeline_presentations.sql:16`), sized higher
because link volume is higher. The quota lives in the transaction rather than in the KV
rate limiter precisely because KV is documented as burst-permeable and fail-open
(`functions/api/_middleware.ts:10-15`).

The update guard permits three column changes and aborts on everything else: `redeemed_at`
and `redeemed_by` set together exactly once, `revoked_at` set exactly once, and `payload`
moving to `NULL` and never back. The delete guard always aborts, matching every other
timeline table (`0011_timeline_foundation.sql:224-290`).

Rows are never deleted, so a sweep is about bytes, not rows: a new
`functions/api/cron/cleanup-handoffs.ts` beside the existing cleanup functions nulls
payloads where `expires_at <= unixepoch()` and the redeem path has not already done so.
A spent row is roughly 300 bytes; at a hundred thousand handoffs a year that is about
30 MB annually against D1's 10 GB ceiling, which is a cost worth paying for a permanent,
queryable record of what was handed off, to whom, and whether it was used.

`functions/api/_middleware.ts` gains a `/api/timeline-handoffs` branch alongside the
presentations branch at `:190-203`: `no-store`, `Referrer-Policy: no-referrer`,
`X-Robots-Tag: noindex,nofollow`, a same-origin `Origin` check for browser calls, and a
405 for anything but the declared methods.

## 8. What this design does not do

- It does not create an artifact. Redemption produces a local draft; the human saves it.
- It does not change `timeline-analysis.v1`, its schema, its endpoint, or what capability
  discovery says about it.
- It does not require `timeline-analysis.v2`. The handoff carries calendar dates with a
  `datePrecision`, which is v1's vocabulary. When v2 is served, the handoff's per-item
  `sourceUrls` become natural v2 `assertions` with `sourceRef`s, and the payload version
  can move to `timeline-handoff.v2` without touching v1 consumers.
- It does not add a persisted workspace version. The seeded draft is v1 by content.
- It does not add a scope, a credential, or a new authentication mechanism.
- It does not make the RSS reader or the bot able to read anything out of ResearchTools.

## Open questions

1. **Does Authentik emit the same `sub` for the same person across the `researchtools` and
   `irregulars-io` providers?** The whole subject-bound audience rests on it. `ADMIN_USER_IDS`
   in `apps/rss-reader/wrangler.toml:56` is a 64-hex value, which is Authentik's hashed-user-id
   subject format, and ResearchTools stores the same kind of value in `users.oidc_sub`
   (`functions/api/auth/oidc/callback.ts:148-151`) — consistent with a per-user rather than
   per-provider subject, but not proof. Verify by signing one account into both and comparing.
   The global operations notes also record that Authentik has changed `sub` format across
   versions (UUID → SHA256), so this needs a post-upgrade check, not a one-time one.
   If the answer is no, subject-bound audience must key on something else (verified email,
   or a mapping table) or be dropped in favour of community audience everywhere.
2. **Is thirty minutes right?** It is a judgement, not a derivation. The competing numbers
   are the OIDC access-token validity the project recommends (1 hour) and the rss-reader
   OIDC state TTL (600s, `apps/rss-reader/src/auth/oidc.ts:7`). If sign-in-then-MFA
   commonly runs long, 60 minutes with the same single-use rule is defensible.
3. **Should a group-minted Signal handoff be single-use at all?** Single use in a group
   means the first tap wins. The accepted test says single use, so v1 ships it, but a
   `max_redemptions` column with a per-audience default is the obvious escape hatch and
   should be decided before the table is created rather than after.
4. **Does `RETURNING` populate `results` inside `DB.batch()` on D1?** Used in this
   codebase, never inside a batch. Slice 1 must assert it; the fallback is a `SELECT`
   before the nulling `UPDATE` in the same batch.
5. **Who provisions the RSS reader's `rt_svc_` credential, and in which workspace?**
   Credential provisioning is documented as a separately authorized operator step
   (`docs/api/COMMUNITY-INTEGRATIONS-API.md:288-291`) and no client exists for the RSS
   worker today.
6. **Is `timelineHandoffMint` the right capability name, or should minting be implied by
   `timelineWrite`?** Adding a name is additive and omittable, but it is still a public
   contract surface. A reviewer may prefer no new name at all, with the route simply
   requiring the scope.

## Things found while investigating that are not part of this design

Two of these block TL-05; the third does not but will bite someone.

**The monorepo's capability consumer will reject ResearchTools' response the moment a
timeline scope is granted to any credential.** `packages/shared-utils/src/bot-utils/researchtools-capabilities.ts`
is a strict parser, and it is stale in four independent places:

- `RESEARCHTOOLS_INTEGRATION_SCOPES` (`:39-49`) lacks `timeline.read` and `timeline.write`,
  and `parseScopes` (`:451-461`) returns `null` — rejecting the whole document — for any
  scope not in that set.
- `RESEARCHTOOLS_CAPABILITY_NAMES` (`:12-28`) lacks `timelineRead` and `timelineWrite`, and
  `parseCapabilities` (`:464-467`) returns `null` for any capability key it does not know.
- `parseContractVersions` (`:486`) allows only `capabilities`, `timelineAnalysis`,
  `sourceEvent`, `artifact`, `projection` — so `contractVersions.timelineArtifact`
  (`functions/api/_shared/integration-contract.ts:215`) is rejected.
- `parseLimits` (`:522`) allows only `claimMatchCandidates` and `maxBatchUrls` — so the five
  `timeline*` limits (`integration-contract.ts:227-233`) are rejected.

A rejected document throws `ResearchToolsCapabilityError`, which disables *every*
capability the bot reads from discovery, including `timelineAnalysis`. The concrete
consequence: granting `timeline.write` to the bot's existing token today would break
`!timeline` entirely. This is exactly the hazard the integrations doc warns about —
*"older code rejects unknown scopes, even on existing extraction/discovery routes"*
(`docs/api/COMMUNITY-INTEGRATIONS-API.md:288-291`). **Slice 0 below must land and deploy
before any scope is assigned.**

**`timeline-workspace.v3` cannot be saved durably, and nothing stops a user from trying.**
The codec accepts v3 (`src/lib/timeline-workspace-codec.ts:88`) and
`workspaceVersionForEvents` emits it for any event with `dateApproximate` (`:10`), but
`ArtifactKind` stops at v2 (`functions/api/_shared/timeline-artifact-contract.ts:13`),
`objectDocument` allows only v1/v2 (`functions/api/_shared/timeline-artifact-store.ts:167`),
`readBrowserSnapshot` allows only v1/v2 (`src/lib/timeline-durable.ts:115`), and the
migration CHECKs stop at v2 (`schema/managed-migrations/0015_timeline_workspace_intervals.sql:25,37`).
There is no client-side guard: `prepareTimelineSave` (`src/lib/timeline-durable.ts:38-46`)
will happily send `kind: "timeline-workspace.v3"` and receive a generic 400. This design
sidesteps it — handoff drafts are v1 — but a reader who marks one imported date as circa
and then saves will hit it.

**The RSS reader has no ResearchTools client at all**, despite `@irregularchat/shared-utils`
already being a dependency (`apps/rss-reader/package.json:17`). The existing
`researchtools-client.ts` lives under `bot-utils` and imports `node:crypto` and
`node:fs/promises` (`packages/shared-utils/src/bot-utils/researchtools-client.ts:10-11`),
which a Worker bundle should not pull in wholesale. The RSS worker needs a small dedicated
mint client, not an import of that module.

## Implementation slices

Each slice is independently shippable and independently revertible. Slices 0–3 deliver the
accepted tests; 4 and 5 are the two user-facing surfaces.

**Slice 0 — unblock the scope grant (monorepo only, no ResearchTools change).**
Bring the strict consumer up to the deployed contract so that granting a timeline scope
does not break discovery.
- `packages/shared-utils/src/bot-utils/researchtools-capabilities.ts` — add
  `timeline.read` / `timeline.write` to `RESEARCHTOOLS_INTEGRATION_SCOPES` (`:39`), add
  `timelineRead` / `timelineWrite` to `RESEARCHTOOLS_CAPABILITY_NAMES` (`:12`) **with the
  same `hasOwn` carve-out `timelineAnalysis` already has at `:471-474`**, since the server
  omits them when false; allow `timelineArtifact` in `parseContractVersions` (`:486`) and
  the five `timeline*` keys in `parseLimits` (`:522`).
- `packages/shared-utils/src/__tests__/researchtools-capabilities.test.ts` — a fixture of
  the real scoped document.
Ship and deploy this before anything else. It is useful on its own.

**Slice 1 — the store (ResearchTools only).** Table, triggers, mint, redeem, revoke. No UI.
- `schema/managed-migrations/0016_timeline_handoffs.sql`
- `functions/api/_shared/timeline-handoff-contract.ts` — `timeline-handoff-request.v1` /
  `timeline-handoff.v1` validators, reusing `boundedBody`, `canonicalJson`, `hashContent`,
  `idempotencyKey` and `artifactResponse` from `timeline-artifact-contract.ts`
- `functions/api/_shared/timeline-handoff-store.ts` — the three operations and the redeem batch
- `functions/api/timeline-handoffs/index.ts` (POST mint)
- `functions/api/timeline-handoffs/[token]/index.ts` (DELETE revoke)
- `functions/api/timeline-handoffs/[token]/redeem.ts` (POST redeem)
- `functions/api/cron/cleanup-handoffs.ts`
- `functions/api/_middleware.ts:190` — the `/api/timeline-handoffs` branch
- `tests/e2e/smoke/timeline-handoff-contract.spec.ts` and
  `tests/e2e/smoke/timeline-handoff-d1.spec.ts`, following
  `tests/e2e/smoke/timeline-service-d1.spec.ts` (Miniflare against the real migration files).
  **This is where the accepted tests live:** two concurrent redeems (exactly one payload,
  one 409); redeem after `expires_at` (410, nothing consumed); redeem by the wrong subject
  (403, `redeemed_at` still NULL); redeem by a guest, by a service credential, and
  unauthenticated (403/403/401); mint idempotency; revoke then redeem; and the
  `RETURNING`-inside-`batch` assertion from Open question 4.

**Slice 2 — discovery (ResearchTools only).**
- `functions/api/_shared/integration-contract.ts` — `timelineHandoffMint` in
  `INTEGRATION_CAPABILITY_NAMES` (`:54`), `REQUIRED_SCOPE` (`:79`), `TRANCHE_A_SERVER_SUPPORT`
  (`:96`), and the omit-when-false filter (`:222`)
- `functions/api/integrations/capabilities.ts:88-95` — `runtimeReady.timelineHandoffMint`
- `docs/api/COMMUNITY-INTEGRATIONS-API.md` — the scope/capability tables at `:120-136`
- `tests/e2e/smoke/community-integration-capabilities.spec.ts`

**Slice 3 — redemption in the SPA (ResearchTools only).** Round trips become testable end
to end here.
- `src/lib/timeline-handoff.ts` — read and clear the fragment, call redeem, decode
  `timeline-handoff.v1`, build the seeded `TimelineWorkspaceExport` and its
  `timeline-evidence.v1` block
- `src/pages/tools/TimelineAnalysisPage.tsx:133-134` — beside the existing `?url=` handling,
  a hash-driven handoff path that renders sign-in and expiry states and never redeems on load
- `src/components/timeline/TimelineHandoffPanel.tsx` — the explicit redeem control and the
  three error states
- `tests/e2e/smoke/timeline-handoff-browser.spec.ts` — the article, multi-article and
  story-snapshot round trips, each ending in a durable save and a reopen that still shows
  the return link

**Slice 4 — the RSS reader button (monorepo only).**
- `apps/rss-reader/wrangler.toml` — `RESEARCHTOOLS_URL` var; `RESEARCHTOOLS_INTEGRATION_TOKEN`
  as a secret
- `apps/rss-reader/src/types.ts:5-28` — both on `Env`
- `apps/rss-reader/src/api/researchtools-handoff.ts` — a small Worker-safe mint client
  (no `node:` imports) with `isResearchToolsHandoffConfigured()` in the house shape
  (`packages/shared-utils/src/bot-utils/career-board-client.ts:180`)
- `apps/rss-reader/src/index.ts` — `POST /handoff/link/:type/:id` and
  `POST /handoff/story/:slug`, session-required, minting subject-bound tokens from
  `session.userId` and 302-ing to the fragment URL
- `apps/rss-reader/src/templates/link-detail.ts` — the control next to `copyBtn` at `:869`,
  rendered in both action rows (`:928-932`, `:969-973`)
- `apps/rss-reader/src/templates/story-detail.ts:324-327` — the control in the
  `.story-freshness` row beside the existing refresh button

**Slice 5 — the Signal bot line (monorepo only).**
- `packages/shared-utils/src/bot-utils/researchtools-handoff.ts` — mint through
  `requestResearchToolsJson` (`researchtools-capabilities.ts:1263`) with
  `capability: 'timelineHandoffMint'`, plus `isResearchToolsHandoffConfigured()`
- `selfhost/messaging-apps/signal-messenger/src/src/bot/commands/utility/url-tools.ts` —
  one line appended to the `!timeline` reply (`:1836-1991`), the multi-URL reply
  (`:1605-1610`) and the `!story` reply (`:2027-2072`), gated on the guard and falling
  through silently when unconfigured. `!story` already holds the 24-item
  `recentLinks` list it needs (`story-query-service.ts:818-822`) and currently discards it.
  The line must state that the link is single use and expires in 30 minutes, and that a
  ResearchTools sign-in is required. Consider `shortenUrl` (`shlink-client.ts:142`) only if
  the URL pushes the reply past Signal's "Read More" fold — the fragment form is about 90
  characters plus the base, so it should not.
- `selfhost/messaging-apps/signal-messenger/.env.example` — the new vars, with the
  failure-mode comment the file's house style expects (`:92-107`)
