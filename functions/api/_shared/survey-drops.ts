/**
 * Survey Drops — shared helpers for access control, geo-gating, rate limiting, dedup
 */

// Hex encode a Uint8Array
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate a random salt
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Hash a password using PBKDF2 with a random 16-byte salt.
 * Returns "salt:hash" format (both hex-encoded).
 * Workers-compatible via crypto.subtle.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = generateSalt()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial, 256
  )
  return `${toHex(salt)}:${toHex(new Uint8Array(derived))}`
}

/**
 * Verify a password against a stored "salt:hash" string.
 * Uses constant-time comparison via HMAC to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHex] = storedHash.split(':')
  if (!saltHex || !expectedHex) return false

  const encoder = new TextEncoder()
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial, 256
  )
  const candidateHex = toHex(new Uint8Array(derived))

  // Constant-time comparison via HMAC: compute HMAC of both with same random key
  const hmacKey = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const [sig1, sig2] = await Promise.all([
    crypto.subtle.sign('HMAC', hmacKey, encoder.encode(candidateHex)),
    crypto.subtle.sign('HMAC', hmacKey, encoder.encode(expectedHex)),
  ])
  const a = new Uint8Array(sig1)
  const b = new Uint8Array(sig2)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// SHA-256 digest for non-password use (IP hashing, content dedup)
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hash))
}

// Privacy-preserving IP hash for rate limiting (salted with form ID)
export async function hashSubmitterIP(ip: string, formId: string): Promise<string> {
  return sha256(`${ip}:${formId}`)
}

// Content hash for dedup (sort keys for consistency)
export async function hashFormData(formData: Record<string, unknown>): Promise<string> {
  const sorted = JSON.stringify(formData, Object.keys(formData).sort())
  return sha256(sorted)
}

/**
 * @deprecated Use checkSurveyResponseRateLimit instead. This function is retained
 * for the legacy COP intake endpoint but now queries survey_responses (data was migrated).
 */
export async function checkSubmitRateLimit(
  db: D1Database,
  formId: string,
  ipHash: string,
  limitPerHour: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (limitPerHour <= 0) return { allowed: true, remaining: -1 }

  const result = await db.prepare(
    `SELECT COUNT(*) as cnt FROM survey_responses
     WHERE survey_id = ? AND submitter_ip_hash = ?
     AND created_at > datetime('now', '-1 hour')`
  ).bind(formId, ipHash).first<{ cnt: number }>()

  const count = result?.cnt ?? 0
  return {
    allowed: count < limitPerHour,
    remaining: Math.max(0, limitPerHour - count),
  }
}

// Extract geo info from Cloudflare request headers/cf object
export function extractGeoFromRequest(request: Request): {
  country: string | null
  city: string | null
  lat: number | null
  lon: number | null
} {
  const cf = (request as any).cf
  return {
    country: cf?.country || request.headers.get('CF-IPCountry') || null,
    city: cf?.city || null,
    lat: cf?.latitude ? Number(cf.latitude) : null,
    lon: cf?.longitude ? Number(cf.longitude) : null,
  }
}

// Check if submitter's country is in the allowed list
export function isCountryAllowed(
  allowedCountries: string[],
  submitterCountry: string | null
): boolean {
  // Empty list = no restriction
  if (!allowedCountries || allowedCountries.length === 0) return true
  // No country detected (local dev) = allow
  if (!submitterCountry) return true
  return allowedCountries.includes(submitterCountry.toUpperCase())
}

// D1-based rate limit check for survey_responses table
export async function checkSurveyResponseRateLimit(
  db: D1Database,
  surveyId: string,
  ipHash: string,
  limitPerHour: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (limitPerHour <= 0) return { allowed: true, remaining: -1 }

  const result = await db.prepare(
    `SELECT COUNT(*) as cnt FROM survey_responses
     WHERE survey_id = ? AND submitter_ip_hash = ?
     AND created_at > datetime('now', '-1 hour')`
  ).bind(surveyId, ipHash).first<{ cnt: number }>()

  const count = result?.cnt ?? 0
  return {
    allowed: count < limitPerHour,
    remaining: Math.max(0, limitPerHour - count),
  }
}

// Validate access_level
const VALID_ACCESS_LEVELS = ['public', 'password', 'internal'] as const
export type AccessLevel = typeof VALID_ACCESS_LEVELS[number]

export function isValidAccessLevel(level: string): level is AccessLevel {
  return (VALID_ACCESS_LEVELS as readonly string[]).includes(level)
}

// Validate custom slug format (lowercase alphanumeric + hyphens, 3-50 chars)
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)
}
