import { test, expect } from '@playwright/test'
import Ajv from 'ajv'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  eventSortKey,
  hasTemporalDisagreement,
  validateTimePoint,
  workingOrEarliestPoint,
  type TemporalClaimV2,
  type TimelineAnalysisResponseV2,
  type TimelineEventV2,
} from '../../../functions/api/_shared/timeline-contract-v2'
import {
  liftV1EventToV2,
  projectionMisleads,
  projectV2ToV1,
} from '../../../functions/api/_shared/timeline-contract-v2-compat'

const instant = (value: string, precision: TemporalClaimV2 extends never ? never : Parameters<typeof validateTimePoint>[0]['precision'], extra = {}): TemporalClaimV2 =>
  ({ kind: 'instant', at: { value, precision, ...extra } })

function event(id: string, claims: TemporalClaimV2[], extra: Partial<TimelineEventV2> = {}): TimelineEventV2 {
  return {
    id, title: id, description: null, category: 'event', importance: 'normal',
    assertions: claims.map((claim, index) => ({ id: `${id}-a${index + 1}`, claim })),
    ...extra,
  }
}

const response = (events: TimelineEventV2[]): TimelineAnalysisResponseV2 => ({
  schemaVersion: 'timeline-analysis.v2', requestId: 'req-1', outcome: 'events',
  article: { url: 'https://example.com/a', title: 'A', domain: 'example.com' },
  events, extraction: {}, model: {},
})

const schema = JSON.parse(readFileSync(fileURLToPath(new URL('../../../docs/api/schemas/timeline-analysis.v2.schema.json', import.meta.url)), 'utf8'))
const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile(schema)

test.describe('timeline-analysis.v2 contracts @smoke', () => {
  test('a point must match the precision it declares, and no zone is inferred', () => {
    expect(validateTimePoint({ value: '1979', precision: 'year' })).toEqual({ ok: true })
    expect(validateTimePoint({ value: '2026-09-14T12:30:00.123', precision: 'millisecond' })).toEqual({ ok: true })

    // v1 could not say any of these; v2 must not accept a mismatched shape either.
    expect(validateTimePoint({ value: '1979-04-02', precision: 'year' }).ok).toBe(false)
    expect(validateTimePoint({ value: '1979', precision: 'day' }).ok).toBe(false)
    expect(validateTimePoint({ value: '2026-09-14T12:30', precision: 'second' }).ok).toBe(false)

    // Absent timezone means the source did not say, which is not the same as UTC.
    expect(validateTimePoint({ value: '2026-09-14', precision: 'day' }).ok).toBe(true)
    expect(validateTimePoint({ value: '2026-09-14', precision: 'day', timezone: '' }).ok).toBe(false)
  })

  test('lifting v1 is lossless and claims no analyst judgement', () => {
    const lifted = liftV1EventToV2(
      { eventDate: '2026-09-14', datePrecision: 'day', title: 'Rollback', description: 'desc', category: 'event', importance: 'high' },
      'e1',
    )
    expect(lifted.assertions).toHaveLength(1)
    expect(lifted.assertions[0].claim).toEqual({ kind: 'instant', at: { value: '2026-09-14', precision: 'day' } })
    // No working time: v1 records no analyst choice, and inventing one would dress a
    // machine-extracted date up as a reviewed judgement.
    expect(lifted.workingTime).toBeUndefined()

    const back = projectV2ToV1(response([lifted]))
    expect(back.losses).toEqual([])
    expect(back.events[0]).toMatchObject({ eventDate: '2026-09-14', datePrecision: 'day', title: 'Rollback' })
  })

  test('competing source times are retained, not resolved', () => {
    const disputed = event('e1', [instant('2026-09-14', 'day'), instant('2026-09-15', 'day')])
    expect(hasTemporalDisagreement(disputed)).toBe(true)
    expect(disputed.assertions).toHaveLength(2)

    // A working time cites the assertions and leaves both standing.
    const decided: TimelineEventV2 = {
      ...disputed,
      workingTime: { claim: instant('2026-09-14', 'day'), citesAssertionIds: ['e1-a1'], rationale: 'Primary source' },
    }
    expect(decided.assertions).toHaveLength(2)
    expect(workingOrEarliestPoint(decided)!.value).toBe('2026-09-14')
    expect(hasTemporalDisagreement(decided)).toBe(true)
  })

  test('projecting to v1 reports every loss instead of hiding it', () => {
    const approximate = event('circa', [instant('1979', 'year', { approximate: true })])
    const precise = event('precise', [instant('2026-09-14T12:30:00.123', 'millisecond', { timezone: 'America/New_York' })])
    const disputed = event('disputed', [instant('2026-09-14', 'day'), instant('2026-09-15', 'day')])
    const relative = event('relative', [{ kind: 'relative', relation: 'after', anchorRef: 'circa' }])
    const unknown = event('unknown', [{ kind: 'unknown', reason: 'source gave no date' }])

    const projection = projectV2ToV1(response([approximate, precise, disputed, relative, unknown]))

    // Relative and unknown cannot be dated, so they are omitted rather than invented.
    expect(projection.events.map(e => e.title)).toEqual(['circa', 'precise', 'disputed'])
    const omitted = projection.losses.filter(l => l.kind === 'omitted-no-date').map(l => l.eventId)
    expect(omitted).toEqual(['relative', 'unknown'])

    expect(projection.losses.find(l => l.eventId === 'precise' && l.kind === 'precision-reduced')).toBeTruthy()
    expect(projection.losses.find(l => l.eventId === 'precise' && l.kind === 'timezone-dropped')).toBeTruthy()
    expect(projection.events[1].eventDate).toBe('2026-09-14')
    expect(projection.events[1].datePrecision).toBe('day')

    // The dangerous one: v1 has no circa, so the value survives looking exact.
    const dropped = projection.losses.find(l => l.eventId === 'circa' && l.kind === 'approximation-dropped')
    expect(dropped).toBeTruthy()
    expect(dropped!.detail).toContain('reads it as exact')

    expect(projection.losses.find(l => l.eventId === 'disputed' && l.kind === 'variants-discarded')).toBeTruthy()
    expect(projectionMisleads(projection)).toBe(true)
  })

  test('a faithful projection is not flagged as misleading', () => {
    const plain = event('plain', [instant('2026-09-14', 'day')])
    const projection = projectV2ToV1(response([plain]))
    expect(projection.losses).toEqual([])
    expect(projectionMisleads(projection)).toBe(false)
  })

  test('sorting is deterministic and never drops an undatable event', () => {
    const year = event('year', [instant('1979', 'year')])
    const day = event('day', [instant('1979-04-02', 'day')])
    const unknown = event('unknown', [{ kind: 'unknown' }])

    // A year sorts at the start of its year; it is ordering, not a claim about the time.
    expect(eventSortKey(year)).toBe('1979-01-01T00:00:00.000')
    expect(eventSortKey(day)).toBe('1979-04-02T00:00:00.000')
    expect(eventSortKey(year) < eventSortKey(day)).toBe(true)

    // Undatable events sort last, deterministically, rather than vanishing.
    const order = [unknown, day, year].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))).map(e => e.id)
    expect(order).toEqual(['year', 'day', 'unknown'])
  })

  test('the published schema accepts what the implementation produces and rejects what it forbids', () => {
    const valid = response([
      event('instant', [instant('2026-09-14T12:30:00.123', 'millisecond', { timezone: 'America/New_York', displayText: 'just after 12:30' })]),
      event('circa', [instant('1979', 'year', { approximate: true })]),
      event('interval', [{ kind: 'interval', start: { value: '2026-09', precision: 'month' }, end: { value: '2026-10', precision: 'month' } }]),
      event('relative', [{ kind: 'relative', relation: 'after', anchorRef: 'instant' }]),
      event('unknown', [{ kind: 'unknown', reason: 'source gave no date' }]),
      {
        ...event('decided', [instant('2026-09-14', 'day'), instant('2026-09-15', 'day')]),
        workingTime: { claim: instant('2026-09-14', 'day'), citesAssertionIds: ['decided-a1'], rationale: 'Primary source' },
      },
    ])
    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true)

    // The core invariant: a point's text must match the precision it declares.
    const mismatched = response([event('bad', [instant('1979-04-02', 'year')])])
    expect(validate(mismatched)).toBe(false)

    // An event must carry at least one assertion; silence is not a claim.
    const noAssertions = response([{ ...event('empty', []), assertions: [] }])
    expect(validate(noAssertions)).toBe(false)

    // A working time must cite what it rests on.
    const uncited = response([{
      ...event('uncited', [instant('2026-09-14', 'day')]),
      workingTime: { claim: instant('2026-09-14', 'day'), citesAssertionIds: [] },
    }])
    expect(validate(uncited)).toBe(false)

    // A v1 response is not a v2 response.
    expect(validate({ ...valid, schemaVersion: 'timeline-analysis.v1' })).toBe(false)
  })
})
