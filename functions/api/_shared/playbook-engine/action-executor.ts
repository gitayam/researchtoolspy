/**
 * Playbook Action Executor
 *
 * Registry of action handlers. Each action takes (db, sessionId, params, userId)
 * and returns a result object. Errors are caught per-action so a single failure
 * does not abort the entire rule execution.
 */

import { autoAssignTask } from '../auto-assign'
import { emitCopEvent } from '../cop-events'
import {
  WORKFLOW_STAGE_ENTERED,
  WORKFLOW_STAGE_COMPLETED,
  WORKFLOW_PIPELINE_FINISHED,
} from '../cop-event-types'
import { resolveParams, type TemplateContext } from './template-resolver'

type ActionResult = Record<string, unknown>

type ActionHandler = (
  db: D1Database,
  sessionId: string,
  params: Record<string, unknown>,
  userId: number
) => Promise<ActionResult>

function generateTaskId(): string {
  return `tsk-${crypto.randomUUID().slice(0, 12)}`
}

function generateEvidenceId(): string {
  return `evi-${crypto.randomUUID().slice(0, 12)}`
}

function generateRfiId(): string {
  return `rfi-${crypto.randomUUID().slice(0, 12)}`
}

function generateTagId(): string {
  return `etag-${crypto.randomUUID().slice(0, 12)}`
}

function generateActivityId(): string {
  return `act-${crypto.randomUUID().slice(0, 12)}`
}

// ── Action Handlers ──────────────────────────────────────────────

const createTask: ActionHandler = async (db, sessionId, params, userId) => {
  const id = generateTaskId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO cop_tasks (
      id, cop_session_id, title, description, status, priority, task_type,
      assigned_to, created_by, workspace_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, sessionId,
    String(params.title || 'Automated task'),
    String(params.description || ''),
    String(params.status || 'todo'),
    String(params.priority || 'medium'),
    String(params.task_type || 'general'),
    params.assigned_to ? String(params.assigned_to) : null,
    userId, '1', now, now,
  ).run()

  return { id, title: params.title }
}

const updateStatus: ActionHandler = async (db, sessionId, params, _userId) => {
  const now = new Date().toISOString()
  const table = String(params.table || 'cop_tasks')
  const entityId = String(params.entity_id || '')
  const newStatus = String(params.status || '')

  if (!entityId || !newStatus) return { error: 'entity_id and status required' }

  await db.prepare(
    `UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ? AND cop_session_id = ?`
  ).bind(newStatus, now, entityId, sessionId).run()

  return { entity_id: entityId, new_status: newStatus }
}

const assignTask: ActionHandler = async (db, sessionId, params, userId) => {
  const taskId = String(params.task_id || '')
  const taskType = String(params.task_type || 'general')

  if (!taskId) return { error: 'task_id required' }

  const result = await autoAssignTask(db, sessionId, taskId, taskType, userId)
  return result as unknown as ActionResult
}

const createEvidence: ActionHandler = async (db, sessionId, params, userId) => {
  const id = generateEvidenceId()
  const now = new Date().toISOString()

  // Look up workspace_id from session
  const session = await db.prepare(
    'SELECT workspace_id FROM cop_sessions WHERE id = ?'
  ).bind(sessionId).first() as any
  const workspaceId = session?.workspace_id || '1'

  await db.prepare(`
    INSERT INTO evidence_items (
      id, cop_session_id, title, content, source_url, evidence_type,
      created_by, workspace_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, sessionId,
    String(params.title || 'Auto-created evidence'),
    String(params.content || ''),
    params.source_url ? String(params.source_url) : null,
    String(params.evidence_type || 'document'),
    userId, workspaceId, now, now,
  ).run()

  return { id, title: params.title }
}

const sendNotification: ActionHandler = async (db, sessionId, params, userId) => {
  const id = generateActivityId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO cop_activity (id, cop_session_id, activity_type, message, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id, sessionId,
    String(params.activity_type || 'playbook_notification'),
    String(params.message || 'Playbook notification'),
    userId, now,
  ).run()

  return { id, message: params.message }
}

const updatePriority: ActionHandler = async (db, sessionId, params, _userId) => {
  const now = new Date().toISOString()
  const table = String(params.table || 'cop_tasks')
  const entityId = String(params.entity_id || '')
  const newPriority = String(params.priority || '')

  if (!entityId || !newPriority) return { error: 'entity_id and priority required' }

  await db.prepare(
    `UPDATE ${table} SET priority = ?, updated_at = ? WHERE id = ? AND cop_session_id = ?`
  ).bind(newPriority, now, entityId, sessionId).run()

  return { entity_id: entityId, new_priority: newPriority }
}

const addTag: ActionHandler = async (db, _sessionId, params, userId) => {
  const id = generateTagId()
  const now = new Date().toISOString()

  const evidenceId = String(params.evidence_id || '')
  if (!evidenceId) return { error: 'evidence_id required' }

  await db.prepare(`
    INSERT INTO cop_evidence_tags (id, evidence_id, tag_category, tag_value, confidence, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, evidenceId,
    String(params.tag_category || 'auto'),
    String(params.tag_value || ''),
    Number(params.confidence ?? 80),
    userId, now,
  ).run()

  return { id, evidence_id: evidenceId, tag_value: params.tag_value }
}

const createRfi: ActionHandler = async (db, sessionId, params, userId) => {
  const id = generateRfiId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO cop_rfis (
      id, cop_session_id, question, priority, status, is_blocker,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, sessionId,
    String(params.question || 'Auto-generated RFI'),
    String(params.priority || 'medium'),
    'open',
    params.is_blocker ? 1 : 0,
    userId, now, now,
  ).run()

  return { id, question: params.question }
}

const reserveAsset: ActionHandler = async (db, sessionId, params, _userId) => {
  const assetId = String(params.asset_id || '')
  const taskId = String(params.task_id || '')
  const now = new Date().toISOString()

  if (!assetId) return { error: 'asset_id required' }

  await db.prepare(
    'UPDATE cop_assets SET assigned_to_task_id = ?, status = ?, updated_at = ? WHERE id = ? AND cop_session_id = ?'
  ).bind(taskId || null, 'deployed', now, assetId, sessionId).run()

  return { asset_id: assetId, assigned_to_task_id: taskId }
}

// ── Action Registry ──────────────────────────────────────────────

const ACTION_REGISTRY: Record<string, ActionHandler> = {
  create_task: createTask,
  update_status: updateStatus,
  assign_task: assignTask,
  create_evidence: createEvidence,
  send_notification: sendNotification,
  update_priority: updatePriority,
  add_tag: addTag,
  create_rfi: createRfi,
  reserve_asset: reserveAsset,
}

/**
 * Execute a single action by type.
 * Returns the action result or an error object.
 */
export async function executeAction(
  db: D1Database,
  sessionId: string,
  actionType: string,
  params: Record<string, unknown>,
  userId: number
): Promise<ActionResult> {
  const handler = ACTION_REGISTRY[actionType]
  if (!handler) {
    return { error: `Unknown action type: ${actionType}` }
  }

  try {
    return await handler(db, sessionId, params, userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Playbook Action] ${actionType} failed:`, message)
    return { error: message }
  }
}

/**
 * Execute a pipeline of stages sequentially, collecting results per stage.
 * Each stage result is available to subsequent stages via template resolution.
 */
export async function executePipeline(
  db: D1Database,
  sessionId: string,
  stages: Array<{ name: string; action: string; params: Record<string, unknown> }>,
  templateContext: TemplateContext,
  userId: number
): Promise<ActionResult> {
  const stageResults: Record<string, ActionResult> = {}
  const results: Array<{ name: string; action: string; result: ActionResult }> = []

  for (const stage of stages) {
    // Emit stage entered event
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: WORKFLOW_STAGE_ENTERED,
      entityType: 'workflow',
      payload: { stage_name: stage.name, action: stage.action },
      createdBy: userId,
    })

    // Resolve params with current template context (includes previous stage results)
    const ctx: TemplateContext = {
      ...templateContext,
      stage: { ...templateContext.stage, ...stageResults },
    }
    const resolvedParams = resolveParams(stage.params, ctx)

    const result = await executeAction(db, sessionId, stage.action, resolvedParams, userId)
    stageResults[stage.name] = result
    results.push({ name: stage.name, action: stage.action, result })

    // Emit stage completed event
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: WORKFLOW_STAGE_COMPLETED,
      entityType: 'workflow',
      payload: { stage_name: stage.name, action: stage.action, result },
      createdBy: userId,
    })
  }

  // Emit pipeline finished event
  await emitCopEvent(db, {
    copSessionId: sessionId,
    eventType: WORKFLOW_PIPELINE_FINISHED,
    entityType: 'workflow',
    payload: { stage_count: stages.length },
    createdBy: userId,
  })

  return { stages: results }
}
