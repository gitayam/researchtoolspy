/**
 * NewWorkspacePage — Unified workspace creation wizard
 *
 * Single full-page wizard that creates BOTH an investigation record
 * and a fully-configured COP session in one shot.
 *
 * Standard flow (5 steps): Purpose → Details → Location → Time Window → Questions
 * Event Analysis flow (6 steps): Purpose → Details → Event Details → Location → Time Window → Questions
 */

import { useState, useCallback, useMemo } from 'react'
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

const PROGRESS_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
]

// ── Component ────────────────────────────────────────────────────

export default function NewWorkspacePage() {
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Purpose
  const [workspaceType, setWorkspaceType] = useState<UnifiedWorkspaceType | null>(null)

  // Step 2: Details
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Event details (event_analysis only)
  const [eventType, setEventType] = useState<CopEventType | ''>('')
  const [eventDescription, setEventDescription] = useState('')
  const [initialUrls, setInitialUrls] = useState('')

  // Step 3: Location
  const [locationSearch, setLocationSearch] = useState('')

  // Step 4: Time window
  const [selectedTimeHours, setSelectedTimeHours] = useState<number | null | undefined>(undefined)

  // Step 5: Questions
  const [questions, setQuestions] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState('')

  // ── Derived state ──────────────────────────────────────────────

  const selectedDef = useMemo(
    () => WORKSPACE_TYPES.find(t => t.id === workspaceType) ?? null,
    [workspaceType]
  )

  const isEventAnalysis = workspaceType === 'event_analysis'

  const stepLabels = useMemo(() => {
    if (isEventAnalysis) {
      return ['Purpose', 'Details', 'Event Details', 'Location', 'Time Window', 'Key Questions']
    }
    return ['Purpose', 'Details', 'Location', 'Time Window', 'Key Questions']
  }, [isEventAnalysis])

  const stepIcons = useMemo(() => {
    if (isEventAnalysis) {
      return [Target, FileText, Search, MapPin, Clock, HelpCircle]
    }
    return [Target, FileText, MapPin, Clock, HelpCircle]
  }, [isEventAnalysis])

  const totalSteps = stepLabels.length
  const lastStep = totalSteps - 1

  // ── Navigation ─────────────────────────────────────────────────

  const canProceed = useCallback((): boolean => {
    if (isEventAnalysis) {
      switch (step) {
        case 0: return workspaceType !== null
        case 1: return title.trim().length > 0
        case 2: return eventType !== ''
        case 3: return true // location optional
        case 4: return selectedTimeHours !== undefined
        case 5: return true
        default: return false
      }
    }
    switch (step) {
      case 0: return workspaceType !== null
      case 1: return title.trim().length > 0
      case 2: return true // location optional
      case 3: return selectedTimeHours !== undefined
      case 4: return true
      default: return false
    }
  }, [step, workspaceType, title, isEventAnalysis, eventType, selectedTimeHours])

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

  // ── Tag management ─────────────────────────────────────────────

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
      setTagInput('')
    }
  }, [tagInput, tags])

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

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
        tags,
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
  }, [selectedDef, title, description, tags, locationSearch, selectedTimeHours, questions, navigate, isEventAnalysis, eventType, eventDescription, initialUrls])

  // ── Progress bar ───────────────────────────────────────────────

  function renderProgressBar() {
    return (
      <div className="mb-6">
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
        <div className="flex justify-between">
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
                <span className="hidden sm:inline">{label}</span>
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
            Select a workspace type to pre-configure your investigation and operating picture.
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
                onClick={() => setWorkspaceType(wt.id)}
                className={`text-left rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 shadow-md'
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

  // ── Step 1: Details (title, description, tags) ─────────────────

  function renderDetailsStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Workspace details</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Give your workspace a title and optional description.
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
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ws-title">
            Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="ws-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Iran Nuclear Program Analysis"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ws-description">
            Description
          </label>
          <Textarea
            id="ws-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this workspace about?"
            rows={3}
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tags</label>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="Add a tag..."
              className="flex-1"
            />
            <Button onClick={addTag} variant="outline" size="sm" disabled={!tagInput.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeTag(tag)}
                >
                  {tag} <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Event Details step (event_analysis only) ───────────────────

  function renderEventDetailsStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Describe the event</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Classify and describe the event you are analyzing.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="event-type">
            Event Type
          </label>
          <select
            id="event-type"
            value={eventType}
            onChange={e => setEventType(e.target.value as CopEventType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select event type...</option>
            {EVENT_TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="event-desc">
            Event Description
          </label>
          <Textarea
            id="event-desc"
            value={eventDescription}
            onChange={e => setEventDescription(e.target.value)}
            placeholder="2-3 sentences describing the event..."
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="initial-urls">
            Initial URLs{' '}
            <span className="text-muted-foreground font-normal">(optional, one per line, up to 5)</span>
          </label>
          <Textarea
            id="initial-urls"
            value={initialUrls}
            onChange={e => setInitialUrls(e.target.value)}
            placeholder={'https://example.com/article\nhttps://example.com/report'}
            rows={3}
            className="font-mono"
          />
        </div>
      </div>
    )
  }

  // ── Location step ──────────────────────────────────────────────

  function renderLocationStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Where is the area of interest?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enter a location name or coordinates to center your operating picture. Optional for research types.
          </p>
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={locationSearch}
            onChange={e => setLocationSearch(e.target.value)}
            placeholder="e.g., Iran, Donbas, 33.88,-35.51..."
            className="w-full rounded-md border border-input bg-background px-10 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          You can refine the area on the map after creation.
        </p>
      </div>
    )
  }

  // ── Time Window step ───────────────────────────────────────────

  function renderTimeWindowStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">How far back should data go?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a rolling time window for your intelligence picture.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TIME_OPTIONS.map(opt => {
            const isSelected =
              selectedTimeHours === opt.hours ||
              (selectedTimeHours === null && opt.hours === null)
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedTimeHours(opt.hours)}
                className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                    : 'border-border hover:border-blue-300 text-foreground'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Key Questions step ─────────────────────────────────────────

  function renderQuestionsStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">What do you need to know?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define the key intelligence questions this workspace should answer. You can add more later.
          </p>
        </div>

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
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {questions.length > 0 && (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border bg-muted/50 px-3 py-2.5"
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
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No questions added yet. Questions help focus your intelligence collection.
          </div>
        )}
      </div>
    )
  }

  // ── Render current step ────────────────────────────────────────

  function renderStep() {
    if (isEventAnalysis) {
      switch (step) {
        case 0: return renderPurposeStep()
        case 1: return renderDetailsStep()
        case 2: return renderEventDetailsStep()
        case 3: return renderLocationStep()
        case 4: return renderTimeWindowStep()
        case 5: return renderQuestionsStep()
        default: return null
      }
    }
    switch (step) {
      case 0: return renderPurposeStep()
      case 1: return renderDetailsStep()
      case 2: return renderLocationStep()
      case 3: return renderTimeWindowStep()
      case 4: return renderQuestionsStep()
      default: return null
    }
  }

  // ── Main render ────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-2xl">
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
      <div className="rounded-lg border bg-card p-6 space-y-6">
        {renderProgressBar()}
        {renderStep()}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            {step > 0 ? (
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/dashboard')} disabled={submitting}>
                Cancel
              </Button>
            )}
          </div>

          <div>
            {step < lastStep ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={submitting || !canProceed()}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Workspace
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
