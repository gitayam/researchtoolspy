import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap,
  Radio,
  BookOpen,
  AlertTriangle,
  Settings,
  Search,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  Trash2,
  Loader2,
  MapPin,
  Clock,
  HelpCircle,
  Target,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getLayersForTemplate } from '@/components/cop/CopLayerCatalog'
import type { CopTemplateType, CopEventType } from '@/types/cop'
import { EVENT_TYPE_LABELS } from '@/types/cop'

// ── Template definitions ──────────────────────────────────────────

interface TemplateOption {
  type: CopTemplateType
  icon: typeof Zap
  label: string
  description: string
  timeHint: string
}

const TEMPLATES: TemplateOption[] = [
  {
    type: 'quick_brief',
    icon: Zap,
    label: 'Quick Brief',
    description: 'Answer 1-3 questions about an area',
    timeHint: '1h snapshot',
  },
  {
    type: 'event_monitor',
    icon: Radio,
    label: 'Event Monitor',
    description: 'Track a developing situation',
    timeHint: '48h rolling',
  },
  {
    type: 'area_study',
    icon: BookOpen,
    label: 'Area Study',
    description: 'Deep analytical picture',
    timeHint: 'All time',
  },
  {
    type: 'crisis_response',
    icon: AlertTriangle,
    label: 'Crisis Response',
    description: 'Full operational picture',
    timeHint: 'Ongoing',
  },
  {
    type: 'event_analysis',
    icon: Search,
    label: 'Event Analysis',
    description: 'Analyze an event with full intel toolkit',
    timeHint: 'Event-driven',
  },
  {
    type: 'custom',
    icon: Settings,
    label: 'Custom',
    description: 'Configure everything yourself',
    timeHint: 'Your choice',
  },
]

// ── Time window options ───────────────────────────────────────────

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

// ── Event type options (for dropdown) ─────────────────────────────

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS) as [CopEventType, string][]

// ── Parse location for lat/lon ─────────────────────────────────────

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

// ── Template label helper ─────────────────────────────────────────

function getTemplateLabel(type: CopTemplateType): string {
  return TEMPLATES.find(t => t.type === type)?.label ?? 'COP'
}

// ── Props ─────────────────────────────────────────────────────────

interface CopWizardProps {
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────

export default function CopWizard({ onClose }: CopWizardProps) {
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wizard state
  const [selectedTemplate, setSelectedTemplate] = useState<CopTemplateType | null>(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [selectedTimeHours, setSelectedTimeHours] = useState<number | null | undefined>(undefined) // undefined = not yet chosen
  const [questions, setQuestions] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState('')

  // Event analysis state
  const [eventType, setEventType] = useState<CopEventType | ''>('')
  const [eventDescription, setEventDescription] = useState('')
  const [initialUrls, setInitialUrls] = useState('')

  // ── Dynamic step labels/icons based on template ─────────────────

  const isEventAnalysis = selectedTemplate === 'event_analysis'

  const stepLabels = useMemo(() => {
    if (isEventAnalysis) {
      return ['Purpose', 'Event Details', 'Location', 'Time Window', 'Key Questions']
    }
    return ['Purpose', 'Location', 'Time Window', 'Key Questions']
  }, [isEventAnalysis])

  const stepIcons = useMemo(() => {
    if (isEventAnalysis) {
      return [Target, Search, MapPin, Clock, HelpCircle]
    }
    return [Target, MapPin, Clock, HelpCircle]
  }, [isEventAnalysis])

  const totalSteps = stepLabels.length
  const lastStep = totalSteps - 1

  const PROGRESS_COLORS = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-violet-500',
    'bg-rose-500',
  ]

  // ── Navigation helpers ────────────────────────────────────────

  const canProceed = useCallback((): boolean => {
    if (isEventAnalysis) {
      switch (step) {
        case 0: return selectedTemplate !== null
        case 1: return eventType !== ''
        case 2: return locationSearch.trim().length > 0
        case 3: return selectedTimeHours !== undefined
        case 4: return true
        default: return false
      }
    }
    switch (step) {
      case 0: return selectedTemplate !== null
      case 1: return locationSearch.trim().length > 0
      case 2: return selectedTimeHours !== undefined
      case 3: return true
      default: return false
    }
  }, [step, selectedTemplate, locationSearch, selectedTimeHours, isEventAnalysis, eventType])

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

  // ── Question management ───────────────────────────────────────

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

  // ── Submit ────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!selectedTemplate) return

    setSubmitting(true)
    setError(null)

    try {
      const coords = parseLocationCoords(locationSearch)
      const activeLayers = getLayersForTemplate(selectedTemplate).map(l => l.id)

      const rollingHours =
        selectedTimeHours === null ? null : selectedTimeHours ?? 24

      const body: Record<string, unknown> = {
        name: `${getTemplateLabel(selectedTemplate)} - ${locationSearch.trim()}`,
        description: `${getTemplateLabel(selectedTemplate)} for ${locationSearch.trim()}`,
        template_type: selectedTemplate,
        center_lat: coords?.lat ?? null,
        center_lon: coords?.lon ?? null,
        zoom: coords ? 10 : 5,
        rolling_hours: rollingHours,
        active_layers: activeLayers,
        key_questions: questions,
      }

      // Include event analysis fields when applicable
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

      const res = await fetch('/api/cop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Server responded with ${res.status}`)
      }

      const data = await res.json()
      const sessionId = data.id ?? data.session?.id

      if (!sessionId) {
        throw new Error('No session ID returned from server')
      }

      navigate(`/dashboard/cop/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create COP session')
    } finally {
      setSubmitting(false)
    }
  }, [selectedTemplate, locationSearch, selectedTimeHours, questions, navigate, isEventAnalysis, eventType, eventDescription, initialUrls])

  // ── Progress bar ──────────────────────────────────────────────

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

  // ── Step 0: Purpose ───────────────────────────────────────────

  function renderPurposeStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">What are you building?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select a template to pre-configure layers and time windows.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map(t => {
            const Icon = t.icon
            const isSelected = selectedTemplate === t.type
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setSelectedTemplate(t.type)}
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
                    <div className="font-medium">{t.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{t.description}</div>
                    <div className="text-xs text-muted-foreground mt-1.5 font-mono">
                      {t.timeHint}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
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

        {/* Event Type dropdown */}
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

        {/* Event Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="event-description">
            Event Description
          </label>
          <textarea
            id="event-description"
            value={eventDescription}
            onChange={e => setEventDescription(e.target.value)}
            placeholder="2-3 sentences describing the event..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>

        {/* Initial URLs */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="initial-urls">
            Initial URLs <span className="text-muted-foreground font-normal">(optional, one per line, up to 5)</span>
          </label>
          <textarea
            id="initial-urls"
            value={initialUrls}
            onChange={e => setInitialUrls(e.target.value)}
            placeholder="https://example.com/article&#10;https://example.com/report"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
      </div>
    )
  }

  // ── Step: Location ──────────────────────────────────────────

  function renderLocationStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Where is the area of interest?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enter a location name or coordinates to center your COP.
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

  // ── Step: Time Window ───────────────────────────────────────

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

  // ── Step: Key Questions ─────────────────────────────────────

  function renderQuestionsStep() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">What do you need to know?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define the key intelligence questions this COP should answer. You can add more later.
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
          <Button
            onClick={addQuestion}
            disabled={!newQuestion.trim()}
            size="sm"
            className="shrink-0"
          >
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

  // ── Render current step ───────────────────────────────────────

  function renderStep() {
    if (isEventAnalysis) {
      switch (step) {
        case 0: return renderPurposeStep()
        case 1: return renderEventDetailsStep()
        case 2: return renderLocationStep()
        case 3: return renderTimeWindowStep()
        case 4: return renderQuestionsStep()
        default: return null
      }
    }
    switch (step) {
      case 0: return renderPurposeStep()
      case 1: return renderLocationStep()
      case 2: return renderTimeWindowStep()
      case 3: return renderQuestionsStep()
      default: return null
    }
  }

  // ── Main render ───────────────────────────────────────────────

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Create Common Operating Picture</CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderProgressBar()}
        {renderStep()}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
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
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create COP'
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
