/**
 * COP Playbook Rules API
 *
 * GET    /api/cop/:id/playbooks/:pbId/rules           - List rules
 * POST   /api/cop/:id/playbooks/:pbId/rules           - Create rule
 * PUT    /api/cop/:id/playbooks/:pbId/rules            - Update rule (rule_id in body)
 * DELETE /api/cop/:id/playbooks/:pbId/rules?rule_id=x  - Delete rule
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

function generateId(): string {
  return `pbr-${crypto.randomUUID().slice(0, 12)}`
}

const VALID_ACTION_TYPES = [
  'create_task', 'update_status', 'assign_task', 'create_evidence',
  'send_notification', 'update_priority', 'add_tag', 'create_rfi',
  'reserve_asset', 'run_pipeline',
]

function parseJsonField(row: any, field: string, fallback: any = {}): any {
  if (!row || !row[field]) return fallback
  try {
    return typeof row[field] === 'string' ? JSON.parse(row[field]) : row[field]
  } catch {
    return fallback
  }
}

function parseRule(row: any): any {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    trigger_filter: parseJsonField(row, 'trigger_filter', {}),
    conditions: parseJsonField(row, 'conditions', []),
    actions: parseJsonField(row, 'actions', []),
  }
}

/** Verify playbook belongs to this session. Returns false if not found. */
async function verifyPlaybookSession(env: Env, pbId: string, sessionId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT id FROM cop_playbooks WHERE id = ? AND cop_session_id = ?'
  ).bind(pbId, sessionId).first()
  return !!row
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    if (!await verifyPlaybookSession(env, pbId, sessionId)) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const rows = await env.DB.prepare(
      'SELECT * FROM cop_playbook_rules WHERE playbook_id = ? ORDER BY position ASC'
    ).bind(pbId).all()

    const rules = (rows.results || []).map(parseRule)
    return new Response(JSON.stringify({ rules }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (error) {
    console.error('[COP Playbook Rules] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list rules' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!await verifyPlaybookSession(env, pbId, sessionId)) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const body = await request.json() as any

    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!body.trigger_event?.trim()) {
      return new Response(JSON.stringify({ error: 'trigger_event is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Validate actions if provided
    const actions = body.actions || []
    for (const action of actions) {
      if (action.action && !VALID_ACTION_TYPES.includes(action.action)) {
        return new Response(JSON.stringify({ error: `Invalid action type: ${action.action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
    }

    // Auto-increment position
    const maxPos = await env.DB.prepare(
      'SELECT MAX(position) AS max_pos FROM cop_playbook_rules WHERE playbook_id = ?'
    ).bind(pbId).first() as any
    const nextPosition = (maxPos?.max_pos ?? -1) + 1

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_playbook_rules (
        id, playbook_id, name, position, enabled, trigger_event,
        trigger_filter, conditions, actions, cooldown_seconds,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, pbId,
      body.name.trim(),
      body.position ?? nextPosition,
      body.enabled !== false ? 1 : 0,
      body.trigger_event.trim(),
      JSON.stringify(body.trigger_filter || {}),
      JSON.stringify(body.conditions || []),
      JSON.stringify(actions),
      body.cooldown_seconds ?? 0,
      now, now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'Rule created' }), {
      status: 201, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error) {
    console.error('[COP Playbook Rules] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create rule' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!await verifyPlaybookSession(env, pbId, sessionId)) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const body = await request.json() as any

    if (!body.rule_id) {
      return new Response(JSON.stringify({ error: 'rule_id is required in body' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM cop_playbook_rules WHERE id = ? AND playbook_id = ?'
    ).bind(body.rule_id, pbId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Rule not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const now = new Date().toISOString()
    const updates: string[] = []
    const bindings: any[] = []

    if (body.name !== undefined) {
      updates.push('name = ?')
      bindings.push(body.name.trim())
    }
    if (body.position !== undefined) {
      updates.push('position = ?')
      bindings.push(Number(body.position))
    }
    if (body.enabled !== undefined) {
      updates.push('enabled = ?')
      bindings.push(body.enabled ? 1 : 0)
    }
    if (body.trigger_event !== undefined) {
      updates.push('trigger_event = ?')
      bindings.push(body.trigger_event.trim())
    }
    if (body.trigger_filter !== undefined) {
      updates.push('trigger_filter = ?')
      bindings.push(JSON.stringify(body.trigger_filter))
    }
    if (body.conditions !== undefined) {
      updates.push('conditions = ?')
      bindings.push(JSON.stringify(body.conditions))
    }
    if (body.actions !== undefined) {
      // Validate actions
      for (const action of body.actions) {
        if (action.action && !VALID_ACTION_TYPES.includes(action.action)) {
          return new Response(JSON.stringify({ error: `Invalid action type: ${action.action}` }), {
            status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          })
        }
      }
      updates.push('actions = ?')
      bindings.push(JSON.stringify(body.actions))
    }
    if (body.cooldown_seconds !== undefined) {
      updates.push('cooldown_seconds = ?')
      bindings.push(Number(body.cooldown_seconds))
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    updates.push('updated_at = ?')
    bindings.push(now)
    bindings.push(body.rule_id, pbId)

    await env.DB.prepare(
      `UPDATE cop_playbook_rules SET ${updates.join(', ')} WHERE id = ? AND playbook_id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ id: body.rule_id, message: 'Rule updated' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (error) {
    console.error('[COP Playbook Rules] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update rule' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const pbId = params.pbId as string
  const url = new URL(request.url)
  const ruleId = url.searchParams.get('rule_id')

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!await verifyPlaybookSession(env, pbId, sessionId)) {
      return new Response(JSON.stringify({ error: 'Playbook not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (!ruleId) {
      return new Response(JSON.stringify({ error: 'rule_id query param is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM cop_playbook_rules WHERE id = ? AND playbook_id = ?'
    ).bind(ruleId, pbId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Rule not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Delete log entries for this rule, then the rule
    await env.DB.prepare('DELETE FROM cop_playbook_log WHERE rule_id = ?').bind(ruleId).run()
    await env.DB.prepare('DELETE FROM cop_playbook_rules WHERE id = ? AND playbook_id = ?').bind(ruleId, pbId).run()

    return new Response(JSON.stringify({ message: 'Rule deleted' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  } catch (error) {
    console.error('[COP Playbook Rules] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete rule' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}
