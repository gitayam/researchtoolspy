/**
 * Promote-to-evidence System-A field mapping (pure-Node, no browser, no HTTP).
 *
 * E-4b-2: `functions/api/research/submissions/process.ts` was repointed from the
 * legacy "System B" (`form_submissions`) to "System A" (`survey_responses`). The
 * promote handler turns a submitter's `form_data` answers into a
 * `research_evidence` row via the shared `buildEvidenceFromResponse` adapter.
 * These tests pin that mapping so the title fallback chain stays correct and
 * (E-1 privacy) the submitter's IP hash can never bleed into evidence.
 */
import { test, expect } from '@playwright/test'
import { buildEvidenceFromResponse } from '../../../functions/api/research/_lib/systema-adapter'

test.describe('Promote → System A field mapping @smoke', () => {
  test('@smoke maps a url + description submission into { title, source_url, content }', () => {
    const formData = JSON.stringify({
      title: 'Suspicious account on X',
      source_url: 'https://example.com/post/42',
      description: 'Observed a suspicious account amplifying a narrative',
    })

    const out = buildEvidenceFromResponse(formData)

    expect(out.title).toBe('Suspicious account on X')
    expect(out.source_url).toBe('https://example.com/post/42')
    expect(out.description).toBe('Observed a suspicious account amplifying a narrative')
  })

  test('@smoke title falls back to source_url when there is no title field', () => {
    const formData = JSON.stringify({
      document_url: 'https://docs.example/leak.pdf',
    })

    const out = buildEvidenceFromResponse(formData)

    // No title/description key → title falls back to the extracted source_url.
    expect(out.title).toBe('https://docs.example/leak.pdf')
    expect(out.source_url).toBe('https://docs.example/leak.pdf')
    expect(out.description).toBeNull()
  })

  test('@smoke title prefers description over source_url when no title field', () => {
    const formData = JSON.stringify({
      summary: 'A leaked internal memo about logistics',
      url: 'https://t.co/abc',
    })

    const out = buildEvidenceFromResponse(formData)

    // description present → title uses it (truncated), not the url.
    expect(out.title).toBe('A leaked internal memo about logistics')
    expect(out.source_url).toBe('https://t.co/abc')
    expect(out.description).toBe('A leaked internal memo about logistics')
  })

  test("@smoke title is 'Untitled Submission' when neither title, description, nor url exist", () => {
    const formData = JSON.stringify({ submitter_mood: 'curious' })

    const out = buildEvidenceFromResponse(formData)

    expect(out.title).toBe('Untitled Submission')
    expect(out.source_url).toBeNull()
    expect(out.description).toBeNull()
  })

  test('@smoke handles empty / invalid form_data without throwing', () => {
    expect(buildEvidenceFromResponse(null).title).toBe('Untitled Submission')
    expect(buildEvidenceFromResponse('').title).toBe('Untitled Submission')
    expect(buildEvidenceFromResponse('not json').title).toBe('Untitled Submission')
    expect(buildEvidenceFromResponse('{}').source_url).toBeNull()
  })

  test('@smoke never surfaces submitter_ip_hash from form_data (E-1 privacy)', () => {
    // Even if an IP hash rides along in the submitted answers, the promote
    // mapping must not carry it into the evidence fields.
    const formData = JSON.stringify({
      url: 'http://t.co/x',
      _submitter_ip_hash: 'deadbeefcafe',
      submitter_ip_hash: 'deadbeefcafe',
    })

    const out = buildEvidenceFromResponse(formData)
    const serialized = JSON.stringify(out)

    expect(serialized.includes('submitter_ip_hash')).toBe(false)
    expect(serialized.includes('deadbeef')).toBe(false)
    // The url-ish fallback still works and that's the only thing surfaced.
    expect(out.source_url).toBe('http://t.co/x')
    expect(out.title).toBe('http://t.co/x')
  })

  test('@smoke extracts content_type when the form supplies one', () => {
    const formData = JSON.stringify({
      title: 'A video',
      content_type: 'video',
      url: 'https://youtu.be/abc',
    })

    const out = buildEvidenceFromResponse(formData)

    expect(out.content_type).toBe('video')
    // content_type is null when absent (handler then uses its default).
    expect(buildEvidenceFromResponse('{"title":"x"}').content_type).toBeNull()
  })
})
