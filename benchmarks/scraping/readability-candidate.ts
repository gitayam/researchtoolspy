import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import {
  assessArticleQuality,
  type ArticleQualitySignals,
} from '../../functions/api/_shared/article-extractor'

export const READABILITY_CANDIDATE_VERSION = 'readability.0.6.0+linkedom.0.18.13' as const

export interface ReadabilityCandidateResult {
  extractorVersion: typeof READABILITY_CANDIDATE_VERSION
  title?: string
  text: string
  qualitySignals: ArticleQualitySignals
}

/** Offline benchmark adapter. It never fetches or executes page scripts. */
export function extractWithReadability(html: string, url: string): ReadabilityCandidateResult {
  const { document } = parseHTML(html)
  const base = document.createElement('base')
  base.setAttribute('href', url)
  document.head?.prepend(base)
  // Readability mutates the DOM, so collect structural evidence first.
  const paragraphCount = document.querySelectorAll('p').length
  const parsed = new Readability(document as unknown as Document, {
    charThreshold: 40,
    maxElemsToParse: 50_000,
  }).parse()
  const text = parsed?.textContent?.replace(/[ \t]+\n/g, '\n').trim() ?? ''
  const title = parsed?.title?.trim() || undefined
  const wordCount = text ? text.split(/\s+/).length : 0
  return {
    extractorVersion: READABILITY_CANDIDATE_VERSION,
    title,
    text,
    qualitySignals: assessArticleQuality(html, text, wordCount, paragraphCount, Boolean(title)),
  }
}
