/**
 * Public ACH field-allowlist smoke test (pure-Node, no browser, no HTTP server).
 *
 * Proves the explicit public contract enforced by serializePublicAnalysis:
 *   - Internal columns (user_id) and any unrecognized/future column are stripped.
 *   - All allowlisted display fields present on the row are returned intact.
 *   - The allowlist itself never names the internal user_id field.
 *
 * Imports the serializer directly — no `page` fixture, no running server.
 * Inputs are cast `as any` so a DB-row-shaped object (with extra/unknown keys)
 * type-checks against the Record<string, unknown> signature.
 */
import { test, expect } from '@playwright/test'
import {
  serializePublicAnalysis,
  PUBLIC_ACH_FIELDS,
} from '../../../functions/api/ach/public/_public-fields'

test.describe('Public ACH field allowlist @smoke', () => {
  test('@smoke strips user_id and unrecognized columns from the output', () => {
    const row = {
      id: 'ach-123',
      user_id: 42, // internal — must NOT leak
      title: 'Did the actor cause the incident?',
      description: 'A public analysis',
      question: 'Who is responsible?',
      analyst: 'Jane Analyst',
      organization: 'Org',
      scale_type: 'logarithmic',
      status: 'published',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      is_public: 1,
      share_token: 'tok-abc',
      view_count: 7,
      clone_count: 3,
      domain: 'cyber',
      tags: '["a","b"]',
      shared_publicly_at: '2026-01-01T00:00:00Z',
      extraColumn: 'x', // unrecognized/future column — must NOT leak
    } as any

    const result = serializePublicAnalysis(row)

    expect('user_id' in result).toBe(false)
    expect('extraColumn' in result).toBe(false)
  })

  test('@smoke returns the expected display fields with values intact', () => {
    const row = {
      id: 'ach-123',
      user_id: 42,
      title: 'Did the actor cause the incident?',
      question: 'Who is responsible?',
      status: 'published',
      scale_type: 'logarithmic',
      view_count: 7,
      clone_count: 3,
      share_token: 'tok-abc',
      domain: 'cyber',
      extraColumn: 'x',
    } as any

    const result = serializePublicAnalysis(row)

    expect(result.id).toBe('ach-123')
    expect(result.title).toBe('Did the actor cause the incident?')
    expect(result.question).toBe('Who is responsible?')
    expect(result.status).toBe('published')
    expect(result.scale_type).toBe('logarithmic')
    expect(result.view_count).toBe(7)
    expect(result.clone_count).toBe(3)
    expect(result.share_token).toBe('tok-abc')
    expect(result.domain).toBe('cyber')
  })

  test('@smoke PUBLIC_ACH_FIELDS does not include the internal user_id field', () => {
    expect((PUBLIC_ACH_FIELDS as readonly string[]).includes('user_id')).toBe(false)
  })
})
