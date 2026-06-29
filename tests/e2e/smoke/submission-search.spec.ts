/**
 * Client-side submissions search helpers (pure-Node, no browser, no HTTP server).
 *
 * Guards E-9a: the Review tab now layers a free-text search on top of the
 * server-side `statusFilter`. `matchesSubmissionSearch` / `filterSubmissions`
 * are the pure core; these tests pin the contract — empty term matches all,
 * case-insensitive substring across source_url / description / metadata.title /
 * submitter_name, and null fields never throw.
 */
import { test, expect } from '@playwright/test'
import {
  matchesSubmissionSearch,
  filterSubmissions,
  type SearchableSubmission,
} from '../../../src/lib/submission-search'

const SUB_URL: SearchableSubmission = {
  source_url: 'https://example.com/Breaking-News',
  content_description: 'A leaked memo about logistics',
  submitter_name: 'Alice Researcher',
  metadata: { title: 'Memo Drop' },
}

const SUB_NULLS: SearchableSubmission = {
  source_url: null,
  content_description: null,
  submitter_name: null,
  metadata: null,
}

test.describe('Submission search helpers @smoke', () => {
  test('@smoke empty / whitespace term matches everything', () => {
    expect(matchesSubmissionSearch(SUB_URL, '')).toBe(true)
    expect(matchesSubmissionSearch(SUB_URL, '   ')).toBe(true)
    expect(matchesSubmissionSearch(SUB_NULLS, '')).toBe(true)
  })

  test('@smoke matches on source_url substring, case-insensitive', () => {
    expect(matchesSubmissionSearch(SUB_URL, 'breaking-news')).toBe(true)
    expect(matchesSubmissionSearch(SUB_URL, 'EXAMPLE.COM')).toBe(true)
  })

  test('@smoke matches on submitter_name', () => {
    expect(matchesSubmissionSearch(SUB_URL, 'alice')).toBe(true)
    expect(matchesSubmissionSearch(SUB_URL, 'Researcher')).toBe(true)
  })

  test('@smoke matches on description and metadata.title', () => {
    expect(matchesSubmissionSearch(SUB_URL, 'logistics')).toBe(true)
    expect(matchesSubmissionSearch(SUB_URL, 'memo drop')).toBe(true)
  })

  test('@smoke returns false when nothing matches', () => {
    expect(matchesSubmissionSearch(SUB_URL, 'zzz-no-match')).toBe(false)
  })

  test('@smoke null/undefined fields never throw and do not match', () => {
    expect(() => matchesSubmissionSearch(SUB_NULLS, 'anything')).not.toThrow()
    expect(matchesSubmissionSearch(SUB_NULLS, 'anything')).toBe(false)
    expect(() => matchesSubmissionSearch({}, 'anything')).not.toThrow()
    expect(matchesSubmissionSearch({}, 'anything')).toBe(false)
  })

  test('@smoke filterSubmissions filters an array correctly', () => {
    const subs: SearchableSubmission[] = [
      SUB_URL,
      { source_url: 'https://other.org/page', content_description: 'unrelated', submitter_name: 'Bob' },
      SUB_NULLS,
    ]
    expect(filterSubmissions(subs, 'alice')).toEqual([SUB_URL])
    expect(filterSubmissions(subs, 'bob')).toHaveLength(1)
  })

  test('@smoke filterSubmissions with empty term returns all', () => {
    const subs: SearchableSubmission[] = [SUB_URL, SUB_NULLS]
    expect(filterSubmissions(subs, '')).toHaveLength(2)
    expect(filterSubmissions(subs, '   ')).toEqual(subs)
  })
})
