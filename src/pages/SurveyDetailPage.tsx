/**
 * Survey Detail Page
 *
 * Three tabs: Builder (form schema editor), Responses (triage list),
 * Settings (access, branding, COP link). Dark-mode compatible.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCopHeaders } from '@/lib/cop-auth'
import { cn } from '@/lib/utils'
import type {
  SurveyDrop,
  SurveyResponse,
  IntakeFormField,
  IntakeFormFieldType,
  IntakeFormStatus,
  IntakeAccessLevel,
  SubmissionStatus,
} from '@/types/cop'

// ── Constants ───────────────────────────────────────────────────

type TabId = 'builder' | 'responses' | 'settings' | 'analytics'

const TABS: { id: TabId; label: string }[] = [
  { id: 'builder', label: 'Builder' },
  { id: 'responses', label: 'Responses' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]

const FIELD_TYPE_GROUPS: { label: string; types: { value: IntakeFormFieldType; label: string }[] }[] = [
  {
    label: 'Text',
    types: [
      { value: 'text', label: 'Short Text' },
      { value: 'textarea', label: 'Long Text' },
    ],
  },
  {
    label: 'Data',
    types: [
      { value: 'number', label: 'Number' },
      { value: 'datetime', label: 'Date/Time' },
      { value: 'checkbox', label: 'Checkbox' },
    ],
  },
  {
    label: 'Choice',
    types: [
      { value: 'select', label: 'Dropdown' },
      { value: 'multiselect', label: 'Multi-Select' },
      { value: 'rating', label: 'Rating (1-5)' },
      { value: 'likert', label: 'Likert Scale' },
    ],
  },
  {
    label: 'Network / Research',
    types: [
      { value: 'url', label: 'URL' },
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'ip_address', label: 'IP Address' },
      { value: 'onion', label: '.onion Address' },
      { value: 'handle', label: 'Social Handle' },
      { value: 'crypto_address', label: 'Crypto Address' },
    ],
  },
  {
    label: 'Location',
    types: [
      { value: 'geopoint', label: 'Location (lat/lon)' },
      { value: 'country', label: 'Country' },
    ],
  },
  {
    label: 'Media',
    types: [
      { value: 'file', label: 'File Upload' },
    ],
  },
]

const FIELD_PLACEHOLDERS: Partial<Record<IntakeFormFieldType, string>> = {
  url: 'e.g., Source URL',
  email: 'e.g., Contact Email',
  phone: 'e.g., Phone Number',
  ip_address: 'e.g., Server IP',
  onion: 'e.g., Hidden Service',
  handle: 'e.g., Twitter Handle',
  crypto_address: 'e.g., Wallet Address',
  geopoint: 'e.g., Incident Location',
  country: 'e.g., Country of Origin',
  rating: 'e.g., Confidence Level',
  likert: 'e.g., How likely is this?',
  textarea: 'e.g., Description',
  text: 'e.g., Title or Name',
  number: 'e.g., Amount',
  datetime: 'e.g., Date Observed',
  select: 'e.g., Category',
  multiselect: 'e.g., Tags',
  checkbox: 'e.g., Confirmed?',
  file: 'e.g., Screenshot',
}

const STATUS_COLORS: Record<IntakeFormStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400',
}

const RESPONSE_STATUS_COLORS: Record<SubmissionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  triaged: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Main Component ──────────────────────────────────────────────

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [survey, setSurvey] = useState<SurveyDrop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('builder')
  const [copied, setCopied] = useState(false)

  // Sync tab state with bottom nav via custom events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('survey-tab-change', { detail: activeTab }))
  }, [activeTab])

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as string
      if (tab === 'builder' || tab === 'responses' || tab === 'settings' || tab === 'analytics') {
        setActiveTab(tab)
      }
    }
    window.addEventListener('bottom-nav-tab-select', handler)
    return () => window.removeEventListener('bottom-nav-tab-select', handler)
  }, [])

  const fetchSurvey = useCallback(async (signal?: AbortSignal) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error(`Failed to load survey (${res.status})`)
      const data = await res.json() as SurveyDrop
      setSurvey(data)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    fetchSurvey(controller.signal)
    return () => controller.abort()
  }, [fetchSurvey])

  const shareUrl = survey
    ? survey.custom_slug
      ? `${window.location.origin}/drop/${survey.custom_slug}`
      : `${window.location.origin}/drop/${survey.share_token}`
    : ''

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/drops')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'Drop not found'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Share bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard/drops')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{survey.title}</h1>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_COLORS[survey.status]
            )}
          >
            {survey.status}
          </span>
        </div>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy share link
            </>
          )}
        </button>
      </div>

      {/* Tabs — hidden on mobile where bottom nav handles tab switching */}
      <div className="hidden sm:flex sm:gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 min-h-[44px] text-sm font-medium text-center border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'builder' && (
        <BuilderTab survey={survey} onSaved={(updated) => setSurvey(updated)} />
      )}
      {activeTab === 'responses' && <ResponsesTab surveyId={survey.id} copSessionId={survey.cop_session_id} />}
      {activeTab === 'analytics' && <AnalyticsTab surveyId={survey.id} />}
      {activeTab === 'settings' && (
        <SettingsTab survey={survey} onSaved={(updated) => setSurvey(updated)} />
      )}
    </div>
  )
}

// ── Builder Tab ─────────────────────────────────────────────────

function BuilderTab({
  survey,
  onSaved,
}: {
  survey: SurveyDrop
  onSaved: (s: SurveyDrop) => void
}) {
  const [title, setTitle] = useState(survey.title)
  const [description, setDescription] = useState(survey.description || '')
  const [fields, setFields] = useState<IntakeFormField[]>(
    () => (survey.form_schema || []).map(f => ({ ...f, _id: (f as any)._id || crypto.randomUUID() }))
  )
  const [requireLocation, setRequireLocation] = useState(!!survey.require_location)
  const [requireContact, setRequireContact] = useState(!!survey.require_contact)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const addField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      { name: `field_${prev.length + 1}`, type: 'text' as IntakeFormFieldType, label: '', required: false, _id: crypto.randomUUID() },
    ])
  }, [])

  const removeField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateField = useCallback((index: number, updates: Partial<IntakeFormField>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f
        const updated = { ...f, ...updates }
        // Auto-generate name from label
        if (updates.label !== undefined) {
          updated.name = updates.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '') || `field_${i + 1}`
        }
        return updated
      })
    )
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/surveys/${survey.id}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({
          title,
          description: description || null,
          form_schema: fields,
          require_location: requireLocation ? 1 : 0,
          require_contact: requireContact ? 1 : 0,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `Failed to save (${res.status})`)
      }
      const updated = await res.json() as SurveyDrop
      onSaved(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [survey.id, title, description, fields, requireLocation, requireContact, onSaved])

  return (
    <div className="space-y-6">
      {/* Title + Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-base rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-base rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={requireLocation}
            onChange={(e) => setRequireLocation(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Require location
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={requireContact}
            onChange={(e) => setRequireContact(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Require contact info
        </label>
      </div>

      {/* Form fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Form Fields</h3>
          <Button variant="outline" size="sm" onClick={addField} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Field
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No fields yet. Add fields to build your drop form.
          </p>
        )}

        {fields.map((field, index) => (
          <div
            key={(field as any)._id || field.name || index}
            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
              {/* Type selector */}
              <div className="w-full sm:w-36 sm:shrink-0">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Type
                </label>
                <select
                  value={field.type}
                  onChange={(e) =>
                    updateField(index, { type: e.target.value as IntakeFormFieldType })
                  }
                  className="w-full px-2 py-1.5 text-base sm:text-sm min-h-[44px] sm:min-h-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {FIELD_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Label */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder={FIELD_PLACEHOLDERS[field.type] || 'Field label'}
                  className="w-full px-2 py-1.5 text-base sm:text-sm min-h-[44px] sm:min-h-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              {/* Required toggle + Delete */}
              <div className="flex items-center gap-3 sm:pt-5">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={field.required || false}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Required
                </label>
                <button
                  onClick={() => removeField(index)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Options for select/multiselect */}
            {(field.type === 'select' || field.type === 'multiselect') && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  value={(field.options || []).join(', ')}
                  onChange={(e) =>
                    updateField(index, {
                      options: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full px-2 py-1.5 text-base sm:text-sm min-h-[44px] sm:min-h-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {saveSuccess && (
          <span className="text-sm text-green-600 dark:text-green-400">Saved</span>
        )}
        {saveError && (
          <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>
        )}
      </div>
    </div>
  )
}

// ── Responses Tab ───────────────────────────────────────────────

type ResponseFilter = 'all' | SubmissionStatus

function ResponsesTab({
  surveyId,
  copSessionId,
}: {
  surveyId: string
  copSessionId: string | null
}) {
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ResponseFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [triaging, setTriaging] = useState<string | null>(null)

  const fetchResponses = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/surveys/${surveyId}/responses`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error(`Failed to load responses (${res.status})`)
      const data = await res.json() as { responses: SurveyResponse[] }
      setResponses(data.responses)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load responses')
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    const controller = new AbortController()
    fetchResponses(controller.signal)
    return () => controller.abort()
  }, [fetchResponses])

  const handleTriage = useCallback(
    async (responseId: string, status: 'accepted' | 'rejected') => {
      setTriaging(responseId)
      try {
        const res = await fetch(`/api/surveys/${surveyId}/responses`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify({ id: responseId, status }),
        })
        if (!res.ok) throw new Error(`Triage failed (${res.status})`)
        setResponses((prev) =>
          prev.map((r) => (r.id === responseId ? { ...r, status } : r))
        )
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Triage failed')
      } finally {
        setTriaging(null)
      }
    },
    [surveyId]
  )

  const filtered =
    filter === 'all' ? responses : responses.filter((r) => r.status === filter)

  const RESPONSE_FILTERS: { label: string; value: ResponseFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'Rejected', value: 'rejected' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2">
        {RESPONSE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              filter === f.value
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          No responses {filter !== 'all' ? `with status "${filter}"` : 'yet'}.
        </p>
      )}

      {/* Response list */}
      <div className="space-y-2">
        {filtered.map((response) => {
          const isExpanded = expandedId === response.id
          return (
            <div
              key={response.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Row header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : response.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                )}
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                  {response.submitter_name || 'Anonymous'}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    RESPONSE_STATUS_COLORS[response.status]
                  )}
                >
                  {response.status}
                </span>
                {response.submitter_country && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {response.submitter_country}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {formatDate(response.created_at)}
                </span>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50 space-y-3">
                  {/* Form data */}
                  <div className="mt-3 space-y-2">
                    {Object.entries(response.form_data)
                      .filter(([key]) => !key.startsWith('_'))
                      .map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                        <span className="font-medium text-muted-foreground text-xs">
                          {key}:
                        </span>
                        <span className="text-sm break-all text-gray-900 dark:text-white">
                          {Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                        </span>
                      </div>
                    ))}
                    {/* Auto-tags */}
                    {Array.isArray((response.form_data as any)._tags) && (response.form_data as any)._tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(response.form_data as any)._tags.map((tag: string) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{tag}</span>
                        ))}
                      </div>
                    )}
                    {/* URL enrichment */}
                    {Object.entries(response.form_data)
                      .filter(([key]) => key.startsWith('_enriched_'))
                      .map(([key, enrichment]: [string, any]) => (
                      <div key={key} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Enriched from URL</p>
                        {enrichment.title && <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{enrichment.title}</p>}
                        {enrichment.summary && <p className="text-xs text-slate-500 dark:text-slate-400">{enrichment.summary}</p>}
                        {enrichment.excerpt && !enrichment.summary && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{enrichment.excerpt}</p>}
                        {enrichment.analysis_id && <p className="text-[10px] text-blue-500">Analysis ID: {enrichment.analysis_id}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Contact info */}
                  {response.submitter_contact && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Contact: </span>
                      <span className="text-gray-900 dark:text-white">{response.submitter_contact}</span>
                    </div>
                  )}

                  {/* Location */}
                  {response.lat != null && response.lon != null && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Location: </span>
                      <span className="text-gray-900 dark:text-white">
                        {response.lat.toFixed(4)}, {response.lon.toFixed(4)}
                        {response.submitter_city && ` (${response.submitter_city})`}
                      </span>
                    </div>
                  )}

                  {/* Triage buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    {response.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleTriage(response.id, 'accepted')}
                          disabled={triaging === response.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTriage(response.id, 'rejected')}
                          disabled={triaging === response.id}
                          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {copSessionId && (
                      <Button size="sm" variant="outline" className="gap-1.5 ml-auto" disabled title="Coming soon">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Push to COP
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Settings Tab ────────────────────────────────────────────────

function SettingsTab({
  survey,
  onSaved,
}: {
  survey: SurveyDrop
  onSaved: (s: SurveyDrop) => void
}) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<IntakeFormStatus>(survey.status)
  const [accessLevel, setAccessLevel] = useState<IntakeAccessLevel>(survey.access_level)
  const [password, setPassword] = useState('')
  const [rateLimitPerHour, setRateLimitPerHour] = useState(survey.rate_limit_per_hour)
  const [customSlug, setCustomSlug] = useState(survey.custom_slug || '')
  const [expiresAt, setExpiresAt] = useState(survey.expires_at || '')
  const [themeColor, setThemeColor] = useState(survey.theme_color || '#3b82f6')
  const [successMessage, setSuccessMessage] = useState(survey.success_message || '')
  const [copSessionId, setCopSessionId] = useState(survey.cop_session_id || '')
  const [allowedCountries, setAllowedCountries] = useState<string[]>(survey.allowed_countries || [])
  const [countryInput, setCountryInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const body: Record<string, unknown> = {
        status,
        access_level: accessLevel,
        rate_limit_per_hour: rateLimitPerHour,
        custom_slug: customSlug || null,
        expires_at: expiresAt || null,
        theme_color: themeColor || null,
        success_message: successMessage || null,
        cop_session_id: copSessionId || null,
        allowed_countries: allowedCountries,
      }
      if (accessLevel === 'password' && password) {
        body.password = password
      }
      const res = await fetch(`/api/surveys/${survey.id}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `Failed to save (${res.status})`)
      }
      const updated = await res.json() as SurveyDrop
      onSaved(updated)
      setPassword('')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [
    survey.id,
    status,
    accessLevel,
    password,
    rateLimitPerHour,
    customSlug,
    expiresAt,
    themeColor,
    successMessage,
    copSessionId,
    allowedCountries,
    onSaved,
  ])

  const inputClass =
    'w-full px-3 py-2 text-base rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
  const sectionClass =
    'p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3'

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Status</h3>
        <div className="flex gap-4">
          {(['draft', 'active', 'closed'] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="text-blue-600"
              />
              <span className="capitalize">{s}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Access Control */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Access Control</h3>
        <div className="flex gap-4">
          {(['public', 'password', 'internal'] as const).map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="access_level"
                value={a}
                checked={accessLevel === a}
                onChange={() => setAccessLevel(a)}
                className="text-blue-600"
              />
              <span className="capitalize">{a}</span>
            </label>
          ))}
        </div>
        {accessLevel === 'password' && (
          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set or change password"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave blank to keep existing password.
            </p>
          </div>
        )}
      </div>

      {/* Country Restrictions */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Country Restrictions</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Only allow submissions from specific countries. Leave empty to allow all.
        </p>
        <div className="flex gap-2">
          <select
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            className={cn(inputClass, 'flex-1')}
          >
            <option value="">Select country to add...</option>
            {([
              ['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],
              ['DE','Germany'],['FR','France'],['UA','Ukraine'],['RU','Russia'],
              ['CN','China'],['IR','Iran'],['IQ','Iraq'],['SY','Syria'],
              ['IL','Israel'],['PS','Palestine'],['SA','Saudi Arabia'],['AE','UAE'],
              ['TR','Turkey'],['IN','India'],['PK','Pakistan'],['AF','Afghanistan'],
              ['KP','North Korea'],['KR','South Korea'],['JP','Japan'],['TW','Taiwan'],
              ['BR','Brazil'],['MX','Mexico'],['NG','Nigeria'],['ZA','South Africa'],
              ['EG','Egypt'],['KE','Kenya'],['PL','Poland'],['RO','Romania'],
              ['NL','Netherlands'],['SE','Sweden'],['NO','Norway'],['FI','Finland'],
              ['IT','Italy'],['ES','Spain'],['PT','Portugal'],['GR','Greece'],
              ['BY','Belarus'],['GE','Georgia'],['AM','Armenia'],['AZ','Azerbaijan'],
              ['KZ','Kazakhstan'],['UZ','Uzbekistan'],['LB','Lebanon'],['JO','Jordan'],
              ['YE','Yemen'],['LY','Libya'],['SD','Sudan'],['SO','Somalia'],
              ['ET','Ethiopia'],['PH','Philippines'],['ID','Indonesia'],['MY','Malaysia'],
            ] as [string,string][])
              .filter(([code]) => !allowedCountries.includes(code))
              .map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={!countryInput}
            onClick={() => {
              if (countryInput && !allowedCountries.includes(countryInput)) {
                setAllowedCountries(prev => [...prev, countryInput])
                setCountryInput('')
              }
            }}
          >
            Add
          </Button>
        </div>
        {allowedCountries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {allowedCountries.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              >
                {code}
                <button
                  type="button"
                  onClick={() => setAllowedCountries(prev => prev.filter(c => c !== code))}
                  className="hover:text-red-500 transition-colors"
                  aria-label={`Remove ${code}`}
                >
                  &times;
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setAllowedCountries([])}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors px-1"
            >
              Clear all
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">All countries allowed</p>
        )}
      </div>

      {/* Rate Limiting */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Rate Limiting</h3>
        <div>
          <label className={labelClass}>Max submissions per hour</label>
          <input
            type="number"
            min={0}
            value={rateLimitPerHour}
            onChange={(e) => setRateLimitPerHour(Number(e.target.value))}
            className={cn(inputClass, 'max-w-[200px]')}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            0 = unlimited
          </p>
        </div>
      </div>

      {/* Custom Slug */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Custom Slug</h3>
        <div>
          <label className={labelClass}>URL slug</label>
          <input
            type="text"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            placeholder="my-survey"
            className={inputClass}
          />
          {customSlug && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Preview: {window.location.origin}/drop/{customSlug}
            </p>
          )}
        </div>
      </div>

      {/* Expiry */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Expiry</h3>
        <div>
          <label className={labelClass}>Expires at</label>
          <input
            type="datetime-local"
            value={expiresAt ? expiresAt.slice(0, 16) : ''}
            onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className={cn(inputClass, 'max-w-[300px]')}
          />
        </div>
      </div>

      {/* Branding */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Branding</h3>
        <div>
          <label className={labelClass}>Theme color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-9 w-14 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{themeColor}</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>Success message</label>
          <textarea
            value={successMessage}
            onChange={(e) => setSuccessMessage(e.target.value)}
            placeholder="Thank you for your submission!"
            rows={2}
            className={inputClass}
          />
        </div>
      </div>

      {/* COP Link */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">COP Session Link</h3>
        <div>
          <label className={labelClass}>COP Session ID</label>
          <input
            type="text"
            value={copSessionId}
            onChange={(e) => setCopSessionId(e.target.value)}
            placeholder="cop-xxxx (leave blank for none)"
            className={inputClass}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {copSessionId
              ? `Linked to session: ${copSessionId}`
              : 'Not linked to any COP session'}
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saveSuccess && (
          <span className="text-sm text-green-600 dark:text-green-400">Saved</span>
        )}
        {saveError && (
          <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border-t border-red-200 dark:border-red-900/50 pt-6 mt-8 space-y-3">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Danger Zone</h3>
        {!confirmDelete ? (
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Drop
          </Button>
        ) : (
          <div className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10 space-y-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              This will permanently delete this drop and all its responses. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true)
                  try {
                    const res = await fetch(`/api/surveys/${survey.id}`, {
                      method: 'DELETE',
                      headers: getCopHeaders(),
                    })
                    if (!res.ok) throw new Error('Failed to delete')
                    navigate('/dashboard/drops')
                  } catch {
                    setSaveError('Failed to delete drop')
                    setDeleting(false)
                    setConfirmDelete(false)
                  }
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Analytics Tab ──────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-center">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

interface AnalyticsData {
  total: number
  by_country: Record<string, number>
  by_day: Record<string, number>
  by_status: Record<string, number>
  by_tag: Record<string, number>
  distributions: Record<string, Record<string, number>>
  fields: { name: string; label: string }[]
  enrichment?: {
    total_enriched: number
    urls: { url: string; title?: string; summary?: string; analysis_id?: string }[]
    content_sources: Record<string, number>
  }
  intelligence?: {
    analyzed_urls: number
    entities: { name: string; type: string; count: number }[]
    claims: { claim: string; confidence?: number }[]
    sentiment: Record<string, number>
    topics: Record<string, number>
  }
}

interface SummaryData {
  summary: string
  key_themes: string[]
  geographic_patterns: string[]
  contradictions: string[]
  source_assessment: string
  gaps: string[]
  recommended_actions: string[]
  timeline_summary: string
  responses_analyzed: number
  analyzed_at: string
}

function AnalyticsTab({ surveyId }: { surveyId: string }) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/surveys/${surveyId}/analytics`, {
      headers: getCopHeaders(),
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`Failed (${r.status})`)
        return r.json()
      })
      .then(data => { setAnalytics(data as AnalyticsData); setLoading(false) })
      .catch(err => { if (err.name !== 'AbortError') setLoading(false) })
    return () => controller.abort()
  }, [surveyId])

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Loading analytics...</p>
  }

  if (!analytics) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Unable to load analytics.</p>
  }

  const handleSummarize = async () => {
    setSummarizing(true)
    setSummaryError(null)
    try {
      const res = await fetch(`/api/surveys/${surveyId}/summarize`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ limit: 50 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || 'Summarization failed')
      }
      const data = await res.json()
      setSummary(data as SummaryData)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={analytics.total} />
        <StatCard label="Pending" value={analytics.by_status?.pending || 0} />
        <StatCard label="Accepted" value={analytics.by_status?.accepted || 0} />
        <StatCard label="Countries" value={Object.keys(analytics.by_country || {}).length} />
      </div>

      {/* Submissions by day */}
      {Object.keys(analytics.by_day || {}).length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Submissions by Day</h3>
          <div className="flex items-end gap-1 h-24">
            {Object.entries(analytics.by_day).reverse().map(([day, count]) => {
              const max = Math.max(...Object.values(analytics.by_day).map(Number))
              const pct = max > 0 ? (count / max) * 100 : 0
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${count}`}>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(pct, 4)}%` }} />
                  <span className="text-[8px] text-slate-400 -rotate-45 origin-top-left whitespace-nowrap">{day.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Field distributions */}
      {analytics.distributions && Object.entries(analytics.distributions).map(([fieldName, dist]) => {
        const field = analytics.fields?.find((f) => f.name === fieldName)
        const entries = Object.entries(dist).sort((a, b) => b[1] - a[1])
        const maxCount = entries[0]?.[1] || 1
        return (
          <div key={fieldName} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{field?.label || fieldName}</h3>
            <div className="space-y-2">
              {entries.map(([value, count]) => (
                <div key={value}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-slate-700 dark:text-slate-300">{value}</span>
                    <span className="text-slate-400 font-mono text-xs">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Country breakdown */}
      {Object.keys(analytics.by_country || {}).length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">By Country</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analytics.by_country).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
              <span key={code} className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {code} <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Auto-tags */}
      {analytics.by_tag && Object.keys(analytics.by_tag).length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Topics Detected</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analytics.by_tag as Record<string, number>)
              .sort((a, b) => b[1] - a[1])
              .map(([tag, count]) => (
                <span key={tag} className="text-sm px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {tag} <span className="font-bold">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Enriched URLs / Content Analysis */}
      {analytics.enrichment && analytics.enrichment.urls.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Analyzed Content ({analytics.enrichment.total_enriched})
          </h3>
          {Object.keys(analytics.enrichment.content_sources).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(analytics.enrichment.content_sources).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                <span key={src} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                  {src} <span className="font-bold">{count}</span>
                </span>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {analytics.enrichment.urls.map((u, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 shrink-0 mt-0.5">&#8226;</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs"
                  >
                    {u.title || u.url}
                  </a>
                  {u.summary && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{u.summary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Entities */}
      {analytics.intelligence && analytics.intelligence.entities.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Extracted Entities ({analytics.intelligence.entities.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {analytics.intelligence.entities.map((e, i) => {
              const typeColors: Record<string, string> = {
                PERSON: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                ORGANIZATION: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                ORG: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                LOCATION: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                GPE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                EVENT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                WEAPON: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                MILITARY: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                DATE: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                NORP: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
              }
              const color = typeColors[e.type.toUpperCase()] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              return (
                <span key={i} className={`text-xs px-2 py-1 rounded-full ${color}`}>
                  {e.name}
                  <span className="opacity-60 ml-1 text-[10px]">{e.type}{e.count > 1 ? ` ×${e.count}` : ''}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Extracted Claims */}
      {analytics.intelligence && analytics.intelligence.claims.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Claims Extracted ({analytics.intelligence.claims.length})
          </h3>
          <ul className="space-y-2">
            {analytics.intelligence.claims.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-slate-400 shrink-0 mt-0.5">&#8226;</span>
                <div className="flex-1">
                  <span className="text-slate-800 dark:text-slate-200">{c.claim}</span>
                  {c.confidence != null && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      c.confidence >= 70 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : c.confidence >= 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {c.confidence}%
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sentiment & Topics from content analysis */}
      {analytics.intelligence && (Object.keys(analytics.intelligence.sentiment).length > 0 || Object.keys(analytics.intelligence.topics).length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.keys(analytics.intelligence.sentiment).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Source Sentiment</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(analytics.intelligence.sentiment).sort((a, b) => b[1] - a[1]).map(([label, count]) => {
                  const sentColors: Record<string, string> = {
                    positive: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    negative: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                    mixed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                  }
                  return (
                    <span key={label} className={`text-xs px-2.5 py-1 rounded-full ${sentColors[label.toLowerCase()] || sentColors.neutral}`}>
                      {label} <span className="font-bold">{count}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
          {Object.keys(analytics.intelligence.topics).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Content Topics</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(analytics.intelligence.topics).sort((a, b) => b[1] - a[1]).map(([topic, count]) => (
                  <span key={topic} className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                    {topic} <span className="font-bold">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Export Data</h3>
        <p className="text-xs text-slate-400">Download responses with enrichment data for analyst tools.</p>
        <div className="flex flex-wrap gap-2">
          {[
            { format: 'csv', label: 'CSV', desc: 'Excel, Google Sheets' },
            { format: 'json', label: 'JSON', desc: 'Programmatic use' },
            { format: 'stix', label: 'STIX 2.1', desc: 'OpenCTI, MISP, Maltego' },
          ].map(({ format, label, desc }) => (
            <a
              key={format}
              href={`/api/surveys/${surveyId}/export?format=${format}`}
              download
              onClick={(e) => {
                e.preventDefault()
                fetch(`/api/surveys/${surveyId}/export?format=${format}`, { headers: getCopHeaders() })
                  .then(r => {
                    if (!r.ok) throw new Error(`Export failed (${r.status})`)
                    return r.blob()
                  })
                  .then(blob => {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `drop-export.${format === 'stix' ? 'stix.json' : format}`
                    a.click()
                    URL.revokeObjectURL(url)
                  })
                  .catch(err => alert(err.message || 'Export failed'))
              }}
              className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer min-w-[100px]"
            >
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</span>
              <span className="text-[10px] text-slate-400">{desc}</span>
            </a>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Analysis</h3>
          <button
            type="button"
            onClick={handleSummarize}
            disabled={summarizing || (analytics.total || 0) === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[36px]"
          >
            {summarizing ? 'Analyzing...' : summary ? 'Refresh Analysis' : 'Generate Analysis'}
          </button>
        </div>

        {summaryError && <p className="text-xs text-red-500">{summaryError}</p>}

        {summary && (
          <div className="space-y-4">
            {/* Summary */}
            <div>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{summary.summary}</p>
              <p className="text-[10px] text-slate-400 mt-1">{summary.responses_analyzed} responses analyzed · {new Date(summary.analyzed_at).toLocaleString()}</p>
            </div>

            {/* Key themes */}
            {summary.key_themes?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1">Key Themes</h4>
                <div className="flex flex-wrap gap-1.5">
                  {summary.key_themes.map((t: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Geographic patterns */}
            {summary.geographic_patterns?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1">Geographic Patterns</h4>
                <ul className="space-y-1">
                  {summary.geographic_patterns.map((p: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300">· {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contradictions */}
            {summary.contradictions?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Contradictions</h4>
                <ul className="space-y-1">
                  {summary.contradictions.map((c: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300">· {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gaps */}
            {summary.gaps?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1">Information Gaps</h4>
                <ul className="space-y-1">
                  {summary.gaps.map((g: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300">· {g}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended actions */}
            {summary.recommended_actions?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Recommended Actions</h4>
                <ul className="space-y-1">
                  {summary.recommended_actions.map((a: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300">· {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source assessment */}
            {summary.source_assessment && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1">Source Assessment</h4>
                <p className="text-sm text-slate-700 dark:text-slate-300">{summary.source_assessment}</p>
              </div>
            )}

            {/* Timeline */}
            {summary.timeline_summary && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1">Timeline</h4>
                <p className="text-sm text-slate-700 dark:text-slate-300">{summary.timeline_summary}</p>
              </div>
            )}
          </div>
        )}

        {!summary && !summarizing && (
          <p className="text-xs text-slate-400">Click "Generate Analysis" to get an AI-powered summary of all responses.</p>
        )}
      </div>
    </div>
  )
}
