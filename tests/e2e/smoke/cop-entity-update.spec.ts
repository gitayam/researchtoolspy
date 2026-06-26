/**
 * COP entity update helper (pure-Node, no browser, no HTTP server).
 *
 * Guards the COP entity drawer's "Edit" button: it must PUT to the correct
 * per-type endpoint (`/api/<type>/<id>`), forward the injected auth headers, send
 * the body, return the parsed entity, and surface the endpoint's error on a
 * non-OK response. The helper is dependency-injectable (`fetchImpl`) precisely so
 * it can be exercised here with fakes — no `page` fixture, no running server.
 * Mirrors datasets-api.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  ENTITY_TYPE_TO_PATH,
  copEntityPath,
  updateCopEntity,
  type CopEntityType,
  type CopEntityFetch,
} from '../../../src/lib/cop-entity-update'

/** What a captured `fetchImpl` invocation records (input + the init it received). */
type FetchCall = { input: string; init?: Parameters<CopEntityFetch>[1] }

const ALL_TYPES: CopEntityType[] = ['actors', 'sources', 'events', 'places', 'behaviors']

test.describe('COP entity update helper @smoke', () => {
  test('@smoke ENTITY_TYPE_TO_PATH maps each drawer type to its route segment', () => {
    expect(ENTITY_TYPE_TO_PATH).toEqual({
      actors: 'actors',
      sources: 'sources',
      events: 'events',
      places: 'places',
      behaviors: 'behaviors',
    })
  })

  test('@smoke copEntityPath builds /api/<type>/<id> for every entity type', () => {
    expect(copEntityPath('actors', 'act-1')).toBe('/api/actors/act-1')
    expect(copEntityPath('sources', 'src-1')).toBe('/api/sources/src-1')
    expect(copEntityPath('events', 'evt-1')).toBe('/api/events/evt-1')
    expect(copEntityPath('places', 'plc-1')).toBe('/api/places/plc-1')
    expect(copEntityPath('behaviors', 'bhv-1')).toBe('/api/behaviors/bhv-1')
  })

  for (const entityType of ALL_TYPES) {
    test(`@smoke updateCopEntity PUTs ${entityType} to /api/${entityType}/<id> and forwards headers + body`, async () => {
      const calls: FetchCall[] = []
      const fetchImpl: CopEntityFetch = async (input, init) => {
        calls.push({ input, init })
        return { ok: true, status: 200, json: async () => ({ id: 'ent-1', name: 'Updated' }) }
      }

      const body = { name: 'Updated', description: 'desc' }
      const data = await updateCopEntity({
        entityType,
        id: 'ent-1',
        body,
        headers: { 'X-User-Hash': 'hash1234567890abcd', 'Content-Type': 'application/json' },
        fetchImpl,
      })

      expect(calls).toHaveLength(1)
      // Correct path for this entity type.
      expect(calls[0].input).toBe(`/api/${entityType}/ent-1`)
      // Uses PUT, not POST.
      expect(calls[0].init?.method).toBe('PUT')
      // Forwards the injected auth header.
      expect(calls[0].init?.headers?.['X-User-Hash']).toBe('hash1234567890abcd')
      // Sends the body as JSON.
      expect(calls[0].init?.body).toBe(JSON.stringify(body))
      // Returns parsed data.
      expect(data).toEqual({ id: 'ent-1', name: 'Updated' })
    })
  }

  test('@smoke updateCopEntity surfaces the endpoint error message on a 400', async () => {
    const fetchImpl: CopEntityFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'No fields to update' }),
    })

    await expect(
      updateCopEntity({
        entityType: 'places',
        id: 'plc-1',
        body: {},
        headers: {},
        fetchImpl,
      })
    ).rejects.toThrow(/No fields to update/)
  })

  test('@smoke updateCopEntity throws on a 401 so the UI can surface auth failures', async () => {
    const fetchImpl: CopEntityFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required' }),
    })

    await expect(
      updateCopEntity({
        entityType: 'actors',
        id: 'act-1',
        body: { name: 'x' },
        headers: {},
        fetchImpl,
      })
    ).rejects.toThrow(/Authentication required/)
  })

  test('@smoke updateCopEntity falls back to a generic message when the error body is not JSON', async () => {
    const fetchImpl: CopEntityFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(
      updateCopEntity({
        entityType: 'sources',
        id: 'src-1',
        body: { name: 'x' },
        headers: {},
        fetchImpl,
      })
    ).rejects.toThrow(/HTTP 500/)
  })
})
