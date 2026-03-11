/**
 * Resolve {{mustache}} templates in action params.
 * Supports: trigger.payload.*, trigger.entity_id, stage.<name>.*
 */

export interface TemplateContext {
  trigger: {
    event_type: string
    entity_type: string
    entity_id: string | null
    payload: Record<string, unknown>
  }
  stage: Record<string, Record<string, unknown>>  // stage results keyed by name
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function resolveTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmed = path.trim()
    const parts = trimmed.split('.')

    if (parts[0] === 'trigger') {
      if (parts[1] === 'payload') {
        return String(getNestedValue(context.trigger.payload, parts.slice(2).join('.')) ?? '')
      }
      return String((context.trigger as any)[parts[1]] ?? '')
    }

    if (parts[0] === 'stage') {
      const stageName = parts[1]
      const stageData = context.stage[stageName]
      if (!stageData) return ''
      return String(getNestedValue(stageData, parts.slice(2).join('.')) ?? '')
    }

    return ''
  })
}

export function resolveParams(
  params: Record<string, unknown>,
  context: TemplateContext
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = resolveTemplate(value, context)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveParams(value as Record<string, unknown>, context)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}
