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

    // Use gpt-5-mini for timeline generation (balance of speed and quality)
    const model = 'gpt-5-mini'

    const behaviorContext = getBehaviorFormContext(request)

    const prompt = `Create 5-8 timeline steps for: ${request.behavior_title}

JSON format:
{"events":[{"id":"1","label":"Step","time":"T+0min","description":"...","location":"..."}]}

Keep it brief.`

    // Add timeout handling per lessons learned
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(context.env.OPENAI_ORGANIZATION && { 'OpenAI-Organization': context.env.OPENAI_ORGANIZATION })
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Respond with valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: 800,
          response_format: { type: "json_object" }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI API error:', errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error?.message || 'AI request failed')
        } catch {
          throw new Error(`AI request failed: ${response.status} ${response.statusText}`)
        }
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        console.error('No content in AI response:', { hasChoices: !!data.choices, choicesLength: data.choices?.length })
        throw new Error('No content returned from AI')
      }

      // Parse JSON response with error handling
      let parsed: TimelineGenerationResponse
      try {
        parsed = JSON.parse(content) as TimelineGenerationResponse
      } catch (parseError) {
        console.error('Failed to parse AI response:', content)
        throw new Error('Invalid JSON response from AI: ' + (parseError instanceof Error ? parseError.message : 'Unknown error'))
      }

      const timeline: TimelineEvent[] = parsed.events || []

      // Generate IDs if missing
      timeline.forEach((event, index) => {
        if (!event.id) {
          event.id = `event-${Date.now()}-${index}`
        }
      })

      return Response.json({ events: timeline })

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 25 seconds')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }

  } catch (error) {
    console.error('Timeline generation error:', error)
    return Response.json({
      error: 'Timeline generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
