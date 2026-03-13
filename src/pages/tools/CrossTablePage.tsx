/**
 * Cross Table Page
 *
 * Routes:
 *   /dashboard/tools/cross-table       → list view
 *   /dashboard/tools/cross-table/new   → template selector → create
 *   /dashboard/tools/cross-table/:id   → editor
 *   /dashboard/tools/cross-table/:id/score → editor (scorer view)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Plus,
  Loader2,
  Table2,
  Clock,
  Users,
  BarChart3,
  FileSpreadsheet,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/utils'
import { TemplateSelector } from '@/components/cross-table/TemplateSelector'
import { CrossTableEditor } from '@/components/cross-table/CrossTableEditor'
import { ScorerView } from '@/components/cross-table/ScorerView'
import type { CrossTable, Score, TemplateType } from '@/lib/cross-table/types'

// ── Template labels for list view ──────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  carvar: 'CARVER',
  coa: 'COA Analysis',
  weighted: 'Weighted',
  pugh: 'Pugh Matrix',
  risk: 'Risk Assessment',
  'kepner-tregoe': 'Kepner-Tregoe',
  prioritization: 'Prioritization',
  blank: 'Blank Matrix',
}

// ── Status badge variants ──────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  scoring: 'default',
  complete: 'outline',
}

// ── Auth header helper ─────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

// ── Main Router Component ──────────────────────────────────────

export default function CrossTablePage() {
  const { id } = useParams()
  const location = useLocation()
  const isNew = location.pathname.endsWith('/new')
  const isScore = location.pathname.endsWith('/score')

  if (isNew) return <NewCrossTableView />
  if (id && isScore) return <ScorerView />
  if (id) return <EditCrossTableView id={id} />
  return <CrossTableListView />
}

// ── New: Template Selector → Create ────────────────────────────

function NewCrossTableView() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const handleSelect = async (templateType: TemplateType) => {
    setCreating(true)
    try {
      const res = await fetch('/api/cross-table', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: 'Untitled Cross Table',
          template_type: templateType,
        }),
      })
      if (!res.ok) throw new Error('Failed to create cross table')
      const data = await res.json()
      navigate(`/dashboard/tools/cross-table/${data.table.id}`, { replace: true })
    } catch {
      setCreating(false)
      // TODO: show toast error
    }
  }

  return <TemplateSelector onSelect={handleSelect} loading={creating} />
}

// ── Edit: Fetch table + scores → Editor ────────────────────────

function EditCrossTableView({ id }: { id: string }) {
  const navigate = useNavigate()
  const [table, setTable] = useState<CrossTable | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTable = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cross-table/${id}`, {
        headers: getHeaders(),
        signal,
      })
      if (res.status === 404) {
        setError('Cross table not found')
        return
      }
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)

      const data = await res.json()
      setTable(data.table)
      setScores(data.scores ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load cross table')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    fetchTable(controller.signal)
    return () => controller.abort()
  }, [fetchTable])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !table) {
    return (
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">
          {error ?? 'Cross table not found'}
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard/tools/cross-table')}
        >
          Back to List
        </Button>
      </div>
    )
  }

  return <CrossTableEditor table={table} scores={scores} />
}

// ── List View ──────────────────────────────────────────────────

function CrossTableListView() {
  const navigate = useNavigate()
  const [tables, setTables] = useState<CrossTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchTables = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cross-table', { headers: getHeaders(), signal })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)

      const data = await res.json()
      const list = Array.isArray(data) ? data : data.tables ?? []
      setTables(list)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load cross tables')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchTables(controller.signal)
    return () => controller.abort()
  }, [fetchTables])

  const filtered = tables.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  // ── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-slate-200">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2 mt-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">
          {error}
        </div>
        <Button onClick={() => fetchTables()} variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="rounded-full bg-muted p-6 mb-6">
          <Table2 className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Create Your First Cross Table</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Build decision matrices to compare alternatives against weighted criteria.
          Choose a template or start from scratch.
        </p>
        <Button
          onClick={() => navigate('/dashboard/tools/cross-table/new')}
          size="lg"
          className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Cross Table
        </Button>
      </div>
    )
  }

  // ── List with search ───────────────────────────────────────

  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cross Tables</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tables.length} table{tables.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/tools/cross-table/new')}
          className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Cross Table
        </Button>
      </div>

      {/* Search */}
      {tables.length > 5 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((table) => {
          const rowCount = table.config?.rows?.length ?? 0
          const colCount = table.config?.columns?.length ?? 0

          return (
            <Card
              key={table.id}
              className="cursor-pointer border border-slate-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              onClick={() => navigate(`/dashboard/tools/cross-table/${table.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-md bg-[#4F5BFF]/10 p-1.5 shrink-0">
                      <Table2 className="h-4 w-4 text-[#4F5BFF]" />
                    </div>
                    <CardTitle className="text-sm font-semibold truncate">
                      {table.title}
                    </CardTitle>
                  </div>
                  <Badge
                    variant={STATUS_VARIANT[table.status] ?? 'secondary'}
                    className="shrink-0 text-[10px]"
                  >
                    {table.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {table.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {table.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {TEMPLATE_LABELS[table.template_type] ?? table.template_type}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {colCount} criteria
                  </span>
                  <span className="flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    {rowCount} alt{rowCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(table.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* No search results */}
      {filtered.length === 0 && search && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No tables matching &ldquo;{search}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
