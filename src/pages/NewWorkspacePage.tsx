/**
 * NewWorkspacePage — Unified workspace creation wizard
 *
 * Single full-page wizard that creates BOTH an investigation record
 * and a fully-configured COP session in one shot.
 *
 * Streamlined 3-step flow: Purpose → Essentials → Enhance (optional)
 * Event Analysis adds inline event fields to the Essentials step.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Zap,
  Folder,
  Radio,
  AlertTriangle,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  MapPin,
  Clock,
  HelpCircle,
  Target,
  FileText,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { getLayersForTemplate } from '@/components/cop/CopLayerCatalog'
import { WORKSPACE_TYPES } from '@/types/workspace'
import type { UnifiedWorkspaceType, WorkspaceTypeDefinition } from '@/types/workspace'
import type { CopEventType } from '@/types/cop'
import { EVENT_TYPE_LABELS } from '@/types/cop'
import { getCopHeaders } from '@/lib/cop-auth'
import { isUserAuthenticated } from '@/lib/auth-utils'

// ── Icon mapping ─────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Zap> = {
  BookOpen,
  Zap,
  Folder,
  Radio,
  AlertTriangle,
  Search,
}

function getIconForType(def: WorkspaceTypeDefinition) {
  return ICON_MAP[def.icon] ?? FileText
}

// ── Smart time defaults per workspace type ───────────────────────

const DEFAULT_TIME_HOURS: Record<UnifiedWorkspaceType, number | null> = {
  deep_research: 24,
  quick_analysis: 1,
  topic_exploration: 24,
  event_monitor: 48,
  crisis_response: null, // ongoing
  event_analysis: 24,
}

// ── Time window options ──────────────────────────────────────────

interface TimeOption {
  label: string
  hours: number | null // null = ongoing
}

const TIME_OPTIONS: TimeOption[] = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7d', hours: 168 },
  { label: 'Ongoing', hours: null },
]

// ── Event type dropdown options ──────────────────────────────────

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS) as [CopEventType, string][]

// ── Parse location for lat/lon ───────────────────────────────────

function parseLocationCoords(search: string): { lat: number; lon: number } | null {
  const coordMatch = search.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1])
    const lon = parseFloat(coordMatch[2])
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon }
    }
  }
  return null
}

// ── Progress bar colors ──────────────────────────────────────────

const PROGRESS_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500']

// ── Component ────────────────────────────────────────────────────

export default function NewWorkspacePage() {
  const navigate = useNavigate()
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Redirect to login immediately if not authenticated
  useEffect(() => {
    if (!isUserAuthenticated()) {
      navigate('/login?redirect=/dashboard/workspace/new', { replace: true })
    }
  }, [navigate])

  // 3 steps: Purpose (0) → Essentials (1) → Enhance (2)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 0: Purpose
  const [workspaceType, setWorkspaceType] = useState<UnifiedWorkspaceType | null>(null)

  // Step 1: Essentials (title + description + time window + event fields)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTimeHours, setSelectedTimeHours] = useState<number | null | undefined>(undefined)

  // Event details (event_analysis only — inline in Step 1)
  const [eventType, setEventType] = useState<CopEventType | ''>('')
  const [eventDescription, setEventDescription] = useState('')
  const [initialUrls, setInitialUrls] = useState('')

  // Step 2: Enhance (optional — location + questions)
  const [locationSearch, setLocationSearch] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [showLocation, setShowLocation] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)

  // ── Derived state ──────────────────────────────────────────────

  const selectedDef = useMemo(
    () => WORKSPACE_TYPES.find(t => t.id === workspaceType) ?? null,
    [workspaceType]
  )

  const isEventAnalysis = workspaceType === 'event_analysis'

  const stepLabels = ['Purpose', 'Essentials', 'Enhance']
  const stepIcons = [Target, FileText, Sparkles]
  const totalSteps = 3
  const lastStep = 2

  // ── Smart defaults on type selection ────────────────────────────

  const handleTypeSelect = useCallback((typeId: UnifiedWorkspaceType) => {
    setWorkspaceType(typeId)
    // Set smart time default
    setSelectedTimeHours(DEFAULT_TIME_HOURS[typeId])
    // Auto-advance after brief visual feedback
    setTimeout(() => {
      setStep(1)
      // Focus title input after transition
      setTimeout(() => titleInputRef.current?.focus(), 100)
    }, 150)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 0: return workspaceType !== null
      case 1: return title.trim().length > 0 && selectedTimeHours !== undefined && (!isEventAnalysis || eventType !== '')
      case 2: return true // always can create
      default: return false
    }
  }, [step, workspaceType, title, selectedTimeHours, isEventAnalysis, eventType])

  const handleNext = useCallback(() => {
    if (canProceed() && step < lastStep) {
      setStep(s => s + 1)
      setError(null)
    }
  }, [canProceed, step, lastStep])

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep(s => s - 1)
      setError(null)
    }
  }, [step])

  // ── Keyboard navigation ────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in a textarea
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return

      if (e.key === 'Escape' && step > 0) {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step, handleBack])

  // ── Question management ────────────────────────────────────────

  const addQuestion = useCallback(() => {
    const trimmed = newQuestion.trim()
    if (trimmed && !questions.includes(trimmed)) {
      setQuestions(prev => [...prev, trimmed])
      setNewQuestion('')
    }
  }, [newQuestion, questions])

  const removeQuestion = useCallback((index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleQuestionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addQuestion()
      }
    },
    [addQuestion]
  )

  // ── Submit ─────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!selectedDef || !title.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const coords = parseLocationCoords(locationSearch)
      const activeLayers = getLayersForTemplate(selectedDef.copTemplate).map(l => l.id)
      const rollingHours =
        selectedTimeHours === null ? null : selectedTimeHours ?? 24

      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        investigation_type: selectedDef.investigationType,
        tags: [],
        cop_template: selectedDef.copTemplate,
        center_lat: coords?.lat ?? null,
        center_lon: coords?.lon ?? null,
        zoom: coords ? 10 : 5,
        rolling_hours: rollingHours,
        active_layers: activeLayers,
        key_questions: questions,
      }

      // Event analysis fields
      if (isEventAnalysis && eventType) {
        body.event_type = eventType
        body.event_description = eventDescription || null
        const urls = initialUrls
          .split('\n')
          .map(u => u.trim())
          .filter(u => u.length > 0)
        if (urls.length > 0) {
          body.initial_urls = urls
        }
      }

      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login?redirect=/dashboard/workspace/new', { replace: true })
          return
        }
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Server responded with ${res.status}`)
      }

      const data = await res.json()
      const copId = data.cop_session_id

      if (!copId) {
        throw new Error('No COP session ID returned from server')
      }

      navigate(`/dashboard/cop/${copId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    } finally {
      setSubmitting(false)
    }
  }, [selectedDef, title, description, locationSearch, selectedTimeHours, questions, navigate, isEventAnalysis, eventType, eventDescription, initialUrls])

  // ── Progress bar ───────────────────────────────────────────────

  function renderProgressBar() {
    return (
      <div className="mb-6">
        {/* Mobile: step counter */}
        <div className="flex items-center justify-between mb-3 sm:hidden">
          <span className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </span>
          <Badge variant="outline" className="text-xs">{stepLabels[step]}</Badge>
        </div>
        <div className="flex gap-1.5 mb-3">
          {stepLabels.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? PROGRESS_COLORS[i] : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <div className="hidden sm:flex justify-between">
          {stepLabels.map((label, i) => {
            const Icon = stepIcons[i]
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  i <= step ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Step 0: Purpose (workspace type selection) ─────────────────

  function renderPurposeStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">What are you building?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a type to get started — click to continue.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKSPACE_TYPES.map(wt => {
            const Icon = getIconForType(wt)
            const isSelected = workspaceType === wt.id
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() => handleTypeSelect(wt.id)}
                className={`text-left rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 shadow-md scale-[1.02]'
                    : 'border-border hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      isSelected ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{wt.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{wt.description}</div>
                    <div className="text-xs text-muted-foreground mt-1.5 font-mono">{wt.timeHint}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Step 1: Essentials (title + time window + event fields) ────

  function renderEssentialsStep() {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold">Workspace essentials</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Name your workspace and set the time window.
          </p>
        </div>

        {/* Selected type badge */}
        {selectedDef && (
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = getIconForType(selectedDef)
              return <Icon className="h-4 w-4 text-blue-600" />
            })()}
            <Badge variant="secondary">{selectedDef.label}</Badge>
            <button
              onClick={() => { setStep(0); setWorkspaceType(null) }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Change
            </button>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ws-title">
            Title <span className="text-destructive">*</span>
          </label>
          <Input
            ref={titleInputRef}
            id="ws-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && title.trim()) {
                e.preventDefault()
                // Focus next visible input or advance
                const descEl = document.getElementById('ws-description')
                if (descEl) descEl.focus()
              }
            }}
            placeholder="e.g., Iran Nuclear Program Analysis"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ws-description">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Textarea
            id="ws-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this workspace about?"
            rows={2}
          />
        </div>

        {/* Event details — inline when event_analysis */}
        {isEventAnalysis && (
          <div className="space-y-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Search className="h-4 w-4" />
              Event Details
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="event-type">
                Event Type <span className="text-destructive">*</span>
              </label>
              <select
                id="event-type"
                value={eventType}
                onChange={e => setEventType(e.target.value as CopEventType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select event type...</option>
                {EVENT_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="event-desc">
                Event Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                id="event-desc"
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                placeholder="2-3 sentences describing the event..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="initial-urls">
                Source URLs <span className="text-muted-foreground font-normal">(optional, one per line)</span>
              </label>
              <Textarea
                id="initial-urls"
                value={initialUrls}
                onChange={e => setInitialUrls(e.target.value)}
                placeholder={'https://example.com/article\nhttps://example.com/report'}
                rows={2}
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* Time window */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Time Window
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {TIME_OPTIONS.map(opt => {
              const isSelected =
                selectedTimeHours === opt.hours ||
                (selectedTimeHours === null && opt.hours === null)
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSelectedTimeHours(opt.hours)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                      : 'border-border hover:border-blue-300 text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {selectedDef && selectedTimeHours !== undefined && (
            <p className="text-xs text-muted-foreground">
              {selectedTimeHours === null ? 'No time limit — all data included.' : `Shows data from the last ${selectedTimeHours}h. You can change this later.`}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Step 2: Enhance (optional location + questions) ────────────

  function renderEnhanceStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Enhance your workspace</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add location and questions now, or skip and set them up later in the dashboard.
          </p>
        </div>

        {/* Location — collapsible */}
        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setShowLocation(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Area of Interest
              {locationSearch && <Badge variant="secondary" className="text-xs ml-1">{locationSearch}</Badge>}
              {!locationSearch && <span className="text-muted-foreground font-normal">(optional)</span>}
            </span>
            {showLocation ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showLocation && (
            <div className="px-4 pb-4 space-y-2">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={e => setLocationSearch(e.target.value)}
                  placeholder="e.g., Iran, Donbas, 33.88,-35.51..."
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You can refine the area on the map after creation.
              </p>
            </div>
          )}
        </div>

        {/* Questions — collapsible */}
        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setShowQuestions(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Key Questions
              {questions.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{questions.length}</Badge>}
              {questions.length === 0 && <span className="text-muted-foreground font-normal">(optional)</span>}
            </span>
            {showQuestions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showQuestions && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  onKeyDown={handleQuestionKeyDown}
                  placeholder="Enter an intelligence question..."
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  autoFocus
                />
                <Button onClick={addQuestion} disabled={!newQuestion.trim()} size="sm" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {questions.length > 0 && (
                <div className="space-y-1.5">
                  {questions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-md border bg-muted/50 px-3 py-2"
                    >
                      <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-sm flex-1">{q}</span>
                      <button
                        type="button"
                        onClick={() => removeQuestion(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Remove question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {questions.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">
                  Questions help focus intelligence collection. You can always add them later.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary of what will be created */}
        {selectedDef && (
          <div className="rounded-lg bg-muted/50 border border-dashed p-4 space-y-1.5">
            <div className="text-sm font-medium">Ready to create:</div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div className="flex items-center gap-2">
                {(() => { const Icon = getIconForType(selectedDef); return <Icon className="h-3.5 w-3.5" /> })()}
                <span className="font-medium text-foreground">{title || 'Untitled'}</span>
                <Badge variant="outline" className="text-xs">{selectedDef.label}</Badge>
              </div>
              <div className="text-xs">
                {selectedTimeHours === null ? 'Ongoing' : `${selectedTimeHours}h window`}
                {locationSearch && ` · ${locationSearch}`}
                {questions.length > 0 && ` · ${questions.length} question${questions.length > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render current step ────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0: return renderPurposeStep()
      case 1: return renderEssentialsStep()
      case 2: return renderEnhanceStep()
      default: return null
    }
  }

  // ── Main render ────────────────────────────────────────────────

  return (
    <div className="mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? navigate('/dashboard') : handleBack())}
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 0 ? 'Back to Dashboard' : 'Back'}
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold">Create Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up an investigation with a fully-configured operating picture.
        </p>
      </div>

      {/* Progress + Step content */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-6">
        {renderProgressBar()}
        {renderStep()}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between pt-2 border-t">
          <div>
            {step > 0 ? (
              <Button variant="outline" onClick={handleBack} disabled={submitting} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/dashboard')} disabled={submitting} className="w-full sm:w-auto">
                Cancel
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {step === 1 && (
              <Button variant="outline" onClick={handleCreate} disabled={submitting || !canProceed()} className="flex-1 sm:flex-none">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-1.5" /> Create Now</>
                )}
              </Button>
            )}
            {step < lastStep ? (
              <Button onClick={handleNext} disabled={!canProceed()} className="flex-1 sm:flex-none">
                {step === 1 ? 'Add Details' : 'Next'}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={submitting || !canProceed()} className="flex-1 sm:flex-none">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-1.5" /> Create Workspace</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
