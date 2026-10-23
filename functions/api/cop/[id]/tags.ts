/**
 * COP tag vocabulary
 *
 * GET  /api/cop/:id/tags - The session's tags with item counts (collaborators; the bot)
 * POST /api/cop/:id/tags - Add a tag { name, color?, category? } (editors; the bot).
 *                          An existing name (any case, with or without '#') answers
 *                          200 with that tag.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../_shared/event-log'
import { coded, copEditor, copReader, json, readJson } from '../../_shared/cop-route-auth'
import {
  cleanTagCategory,
  cleanTagColor,
  cleanTagName,
  ensureTags,
  listSessionTags,
  TagLimitError,
  tagKey,
  TAGS_UNAVAILABLE,
  tagsTableMissing,
} from '../../_shared/cop-tags'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const unavailable = () => coded(503, TAGS_UNAVAILABLE, 'Tags are not available on this server yet.')

async function failed(env: Env, error: unknown, what: string): Promise<Response> {
  if (tagsTableMissing(error)) return unavailable()
  await logEvent(env, { level: 'error', source: 'cop/tags', message: String(error instanceof Error ? error.message : error).slice(0, 500) })
  return json({ error: `Failed to ${what}` }, 500)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copReader(context, sessionId)
  if (access.ok === false) return access.response
  try {
    return json({ tags: await listSessionTags(context.env.DB, sessionId) })
  } catch (error) {
    return failed(context.env, error, 'list tags')
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copEditor(context, sessionId, 'add tags')
  if (access.ok === false) return access.response
  const body = await readJson(context.request)
  if (!body) return json({ error: 'Expected a JSON body' }, 400)
  const name = cleanTagName(body.name)
  if (!name) return json({ error: 'A tag is 1–40 letters, digits, spaces, "_", "." or "-".' }, 400)
  try {
    const existed = Boolean(await context.env.DB.prepare(
      'SELECT 1 FROM cop_tags WHERE cop_session_id = ? AND name_key = ? AND archived_at IS NULL'
    ).bind(sessionId, tagKey(name)).first())
    const [tag] = await ensureTags(context.env.DB, sessionId, [name], access.userId, {
      color: cleanTagColor(body.color),
      category: cleanTagCategory(body.category),
    })
    if (!tag) return json({ error: 'Failed to add the tag' }, 500)
    return json({ tag }, existed ? 200 : 201)
  } catch (error) {
    if (error instanceof TagLimitError) return json({ error: error.message }, 409)
    return failed(context.env, error, 'add the tag')
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
