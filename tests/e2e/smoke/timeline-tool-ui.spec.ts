import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openContentTimelineSection(page: Page) {
  const mobileNavigation = page.getByRole('button', { name: 'Open analysis sections' })
  if (await mobileNavigation.isVisible()) {
    await mobileNavigation.click()
    await page.getByRole('dialog').getByText('Timeline', { exact: true }).click()
  } else {
    await page.getByText('Timeline', { exact: true }).click()
  }
}

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

async function openArticleTimeline(page: Page): Promise<void> {
  await page.goto('/dashboard/tools/timeline')
  await page.getByRole('button', { name: 'Extract an article' }).click()
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

    await openArticleTimeline(page)
    await expect(page.getByRole('heading', { name: 'Timeline Analysis' })).toBeVisible()
    await expect(page.getByText('No login is required.')).toBeVisible()
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()

    await expect(page.getByRole('heading', { name: 'A source-backed event occurred' })).toBeVisible()
    expect(timelineRequest).not.toBeNull()
    expect(timelineRequest!.headers['x-guest-session']).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect(timelineRequest!.body).toEqual({ schemaVersion: 'timeline-analysis.v1', url: articleUrl })
  })

  test('@smoke results can be sorted latest or oldest and include jump navigation', async ({ page }) => {
    const sortableResponse = {
      ...timelineResponse,
      requestId: 'req-ui-sort',
      events: [
        { ...timelineResponse.events[0], eventDate: '2026-09-01', title: 'Oldest event' },
        { ...timelineResponse.events[0], eventDate: '2026-09-03', title: 'Middle event' },
        { ...timelineResponse.events[0], eventDate: '2026-09-08', title: 'Latest event' },
      ],
    }
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/tools/extract-timeline', route => route.fulfill({ status: 200, json: sortableResponse }))

    await openArticleTimeline(page)
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()

    await expect(page.getByLabel('Timeline sections').getByRole('link')).toHaveText(['Overview', 'Event sequence'])
    await expect(page.getByLabel('Timeline events').getByRole('link')).toHaveText([
      /2026-09-01.*Oldest event/,
      /2026-09-03.*Middle event/,
      /2026-09-08.*Latest event/,
    ])
    await expect(page.locator('#timeline-sequence ol h3')).toHaveText(['Oldest event', 'Middle event', 'Latest event'])

    await page.getByLabel('Sort events').selectOption('latest')
    await expect(page.getByLabel('Timeline events').getByRole('link')).toHaveText([
      /2026-09-08.*Latest event/,
      /2026-09-03.*Middle event/,
      /2026-09-01.*Oldest event/,
    ])
    await expect(page.locator('#timeline-sequence ol h3')).toHaveText(['Latest event', 'Middle event', 'Oldest event'])
    await expect(page.getByLabel('Timeline events').getByRole('link').first()).toHaveAttribute('href', '#timeline-event-source-req-ui-sort-2')

    await page.getByRole('button', { name: 'Robust analyst' }).click()
    await expect(page.getByLabel('Timeline sections').getByRole('link')).toHaveText([
      'Overview',
      'AI review',
      'Event sequence',
      'Continue investigation',
    ])
  })

  test('@smoke timeline supports basic edits and robust analyst questions without changing source provenance', async ({ page }) => {
    // Complete multi-dialog authoring and research handoff; mobile WebKit needs
    // time for every interaction. Individual assertion timeouts remain unchanged.
    test.slow()
    const assistActions: string[] = []
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.route('**/api/tools/extract-timeline', route => route.fulfill({ status: 200, json: timelineResponse }))
    await page.route('**/api/tools/timeline-assist', async route => {
      const body = route.request().postDataJSON() as {
        action: string
        events: Array<{ id: string }>
      }
      assistActions.push(body.action)
      const hypothesis = body.action === 'generate_hypotheses'
      await route.fulfill({
        status: 200,
        json: {
          schemaVersion: 'timeline-assist.v1',
          requestId: `assist-${assistActions.length}`,
          action: body.action,
          outcome: 'suggestions',
          suggestions: [{
            id: `ai-suggestion-${assistActions.length}`,
            kind: hypothesis ? 'hypothesis' : 'question',
            content: hypothesis
              ? 'A coordination meeting may explain the reporting gap.'
              : 'Which documented actions occurred during the reporting gap?',
            rationale: hypothesis
              ? 'Seek meeting records that could falsify this explanation.'
              : 'The chronology moves between events without an observed transition.',
            afterEventId: body.events[0].id,
            beforeEventId: body.events[1].id,
          }],
          model: { name: 'test-model', status: 'ok', rejectedSuggestionCount: 0 },
        },
      })
    })

    await openArticleTimeline(page)
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()

    await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Actions for A source-backed event occurred' }).click()
    await page.getByRole('menuitem', { name: 'Add event before' }).click()
    await expect(page.getByLabel('Placement')).toHaveValue('relative')
    await expect(page.getByRole('dialog').getByLabel('Relation', { exact: true })).toHaveValue('before')
    await expect(page.getByLabel('Reference event')).toHaveValue('source-req-ui-smoke-0')
    await page.getByLabel('Date').fill('2026-02-31')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Analyst supplied precursor')
    await page.getByRole('button', { name: 'Save event' }).click()
    await expect(page.getByRole('alert')).toContainText('Use a real date')
    await page.getByLabel('Date').fill('2026-09-01')
    await page.getByLabel('Description').fill('Added manually to test the suspected lead-up.')
    await page.getByRole('button', { name: 'Save event' }).click()

    await expect(page.getByRole('heading', { name: 'Analyst supplied precursor' })).toBeVisible()
    await expect(page.getByText('Analyst added')).toBeVisible()
    await expect(page.getByText('Source', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Actions for Analyst supplied precursor' }).click()
    await expect(page.getByRole('menuitem', { name: 'Add event after' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Robust analyst' }).click()
    await expect(page.getByRole('button', { name: 'Robust analyst' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible()

    await page.getByRole('button', { name: 'Actions for A source-backed event occurred' }).click()
    await page.getByRole('menuitem', { name: 'Edit event' }).click()
    await expect(page.getByLabel('Assessment').locator('option[value="corroborated"]')).toBeDisabled()
    await page.getByLabel('Assessment').selectOption('disputed')
    await page.getByLabel('Analyst note').fill('Conflicting reports require evidence review.')
    await page.getByRole('button', { name: 'Save event' }).click()
    await expect(page.getByText('Conflicting reports require evidence review.')).toBeVisible()
    await expect(page.getByText('Disputed', { exact: true })).toBeVisible()
    await expect(page.getByText('Source · edited')).toHaveCount(0)

    await expect(page.getByLabel('AI task')).toHaveValue('identify_gaps')
    await page.getByRole('button', { name: 'Run AI review' }).click()
    await expect(page.getByText('Which documented actions occurred during the reporting gap?')).toBeVisible()
    await page.getByLabel('AI suggestions').getByRole('button', { name: 'Add question' }).click()
    await expect(page.getByText('Which documented actions occurred during the reporting gap?')).toBeVisible()

    await page.getByLabel('AI task').selectOption('generate_hypotheses')
    await page.getByRole('button', { name: 'Run AI review' }).click()
    await page.getByLabel('AI suggestions').getByRole('button', { name: 'Keep hypothesis' }).click()
    await expect(page.getByText('A coordination meeting may explain the reporting gap.')).toBeVisible()
    await expect(page.getByText('AI working hypothesis')).toBeVisible()
    expect(assistActions).toEqual(['identify_gaps', 'generate_hypotheses'])

    const betweenGap = page.getByText('between 2026-09-01 and 2026-09-03').locator('..')
    await betweenGap.getByRole('button', { name: 'What happened here?' }).click()
    await expect(page.getByRole('dialog')).toContainText('Record an information gap without inventing an event.')
    await page.getByRole('textbox', { name: 'Question', exact: true }).fill('What happened during the two-day reporting gap?')
    await page.getByRole('button', { name: 'Save question' }).click()

    const manualQuestion = page.getByText('What happened during the two-day reporting gap?')
    await expect(manualQuestion).toBeVisible()
    await expect(page.getByText('Information gap', { exact: true }).first()).toBeVisible()

    await manualQuestion.locator('..').locator('..').getByRole('button', { name: 'Edit question' }).click()
    await page.getByLabel('Evidence-backed answer (optional)').fill('A follow-up source documented an intervening meeting.')
    await page.getByLabel('Source URL (optional)').fill('https://records.example/intervening-meeting')
    await page.getByLabel('Source title (optional)').fill('Meeting record')
    await page.getByRole('button', { name: 'Save question' }).click()
    await expect(page.getByText('Answered')).toBeVisible()
    await expect(page.getByText('A follow-up source documented an intervening meeting.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Meeting record' })).toHaveAttribute('href', 'https://records.example/intervening-meeting')
    const researchLink = manualQuestion.locator('..').locator('..').getByRole('link', { name: 'Research this question' })
    await expect(researchLink).toHaveAttribute('href', /\/dashboard\/tools\/collection\?query=What%20happened/)
    const researchPagePromise = page.waitForEvent('popup')
    await researchLink.click()
    const researchPage = await researchPagePromise
    await expect(researchPage.getByLabel('Research Query')).toHaveValue('What happened during the two-day reporting gap?')
    await researchPage.close()
  })

  test('@smoke analyst can start from known events and resume the browser draft', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await expect(page.getByRole('button', { name: 'Start with what you know' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Investigation or timeline title').fill('September reporting gap')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await expect(page.getByRole('button', { name: 'Robust analyst' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Analyst-created', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Add first event' }).click()
    const eventDialog = page.getByRole('dialog')
    await eventDialog.getByLabel('Date').fill('2026-09-01')
    await eventDialog.getByLabel('Title', { exact: true }).fill('Last confirmed public report')
    await page.getByRole('button', { name: 'Save event' }).click()

    await page.getByRole('button', { name: 'Add question', exact: true }).click()
    await page.getByRole('textbox', { name: 'Question', exact: true }).fill('What happened during September?')
    await page.getByRole('button', { name: 'Save question' }).click()

    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('researchtools.timeline.manual-draft.v1')
      if (!raw) return null
      const draft = JSON.parse(raw)
      return {
        version: draft.schemaVersion,
        events: draft.workspace.events.length,
        questions: draft.workspace.questions.length,
      }
    })).toEqual({ version: 'timeline-browser-draft.v1', events: 1, questions: 1 })

    await page.reload()
    await page.getByRole('button', { name: 'Resume draft' }).click()
    await expect(page.getByRole('heading', { name: 'Last confirmed public report' })).toBeVisible()
    await expect(page.getByText('What happened during September?')).toBeVisible()
  })

  test('@smoke analyst can place events by date/time, relation, and sequence position', async ({ page }) => {
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')
    await page.getByLabel('Investigation or timeline title').fill('Mixed precision sequence')
    await page.getByRole('button', { name: 'Create timeline' }).click()

    await page.getByRole('button', { name: 'Add first event' }).click()
    await page.getByLabel('Date').fill('2026-09-01')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Known first event')
    await page.getByRole('button', { name: 'Save event' }).click()

    await page.getByRole('button', { name: 'Add event', exact: true }).click()
    await page.getByLabel('Date').fill('2026-09-10')
    await page.getByRole('dialog').getByLabel('Time', { exact: true }).fill('18:15')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Known later event')
    await page.getByRole('button', { name: 'Save event' }).click()

    await page.getByRole('button', { name: 'Add event', exact: true }).click()
    await page.getByLabel('Placement').selectOption('position')
    await page.getByLabel('Sequence position').selectOption('first')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Sequence-only opening event')
    await page.getByRole('button', { name: 'Save event' }).click()

    await page.getByRole('button', { name: 'Actions for Known first event' }).click()
    await page.getByRole('menuitem', { name: 'Add event after' }).click()
    await expect(page.getByLabel('Placement')).toHaveValue('relative')
    await page.getByRole('dialog').getByLabel('Time (optional)', { exact: true }).fill('14:30')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Time-only relative event')
    await page.getByRole('button', { name: 'Save event' }).click()

    await page.getByRole('button', { name: 'Add event', exact: true }).click()
    await page.getByLabel('Placement').selectOption('position')
    await page.getByLabel('Sequence position').selectOption('custom')
    await page.getByLabel('Position number').fill('2')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Exact second event')
    await page.getByRole('button', { name: 'Save event' }).click()

    await page.getByRole('button', { name: 'Add event', exact: true }).click()
    await page.getByLabel('Placement').selectOption('position')
    await expect(page.getByLabel('Sequence position').locator('option')).toHaveText([
      'First',
      'Second',
      'Third',
      'Second to last',
      'Last',
      'Exact position…',
    ])
    await page.getByLabel('Sequence position').selectOption('second_to_last')
    await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Second-to-last event')
    await page.getByRole('button', { name: 'Save event' }).click()

    await expect(page.locator('ol h3')).toHaveText([
      'Sequence-only opening event',
      'Exact second event',
      'Known first event',
      'Time-only relative event',
      'Second-to-last event',
      'Known later event',
    ])
    await expect(page.locator('#timeline-sequence').getByText('14:30 (date unknown)', { exact: true })).toBeVisible()
    await expect(page.getByText('Position 1', { exact: true })).toBeVisible()
    await expect(page.getByText('After event', { exact: true })).toBeVisible()

    const draftEvents = await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem('researchtools.timeline.manual-draft.v1') || '{}')
      return draft.workspace.events.map((item: { title: string, sequenceOrder: number, placement?: { mode: string } }) => ({
        title: item.title,
        sequenceOrder: item.sequenceOrder,
        placement: item.placement?.mode,
      }))
    })
    expect(draftEvents).toEqual([
      { title: 'Sequence-only opening event', sequenceOrder: 0, placement: 'position' },
      { title: 'Exact second event', sequenceOrder: 1, placement: 'position' },
      { title: 'Known first event', sequenceOrder: 2, placement: 'absolute' },
      { title: 'Time-only relative event', sequenceOrder: 3, placement: 'relative' },
      { title: 'Second-to-last event', sequenceOrder: 4, placement: 'position' },
      { title: 'Known later event', sequenceOrder: 5, placement: 'absolute' },
    ])
  })

  test('@smoke expired manual browser drafts are discarded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('researchtools.timeline.manual-draft.v1', JSON.stringify({
        schemaVersion: 'timeline-browser-draft.v1',
        expiresAt: '2020-01-01T00:00:00.000Z',
      }))
    })
    await page.route('**/api/workspaces', route => route.fulfill({ status: 200, json: { owned: [], member: [] } }))
    await page.goto('/dashboard/tools/timeline')

    await expect(page.getByRole('button', { name: 'Resume draft' })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('researchtools.timeline.manual-draft.v1'))).toBeNull()
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
    await openContentTimelineSection(page)
    await page.getByRole('button', { name: 'Generate Timeline' }).click()

    await expect(page.getByRole('heading', { name: 'A source-backed event occurred' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Robust analyst' })).toBeVisible()
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

    await openArticleTimeline(page)
    await page.evaluate(() => {
      localStorage.setItem('omnicore_tokens', JSON.stringify({ access_token: 'expired-token' }))
    })
    await page.getByLabel('Article URL').fill(articleUrl)
    await page.getByRole('button', { name: 'Build Timeline' }).click()

    await expect(page.getByRole('heading', { name: 'A source-backed event occurred' })).toBeVisible()
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

    await openArticleTimeline(page)
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
    await openContentTimelineSection(page)
    await page.getByRole('button', { name: 'Generate Timeline' }).click()

    await expect(page.getByLabel('Main content').getByText('This analysis has no extracted article text.')).toBeVisible()
    expect(timelineCalls).toBe(0)
  })
})
