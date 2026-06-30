/**
 * Geo-extraction helpers for submission reviewer map tab (E-9b).
 *
 * Pure, dependency-free — no imports from React or the DOM — so the helpers
 * can be unit-tested in plain Node/Playwright without a browser.
 *
 * The `form_data` JSON (surfaced as `metadata` on the reviewer Submission
 * shape) may contain:
 *  - `latitude` / `longitude` (separate numeric-or-string fields)
 *  - `lat` / `lng` (short aliases)
 *  - `location` — a "lat,lng" comma-separated string OR {lat,lng}/{latitude,longitude} object
 *
 * `_enriched_*` keys are stripped before metadata reaches the reviewer UI
 * (privacy rule in systema-adapter), so they are not available here.
 */

/** A validated geographic point ready to render as a map pin. */
export interface GeoPoint {
  lat: number
  lng: number
  /** Human-readable label for the pin popup (never empty). */
  label: string
}

// ── Validation ────────────────────────────────────────────────────────────────

/** Returns true if `n` is a finite number within the latitude range [-90, 90]. */
function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90
}

/** Returns true if `n` is a finite number within the longitude range [-180, 180]. */
function isValidLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180
}

/** Parse a value that may be a numeric string or number. Returns NaN on failure. */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.trim())
    return n
  }
  return NaN
}

// ── Coordinate extraction ─────────────────────────────────────────────────────

/**
 * Try to pull a lat/lng pair out of an arbitrary metadata object.
 * Returns `[lat, lng]` if found and valid, otherwise `null`.
 */
function extractCoords(data: Record<string, unknown>): [number, number] | null {
  // 1. Explicit separate lat/lng fields
  const latKeys = ['latitude', 'lat']
  const lngKeys = ['longitude', 'lng', 'lon']

  for (const latKey of latKeys) {
    for (const lngKey of lngKeys) {
      if (latKey in data && lngKey in data) {
        const lat = toNumber(data[latKey])
        const lng = toNumber(data[lngKey])
        if (isValidLat(lat) && isValidLng(lng)) return [lat, lng]
      }
    }
  }

  // 2. `location` field — string "lat,lng" or object with lat/lng
  if ('location' in data) {
    const loc = data['location']

    // 2a. Comma-separated string "37.5,-122.1"
    if (typeof loc === 'string') {
      const parts = loc.split(',')
      if (parts.length === 2) {
        const lat = toNumber(parts[0])
        const lng = toNumber(parts[1])
        if (isValidLat(lat) && isValidLng(lng)) return [lat, lng]
      }
    }

    // 2b. Object with lat/lng or latitude/longitude keys
    if (loc !== null && typeof loc === 'object' && !Array.isArray(loc)) {
      const obj = loc as Record<string, unknown>
      for (const latKey of latKeys) {
        for (const lngKey of lngKeys) {
          if (latKey in obj && lngKey in obj) {
            const lat = toNumber(obj[latKey])
            const lng = toNumber(obj[lngKey])
            if (isValidLat(lat) && isValidLng(lng)) return [lat, lng]
          }
        }
      }
    }
  }

  return null
}

// ── Submission type (minimal structural interface) ────────────────────────────

/** Minimal structural interface — the page's richer `Submission` type satisfies it. */
export interface GeoSearchableSubmission {
  source_url?: string | null
  content_description?: string | null
  submitter_name?: string | null
  metadata?: Record<string, unknown> | null
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract a geographic point from a submission's metadata.
 *
 * Returns a `GeoPoint` (with a human-readable label) if the metadata contains
 * valid lat/lng data, or `null` if none can be found.
 *
 * Strict: both lat and lng must be finite and within the valid WGS-84 range.
 */
export function extractSubmissionGeo(sub: GeoSearchableSubmission): GeoPoint | null {
  const data = sub.metadata
  if (!data || typeof data !== 'object') return null

  const coords = extractCoords(data)
  if (!coords) return null

  const [lat, lng] = coords

  // Build a label from whatever identifying info is available.
  const label =
    (sub.metadata?.title as string | undefined) ||
    sub.source_url ||
    sub.content_description?.slice(0, 60) ||
    sub.submitter_name ||
    `${lat.toFixed(4)}, ${lng.toFixed(4)}`

  return { lat, lng, label: String(label) }
}

/**
 * Filter an array of submissions to only those that have extractable geo data,
 * returning each paired with its resolved `GeoPoint`.
 */
export function filterGeoSubmissions<T extends GeoSearchableSubmission>(
  subs: T[],
): Array<{ submission: T; point: GeoPoint }> {
  const result: Array<{ submission: T; point: GeoPoint }> = []
  for (const sub of subs) {
    const point = extractSubmissionGeo(sub)
    if (point) result.push({ submission: sub, point })
  }
  return result
}
