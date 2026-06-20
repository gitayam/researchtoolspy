/**
 * Pure helper for building the event-log payload emitted when URL extraction fails.
 *
 * Lives in its own zero-dependency module (no `unpdf`/AI-gateway imports) so it can be
 * unit-tested in pure Node without dragging in the heavy edge-only deps that
 * analyze-url.ts pulls in transitively. The handler imports this and spreads the
 * result into logEvent(); see functions/api/_shared/event-log.ts.
 */

const MAX_REASON_LEN = 500

export interface ExtractionFailureLog {
  level: 'warn'
  source: string
  message: string
  context: { url: string; reason: string }
}

/**
 * Build the (low-volume) event-log entry for a hard URL-extraction failure.
 *
 * `reason` is coerced to a string and capped so a stray large blob can't bloat the row
 * (logEvent also truncates the serialized context, but we keep the input small here too).
 */
export function extractionFailureLog(url: string, reason: unknown): ExtractionFailureLog {
  return {
    level: 'warn',
    source: 'content-intelligence/analyze-url',
    message: 'URL extraction failed',
    context: {
      url: String(url ?? ''),
      reason: String(reason ?? 'unknown').slice(0, MAX_REASON_LEN),
    },
  }
}
