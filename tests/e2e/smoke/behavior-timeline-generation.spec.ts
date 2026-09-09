import { test, expect } from '@playwright/test'
import {
  buildTimelinePrompt,
  sanitizeGeneratedTimeline,
} from '../../../functions/api/ai/generate-timeline'

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
})
