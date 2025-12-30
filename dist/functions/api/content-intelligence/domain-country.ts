/**
 * Domain Country Origin Lookup
 *
 * Determines the country where a domain is hosted using DNS and IP geolocation
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  // No special env vars needed
}

interface CountryInfo {
  domain: string
  ip?: string
  country: string
  countryCode: string
  flag: string
  region?: string
  city?: string
  org?: string
  success: boolean
  error?: string
}

// Country code to flag emoji mapping
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍'

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))

  return String.fromCodePoint(...codePoints)
}

// Country code to full name mapping (top countries)
const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'JP': 'Japan',
  'CN': 'China',
  'IN': 'India',
  'BR': 'Brazil',
  'RU': 'Russia',
  'NL': 'Netherlands',
  'SG': 'Singapore',
  'IE': 'Ireland',
  'IT': 'Italy',
  'ES': 'Spain',
  'SE': 'Sweden',
  'CH': 'Switzerland',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'PL': 'Poland',
  'BE': 'Belgium',
  'AT': 'Austria',
  'NZ': 'New Zealand',
  'KR': 'South Korea',
  'MX': 'Mexico',
  'AR': 'Argentina',
  'ZA': 'South Africa',
  'TH': 'Thailand',
  'MY': 'Malaysia',
  'ID': 'Indonesia',
  'PH': 'Philippines',
  'VN': 'Vietnam',
  'UA': 'Ukraine',
  'RO': 'Romania',
  'CZ': 'Czech Republic',
  'PT': 'Portugal',
  'GR': 'Greece',
  'HU': 'Hungary',
  'TR': 'Turkey',
  'IL': 'Israel',
  'AE': 'United Arab Emirates',
  'SA': 'Saudi Arabia',
  'EG': 'Egypt',
  'NG': 'Nigeria',
  'KE': 'Kenya',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
  'VE': 'Venezuela',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'HK': 'Hong Kong',
  'TW': 'Taiwan'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context

  try {
    const body = await request.json() as { url: string }
    const { url } = body

    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Extract domain from URL
    let domain: string
    try {
      domain = new URL(url).hostname
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid URL'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Domain Country] Looking up: ${domain}`)

    // Use ip-api.com free API (no key required, 45 requests/min)
    // Alternative: ipapi.co (1000 requests/day free)
    const geoResponse = await fetch(`http://ip-api.com/json/${domain}?fields=status,message,country,countryCode,region,city,org,query`)

    if (!geoResponse.ok) {
      throw new Error('Geolocation API unavailable')
    }

    const geoData = await geoResponse.json() as any

    if (geoData.status === 'fail') {
      return new Response(JSON.stringify({
        success: false,
        domain,
        error: geoData.message || 'Failed to lookup domain country'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const countryCode = geoData.countryCode || 'XX'
    const country = COUNTRY_NAMES[countryCode] || geoData.country || 'Unknown'

    const countryInfo: CountryInfo = {
      domain,
      ip: geoData.query,
      country,
      countryCode,
      flag: getFlagEmoji(countryCode),
      region: geoData.region,
      city: geoData.city,
      org: geoData.org,
      success: true
    }

    console.log(`[Domain Country] ${domain} -> ${country} (${countryCode})`)

    return new Response(JSON.stringify(countryInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Domain Country] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to lookup country'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
