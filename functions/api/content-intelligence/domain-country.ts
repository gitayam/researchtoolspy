/**
 * Resolved IP location estimate for a URL hostname.
 *
 * This is deliberately not described as the publisher's country or origin:
 * DNS answers can identify a CDN edge, can vary by resolver, and can span
 * several countries. The response names the exact sampled address and scope.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'
import { fetchFixedProviderJson } from '../_shared/fixed-provider'
import {
  assertSafeOutboundUrl,
  parseSafeOutboundUrl,
  SafeFetchError,
  type HostnameResolver,
  resolvePublicHostname,
} from '../_shared/safe-fetch'

const COUNTRY_PROVIDER_ORIGIN = 'https://api.country.is'
const LOOKUP_TIMEOUT_MS = 12_000
const MAX_PROVIDER_BYTES = 16 * 1024

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

interface CountryProviderResponse {
  ip?: unknown
  country?: unknown
  city?: unknown
  subdivision?: unknown
  asn?: { organization?: unknown } | unknown
}

export interface CountryInfo {
  domain: string
  ip: string
  country: string
  countryCode: string
  flag: string
  region?: string
  city?: string
  org?: string
  success: true
  scope: 'resolved-ip'
  resolvedAddressCount: number
  sampledAddressCount: 1
  caveat: string
}

export interface CountryLookupOptions {
  signal?: AbortSignal
  resolveTargetHostname?: HostnameResolver
  resolveProviderHostname?: HostnameResolver
  fetchImpl?: typeof fetch
}

export class DomainCountryInputError extends Error {}

export class DomainCountryProviderError extends Error {
  constructor(public readonly status: number) {
    super('IP location provider request failed')
  }
}

function getFlagEmoji(countryCode: string): string {
  return String.fromCodePoint(...countryCode.split('').map(char => 127397 + char.charCodeAt(0)))
}

function countryName(countryCode: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode
  } catch {
    return countryCode
  }
}

function normalizedIp(value: string): string {
  const candidate = value.includes(':') ? `[${value.replace(/^\[|\]$/g, '')}]` : value
  const parsed = new URL(`http://${candidate}/`)
  return parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

function boundedOptionalString(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : undefined
}

/** Resolve and geolocate one deterministic public address through a fixed HTTPS provider. */
export async function lookupDomainCountry(
  input: string,
  options: CountryLookupOptions = {},
): Promise<CountryInfo> {
  if (options.signal?.aborted) {
    throw new SafeFetchError('aborted', 'IP location lookup was cancelled', { cause: options.signal.reason })
  }
  let parsed: URL
  try {
    parsed = parseSafeOutboundUrl(input)
  } catch (error) {
    throw new DomainCountryInputError(error instanceof SafeFetchError ? error.message : 'Invalid URL')
  }

  const domain = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  let resolvedAddresses: string[] = []
  try {
    await assertSafeOutboundUrl(parsed, options.signal ?? new AbortController().signal, async (hostname, signal) => {
      resolvedAddresses = await (options.resolveTargetHostname ?? resolvePublicHostname)(hostname, signal)
      return resolvedAddresses
    })
    if (options.signal?.aborted) {
      throw new SafeFetchError('aborted', 'IP location lookup was cancelled', { cause: options.signal.reason })
    }
  } catch (error) {
    if (options.signal?.aborted) {
      throw new SafeFetchError('aborted', 'IP location lookup was cancelled', { cause: error })
    }
    throw new DomainCountryInputError('The URL hostname must resolve only to public IP addresses')
  }

  // assertSafeOutboundUrl does not invoke DNS for an IP-literal target.
  if (resolvedAddresses.length === 0) resolvedAddresses = [domain]
  const addresses = [...new Set(resolvedAddresses.map(normalizedIp))]
    .sort((left, right) => Number(left.includes(':')) - Number(right.includes(':')) || left.localeCompare(right))
  const selectedIp = addresses[0]
  if (!selectedIp) throw new DomainCountryInputError('The URL hostname did not resolve to a public IP address')

  const result = await fetchFixedProviderJson<CountryProviderResponse>(COUNTRY_PROVIDER_ORIGIN, [selectedIp], {
    searchParams: { fields: 'city,subdivision,asn' },
    timeoutMs: LOOKUP_TIMEOUT_MS,
    maxResponseBytes: MAX_PROVIDER_BYTES,
    signal: options.signal,
    resolveHostname: options.resolveProviderHostname,
    fetchImpl: options.fetchImpl,
  })
  if (!result.response.ok) throw new DomainCountryProviderError(result.response.status)

  const data = result.data
  const providerIp = boundedOptionalString(data?.ip, 64)
  const countryCode = boundedOptionalString(data?.country, 2)?.toUpperCase()
  if (!data || !providerIp || normalizedIp(providerIp) !== selectedIp || !countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new DomainCountryProviderError(502)
  }
  const asn = data.asn && typeof data.asn === 'object' && !Array.isArray(data.asn)
    ? data.asn as { organization?: unknown }
    : undefined

  return {
    domain,
    ip: selectedIp,
    country: countryName(countryCode),
    countryCode,
    flag: getFlagEmoji(countryCode),
    region: boundedOptionalString(data.subdivision, 128),
    city: boundedOptionalString(data.city, 128),
    org: boundedOptionalString(asn?.organization, 256),
    success: true,
    scope: 'resolved-ip',
    resolvedAddressCount: addresses.length,
    sampledAddressCount: 1,
    caveat: 'Estimate for one resolved IP; CDNs and multi-address DNS may return a different location.',
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authUserId = await getUserFromRequest(request, env)
  if (!authUserId) {
    return Response.json({ error: 'Authentication required' }, { status: 401, headers: JSON_HEADERS })
  }

  let body: { url?: unknown }
  try {
    body = await request.json() as { url?: unknown }
  } catch {
    return Response.json({ success: false, error: 'A valid JSON body is required' }, { status: 400, headers: JSON_HEADERS })
  }
  if (typeof body.url !== 'string' || !body.url || body.url.length > 4096) {
    return Response.json({ success: false, error: 'A bounded HTTP(S) URL is required' }, { status: 400, headers: JSON_HEADERS })
  }

  const totalSignal = AbortSignal.any([request.signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)])
  try {
    return Response.json(await lookupDomainCountry(body.url, { signal: totalSignal }), {
      headers: { ...JSON_HEADERS, 'Cache-Control': 'private, max-age=300' },
    })
  } catch (error) {
    if (error instanceof DomainCountryInputError) {
      return Response.json({ success: false, error: error.message }, { status: 400, headers: JSON_HEADERS })
    }
    if (error instanceof DomainCountryProviderError) {
      console.error(`[Domain Country] bounded provider failure: ${error.status}`)
      const status = error.status === 429 ? 503 : 502
      return Response.json({ success: false, error: 'IP location estimate is temporarily unavailable' }, {
        status,
        headers: { ...JSON_HEADERS, ...(status === 503 ? { 'Retry-After': '60' } : {}) },
      })
    }
    if (error instanceof SafeFetchError && (error.code === 'aborted' || error.code === 'timeout')) {
      const timedOut = error.code === 'timeout'
        || (totalSignal.reason instanceof DOMException && totalSignal.reason.name === 'TimeoutError')
      return Response.json({
        success: false,
        error: timedOut ? 'IP location lookup timed out' : 'IP location lookup was cancelled',
      }, { status: timedOut ? 504 : 499, headers: JSON_HEADERS })
    }
    console.error('[Domain Country] bounded lookup failed')
    return Response.json({ success: false, error: 'IP location estimate is temporarily unavailable' }, {
      status: 502,
      headers: JSON_HEADERS,
    })
  }
}

export const onRequestGet: PagesFunction = async () => Response.json(
  { error: 'Method not allowed. Use POST.' },
  { status: 405, headers: JSON_HEADERS },
)
