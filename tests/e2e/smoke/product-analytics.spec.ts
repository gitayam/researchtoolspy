import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  classifyProductApi,
  classifyProductPage,
} from '../../../src/lib/product-analytics-contract'
import {
  buildProductActor,
  outcomeFromStatus,
  productActorCandidate,
  recordProductApiRequest,
  writeProductMetric,
} from '../../../functions/api/_shared/product-metrics'
import { onRequestPost } from '../../../functions/api/analytics/events'
import { onRequest as analyticsMiddleware } from '../../../functions/api/_middleware'
import type { AnalyticsEngineDataPoint } from '../../../functions/api/_shared/scrape-metrics'

const telemetryKey = 'product-only-telemetry-key-with-enough-entropy'
const guestId = 'guest_12345678-1234-1234-1234-123456789abc'

test.describe('privacy-safe product analytics @smoke', () => {
  test('@smoke SPA page view sends only the closed feature contract', async ({ page }) => {
    let captured: { body?: unknown; headers?: Record<string, string> } | undefined
    await page.route('**/api/analytics/events', async route => {
      captured = {
        body: route.request().postDataJSON(),
        headers: route.request().headers(),
      }
      await route.fulfill({ status: 204 })
    })

    await page.goto('/dashboard/tools/timeline?private=do-not-send')
    await expect.poll(() => captured).toBeTruthy()
    expect(captured?.body).toEqual({
      events: [{ event: 'page_view', feature: 'timeline', action: 'view' }],
    })
    expect(captured?.headers?.['x-guest-session']).toMatch(/^guest_[A-Za-z0-9-]{16,96}$/)
    expect(JSON.stringify(captured?.body)).not.toContain('private')
    expect(JSON.stringify(captured?.body)).not.toContain('/dashboard')
  })

  test('@smoke classifies pages and APIs without retaining dynamic route values', () => {
    expect(classifyProductPage('/dashboard/tools/timeline')).toEqual({ feature: 'timeline', action: 'view' })
    expect(classifyProductPage('/dashboard/investigations/private-case-id')).toEqual({
      feature: 'investigations', action: 'view',
    })
    expect(classifyProductPage('/unmapped/private-value')).toBeNull()

    expect(classifyProductApi('/api/content-intelligence/analyze-url', 'POST')).toEqual({
      feature: 'content_intelligence', action: 'analyze',
    })
    expect(classifyProductApi('/api/investigations/private-case-id', 'DELETE')).toEqual({
      feature: 'investigations', action: 'delete',
    })
    expect(classifyProductApi('/api/analytics/events', 'POST')).toBeNull()
    expect(classifyProductApi('/api/health', 'GET')).toBeNull()
  })

  test('@smoke pseudonymizes actors and gives labeled synthetic checks precedence', async () => {
    const guestRequest = new Request('https://researchtools.net/api/evidence', {
      headers: { 'X-Guest-Session': guestId },
    })
    expect(productActorCandidate(guestRequest)).toEqual({ type: 'guest', identity: guestId })
    const actor = await buildProductActor(guestRequest, telemetryKey)
    expect(actor).toEqual({ type: 'guest', id: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(actor?.id).not.toContain(guestId)

    const probe = new Request('https://researchtools.net/api/evidence', {
      headers: { 'User-Agent': 'ResearchTools-Deploy-Probe/1.0', 'X-Guest-Session': guestId },
    })
    expect(productActorCandidate(probe, 'key:0')).toEqual({
      type: 'synthetic', identity: 'researchtools-check:key:0',
    })
  })

  test('@smoke emits only closed dimensions and never raw credentials or routes', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    const request = new Request('https://researchtools.net/api/investigations/private-case?query=secret', {
      method: 'POST',
      headers: { 'X-Guest-Session': guestId },
    })
    expect(await recordProductApiRequest({
      request,
      responseStatus: 422,
      durationMs: 37,
      env: {
        PRODUCT_TELEMETRY_KEY: telemetryKey,
        PRODUCT_ANALYTICS: { writeDataPoint: point => points.push(point) },
      },
    })).toBe(true)

    expect(points).toHaveLength(1)
    expect(points[0].blobs).toEqual([
      'product.metric.v1', 'api_request', 'investigations', 'create', 'api',
      'guest', 'rejected', '4xx', 'POST',
    ])
    expect(points[0].doubles).toEqual([1, 37, 422])
    const serialized = JSON.stringify(points)
    expect(serialized).not.toContain(guestId)
    expect(serialized).not.toContain('private-case')
    expect(serialized).not.toContain('secret')
  })

  test('@smoke browser intake validates bounds and records approved events only', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    const env = {
      PRODUCT_TELEMETRY_KEY: telemetryKey,
      PRODUCT_ANALYTICS: { writeDataPoint: (point: AnalyticsEngineDataPoint) => points.push(point) },
    }
    const accepted = await onRequestPost({
      request: new Request('https://researchtools.net/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Guest-Session': guestId },
        body: JSON.stringify({ events: [{
          event: 'page_view', feature: 'timeline', action: 'view', rawUrl: 'https://secret.example',
        }] }),
      }),
      env,
    } as never)
    expect(accepted.status).toBe(204)
    expect(points).toHaveLength(1)
    expect(points[0].blobs?.slice(1)).toEqual([
      'page_view', 'timeline', 'view', 'browser', 'guest', 'accepted', 'none', 'none',
    ])
    expect(JSON.stringify(points)).not.toContain('secret.example')

    const rejected = await onRequestPost({
      request: new Request('https://researchtools.net/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Guest-Session': guestId },
        body: JSON.stringify({ events: [{ event: 'page_view', feature: 'made_up', action: 'view' }] }),
      }),
      env,
    } as never)
    expect(rejected.status).toBe(400)
    expect(points).toHaveLength(1)
  })

  test('@smoke middleware records the terminal HTTP outcome without changing it', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    const pending: Promise<unknown>[] = []
    const response = await analyticsMiddleware({
      request: new Request('https://researchtools.net/api/tools/extract-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Guest-Session': guestId },
        body: '{}',
      }),
      env: {
        PRODUCT_TELEMETRY_KEY: telemetryKey,
        PRODUCT_ANALYTICS: { writeDataPoint: point => points.push(point) },
      },
      next: async () => Response.json({ error: 'unchanged' }, { status: 422 }),
      waitUntil: promise => pending.push(promise),
    })
    await Promise.all(pending)

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'unchanged' })
    expect(points).toHaveLength(1)
    expect(points[0].blobs?.slice(1, 8)).toEqual([
      'api_request', 'timeline', 'extract', 'api', 'guest', 'rejected', '4xx',
    ])
  })

  test('@smoke telemetry failures never alter observed behavior', async () => {
    const actor = await buildProductActor(new Request('https://researchtools.net', {
      headers: { 'X-Guest-Session': guestId },
    }), telemetryKey)
    expect(actor).not.toBeNull()
    expect(writeProductMetric({ writeDataPoint: () => { throw new Error('unavailable') } }, {
      event: 'page_view', feature: 'dashboard', action: 'view', surface: 'browser',
      actorType: 'guest', actorId: actor!.id, outcome: 'accepted', statusClass: 'none',
      method: 'none',
    })).toBe(false)
    expect(outcomeFromStatus(200)).toBe('succeeded')
    expect(outcomeFromStatus(401)).toBe('unauthorized')
    expect(outcomeFromStatus(422)).toBe('rejected')
    expect(outcomeFromStatus(429)).toBe('rate_limited')
    expect(outcomeFromStatus(503)).toBe('failed')
  })

  test('@smoke frontend, middleware, bindings, deploy guard, and runbook stay wired', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const middleware = readFileSync(resolve(process.cwd(), 'functions/api/_middleware.ts'), 'utf8')
    const wrangler = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8')
    const deploy = readFileSync(resolve(process.cwd(), 'deploy.sh'), 'utf8')
    const runbook = readFileSync(resolve(process.cwd(), 'docs/operations/PRODUCT_ANALYTICS.md'), 'utf8')

    expect(app).toContain('startProductAnalytics(router)')
    expect(middleware).toContain('recordProductApiRequest({')
    expect(middleware).toContain("url.pathname === '/api/analytics/events'")
    expect(wrangler.match(/binding = "PRODUCT_ANALYTICS"/g)).toHaveLength(2)
    expect(deploy).toContain('PRODUCT_TELEMETRY_KEY')
    expect(deploy).toContain('ResearchTools-Deploy-Probe/1.0')
    expect(deploy).toContain('src/lib/product-analytics-contract.ts')
    expect(runbook).toContain('Human monthly active actors')
    expect(runbook).toContain("blob6 IN ('guest', 'authenticated')")
  })
})
