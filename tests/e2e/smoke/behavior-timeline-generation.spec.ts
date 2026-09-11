import { test, expect } from '@playwright/test'
import {
  buildTimelinePrompt,
  parseTimelineGenerationRequest,
  readBoundedTimelineGenerationJson,
  sanitizeGeneratedTimeline,
  TIMELINE_GENERATION_REQUEST_MAX_BYTES,
} from '../../../functions/api/ai/generate-timeline'
import { ensureUniqueTimelineEventIds } from '../../../src/lib/behavior-timeline-ids'

test.describe('Behavior timeline generation contract @smoke', () => {
  test('uses the full analyst context and existing timeline in the AI prompt', () => {
    const prompt = buildTimelinePrompt({
      behavior_title: 'Enroll in community warnings',
      behavior_description: 'A resident opts into verified local alerts.',
      location_context: {
        geographic_scope: 'local',
        specific_locations: ['Baltimore'],
        location_notes: 'Enrollment can happen at home or at a library.',
      },
      behavior_settings: {
        settings: ['online', 'in_person'],
        setting_details: 'Web form and staffed kiosk',
      },
      temporal_context: {
        frequency_pattern: 'one_time',
        time_of_day: ['evening'],
        duration_typical: '10 minutes',
      },
      complexity: 'simple_sequence',
      existing_timeline: [{
        id: 'known-1',
        label: 'Resident encounters enrollment prompt',
        decision_type: 'goal_formation',
      }],
    })

    expect(prompt).toContain('A resident opts into verified local alerts.')
    expect(prompt).toContain('Baltimore')
    expect(prompt).toContain('Web form and staffed kiosk')
    expect(prompt).toContain('one_time')
    expect(prompt).toContain('Resident encounters enrollment prompt')
    expect(prompt).toContain('psychological_state')
    expect(prompt).toContain('competing_behaviours')
  })

  test('normalizes rich AI output and rejects incomplete or invalid fields', () => {
    const [event] = sanitizeGeneratedTimeline([{
      id: ' event-1 ',
      label: ' Resident forms an intention ',
      decision_type: 'intention',
      psychological_state: {
        stage: 'preparation',
        phase: 'volitional',
        motivation_mode: 'reflective_dominant',
      },
      com_b_target: 'reflective_motivation',
      coping_branches: [
        { obstacle: 'Site is offline', response: 'Call the hotline' },
        { obstacle: '', response: 'Invalid incomplete row' },
      ],
      competing_behaviours: ['Check social media', 'Check social media', '', 42],
      sub_steps: [{ label: 'Review terms', duration: '2 minutes' }, { description: 'No label' }],
      forks: [
        { condition: 'If trust is sufficient', label: 'Enroll', path: [] },
        { condition: '', label: 'Invalid' },
      ],
    }, {
      label: 'Invalid enum values are omitted',
      decision_type: 'not-real',
      psychological_state: {
        stage: 'not-real',
        phase: 'volitional',
        motivation_mode: 'contested',
      },
      com_b_target: 'not-real',
    }])

    expect(event).toEqual({
      id: 'event-1',
      label: 'Resident forms an intention',
      decision_type: 'intention',
      is_decision_point: true,
      psychological_state: {
        stage: 'preparation',
        phase: 'volitional',
        motivation_mode: 'reflective_dominant',
      },
      com_b_target: 'reflective_motivation',
      coping_branches: [{ obstacle: 'Site is offline', response: 'Call the hotline' }],
      competing_behaviours: ['Check social media'],
      sub_steps: [{ label: 'Review terms', duration: '2 minutes' }],
      forks: [{ condition: 'If trust is sufficient', label: 'Enroll', path: [] }],
    })

    const second = sanitizeGeneratedTimeline([{
      label: 'Invalid enum values are omitted',
      decision_type: 'not-real',
      psychological_state: { stage: 'not-real', phase: 'volitional', motivation_mode: 'contested' },
      com_b_target: 'not-real',
    }])[0]
    expect(second.decision_type).toBeUndefined()
    expect(second.psychological_state).toBeUndefined()
    expect(second.com_b_target).toBeUndefined()
  })

  test('makes model event IDs unique across top-level and forked events', () => {
    const timeline = sanitizeGeneratedTimeline([
      {
        id: 'duplicate-id',
        label: 'First event',
        forks: [{
          condition: 'Alternative occurs',
          label: 'Alternative path',
          path: [{ id: 'duplicate-id', label: 'Fork event' }],
        }],
      },
      { id: 'duplicate-id', label: 'Second event' },
    ])

    expect(timeline[0].id).toBe('duplicate-id')
    expect(timeline[0].forks?.[0].path[0].id).toBe('duplicate-id-2')
    expect(timeline[1].id).toBe('duplicate-id-3')
  })

  test('rekeys generated IDs that collide with an existing Behavior timeline', () => {
    const existing = [{ id: 'event-1', label: 'Existing event' }]
    const generated = ensureUniqueTimelineEventIds([
      { id: 'event-1', label: 'Generated event' },
      { id: 'event-1', label: 'Another generated event' },
    ], existing)

    expect(generated.map(event => event.id)).toEqual(['event-1-2', 'event-1-3'])
    expect(existing).toEqual([{ id: 'event-1', label: 'Existing event' }])
  })

  test('bounds and normalizes analyst context before prompt construction', () => {
    const request = parseTimelineGenerationRequest({
      behavior_title: `  ${'T'.repeat(300)}  `,
      behavior_description: 'D'.repeat(5_000),
      location_context: {
        specific_locations: Array.from({ length: 30 }, (_, index) => ` Location ${index} `),
        ignored: 'not accepted',
      },
      existing_timeline: [
        { id: 'same-id', label: 'Known event' },
        { id: 'same-id', label: 'Known event two' },
      ],
      ignored: 'not accepted',
    })

    expect(request?.behavior_title).toHaveLength(240)
    expect(request?.behavior_description).toHaveLength(4_000)
    expect(request?.location_context?.specific_locations).toHaveLength(20)
    expect(request?.location_context?.specific_locations?.[0]).toBe('Location 0')
    expect(request?.existing_timeline?.map(event => event.id)).toEqual(['same-id', 'same-id-2'])
    expect(request).not.toHaveProperty('ignored')
    expect(request?.location_context).not.toHaveProperty('ignored')
  })

  test('rejects malformed and oversized request bodies before parsing', async () => {
    await expect(readBoundedTimelineGenerationJson(new Request('https://researchtools.test/api/ai/generate-timeline', {
      method: 'POST',
      body: '{invalid',
    }))).rejects.toMatchObject({ status: 400 })

    await expect(readBoundedTimelineGenerationJson(new Request('https://researchtools.test/api/ai/generate-timeline', {
      method: 'POST',
      body: JSON.stringify({ value: 'x'.repeat(TIMELINE_GENERATION_REQUEST_MAX_BYTES) }),
    }))).rejects.toMatchObject({ status: 413 })
  })
})
