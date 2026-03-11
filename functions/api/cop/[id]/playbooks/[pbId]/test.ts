/**
 * COP Playbook Dry-Run Test API
 *
 * POST /api/cop/:id/playbooks/:pbId/test
 *
 * Evaluates rules against recent events WITHOUT executing actions.
 * Returns { would_fire: [...], would_skip: [...] } with reasons.
 *
 * Body (optional):
 *   - event_limit: number of recent events to test against (default 20, max 100)
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { evaluateAllConditions } from '../../../../_shared/playbook-engine/condition-evaluator'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function parseJsonSafe(str: string, fallback: any = {}): any {
  try { return JSON.parse(str || JSON.stringify(fallback)) } catch { return fallback }
}

interface WouldFire {
  rule_id: string
  rule_name: string
  event_id: string
  event_type: string
  actions: any[]
}

interface WouldSkip {
  rule_id: string
  rule_name: string
  event_id: string
  event_type: string
  reason: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  try {
    let body: any = {}
    try { body = await request.json() } catch { body = {} }

    const eventLimit = Math.min(Number(body.event_limit || 20), 100)

    // Verify playbook belongs to session
    const playbook = await env.DB.prepare(
      'SELECT * FROM cop_playbooks WHERE id = ? AND cop_session_id = ?'
    ).bind(pbId, sessionId).first() as any

    if (!playbook) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Get recent events
    const events = await env.DB.prepare(
      'SELECT * FROM cop_events WHERE cop_session_id = ? ORDER BY id DESC LIMIT ?'
    ).bind(sessionId, eventLimit).all()

    const eventRows = (events.results || []) as any[]

    // Get rules
    const rules = await env.DB.prepare(
      'SELECT * FROM cop_playbook_rules WHERE playbook_id = ? ORDER BY position ASC'
    ).bind(pbId).all()

    const ruleRows = (rules.results || []) as any[]

    const would_fire: WouldFire[] = []
    const would_skip: WouldSkip[] = []

    for (const event of eventRows) {
      const payload = parseJsonSafe(event.payload, {})

      for (const rule of ruleRows) {
        // Check enabled
        if (!rule.enabled) {
          would_skip.push({
            rule_id: rule.id, rule_name: rule.name,
            event_id: event.id, event_type: event.event_type,
            reason: 'Rule is disabled',
          })
          continue
        }

        // Check trigger match
        if (rule.trigger_event !== event.event_type) {
          continue // Not a match at all, don't log skip
        }

        // Check trigger filter
        const triggerFilter = parseJsonSafe(rule.trigger_filter, {})
        let filterMatch = true
        for (const [key, value] of Object.entries(triggerFilter)) {
          if (payload[key] !== value) {
            filterMatch = false
            break
          }
        }
        if (!filterMatch) {
          would_skip.push({
            rule_id: rule.id, rule_name: rule.name,
            event_id: event.id, event_type: event.event_type,
            reason: 'Trigger filter did not match',
          })
          continue
        }

        // Check cooldown
        if (rule.cooldown_seconds > 0 && rule.last_fired_at) {
          const lastFired = new Date(rule.last_fired_at).getTime()
          const cooldownMs = rule.cooldown_seconds * 1000
          if (Date.now() - lastFired < cooldownMs) {
            would_skip.push({
              rule_id: rule.id, rule_name: rule.name,
              event_id: event.id, event_type: event.event_type,
              reason: `Cooldown active (${rule.cooldown_seconds}s)`,
            })
            continue
          }
        }

        // Check conditions
        const conditions = parseJsonSafe(rule.conditions, [])
        const context = {
          payload,
          time: {
            hours_since_created: (Date.now() - new Date(event.created_at).getTime()) / 3600000,
          },
        }

        if (!evaluateAllConditions(conditions, context)) {
          would_skip.push({
            rule_id: rule.id, rule_name: rule.name,
            event_id: event.id, event_type: event.event_type,
            reason: 'Conditions not met',
          })
          continue
        }

        // Would fire
        const actions = parseJsonSafe(rule.actions, [])
        would_fire.push({
          rule_id: rule.id, rule_name: rule.name,
          event_id: event.id, event_type: event.event_type,
          actions,
        })
      }
    }

    return new Response(JSON.stringify({
      would_fire,
      would_skip,
      events_tested: eventRows.length,
      rules_tested: ruleRows.length,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Playbook Test] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to run dry test' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
