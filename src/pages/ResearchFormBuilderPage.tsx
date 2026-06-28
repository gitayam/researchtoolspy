import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft, Copy, CheckCircle2, AlertCircle, Link as LinkIcon, Lock, Plus, Trash2,
  ChevronUp, ChevronDown, Eye, MapPin,
} from 'lucide-react'
import { getCopHeaders } from '@/lib/cop-auth'
import { useToast } from '@/components/ui/use-toast'
import {
  buildSurveyPayload,
  moveField,
  slugifyFieldName,
  toPreviewFields,
  FIELD_TYPES,
  OPTION_TYPES,
  RANGE_TYPES,
  MAX_FIELDS,
  FormBuilderValidationError,
  type BuilderField,
  type BuilderState,
  type ResearchFormAccessLevel,
} from '@/lib/research-form-builder'
import type { IntakeFormField, IntakeFormFieldType } from '@/types/cop'

const FORMS_LIST_ROUTE = '/dashboard/research/forms'

// "coming in E-6" — file uploads are not wired through the public submit page yet.
const DEFERRED_TYPES = new Set<IntakeFormFieldType>(['file'])

const TYPE_LABELS: Record<IntakeFormFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  datetime: 'Date / time',
  select: 'Dropdown (single)',
  multiselect: 'Dropdown (multiple)',
  file: 'File upload',
  checkbox: 'Checkbox',
  url: 'URL',
  email: 'Email',
  phone: 'Phone',
  ip_address: 'IP address',
  onion: 'Onion address',
  crypto_address: 'Crypto address',
  geopoint: 'Geo point',
  rating: 'Rating',
  likert: 'Likert scale',
  country: 'Country',
  handle: 'Social handle',
}

function newField(): BuilderField {
  return { type: 'text', label: '', required: false, help_text: '', optionsRaw: '', minRaw: '', maxRaw: '' }
}

export default function ResearchFormBuilderPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [state, setState] = useState<BuilderState>({
    title: '',
    description: '',
    access_level: 'public',
    password: '',
    fields: [newField()],
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Derived on every render — never persisted, never throws while editing.
  const previewFields = toPreviewFields(state)

  const patch = (partial: Partial<BuilderState>) => setState((prev) => ({ ...prev, ...partial }))

  const patchField = (index: number, partial: Partial<BuilderField>) =>
    setState((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, ...partial } : f)),
    }))

  const addField = () =>
    setState((prev) =>
      prev.fields.length >= MAX_FIELDS
        ? prev
        : { ...prev, fields: [...prev.fields, newField()] }
    )

  const removeField = (index: number) =>
    setState((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }))

  const moveFieldAt = (index: number, direction: 'up' | 'down') =>
    setState((prev) => ({ ...prev, fields: moveField(prev.fields, index, direction) }))

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({ title: 'Copied', description: 'Public form link copied to clipboard.' })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    let payload
    try {
      payload = buildSurveyPayload(state)
    } catch (err) {
      const message =
        err instanceof FormBuilderValidationError
          ? err.message
          : 'Could not validate the form.'
      setError(message)
      toast({ title: 'Cannot create form', description: message, variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired. Refresh to continue.')
        throw new Error(data?.error || 'Failed to create form.')
      }

      if (!data?.share_token) {
        throw new Error('Form was created but no share link was returned.')
      }

      const url = `${window.location.origin}/survey/${data.share_token}`
      setCreatedUrl(url)
      toast({ title: 'Form created', description: 'Your public form link is ready.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create form.'
      setError(message)
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (createdUrl) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(FORMS_LIST_ROUTE)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to forms
          </Button>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6 mr-2" />
                Form created
              </CardTitle>
              <CardDescription>
                Share this link to collect submissions. Anyone with the link can open the form.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Public form link</Label>
                <div className="flex items-center space-x-2">
                  <Input value={createdUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(createdUrl)}
                    aria-label="Copy form link"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <Button
                  onClick={() => window.open(createdUrl, '_blank')}
                  className="flex-1"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Open form
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(FORMS_LIST_ROUTE)}
                  className="flex-1"
                >
                  Back to forms
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(FORMS_LIST_ROUTE)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to forms
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                New research form
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Build a public intake form with custom fields. Submissions are keyed by each field's
                name (auto-derived from its label).
              </p>
            </div>
            <Button
              type="button"
              variant={showPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
              className="shrink-0"
              aria-pressed={showPreview}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide preview' : 'Preview as submitter'}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
              <CardDescription>Title and a short description for the form.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. OSINT tip submission"
                  value={state.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Explain what you're collecting and how it will be used."
                  value={state.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Access
              </CardTitle>
              <CardDescription>Who can open and submit this form.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access_level">Access level</Label>
                <Select
                  value={state.access_level}
                  onValueChange={(v) => patch({ access_level: v as ResearchFormAccessLevel })}
                >
                  <SelectTrigger id="access_level" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — anyone with the link</SelectItem>
                    <SelectItem value="password">Password — requires a password</SelectItem>
                    <SelectItem value="internal">Internal — signed-in users only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {state.access_level === 'password' && (
                <div className="space-y-2">
                  <Label htmlFor="password">Form password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Submitters must enter this to view the form"
                    value={state.password}
                    onChange={(e) => patch({ password: e.target.value })}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Fields</CardTitle>
              <CardDescription>
                {state.fields.length}/{MAX_FIELDS} fields. Add the questions submitters will answer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.fields.map((field, index) => {
                const derivedName = slugifyFieldName(field.label)
                const isDeferred = DEFERRED_TYPES.has(field.type)
                const needsOptions = (OPTION_TYPES as IntakeFormFieldType[]).includes(field.type)
                const needsRange = (RANGE_TYPES as IntakeFormFieldType[]).includes(field.type)
                return (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 pt-2">
                        Field {index + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFieldAt(index, 'up')}
                          disabled={index === 0}
                          aria-label={`Move field ${index + 1} up`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFieldAt(index, 'down')}
                          disabled={index === state.fields.length - 1}
                          aria-label={`Move field ${index + 1} down`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                          disabled={state.fields.length === 1}
                          aria-label={`Remove field ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`field-type-${index}`}>Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(v) => patchField(index, { type: v as IntakeFormFieldType })}
                        >
                          <SelectTrigger id={`field-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {TYPE_LABELS[t]}
                                {DEFERRED_TYPES.has(t) ? ' (coming in E-6)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`field-label-${index}`}>Label</Label>
                        <Input
                          id={`field-label-${index}`}
                          placeholder="e.g. Source URL"
                          value={field.label}
                          onChange={(e) => patchField(index, { label: e.target.value })}
                        />
                        {derivedName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            name: {derivedName}
                          </p>
                        )}
                      </div>
                    </div>

                    {isDeferred && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        File uploads are coming in E-6 and won't accept submissions yet.
                      </p>
                    )}

                    {needsOptions && (
                      <div className="space-y-2">
                        <Label htmlFor={`field-options-${index}`}>Options (comma-separated)</Label>
                        <Input
                          id={`field-options-${index}`}
                          placeholder="Low, Medium, High"
                          value={field.optionsRaw || ''}
                          onChange={(e) => patchField(index, { optionsRaw: e.target.value })}
                        />
                      </div>
                    )}

                    {needsRange && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`field-min-${index}`}>Minimum (optional)</Label>
                          <Input
                            id={`field-min-${index}`}
                            type="number"
                            placeholder="No minimum"
                            value={field.minRaw || ''}
                            onChange={(e) => patchField(index, { minRaw: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`field-max-${index}`}>Maximum (optional)</Label>
                          <Input
                            id={`field-max-${index}`}
                            type="number"
                            placeholder="No maximum"
                            value={field.maxRaw || ''}
                            onChange={(e) => patchField(index, { maxRaw: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`field-help-${index}`}>Help text (optional)</Label>
                      <Input
                        id={`field-help-${index}`}
                        placeholder="Shown below the field"
                        value={field.help_text || ''}
                        onChange={(e) => patchField(index, { help_text: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`field-required-${index}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          patchField(index, { required: checked as boolean })
                        }
                      />
                      <Label htmlFor={`field-required-${index}`} className="cursor-pointer">
                        Required
                      </Label>
                    </div>
                  </div>
                )
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addField}
                disabled={state.fields.length >= MAX_FIELDS}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add field
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 dark:text-red-400">{error}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => navigate(FORMS_LIST_ROUTE)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create form'}
            </Button>
          </div>
        </form>

        {showPreview && (
          <div className="mt-8">
            <SubmitterPreview
              title={state.title}
              description={state.description}
              fields={previewFields}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Read-only "preview as submitter" panel (E-3c). Renders the current builder
 * fields the way the public submit page (`PublicIntakeForm`) would, with every
 * control DISABLED — nothing here persists or submits. It re-renders whenever
 * the builder state changes because `fields` is derived on each render via
 * `toPreviewFields`. We render our own self-contained controls rather than
 * reusing `PublicIntakeForm` because that component only fetches its schema by
 * token (no schema prop) and bakes in submit/fetch side effects.
 */
function SubmitterPreview({
  title, description, fields,
}: {
  title: string
  description: string
  fields: IntakeFormField[]
}) {
  const trimmedTitle = title.trim()
  const trimmedDescription = description.trim()
  const requiredCount = fields.filter((f) => f.required).length

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          <Eye className="h-4 w-4 mr-2 text-gray-400" />
          Preview as submitter
        </CardTitle>
        <CardDescription>
          What people will see at the public link. Controls are disabled here — this is a preview
          only and nothing is saved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mirror PublicIntakeForm's surface so the preview reads true-to-life. */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {trimmedTitle || 'Untitled form'}
              </h2>
              {trimmedDescription && (
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  {trimmedDescription}
                </p>
              )}
              <p className="text-xs text-slate-400">
                {requiredCount} required field{requiredCount !== 1 ? 's' : ''}
              </p>
            </div>

            {fields.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-8 text-center">
                Add a field with a label to see it here.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <PreviewField key={`${field.name}-${index}`} field={field} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const PREVIEW_INPUT_CLASS =
  'w-full px-3 py-2 text-base rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 disabled:opacity-100 disabled:cursor-not-allowed'

/** One disabled control representing a single preview field. */
function PreviewField({ field, index }: { field: IntakeFormField; index: number }) {
  const fieldId = `preview-${field.name || index}`
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
      >
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      <PreviewControl field={field} fieldId={fieldId} />

      {field.help_text && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
          {field.help_text}
        </p>
      )}
    </div>
  )
}

/** A disabled, representative control for each field type. */
function PreviewControl({ field, fieldId }: { field: IntakeFormField; fieldId: string }) {
  switch (field.type) {
    case 'textarea':
      return <textarea id={fieldId} disabled rows={3} className={`${PREVIEW_INPUT_CLASS} resize-none`} />

    case 'number':
    case 'rating':
      return (
        <input
          id={fieldId}
          type="number"
          disabled
          min={field.min}
          max={field.max}
          placeholder={
            field.min !== undefined || field.max !== undefined
              ? `${field.min ?? ''}–${field.max ?? ''}`
              : undefined
          }
          className={PREVIEW_INPUT_CLASS}
        />
      )

    case 'select':
      return (
        <select id={fieldId} disabled className={PREVIEW_INPUT_CLASS}>
          <option value="">Select…</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'multiselect':
      return (
        <select
          id={fieldId}
          multiple
          disabled
          size={Math.min(5, Math.max(2, (field.options || []).length))}
          className={PREVIEW_INPUT_CLASS}
        >
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input id={fieldId} type="checkbox" disabled />
          <span>{field.label}</span>
        </label>
      )

    case 'datetime':
      return <input id={fieldId} type="datetime-local" disabled className={PREVIEW_INPUT_CLASS} />

    case 'file':
      return (
        <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 text-center space-y-1 opacity-70">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-500"
            >
              Choose file
            </button>
          </span>
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            File uploads arrive in E-6 and won't accept submissions yet.
          </p>
        </div>
      )

    case 'geopoint':
      return (
        <div className="flex items-center gap-1.5 text-sm text-slate-400 rounded border border-slate-300 dark:border-slate-700 px-3 py-2">
          <MapPin className="h-4 w-4" />
          Location picker (lat/lon)
        </div>
      )

    case 'url':
      return <input id={fieldId} type="url" disabled placeholder="https://example.com" className={`${PREVIEW_INPUT_CLASS} font-mono`} />

    case 'email':
      return <input id={fieldId} type="email" disabled placeholder="name@example.com" className={PREVIEW_INPUT_CLASS} />

    case 'phone':
      return <input id={fieldId} type="tel" disabled placeholder="+1 (555) 000-0000" className={PREVIEW_INPUT_CLASS} />

    case 'ip_address':
    case 'onion':
    case 'crypto_address':
    case 'handle':
      return <input id={fieldId} type="text" disabled className={`${PREVIEW_INPUT_CLASS} font-mono`} />

    case 'country':
      return (
        <select id={fieldId} disabled className={PREVIEW_INPUT_CLASS}>
          <option value="">Select country…</option>
        </select>
      )

    case 'likert':
      return (
        <div className="flex flex-col gap-1 text-sm text-slate-400">
          {(field.options && field.options.length > 0
            ? field.options
            : ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
          ).map((opt) => (
            <label key={opt} className="flex items-center gap-2">
              <input type="radio" disabled />
              {opt}
            </label>
          ))}
        </div>
      )

    case 'text':
    default:
      return <input id={fieldId} type="text" disabled className={PREVIEW_INPUT_CLASS} />
  }
}
