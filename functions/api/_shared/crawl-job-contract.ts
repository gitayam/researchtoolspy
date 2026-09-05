import {
  parseSafeOutboundUrl,
} from './safe-fetch'
import type {
  NormalizedScrapeError,
  ScrapeStrategy,
} from './scrape-contract'

export const CRAWL_JOB_SCHEMA_VERSION = 'crawl.job.v1' as const
export const CRAWL_REQUEST_SCHEMA_VERSION = 'crawl.request.v1' as const

export type CrawlPurpose = 'search' | 'ai-input'
export type CrawlJobStatus = 'queued' | 'running' | 'partial' | 'succeeded' | 'failed' | 'cancelled' | 'expired'
export type CrawlRequestStatus = 'pending' | 'leased' | 'succeeded' | 'failed' | 'skipped' | 'cancelled'

export interface CrawlLimitsV1 {
  maxPages: number
  maxDepth: number
  maxResponseBytes: number
  maxDurationMs: number
  maxBrowserSeconds: number
  maxCostUsd: number
}

export interface CrawlJobV1 {
  schemaVersion: typeof CRAWL_JOB_SCHEMA_VERSION
  id: string
  requestedBy: number
  workspaceId: string
  purpose: CrawlPurpose
  seedUrl: string
  allowedDomains: readonly string[]
  includeSubdomains: boolean
  status: CrawlJobStatus
  limits: CrawlLimitsV1
  createdAt: string
  updatedAt: string
  expiresAt: string
  cancelRequestedAt?: string
}

export interface CrawlRequestV1 {
  schemaVersion: typeof CRAWL_REQUEST_SCHEMA_VERSION
  id: string
  jobId: string
  canonicalUrl: string
  uniqueKey: string
  parentRequestId?: string
  depth: number
  domainKey: string
  strategy: ScrapeStrategy
  status: CrawlRequestStatus
  attemptCount: number
  maxAttempts: number
  availableAt: string
  leaseToken?: string
  leasedAt?: string
  leaseExpiresAt?: string
  finalUrl?: string
  errorCode?: NormalizedScrapeError
  contentHash?: string
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const JOB_STATUSES = new Set<CrawlJobStatus>(['queued', 'running', 'partial', 'succeeded', 'failed', 'cancelled', 'expired'])
const REQUEST_STATUSES = new Set<CrawlRequestStatus>(['pending', 'leased', 'succeeded', 'failed', 'skipped', 'cancelled'])
const STRATEGIES = new Set<ScrapeStrategy>(['direct', 'browser-renderer', 'provider', 'archive', 'supplied', 'cache'])
const ERROR_CODES = new Set<NormalizedScrapeError>([
  'invalid_request', 'policy_denied', 'dns_denied', 'timeout', 'redirect_limit',
  'response_too_large', 'unsupported_content_type', 'upstream_4xx', 'upstream_5xx',
  'rate_limited', 'render_failed', 'extract_failed', 'quality_rejected',
  'provider_failed', 'internal_error',
])

function isTimestamp(value: string | undefined): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isIntegerBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum
}

function isFiniteBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

function normalizedDomain(value: string): string | null {
  const candidate = value.toLowerCase().replace(/\.$/, '')
  return DOMAIN_PATTERN.test(candidate) && candidate === value ? candidate : null
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function canonicalizeCrawlUrl(input: string | URL): URL {
  const url = parseSafeOutboundUrl(input)
  url.hash = ''
  return url
}

export async function buildCrawlRequestIdentity(
  input: string | URL,
  strategy: ScrapeStrategy,
): Promise<{ canonicalUrl: string; domainKey: string; uniqueKey: string }> {
  if (!STRATEGIES.has(strategy)) throw new TypeError('Unsupported crawl strategy')
  const url = canonicalizeCrawlUrl(input)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${url.href}\0${strategy}`),
  )
  return {
    canonicalUrl: url.href,
    domainKey: url.hostname.toLowerCase(),
    uniqueKey: toHex(digest),
  }
}

export function isValidCrawlJob(job: CrawlJobV1): boolean {
  let seed: URL
  try {
    seed = canonicalizeCrawlUrl(job.seedUrl)
  } catch {
    return false
  }
  const limits = job.limits
  const domains = job.allowedDomains
  const created = Date.parse(job.createdAt)
  const updated = Date.parse(job.updatedAt)
  const expires = Date.parse(job.expiresAt)
  return job.schemaVersion === CRAWL_JOB_SCHEMA_VERSION
    && ID_PATTERN.test(job.id)
    && Number.isSafeInteger(job.requestedBy)
    && job.requestedBy > 0
    && ID_PATTERN.test(job.workspaceId)
    && (job.purpose === 'search' || job.purpose === 'ai-input')
    && JOB_STATUSES.has(job.status)
    && domains.length > 0
    && domains.length <= 32
    && new Set(domains).size === domains.length
    && domains.every(domain => normalizedDomain(domain) !== null)
    && domains.some(domain => seed.hostname === domain || (job.includeSubdomains && seed.hostname.endsWith(`.${domain}`)))
    && isIntegerBetween(limits.maxPages, 1, 1_000)
    && isIntegerBetween(limits.maxDepth, 0, 10)
    && isIntegerBetween(limits.maxResponseBytes, 1, 10 * 1024 * 1024)
    && isIntegerBetween(limits.maxDurationMs, 1, 24 * 60 * 60 * 1_000)
    && isFiniteBetween(limits.maxBrowserSeconds, 0, 86_400)
    && isFiniteBetween(limits.maxCostUsd, 0, 100)
    && isTimestamp(job.createdAt)
    && isTimestamp(job.updatedAt)
    && isTimestamp(job.expiresAt)
    && created <= updated
    && updated < expires
    && (job.cancelRequestedAt === undefined || isTimestamp(job.cancelRequestedAt))
}

export function isValidCrawlRequest(request: CrawlRequestV1): boolean {
  let canonical: URL
  try {
    canonical = canonicalizeCrawlUrl(request.canonicalUrl)
  } catch {
    return false
  }
  const hasCompleteLease = Boolean(request.leaseToken)
    && isTimestamp(request.leasedAt)
    && isTimestamp(request.leaseExpiresAt)
    && Date.parse(request.leasedAt as string) < Date.parse(request.leaseExpiresAt as string)
  const hasNoLease = request.leaseToken === undefined
    && request.leasedAt === undefined
    && request.leaseExpiresAt === undefined
  return request.schemaVersion === CRAWL_REQUEST_SCHEMA_VERSION
    && ID_PATTERN.test(request.id)
    && ID_PATTERN.test(request.jobId)
    && request.parentRequestId !== request.id
    && (request.parentRequestId === undefined || ID_PATTERN.test(request.parentRequestId))
    && canonical.href === request.canonicalUrl
    && normalizedDomain(request.domainKey) === canonical.hostname
    && HASH_PATTERN.test(request.uniqueKey)
    && STRATEGIES.has(request.strategy)
    && REQUEST_STATUSES.has(request.status)
    && isIntegerBetween(request.depth, 0, 10)
    && isIntegerBetween(request.attemptCount, 0, 20)
    && isIntegerBetween(request.maxAttempts, 1, 20)
    && request.attemptCount <= request.maxAttempts
    && isTimestamp(request.availableAt)
    && (hasNoLease || hasCompleteLease)
    && (request.status === 'leased' ? hasCompleteLease : request.status !== 'pending' || hasNoLease)
    && (request.finalUrl === undefined || (() => {
      try { return canonicalizeCrawlUrl(request.finalUrl).href === request.finalUrl } catch { return false }
    })())
    && (request.errorCode === undefined || ERROR_CODES.has(request.errorCode))
    && (request.contentHash === undefined || HASH_PATTERN.test(request.contentHash))
}

const REQUEST_TRANSITIONS: Readonly<Record<CrawlRequestStatus, readonly CrawlRequestStatus[]>> = {
  pending: ['leased', 'skipped', 'cancelled'],
  leased: ['pending', 'succeeded', 'failed', 'skipped', 'cancelled'],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
}

export function canTransitionCrawlRequest(from: CrawlRequestStatus, to: CrawlRequestStatus): boolean {
  return from === to || REQUEST_TRANSITIONS[from].includes(to)
}

const JOB_TRANSITIONS: Readonly<Record<CrawlJobStatus, readonly CrawlJobStatus[]>> = {
  queued: ['running', 'cancelled', 'expired'],
  running: ['partial', 'succeeded', 'failed', 'cancelled', 'expired'],
  partial: ['running', 'succeeded', 'failed', 'cancelled', 'expired'],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
}

export function canTransitionCrawlJob(from: CrawlJobStatus, to: CrawlJobStatus): boolean {
  return from === to || JOB_TRANSITIONS[from].includes(to)
}
