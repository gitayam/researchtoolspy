import {
  PRODUCT_ANALYTICS_SCHEMA_VERSION,
  classifyProductApi,
  type ProductAction,
  type ProductEventName,
  type ProductFeature,
} from '../../../src/lib/product-analytics-contract'
import type { AnalyticsEngineLike } from './scrape-metrics'

export type ProductActorType = 'guest' | 'authenticated' | 'service' | 'synthetic'
export type ProductOutcome = 'accepted' | 'succeeded' | 'rejected' | 'unauthorized' | 'rate_limited' | 'failed'
export type ProductStatusClass = 'none' | '2xx' | '3xx' | '4xx' | '5xx'

export interface ProductAnalyticsEnv {
  PRODUCT_ANALYTICS?: AnalyticsEngineLike
  PRODUCT_TELEMETRY_KEY?: string
}

interface ProductActorCandidate {
  type: ProductActorType
  identity: string
}

export interface ProductMetricInput {
  event: ProductEventName
  feature: ProductFeature
  action: ProductAction
  surface: 'browser' | 'api'
  actorType: ProductActorType
  actorId: string
  outcome: ProductOutcome
  statusClass: ProductStatusClass
  method: 'none' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'other'
  durationMs?: number
  status?: number
}

const SYNTHETIC_USER_AGENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ResearchTools-[A-Za-z0-9_-]*(?:Probe|Smoke|Synthetic)/i, 'researchtools-check'],
  [/HeadlessChrome/i, 'headless-chrome'],
  [/Playwright/i, 'playwright'],
]

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function keyedActorId(key: string, actor: ProductActorCandidate): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const bytes = new TextEncoder().encode(`product-actor-v1\0${actor.type}\0${actor.identity}`)
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, bytes))
}

function jwtSubject(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { sub?: unknown }
    const subject = typeof payload.sub === 'string' || typeof payload.sub === 'number' ? String(payload.sub) : ''
    return subject.length > 0 && subject.length <= 128 ? subject : null
  } catch {
    return null
  }
}

function syntheticIdentity(request: Request, serviceIdentity?: string | null): string | null {
  const userAgent = request.headers.get('User-Agent') || ''
  for (const [pattern, family] of SYNTHETIC_USER_AGENTS) {
    if (pattern.test(userAgent)) return serviceIdentity ? `${family}:${serviceIdentity}` : family
  }
  return null
}

/**
 * Resolve a stable analytics identity without storing the credential itself.
 * Synthetic checks take precedence so release probes never inflate service use.
 */
export function productActorCandidate(
  request: Request,
  serviceIdentity?: string | null,
): ProductActorCandidate | null {
  const synthetic = syntheticIdentity(request, serviceIdentity)
  if (synthetic) return { type: 'synthetic', identity: synthetic }
  if (serviceIdentity) return { type: 'service', identity: serviceIdentity }

  const guest = request.headers.get('X-Guest-Session')?.trim() || ''
  if (/^guest_[A-Za-z0-9-]{16,96}$/.test(guest)) return { type: 'guest', identity: guest }

  const userHash = request.headers.get('X-User-Hash')?.trim() || ''
  if (userHash !== 'default' && userHash.length >= 16 && userHash.length <= 256) {
    return { type: 'authenticated', identity: userHash }
  }

  const authorization = request.headers.get('Authorization') || ''
  const bearer = /^\s*Bearer\s+([^\s]+)\s*$/i.exec(authorization)?.[1]
  if (!bearer || bearer.startsWith('rt_svc_') || bearer.length > 4096) return null
  return { type: 'authenticated', identity: jwtSubject(bearer) || bearer }
}

export async function buildProductActor(
  request: Request,
  telemetryKey: string | null | undefined,
  serviceIdentity?: string | null,
): Promise<{ type: ProductActorType; id: string } | null> {
  if (!telemetryKey || telemetryKey.trim().length < 32) return null
  const actor = productActorCandidate(request, serviceIdentity)
  if (!actor) return null
  return { type: actor.type, id: await keyedActorId(telemetryKey, actor) }
}

function normalizedMethod(method: string): ProductMetricInput['method'] {
  const upper = method.toUpperCase()
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(upper)
    ? upper as ProductMetricInput['method']
    : 'other'
}

export function statusClass(status: number): ProductStatusClass {
  if (status >= 200 && status < 300) return '2xx'
  if (status >= 300 && status < 400) return '3xx'
  if (status >= 400 && status < 500) return '4xx'
  if (status >= 500 && status < 600) return '5xx'
  return 'none'
}

export function outcomeFromStatus(status: number): ProductOutcome {
  if (status === 429) return 'rate_limited'
  if (status === 401 || status === 403) return 'unauthorized'
  if (status >= 200 && status < 400) return 'succeeded'
  if (status >= 400 && status < 500) return 'rejected'
  return 'failed'
}

export function writeProductMetric(binding: AnalyticsEngineLike | null | undefined, metric: ProductMetricInput): boolean {
  if (!binding || !/^[a-f0-9]{64}$/.test(metric.actorId)) return false
  try {
    binding.writeDataPoint({
      indexes: [metric.actorId],
      blobs: [
        PRODUCT_ANALYTICS_SCHEMA_VERSION,
        metric.event,
        metric.feature,
        metric.action,
        metric.surface,
        metric.actorType,
        metric.outcome,
        metric.statusClass,
        metric.method,
      ],
      doubles: [
        1,
        Number.isFinite(metric.durationMs) && Number(metric.durationMs) >= 0 ? Number(metric.durationMs) : 0,
        Number.isFinite(metric.status) ? Number(metric.status) : 0,
      ],
    })
    return true
  } catch {
    return false
  }
}

/** Record one classified API outcome. Missing identity/configuration is a no-op. */
export async function recordProductApiRequest(options: {
  request: Request
  responseStatus: number
  durationMs: number
  env: ProductAnalyticsEnv
  serviceIdentity?: string | null
}): Promise<boolean> {
  try {
    const url = new URL(options.request.url)
    const classification = classifyProductApi(url.pathname, options.request.method)
    if (!classification) return false
    const actor = await buildProductActor(
      options.request,
      options.env.PRODUCT_TELEMETRY_KEY,
      options.serviceIdentity,
    )
    if (!actor) return false
    return writeProductMetric(options.env.PRODUCT_ANALYTICS, {
      event: 'api_request',
      ...classification,
      surface: 'api',
      actorType: actor.type,
      actorId: actor.id,
      outcome: outcomeFromStatus(options.responseStatus),
      statusClass: statusClass(options.responseStatus),
      method: normalizedMethod(options.request.method),
      durationMs: options.durationMs,
      status: options.responseStatus,
    })
  } catch {
    return false
  }
}
