import { expect, test } from '@playwright/test'
import { observeTimelineAnalysis } from '../../../functions/api/tools/_timeline-observability'

test.describe('timeline observability @smoke', () => {
  test('@smoke emits one attempt and exactly one privacy-safe terminal metric', async () => {
    const points: Array<{ indexes?: string[]; blobs?: string[]; doubles?: number[] }> = []
    const value = await observeTimelineAnalysis({
      requestId: 'req-timeline-observation-1234',
      url: 'https://publisher.example/private-path?token=secret',
      tenantScope: 'community-sensitive-name',
      telemetryKey: 'dedicated-timeline-telemetry-key',
      analytics: { writeDataPoint: point => points.push(point) },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'extract',
        strategy: 'supplied',
        provider: 'none',
        outcome: 'succeeded',
        contentTypeClass: 'text',
        durationMs: 4,
        responseBytes: 900,
        extractedWords: 120,
      })
      return {
        value: 'complete',
        terminal: {
          outcome: 'succeeded',
          terminalStage: 'ai',
          finalStrategy: 'supplied',
          qualityScore: 0.9,
          accepted: true,
        },
      }
    })

    expect(value).toBe('complete')
    expect(points).toHaveLength(2)
    expect(points[0]?.blobs?.slice(0, 4)).toEqual([
      'scrape.metric.v1', 'attempt', 'tools-scrape', 'timeline-analysis',
    ])
    expect(points[1]?.blobs?.slice(0, 4)).toEqual([
      'scrape.metric.v1', 'terminal', 'tools-scrape', 'timeline-analysis',
    ])
    expect(points[1]?.doubles?.[1]).toBe(1)
    const serialized = JSON.stringify(points)
    expect(serialized).not.toContain('private-path')
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('community-sensitive-name')
  })

  test('@smoke emits a terminal failure when execution throws', async () => {
    const points: Array<{ blobs?: string[] }> = []
    await expect(observeTimelineAnalysis({
      requestId: 'req-timeline-observation-throw',
      url: 'https://publisher.example/article',
      tenantScope: 'community-example',
      telemetryKey: 'dedicated-timeline-telemetry-key',
      analytics: { writeDataPoint: point => points.push(point) },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'fetch',
        strategy: 'archive',
        provider: 'none',
        outcome: 'succeeded',
        durationMs: 2,
      })
      throw new Error('model failed')
    })).rejects.toThrow('model failed')

    expect(points).toHaveLength(2)
    expect(points[1]?.blobs?.[1]).toBe('terminal')
    expect(points[1]?.blobs?.[4]).toBe('failed')
    expect(points[1]?.blobs?.[5]).toBe('internal_error')
    expect(points[1]?.blobs?.[7]).toBe('archive')
  })
})
