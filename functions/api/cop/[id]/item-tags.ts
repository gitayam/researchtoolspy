/**
 * Tags on COP items
 *
 * GET    /api/cop/:id/item-tags[?target_type=…][&tag=<name>]
 *          → { items: [{ target_type, target_id, tags: [name…] }], truncated }
 *          (collaborators; the bot). With `tag`, only items carrying that tag.
 * POST   /api/cop/:id/item-tags { target_type, target_id, tags: [name…], source? }
 *          → { target_type, target_id, tags: [name…] } (editors; the bot)
 *          Creates missing tags (≤ 10 per call). The item must belong to this
 *          session (evidence: to its workspace), checked in SQL; otherwise 404.
 * DELETE /api/cop/:id/item-tags { target_type, target_id, tag }   (editors; the bot,
 *          which may remove only tags it applied: 403 otherwise)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../_shared/event-log'
import { coded, copEditor, copReader, json, readJson } from '../../_shared/cop-route-auth'
import { serviceChangeRefused, serviceMayChange } from '../../_shared/cop-input'
import {
  applyItemTags,
  cleanTagName,
  cleanTargetId,
  isTagSource,
  isTagTargetType,
  itemTagLinks,
  listItemTags,
  MAX_TAGS_PER_CALL,
  removeItemTags,
  TagLimitError,
  targetInSession,
  TAG_TARGET_TYPES,
  TAGS_UNAVAILABLE,
  tagsTableMissing,
  type TagSource,
  type TagTargetType,
} from '../../_shared/cop-tags'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

async function failed(env: Env, error: unknown, what: string): Promise<Response> {
  if (tagsTableMissing(error)) return coded(503, TAGS_UNAVAILABLE, 'Tags are not available on this server yet.')
  await logEvent(env, { level: 'error', source: 'cop/item-tags', message: String(error instanceof Error ? error.message : error).slice(0, 500) })
  return json({ error: `Failed to ${what}` }, 500)
}

const badType = () => json({ error: `target_type must be one of: ${TAG_TARGET_TYPES.join(', ')}` }, 400)

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copReader(context, sessionId)
  if (access.ok === false) return access.response
  const query = new URL(context.request.url).searchParams
  const rawType = query.get('target_type')
  let targetType: TagTargetType | undefined
  if (rawType !== null) {
    if (!isTagTargetType(rawType)) return badType()
    targetType = rawType
  }
  const rawTag = query.get('tag')
  const tag = rawTag === null ? undefined : cleanTagName(rawTag)
  if (tag === null) return json({ error: 'tag is not a valid tag name' }, 400)
  try {
    const result = await listItemTags(context.env.DB, sessionId, { targetType, tag })
    return json(result)
  } catch (error) {
    return failed(context.env, error, 'list item tags')
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copEditor(context, sessionId, 'tag items')
  if (access.ok === false) return access.response
  const body = await readJson(context.request)
  if (!body) return json({ error: 'Expected a JSON body' }, 400)
  if (!isTagTargetType(body.target_type)) return badType()
  const targetId = cleanTargetId(body.target_id)
  if (!targetId) return json({ error: 'target_id is required' }, 400)
  if (!Array.isArray(body.tags) || body.tags.length === 0) return json({ error: 'tags must be a non-empty list' }, 400)
  if (body.tags.length > MAX_TAGS_PER_CALL) return json({ error: `At most ${MAX_TAGS_PER_CALL} tags at a time` }, 400)
  const names = body.tags.map(cleanTagName)
  if (names.some((n) => n === null)) return json({ error: 'A tag is 1–40 letters, digits, spaces, "_", "." or "-".' }, 400)
  // The bot's tags come from chat; a client may say 'ai' or 'rule' for suggestions it applied.
  const source: TagSource = access.service ? 'chat' : isTagSource(body.source) && body.source !== 'drop' && body.source !== 'chat' ? body.source : 'user'
  try {
    if (!(await targetInSession(context.env.DB, { sessionId, workspaceId: access.workspaceId }, body.target_type, targetId))) {
      return json({ error: 'Item not found in this session' }, 404)
    }
    const tags = await applyItemTags(context.env.DB, {
      sessionId, targetType: body.target_type, targetId, names: names as string[], source, actorUserId: access.userId,
    })
    return json({ target_type: body.target_type, target_id: targetId, tags })
  } catch (error) {
    if (error instanceof TagLimitError) return json({ error: error.message }, 409)
    return failed(context.env, error, 'tag the item')
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copEditor(context, sessionId, 'remove tags')
  if (access.ok === false) return access.response
  const body = await readJson(context.request)
  if (!body) return json({ error: 'Expected a JSON body' }, 400)
  if (!isTagTargetType(body.target_type)) return badType()
  const targetId = cleanTargetId(body.target_id)
  const tag = cleanTagName(body.tag)
  if (!targetId || !tag) return json({ error: 'target_id and tag are required' }, 400)
  try {
    if (!(await targetInSession(context.env.DB, { sessionId, workspaceId: access.workspaceId }, body.target_type, targetId))) {
      return json({ error: 'Item not found in this session' }, 404)
    }
    if (access.service) {
      // The bot undoes its own tags, not people's.
      const links = await itemTagLinks(context.env.DB, { sessionId, targetType: body.target_type, targetId, names: [tag] })
      if (links.some((link) => !serviceMayChange(context, link.created_by))) return serviceChangeRefused()
    }
    const tags = await removeItemTags(context.env.DB, {
      sessionId, targetType: body.target_type, targetId, names: [tag], actorUserId: access.userId,
      onlyCreatedBy: access.service ? access.userId : undefined,
    })
    return json({ target_type: body.target_type, target_id: targetId, tags })
  } catch (error) {
    return failed(context.env, error, 'remove the tag')
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
