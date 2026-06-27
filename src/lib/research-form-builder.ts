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

export type ResearchFormAccessLevel = 'public' | 'password' | 'internal'

/** A single field row in the builder's editable state. */
export interface BuilderField {
  type: IntakeFormFieldType
  label: string
  required: boolean
  help_text?: string
  /** Raw comma-separated options string (only meaningful for select/multiselect). */
  optionsRaw?: string
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
    return out
  })

  const payload: SurveyPayload = {
    title,
    access_level: accessLevel,
    form_schema,
  }

  const description = String(state.description ?? '').trim()
  if (description) payload.description = description
  if (accessLevel === 'password') payload.password = String(state.password).trim()

  return payload
}
