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
  FormBuilderValidationError,
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
})
