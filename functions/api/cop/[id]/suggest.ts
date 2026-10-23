/**
 * POST /api/cop/:id/suggest { text (≤ 2000), want?: ['kind','tags','places'] }
 *   → { kind: { value, confidence } | null, tags: [name…], places: [{ text, query }],
 *       ai_used: bool, ai_status: 'not_needed' | 'used' | 'unavailable' | 'rate_limited' }
 *
 * Editors and the bot. A suggestion only: nothing is created. Prefixed text, links
 * and coordinates are decided in code (ai_status 'not_needed'); only unprefixed
 * text costs a model call, charged to the caller and its CF-Connecting-IP address
 * (fail closed: no KV to count with → no model call, the deterministic answer).
 * Tags are only ever names already in the session's vocabulary.
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { logEvent } from '../../_shared/event-log'
import { copEditor, json, readJson } from '../../_shared/cop-route-auth'
import { copServiceCaller } from '../../_shared/cop-caller'
import { sessionTagNames } from '../../_shared/cop-tags'
import { deterministicKind, MAX_SUGGEST_TEXT, modelSuggestion, vocabularyHashtags, type Suggestion } from '../../_shared/cop-suggest'
import { chargeSpend, spendCaller, type SpendLimits } from '../../_shared/webcam-discovery'
import type { KvLike } from '../../_shared/kv-json'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  CACHE?: KvLike
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

const SUGGEST_LIMITS: SpendLimits = { person: 60, service: 120, address: 90 }
const WANTS = new Set(['kind', 'tags', 'places'])

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sessionId = context.params.id as string
  const access = await copEditor(context, sessionId, 'ask for suggestions')
  if (access.ok === false) return access.response
  const body = await readJson(context.request)
  if (!body) return json({ error: 'Expected a JSON body' }, 400)
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return json({ error: 'text is required' }, 400)
  if (text.length > MAX_SUGGEST_TEXT) return json({ error: `text is limited to ${MAX_SUGGEST_TEXT} characters` }, 400)
  const want = new Set(Array.isArray(body.want) ? body.want.filter((w): w is string => typeof w === 'string' && WANTS.has(w)) : [...WANTS])

  const { env } = context
  try {
    const vocabulary = await sessionTagNames(env.DB, sessionId)
    const decided = deterministicKind(text)
    const result: Suggestion = {
      kind: decided && want.has('kind') ? { value: decided.kind, confidence: 1 } : null,
      tags: want.has('tags') ? vocabularyHashtags(text, vocabulary) : [],
      places: [],
    }
    if (decided) return json({ ...result, ai_used: false, ai_status: 'not_needed' })

    const spender = spendCaller(context.request, access.userId, copServiceCaller(context.data))
    const charge = await chargeSpend(env.CACHE, 'cop-suggest', spender, SUGGEST_LIMITS)
    if (charge !== 'ok') {
      return json({ ...result, ai_used: false, ai_status: charge === 'over' ? 'rate_limited' : 'unavailable' })
    }
    const session = await env.DB.prepare('SELECT name, description FROM cop_sessions WHERE id = ?')
      .bind(sessionId).first<{ name: string | null; description: string | null }>()
    const model = await modelSuggestion(env, { userId: spender.who }, {
      text, vocabulary, cop: { name: session?.name ?? null, description: session?.description ?? null }, want,
    })
    if (!model) return json({ ...result, ai_used: false, ai_status: 'unavailable' })
    const tags = [...new Set([...result.tags, ...model.tags])].slice(0, 5)
    return json({ kind: model.kind, tags, places: model.places, ai_used: true, ai_status: 'used' })
  } catch (error) {
    await logEvent(env, { level: 'error', source: 'cop/suggest', message: String(error instanceof Error ? error.message : error).slice(0, 500) })
    return json({ error: 'Failed to suggest' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
