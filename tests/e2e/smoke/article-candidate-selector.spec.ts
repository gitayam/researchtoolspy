import { expect, test } from '@playwright/test'
import {
  ARTICLE_CANDIDATE_POLICIES,
  assessArticleCandidate,
  createArticleCandidateSelector,
  type ArticleCandidateInput,
} from '../../../functions/api/_shared/article-candidate'
import type { ArticleQualitySignals } from '../../../functions/api/_shared/article-extractor'

function quality(overrides: Partial<ArticleQualitySignals> = {}): ArticleQualitySignals {
  return {
    version: 'article-quality.v2',
    accepted: true,
    score: 80,
    reasons: [],
    paragraphCount: 3,
    textToMarkupRatio: 0.2,
    linkDensity: 0.05,
    ...overrides,
  }
}

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(' ')
}

test.describe('shared article candidate selector @smoke', () => {
  test('@smoke applies purpose-specific length policy', () => {
    const input = { success: true, text: words(100), title: 'A real report' }
    expect(assessArticleCandidate(input, ARTICLE_CANDIDATE_POLICIES['content-intelligence']))
      .toMatchObject({ accepted: false, reason: 'too_short', wordCount: 100 })
    expect(assessArticleCandidate(input, ARTICLE_CANDIDATE_POLICIES.claims))
      .toMatchObject({ accepted: true, wordCount: 100 })
  })

  test('@smoke accepts structured short documents only above the route floor', () => {
    const accepted = assessArticleCandidate({
      success: true,
      text: words(45),
      title: 'Short primary document',
      qualitySignals: quality(),
    }, ARTICLE_CANDIDATE_POLICIES.timeline)
    const rejected = assessArticleCandidate({
      success: true,
      text: words(35),
      title: 'Too short',
      qualitySignals: quality(),
    }, ARTICLE_CANDIDATE_POLICIES.timeline)
    expect(accepted.accepted).toBe(true)
    expect(rejected).toMatchObject({ accepted: false, reason: 'too_short' })
  })

  test('@smoke gives social posts a separate evidence floor', () => {
    expect(assessArticleCandidate({
      success: true,
      text: words(12),
      contentKind: 'social',
    }, ARTICLE_CANDIDATE_POLICIES.claims).accepted).toBe(true)
    expect(assessArticleCandidate({
      success: true,
      text: words(7),
      contentKind: 'social',
    }, ARTICLE_CANDIDATE_POLICIES.claims)).toMatchObject({
      accepted: false,
      reason: 'too_short',
    })
  })

  test('@smoke rejects placeholders, paywalls, and extractor failures', () => {
    expect(assessArticleCandidate({
      success: true,
      title: 'Article from example.com | SMRY',
      text: words(300),
    }, ARTICLE_CANDIDATE_POLICIES.claims).reason).toBe('placeholder')
    expect(assessArticleCandidate({
      success: true,
      text: `Sign in to continue ${words(100)}`,
      blocked: true,
    }, ARTICLE_CANDIDATE_POLICIES.claims).reason).toBe('login_or_paywall')
    expect(assessArticleCandidate({
      success: true,
      text: words(100),
      qualitySignals: quality({ accepted: false, reasons: ['high_link_density'] }),
    }, ARTICLE_CANDIDATE_POLICIES.claims).reason).toBe('extractor_rejected')
  })

  test('@smoke preserves the strongest partial candidate', () => {
    const selector = createArticleCandidateSelector(
      ARTICLE_CANDIDATE_POLICIES.claims,
      (candidate: ArticleCandidateInput & { id: string }) => candidate,
    )
    selector.consider({ id: 'failed', success: false, text: '', errorCode: 'timeout' })
    selector.consider({ id: 'thin-40', success: true, text: words(40) })
    selector.consider({ id: 'thin-70', success: true, text: words(70) })
    expect(selector.best()?.candidate.id).toBe('thin-70')
    expect(selector.best()?.assessment).toMatchObject({ accepted: false, wordCount: 70 })
  })
})
