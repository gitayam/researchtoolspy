import { getCopHeaders } from './cop-auth'
import { decodeTimelinePresentation, type TimelinePresentation } from './timeline-presentation-contract'

export interface PresentationLink { token: string; createdAt: string; revoked: false }
export interface ListedPresentation { token: string; createdAt: string; title: string }
export interface PresentationAttempt { key: string; body: string }
const tokenPattern = /^[a-f0-9]{64}$/
const limit = 512 * 1024
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key)))
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const validToken = (value: unknown): value is string => typeof value === 'string' && tokenPattern.test(value)
export const presentationLinkUrl = (token: string) => {
  if (!validToken(token)) throw new Error('The presentation link is invalid.')
  return `${window.location.origin}/present/${token}`
}
function humanHeaders(): Record<string, string> {
  const all = getCopHeaders(), result: Record<string, string> = { 'Content-Type': 'application/json' }
  if (all['X-User-Hash']) result['X-User-Hash'] = all['X-User-Hash']
  if (all.Authorization) result.Authorization = all.Authorization
  if (!result['X-User-Hash'] && !result.Authorization) throw new Error('Sign in to manage presentation links.')
  return result
}
async function json(response: Response): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) { await response.body?.cancel(); throw new Error('The presentation response could not be read.') }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The presentation response could not be read.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) throw new Error('The presentation exceeds the supported size.'); chunks.push(value) }
  } catch (error) { await reader.cancel(); throw error } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new Error('The presentation response could not be read.') }
}
async function request(path: string, method: string, signal: AbortSignal, attempt?: PresentationAttempt, anonymous = false): Promise<Response> {
  const headers = anonymous ? undefined : humanHeaders()
  if (attempt && headers) headers['Idempotency-Key'] = attempt.key
  const response = await fetch(path, { method, headers, body: attempt?.body, signal, cache: 'no-store', credentials: anonymous ? 'omit' : 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer' })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(response.status === 404 ? 'This presentation is unavailable.' : response.status === 401 || response.status === 403 ? 'Sign in with an active account to manage these links.' : response.status === 409 ? 'This publication cannot be retried. Reopen the export preview and review the presentation again.' : response.status === 413 ? 'This presentation is too large to share.' : 'The request could not be confirmed. You can retry.')
  }
  return response
}
export function preparePresentation(timeline: unknown): PresentationAttempt {
  const presentation = decodeTimelinePresentation({ schemaVersion: 'timeline-presentation.v1', timeline })
  return { key: crypto.randomUUID(), body: JSON.stringify(presentation) }
}
export async function publishPresentation(attempt: PresentationAttempt, signal: AbortSignal): Promise<PresentationLink> {
  const response = await request('/api/timeline-presentations', 'POST', signal, attempt)
  if (![200, 201].includes(response.status)) { await response.body?.cancel(); throw new Error('The publication response is invalid.') }
  const value = await json(response)
  if (!exact(value, ['schemaVersion', 'token', 'createdAt', 'revoked']) || value.schemaVersion !== 'timeline-presentation-link.v1' || !validToken(value.token) || !timestamp(value.createdAt) || value.revoked !== false) throw new Error('The publication response is invalid. Retry to recover the same link.')
  return { token: value.token, createdAt: value.createdAt, revoked: false }
}
export async function listPresentations(signal: AbortSignal): Promise<ListedPresentation[]> {
  const response = await request('/api/timeline-presentations', 'GET', signal)
  if (response.status !== 200) { await response.body?.cancel(); throw new Error('The link list is invalid.') }
  const value = await json(response)
  if (!exact(value, ['schemaVersion', 'links']) || value.schemaVersion !== 'timeline-presentation-links.v1' || !Array.isArray(value.links) || value.links.length > 20) throw new Error('The link list is invalid.')
  const seen = new Set<string>()
  return value.links.map(item => {
    if (!exact(item, ['token', 'createdAt', 'title']) || !validToken(item.token) || !timestamp(item.createdAt) || typeof item.title !== 'string' || Array.from(item.title).length > 200 || seen.has(item.token)) throw new Error('The link list is invalid.')
    seen.add(item.token); return { token: item.token, createdAt: item.createdAt, title: item.title }
  })
}
export async function revokePresentation(token: string, signal: AbortSignal): Promise<void> {
  if (!validToken(token)) throw new Error('The presentation link is invalid.')
  const response = await request(`/api/timeline-presentations/${token}`, 'DELETE', signal)
  if (response.status !== 204) { await response.body?.cancel(); throw new Error('Revocation could not be confirmed.') }
}
export async function readPresentation(token: string, signal: AbortSignal): Promise<TimelinePresentation> {
  if (!validToken(token)) throw new Error('This presentation is unavailable.')
  const response = await request(`/api/timeline-presentations/${token}`, 'GET', signal, undefined, true)
  if (response.status !== 200) { await response.body?.cancel(); throw new Error('This presentation is unavailable.') }
  return decodeTimelinePresentation(await json(response))
}
