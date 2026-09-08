import { expect, test } from '@playwright/test'

const articleUrl = 'https://publisher.example/2026/09/story'
const extractedText = Array.from(
  { length: 90 },
  (_, index) => `Evidence sentence ${index} describes the source chronology.`,
).join(' ')

const timelineResponse = {
  schemaVersion: 'timeline-analysis.v1',
  requestId: 'req-ui-smoke',
  outcome: 'events',
  article: {
    url: articleUrl,
    title: 'Test article timeline',
    domain: 'publisher.example',
    publishedAt: '2026-09-08',
  },
  events: [{
    eventDate: '2026-09-03',
    datePrecision: 'day',
    title: 'A source-backed event occurred',
    description: 'The event is supported by the supplied article text.',
    category: 'event',
    importance: 'normal',
  }],
  extraction: {
    contentSource: 'content-intelligence',
    sourceMode: 'supplied',
    method: 'caller-supplied',
    wordCount: 540,
    quality: { version: 'analysis-candidate.v1', score: 100, accepted: true },
    fallbackAttempts: ['content-intelligence'],
  },
  model: { name: 'test-model', status: 'ok', rejectedEventCount: 0 },
}

function contentAnalysisResponse() {
  return {
    url: articleUrl,
    url_normalized: articleUrl,
    content_hash: 'test-content-hash',
    title: 'Test article timeline',
    publish_date: '2026-09-08',
    domain: 'publisher.example',
    is_social_media: false,
    extracted_text: extractedText,
    summary: 'A test article with dated events.',
    word_count: 540,
    content_source: 'original',
    fallback_attempts: ['original'],
    word_frequency: {},
    top_phrases: [],
    keyphrases: [],
    topics: [],
    entities: { people: [], organizations: [], locations: [] },
    links_analysis: [],
    archive_urls: {},
    bypass_urls: {},
    processing_mode: 'normal',
    processing_duration_ms: 20,
    extraction_quality: { thin: false, word_count: 540 },
  }
}

test.describe('Timeline research tool @smoke', () => {
  test('@smoke dedicated tool works as a guest with the versioned contract', async ({ page }) => {
    let timelineRequest: { headers: Record<string, string>, body: Record<string, unknown> } | null = null
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/tools/extract-timeline', async route => {
      timelineRequest = {
        headers: await route.request().allHeaders(),
        body: route.request().postDataJSON(),
      }
      await route.fulfill({ status: 200, json: timelineResponse })
    })

    await page.goto('/dashboard/tools/timeline')
    await expect(page.getByRole('heading', { name: 'Timeline Analysis' })).toBeVisible()
    await expect(page.getByText('No login is required.')).toBeVisible()
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()

    await expect(page.getByText('A source-backed event occurred')).toBeVisible()
    expect(timelineRequest).not.toBeNull()
    expect(timelineRequest!.headers['x-guest-session']).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect(timelineRequest!.body).toEqual({ schemaVersion: 'timeline-analysis.v1', url: articleUrl })
  })

  test('@smoke Content Intelligence reuses extracted text for timeline analysis', async ({ page }) => {
    let timelineBody: {
      schemaVersion?: unknown
      url?: unknown
      content?: { source?: unknown, text?: unknown }
    } | null = null
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/content-intelligence/analyze-url', route => (
      route.fulfill({ status: 200, json: contentAnalysisResponse() })
    ))
    await page.route('**/api/content-intelligence/domain-country', route => (
      route.fulfill({ status: 200, json: { country: null } })
    ))
    await page.route('**/api/tools/extract-timeline', async route => {
      timelineBody = route.request().postDataJSON()
      await route.fulfill({ status: 200, json: timelineResponse })
    })

    await page.goto(`/dashboard/tools/content-intelligence?url=${encodeURIComponent(articleUrl)}`)
    await expect(page.getByPlaceholder('Enter URL to analyze...')).toHaveValue(articleUrl)
    await page.getByRole('button', { name: 'Analyze Content' }).click()
    await expect(page.getByText('A test article with dated events.')).toBeVisible()
    await page.getByText('Timeline', { exact: true }).click()
    await page.getByRole('button', { name: 'Generate Timeline' }).click()

    await expect(page.getByText('A source-backed event occurred')).toBeVisible()
    expect(timelineBody).not.toBeNull()
    expect(timelineBody!.schemaVersion).toBe('timeline-analysis.v1')
    expect(timelineBody!.url).toBe(articleUrl)
    expect(timelineBody!.content.source).toBe('content-intelligence')
    expect(timelineBody!.content.text).toBe(extractedText)
  })

  test('@smoke expired account credentials fall back to an isolated guest request', async ({ page }) => {
    const requests: Record<string, string>[] = []
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/tools/extract-timeline', async route => {
      const headers = await route.request().allHeaders()
      requests.push(headers)
      if (headers.authorization) {
        await route.fulfill({ status: 401, json: { error: 'Authentication required' } })
        return
      }
      await route.fulfill({ status: 200, json: timelineResponse })
    })

    await page.goto('/dashboard/tools/timeline')
    await page.evaluate(() => {
      localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: 'expired-token' }))
    })
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()

    await expect(page.getByText('A source-backed event occurred')).toBeVisible()
    expect(requests).toHaveLength(2)
    expect(requests[0].authorization).toBe('Bearer expired-token')
    expect(requests[1].authorization).toBeUndefined()
    expect(requests[1]['x-guest-session']).toMatch(/^guest_[0-9a-f-]{36}$/)
  })

  test('@smoke no-event and malformed-success responses are handled explicitly', async ({ page }) => {
    let responseBody = {
      ...timelineResponse,
      outcome: 'no_events',
      events: [],
      model: { ...timelineResponse.model, status: 'no_events' },
    }
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/tools/extract-timeline', route => route.fulfill({ status: 200, json: responseBody }))

    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()
    await expect(page.getByText('No supported dated events found')).toBeVisible()

    responseBody = {
      ...timelineResponse,
      events: [{ ...timelineResponse.events[0], eventDate: '2026-02-31' }],
    }
    await page.getByRole('button', { name: 'Regenerate' }).click()
    await expect(page.getByText('Timeline analysis returned an unexpected response.')).toBeVisible()
    await expect(page.getByTestId('timeline-results')).toHaveCount(0)
  })

  test('@smoke Content Intelligence reports empty legacy text without calling the timeline API', async ({ page }) => {
    let timelineCalls = 0
    const emptyAnalysis = { ...contentAnalysisResponse(), extracted_text: '', word_count: 0 }
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/content-intelligence/analyze-url', route => route.fulfill({ status: 200, json: emptyAnalysis }))
    await page.route('**/api/content-intelligence/domain-country', route => route.fulfill({ status: 200, json: { country: null } }))
    await page.route('**/api/tools/extract-timeline', route => {
      timelineCalls += 1
      return route.fulfill({ status: 200, json: timelineResponse })
    })

    await page.goto('/dashboard/tools/content-intelligence')
    await page.getByPlaceholder('Enter URL to analyze...').fill(articleUrl)
    await page.getByRole('button', { name: 'Analyze Content' }).click()
    await page.getByText('Timeline', { exact: true }).click()
    await page.getByRole('button', { name: 'Generate Timeline' }).click()

    await expect(page.getByLabel('Main content').getByText('This analysis has no extracted article text.')).toBeVisible()
    expect(timelineCalls).toBe(0)
  })
})
