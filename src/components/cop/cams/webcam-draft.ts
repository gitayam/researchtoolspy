import type { CopWebcam } from '@/types/cop'

/** The Add webcam form, kept by CopCamsPanel so it survives picking a point on the map. */
export interface WebcamDraft {
  url: string
  label: string
  lat: string
  lon: string
  bearing: string
  fov: string
}

export const EMPTY_WEBCAM_DRAFT: WebcamDraft = { url: '', label: '', lat: '', lon: '', bearing: '', fov: '' }

/** The Edit webcam form; also kept by CopCamsPanel for picking on the map. */
export interface WebcamEditDraft extends Omit<WebcamDraft, 'url'> {
  /** Where the bearing came from: typed, or an accepted AI estimate. */
  bearingSource: 'user' | 'estimated' | null
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

export function editDraftFrom(cam: CopWebcam): WebcamEditDraft {
  return {
    label: cam.label,
    lat: text(cam.lat),
    lon: text(cam.lon),
    bearing: text(cam.bearing_deg),
    fov: text(cam.fov_deg),
    bearingSource: cam.bearing_deg === null ? null : cam.bearing_source ?? 'user',
  }
}

export type WebcamPatch = {
  label?: string
  lat?: number | null
  lon?: number | null
  bearing_deg?: number | null
  bearing_source?: 'user' | 'estimated'
  fov_deg?: number
}

const sameCoordinate = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 1e-7

/**
 * The PATCH body for what changed between the camera and the edit form, or an
 * error the analyst can fix. An empty body means nothing changed.
 */
export function buildWebcamPatch(cam: CopWebcam, draft: WebcamEditDraft): { patch: WebcamPatch } | { error: string } {
  const patch: WebcamPatch = {}

  const label = draft.label.trim()
  if (!label) return { error: "The label can't be empty." }
  if (label.length > 120) return { error: 'The label can be at most 120 characters.' }
  if (label !== cam.label) patch.label = label

  const latText = draft.lat.trim()
  const lonText = draft.lon.trim()
  if ((latText === '') !== (lonText === '')) return { error: 'Enter both latitude and longitude, or clear both.' }
  if (latText === '') {
    if (cam.lat !== null || cam.lon !== null) {
      patch.lat = null
      patch.lon = null
    }
  } else {
    const lat = Number(latText)
    const lon = Number(lonText)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: 'Latitude must be between -90 and 90.' }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return { error: 'Longitude must be between -180 and 180.' }
    if (!sameCoordinate(lat, cam.lat) || !sameCoordinate(lon, cam.lon)) {
      patch.lat = lat
      patch.lon = lon
    }
  }

  const bearingText = draft.bearing.trim()
  if (bearingText === '') {
    if (cam.bearing_deg !== null) patch.bearing_deg = null
  } else {
    const bearing = Number(bearingText)
    if (!Number.isInteger(bearing) || bearing < 0 || bearing > 359) {
      return { error: 'The bearing must be a whole number of degrees from 0 to 359.' }
    }
    const source = draft.bearingSource ?? 'user'
    if (bearing !== cam.bearing_deg || source !== (cam.bearing_source ?? 'user')) {
      patch.bearing_deg = bearing
      patch.bearing_source = source
    }
  }

  const fovText = draft.fov.trim()
  if (fovText !== '') {
    const fov = Number(fovText)
    if (!Number.isInteger(fov) || fov < 1 || fov > 180) {
      return { error: 'The field of view must be a whole number of degrees from 1 to 180.' }
    }
    if (fov !== cam.fov_deg) patch.fov_deg = fov
  }

  return { patch }
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export function compassPoint(bearing: number): string {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16]
}
