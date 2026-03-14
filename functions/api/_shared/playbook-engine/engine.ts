/**
 * Playbook Engine - Main Loop
 *
 * Called by Cron Trigger every 60 seconds (or via manual endpoint).
 * For each active playbook:
 *   1. Query cop_events after last_processed_event_id
 *   2. For each event, evaluate rules in position order
 *   3. Check cooldown, conditions
 *   4. Execute matching actions
 *   5. Log results
 *   6. Advance cursor
 *
 * Stateless: reads cursor from DB, processes, writes cursor back.
 */

import { evaluateAllConditions } from './condition-evaluator'
import { executeAction, executePipeline } from './action-executor'
import { resolveParams, type TemplateContext } from './template-resolver'

export interface EngineResult {
  playbooks_processed: number
  events_processed: number
  rules_fired: number
  errors: number
}

export async function runPlaybookEngine(db: D1Database): Promise<EngineResult> {
  const result: EngineResult = { playbooks_processed: 0, events_processed: 0, rules_fired: 0, errors: 0 }

  // Get all active playbooks
  const playbooks = await db.prepare(
    "SELECT * FROM cop_playbooks WHERE status = 'active'"
  ).all()

  for (const playbook of (playbooks.results || []) as any[]) {
    result.playbooks_processed++

    try {
      await processPlaybook(db, playbook, result)
    } catch (err) {
      console.error(`[Playbook Engine] Error processing playbook ${playbook.id}:`, err)
      result.errors++
    }
  }

  return result
}

async function processPlaybook(
  db: D1Database,
  playbook: any,
  result: EngineResult
): Promise<void> {
  // Get new events since last cursor
  let eventsQuery = 'SELECT * FROM cop_events WHERE cop_session_id = ?'
  const bindings: any[] = [playbook.cop_session_id]

  if (playbook.last_processed_event_id) {
    eventsQuery += ' AND id > ?'
    bindings.push(playbook.last_processed_event_id)
  }

  eventsQuery += ' ORDER BY id ASC LIMIT 100'

  const events = await db.prepare(eventsQuery).bind(...bindings).all()
  const eventRows = (events.results || []) as any[]

  if (eventRows.length === 0) return

  // Get rules for this playbook
  const rules = await db.prepare(
    'SELECT * FROM cop_playbook_rules WHERE playbook_id = ? AND enabled = 1 ORDER BY position ASC'
  ).bind(playbook.id).all()

  const ruleRows = (rules.results || []) as any[]

  for (const event of eventRows) {
    result.events_processed++

    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(event.payload || '{}') } catch { payload = {} }

    for (const rule of ruleRows) {
      await processRule(db, playbook, rule, event, payload, result)
    }
  }

  // Advance cursor to last processed event
  const lastEventId = eventRows[eventRows.length - 1].id
  const now = new Date().toISOString()
  await db.prepare(
    'UPDATE cop_playbooks SET last_processed_event_id = ?, execution_count = execution_count + 1, last_triggered_at = ?, updated_at = ? WHERE id = ?'
  ).bind(lastEventId, now, now, playbook.id).run()
}

async function processRule(
  db: D1Database,
  playbook: any,
  rule: any,
  event: any,
  payload: Record<string, unknown>,
  result: EngineResult
): Promise<void> {
  // Check trigger match
  if (rule.trigger_event !== event.event_type) return

  // Check trigger filter (simple key-value match against payload)
  let triggerFilter: Record<string, unknown> = {}
  try { triggerFilter = JSON.parse(rule.trigger_filter || '{}') } catch { triggerFilter = {} }

  for (const [key, value] of Object.entries(triggerFilter)) {
    if (payload[key] !== value) return
  }

  // Check cooldown
  if (rule.cooldown_seconds > 0 && rule.last_fired_at) {
    const lastFired = new Date(rule.last_fired_at).getTime()
    const cooldownMs = rule.cooldown_seconds * 1000
    if (Date.now() - lastFired < cooldownMs) return
  }

  // Evaluate conditions
  let conditions: any[] = []
  try { conditions = JSON.parse(rule.conditions || '[]') } catch { conditions = [] }

  const context = {
    payload,
    time: {
      hours_since_created: (Date.now() - new Date(event.created_at).getTime()) / 3600000,
    },
  }

  if (!evaluateAllConditions(conditions, context)) return

  // Execute actions
  const startTime = Date.now()
  let actions: any[] = []
  try { actions = JSON.parse(rule.actions || '[]') } catch { actions = [] }

  const templateContext: TemplateContext = {
    trigger: {
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      payload,
    },
    stage: {},
  }

  const actionResults: any[] = []
  let logStatus = 'success'
  let errorMessage: string | null = null

  for (const action of actions) {
    try {
      const resolvedParams = resolveParams(action.params || {}, templateContext)

      if (action.action === 'run_pipeline') {
        const pipelineResult = await executePipeline(
          db, playbook.cop_session_id, action.stages || [],
          templateContext, playbook.created_by
        )
        actionResults.push({ action: 'run_pipeline', result: pipelineResult })
      } else {
        const actionResult = await executeAction(
          db, playbook.cop_session_id,
          action.action, resolvedParams,
          playbook.created_by
        )
        actionResults.push({ action: action.action, result: actionResult })

        // Store result for template resolution in later actions
        if (action.name) {
          templateContext.stage[action.name] = actionResult as any
        }
      }
    } catch (err) {
      const msg = 'Action execution failed'
      actionResults.push({ action: action.action, error: msg })
      logStatus = 'partial'
      if (!errorMessage) errorMessage = msg
      result.errors++
    }
  }

  if (actionResults.length > 0 && actionResults.every(a => a.error)) {
    logStatus = 'failed'
  }

  const durationMs = Date.now() - startTime

  // Log execution
  const logId = `plog-${crypto.randomUUID().slice(0, 12)}`
  await db.prepare(`
    INSERT INTO cop_playbook_log (id, rule_id, playbook_id, cop_session_id, trigger_event_id, actions_taken, status, error_message, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    logId, rule.id, playbook.id, playbook.cop_session_id,
    event.id, JSON.stringify(actionResults),
    logStatus, errorMessage, durationMs
  ).run()

  // Update rule stats
  const now = new Date().toISOString()
  await db.prepare(
    'UPDATE cop_playbook_rules SET last_fired_at = ?, fire_count = fire_count + 1, updated_at = ? WHERE id = ?'
  ).bind(now, now, rule.id).run()

  result.rules_fired++
}
