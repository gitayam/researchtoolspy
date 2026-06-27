/**
 * COP persona update / soft-delete helper (pure-Node, no browser, no HTTP server).
 *
 * Guards the persona panel's "Edit" and "Delete" controls. Both reuse the
 * endpoint's single action-routed POST (`/api/cop/<sessionId>/personas`): an
 * `{ id, ... }` body performs the UPDATE, and the soft-delete sends
 * `{ id, status: 'deleted' }` down that same path (the schema enum includes
 * 'deleted', so no hard DELETE). The helpers forward the injected auth headers,
 * send the body, return the parsed response, and surface the endpoint's error on
 * a non-OK response. Dependency-injectable (`fetchImpl`) so it runs here with
 * fakes — no `page` fixture, no running server. Mirrors cop-entity-update.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  PERSONA_DELETED_STATUS,
  copPersonaPath,
  updateCopPersona,
  deleteCopPersona,
  type CopPersonaFetch,
} from '../../../src/lib/cop-persona-api'

/** What a captured `fetchImpl` invocation records (input + the init it received). */
type FetchCall = { input: string; init?: Parameters<CopPersonaFetch>[1] }

test.describe('COP persona update/delete helper @smoke', () => {
  test('@smoke copPersonaPath builds /api/cop/<sessionId>/personas', () => {
    expect(copPersonaPath('cop-abc')).toBe('/api/cop/cop-abc/personas')
  })

  test('@smoke updateCopPersona POSTs { id, ...body } to the personas endpoint and forwards headers', async () => {
    const calls: FetchCall[] = []
    const fetchImpl: CopPersonaFetch = async (input, init) => {
      calls.push({ input, init })
      return { ok: true, status: 200, json: async () => ({ id: 'per-1', message: 'Persona updated' }) }
    }

    const body = { display_name: 'Renamed', platform: 'telegram', notes: 'updated' }
    const data = await updateCopPersona({
      sessionId: 'cop-abc',
      id: 'per-1',
      body,
      headers: { 'X-User-Hash': 'hash1234567890abcd', 'Content-Type': 'application/json' },
      fetchImpl,
    })

    expect(calls).toHaveLength(1)
    // Correct action-routed endpoint (no per-id URL segment).
    expect(calls[0].input).toBe('/api/cop/cop-abc/personas')
    // The endpoint routes an UPDATE off a POST whose body carries `id`.
    expect(calls[0].init?.method).toBe('POST')
    // Forwards the injected auth header.
    expect(calls[0].init?.headers?.['X-User-Hash']).toBe('hash1234567890abcd')
    // Body merges the id with the update fields.
    expect(calls[0].init?.body).toBe(JSON.stringify({ id: 'per-1', ...body }))
    // Returns parsed data.
    expect(data).toEqual({ id: 'per-1', message: 'Persona updated' })
  })

  test('@smoke updateCopPersona surfaces the endpoint error message on a 400', async () => {
    const fetchImpl: CopPersonaFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'No valid fields to update' }),
    })

    await expect(
      updateCopPersona({
        sessionId: 'cop-abc',
        id: 'per-1',
        body: {},
        headers: {},
        fetchImpl,
      })
    ).rejects.toThrow(/No valid fields to update/)
  })

  test('@smoke deleteCopPersona issues the soft-delete (POST { id, status: deleted })', async () => {
    const calls: FetchCall[] = []
    const fetchImpl: CopPersonaFetch = async (input, init) => {
      calls.push({ input, init })
      return { ok: true, status: 200, json: async () => ({ id: 'per-1', message: 'Persona updated' }) }
    }

    const data = await deleteCopPersona({
      sessionId: 'cop-abc',
      id: 'per-1',
      headers: { 'X-User-Hash': 'hash1234567890abcd', 'Content-Type': 'application/json' },
      fetchImpl,
    })

    expect(calls).toHaveLength(1)
    // Soft delete reuses the same action-routed update path.
    expect(calls[0].input).toBe('/api/cop/cop-abc/personas')
    expect(calls[0].init?.method).toBe('POST')
    // Forwards the injected auth header.
    expect(calls[0].init?.headers?.['X-User-Hash']).toBe('hash1234567890abcd')
    // Soft-delete body sets status to 'deleted' (not a hard DELETE).
    expect(PERSONA_DELETED_STATUS).toBe('deleted')
    expect(calls[0].init?.body).toBe(JSON.stringify({ id: 'per-1', status: 'deleted' }))
    // Returns parsed data.
    expect(data).toEqual({ id: 'per-1', message: 'Persona updated' })
  })

  test('@smoke deleteCopPersona throws on a non-OK response', async () => {
    const fetchImpl: CopPersonaFetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Persona not found in this session' }),
    })

    await expect(
      deleteCopPersona({
        sessionId: 'cop-abc',
        id: 'per-missing',
        headers: {},
        fetchImpl,
      })
    ).rejects.toThrow(/Persona not found in this session/)
  })

  test('@smoke deleteCopPersona falls back to a generic message when the error body is not JSON', async () => {
    const fetchImpl: CopPersonaFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(
      deleteCopPersona({
        sessionId: 'cop-abc',
        id: 'per-1',
        headers: {},
        fetchImpl,
      })
    ).rejects.toThrow(/HTTP 500/)
  })
})
