/**
 * Reviewer-list System-A adapter (pure-Node, no browser, no HTTP server).
 *
 * E-4b-1: the research-forms reviewer list endpoints were repointed from the
 * legacy "System B" tables (`submission_forms` / `form_submissions`, now only
 * abandoned test data) to "System A" (`survey_drops` / `survey_responses`), where
 * the modern builder + public submit actually write. The repoint MUST preserve
 * the exact JSON shape `EvidenceSubmissionsPage.tsx` consumes. These tests pin
 * the row→shape mapping so a future change can't silently break the reviewer UI
 * or (E-1 privacy) leak the submitter's IP hash.
 */
import { test, expect } from '@playwright/test'
import {
  adaptSurveyToFormRow,
  adaptResponseToSubmissionRow,
  type SurveyDropRow,
  type SurveyResponseRow,
} from '../../../functions/api/research/_lib/systema-adapter'

test.describe('Reviewer System-A adapter @smoke', () => {
  test('@smoke survey_drop → form row maps the keys the reviewer UI reads', () => {
    const row: SurveyDropRow = {
      id: 'srv-1',
      title: 'OSINT Tips',
      description: 'Collect leads',
      share_token: 'tok_abc123',
      status: 'active',
      submission_count: 7,
      form_schema: JSON.stringify([{ name: 'source_url', type: 'url' }, { name: 'description', type: 'textarea' }]),
      created_at: '2026-01-02T03:04:05Z',
    }

    const out = adaptSurveyToFormRow(row)

    expect(out.form_name).toBe('OSINT Tips')
    expect(out.form_description).toBe('Collect leads')
    expect(out.is_active).toBe(1) // status 'active' → truthy
    expect(out.submission_count).toBe(7)
    expect(out.submissionUrl).toBe('/survey/tok_abc123')
    expect(out.id).toBe('srv-1')
    expect(out.hash_id).toBe('tok_abc123')
    expect(out.enabledFields).toHaveLength(2) // UI reads enabledFields.length
  })

  test('@smoke a draft survey maps to is_active falsy', () => {
    const row: SurveyDropRow = {
      id: 'srv-2',
      title: 'Draft form',
      description: null,
      share_token: 'tok_draft',
      status: 'draft',
      submission_count: 0,
    }

    const out = adaptSurveyToFormRow(row)

    expect(out.is_active).toBe(0) // status 'draft' → falsy
    expect(out.form_description).toBe('') // null → safe empty string
    expect(out.enabledFields).toEqual([]) // missing schema → []
    expect(out.submissionUrl).toBe('/survey/tok_draft')
  })

  test('@smoke survey_response → submission row extracts source_url / submitter / status', () => {
    const row: SurveyResponseRow = {
      id: 'resp-1',
      survey_id: 'srv-1',
      form_data: JSON.stringify({
        source_url: 'https://example.com/post/42',
        description: 'Observed a suspicious account',
        _tags: ['internal'], // internal metadata, must be stripped from `metadata`
      }),
      submitter_name: 'Jane Tipster',
      submitter_contact: 'jane@example.com',
      status: 'pending',
      created_at: '2026-02-03T04:05:06Z',
      form_name: 'OSINT Tips',
      share_token: 'tok_abc123',
    }

    const out = adaptResponseToSubmissionRow(row)

    expect(out.id).toBe('resp-1')
    expect(out.form_id).toBe('srv-1')
    expect(out.form_name).toBe('OSINT Tips')
    expect(out.form_hash).toBe('tok_abc123')
    expect(out.source_url).toBe('https://example.com/post/42')
    expect(out.content_description).toBe('Observed a suspicious account')
    expect(out.submitter_name).toBe('Jane Tipster')
    expect(out.submitter_contact).toBe('jane@example.com')
    expect(out.status).toBe('pending')
    expect(out.submitted_at).toBe('2026-02-03T04:05:06Z')
    // Internal `_`-prefixed fields are stripped from the surfaced metadata.
    expect(out.metadata).not.toHaveProperty('_tags')
    expect(out.metadata).toMatchObject({ source_url: 'https://example.com/post/42' })
  })

  test('@smoke adapter NEVER exposes submitter_ip_hash (E-1 privacy)', () => {
    // Even if an IP hash somehow rides along in form_data or on the row, the
    // adapter output must not carry it.
    const row = {
      id: 'resp-2',
      survey_id: 'srv-1',
      form_data: JSON.stringify({ url: 'http://t.co/x', _submitter_ip_hash: 'deadbeef' }),
      submitter_name: 'Anon',
      submitter_contact: null,
      submitter_ip_hash: 'deadbeefcafe', // present on the raw row — must be ignored
      status: 'accepted',
      created_at: '2026-02-03T00:00:00Z',
      form_name: 'OSINT Tips',
      share_token: 'tok_abc123',
    } as unknown as SurveyResponseRow

    const out = adaptResponseToSubmissionRow(row)
    const serialized = JSON.stringify(out)

    expect(out).not.toHaveProperty('submitter_ip_hash')
    expect(serialized.includes('submitter_ip_hash')).toBe(false)
    expect(serialized.includes('deadbeef')).toBe(false)
    // The url-ish fallback still works when there is no `source_url` key.
    expect(out.source_url).toBe('http://t.co/x')
  })

  test('@smoke description/source fall back across common field names', () => {
    const row: SurveyResponseRow = {
      id: 'resp-3',
      survey_id: 'srv-3',
      form_data: JSON.stringify({ document_url: 'https://docs.example/leak.pdf', summary: 'A leaked memo' }),
      submitter_name: null,
      submitter_contact: null,
      status: 'rejected',
      created_at: '2026-02-04T00:00:00Z',
      form_name: 'Source Document Intake',
      share_token: 'tok_doc',
    }

    const out = adaptResponseToSubmissionRow(row)

    expect(out.source_url).toBe('https://docs.example/leak.pdf') // document_url fallback
    expect(out.content_description).toBe('A leaked memo') // summary fallback
    expect(out.submitter_name).toBeNull()
    expect(out.status).toBe('rejected')
  })
})
