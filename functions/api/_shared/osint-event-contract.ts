import type { ScrapeProvenanceV1 } from './scrape-contract'

export const OSINT_EVENT_SCHEMA_VERSION = 'osint.event.v1' as const
export const OSINT_ANALYZER_SCHEMA_VERSION = 'osint.analyzer.v1' as const

export type OsintEventType =
  | 'url'
  | 'domain'
  | 'email'
  | 'document'
  | 'claim'
  | 'entity'
  | 'relationship'

export interface OsintEventV1<TData = unknown> {
  schemaVersion: typeof OSINT_EVENT_SCHEMA_VERSION
  id: string
  investigationId: string
  type: OsintEventType
  data: TData
  parentId?: string
  module: string
  scopeDistance: number
  confidence: number
  tags: readonly string[]
  provenance: ScrapeProvenanceV1
  contentHash: string
  observedAt: string
}

export interface OsintAnalyzerManifestV1 {
  schemaVersion: typeof OSINT_ANALYZER_SCHEMA_VERSION
  id: string
  version: string
  consumes: readonly OsintEventType[]
  produces: readonly OsintEventType[]
  capabilities: {
    /** This platform contract deliberately excludes active/offensive modules. */
    passive: true
    network: 'none' | 'fixed-provider' | 'public-web'
    persistence: boolean
  }
  maxScopeDistance: number
  providerOrigins: readonly string[]
  limits: {
    timeoutMs: number
    maxRequests: number
    maxResponseBytes: number
    maxCostUsd: number
  }
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
const MODULE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const TAG_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/
const EVENT_TYPES = new Set<OsintEventType>([
  'url', 'domain', 'email', 'document', 'claim', 'entity', 'relationship',
])

function isIntegerBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum
}

function isFiniteBetween(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

function isEventTypeList(value: readonly OsintEventType[]): boolean {
  return value.length > 0
    && value.length <= EVENT_TYPES.size
    && new Set(value).size === value.length
    && value.every(type => EVENT_TYPES.has(type))
}

function isCanonicalProviderOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.port
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && url.origin === value
  } catch {
    return false
  }
}

export function isValidOsintEvent(event: OsintEventV1): boolean {
  return event.schemaVersion === OSINT_EVENT_SCHEMA_VERSION
    && ID_PATTERN.test(event.id)
    && ID_PATTERN.test(event.investigationId)
    && EVENT_TYPES.has(event.type)
    && MODULE_PATTERN.test(event.module)
    && (event.parentId === undefined || ID_PATTERN.test(event.parentId))
    && event.parentId !== event.id
    && isIntegerBetween(event.scopeDistance, 0, 16)
    && isFiniteBetween(event.confidence, 0, 1)
    && event.tags.length <= 32
    && new Set(event.tags).size === event.tags.length
    && event.tags.every(tag => TAG_PATTERN.test(tag))
    && HASH_PATTERN.test(event.contentHash)
    && event.provenance?.schemaVersion === 'scrape.v1'
    && Number.isFinite(Date.parse(event.observedAt))
}

export function isValidOsintAnalyzerManifest(manifest: OsintAnalyzerManifestV1): boolean {
  const { limits } = manifest
  return manifest.schemaVersion === OSINT_ANALYZER_SCHEMA_VERSION
    && MODULE_PATTERN.test(manifest.id)
    && manifest.version.length > 0
    && manifest.version.length <= 64
    && isEventTypeList(manifest.consumes)
    && isEventTypeList(manifest.produces)
    && manifest.capabilities.passive === true
    && ['none', 'fixed-provider', 'public-web'].includes(manifest.capabilities.network)
    && isIntegerBetween(manifest.maxScopeDistance, 0, 16)
    && manifest.providerOrigins.length <= 16
    && new Set(manifest.providerOrigins).size === manifest.providerOrigins.length
    && manifest.providerOrigins.every(isCanonicalProviderOrigin)
    && (manifest.capabilities.network !== 'none' || manifest.providerOrigins.length === 0)
    && (manifest.capabilities.network === 'none' || manifest.providerOrigins.length > 0)
    && isIntegerBetween(limits.timeoutMs, 1, 60_000)
    && isIntegerBetween(limits.maxRequests, 0, 1_000)
    && isIntegerBetween(limits.maxResponseBytes, 0, 10 * 1024 * 1024)
    && isFiniteBetween(limits.maxCostUsd, 0, 100)
}

/** Dispatch guard; analyzers must also repeat scope checks at their network boundary. */
export function canAnalyzerHandleEvent(
  manifest: OsintAnalyzerManifestV1,
  event: OsintEventV1,
): boolean {
  return isValidOsintAnalyzerManifest(manifest)
    && isValidOsintEvent(event)
    && manifest.consumes.includes(event.type)
    && event.scopeDistance <= manifest.maxScopeDistance
}
