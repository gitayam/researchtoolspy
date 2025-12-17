/**
 * AI Context Aggregation
 *
 * Provides comprehensive context to AI assistants by gathering
 * all available form data to generate coherent, contextually-aware suggestions.
 */

import type { BehaviorAnalysis } from '@/types/behavior'

/**
 * Aggregates all available form data into a context string for AI
 */
export function getBehaviorFormContext(formData: Partial<BehaviorAnalysis>): string {
  const context: string[] = []

  // Title and Description
  if (formData.title) {
    context.push(`BEHAVIOR: ${formData.title}`)
  }
  if (formData.description) {
    context.push(`DESCRIPTION: ${formData.description}`)
  }

  // Location Context - CRITICAL
  if (formData.location_context) {
    const loc = formData.location_context
    context.push(`\nLOCATION CONTEXT:`)
    context.push(`- Geographic Scope: ${loc.geographic_scope}`)
    if (loc.specific_locations && loc.specific_locations.length > 0) {
      context.push(`- Specific Locations: ${loc.specific_locations.join(', ')}`)
    }
    if (loc.location_notes) {
      context.push(`- Location Notes: ${loc.location_notes}`)
    }
  }

  // Behavior Settings
  if (formData.behavior_settings && formData.behavior_settings.settings.length > 0) {
    context.push(`\nBEHAVIOR SETTINGS:`)
    context.push(`- Where/How: ${formData.behavior_settings.settings.join(', ')}`)
    if (formData.behavior_settings.setting_details) {
      context.push(`- Details: ${formData.behavior_settings.setting_details}`)
    }
  }

  // Temporal Context
  if (formData.temporal_context) {
    const temp = formData.temporal_context
    if (temp.frequency_pattern || temp.time_of_day || temp.duration_typical) {
      context.push(`\nTIMING:`)
      if (temp.frequency_pattern) {
        context.push(`- Frequency: ${temp.frequency_pattern}`)
      }
      if (temp.time_of_day && temp.time_of_day.length > 0) {
        context.push(`- Time of Day: ${temp.time_of_day.join(', ')}`)
      }
      if (temp.duration_typical) {
        context.push(`- Typical Duration: ${temp.duration_typical}`)
      }
      if (temp.timing_notes) {
        context.push(`- Timing Notes: ${temp.timing_notes}`)
      }
    }
  }

  // Eligibility Requirements
  if (formData.eligibility?.has_requirements) {
    const elig = formData.eligibility
    context.push(`\nELIGIBILITY REQUIREMENTS:`)
    if (elig.age_requirements) context.push(`- Age: ${elig.age_requirements}`)
    if (elig.legal_requirements) context.push(`- Legal: ${elig.legal_requirements}`)
    if (elig.skill_requirements) context.push(`- Skills: ${elig.skill_requirements}`)
    if (elig.resource_requirements) context.push(`- Resources: ${elig.resource_requirements}`)
    if (elig.other_requirements) context.push(`- Other: ${elig.other_requirements}`)
  }

  // Complexity
  if (formData.complexity) {
    context.push(`\nCOMPLEXITY: ${formData.complexity}`)
  }

  // Timeline
  if (formData.timeline && formData.timeline.length > 0) {
    context.push(`\nBEHAVIOR TIMELINE:`)
    formData.timeline.forEach((event, index) => {
      const timeStr = event.time ? ` (${event.time})` : ''
      context.push(`${index + 1}. ${event.label}${timeStr}`)
      if (event.description) {
        context.push(`   ${event.description}`)
      }
      if (event.sub_steps && event.sub_steps.length > 0) {
        event.sub_steps.forEach(sub => {
          context.push(`   - ${sub.label}`)
        })
      }
    })
  }

  // Section Data
  const sectionOrder = [
    'environmental_factors',
    'social_context',
    'consequences',
    'symbols',
    'observed_patterns',
    'potential_audiences'
  ]

  const sectionLabels: Record<string, string> = {
    environmental_factors: 'ENVIRONMENTAL FACTORS',
    social_context: 'SOCIAL & CULTURAL CONTEXT',
    consequences: 'CONSEQUENCES & OUTCOMES',
    symbols: 'SYMBOLS & SIGNALS',
    observed_patterns: 'OBSERVED PATTERNS',
    potential_audiences: 'POTENTIAL TARGET AUDIENCES'
  }

  sectionOrder.forEach(sectionKey => {
    const sectionData = (formData as any)[sectionKey]
    if (sectionData && Array.isArray(sectionData) && sectionData.length > 0) {
      context.push(`\n${sectionLabels[sectionKey]}:`)
      sectionData.forEach((item: any, index: number) => {
        const text = item.text || item.description || item.content || JSON.stringify(item)
        context.push(`${index + 1}. ${text}`)
      })
    }
  })

  return context.join('\n')
}

/**
 * Creates a context-aware AI prompt for a specific field/section
 */
export function createContextAwarePrompt(
  task: string,
  formData: Partial<BehaviorAnalysis>,
  sectionName?: string
): string {
  const context = getBehaviorFormContext(formData)

  const sectionGuidance: Record<string, string> = {
    environmental_factors: `
Focus on physical/environmental context:
- Infrastructure (buildings, roads, facilities)
- Resources available (equipment, materials, spaces)
- Accessibility considerations
- Physical constraints or enablers
- Environmental conditions (weather, climate, terrain)`,

    social_context: `
Focus on social/cultural context:
- Cultural norms and values
- Social influences (family, peers, community)
- Community leaders or influencers
- Group dynamics and social pressure
- Communication patterns`,

    consequences: `
Focus on outcomes and consequences:
- Immediate results of the behavior
- Long-term outcomes
- Rewards (intrinsic and extrinsic)
- Costs or penalties
- Unintended consequences`,

    symbols: `
Focus on symbolic/signal aspects:
- Visual symbols or icons
- Auditory cues or signals
- Social status indicators
- Cultural meanings
- Gestures or rituals`,

    observed_patterns: `
Focus on behavioral variations:
- Common sequences or paths
- Alternative ways people do this
- Shortcuts or workarounds
- Variations by subgroup
- Adaptations to constraints`,

    potential_audiences: `
Focus on identifying audience segments:
- Who currently does this behavior?
- Who could do it but doesn't?
- What are the key demographic segments?
- What are psychographic differences?
- Who influences others?`
  }

  let prompt = `You are helping analyze a specific behavior in a specific location/context.\n\n`

  if (context.trim()) {
    prompt += `CURRENT ANALYSIS CONTEXT:\n${context}\n\n`
  } else {
    prompt += `Note: No context provided yet. Provide general guidance.\n\n`
  }

  if (sectionName && sectionGuidance[sectionName]) {
    prompt += `SECTION GUIDANCE:${sectionGuidance[sectionName]}\n\n`
  }

  prompt += `TASK: ${task}\n\n`
  prompt += `Provide specific, contextually-relevant suggestions that align with:\n`
  prompt += `- The behavior being analyzed\n`
  prompt += `- The specific location(s) and geographic scope\n`
  prompt += `- The settings (in-person/online/etc.)\n`
  prompt += `- All other details already documented\n\n`
  prompt += `Be concrete and specific to this behavior + location combination.`

  return prompt
}

/**
 * Generic context function for non-behavior frameworks
 */
export function getGenericFormContext(formData: any): string {
  const context: string[] = []

  if (formData.title) {
    context.push(`TITLE: ${formData.title}`)
  }
  if (formData.description) {
    context.push(`DESCRIPTION: ${formData.description}`)
  }

  // Add all section data
  Object.keys(formData).forEach(key => {
    if (Array.isArray(formData[key]) && formData[key].length > 0) {
      context.push(`\n${key.toUpperCase()}:`)
      formData[key].forEach((item: any, index: number) => {
        const text = item.text || item.description || item.question || JSON.stringify(item)
        context.push(`${index + 1}. ${text}`)
      })
    }
  })

  return context.join('\n')
}
