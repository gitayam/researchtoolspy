/**
 * EntityCreateForm -- Polymorphic inline creation form for COP entities.
 *
 * Renders different field sets based on entityType. Used inside the entity
 * drawer panel for quick creation of actors, events, places, sources, and
 * behaviors without leaving the COP workspace.
 */

import { useState, useCallback, useEffect } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import type {
  ActorType,
  EventType,
  EventSignificance,
  EventConfidence,
  PlaceType,
  StrategicImportance,
  SourceType,
  BehaviorType,
  BehaviorFrequency,
  BehaviorSophistication,
} from '@/types/entities'

// ── Props ────────────────────────────────────────────────────────

export interface EntityCreateFormProps {
  entityType: 'actors' | 'events' | 'places' | 'sources' | 'behaviors'
  sessionId: string
  onCreated: (entity: any) => void
  onCancel: () => void
  prefill?: Record<string, any>
}

// ── Helpers ──────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

const INPUT_CLS =
  'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-200 rounded px-2.5 py-1.5 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500'

const LABEL_CLS = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'

// ── Select option constants ──────────────────────────────────────

const ACTOR_TYPES: ActorType[] = ['PERSON', 'ORGANIZATION', 'UNIT', 'GOVERNMENT', 'GROUP', 'OTHER']

const EVENT_TYPES: EventType[] = ['OPERATION', 'INCIDENT', 'MEETING', 'ACTIVITY', 'OTHER']
const SIGNIFICANCE_LEVELS: EventSignificance[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const CONFIDENCE_LEVELS: EventConfidence[] = ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'DOUBTFUL']

const PLACE_TYPES: PlaceType[] = ['FACILITY', 'CITY', 'REGION', 'COUNTRY', 'INSTALLATION', 'OTHER']
const STRATEGIC_IMPORTANCE: StrategicImportance[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const SOURCE_INT_TYPES = ['HUMINT', 'SIGINT', 'IMINT', 'OSINT', 'GEOINT', 'MASINT', 'TECHINT', 'CYBER'] as const

const BEHAVIOR_TYPES: BehaviorType[] = ['TTP', 'PATTERN', 'TACTIC', 'TECHNIQUE', 'PROCEDURE']
const FREQUENCY_LEVELS: BehaviorFrequency[] = ['CONTINUOUS', 'FREQUENT', 'OCCASIONAL', 'RARE']
const SOPHISTICATION_LEVELS: BehaviorSophistication[] = ['ADVANCED', 'INTERMEDIATE', 'BASIC']

// ── Component ────────────────────────────────────────────────────

export default function EntityCreateForm({
  entityType,
  sessionId,
  onCreated,
  onCancel,
  prefill,
}: EntityCreateFormProps) {
  // Shared fields
  const [name, setName] = useState(prefill?.name ?? '')
  const [description, setDescription] = useState(prefill?.description ?? '')

  // Actor fields
  const [actorType, setActorType] = useState<ActorType>(prefill?.type ?? 'PERSON')
  const [category, setCategory] = useState(prefill?.category ?? '')
  const [role, setRole] = useState(prefill?.role ?? '')
  const [affiliation, setAffiliation] = useState(prefill?.affiliation ?? '')
  const [aliases, setAliases] = useState(prefill?.aliases?.join(', ') ?? '')

  // Event fields
  const [eventType, setEventType] = useState<EventType>(prefill?.event_type ?? 'ACTIVITY')
  const [dateStart, setDateStart] = useState(prefill?.date_start ?? '')
  const [dateEnd, setDateEnd] = useState(prefill?.date_end ?? '')
  const [significance, setSignificance] = useState<EventSignificance>(prefill?.significance ?? 'MEDIUM')
  const [confidence, setConfidence] = useState<EventConfidence>(prefill?.confidence ?? 'POSSIBLE')

  // Place fields
  const [placeType, setPlaceType] = useState<PlaceType>(prefill?.place_type ?? 'FACILITY')
  const [lat, setLat] = useState(prefill?.lat ?? '')
  const [lng, setLng] = useState(prefill?.lng ?? '')
  const [country, setCountry] = useState(prefill?.country ?? '')
  const [region, setRegion] = useState(prefill?.region ?? '')
  const [strategicImportance, setStrategicImportance] = useState<StrategicImportance>(prefill?.strategic_importance ?? 'MEDIUM')

  // Source fields
  const [sourceIntType, setSourceIntType] = useState<string>(prefill?.type ?? 'OSINT')
  const [sourceType, setSourceType] = useState(prefill?.source_type ?? '')

  // Behavior fields
  const [behaviorType, setBehaviorType] = useState<BehaviorType>(prefill?.behavior_type ?? 'TTP')
  const [frequency, setFrequency] = useState<BehaviorFrequency>(prefill?.frequency ?? 'OCCASIONAL')
  const [sophistication, setSophistication] = useState<BehaviorSophistication>(prefill?.sophistication ?? 'INTERMEDIATE')

  // Form state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset prefill when entityType changes
  useEffect(() => {
    setError(null)
  }, [entityType])

  // ── Build request body ─────────────────────────────────────────

  function buildBody(): Record<string, any> {
    const base: Record<string, any> = {
      name: name.trim(),
      workspace_id: sessionId,
    }
    if (description.trim()) base.description = description.trim()

    switch (entityType) {
      case 'actors':
        base.type = actorType
        if (category.trim()) base.category = category.trim()
        if (role.trim()) base.role = role.trim()
        if (affiliation.trim()) base.affiliation = affiliation.trim()
        if (aliases.trim()) {
          base.aliases = aliases
            .split(',')
            .map((a: string) => a.trim())
            .filter(Boolean)
        }
        break

      case 'events':
        base.event_type = eventType
        base.date_start = dateStart
        if (dateEnd) base.date_end = dateEnd
        base.significance = significance
        base.confidence = confidence
        break

      case 'places':
        base.place_type = placeType
        if (lat !== '' && lng !== '') {
          base.coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) }
        }
        if (country.trim()) base.country = country.trim()
        if (region.trim()) base.region = region.trim()
        base.strategic_importance = strategicImportance
        break

      case 'sources':
        base.type = sourceIntType
        if (sourceType.trim()) base.source_type = sourceType.trim()
        break

      case 'behaviors':
        base.behavior_type = behaviorType
        base.frequency = frequency
        base.sophistication = sophistication
        break
    }

    return base
  }

  // ── Submit ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return
    if (entityType === 'events' && !dateStart) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/${entityType}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(buildBody()),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Failed to create ${entityType.slice(0, -1)}`)
      }

      const data = await res.json()
      onCreated(data)
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }, [name, description, entityType, sessionId, dateStart, onCreated, actorType, category, role, affiliation, aliases, eventType, dateEnd, significance, confidence, placeType, lat, lng, country, region, strategicImportance, sourceIntType, sourceType, behaviorType, frequency, sophistication])

  // ── Render helpers ─────────────────────────────────────────────

  const renderSelect = (
    label: string,
    value: string,
    onChange: (v: any) => void,
    options: readonly string[],
  ) => (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )

  const renderInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { placeholder?: string; type?: string; required?: boolean },
  ) => (
    <div>
      <label className={LABEL_CLS}>
        {label}
        {opts?.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        className={INPUT_CLS}
      />
    </div>
  )

  // ── Type-specific fields ───────────────────────────────────────

  function renderTypeFields() {
    switch (entityType) {
      case 'actors':
        return (
          <>
            {renderSelect('Type', actorType, setActorType, ACTOR_TYPES)}
            <div className="grid grid-cols-2 gap-2">
              {renderInput('Category', category, setCategory, { placeholder: 'e.g. Military' })}
              {renderInput('Role', role, setRole, { placeholder: 'e.g. Commander' })}
            </div>
            {renderInput('Affiliation', affiliation, setAffiliation, { placeholder: 'e.g. Wagner Group' })}
            {renderInput('Aliases', aliases, setAliases, { placeholder: 'Comma-separated aliases' })}
          </>
        )

      case 'events':
        return (
          <>
            {renderSelect('Event Type', eventType, setEventType, EVENT_TYPES)}
            <div className="grid grid-cols-2 gap-2">
              {renderInput('Start Date', dateStart, setDateStart, { type: 'date', required: true })}
              {renderInput('End Date', dateEnd, setDateEnd, { type: 'date' })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {renderSelect('Significance', significance, setSignificance, SIGNIFICANCE_LEVELS)}
              {renderSelect('Confidence', confidence, setConfidence, CONFIDENCE_LEVELS)}
            </div>
          </>
        )

      case 'places':
        return (
          <>
            {renderSelect('Place Type', placeType, setPlaceType, PLACE_TYPES)}
            <div className="grid grid-cols-2 gap-2">
              {renderInput('Latitude', String(lat), (v) => setLat(v), { type: 'number', placeholder: 'e.g. 51.5074' })}
              {renderInput('Longitude', String(lng), (v) => setLng(v), { type: 'number', placeholder: 'e.g. -0.1278' })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {renderInput('Country', country, setCountry, { placeholder: 'e.g. United Kingdom' })}
              {renderInput('Region', region, setRegion, { placeholder: 'e.g. South-East' })}
            </div>
            {renderSelect('Strategic Importance', strategicImportance, setStrategicImportance, STRATEGIC_IMPORTANCE)}
          </>
        )

      case 'sources':
        return (
          <>
            {renderSelect('Intelligence Type', sourceIntType, setSourceIntType, SOURCE_INT_TYPES)}
            {renderInput('Source Type', sourceType, setSourceType, { placeholder: 'e.g. Agent, Intercept, Satellite' })}
          </>
        )

      case 'behaviors':
        return (
          <>
            {renderSelect('Behavior Type', behaviorType, setBehaviorType, BEHAVIOR_TYPES)}
            <div className="grid grid-cols-2 gap-2">
              {renderSelect('Frequency', frequency, setFrequency, FREQUENCY_LEVELS)}
              {renderSelect('Sophistication', sophistication, setSophistication, SOPHISTICATION_LEVELS)}
            </div>
          </>
        )

      default:
        return null
    }
  }

  // ── Main render ────────────────────────────────────────────────

  const entityLabel = entityType.slice(0, -1) // "actor", "event", etc.
  const isValid = name.trim() && (entityType !== 'events' || dateStart)

  return (
    <div className="space-y-3">
      {/* Name (shared, required) */}
      <div>
        <label className={LABEL_CLS}>
          Name <span className="text-red-400 ml-0.5">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} name`}
          className={INPUT_CLS}
          autoFocus
        />
      </div>

      {/* Type-specific fields */}
      {renderTypeFields()}

      {/* Description (shared, optional) */}
      <div>
        <label className={LABEL_CLS}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className={INPUT_CLS + ' resize-none'}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !isValid}
          className="inline-flex items-center gap-1 h-7 px-3 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          {submitting ? 'Saving...' : `Create ${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)}`}
        </button>
      </div>
    </div>
  )
}
