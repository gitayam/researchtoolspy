/**
 * Shared scraping utilities for URL enrichment and analysis tools.
 *
 * The transport remains bounded and SSRF-safe. Callers opt into archives;
 * public enrichment stays direct-only so a lightweight lookup cannot disclose
 * a destination to a third-party archive service.
 */

import { fetchSocialViaApify, isApifySupportedUrl } from './apify-social'
import { extractArticle, type ArticleQualitySignals } from './article-extractor'
import {
  ARTICLE_CANDIDATE_POLICIES,
  createArticleCandidateSelector,
  type ArticleAnalysisPurpose,
  type ArticleCandidateAssessment,
} from './article-candidate'
import { fetchArchivePhSource, fetchWaybackSource } from './archive-sources'
import { parseSafeOutboundUrl, SafeFetchError, safeFetchText } from './safe-fetch'
import type { NormalizedScrapeError } from './scrape-contract'

export type ScrapeUrlPurpose = Extract<ArticleAnalysisPurpose, 'enrichment' | 'timeline' | 'rage-check'>
export type ScrapedContentSource = 'apify' | 'twitter-oembed' | 'original' | 'archive.ph' | 'wayback'

export interface ScrapeUrlOptions {
  purpose?: ScrapeUrlPurpose
  /** Archives are opt-in because they disclose the destination URL to providers. */
  allowArchives?: boolean
}

export interface ScrapedContent {
  title: string
  content: string
  error?: string
  source?: ScrapedContentSource
  finalUrl?: string
  fallbackAttempts?: string[]
  quality?: ArticleCandidateAssessment
  extraction?: { method: string; quality: string; wordCount: number }
}

interface TwitterOEmbed {
  html?: string
  author_name?: string
}

interface ScrapeCandidate {
  value: ScrapedContent
  success: boolean
  blocked?: boolean
  contentKind?: 'article' | 'social'
  errorCode?: NormalizedScrapeError
  qualitySignals?: ArticleQualitySignals
}

const STATIC_MAX_BYTES = 2 * 1024 * 1024

function normalizedFetchError(error: unknown): NormalizedScrapeError {
  if (!(error instanceof SafeFetchError)) return 'internal_error'
  switch (error.code) {
    case 'invalid_url':
    case 'unsafe_url':
    case 'unsafe_method':
    case 'unsafe_headers':
    case 'invalid_options':
      return 'policy_denied'
    case 'dns_resolution_failed':
      return 'dns_denied'
    case 'timeout':
    case 'aborted':
      return 'timeout'
    case 'redirect_limit':
    case 'response_too_large':
    case 'unsupported_content_type':
      return error.code
    case 'network_error':
      return 'upstream_5xx'
  }
}

function terminalPolicyFailure(error: unknown): boolean {
  return error instanceof SafeFetchError && (
    error.code === 'invalid_url'
    || error.code === 'unsafe_url'
    || error.code === 'dns_resolution_failed'
  )
}

function responseError(status: number): NormalizedScrapeError {
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'upstream_5xx'
  return 'upstream_4xx'
}

function withAssessment(
  assessed: { candidate: ScrapeCandidate; assessment: ArticleCandidateAssessment },
  attempts: string[],
  error?: string,
): ScrapedContent {
  return {
    ...assessed.candidate.value,
    ...(error ? { error } : {}),
    fallbackAttempts: [...attempts],
    quality: assessed.assessment,
  }
}

function articleCandidate(
  html: string,
  finalUrl: string,
  source: Extract<ScrapedContentSource, 'original' | 'archive.ph' | 'wayback'>,
): ScrapeCandidate {
  const article = extractArticle(html, finalUrl)
  return {
    success: true,
    qualitySignals: article.qualitySignals,
    contentKind: 'article',
    value: {
      title: article.title || finalUrl,
      content: article.text.substring(0, 30_000),
      source,
      finalUrl,
      extraction: {
        method: article.method,
        quality: article.quality,
        wordCount: article.wordCount,
      },
    },
  }
}

function socialCandidate(
  title: string,
  content: string,
  source: Extract<ScrapedContentSource, 'apify' | 'twitter-oembed'>,
  finalUrl: string,
): ScrapeCandidate {
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return {
    success: true,
    contentKind: 'social',
    value: {
      title,
      content,
      source,
      finalUrl,
      extraction: { method: source, quality: 'social', wordCount },
    },
  }
}

/**
 * Scrape one URL and select the first analysis-grade candidate. The strongest
 * partial candidate is retained for diagnostics when every source is rejected.
 */
export async function scrapeUrl(
  url: string,
  apifyApiKey?: string,
  options: ScrapeUrlOptions = {},
): Promise<ScrapedContent> {
  try {
    url = parseSafeOutboundUrl(url).href
  } catch {
    return { title: 'Error', content: '', error: 'Scraping failed' }
  }

  const purpose = options.purpose ?? 'enrichment'
  const attempts: string[] = []
  const candidates = createArticleCandidateSelector(
    ARTICLE_CANDIDATE_POLICIES[purpose],
    (candidate: ScrapeCandidate) => ({
      success: candidate.success,
      text: candidate.value.content,
      title: candidate.value.title,
      blocked: candidate.blocked,
      contentKind: candidate.contentKind,
      errorCode: candidate.errorCode,
      qualitySignals: candidate.qualitySignals,
    }),
  )
  const totalController = new AbortController()
  const totalTimeout = setTimeout(
    () => totalController.abort(new Error('scrape chain timed out')),
    30_000,
  )

  try {
    // Prefer the configured social provider, then the platform's public oEmbed.
    const socialPlatform = isApifySupportedUrl(url)
    if (apifyApiKey && socialPlatform) {
      attempts.push('apify')
      try {
        const socialResult = await Promise.race([
          fetchSocialViaApify(url, apifyApiKey),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Apify timeout (20s)')), 20_000)),
        ])
        if (socialResult?.success) {
          const assessed = candidates.consider(socialCandidate(
            socialResult.title || `${socialResult.platform} post`,
            socialResult.text,
            'apify',
            url,
          ))
          if (assessed.assessment.accepted) return withAssessment(assessed, attempts)
        }
      } catch (error) {
        console.error('[Scrape] Apify social extraction failed:', error)
      }
    }

    if (socialPlatform === 'twitter') {
      attempts.push('twitter-oembed')
      try {
        const twitterUrl = url.replace('https://x.com/', 'https://twitter.com/')
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}`
        const oembed = await safeFetchText(oembedUrl, {
          timeoutMs: 10_000,
          maxRedirects: 2,
          maxResponseBytes: 128 * 1024,
          allowedHostnames: ['publish.twitter.com'],
          allowedContentTypes: ['application/json'],
          requestInit: { signal: totalController.signal },
        })
        if (oembed.response.ok) {
          const data = JSON.parse(oembed.text) as TwitterOEmbed
          const html = data.html || ''
          const paragraph = html.match(/<p[^>]*>(.*?)<\/p>/)?.[1]
          const content = paragraph
            ? paragraph
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim()
            : ''
          const assessed = candidates.consider(socialCandidate(
            `Tweet by ${data.author_name || 'unknown author'}`,
            content,
            'twitter-oembed',
            url,
          ))
          if (assessed.assessment.accepted) return withAssessment(assessed, attempts)
        }
      } catch (error) {
        console.error('[Scrape] Twitter oEmbed failed:', error)
      }
    }

    // Fetch the original under the enforcing outbound policy.
    attempts.push('original')
    try {
      const fetched = await safeFetchText(url, {
        timeoutMs: 15_000,
        maxRedirects: 5,
        maxResponseBytes: STATIC_MAX_BYTES,
        allowedContentTypes: ['text/', 'application/xhtml+xml', 'application/xml'],
        requestInit: {
          signal: totalController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
          },
        },
      })

      if (fetched.response.ok) {
        const assessed = candidates.consider(articleCandidate(fetched.text, fetched.finalUrl, 'original'))
        if (assessed.assessment.accepted) return withAssessment(assessed, attempts)
      } else {
        const blocked = fetched.response.status === 401 || fetched.response.status === 403
        const assessed = candidates.consider({
          success: false,
          blocked,
          errorCode: responseError(fetched.response.status),
          value: {
            title: blocked ? 'Access Denied' : 'Error',
            content: '',
            source: 'original',
            finalUrl: fetched.finalUrl,
          },
        })
        // A real authentication challenge is terminal. A 403 is frequently an
        // automated-client block, so analysis callers may still use archives.
        if (fetched.response.status === 401 || !options.allowArchives) {
          return withAssessment(assessed, attempts, 'Access Denied: The website blocked automated access.')
        }
      }
    } catch (error) {
      const assessed = candidates.consider({
        success: false,
        errorCode: normalizedFetchError(error),
        value: { title: 'Error', content: '', source: 'original' },
      })
      // Never disclose a URL denied by the destination policy to a provider.
      if (terminalPolicyFailure(error) || !options.allowArchives) {
        return withAssessment(assessed, attempts, 'Scraping failed')
      }
      console.error('[Scrape] Standard fetch failed:', error)
    }

    if (options.allowArchives && !totalController.signal.aborted) {
      attempts.push('archive.ph')
      try {
        const archived = await fetchArchivePhSource(url, totalController.signal)
        if (archived) {
          const assessed = candidates.consider(articleCandidate(archived.html, archived.finalUrl, archived.source))
          if (assessed.assessment.accepted) return withAssessment(assessed, attempts)
        }
      } catch (error) {
        console.error('[Scrape] Archive.ph extraction failed:', error)
      }
    }

    if (options.allowArchives && !totalController.signal.aborted) {
      attempts.push('wayback')
      try {
        const archived = await fetchWaybackSource(url, totalController.signal)
        if (archived) {
          const assessed = candidates.consider(articleCandidate(archived.html, archived.finalUrl, archived.source))
          if (assessed.assessment.accepted) return withAssessment(assessed, attempts)
        }
      } catch (error) {
        console.error('[Scrape] Wayback extraction failed:', error)
      }
    }

    const strongest = candidates.best()
    if (strongest) {
      return withAssessment(strongest, attempts, 'Insufficient content for reliable analysis')
    }
    return { title: 'Error', content: '', error: 'Scraping failed', fallbackAttempts: attempts }
  } finally {
    clearTimeout(totalTimeout)
    if (!totalController.signal.aborted) totalController.abort(new Error('scrape chain completed'))
  }
}
