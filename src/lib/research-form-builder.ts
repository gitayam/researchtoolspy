/**
 * Research Form Builder helpers (System A — survey_drops dynamic schema).
 *
 * Pure, framework-free logic for the builder UI (`ResearchFormBuilderPage.tsx`)
 * so all validation + payload shaping is unit-testable without React/DOM/HTTP.
 * Mirrors the style of `src/lib/cop-cot-export.ts`.
 *
 * The builder POSTs the output of `buildSurveyPayload` to `POST /api/surveys`,
 * which persists a `survey_drops` row and returns a `share_token` the public
 * submit page (`/survey/<share_token>`) is keyed by. Submitter `form_data` is
 * keyed by each field's derived `name`, so names MUST be unique within a form.
 */

import type { IntakeFormField, IntakeFormFieldType } from '@/types/cop'

/** The 19 field types the public submit page (`PublicIntakeForm`) understands. */
export const FIELD_TYPES: IntakeFormFieldType[] = [
  'text', 'textarea', 'number', 'datetime', 'select', 'multiselect', 'file', 'checkbox',
  'url', 'email', 'phone', 'ip_address', 'onion', 'crypto_address',
  'geopoint', 'rating', 'likert', 'country', 'handle',
]

const FIELD_TYPE_SET = new Set<string>(FIELD_TYPES)

/** Types whose options are edited in E-3a (comma-separated input). */
export const OPTION_TYPES: IntakeFormFieldType[] = ['select', 'multiselect']

/** Types that accept an optional numeric min/max bound (E-3b). */
export const RANGE_TYPES: IntakeFormFieldType[] = ['number', 'rating']

export type ResearchFormAccessLevel = 'public' | 'password' | 'internal'

/** A single field row in the builder's editable state. */
export interface BuilderField {
  type: IntakeFormFieldType
  label: string
  required: boolean
  help_text?: string
  /** Raw comma-separated options string (only meaningful for select/multiselect). */
  optionsRaw?: string
  /** Raw min bound string (only meaningful for number/rating); parsed in buildSurveyPayload. */
  minRaw?: string
  /** Raw max bound string (only meaningful for number/rating); parsed in buildSurveyPayload. */
  maxRaw?: string
}

/** The whole builder form state. */
export interface BuilderState {
  title: string
  description: string
  access_level: ResearchFormAccessLevel
  password: string
  fields: BuilderField[]
}

/** Shape POSTed to `POST /api/surveys`. */
export interface SurveyPayload {
  title: string
  description?: string
  access_level: ResearchFormAccessLevel
  password?: string
  form_schema: IntakeFormField[]
  /**
   * Create the form live, not as a draft. The public GET + submit endpoints
   * both 403 unless `status === 'active'` (functions/api/surveys/public/[token].ts:31,
   * .../submit.ts:38), and POST /api/surveys defaults to 'draft' — so without this
   * the builder would produce a form that 403s at its own public URL.
   */
  status: 'active'
}

export const MAX_FIELDS = 50

/**
 * Derive a stable field `name` from a human label:
 * lowercase, spaces → underscore, strip everything but [a-z0-9_], collapse
 * repeated underscores, trim leading/trailing underscores.
 *
 * Returns `''` for labels with no usable characters; callers handle that
 * (e.g. a blank label is a validation error before we reach uniqueness).
 */
export function slugifyFieldName(label: string): string {
  return String(label ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // non-alnum runs → single underscore
    .replace(/_+/g, '_')         // collapse repeats
    .replace(/^_+|_+$/g, '')     // trim edges
}

/**
 * Slugify a list of labels, suffixing `_2`, `_3`, … to resolve collisions so
 * every returned name is unique (submitter data is keyed by name). Empty
 * slugs are left empty and are NOT deduped — a blank label is a separate
 * validation failure surfaced by `buildSurveyPayload`.
 */
export function deriveUniqueNames(labels: string[]): string[] {
  const seen = new Map<string, number>()
  return labels.map((label) => {
    const base = slugifyFieldName(label)
    if (!base) return ''
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}_${count + 1}`
  })
}

/** Parse a comma-separated options string into a trimmed, non-empty string[]. */
export function parseOptions(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Parse a raw bound string into a finite number, or `undefined` when blank /
 * non-numeric. Used for number/rating min/max — a missing bound must be
 * omitted from the payload rather than set to `NaN`.
 */
export function parseBound(raw: string | undefined): number | undefined {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}

/**
 * Return a NEW array with the item at `index` swapped with its neighbor in
 * `direction`. Out-of-bounds moves (first item up, last item down, or an
 * `index` outside the array) return the input array unchanged. Pure — never
 * mutates the input.
 */
export function moveField<T>(arr: T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= arr.length || target < 0 || target >= arr.length) {
    return arr
  }
  const next = arr.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/**
 * Best-effort, NON-THROWING projection of the current builder state into
 * renderable `IntakeFormField`s for the live "preview as submitter" panel
 * (E-3c). Unlike `buildSurveyPayload`, this never validates and never throws —
 * the creator is still editing, so fields are routinely half-finished.
 *
 * Rules:
 *  - Skip fields with no usable label (an empty row shouldn't render a control).
 *  - Derive unique `name`s exactly like `buildSurveyPayload` so the preview's
 *    field keys match what would be persisted.
 *  - Carry `required`, `help_text`, `options`, `min`, `max` only when present.
 *  - An incomplete select/multiselect (no options yet) is INCLUDED with
 *    `options: []` rather than dropped — the preview shows an empty dropdown.
 *  - No fields → `[]`.
 */
export function toPreviewFields(state: BuilderState): IntakeFormField[] {
  const fields = state?.fields ?? []

  // Only keep fields whose label has usable characters, preserving order; we
  // derive unique names from the kept labels so the preview matches the payload.
  const kept = fields.filter((field) => slugifyFieldName(String(field?.label ?? '')))
  const names = deriveUniqueNames(kept.map((f) => String(f.label)))

  return kept.map((field, index) => {
    const out: IntakeFormField = {
      name: names[index],
      type: FIELD_TYPE_SET.has(field.type) ? field.type : 'text',
      label: String(field.label).trim(),
      required: !!field.required,
    }

    const helpText = String(field.help_text ?? '').trim()
    if (helpText) out.help_text = helpText

    if (OPTION_TYPES.includes(field.type)) {
      // Incomplete select → empty options, never throw.
      out.options = parseOptions(field.optionsRaw)
    }

    if (RANGE_TYPES.includes(field.type)) {
      const min = parseBound(field.minRaw)
      const max = parseBound(field.maxRaw)
      if (min !== undefined) out.min = min
      if (max !== undefined) out.max = max
    }

    return out
  })
}

export class FormBuilderValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormBuilderValidationError'
  }
}

/**
 * Validate builder state and shape it into the `POST /api/surveys` payload.
 * Throws `FormBuilderValidationError` with a UI-friendly message on any
 * problem so the page can toast it.
 */
export function buildSurveyPayload(state: BuilderState): SurveyPayload {
  const title = String(state.title ?? '').trim()
  if (!title) {
    throw new FormBuilderValidationError('A form title is required.')
  }

  const fields = state.fields ?? []
  if (fields.length === 0) {
    throw new FormBuilderValidationError('Add at least one field.')
  }
  if (fields.length > MAX_FIELDS) {
    throw new FormBuilderValidationError(`A form can have at most ${MAX_FIELDS} fields.`)
  }

  // Per-field: label + type validity, and gather labels for name derivation.
  const labels: string[] = []
  fields.forEach((field, index) => {
    const label = String(field.label ?? '').trim()
    if (!label) {
      throw new FormBuilderValidationError(`Field ${index + 1} needs a label.`)
    }
    if (!FIELD_TYPE_SET.has(field.type)) {
      throw new FormBuilderValidationError(`Field "${label}" has an invalid type.`)
    }
    if (!slugifyFieldName(label)) {
      throw new FormBuilderValidationError(
        `Field "${label}" has no letters or numbers to make a field name from.`
      )
    }
    labels.push(label)
  })

  const names = deriveUniqueNames(labels)

  const accessLevel: ResearchFormAccessLevel = state.access_level || 'public'
  if (accessLevel === 'password' && !String(state.password ?? '').trim()) {
    throw new FormBuilderValidationError('A password is required for password-protected forms.')
  }

  const form_schema: IntakeFormField[] = fields.map((field, index) => {
    const out: IntakeFormField = {
      name: names[index],
      type: field.type,
      label: String(field.label).trim(),
      required: !!field.required,
    }
    const helpText = String(field.help_text ?? '').trim()
    if (helpText) out.help_text = helpText

    if (OPTION_TYPES.includes(field.type)) {
      const options = parseOptions(field.optionsRaw)
      if (options.length === 0) {
        throw new FormBuilderValidationError(
          `Field "${out.label}" is a ${field.type} and needs at least one option.`
        )
      }
      out.options = options
    }

    if (RANGE_TYPES.includes(field.type)) {
      const min = parseBound(field.minRaw)
      const max = parseBound(field.maxRaw)
      if (min !== undefined && max !== undefined && min > max) {
        throw new FormBuilderValidationError(`Field "${out.label}": min must be ≤ max.`)
      }
      if (min !== undefined) out.min = min
      if (max !== undefined) out.max = max
    }
    return out
  })

  const payload: SurveyPayload = {
    title,
    access_level: accessLevel,
    form_schema,
    status: 'active', // create live — draft forms 403 at their public URL
  }

  const description = String(state.description ?? '').trim()
  if (description) payload.description = description
  if (accessLevel === 'password') payload.password = String(state.password).trim()

  return payload
}
