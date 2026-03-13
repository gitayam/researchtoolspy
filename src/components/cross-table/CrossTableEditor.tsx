/**
 * CrossTableEditor — Main editor shell with useReducer + CrossTableContext.
 *
 * Tab navigation: Matrix | Weights | Results | Sensitivity | Consensus | AI Insights
 * - Autosave config changes (debounced 1s PUT)
 * - Explicit save for scores (dirty tracking + "Save Scores" button)
 */

import {
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Grid3X3,
  Weight,
  BarChart3,
  Activity,
  Users,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CrossTableToolbar } from './CrossTableToolbar'
import { MatrixGrid } from './MatrixGrid'
import { WeightsPanel } from './WeightsPanel'
import { ConsensusPanel } from './ConsensusPanel'
import { ResultsPanel } from './ResultsPanel'
import { SensitivityPanel } from './SensitivityPanel'
import { AIInsightsPanel } from './AIInsightsPanel'
import type { CrossTable, Score, RowResult } from '@/lib/cross-table/types'
import { computeRankings } from '@/lib/cross-table/engine/ranking'
import {
  CrossTableContext,
  editorReducer,
  useCrossTable,
  type EditorState,
  type EditorAction,
} from './cross-table-context'

// Re-export for existing consumers
export { useCrossTable }
export type { EditorState, EditorAction }

// ── Tab definitions ─────────────────────────────────────────────

interface TabDef {
  id: string
  label: string
  icon: typeof Grid3X3
  visible: (state: EditorState) => boolean
}

const TABS: TabDef[] = [
  {
    id: 'matrix',
    label: 'Matrix',
    icon: Grid3X3,
    visible: () => true,
  },
  {
    id: 'weights',
    label: 'Weights',
    icon: Weight,
    visible: () => true,
  },
  {
    id: 'results',
    label: 'Results',
    icon: BarChart3,
    // Visible when at least 1 row + 1 col has a score
    visible: (state) => {
      const { rows, columns } = state.table.config
      if (rows.length === 0 || columns.length === 0) return false
      return state.scores.some((s) => s.score !== null)
    },
  },
  {
    id: 'sensitivity',
    label: 'Sensitivity',
    icon: Activity,
    // Visible when results visible + at least 2 weighted criteria
    visible: (state) => {
      const { columns } = state.table.config
      const hasResults = state.scores.some((s) => s.score !== null)
      const weightedCols = columns.filter((c) => c.weight > 0)
      return hasResults && weightedCols.length >= 2
    },
  },
  {
    id: 'consensus',
    label: 'Consensus',
    icon: Users,
    // Visible when 2+ scorers
    visible: (state) => {
      const scorerIds = new Set(state.scores.map((s) => s.user_id))
      return scorerIds.size >= 2
    },
  },
  {
    id: 'ai-insights',
    label: 'AI Insights',
    icon: Sparkles,
    visible: () => true,
  },
]

// ── Main Editor Component ───────────────────────────────────────

interface CrossTableEditorProps {
  table: CrossTable
  scores: Score[]
}

export function CrossTableEditor({ table, scores }: CrossTableEditorProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const [state, dispatch] = useReducer(editorReducer, {
    table,
    scores,
    scoresDirty: false,
    configVersion: 0,
    activeTab: 'matrix',
  })

  // Sync external data on prop changes
  useEffect(() => {
    dispatch({ type: 'SET_TABLE', table })
  }, [table])

  useEffect(() => {
    dispatch({ type: 'SET_SCORES', scores })
  }, [scores])

  // ── Autosave config (debounced 1s) ──────────────────────────

  const configVersionRef = useRef(state.configVersion)
  configVersionRef.current = state.configVersion

  useEffect(() => {
    if (state.configVersion === 0) return

    const timeout = setTimeout(async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const userHash = localStorage.getItem('omnicore_user_hash')
        if (userHash) headers['X-User-Hash'] = userHash

        await fetch(`/api/cross-table/${state.table.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            title: state.table.title,
            description: state.table.description,
            config: state.table.config,
          }),
        })
      } catch {
        // Silent fail for autosave — user can still explicitly save
      }
    }, 1000)

    return () => clearTimeout(timeout)
  }, [state.configVersion, state.table.id, state.table.title, state.table.description, state.table.config])

  // ── Explicit save scores ────────────────────────────────────

  const handleSaveScores = useCallback(async () => {
    setSaving(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const userHash = localStorage.getItem('omnicore_user_hash')
      if (userHash) headers['X-User-Hash'] = userHash

      const res = await fetch(`/api/cross-table/${state.table.id}/scores`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          scores: state.scores.map((s) => ({
            row_id: s.row_id,
            col_id: s.col_id,
            score: s.score,
            confidence: s.confidence,
            notes: s.notes,
          })),
        }),
      })

      if (!res.ok) throw new Error('Failed to save scores')
      const data = await res.json()
      dispatch({ type: 'SET_SCORES', scores: data.scores ?? state.scores })
      dispatch({ type: 'MARK_SCORES_CLEAN' })
    } catch {
      // TODO: show toast
    } finally {
      setSaving(false)
    }
  }, [state.table.id, state.scores])

  // ── Share ───────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const userHash = localStorage.getItem('omnicore_user_hash')
      if (userHash) headers['X-User-Hash'] = userHash

      const res = await fetch(`/api/cross-table/${state.table.id}/share`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error('Failed to generate share link')
      const data = await res.json()
      await navigator.clipboard.writeText(data.url)
      // TODO: show toast "Link copied"
    } catch {
      // TODO: show toast error
    }
  }, [state.table.id])

  // ── Delete ──────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this cross table? This cannot be undone.')) return
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const userHash = localStorage.getItem('omnicore_user_hash')
      if (userHash) headers['X-User-Hash'] = userHash

      await fetch(`/api/cross-table/${state.table.id}`, {
        method: 'DELETE',
        headers,
      })
      navigate('/dashboard/tools/cross-table')
    } catch {
      // TODO: show toast error
    }
  }, [state.table.id, navigate])

  // ── Compute results for export ──────────────────────────────

  const results: RowResult[] = useMemo(() => {
    try {
      return computeRankings(state.table.config, state.scores)
    } catch (err) {
      console.warn('[CrossTable] computeRankings failed:', err)
      return []
    }
  }, [state.table.config, state.scores])

  // ── Visible tabs ────────────────────────────────────────────

  const visibleTabs = TABS.filter((t) => t.visible(state))

  return (
    <CrossTableContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-full min-h-0">
        <CrossTableToolbar
          table={state.table}
          scores={state.scores}
          results={results}
          scoresDirty={state.scoresDirty}
          saving={saving}
          onSaveScores={handleSaveScores}
          onShare={handleShare}
          onDelete={handleDelete}
        />

        <Tabs
          value={state.activeTab}
          onValueChange={(tab) => dispatch({ type: 'SET_TAB', tab })}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Tab bar — horizontally scrollable on mobile */}
          <div className="border-b border-slate-200 px-4 md:px-6 overflow-x-auto">
            <TabsList className="h-11 bg-transparent p-0 gap-0">
              {visibleTabs.map((t) => {
                const Icon = t.icon
                return (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className={cn(
                      'gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm',
                      'data-[state=active]:border-[#4F5BFF] data-[state=active]:bg-transparent data-[state=active]:text-[#4F5BFF] data-[state=active]:shadow-none'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          {/* Tab content area */}
          <div className="flex-1 min-h-0 overflow-auto">
            <TabsContent value="matrix" className="m-0 p-4 md:p-6">
              <MatrixGrid />
            </TabsContent>
            <TabsContent value="weights" className="m-0 p-4 md:p-6">
              <WeightsPanel />
            </TabsContent>
            <TabsContent value="results" className="m-0 p-4 md:p-6">
              <ResultsPanel />
            </TabsContent>
            <TabsContent value="sensitivity" className="m-0 p-4 md:p-6">
              <SensitivityPanel />
            </TabsContent>
            <TabsContent value="consensus" className="m-0 p-4 md:p-6">
              <ConsensusPanel />
            </TabsContent>
            <TabsContent value="ai-insights" className="m-0 p-4 md:p-6">
              <AIInsightsPanel />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </CrossTableContext.Provider>
  )
}
