/**
 * COP → chat feed: what happened in a COP, for the Signal rooms linked to it (the bot
 * posts it in the room's digest message, under "From the COP").
 *
 * GET /api/cop/:id/chat-feed?since=<cursor>&limit=50
 *   → 200 { items, cursor, has_more, skipped, from_chat }   Cache-Control: no-store
 *
 * Callers: the Signal bot's service credential (COP_SERVICE_ROUTES; a Signal client
 * only) and the COP's owner and collaborators. Share links, signed-in readers of a
 * public COP, strangers and other services are refused (401/403).
 *
 * Cursor: the change feed's (GET /changes). `since=` empty → no items, the current
 * cursor: start there, then pass back each answer's cursor; while has_more, call
 * again at once. `limit` (1–100, default 50) bounds the items; a page reads at most
 * 500 events. An item's state is read when the page is built, so a later page can
 * repeat an entity with newer state.
 *
 * Item: { event_id, at, kind, action, entity_id, title, status, labels, actor,
 *         question_id?, question_title?, task_id?, evidence_id?, relation?, domain?,
 *         count? }
 *   kind   rfi | answer | task | evidence | evidence_link | marker | timeline |
 *          hypothesis | claim | summary (unreviewed anonymous tips and answers past 20
 *          per COP per rolling hour, or all of them when more than 3 are in one page,
 *          with their markers and filings: one item, entity_id 'anonymous', title
 *          null, labels ['anonymous'], count = how many tips and answers)
 *   action created | updated | status | answered | closed (an RFI closed, a task done) |
 *          reopened | confirmed (a marker) | assigned (a task; never to whom) |
 *          starred | unstarred (key question) | filed | unfiled (evidence under a
 *          question or task; under a hypothesis: kind hypothesis, action filed) |
 *          deleted
 *   actor  team | anonymous (a drop-form tip, a share-link answer, a question the
 *          tipster chose) | system (cron, other integrations) | chat (the calling
 *          bot itself: a room's capture or the bot's own sync; never which room)
 *   title  the entity's current text, one line, ≤140 characters, control characters
 *          stripped, any link in it (with or without a scheme; a host in any script
 *          or an IPv4 address) cut to its hostname; null when deleted. Anonymous
 *          input keeps its text, labelled: a tip "anonymous tip" + "unverified" (then
 *          "reviewed"), its marker "anonymous tip" + "possible", a share-link answer
 *          "anonymous" + "proposed" (then "accepted"); until reviewed its hosts are
 *          defanged ("evil[.]example"). Never the submitter's own fields: a tip is
 *          titled from the form's summary field or a long-text answer, never a short
 *          field; a tip without that record (ingested earlier, or with no such
 *          answer) has title null, its marker and filings too
 *   status rfi/task/hypothesis/claim status; evidence credibility; marker confidence;
 *          answer 'proposed' | 'accepted'; null for filings and timeline lines
 *   labels from the team | from chat | anonymous tip | anonymous | scraped |
 *          automated | unverified | possible | proposed | reviewed | key question |
 *          answered | closed | done | in progress | blocked | blocker |
 *          high priority | critical |
 *          confirmed | doubtful | accepted | AI first pass (an unverified claim) |
 *          verified | disputed | false | important | supports | contradicts | context
 *   ids                 entity_id, question_id, task_id, evidence_id match
 *                       ^[A-Za-z0-9_-]{1,64}$ (an item whose id doesn't is skipped)
 *   question_id/_title  answer, and evidence filed under a question
 *   task_id             evidence filed under a task
 *   evidence_id         the evidence item of a filing (to match an earlier evidence item)
 *   relation            supports | contradicts | context (filings)
 *   domain              hostname of an http(s) source (evidence, claim, timeline);
 *                       never a path; never for an unreviewed tip or one with title null
 *
 * "from chat" is the Signal bot's own input (SIGNAL_BOT_CLIENT_IDS); another
 * integration's is actor system, "automated".
 *
 * Echoes are the bot's call, per room: what the calling bot itself did (its principal
 * created the event) comes back as actor 'chat', in items of its own, never merged
 * with the team's changes to the same entity, and is counted in `from_chat` (events).
 * The bot drops a room's own captures and shows another linked room's; the team's
 * changes to a room's items come back as actor team. `skipped` counts events with
 * nothing to say in a chat (votes, the middleware's generic entity.changed, events
 * without an entity id, system timeline lines, tags, uploads, submissions, personas,
 * shares, the session itself, ids that don't resolve in this COP, items created and
 * deleted in one page).
 *
 * Never in the answer: user ids, names or emails, assignees, responders, full URLs,
 * coordinates, upload ids, event payloads. Events on one entity in one page are one
 * item, the bot's own apart (functions/api/_shared/cop-chat-feed.ts).
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { logEvent } from '../../_shared/event-log'
import { copCallerUserId, copServiceCaller, isSignalBotClient } from '../../_shared/cop-caller'
import { chatFeedLimit, listChatFeed } from '../../_shared/cop-chat-feed'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const headers = { ...JSON_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  // A share link never reads this feed, whoever holds it.
  if (request.headers.get('X-Share-Token') || url.searchParams.has('share')) {
    return reply({ error: 'Not available through a share link', code: 'SHARE_NOT_ALLOWED' }, 403)
  }
  const userId = await copCallerUserId(context)
  if (!userId) return reply({ error: 'Authentication required' }, 401)
  const service = copServiceCaller(context.data)
  // Of the services, only the Signal bot words the feed for a chat.
  if (service && !isSignalBotClient(service.clientId)) {
    return reply({ error: 'This feed is for the Signal bot', code: 'SERVICE_NOT_ALLOWED' }, 403)
  }
  // The owner and collaborators (any role); not a signed-in reader of a public COP.
  const workspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId)
  if (!workspaceId) return reply({ error: 'Access denied' }, 403)

  try {
    const result = await listChatFeed(
      env.DB,
      { sessionId, workspaceId },
      url.searchParams.get('since'),
      chatFeedLimit(url.searchParams.get('limit')),
      service ? service.principalUserId : null,
    )
    if (result.ok === false) return reply({ error: result.error }, result.status)
    return reply({
      items: result.items,
      cursor: result.cursor,
      has_more: result.has_more,
      skipped: result.skipped,
      from_chat: result.from_chat,
    })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/chat-feed',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return reply({ error: 'Failed to list the chat feed' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
