/**
 * Webcam route calls that keep the server's error `code` beside its message, so
 * the dialogs can say what went wrong and what to do next.
 */

import { getCopHeaders } from '@/lib/cop-auth'
import type { CopWebcamErrorCode } from '@/types/cop'

export type CamResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: CopWebcamErrorCode | null; error: string | null }

export async function camRequest<T>(
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<CamResult<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: getCopHeaders(),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    return { ok: false, status: 0, code: null, error: null }
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: typeof json?.code === 'string' ? (json.code as CopWebcamErrorCode) : null,
      error: typeof json?.error === 'string' ? json.error : null,
    }
  }
  return { ok: true, data: (json ?? {}) as T }
}

/** What to tell the analyst when a camera search fails. */
export function nearbyErrorMessage(
  failure: { status: number; code: CopWebcamErrorCode | null; error: string | null },
  fromUrl: boolean,
): string {
  switch (failure.code) {
    case 'WEBCAM_DISCOVERY_UNAVAILABLE':
      return "Webcam search isn't enabled on this server yet. You can still paste a camera link with Add webcam."
    case 'PLACE_NOT_FOUND':
      return fromUrl
        ? "Couldn't tell which place that page is about. Type a place name instead."
        : "Couldn't find that place. Try a more specific name, such as a town and its country."
    case 'GEOCODER_UNAVAILABLE':
      return 'Place search is unavailable right now. Try again shortly, or leave the place blank to search around the map center.'
    case 'WEBCAM_NO_CENTER':
      return 'This COP has no map center yet. Type a place to search near.'
    case 'RATE_LIMITED':
      return 'Too many searches in a short time. Wait a few minutes and try again.'
    case 'WINDY_ERROR':
      return "Windy didn't answer. Try again in a moment."
    case 'AI_UNAVAILABLE':
      return 'The AI step is unavailable right now. Type a place name instead.'
  }
  if (failure.status === 0) return 'The search could not reach the server. Check your connection and try again.'
  if (failure.status === 401) return 'Sign in again to search for cameras.'
  if (failure.status === 403) return 'Only the session owner or an editor can search for cameras.'
  if (failure.status === 404 || failure.status === 405) return "Webcam search isn't available on this server yet."
  return failure.error ?? `The search failed (HTTP ${failure.status}).`
}

/** What to tell the analyst when a direction estimate fails. */
export function estimateErrorMessage(failure: { status: number; code: CopWebcamErrorCode | null; error: string | null }): string {
  switch (failure.code) {
    case 'WEBCAM_NO_POSITION':
      return 'The camera needs a saved position first: set its latitude and longitude, save, then estimate.'
    case 'NO_VIEW_TARGET':
      return "Couldn't tell what this camera faces from its title. Set the bearing by hand."
    case 'AI_UNAVAILABLE':
      return 'The AI step is unavailable right now. Set the bearing by hand.'
    case 'GEOCODER_UNAVAILABLE':
      return 'Place search is unavailable right now. Try again shortly.'
    case 'RATE_LIMITED':
      return 'Too many requests in a short time. Wait a few minutes and try again.'
  }
  if (failure.status === 0) return 'Could not reach the server. Check your connection and try again.'
  if (failure.status === 403) return 'Only the session owner or an editor can estimate a direction.'
  if (failure.status === 404 || failure.status === 405) return "Direction estimates aren't available on this server yet."
  return failure.error ?? `The estimate failed (HTTP ${failure.status}).`
}

/** A Windy link the server can complete from Windy's own title and position. */
export function looksLikeWindyLink(url: string): boolean {
  const value = url.trim().toLowerCase()
  return /^windy:\d{6,12}$/.test(value) || /^https:\/\/(?:www\.|webcams\.)?windy\.com\//.test(value)
}

/** https URLs on windy.com or one of its subdomains (Windy's own image hosts). */
export function isWindyHttpsUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false
    return parsed.hostname === 'windy.com' || parsed.hostname.endsWith('.windy.com')
  } catch {
    return false
  }
}

export function isHttpsUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
