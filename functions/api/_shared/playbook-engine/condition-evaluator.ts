/**
 * Evaluate a condition against event data and session context.
 * Supports dot-path field access and comparison operators.
 */

export interface ConditionContext {
  payload: Record<string, unknown>
  session?: Record<string, unknown>
  entity?: Record<string, unknown>
  time?: { hours_since_created: number }
}

export interface Condition {
  field: string
  op: string
  value: unknown
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

function resolveField(context: ConditionContext, fieldPath: string): unknown {
  const [domain, ...rest] = fieldPath.split('.')
  const subPath = rest.join('.')

  switch (domain) {
    case 'payload': return getNestedValue(context.payload, subPath)
    case 'session': return context.session ? getNestedValue(context.session, subPath) : undefined
    case 'entity': return context.entity ? getNestedValue(context.entity, subPath) : undefined
    case 'time': return context.time ? getNestedValue(context.time as any, subPath) : undefined
    default: return getNestedValue(context.payload, fieldPath) // Default to payload
  }
}

export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  const actual = resolveField(context, condition.field)

  switch (condition.op) {
    case 'eq': return actual === condition.value
    case 'neq': return actual !== condition.value
    case 'gt': return Number(actual) > Number(condition.value)
    case 'lt': return Number(actual) < Number(condition.value)
    case 'gte': return Number(actual) >= Number(condition.value)
    case 'lte': return Number(actual) <= Number(condition.value)
    case 'in': return Array.isArray(condition.value) && condition.value.includes(actual)
    case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(actual)
    case 'contains': return typeof actual === 'string' && actual.includes(String(condition.value))
    case 'exists': return actual !== undefined && actual !== null
    default: return false
  }
}

export function evaluateAllConditions(conditions: Condition[], context: ConditionContext): boolean {
  if (conditions.length === 0) return true
  return conditions.every(c => evaluateCondition(c, context))
}
