/**
 * AI Timeline Generation API
 *
 * Generates detailed timelines for behavior analysis with:
 * - Chronological sequence of steps
 * - Time estimates for each step
 * - Sub-steps for complex actions
 * - Decision points and alternative paths (forks)
 * - Location changes during the behavior
 */

interface Env {
  AI_CONFIG: KVNamespace
  OPENAI_API_KEY?: string
  OPENAI_ORGANIZATION?: string
  ENABLE_AI_FEATURES?: string
}

interface TimelineSubStep {
  label: string
  description?: string
  duration?: string
}

interface TimelineFork {
  condition: string
  label: string
  path: TimelineEvent[]
}

interface TimelineEvent {
  id: string
  label: string
  time?: string
  description?: string
  location?: string
  is_decision_point?: boolean
  sub_steps?: TimelineSubStep[]
  forks?: TimelineFork[]
}

interface TimelineGenerationRequest {
  behavior_title: string
  behavior_description: string
  location_context?: {
    geographic_scope?: string
    specific_locations?: string[]
    location_notes?: string
  }
  behavior_settings?: {
    settings?: string[]
    setting_details?: string
  }
  temporal_context?: {
    frequency_pattern?: string
    time_of_day?: string[]
    duration_typical?: string
    timing_notes?: string
  }
  complexity?: string
  existing_timeline?: TimelineEvent[]
}

interface TimelineGenerationResponse {
  events: TimelineEvent[]
}

function getBehaviorFormContext(formData: Partial<TimelineGenerationRequest>): string {
  let context = `BEHAVIOR: ${formData.behavior_title}\n\n`

  if (formData.behavior_description) {
    context += `DESCRIPTION: ${formData.behavior_description}\n\n`
  }

  if (formData.location_context) {
    context += `LOCATION CONTEXT:\n`
    if (formData.location_context.geographic_scope) {
      context += `- Geographic Scope: ${formData.location_context.geographic_scope}\n`
    }
    if (formData.location_context.specific_locations?.length) {
      context += `- Specific Locations: ${formData.location_context.specific_locations.join(', ')}\n`
    }
    if (formData.location_context.location_notes) {
      context += `- Location Notes: ${formData.location_context.location_notes}\n`
    }
    context += '\n'
  }

  if (formData.behavior_settings?.settings?.length) {
    context += `BEHAVIOR SETTINGS:\n- Settings: ${formData.behavior_settings.settings.join(', ')}\n`
    if (formData.behavior_settings.setting_details) {
      context += `- Details: ${formData.behavior_settings.setting_details}\n`
    }
    context += '\n'
  }

  if (formData.temporal_context) {
    context += `TEMPORAL CONTEXT:\n`
    if (formData.temporal_context.frequency_pattern) {
      context += `- Frequency: ${formData.temporal_context.frequency_pattern}\n`
    }
    if (formData.temporal_context.time_of_day?.length) {
      context += `- Time of Day: ${formData.temporal_context.time_of_day.join(', ')}\n`
    }
    if (formData.temporal_context.duration_typical) {
      context += `- Typical Duration: ${formData.temporal_context.duration_typical}\n`
    }
    if (formData.temporal_context.timing_notes) {
      context += `- Timing Notes: ${formData.temporal_context.timing_notes}\n`
    }
    context += '\n'
  }

  if (formData.complexity) {
    context += `COMPLEXITY: ${formData.complexity}\n\n`
  }

  return context
}

/**
 * POST /api/ai/generate-timeline
 * Generate detailed behavior timeline with AI
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (context.env.ENABLE_AI_FEATURES !== 'true') {
      return Response.json({ error: 'AI features are disabled' }, { status: 403 })
    }

    const apiKey = context.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const request = await context.request.json() as TimelineGenerationRequest

    if (!request.behavior_title) {
      return Response.json({ error: 'Missing behavior_title' }, { status: 400 })
    }

    // Get model configuration
    const config = await context.env.AI_CONFIG.get('default', { type: 'json' }) as any
    const model = config?.useCases?.generation || 'gpt-5-mini'

    const behaviorContext = getBehaviorFormContext(request)

    const prompt = `You are a behavior analysis expert creating a detailed timeline of how a behavior unfolds.

${behaviorContext}

TASK: Create a comprehensive, step-by-step timeline for this behavior.

REQUIREMENTS:
1. Main sequence: List all major steps in chronological order
2. Time estimates: Provide realistic time for each step (HH:MM or relative)
3. Locations: Note where each step occurs if it changes
4. Sub-steps: Break down complex steps into sub-steps
5. Decision points: Mark steps where choices are made
6. Forks: For decision points, provide alternative paths people might take
7. Be specific to the location(s) and context provided

${request.existing_timeline && request.existing_timeline.length > 0 ? `EXISTING TIMELINE TO ENHANCE:\n${JSON.stringify(request.existing_timeline, null, 2)}\n\nEnhance this timeline with more detail, sub-steps, and forks.` : 'Create a new detailed timeline from scratch.'}

OUTPUT FORMAT (strict JSON):
{
  "events": [
    {
      "id": "unique-id",
      "label": "Step name (concise)",
      "time": "HH:MM or T+Xmin or relative",
      "description": "What happens in this step",
      "location": "Where this occurs (if changes)",
      "is_decision_point": false,
      "sub_steps": [
        {
          "label": "Sub-step name",
          "description": "Sub-step detail",
          "duration": "optional time"
        }
      ],
      "forks": [
        {
          "condition": "If X happens / Alternative path",
          "label": "Fork name",
          "path": [
            {
              "id": "fork-step-id",
              "label": "Alternative step",
              "time": "timing",
              "description": "what happens"
            }
          ]
        }
      ]
    }
  ]
}

Generate the timeline now:`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(context.env.OPENAI_ORGANIZATION && { 'OpenAI-Organization': context.env.OPENAI_ORGANIZATION })
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a behavior analysis expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 4000,
        verbosity: 'medium',
        reasoning_effort: 'medium',
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'AI request failed')
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON response
    const parsed = JSON.parse(content) as TimelineGenerationResponse
    const timeline: TimelineEvent[] = parsed.events || []

    // Generate IDs if missing
    timeline.forEach((event, index) => {
      if (!event.id) {
        event.id = `event-${Date.now()}-${index}`
      }
    })

    return Response.json({ events: timeline })

  } catch (error) {
    console.error('Timeline generation error:', error)
    return Response.json({
      error: 'Timeline generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
