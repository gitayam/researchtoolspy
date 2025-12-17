/**
 * VirusTotal Domain Security Lookup
 *
 * Provides security information about a domain using VirusTotal API
 * - Domain reputation
 * - Threat detection stats
 * - Community votes
 * - Last analysis results
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  VIRUSTOTAL_API_KEY: string
}

interface VirusTotalDomainReport {
  data: {
    id: string
    type: string
    attributes: {
      last_analysis_stats: {
        harmless: number
        malicious: number
        suspicious: number
        undetected: number
        timeout: number
      }
      last_analysis_date: number
      reputation: number
      total_votes: {
        harmless: number
        malicious: number
      }
      categories?: Record<string, string>
      popularity_ranks?: Record<string, { rank: number }>
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as { url: string }
    const { url } = body

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Extract domain from URL
    const domain = new URL(url).hostname

    console.log(`[VirusTotal] Looking up domain: ${domain}`)

    if (!env.VIRUSTOTAL_API_KEY) {
      console.error('[VirusTotal] API key not configured')
      return new Response(JSON.stringify({
        error: 'VirusTotal API not configured',
        directLink: `https://www.virustotal.com/gui/domain/${domain}`
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Fetch domain report from VirusTotal
    const vtResponse = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      method: 'GET',
      headers: {
        'x-apikey': env.VIRUSTOTAL_API_KEY,
        'Accept': 'application/json'
      }
    })

    if (!vtResponse.ok) {
      const errorText = await vtResponse.text()
      console.error(`[VirusTotal] API error: ${vtResponse.status} - ${errorText}`)

      // Still return the direct link even if API fails
      return new Response(JSON.stringify({
        error: `VirusTotal API error: ${vtResponse.status}`,
        directLink: `https://www.virustotal.com/gui/domain/${domain}`,
        message: 'API request failed, but you can view the report directly on VirusTotal'
      }), {
        status: vtResponse.status === 404 ? 200 : vtResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await vtResponse.json() as VirusTotalDomainReport

    // Format the response with key security information
    const securityInfo = {
      domain,
      directLink: `https://www.virustotal.com/gui/domain/${domain}`,
      reputation: data.data.attributes.reputation || 0,
      lastAnalysisDate: new Date(data.data.attributes.last_analysis_date * 1000).toISOString(),
      stats: data.data.attributes.last_analysis_stats,
      votes: data.data.attributes.total_votes,
      categories: data.data.attributes.categories || {},
      popularityRanks: data.data.attributes.popularity_ranks || {},
      // Calculate safety score
      safetyScore: calculateSafetyScore(data.data.attributes.last_analysis_stats),
      // Determine risk level
      riskLevel: determineRiskLevel(data.data.attributes.last_analysis_stats),
      // Summary message
      summary: generateSummary(data.data.attributes.last_analysis_stats, data.data.attributes.reputation)
    }

    return new Response(JSON.stringify(securityInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[VirusTotal] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch VirusTotal data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Calculate safety score (0-100, higher is safer)
 */
function calculateSafetyScore(stats: { harmless: number, malicious: number, suspicious: number, undetected: number }): number {
  const total = stats.harmless + stats.malicious + stats.suspicious + stats.undetected

  if (total === 0) return 50 // Unknown/not analyzed

  const harmlessWeight = stats.harmless * 100
  const maliciousWeight = stats.malicious * 0
  const suspiciousWeight = stats.suspicious * 25
  const undetectedWeight = stats.undetected * 75

  const weightedScore = (harmlessWeight + maliciousWeight + suspiciousWeight + undetectedWeight) / total

  return Math.round(weightedScore)
}

/**
 * Determine risk level
 */
function determineRiskLevel(stats: { harmless: number, malicious: number, suspicious: number }): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
  if (stats.malicious === 0 && stats.suspicious === 0) {
    return 'safe'
  }

  if (stats.malicious === 0 && stats.suspicious <= 2) {
    return 'low'
  }

  if (stats.malicious <= 2 || stats.suspicious <= 5) {
    return 'medium'
  }

  if (stats.malicious <= 5) {
    return 'high'
  }

  return 'critical'
}

/**
 * Generate human-readable summary
 */
function generateSummary(stats: { harmless: number, malicious: number, suspicious: number }, reputation: number): string {
  if (stats.malicious > 10) {
    return '⚠️ High Risk: Multiple security vendors flagged this domain as malicious'
  }

  if (stats.malicious > 5) {
    return '⚠️ Moderate Risk: Several security vendors flagged this domain'
  }

  if (stats.malicious > 0 || stats.suspicious > 5) {
    return '⚡ Low Risk: Some security vendors flagged this domain as suspicious'
  }

  if (reputation > 0) {
    return '✅ Safe: Domain has a positive reputation with no malicious detections'
  }

  if (stats.harmless > 50) {
    return '✅ Safe: Verified by multiple security vendors'
  }

  return 'ℹ️ Unknown: Limited security information available'
}
