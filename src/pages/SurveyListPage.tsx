/**
 * Survey Drops List Page
 *
 * Card grid of surveys with status filter tabs, inline create form,
 * and share link copy. Dark-mode compatible.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Copy, Check, ClipboardList, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCopHeaders } from '@/lib/cop-auth'
import { cn } from '@/lib/utils'
import type { SurveyDrop, IntakeFormStatus } from '@/types/cop'
import { SURVEY_TEMPLATES } from '@/lib/survey-templates'

// ── Status badge config ─────────────────────────────────────────

const STATUS_COLORS: Record<IntakeFormStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400',
}

type FilterTab = 'all' | IntakeFormStatus

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
  { label: 'Closed', value: 'closed' },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SurveyListPage() {
  const navigate = useNavigate()

  const [surveys, setSurveys] = useState<SurveyDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchSurveys = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const statusParam = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/surveys${statusParam}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error(`Failed to load surveys (${res.status})`)
      const data = await res.json() as { surveys: SurveyDrop[] }
      setSurveys(data.surveys)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load surveys')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    const controller = new AbortController()
    fetchSurveys(controller.signal)
    return () => controller.abort()
  }, [fetchSurveys])

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const template = SURVEY_TEMPLATES.find(t => t.id === selectedTemplate)
      const body: Record<string, unknown> = {
        title: title.trim(),
        status: 'draft',
      }
      if (template) {
        body.description = template.defaultDescription
        body.form_schema = template.fields
      }
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `Failed to create survey (${res.status})`)
      }
      const data = await res.json() as { id: string }
      navigate(`/dashboard/drops/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create survey')
    } finally {
      setCreating(false)
    }
  }, [title, selectedTemplate, navigate])

  const handleCopyLink = useCallback((survey: SurveyDrop, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = survey.custom_slug
      ? `${window.location.origin}/drop/${survey.custom_slug}`
      : `${window.location.origin}/drop/${survey.share_token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(survey.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleToggleStatus = useCallback(async (survey: SurveyDrop, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextStatus: Record<string, string> = { draft: 'active', active: 'closed', closed: 'draft' }
    const newStatus = nextStatus[survey.status] || 'draft'
    try {
      const res = await fetch(`/api/surveys/${survey.id}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, status: newStatus as IntakeFormStatus } : s))
    } catch (err) { setError(err instanceof Error ? err.message : 'Status update failed') }
  }, [])

  const handleDuplicate = useCallback(async (survey: SurveyDrop, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          title: `${survey.title} (copy)`,
          description: survey.description,
          form_schema: survey.form_schema,
          status: 'draft',
        }),
      })
      if (!res.ok) throw new Error('Failed to duplicate survey')
      const data = await res.json() as { id: string }
      navigate(`/dashboard/drops/${data.id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Duplicate failed') }
  }, [navigate])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Drops</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage data collection drops
          </p>
        </div>
        <Button onClick={() => { setShowCreate(true); setSelectedTemplate(null); setTitle('') }} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Drop
        </Button>
      </div>

      {/* Template picker / create form */}
      {showCreate && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6 space-y-4">
            {!selectedTemplate && selectedTemplate !== 'blank' ? (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Choose a template or start blank
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SURVEY_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedTemplate(tmpl.id)
                        setTitle(tmpl.defaultTitle)
                      }}
                      className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors min-h-[80px]"
                    >
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                        {tmpl.name}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {tmpl.description}
                      </span>
                      <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                        {tmpl.fields.length} field{tmpl.fields.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedTemplate('blank')
                      setTitle('')
                    }}
                    className="text-left p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors min-h-[80px]"
                  >
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                      Blank Drop
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Start from scratch with no pre-built fields
                    </span>
                  </button>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false)
                      setSelectedTemplate(null)
                      setTitle('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedTemplate(null)
                      setTitle('')
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    &larr; Back to templates
                  </button>
                  {selectedTemplate !== 'blank' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Template: {SURVEY_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Drop title"
                    className="w-full px-3 py-2 text-base rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={!title.trim() || creating}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreate(false)
                      setSelectedTemplate(null)
                      setTitle('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 whitespace-nowrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-4 py-2 min-h-[40px] text-sm font-medium border-b-2 transition-colors',
                filter === tab.value
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      )}

      {/* Empty state */}
      {!loading && !error && surveys.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            No drops yet. Create your first drop to start collecting data.
          </p>
        </div>
      )}

      {/* Card grid */}
      {!loading && surveys.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => (
            <Card
              key={survey.id}
              className="cursor-pointer hover:shadow-md transition-shadow dark:hover:border-gray-600"
              onClick={() => navigate(`/dashboard/drops/${survey.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold line-clamp-2">
                    {survey.title}
                  </CardTitle>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                      STATUS_COLORS[survey.status]
                    )}
                  >
                    {survey.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {survey.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {survey.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{survey.submission_count} submission{survey.submission_count !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(survey.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleToggleStatus(survey, e)}
                    className="text-xs px-3 py-1.5 min-h-[36px] sm:text-[10px] sm:px-2 sm:py-0.5 sm:min-h-0 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={`Switch to ${({ draft: 'active', active: 'closed', closed: 'draft' } as Record<string, string>)[survey.status]}`}
                  >
                    {({ draft: 'Activate', active: 'Close', closed: 'Reopen' } as Record<string, string>)[survey.status]}
                  </button>
                  <button
                    onClick={(e) => handleDuplicate(survey, e)}
                    className="text-xs px-3 py-1.5 min-h-[36px] sm:text-[10px] sm:px-2 sm:py-0.5 sm:min-h-0 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Duplicate drop"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => handleCopyLink(survey, e)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 min-h-[36px] sm:text-[10px] sm:px-2 sm:py-0.5 sm:min-h-0 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {copiedId === survey.id ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Link
                      </>
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
