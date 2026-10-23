/**
 * POST /api/cop/:id/item-tags/bulk
 *   { targets: [{ target_type, target_id }] (≤ 100), add: [name…], remove: [name…] }
 *   → { items: [{ target_type, target_id, tags: [name…] }], skipped: [{ target_type, target_id }] }
 *
 * Editors only (not the bot). Each target is checked against the session in SQL;
 * targets that aren't in it are skipped, never touched.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../../_shared/event-log'
import { coded, copEditor, json, readJson } from '../../../_shared/cop-route-auth'
import {
  applyItemTags,
  cleanTagName,
  cleanTargetId,
  isTagTargetType,
  itemTagNames,
  MAX_BULK_TARGETS,
  MAX_TAGS_PER_CALL,
  removeItemTags,
  TagLimitError,
  targetInSession,
  TAGS_UNAVAILABLE,
  tagsTableMissing,
  type TagTargetType,
} from '../../../_shared/cop-tags'
import { copServiceCaller } from '../../../_shared/cop-caller'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

function names(raw: unknown): string[] | null {
  if (raw === undefined) return []
  if (!Array.isArray(raw) || raw.length > MAX_TAGS_PER_CALL) return null
  const out = raw.map(cleanTagName)
  return out.some((n) => n === null) ? null : (out as string[])
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  if (copServiceCaller(context.data)) return json({ error: 'Bulk tagging is for people, not services' }, 403)
  const access = await copEditor(context, sessionId, 'tag items')
  if (access.ok === false) return access.response
  const body = await readJson(context.request)
  if (!body) return json({ error: 'Expected a JSON body' }, 400)
  if (!Array.isArray(body.targets) || body.targets.length === 0 || body.targets.length > MAX_BULK_TARGETS) {
    return json({ error: `targets must list 1 to ${MAX_BULK_TARGETS} items` }, 400)
  }
  const add = names(body.add)
  const remove = names(body.remove)
  if (!add || !remove) return json({ error: `add and remove are lists of at most ${MAX_TAGS_PER_CALL} valid tag names` }, 400)
  if (add.length === 0 && remove.length === 0) return json({ error: 'Nothing to add or remove' }, 400)

  const targets: { target_type: TagTargetType; target_id: string }[] = []
  for (const raw of body.targets) {
    const t = raw as Record<string, unknown> | null
    const id = cleanTargetId(t?.target_id)
    if (!t || !isTagTargetType(t.target_type) || !id) return json({ error: 'Each target needs a valid target_type and target_id' }, 400)
    targets.push({ target_type: t.target_type, target_id: id })
  }

  const db = context.env.DB
  const items: { target_type: string; target_id: string; tags: string[] }[] = []
  const skipped: { target_type: string; target_id: string }[] = []
  try {
    for (const target of targets) {
      if (!(await targetInSession(db, { sessionId, workspaceId: access.workspaceId }, target.target_type, target.target_id))) {
        skipped.push(target)
        continue
      }
      if (add.length > 0) {
        await applyItemTags(db, { sessionId, targetType: target.target_type, targetId: target.target_id, names: add, source: 'user', actorUserId: access.userId })
      }
      if (remove.length > 0) {
        await removeItemTags(db, { sessionId, targetType: target.target_type, targetId: target.target_id, names: remove, actorUserId: access.userId })
      }
      items.push({ ...target, tags: await itemTagNames(db, sessionId, target.target_type, target.target_id) })
    }
    return json({ items, skipped })
  } catch (error) {
    if (error instanceof TagLimitError) return json({ error: error.message }, 409)
    if (tagsTableMissing(error)) return coded(503, TAGS_UNAVAILABLE, 'Tags are not available on this server yet.')
    await logEvent(context.env, { level: 'error', source: 'cop/item-tags/bulk', message: String(error instanceof Error ? error.message : error).slice(0, 500) })
    return json({ error: 'Failed to tag the items' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
