import { useState, useEffect, useCallback } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { notifyCopChanged } from '@/lib/cop-request'
import { useCopChangeListener } from '@/hooks/useCopChanges'
import { CopItemTags } from '@/components/cop/CopItemTags'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { TagFilterNote } from '@/components/cop/CopTagFilter'
import { useCopTagFilter } from '@/components/cop/tag-filter-context'
import { StaleWriteNotice } from '@/components/cop/CopStaleWrite'
import { copPutWithPrecondition } from '@/lib/cop-stale-write'
import { BulkTagBar, useCopTagsContext } from '@/components/cop/tags'
import {
  Plus,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Search,
  Eye,
  MapPin,
  User,
  Camera,
  Globe,
  Shield,
  ChevronDown,
  ChevronRight,
  CheckSquare,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
type TaskType =
  | 'pimeyes'
  | 'geoguessr'
  | 'forensic'
  | 'osint'
  | 'reverse_image'
  | 'social_media'
  | 'general'

interface CopTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  task_type: TaskType
  assigned_to: string | null
  linked_persona_id: string | null
  linked_marker_id: string | null
  linked_hypothesis_id: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface CopTaskBoardProps {
  sessionId: string
  expanded?: boolean
}

// ── Constants ─────────────────────────────────────────────────────

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; color: string; icon: typeof Globe }> = {
  pimeyes:      { label: 'PimEyes',       color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',     icon: Eye },
  geoguessr:    { label: 'GeoGuessr',     color: 'bg-green-500/20 text-green-400 border-green-500/30',  icon: MapPin },
  forensic:     { label: 'Forensic',      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     icon: Search },
  osint:        { label: 'OSINT',         color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Shield },
  reverse_image:{ label: 'Reverse Image', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',  icon: Camera },
  social_media: { label: 'Social Media',  color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',     icon: Globe },
  general:      { label: 'General',       color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',     icon: Circle },
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-gray-400',
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'osint', label: 'OSINT' },
  { value: 'pimeyes', label: 'PimEyes' },
  { value: 'geoguessr', label: 'GeoGuessr' },
  { value: 'forensic', label: 'Forensic' },
  { value: 'reverse_image', label: 'Reverse Image' },
  { value: 'social_media', label: 'Social Media' },
]

const COLUMNS: { key: TaskStatus; label: string; icon: typeof Circle }[] = [
  { key: 'todo', label: 'TODO', icon: Circle },
  { key: 'in_progress', label: 'IN PROGRESS', icon: Clock },
  { key: 'done', label: 'DONE', icon: CheckCircle2 },
]

const STATUS_TRANSITIONS: Record<TaskStatus, { label: string; target: TaskStatus }[]> = {
  todo:        [{ label: 'Start', target: 'in_progress' }, { label: 'Block', target: 'blocked' }],
  in_progress: [{ label: 'Complete', target: 'done' }, { label: 'Block', target: 'blocked' }, { label: 'Back to TODO', target: 'todo' }],
  done:        [{ label: 'Reopen', target: 'todo' }],
  blocked:     [{ label: 'Unblock', target: 'todo' }, { label: 'Resume', target: 'in_progress' }],
}

// ── Helpers ───────────────────────────────────────────────────────


function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function sortTasks(tasks: CopTask[]): CopTask[] {
  return [...tasks].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9
    const pb = priorityOrder[b.priority] ?? 9
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

// ── Component ─────────────────────────────────────────────────────

export default function CopTaskBoard({ sessionId, expanded = true }: CopTaskBoardProps) {
  const [tasks, setTasks] = useState<CopTask[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newType, setNewType] = useState<TaskType>('general')
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Blocked section collapsed
  const [blockedOpen, setBlockedOpen] = useState(false)

  const tagFilter = useCopTagFilter()
  const tagsContext = useCopTagsContext()
  const bulk = useBulkSelection('task')
  /** A status change someone else's edit got in the way of. */
  const [stale, setStale] = useState<{ taskId: string; status: TaskStatus } | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)

  // ── Fetch tasks ──────────────────────────────────────────────

  const fetchTasks = useCallback(async (isBackground = false, signal?: AbortSignal) => {
    if (isBackground) setPolling(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/tasks`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()
      const items: CopTask[] = data.tasks ?? data ?? []
      setTasks(items)
      setFetchError(false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (!isBackground) setFetchError(true)
    } finally {
      setLoading(false)
      setPolling(false)
    }
  }, [sessionId])

  useEffect(() => {
    const controller = new AbortController()
    // fetchTasks sets state only after its request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTasks(false, controller.signal)
    return () => controller.abort()
  }, [fetchTasks])

  // Live: refetch when the page's change feed reports task changes.
  useCopChangeListener(['task'], () => { fetchTasks(true) })

  // ── Create task ──────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const trimmed = newTitle.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/tasks`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          title: trimmed,
          description: newDescription.trim() || null,
          task_type: newType,
          priority: newPriority,
          assigned_to: newAssignedTo.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create task')
      setNewTitle('')
      setNewDescription('')
      setNewType('general')
      setNewPriority('medium')
      setNewAssignedTo('')
      setShowForm(false)
      notifyCopChanged(['task'])
      await fetchTasks()
    } catch (err) {
      console.error('[CopTaskBoard] Create task failed:', err)
    } finally {
      setSubmitting(false)
    }
  }, [newTitle, newDescription, newType, newPriority, newAssignedTo, sessionId, fetchTasks])

  // ── Update task status ───────────────────────────────────────

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus, opts: { force?: boolean } = {}) => {
    // The version this change is based on; the server refuses it if someone saved since.
    const seen = opts.force ? null : tasks.find(t => t.id === taskId)?.updated_at ?? null
    setStale(null)
    setWriteError(null)
    // Optimistic update
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
          : t
      )
    )
    const result = await copPutWithPrecondition(`/api/cop/${sessionId}/tasks`, { id: taskId, status: newStatus }, seen)
    if (result.kind === 'stale') setStale({ taskId, status: newStatus })
    else if (result.kind === 'error') setWriteError(result.message)
    else notifyCopChanged(['task'])
    await fetchTasks()
  }, [sessionId, fetchTasks, tasks])

  // ── Derived data ─────────────────────────────────────────────

  const visibleTasks = tagFilter.filtering ? tasks.filter(t => tagFilter.passes('task', t.id)) : tasks
  const tasksByStatus = (status: TaskStatus) => sortTasks(visibleTasks.filter(t => t.status === status))

  const todoTasks = tasksByStatus('todo')
  const inProgressTasks = tasksByStatus('in_progress')
  const doneTasks = tasksByStatus('done')
  const blockedTasks = tasksByStatus('blocked')

  const totalCount = tasks.length
  const statusCounts: Record<TaskStatus, number> = {
    todo: todoTasks.length,
    in_progress: inProgressTasks.length,
    done: doneTasks.length,
    blocked: blockedTasks.length,
  }

  // ── Task card renderer ───────────────────────────────────────

  const renderTaskCard = (task: CopTask) => {
    const isExpanded = expandedTask === task.id
    const typeConfig = TASK_TYPE_CONFIG[task.task_type] ?? TASK_TYPE_CONFIG.general
    const TypeIcon = typeConfig.icon
    const transitions = STATUS_TRANSITIONS[task.status] ?? []

    return (
      <div
        key={task.id}
        className={`rounded border bg-gray-50 dark:bg-gray-800/30 transition-colors duration-200 ${
          bulk.active && bulk.isSelected(task.id) ? 'border-blue-500/60' : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-start">
        {bulk.active && (
          <input
            type="checkbox"
            checked={bulk.isSelected(task.id)}
            onChange={() => bulk.toggle(task.id)}
            aria-label={`Select task ${task.title}`}
            className="ml-2 mt-2.5 h-4 w-4 shrink-0 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        )}
        <button
          type="button"
          onClick={() => setExpandedTask(prev => (prev === task.id ? null : task.id))}
          className="w-full flex items-start gap-2 px-2.5 py-2 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors duration-200"
        >
          {/* Priority dot */}
          <span
            className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`}
            title={`${task.priority} priority`}
          />

          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-200 line-clamp-2 sm:truncate leading-snug">
              {task.title}
            </p>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0 leading-4 rounded border ${typeConfig.color}`}
              >
                <TypeIcon className="h-2.5 w-2.5" />
                {typeConfig.label}
              </span>

              {task.assigned_to && (
                <span
                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500/20 text-blue-400 text-[8px] font-bold shrink-0"
                  title={task.assigned_to}
                >
                  {getInitials(task.assigned_to)}
                </span>
              )}
            </div>
          </div>

          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
          )}
        </button>
        </div>
        <CopItemTags targetType="task" targetId={task.id} label="task" max={3} className="px-2.5 pb-1.5 -mt-1" />

        {/* Expanded detail */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-2.5 py-2 space-y-2">
            {task.description && (
              <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Linked items */}
            {(task.linked_persona_id || task.linked_marker_id || task.linked_hypothesis_id) && (
              <div className="flex flex-wrap gap-1.5">
                {task.linked_persona_id && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <User className="h-2.5 w-2.5 inline mr-0.5" />
                    Persona linked
                  </span>
                )}
                {task.linked_marker_id && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    <MapPin className="h-2.5 w-2.5 inline mr-0.5" />
                    Marker linked
                  </span>
                )}
                {task.linked_hypothesis_id && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Search className="h-2.5 w-2.5 inline mr-0.5" />
                    Hypothesis linked
                  </span>
                )}
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
              {task.due_date && (
                <span className="text-amber-400">
                  Due {new Date(task.due_date).toLocaleDateString()}
                </span>
              )}
              {task.completed_at && (
                <span className="text-green-400">
                  Done {new Date(task.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Status change buttons */}
            {transitions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {transitions.map(t => (
                  <button
                    key={t.target}
                    type="button"
                    onClick={e => { e.stopPropagation(); handleStatusChange(task.id, t.target) }}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border cursor-pointer transition-colors duration-200 ${
                      t.target === 'done'
                        ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                        : t.target === 'blocked'
                          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          : t.target === 'in_progress'
                            ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                            : 'border-gray-500/30 text-gray-400 hover:bg-gray-500/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Compact view (expanded=false) ────────────────────────────

  if (!expanded) {
    const recentTasks = sortTasks(tasks).slice(0, 3)

    return (
      <div className="px-3 py-2 space-y-2">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {totalCount === 0 ? (
            <span className="text-[10px] text-gray-500">No tasks</span>
          ) : (
            <>
              {statusCounts.todo > 0 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {statusCounts.todo} todo
                </span>
              )}
              {statusCounts.in_progress > 0 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  {statusCounts.in_progress} active
                </span>
              )}
              {statusCounts.done > 0 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                  {statusCounts.done} done
                </span>
              )}
              {statusCounts.blocked > 0 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                  {statusCounts.blocked} blocked
                </span>
              )}
            </>
          )}
          {polling && <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />}
        </div>

        {/* Recent tasks one-liners */}
        {recentTasks.length > 0 && (
          <div className="space-y-1">
            {recentTasks.map(task => {
              const typeConfig = TASK_TYPE_CONFIG[task.task_type] ?? TASK_TYPE_CONFIG.general
              return (
                <div key={task.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                  <span className="text-gray-900 dark:text-gray-200 line-clamp-1 flex-1">{task.title}</span>
                  <span className={`shrink-0 px-1 py-0 rounded text-[8px] border ${typeConfig.color}`}>
                    {typeConfig.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Full Kanban view (expanded=true) ─────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">
            Tasks
          </h2>
          {totalCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold px-1">
              {totalCount}
            </span>
          )}
          {polling && <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5">
          {tagsContext?.available && totalCount > 0 && (
            <button
              type="button"
              onClick={() => (bulk.active ? bulk.stop() : bulk.setActive(true))}
              aria-pressed={bulk.active}
              className={`inline-flex items-center h-6 text-[10px] font-medium px-2 rounded border cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                bulk.active
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Select tasks to tag them together"
            >
              <CheckSquare className="h-3 w-3 mr-0.5" aria-hidden="true" />
              {bulk.active ? 'Done' : 'Select'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center h-6 text-[10px] font-medium px-2 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            Add Task
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {stale && (
          <StaleWriteNotice
            what="task"
            onReload={() => { setStale(null); fetchTasks() }}
            onKeepMine={() => handleStatusChange(stale.taskId, stale.status, { force: true })}
            onDismiss={() => setStale(null)}
          />
        )}
        {writeError && (
          <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">{writeError}</p>
        )}
        {bulk.active && tagsContext?.available && (
          bulk.targets.length > 0 ? (
            <BulkTagBar targets={bulk.targets} vocabulary={tagsContext.tags} onApply={tagsContext.bulk} onClearSelection={bulk.clear} />
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400" role="status">Select tasks to tag them together.</p>
          )
        )}
        <TagFilterNote shown={visibleTasks.length} total={tasks.length} />
        {/* Create form */}
        {showForm && (
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2 space-y-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as TaskType)}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TASK_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as TaskPriority)}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={newAssignedTo}
              onChange={e => setNewAssignedTo(e.target.value)}
              placeholder="Assigned to (optional)"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewTitle(''); setNewDescription(''); setNewAssignedTo('') }}
                className="h-6 text-[10px] font-medium px-2 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || !newTitle.trim()}
                className="h-6 text-[10px] font-medium px-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Loading / Error */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-500">Loading tasks...</span>
          </div>
        ) : fetchError ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500 mb-2">Failed to load tasks.</p>
            <button
              type="button"
              onClick={() => { setLoading(true); setFetchError(false); fetchTasks() }}
              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : totalCount === 0 && !showForm ? (
          <div className="text-center py-6">
            <Circle className="h-6 w-6 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No tasks yet. Create one to track investigative actions.
            </p>
          </div>
        ) : (
          <>
            {/* Kanban columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COLUMNS.map(col => {
                const colTasks =
                  col.key === 'todo' ? todoTasks
                  : col.key === 'in_progress' ? inProgressTasks
                  : doneTasks
                const ColIcon = col.icon

                return (
                  <div key={col.key} className="min-w-0">
                    {/* Column header */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <ColIcon className="h-3 w-3 text-gray-500" />
                      <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {col.label}
                      </span>
                      {colTasks.length > 0 && (
                        <span className="flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-0.5">
                          {colTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="space-y-1.5">
                      {colTasks.length > 0
                        ? colTasks.map(renderTaskCard)
                        : (
                          <div className="rounded border border-dashed border-gray-200 dark:border-gray-700 py-3 text-center">
                            <span className="text-[10px] text-gray-400">Empty</span>
                          </div>
                        )
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Blocked section (collapsed) */}
            {blockedTasks.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setBlockedOpen(!blockedOpen)}
                  className="flex items-center gap-1.5 w-full text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded px-1.5 py-1 transition-colors duration-200"
                >
                  {blockedOpen ? (
                    <ChevronDown className="h-3 w-3 text-red-400" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-red-400" />
                  )}
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                    Blocked
                  </span>
                  <span className="flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold px-0.5">
                    {blockedTasks.length}
                  </span>
                </button>

                {blockedOpen && (
                  <div className="mt-1.5 space-y-1.5 pl-1">
                    {blockedTasks.map(renderTaskCard)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
