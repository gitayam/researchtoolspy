/**
 * Datasets API client helper (pure-Node, no browser, no HTTP server).
 *
 * Root cause this guards against: the frontend called the SINGULAR
 * `fetch('/api/dataset')`, but the only Pages Function is the PLURAL
 * `functions/api/datasets.ts` (→ `/api/datasets`). Cloudflare Pages Functions
 * use exact file-based routing, so `/api/dataset` returned 404 and the Datasets
 * feature silently failed. The path now lives in one place
 * (`DATASETS_API_PATH`); these tests are the regression guard against the
 * singular typo drifting back in.
 *
 * The helpers are dependency-injectable (`fetchImpl`) precisely so they can be
 * exercised here with fakes — no `page` fixture, no running server. Mirrors
 * cot-export.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  DATASETS_API_PATH,
  listDatasets,
  createDataset,
  type DatasetsFetch,
} from '../../../src/lib/datasets-api'

/** What a captured `fetchImpl` invocation records (input + the init it received). */
type FetchCall = { input: string; init?: Parameters<DatasetsFetch>[1] }

test.describe('Datasets API client helper @smoke', () => {
  test('@smoke DATASETS_API_PATH is the plural /api/datasets (regression guard)', () => {
    expect(DATASETS_API_PATH).toBe('/api/datasets')
  })

  test('@smoke listDatasets GETs the plural path and returns parsed data', async () => {
    const calls: FetchCall[] = []
    const fetchImpl: DatasetsFetch = async (input, init) => {
      calls.push({ input, init })
      return { ok: true, status: 200, json: async () => ({ dataset: [{ id: 1, title: 'A' }] }) }
    }

    const data = await listDatasets({ headers: { 'X-User-Hash': 'hash1234567890abcd' }, fetchImpl })

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe('/api/datasets')
    expect(calls[0].init?.method).toBeUndefined() // GET (no explicit method)
    expect(data).toEqual({ dataset: [{ id: 1, title: 'A' }] })
  })

  test('@smoke listDatasets throws on a non-OK response so the UI can surface it', async () => {
    const fetchImpl: DatasetsFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    })

    await expect(
      listDatasets({ headers: {}, fetchImpl })
    ).rejects.toThrow(/500/)
  })

  test('@smoke createDataset POSTs the body to the plural path and returns parsed data', async () => {
    const calls: FetchCall[] = []
    const fetchImpl: DatasetsFetch = async (input, init) => {
      calls.push({ input, init })
      return { ok: true, status: 201, json: async () => ({ id: 42, message: 'Dataset created successfully' }) }
    }

    const payload = { title: 'New', type: 'document', source_name: 'src' }
    const data = await createDataset({ headers: { 'X-User-Hash': 'hash1234567890abcd' }, body: payload, fetchImpl })

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe('/api/datasets')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls[0].init?.body).toBe(JSON.stringify(payload))
    expect(data).toEqual({ id: 42, message: 'Dataset created successfully' })
  })

  test('@smoke createDataset throws on a non-OK response so the UI can surface it', async () => {
    const fetchImpl: DatasetsFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required' }),
    })

    await expect(
      createDataset({ headers: {}, body: { title: 'x' }, fetchImpl })
    ).rejects.toThrow(/401/)
  })
})
