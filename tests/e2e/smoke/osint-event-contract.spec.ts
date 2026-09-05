import { expect, test } from '@playwright/test'
import {
  OSINT_ANALYZER_SCHEMA_VERSION,
  OSINT_EVENT_SCHEMA_VERSION,
  canAnalyzerHandleEvent,
  isValidOsintAnalyzerManifest,
  isValidOsintEvent,
  type OsintAnalyzerManifestV1,
  type OsintEventV1,
} from '../../../functions/api/_shared/osint-event-contract'
import { SCRAPE_SCHEMA_VERSION, boundScrapeAttempts } from '../../../functions/api/_shared/scrape-contract'

const event: OsintEventV1<{ url: string }> = {
  schemaVersion: OSINT_EVENT_SCHEMA_VERSION,
  id: 'event:01',
  investigationId: 'investigation:01',
  type: 'url',
  data: { url: 'https://public.example/report' },
  module: 'seed-import',
  scopeDistance: 0,
  confidence: 1,
  tags: ['in-scope', 'public'],
  provenance: {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    sourceMode: 'live',
    fetchStrategy: 'direct',
    extractorVersion: 'heuristic.v2',
    quality: { version: 'article-quality.v2', score: 0.9, accepted: true },
    contentHash: 'a'.repeat(64),
    attempts: boundScrapeAttempts([]),
  },
  contentHash: 'a'.repeat(64),
  observedAt: '2026-09-04T12:00:00.000Z',
}

const analyzer: OsintAnalyzerManifestV1 = {
  schemaVersion: OSINT_ANALYZER_SCHEMA_VERSION,
  id: 'document-links',
  version: '1.0.0',
  consumes: ['url'],
  produces: ['document', 'url'],
  capabilities: { passive: true, network: 'fixed-provider', persistence: false },
  maxScopeDistance: 0,
  providerOrigins: ['https://api.example.com'],
  limits: {
    timeoutMs: 10_000,
    maxRequests: 2,
    maxResponseBytes: 512 * 1024,
    maxCostUsd: 0,
  },
}

test.describe('passive OSINT event and analyzer contract @smoke', () => {
  test('@smoke accepts a bounded event and declared passive analyzer', () => {
    expect(isValidOsintEvent(event)).toBe(true)
    expect(isValidOsintAnalyzerManifest(analyzer)).toBe(true)
    expect(canAnalyzerHandleEvent(analyzer, event)).toBe(true)
  })

  test('@smoke blocks dispatch beyond scope or for an undeclared event type', () => {
    expect(canAnalyzerHandleEvent(analyzer, { ...event, scopeDistance: 1 })).toBe(false)
    expect(canAnalyzerHandleEvent(analyzer, { ...event, type: 'email' })).toBe(false)
  })

  test('@smoke rejects malformed confidence, hashes, parent loops, and duplicate tags', () => {
    expect(isValidOsintEvent({ ...event, confidence: 1.1 })).toBe(false)
    expect(isValidOsintEvent({ ...event, contentHash: 'not-a-hash' })).toBe(false)
    expect(isValidOsintEvent({ ...event, parentId: event.id })).toBe(false)
    expect(isValidOsintEvent({ ...event, tags: ['public', 'public'] })).toBe(false)
  })

  test('@smoke permits only canonical HTTPS provider origins', () => {
    for (const origin of [
      'http://api.example.com',
      'https://user:password@api.example.com',
      'https://api.example.com:8443',
      'https://api.example.com/path',
      'https://api.example.com/?token=secret',
    ]) {
      expect(isValidOsintAnalyzerManifest({ ...analyzer, providerOrigins: [origin] }), origin).toBe(false)
    }
  })

  test('@smoke requires network analyzers to declare providers and offline analyzers to declare none', () => {
    expect(isValidOsintAnalyzerManifest({ ...analyzer, providerOrigins: [] })).toBe(false)
    expect(isValidOsintAnalyzerManifest({
      ...analyzer,
      capabilities: { passive: true, network: 'none', persistence: false },
    })).toBe(false)
    expect(isValidOsintAnalyzerManifest({
      ...analyzer,
      capabilities: { passive: true, network: 'none', persistence: false },
      providerOrigins: [],
      limits: { ...analyzer.limits, maxRequests: 0, maxResponseBytes: 0 },
    })).toBe(true)
  })
})
