/**
 * Research submission-forms API client helper (pure-Node, no browser, no HTTP server).
 *
 * Root cause this guards against (COP-14): the two READ fetches on
 * EvidenceSubmissionsPage (`loadForms`, `loadSubmissions`) sent NO auth headers,
 * while both endpoints hard-401 via `getUserFromRequest`. The page showed
 * "Authentication required" on every load. The fix centralizes request-building
 * in `research-forms-api.ts` and FORWARDS the caller-supplied auth headers; these
 * tests are the regression guard that (a) the auth headers reach the request and
 * (b) a 401 surfaces as a thrown error.
 *
 * The helpers are dependency-injectable (`fetchImpl`) precisely so they can be
 * exercised here with fakes — no `page` fixture, no running server. Mirrors
 * datasets-api.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  RESEARCH_FORMS_LIST_PATH,
  RESEARCH_SUBMISSIONS_LIST_PATH,
  listResearchForms,
  listResearchSubmissions,
  type ResearchFetch,
} from '../../../src/lib/research-forms-api'

/** What a captured `fetchImpl` invocation records (input + the init it received). */
type FetchCall = { input: string; init?: Parameters<ResearchFetch>[1] }

const AUTH_HEADERS = { 'Content-Type': 'application/json', 'X-User-Hash': 'hash1234567890abcd' }

test.describe('Research forms API client helper @smoke', () => {
  test('@smoke endpoint paths are the canonical research list routes (regression guard)', () => {
    expect(RESEARCH_FORMS_LIST_PATH).toBe('/api/research/forms/list')
    expect(RESEARCH_SUBMISSIONS_LIST_PATH).toBe('/api/research/submissions/list')
  })

  test('@smoke listResearchForms GETs the path with workspaceId and FORWARDS auth headers', async () => {
    const calls: FetchCall[] = []
    const fetchImpl: ResearchFetch = async (input, init) => {
      calls.push({ input, init })
      return { ok: true, status: 200, json: async () => ({ success: true, forms: [{ id: 'f1' }], count: 1 }) }
    }

    const data = await listResearchForms({ workspaceId: 'cop-abc', headers: AUTH_HEADERS, fetchImpl })

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe('/api/research/forms/list?workspaceId=cop-abc')
    expect(calls[0].init?.method).toBeUndefined() // GET (no explicit method)
    // The core of COP-14: the injected auth header MUST reach the request, so it won't 401.
    expect(calls[0].init?.headers?.['X-User-Hash']).toBe('hash1234567890abcd')
    expect(data).toEqual({ success: true, forms: [{ id: 'f1' }], count: 1 })
  })

  test('@smoke listResearchForms throws on a 401 so the UI can surface it (the regression)', async () => {
    const fetchImpl: ResearchFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required' }),
    })

    await expect(
      listResearchForms({ workspaceId: 'cop-abc', headers: {}, fetchImpl })
    ).rejects.toThrow(/Authentication required/)
  })

  test('@smoke listResearchSubmissions GETs the path with params and FORWARDS auth headers', async () => {
    const calls: FetchCall[] = []
    const fetchImpl: ResearchFetch = async (input, init) => {
      calls.push({ input, init })
      return { ok: true, status: 200, json: async () => ({ success: true, submissions: [{ id: 's1' }], count: 1 }) }
    }

    const params = new URLSearchParams()
    params.append('status', 'pending')
    const data = await listResearchSubmissions({ params, headers: AUTH_HEADERS, fetchImpl })

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe('/api/research/submissions/list?status=pending')
    expect(calls[0].init?.method).toBeUndefined() // GET
    expect(calls[0].init?.headers?.['X-User-Hash']).toBe('hash1234567890abcd')
    expect(data).toEqual({ success: true, submissions: [{ id: 's1' }], count: 1 })
  })

  test('@smoke listResearchSubmissions throws on a 401 so the UI can surface it (the regression)', async () => {
    const fetchImpl: ResearchFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required' }),
    })

    await expect(
      listResearchSubmissions({ params: new URLSearchParams(), headers: {}, fetchImpl })
    ).rejects.toThrow(/Authentication required/)
  })
})
