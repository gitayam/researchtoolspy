/**
 * E-7a: citation fields stored on promoted evidence (pure-Node, no browser, no HTTP).
 *
 * URL-enrichment (E-14) writes `_enriched_<fieldname>` keys back into
 * `survey_responses.form_data` after a submission arrives. When the reviewer
 * promotes that submission to evidence (POST /api/research/submissions/process),
 * we want to capture those citation-ready fields into `metadata.citation` on the
 * `evidence_items` row so client-side formatters can render a citation without
 * re-fetching.
 *
 * `extractEnrichedCitation` is a pure helper in systema-adapter.ts. These tests
 * pin its contract and verify that process.ts actually wires the result in.
 */
import { test, expect } from '@playwright/test'
import { extractEnrichedCitation } from '../../../functions/api/research/_lib/systema-adapter'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test.describe('E-7a citation extraction on promote @smoke', () => {
  // a. null input → null
  test('@smoke null formData returns null', () => {
    expect(extractEnrichedCitation(null)).toBeNull()
  })

  // b. stringified empty object → null
  test('@smoke stringified empty object returns null', () => {
    expect(extractEnrichedCitation('{}')).toBeNull()
  })

  // c. no _enriched_* keys present → null
  test('@smoke no _enriched_* keys returns null', () => {
    const formData = JSON.stringify({
      source_url: 'https://example.com/article',
      title: 'Some article',
      description: 'An interesting piece',
    })
    expect(extractEnrichedCitation(formData)).toBeNull()
  })

  // d. one valid _enriched_source_url → returns correct citation fields
  test('@smoke valid _enriched_source_url returns citation with source_type web', () => {
    const formData = JSON.stringify({
      source_url: 'https://example.com/article',
      _enriched_source_url: {
        field: 'source_url',
        url: 'https://example.com/article',
        title: 'Article Title',
        excerpt: 'First 500 chars of the article content...',
        fetched_at: '2026-06-30T12:00:00Z',
        summary: 'A concise AI summary under 300 chars.',
        analysis_id: 'uuid-1234',
        word_count: 1234,
        content_source: 'web',
      },
    })

    const result = extractEnrichedCitation(formData)

    expect(result).not.toBeNull()
    expect(result!.source_type).toBe('web')
    expect(result!.url).toBe('https://example.com/article')
    expect(result!.title).toBe('Article Title')
    expect(result!.excerpt).toBe('First 500 chars of the article content...')
    expect(result!.summary).toBe('A concise AI summary under 300 chars.')
    expect(result!.fetched_at).toBe('2026-06-30T12:00:00Z')
  })

  // e. _enriched_source_url with missing optional fields → those fields are null
  test('@smoke missing optional fields become null (not undefined)', () => {
    const formData = JSON.stringify({
      source_url: 'https://example.com/article',
      _enriched_source_url: {
        field: 'source_url',
        url: 'https://example.com/article',
        // title, summary, excerpt, fetched_at intentionally absent
      },
    })

    const result = extractEnrichedCitation(formData)

    expect(result).not.toBeNull()
    expect(result!.url).toBe('https://example.com/article')
    // Absent fields must be null, not undefined
    expect(result!.title).toBeNull()
    expect(result!.summary).toBeNull()
    expect(result!.excerpt).toBeNull()
    expect(result!.fetched_at).toBeNull()
    // Verify null not undefined explicitly
    expect(Object.prototype.hasOwnProperty.call(result, 'title')).toBe(true)
    expect(result!.title === null).toBe(true)
  })

  // f. multiple _enriched_* keys — prefer the one matching source_url
  test('@smoke multiple _enriched_* keys: prefers entry matching source_url', () => {
    const formData = JSON.stringify({
      source_url: 'https://target.example/article',
      _enriched_archive_url: {
        field: 'archive_url',
        url: 'https://archive.org/save/other',
        title: 'Archive copy',
        excerpt: null,
        fetched_at: '2026-06-29T00:00:00Z',
        summary: 'An archived page.',
      },
      _enriched_source_url: {
        field: 'source_url',
        url: 'https://target.example/article',
        title: 'The real article',
        excerpt: 'Excerpt from the real article.',
        fetched_at: '2026-06-30T12:00:00Z',
        summary: 'Real summary.',
      },
    })

    const result = extractEnrichedCitation(formData)

    expect(result).not.toBeNull()
    // Must have chosen the entry matching source_url
    expect(result!.url).toBe('https://target.example/article')
    expect(result!.title).toBe('The real article')
    expect(result!.summary).toBe('Real summary.')
  })

  // g. _enriched_* value with empty/missing url → skipped
  test('@smoke _enriched_* entry with empty url is skipped', () => {
    const formData = JSON.stringify({
      _enriched_bad_field: {
        field: 'bad_field',
        url: '',          // empty — must be ignored
        title: 'Should not be chosen',
      },
      _enriched_good_field: {
        field: 'good_field',
        url: 'https://valid.example/page',
        title: 'Good entry',
        excerpt: 'Some excerpt.',
        fetched_at: '2026-06-30T00:00:00Z',
        summary: null,
      },
    })

    const result = extractEnrichedCitation(formData)

    expect(result).not.toBeNull()
    expect(result!.url).toBe('https://valid.example/page')
    expect(result!.title).toBe('Good entry')
  })

  // h. Source-guard: process.ts wires extractEnrichedCitation and citation key
  test('@smoke process.ts source contains extractEnrichedCitation and citation: wiring', () => {
    const processSource = readFileSync(
      resolve(process.cwd(), 'functions/api/research/submissions/process.ts'),
      'utf-8',
    )

    expect(processSource).toContain('extractEnrichedCitation')
    expect(processSource).toContain('citation:')
  })
})
