/**
 * Safely parse JSON with fallback value
 * Prevents crashes from corrupted JSON data in database
 */
export function safeJSONParse<T = any>(
  jsonString: string | null | undefined,
  fallback: T = {} as T
): T {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(jsonString) as T
  } catch (e) {
    console.error('Failed to parse JSON:', e)
    console.error('Corrupted value:', jsonString?.substring(0, 100))
    return fallback
  }
}

/**
 * Safely stringify JSON with error handling
 */
export function safeJSONStringify(
  value: any,
  fallback: string = '{}'
): string {
  try {
    return JSON.stringify(value)
  } catch (e) {
    console.error('Failed to stringify value:', e)
    return fallback
  }
}
