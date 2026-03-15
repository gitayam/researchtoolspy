import { useState, useEffect, useCallback } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  Plus,
  Loader2,
  Save,
  Trash2,
  TestTube2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface PlaybookCondition {
  field: string
  op: string
  value: unknown
}

interface PlaybookAction {
  action: string
  name?: string
  params: Record<string, unknown>
  stages?: PipelineStage[]
}

interface PipelineStage {
  name: string
  action: string
  params: Record<string, unknown>
}

interface PlaybookRule {
  id: string
  playbook_id: string
  name: string
  position: number
  enabled: boolean
  trigger_event: string
  trigger_filter: Record<string, unknown>
  conditions: PlaybookCondition[]
  actions: PlaybookAction[]
  cooldown_seconds: number
  fire_count: number
}

interface DryRunResult {
  would_fire: Array<{ rule_id: string; rule_name: string; event_id: string; event_type: string; actions: any[] }>
  would_skip: Array<{ rule_id: string; rule_name: string; event_id: string; reason: string }>
  events_tested: number
  rules_tested: number
}

interface CopPlaybookEditorProps {
  sessionId: string
  playbookId: string
  onClose?: () => void
}

// ── Constants ─────────────────────────────────────────────────────

const EVENT_TYPES = [
  'task.created', 'task.assigned', 'task.started', 'task.completed', 'task.blocked', 'task.overdue',
  'rfi.created', 'rfi.answered', 'rfi.accepted', 'rfi.closed',
  'evidence.created', 'evidence.tagged', 'evidence.linked',
  'hypothesis.created', 'hypothesis.updated',
  'persona.created', 'persona.linked',
  'marker.created', 'marker.updated', 'marker.deleted',
  'ingest.submission_received', 'ingest.submission_triaged',
  'asset.created', 'asset.status_changed', 'asset.quota_low',
  'export.requested', 'export.completed',
]

const CONDITION_OPS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'exists', label: 'exists' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
]

const ACTION_TYPES = [
  { value: 'create_task', label: 'Create Task' },
  { value: 'update_status', label: 'Update Status' },
  { value: 'assign_task', label: 'Auto-Assign Task' },
  { value: 'create_evidence', label: 'Create Evidence' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'update_priority', label: 'Update Priority' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'create_rfi', label: 'Create RFI' },
  { value: 'reserve_asset', label: 'Reserve Asset' },
  { value: 'run_pipeline', label: 'Run Pipeline' },
]

// ── Helpers ───────────────────────────────────────────────────────

function newCondition(): PlaybookCondition {
  return { field: 'payload.priority', op: 'eq', value: '' }
}

function newAction(): PlaybookAction {
  return { action: 'create_task', params: {} }
}

function newPipelineStage(): PipelineStage {
  return { name: 'stage_1', action: 'create_task', params: {} }
}

// ── Component ─────────────────────────────────────────────────────

export default function CopPlaybookEditor({ sessionId, playbookId, onClose }: CopPlaybookEditorProps) {
  const [rules, setRules] = useState<PlaybookRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [dryRunning, setDryRunning] = useState(false)

  // New rule form
  const [showNewRule, setShowNewRule] = useState(false)
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleTrigger, setNewRuleTrigger] = useState(EVENT_TYPES[0])
  const [newRuleConditions, setNewRuleConditions] = useState<PlaybookCondition[]>([])
  const [newRuleActions, setNewRuleActions] = useState<PlaybookAction[]>([newAction()])
  const [newRuleCooldown, setNewRuleCooldown] = useState(0)

  // ── Fetch ──────────────────────────────────────────────────

  const fetchRules = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/${playbookId}/rules`, {
        headers: getCopHeaders(), signal,
      })
      if (!res.ok) throw new Error('Failed to fetch rules')
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[CopPlaybookEditor] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId, playbookId])

  useEffect(() => {
    const controller = new AbortController()
    fetchRules(controller.signal)
    return () => controller.abort()
  }, [fetchRules])

  // ── Create rule ────────────────────────────────────────────

  const handleCreateRule = useCallback(async () => {
    if (!newRuleName.trim() || !newRuleTrigger) return

    setSaving(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/${playbookId}/rules`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          name: newRuleName.trim(),
          trigger_event: newRuleTrigger,
          conditions: newRuleConditions,
          actions: newRuleActions,
          cooldown_seconds: newRuleCooldown,
        }),
      })
      if (!res.ok) throw new Error('Failed to create rule')
      setNewRuleName('')
      setNewRuleConditions([])
      setNewRuleActions([newAction()])
      setNewRuleCooldown(0)
      setShowNewRule(false)
      await fetchRules()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }, [newRuleName, newRuleTrigger, newRuleConditions, newRuleActions, newRuleCooldown, sessionId, playbookId, fetchRules])

  // ── Toggle rule enabled ────────────────────────────────────

  const handleToggleEnabled = useCallback(async (rule: PlaybookRule) => {
    try {
      await fetch(`/api/cop/${sessionId}/playbooks/${playbookId}/rules`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ rule_id: rule.id, enabled: !rule.enabled }),
      })
      await fetchRules()
    } catch {
      // ignore
    }
  }, [sessionId, playbookId, fetchRules])

  // ── Delete rule ────────────────────────────────────────────

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return
    try {
      await fetch(`/api/cop/${sessionId}/playbooks/${playbookId}/rules?rule_id=${ruleId}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      await fetchRules()
    } catch {
      // ignore
    }
  }, [sessionId, playbookId, fetchRules])

  // ── Dry run ────────────────────────────────────────────────

  const handleDryRun = useCallback(async () => {
    setDryRunning(true)
    setDryRunResult(null)
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/${playbookId}/test`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ event_limit: 50 }),
      })
      if (!res.ok) throw new Error('Dry run failed')
      const data = await res.json()
      setDryRunResult(data)
    } catch (e) {
      console.error('[CopPlaybookEditor] Dry run failed:', e)
    } finally {
      setDryRunning(false)
    }
  }, [sessionId, playbookId])

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading rules...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDryRun}
            disabled={dryRunning}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
          >
            {dryRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
            Test
          </button>
          <button
            onClick={() => setShowNewRule(!showNewRule)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </button>
          {onClose && (
            <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Close
            </button>
          )}
        </div>
      </div>

      {/* Dry run results */}
      {dryRunResult && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            <TestTube2 className="h-4 w-4 text-amber-400" />
            Dry Run Results
            <span className="text-zinc-500">
              ({dryRunResult.events_tested} events, {dryRunResult.rules_tested} rules)
            </span>
          </div>
          {dryRunResult.would_fire.length > 0 && (
            <div className="space-y-1">
              <div className="text-green-400 font-medium">Would Fire ({dryRunResult.would_fire.length}):</div>
              {dryRunResult.would_fire.slice(0, 10).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-400 pl-2">
                  <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                  <span className="text-zinc-300">{f.rule_name}</span>
                  <span className="text-zinc-600">on</span>
                  <span className="text-zinc-400">{f.event_type}</span>
                </div>
              ))}
              {dryRunResult.would_fire.length > 10 && (
                <div className="text-zinc-500 pl-2">...and {dryRunResult.would_fire.length - 10} more</div>
              )}
            </div>
          )}
          {dryRunResult.would_skip.length > 0 && (
            <div className="space-y-1">
              <div className="text-zinc-500 font-medium">Would Skip ({dryRunResult.would_skip.length}):</div>
              {dryRunResult.would_skip.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-500 pl-2">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{s.rule_name}</span>
                  <span className="text-zinc-600">-</span>
                  <span>{s.reason}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setDryRunResult(null)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New rule form */}
      {showNewRule && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-3">
          <input
            type="text"
            value={newRuleName}
            onChange={e => setNewRuleName(e.target.value)}
            placeholder="Rule name..."
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />

          {/* Trigger event */}
          <div className="space-y-1">
            <label className="text-[11px] text-zinc-500 uppercase">When Event</label>
            <select
              value={newRuleTrigger}
              onChange={e => setNewRuleTrigger(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              {EVENT_TYPES.map(et => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-zinc-500 uppercase">If Conditions</label>
              <button
                onClick={() => setNewRuleConditions([...newRuleConditions, newCondition()])}
                className="text-[11px] text-blue-400 hover:text-blue-300"
              >
                + Add
              </button>
            </div>
            {newRuleConditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={cond.field}
                  onChange={e => {
                    const updated = [...newRuleConditions]
                    updated[i] = { ...cond, field: e.target.value }
                    setNewRuleConditions(updated)
                  }}
                  placeholder="field path"
                  className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
                />
                <select
                  value={cond.op}
                  onChange={e => {
                    const updated = [...newRuleConditions]
                    updated[i] = { ...cond, op: e.target.value }
                    setNewRuleConditions(updated)
                  }}
                  className="bg-zinc-900/50 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-200"
                >
                  {CONDITION_OPS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={String(cond.value ?? '')}
                  onChange={e => {
                    const updated = [...newRuleConditions]
                    updated[i] = { ...cond, value: e.target.value }
                    setNewRuleConditions(updated)
                  }}
                  placeholder="value"
                  className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
                />
                <button
                  onClick={() => setNewRuleConditions(newRuleConditions.filter((_, j) => j !== i))}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-zinc-500 uppercase">Then Actions</label>
              <button
                onClick={() => setNewRuleActions([...newRuleActions, newAction()])}
                className="text-[11px] text-blue-400 hover:text-blue-300"
              >
                + Add
              </button>
            </div>
            {newRuleActions.map((act, i) => (
              <div key={i} className="space-y-1 bg-zinc-900/30 rounded p-2">
                <div className="flex items-center gap-1.5">
                  <GripVertical className="h-3 w-3 text-zinc-600 shrink-0" />
                  <select
                    value={act.action}
                    onChange={e => {
                      const updated = [...newRuleActions]
                      updated[i] = { ...act, action: e.target.value }
                      setNewRuleActions(updated)
                    }}
                    className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  >
                    {ACTION_TYPES.map(at => (
                      <option key={at.value} value={at.value}>{at.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setNewRuleActions(newRuleActions.filter((_, j) => j !== i))}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {/* Simple params JSON editor */}
                <textarea
                  value={JSON.stringify(act.params, null, 2)}
                  onChange={e => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      const updated = [...newRuleActions]
                      updated[i] = { ...act, params: parsed }
                      setNewRuleActions(updated)
                    } catch {
                      // Allow typing -- will validate on save
                    }
                  }}
                  rows={2}
                  placeholder='{"title": "{{trigger.payload.title}}"}'
                  className="w-full bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 font-mono placeholder:text-zinc-600 resize-none"
                />

                {/* Pipeline stages (only for run_pipeline) */}
                {act.action === 'run_pipeline' && (
                  <div className="pl-3 space-y-1 border-l-2 border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-400 uppercase">Pipeline Stages</span>
                      <button
                        onClick={() => {
                          const updated = [...newRuleActions]
                          const stages = [...(act.stages || []), newPipelineStage()]
                          updated[i] = { ...act, stages }
                          setNewRuleActions(updated)
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        + Stage
                      </button>
                    </div>
                    {(act.stages || []).map((stage, si) => (
                      <div key={si} className="flex items-center gap-1 text-xs">
                        <input
                          type="text"
                          value={stage.name}
                          onChange={e => {
                            const updated = [...newRuleActions]
                            const stages = [...(act.stages || [])]
                            stages[si] = { ...stage, name: e.target.value }
                            updated[i] = { ...act, stages }
                            setNewRuleActions(updated)
                          }}
                          placeholder="stage name"
                          className="w-20 bg-zinc-900/50 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 placeholder:text-zinc-600"
                        />
                        <select
                          value={stage.action}
                          onChange={e => {
                            const updated = [...newRuleActions]
                            const stages = [...(act.stages || [])]
                            stages[si] = { ...stage, action: e.target.value }
                            updated[i] = { ...act, stages }
                            setNewRuleActions(updated)
                          }}
                          className="flex-1 bg-zinc-900/50 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200"
                        >
                          {ACTION_TYPES.filter(a => a.value !== 'run_pipeline').map(at => (
                            <option key={at.value} value={at.value}>{at.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const updated = [...newRuleActions]
                            const stages = (act.stages || []).filter((_, sj) => sj !== si)
                            updated[i] = { ...act, stages }
                            setNewRuleActions(updated)
                          }}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cooldown */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-zinc-500">Cooldown (seconds):</label>
            <input
              type="number"
              value={newRuleCooldown}
              onChange={e => setNewRuleCooldown(Number(e.target.value))}
              min={0}
              className="w-20 bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
            />
          </div>

          {/* Save/Cancel */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateRule}
              disabled={saving || !newRuleName.trim()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white transition-colors"
            >
              <Save className="h-3 w-3" />
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
            <button
              onClick={() => { setShowNewRule(false); setNewRuleName('') }}
              className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing rules */}
      {rules.length === 0 && !showNewRule ? (
        <div className="text-center py-6 text-zinc-500 text-sm">
          No rules yet. Add a rule to define automation logic.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule, idx) => {
            const isExpanded = expandedRule === rule.id
            return (
              <div key={rule.id} className="bg-zinc-800/30 border border-zinc-700/40 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </button>

                  <span className="text-xs text-zinc-500 w-5 text-right">{idx + 1}</span>

                  {/* Enabled toggle */}
                  <button
                    onClick={() => handleToggleEnabled(rule)}
                    className={`h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
                      rule.enabled
                        ? 'bg-green-500 border-green-400'
                        : 'bg-zinc-700 border-zinc-600'
                    }`}
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  />

                  <span className="text-sm text-zinc-200 truncate flex-1" title={rule.name}>
                    {rule.name}
                  </span>

                  <span className="text-[10px] text-zinc-500 shrink-0">
                    {rule.trigger_event}
                  </span>

                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {rule.fire_count}x
                  </span>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-700/30 px-3 py-2 text-xs space-y-2">
                    {/* Conditions */}
                    {rule.conditions.length > 0 && (
                      <div>
                        <div className="text-zinc-500 uppercase text-[10px] mb-1">Conditions</div>
                        {rule.conditions.map((c, ci) => (
                          <div key={ci} className="text-zinc-400">
                            {c.field} <span className="text-zinc-500">{c.op}</span> {String(c.value)}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Actions */}
                    {rule.actions.length > 0 && (
                      <div>
                        <div className="text-zinc-500 uppercase text-[10px] mb-1">Actions</div>
                        {rule.actions.map((a, ai) => (
                          <div key={ai} className="text-zinc-400">
                            <span className="text-blue-400">{a.action}</span>
                            {' '}
                            <span className="text-zinc-600 font-mono text-[10px]">
                              {JSON.stringify(a.params)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {rule.cooldown_seconds > 0 && (
                      <div className="text-zinc-500">
                        Cooldown: {rule.cooldown_seconds}s
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
