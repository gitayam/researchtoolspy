/** First-party, privacy-safe browser analytics intake. */

import {
  isProductAction,
  isProductEventName,
  isProductFeature,
  type BrowserProductEvent,
} from '../../../src/lib/product-analytics-contract'
import {
  buildProductActor,
  writeProductMetric,
  type ProductAnalyticsEnv,
} from '../_shared/product-metrics'

const MAX_BODY_BYTES = 16 * 1024
const MAX_EVENTS = 10

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status })
}

function validBrowserEvent(value: unknown): value is BrowserProductEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  return (event.event === 'page_view' || event.event === 'intent')
    && isProductEventName(event.event)
    && isProductFeature(event.feature)
    && isProductAction(event.action)
}

export const onRequestPost: PagesFunction<ProductAnalyticsEnv> = async (context) => {
  const declaredLength = Number.parseInt(context.request.headers.get('Content-Length') || '0', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError('Analytics payload too large', 413)
  }

  const raw = await context.request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonError('Analytics payload too large', 413)
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonError('Invalid analytics payload', 400)
  }

  const events = (body as { events?: unknown })?.events
  if (!Array.isArray(events) || events.length < 1 || events.length > MAX_EVENTS || !events.every(validBrowserEvent)) {
    return jsonError('Invalid analytics events', 400)
  }

  // This endpoint deliberately does not resolve or provision a D1 user. The
  // credential/session is HMAC-pseudonymized with a telemetry-only key instead.
  const actor = await buildProductActor(
    context.request,
    context.env.PRODUCT_TELEMETRY_KEY,
  )
  if (actor) {
    for (const event of events) {
      writeProductMetric(context.env.PRODUCT_ANALYTICS, {
        ...event,
        surface: 'browser',
        actorType: actor.type,
        actorId: actor.id,
        outcome: 'accepted',
        statusClass: 'none',
        method: 'none',
      })
    }
  }

  return new Response(null, { status: 204 })
}

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204 })
