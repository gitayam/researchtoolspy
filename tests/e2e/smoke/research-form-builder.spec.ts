/**
 * Research Form Builder helper (pure-Node, no browser, no HTTP server).
 *
 * E-3a converges the research-forms builder onto System A (the `survey_drops`
 * dynamic-schema engine). All validation + payload shaping lives in
 * `src/lib/research-form-builder.ts` precisely so it can be exercised here with
 * plain data — no `page` fixture, no running server. Mirrors cot-export.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  slugifyFieldName,
  deriveUniqueNames,
  parseOptions,
  buildSurveyPayload,
  toPreviewFields,
  moveField,
  FormBuilderValidationError,
  FORM_TEMPLATES,
  CREDIBILITY_FIELDS,
  MAX_FIELDS,
  type BuilderState,
  type BuilderField,
} from '../../../src/lib/research-form-builder'

function field(partial: Partial<BuilderField> = {}): BuilderField {
  return { type: 'text', label: 'Field', required: false, help_text: '', optionsRaw: '', ...partial }
}

function baseState(fields: BuilderField[]): BuilderState {
  return { title: 'My Form', description: '', access_level: 'public', password: '', fields }
}

test.describe('research form builder helper @smoke', () => {
  test('@smoke slugifyFieldName lowercases, maps spaces to underscores, strips special chars', () => {
    expect(slugifyFieldName('Source URL')).toBe('source_url')
    expect(slugifyFieldName('  Trim Me  ')).toBe('trim_me')
    expect(slugifyFieldName('Price ($USD)!')).toBe('price_usd')
    expect(slugifyFieldName('Multiple   spaces')).toBe('multiple_spaces')
    expect(slugifyFieldName('a--b__c')).toBe('a_b_c')
    expect(slugifyFieldName('!!!')).toBe('')
  })

  test('@smoke deriveUniqueNames suffixes collisions to keep names unique', () => {
    expect(deriveUniqueNames(['Name', 'Name', 'Name'])).toEqual(['name', 'name_2', 'name_3'])
    expect(deriveUniqueNames(['Source URL', 'Other'])).toEqual(['source_url', 'other'])
  })

  test('@smoke parseOptions splits a comma string into trimmed non-empty strings', () => {
    expect(parseOptions('Low, Medium, High')).toEqual(['Low', 'Medium', 'High'])
    expect(parseOptions(' a ,, b , ')).toEqual(['a', 'b'])
    expect(parseOptions('')).toEqual([])
    expect(parseOptions(undefined)).toEqual([])
  })

  test('@smoke buildSurveyPayload shapes a valid state into the /api/surveys payload', () => {
    const payload = buildSurveyPayload(
      baseState([
        field({ type: 'url', label: 'Source URL', required: true, help_text: 'Full link' }),
        field({ type: 'select', label: 'Severity', optionsRaw: 'Low, High' }),
      ])
    )
    expect(payload.title).toBe('My Form')
    expect(payload.access_level).toBe('public')
    expect(payload.password).toBeUndefined()
    // Must create the form LIVE — draft forms 403 at their public URL.
    expect(payload.status).toBe('active')
    expect(payload.form_schema).toEqual([
      { name: 'source_url', type: 'url', label: 'Source URL', required: true, help_text: 'Full link' },
      { name: 'severity', type: 'select', label: 'Severity', required: false, options: ['Low', 'High'] },
    ])
  })

  test('@smoke buildSurveyPayload includes description when present', () => {
    const state = baseState([field({ label: 'Q1' })])
    state.description = '  Collect tips  '
    expect(buildSurveyPayload(state).description).toBe('Collect tips')
  })

  test('@smoke buildSurveyPayload throws when title is missing', () => {
    const state = baseState([field({ label: 'Q1' })])
    state.title = '   '
    expect(() => buildSurveyPayload(state)).toThrow(FormBuilderValidationError)
    expect(() => buildSurveyPayload(state)).toThrow(/title/i)
  })

  test('@smoke buildSurveyPayload throws when a field has no label', () => {
    const state = baseState([field({ label: '' })])
    expect(() => buildSurveyPayload(state)).toThrow(/label/i)
  })

  test('@smoke buildSurveyPayload derives unique names for duplicate labels', () => {
    const payload = buildSurveyPayload(
      baseState([field({ label: 'Name' }), field({ label: 'Name' })])
    )
    expect(payload.form_schema.map((f) => f.name)).toEqual(['name', 'name_2'])
  })

  test('@smoke buildSurveyPayload throws when over the field limit', () => {
    const fields = Array.from({ length: MAX_FIELDS + 1 }, (_, i) => field({ label: `Q${i}` }))
    expect(() => buildSurveyPayload(baseState(fields))).toThrow(/at most 50/i)
  })

  test('@smoke buildSurveyPayload requires options for select/multiselect', () => {
    const state = baseState([field({ type: 'multiselect', label: 'Tags', optionsRaw: '' })])
    expect(() => buildSurveyPayload(state)).toThrow(/option/i)
  })

  test('@smoke buildSurveyPayload requires a password when access_level is password', () => {
    const state = baseState([field({ label: 'Q1' })])
    state.access_level = 'password'
    state.password = ''
    expect(() => buildSurveyPayload(state)).toThrow(/password/i)

    state.password = 'hunter2'
    const payload = buildSurveyPayload(state)
    expect(payload.access_level).toBe('password')
    expect(payload.password).toBe('hunter2')
  })

  test('@smoke buildSurveyPayload throws when there are no fields', () => {
    expect(() => buildSurveyPayload(baseState([]))).toThrow(/at least one field/i)
  })

  test('@smoke moveField swaps neighbors and is a no-op at the bounds', () => {
    const arr = ['a', 'b', 'c']
    expect(moveField(arr, 1, 'up')).toEqual(['b', 'a', 'c'])
    expect(moveField(arr, 1, 'down')).toEqual(['a', 'c', 'b'])
    // First item up and last item down are no-ops (equal contents).
    expect(moveField(arr, 0, 'up')).toEqual(['a', 'b', 'c'])
    expect(moveField(arr, 2, 'down')).toEqual(['a', 'b', 'c'])
  })

  test('@smoke moveField returns a new array and never mutates the input', () => {
    const arr = ['a', 'b', 'c']
    const moved = moveField(arr, 0, 'down')
    expect(moved).not.toBe(arr)
    expect(moved).toEqual(['b', 'a', 'c'])
    // Input untouched.
    expect(arr).toEqual(['a', 'b', 'c'])
  })

  test('@smoke buildSurveyPayload parses min/max for number fields', () => {
    const payload = buildSurveyPayload(
      baseState([field({ type: 'number', label: 'Age', minRaw: '0', maxRaw: '120' })])
    )
    expect(payload.form_schema[0]).toMatchObject({ name: 'age', type: 'number', min: 0, max: 120 })
  })

  test('@smoke buildSurveyPayload omits a blank min/max bound', () => {
    const payload = buildSurveyPayload(
      baseState([field({ type: 'rating', label: 'Score', minRaw: '1', maxRaw: '' })])
    )
    const out = payload.form_schema[0]
    expect(out.min).toBe(1)
    expect(out.max).toBeUndefined()
  })

  test('@smoke buildSurveyPayload throws when min > max', () => {
    const state = baseState([field({ type: 'number', label: 'Range', minRaw: '10', maxRaw: '5' })])
    expect(() => buildSurveyPayload(state)).toThrow(FormBuilderValidationError)
    expect(() => buildSurveyPayload(state)).toThrow(/min must be/i)
  })

  test('@smoke buildSurveyPayload ignores min/max on a non-range type', () => {
    const payload = buildSurveyPayload(
      baseState([field({ type: 'text', label: 'Notes', minRaw: '1', maxRaw: '9' })])
    )
    const out = payload.form_schema[0]
    expect(out.min).toBeUndefined()
    expect(out.max).toBeUndefined()
  })

  // ── toPreviewFields (live "preview as submitter", E-3c) ────────────────────
  // Must NEVER throw on incomplete/half-edited input — the creator is still typing.

  test('@smoke toPreviewFields returns [] for empty state and never throws', () => {
    expect(toPreviewFields(baseState([]))).toEqual([])
    // A wholly-empty field (no label) is dropped, leaving no fields.
    expect(toPreviewFields(baseState([field({ label: '' })]))).toEqual([])
    // Defensive: a missing fields array must not throw.
    expect(() => toPreviewFields({ fields: undefined } as unknown as BuilderState)).not.toThrow()
  })

  test('@smoke toPreviewFields skips fields with no usable label but keeps labelled ones', () => {
    const out = toPreviewFields(
      baseState([
        field({ label: '' }),
        field({ label: '   ' }),
        field({ label: '!!!' }), // slugifies to '' → skipped
        field({ label: 'Keep me' }),
      ])
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'keep_me', label: 'Keep me' })
  })

  test('@smoke toPreviewFields includes an incomplete select with options: [] (no throw)', () => {
    const out = toPreviewFields(
      baseState([field({ type: 'select', label: 'Severity', optionsRaw: '' })])
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'severity', type: 'select', options: [] })
  })

  test('@smoke toPreviewFields carries label, type, required, options, min, max when present', () => {
    const out = toPreviewFields(
      baseState([
        field({ type: 'url', label: 'Source URL', required: true, help_text: 'Full link' }),
        field({ type: 'select', label: 'Tags', optionsRaw: 'Low, High' }),
        field({ type: 'number', label: 'Age', minRaw: '0', maxRaw: '120' }),
      ])
    )
    expect(out[0]).toEqual({
      name: 'source_url', type: 'url', label: 'Source URL', required: true, help_text: 'Full link',
    })
    expect(out[1]).toMatchObject({ name: 'tags', type: 'select', options: ['Low', 'High'] })
    expect(out[2]).toMatchObject({ name: 'age', type: 'number', min: 0, max: 120 })
  })

  test('@smoke toPreviewFields derives unique names for duplicate labels', () => {
    const out = toPreviewFields(baseState([field({ label: 'Name' }), field({ label: 'Name' })]))
    expect(out.map((f) => f.name)).toEqual(['name', 'name_2'])
  })

  // ── FORM_TEMPLATES (starter presets, E-4a) ─────────────────────────────────
  // Every template must be well-formed: buildSurveyPayload (which throws on any
  // invalid field — select w/o options, rating w/o min/max bounds, blank labels)
  // must accept it and emit a schema with the same field count.

  test('@smoke FORM_TEMPLATES has the expected templates with unique ids', () => {
    expect(FORM_TEMPLATES.length).toBe(5)
    const ids = FORM_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length) // ids are unique
  })

  for (const t of FORM_TEMPLATES) {
    test(`@smoke template "${t.id}" builds a valid payload`, () => {
      expect(t.fields.length).toBeGreaterThanOrEqual(1) // ≥1 field
      const payload = buildSurveyPayload({
        title: t.name,
        description: '',
        access_level: 'public',
        password: '',
        fields: t.fields,
      })
      // Well-formed: did not throw, and every template field round-trips.
      expect(payload.form_schema).toHaveLength(t.fields.length)
    })
  }

  // ── CREDIBILITY_FIELDS (NATO/Admiralty preset, E-10) ───────────────────────
  // Two select fields a researcher drops in to rate a source: reliability A–F
  // and information credibility 1–6. Both selects MUST carry options.

  test('@smoke CREDIBILITY_FIELDS is two well-formed select presets (A–F, 1–6)', () => {
    expect(CREDIBILITY_FIELDS).toHaveLength(2)
    for (const f of CREDIBILITY_FIELDS) {
      expect(f.type).toBe('select')
      expect(parseOptions(f.optionsRaw).length).toBeGreaterThan(0)
    }
    const [reliability, credibility] = CREDIBILITY_FIELDS
    const relOpts = parseOptions(reliability.optionsRaw)
    expect(relOpts).toHaveLength(6)
    expect(relOpts[0].startsWith('A')).toBe(true)
    expect(relOpts[5].startsWith('F')).toBe(true)
    const credOpts = parseOptions(credibility.optionsRaw)
    expect(credOpts).toHaveLength(6)
    expect(credOpts[0].startsWith('1')).toBe(true)
    expect(credOpts[5].startsWith('6')).toBe(true)
  })

  test('@smoke CREDIBILITY_FIELDS builds a valid payload (2 selects, 6 options each)', () => {
    const payload = buildSurveyPayload(baseState(CREDIBILITY_FIELDS))
    expect(payload.form_schema).toHaveLength(2)
    for (const f of payload.form_schema) {
      expect(Array.isArray(f.options)).toBe(true)
      expect(f.options).toHaveLength(6)
    }
  })
})
