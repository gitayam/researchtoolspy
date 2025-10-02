import { Env } from '../../types'

interface URLAnalysisRequest {
  url: string
  checkWayback?: boolean
  checkSEO?: boolean
}

// Extract metadata from HTML
function extractMetadata(html: string, url: string): any {
  const metadata: any = {}

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  if (titleMatch) {
    metadata.title = titleMatch[1].trim()
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  // Extract meta tags
  const metaTags = html.matchAll(/<meta\s+([^>]+)>/gi)
  const openGraph: Record<string, string> = {}
  const twitterCard: Record<string, string> = {}
  const standardMeta: Record<string, string> = {}

  for (const tag of metaTags) {
    const attrs = tag[1]
    const propertyMatch = attrs.match(/(?:property|name)=["']([^"']+)["']/i)
    const contentMatch = attrs.match(/content=["']([^"']+)["']/i)

    if (propertyMatch && contentMatch) {
      const prop = propertyMatch[1].toLowerCase()
      const content = contentMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      // Open Graph
      if (prop.startsWith('og:')) {
        openGraph[prop.replace('og:', '')] = content
        if (prop === 'og:title' && !metadata.title) metadata.title = content
        if (prop === 'og:description' && !metadata.description) metadata.description = content
        if (prop === 'og:image' && !metadata.image) metadata.image = content
        if (prop === 'og:site_name' && !metadata.siteName) metadata.siteName = content
        if (prop === 'og:type' && !metadata.type) metadata.type = content
      }
      // Twitter Card
      else if (prop.startsWith('twitter:')) {
        twitterCard[prop.replace('twitter:', '')] = content
      }
      // Article tags
      else if (prop === 'article:author' && !metadata.author) {
        metadata.author = content
      } else if (prop === 'article:published_time' && !metadata.publishDate) {
        metadata.publishDate = content
      }
      // Standard meta tags
      else if (prop === 'author' && !metadata.author) {
        metadata.author = content
      } else if (prop === 'description' && !metadata.description) {
        metadata.description = content
      }

      standardMeta[prop] = content
    }
  }

  return {
    metadata,
    seo: {
      metaTags: standardMeta,
      openGraph,
      twitterCard
    }
  }
}

// Calculate reliability score
function calculateReliability(
  domain: any,
  status: any,
  metadata: any,
  wayback?: any
): any {
  let sslScore = 0
  let domainAgeScore = 0
  let contentQualityScore = 0
  let archiveHistoryScore = 0
  let responseTimeScore = 0
  let metadataScore = 0
  let securityScore = 0

  const notes: string[] = []

  // SSL/HTTPS (20 points)
  if (domain.ssl) {
    sslScore = 20
    notes.push('✓ Secure HTTPS connection')
  } else {
    notes.push('⚠ Not using HTTPS')
  }

  // Domain age (20 points)
  if (domain.age) {
    if (domain.age > 3650) { // 10+ years
      domainAgeScore = 20
      notes.push('✓ Well-established domain (10+ years)')
    } else if (domain.age > 1825) { // 5+ years
      domainAgeScore = 15
      notes.push('✓ Mature domain (5+ years)')
    } else if (domain.age > 365) { // 1+ year
      domainAgeScore = 10
      notes.push('Domain is over 1 year old')
    } else {
      domainAgeScore = 5
      notes.push('⚠ Domain is less than 1 year old')
    }
  } else {
    domainAgeScore = 10 // Unknown, give benefit of doubt
  }

  // Content quality (20 points)
  let contentScore = 0
  if (metadata.title) contentScore += 5
  if (metadata.description) contentScore += 5
  if (metadata.author) contentScore += 5
  if (metadata.siteName) contentScore += 3
  if (metadata.image) contentScore += 2

  contentQualityScore = contentScore
  if (contentScore >= 15) {
    notes.push('✓ Rich metadata present')
  } else if (contentScore >= 10) {
    notes.push('Basic metadata present')
  } else {
    notes.push('⚠ Limited metadata')
  }

  // Archive history (15 points)
  if (wayback?.isArchived) {
    if (wayback.totalSnapshots > 100) {
      archiveHistoryScore = 15
      notes.push('✓ Extensively archived (100+ snapshots)')
    } else if (wayback.totalSnapshots > 10) {
      archiveHistoryScore = 10
      notes.push('✓ Well archived (10+ snapshots)')
    } else {
      archiveHistoryScore = 5
      notes.push('Some archive history exists')
    }
  } else {
    notes.push('⚠ No archive history found')
  }

  // Response time (10 points)
  if (status.responseTime < 200) {
    responseTimeScore = 10
    notes.push('✓ Excellent response time')
  } else if (status.responseTime < 500) {
    responseTimeScore = 7
  } else if (status.responseTime < 1000) {
    responseTimeScore = 5
  } else if (status.responseTime < 3000) {
    responseTimeScore = 3
    notes.push('⚠ Slow response time')
  } else {
    notes.push('⚠ Very slow response time')
  }

  // Valid metadata (10 points)
  metadataScore = Math.min(10, contentScore / 2)

  // Security (5 points)
  if (domain.ssl && status.ok) {
    securityScore = 5
  } else if (domain.ssl) {
    securityScore = 3
  }

  const totalScore =
    sslScore +
    domainAgeScore +
    contentQualityScore +
    archiveHistoryScore +
    responseTimeScore +
    metadataScore +
    securityScore

  let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unknown'
  if (totalScore >= 80) rating = 'Excellent'
  else if (totalScore >= 60) rating = 'Good'
  else if (totalScore >= 40) rating = 'Fair'
  else rating = 'Poor'

  return {
    score: Math.round(totalScore),
    breakdown: {
      ssl: sslScore,
      domainAge: domainAgeScore,
      contentQuality: contentQualityScore,
      archiveHistory: archiveHistoryScore,
      responseTime: responseTimeScore,
      metadata: metadataScore,
      security: securityScore
    },
    rating,
    notes
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context

  try {
    const body = await request.json() as URLAnalysisRequest

    if (!body.url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate and normalize URL
    let parsedUrl: URL
    try {
      // Add protocol if missing
      let urlStr = body.url.trim()
      if (!urlStr.match(/^https?:\/\//i)) {
        urlStr = 'https://' + urlStr
      }
      parsedUrl = new URL(urlStr)
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const normalizedUrl = parsedUrl.href
    const startTime = Date.now()

    // Fetch the URL
    let response: Response
    let finalUrl = normalizedUrl
    const redirects: string[] = []

    try {
      response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'ResearchToolsPy URL Analyzer/1.0 (Academic Research Tool)'
        },
        redirect: 'follow'
      })

      // Track redirects
      if (response.redirected) {
        redirects.push(response.url)
        finalUrl = response.url
      }
    } catch (fetchError: any) {
      return new Response(JSON.stringify({
        url: body.url,
        normalizedUrl,
        error: `Failed to fetch URL: ${fetchError.message}`,
        status: {
          code: 0,
          ok: false,
          responseTime: Date.now() - startTime,
          redirects: [],
          finalUrl: normalizedUrl,
          error: fetchError.message
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const responseTime = Date.now() - startTime

    // Get HTML content
    const html = await response.text()

    // Extract metadata
    const { metadata, seo } = extractMetadata(html, normalizedUrl)

    // Domain info
    const domain = {
      name: parsedUrl.hostname,
      protocol: parsedUrl.protocol.replace(':', ''),
      path: parsedUrl.pathname,
      ssl: parsedUrl.protocol === 'https:',
      sslExpiry: undefined, // Would need certificate inspection
      ipAddress: undefined, // Would need DNS lookup
      location: undefined
    }

    // Status
    const status = {
      code: response.status,
      ok: response.ok,
      responseTime,
      redirects,
      finalUrl
    }

    // Wayback Machine check (if requested)
    let wayback: any = undefined
    if (body.checkWayback) {
      try {
        const waybackResponse = await fetch(
          `https://archive.org/wayback/available?url=${encodeURIComponent(normalizedUrl)}`
        )

        if (waybackResponse.ok) {
          const waybackData = await waybackResponse.json()

          if (waybackData.archived_snapshots?.closest) {
            const snapshot = waybackData.archived_snapshots.closest
            wayback = {
              isArchived: true,
              lastSnapshot: snapshot.timestamp,
              archiveUrl: snapshot.url,
              totalSnapshots: 1 // Basic info only
            }

            // Try to get more snapshot data
            try {
              const cdxResponse = await fetch(
                `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(normalizedUrl)}&output=json&limit=100`
              )
              if (cdxResponse.ok) {
                const cdxData = await cdxResponse.json()
                if (Array.isArray(cdxData) && cdxData.length > 1) {
                  wayback.totalSnapshots = cdxData.length - 1 // First row is header
                  if (cdxData.length > 1) {
                    wayback.firstSnapshot = cdxData[1][1] // timestamp of first snapshot
                  }
                }
              }
            } catch (cdxError) {
              // CDX failed, continue with basic wayback data
            }
          } else {
            wayback = {
              isArchived: false
            }
          }
        }
      } catch (waybackError) {
        // Wayback check failed, continue without it
        wayback = { isArchived: false }
      }
    }

    // Calculate reliability score
    const reliability = calculateReliability(domain, status, metadata, wayback)

    // Build result
    const result = {
      url: body.url,
      normalizedUrl,
      metadata,
      domain,
      status,
      reliability,
      analyzedAt: new Date().toISOString()
    }

    // Add optional data
    if (wayback) {
      result.wayback = wayback
    }

    if (body.checkSEO && seo) {
      result.seo = seo
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('URL analysis error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to analyze URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// Handle OPTIONS requests for CORS
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
