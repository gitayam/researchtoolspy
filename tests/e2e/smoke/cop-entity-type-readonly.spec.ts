/**
 * COP entity type field — read-only in edit mode (source-guard, pure-Node).
 *
 * Guards that EntityCreateForm.tsx disables the primary type selector when
 * `editId` is set, preventing silent type changes that PUT handlers ignore.
 *
 * These are source-text assertions: they read the component file directly and
 * verify the structural invariant is present — no browser or running server needed.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const FORM_PATH = new URL(
  '../../../src/components/cop/entities/EntityCreateForm.tsx',
  import.meta.url,
).pathname

test.describe('EntityCreateForm entity type read-only in edit mode @smoke', () => {
  let source: string

  test.beforeAll(() => {
    source = readFileSync(FORM_PATH, 'utf-8')
  })

  test('@smoke renderSelect accepts a disabled prop', () => {
    // The opts parameter type must declare disabled as an optional boolean.
    expect(source).toMatch(/disabled\?:\s*boolean/)
  })

  test('@smoke select element applies disabled and aria-disabled from opts', () => {
    // The rendered <select> must forward both HTML disabled and aria-disabled.
    expect(source).toMatch(/disabled=\{opts\?\.disabled\}/)
    expect(source).toMatch(/aria-disabled=\{opts\?\.disabled\}/)
  })

  test('@smoke hint is shown below the field when opts.hint is set', () => {
    expect(source).toMatch(/opts\?\.hint/)
  })

  test('@smoke type cannot be changed hint text is present', () => {
    expect(source).toMatch(/Type cannot be changed after creation/)
  })

  // For per-entity-type checks, scope to the renderTypeFields function body.
  // renderTypeFields starts with "function renderTypeFields()" and ends before the
  // "// ── Main render" section comment.
  test('@smoke actors type selector is disabled in renderTypeFields', () => {
    const renderBlock = source.match(/function renderTypeFields\(\)[\s\S]*?\/\/ ── Main render/)?.[0] ?? ''
    expect(renderBlock.length).toBeGreaterThan(0)
    // Must reference ACTOR_TYPES with disabled: isEdit
    expect(renderBlock).toMatch(/ACTOR_TYPES[\s\S]{0,200}disabled\s*:\s*isEdit/)
  })

  test('@smoke events type selector is disabled in renderTypeFields', () => {
    const renderBlock = source.match(/function renderTypeFields\(\)[\s\S]*?\/\/ ── Main render/)?.[0] ?? ''
    expect(renderBlock).toMatch(/EVENT_TYPES[\s\S]{0,200}disabled\s*:\s*isEdit/)
  })

  test('@smoke places type selector is disabled in renderTypeFields', () => {
    const renderBlock = source.match(/function renderTypeFields\(\)[\s\S]*?\/\/ ── Main render/)?.[0] ?? ''
    expect(renderBlock).toMatch(/PLACE_TYPES[\s\S]{0,200}disabled\s*:\s*isEdit/)
  })

  test('@smoke sources type selector is disabled in renderTypeFields', () => {
    const renderBlock = source.match(/function renderTypeFields\(\)[\s\S]*?\/\/ ── Main render/)?.[0] ?? ''
    expect(renderBlock).toMatch(/SOURCE_INT_TYPES[\s\S]{0,200}disabled\s*:\s*isEdit/)
  })

  test('@smoke behaviors type selector is disabled in renderTypeFields', () => {
    const renderBlock = source.match(/function renderTypeFields\(\)[\s\S]*?\/\/ ── Main render/)?.[0] ?? ''
    expect(renderBlock).toMatch(/BEHAVIOR_TYPES[\s\S]{0,200}disabled\s*:\s*isEdit/)
  })
})
