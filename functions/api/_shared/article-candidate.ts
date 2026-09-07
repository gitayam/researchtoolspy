import type { ArticleQualitySignals } from './article-extractor'
import type { NormalizedScrapeError } from './scrape-contract'

export type ArticleAnalysisPurpose =
  | 'content-intelligence'
  | 'claims'
  | 'timeline'
  | 'rage-check'
  | 'enrichment'

export const ARTICLE_CANDIDATE_POLICY_VERSION = 'analysis-candidate.v1' as const

export type ArticleCandidateRejectionReason =
  | 'fetch_failed'
  | 'empty'
  | 'too_short'
  | 'login_or_paywall'
  | 'placeholder'
  | 'extractor_rejected'

export interface ArticleCandidatePolicy {
  version: typeof ARTICLE_CANDIDATE_POLICY_VERSION
  purpose: ArticleAnalysisPurpose
  minimumWords: number
  minimumStructuredWords?: number
  minimumSocialWords?: number
}

export const ARTICLE_CANDIDATE_POLICIES: Record<ArticleAnalysisPurpose, ArticleCandidatePolicy> = {
  'content-intelligence': {
    version: ARTICLE_CANDIDATE_POLICY_VERSION, purpose: 'content-intelligence', minimumWords: 150,
  },
  claims: {
    version: ARTICLE_CANDIDATE_POLICY_VERSION, purpose: 'claims',
    minimumWords: 80, minimumStructuredWords: 40, minimumSocialWords: 12,
  },
  timeline: {
    version: ARTICLE_CANDIDATE_POLICY_VERSION, purpose: 'timeline', minimumWords: 80, minimumStructuredWords: 40,
  },
  'rage-check': {
    version: ARTICLE_CANDIDATE_POLICY_VERSION, purpose: 'rage-check',
    minimumWords: 80, minimumStructuredWords: 40, minimumSocialWords: 8,
  },
  enrichment: {
    version: ARTICLE_CANDIDATE_POLICY_VERSION, purpose: 'enrichment',
    minimumWords: 1, minimumStructuredWords: 1, minimumSocialWords: 1,
  },
}

export interface ArticleCandidateInput {
  success: boolean
  text: string
  title?: string
  blocked?: boolean
  contentKind?: 'article' | 'social'
  errorCode?: NormalizedScrapeError
  qualitySignals?: ArticleQualitySignals
}

export interface ArticleCandidateAssessment {
  version: typeof ARTICLE_CANDIDATE_POLICY_VERSION
  policy: ArticleAnalysisPurpose
  accepted: boolean
  errorCode?: NormalizedScrapeError
  reason?: ArticleCandidateRejectionReason
  wordCount: number
  score: number
}

const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length

function isPlaceholder(input: ArticleCandidateInput): boolean {
  const title = input.title?.trim() ?? ''
  const sample = `${title}\n${input.text.slice(0, 1_500)}`
  return /article from .+\|\s*smry|fetching the article|loading (?:the )?article|reaching the source/i.test(sample)
}

function extractorRejected(input: ArticleCandidateInput): boolean {
  const reasons = input.qualitySignals?.reasons ?? []
  return reasons.some(reason => (
    reason === 'login_or_paywall'
    || reason === 'high_link_density'
    || reason === 'low_text_density'
  ))
}

export function assessArticleCandidate(
  input: ArticleCandidateInput,
  policy: ArticleCandidatePolicy,
): ArticleCandidateAssessment {
  const wordCount = countWords(input.text)
  const identity = { version: policy.version, policy: policy.purpose }
  const baseScore = input.qualitySignals?.score
    ?? Math.round(Math.min(100, (wordCount / Math.max(1, policy.minimumWords)) * 100))

  if (!input.success) {
    return {
      ...identity,
      accepted: false,
      errorCode: input.errorCode ?? 'extract_failed',
      reason: 'fetch_failed',
      wordCount,
      score: 0,
    }
  }
  if (wordCount === 0) {
    return { ...identity, accepted: false, errorCode: 'quality_rejected', reason: 'empty', wordCount, score: 0 }
  }
  if (input.blocked || input.qualitySignals?.reasons.includes('login_or_paywall')) {
    return {
      ...identity,
      accepted: false,
      errorCode: 'quality_rejected',
      reason: 'login_or_paywall',
      wordCount,
      score: Math.min(baseScore, 20),
    }
  }
  if (isPlaceholder(input)) {
    return {
      ...identity,
      accepted: false,
      errorCode: 'quality_rejected',
      reason: 'placeholder',
      wordCount,
      score: Math.min(baseScore, 20),
    }
  }
  if (extractorRejected(input)) {
    return {
      ...identity,
      accepted: false,
      errorCode: 'quality_rejected',
      reason: 'extractor_rejected',
      wordCount,
      score: Math.min(baseScore, 35),
    }
  }

  const minimumWords = input.contentKind === 'social'
    ? (policy.minimumSocialWords ?? policy.minimumWords)
    : policy.minimumWords
  const structuredShortAccepted = input.contentKind !== 'social'
    && input.qualitySignals?.accepted === true
    && wordCount >= (policy.minimumStructuredWords ?? Number.POSITIVE_INFINITY)

  if (wordCount < minimumWords && !structuredShortAccepted) {
    return {
      ...identity,
      accepted: false,
      errorCode: 'quality_rejected',
      reason: 'too_short',
      wordCount,
      score: baseScore,
    }
  }

  return { ...identity, accepted: true, wordCount, score: baseScore }
}

export interface AssessedArticleCandidate<T> {
  candidate: T
  assessment: ArticleCandidateAssessment
}

export interface ArticleCandidateSelector<T> {
  consider(candidate: T): AssessedArticleCandidate<T>
  best(): AssessedArticleCandidate<T> | null
}

function candidateRank(assessment: ArticleCandidateAssessment): number {
  const usable = assessment.reason !== 'fetch_failed' && assessment.reason !== 'empty'
  return (assessment.accepted ? 1_000_000 : 0)
    + (usable ? 100_000 : 0)
    + assessment.score * 1_000
    + Math.min(assessment.wordCount, 999)
}

/**
 * Track the strongest evidence observed while each route retains ownership of
 * transport, provider policy, response shape, and the decision to continue.
 */
export function createArticleCandidateSelector<T>(
  policy: ArticleCandidatePolicy,
  project: (candidate: T) => ArticleCandidateInput,
): ArticleCandidateSelector<T> {
  let strongest: AssessedArticleCandidate<T> | null = null

  return {
    consider(candidate) {
      const assessed = { candidate, assessment: assessArticleCandidate(project(candidate), policy) }
      if (!strongest || candidateRank(assessed.assessment) > candidateRank(strongest.assessment)) {
        strongest = assessed
      }
      return assessed
    },
    best() {
      return strongest
    },
  }
}
