/**
 * AI refusal-contract smoke test (pure-Node, no browser, no HTTP server).
 *
 * Pins the mechanism that the framework endpoint guards rely on: the shared AI
 * gateway flags a model content-policy refusal (`detectRefusal` ⇒ `_refusal`),
 * and callers (e.g. swot-auto-populate, pmesii-pt/import-url) respond with the
 * standard REFUSAL_BODY instead of falling through to JSON.parse on refusal prose.
 *
 * This imports the gateway helpers directly — no `page` fixture, no running server.
 */
import { test, expect } from '@playwright/test'
import {
  detectRefusal,
  REFUSAL_BODY,
} from '../../../functions/api/_shared/ai-gateway'

test.describe('AI refusal contract: gateway flags refusals, callers return REFUSAL_BODY @smoke', () => {
  test('@smoke detects OpenAI-style and Anthropic-style refusals', () => {
    // OpenAI-style "I'm sorry, but I can't…"
    expect(detectRefusal("I'm sorry, but I can't help with that.")).toBe(true)
    // Short, direct decline
    expect(detectRefusal('I cannot assist with this request.')).toBe(true)
    // Anthropic-style policy refusal phrasing
    expect(
      detectRefusal(
        'This request appears to violate our Usage Policy, so I will not continue.'
      )
    ).toBe(true)
  })

  test('@smoke does NOT flag analytical content that merely discusses violations', () => {
    // Starts with analytical content; only mentions "violated" mid-sentence and
    // never as policy-refusal phrasing — must not be flagged (false-positive guard).
    expect(
      detectRefusal(
        "The actor's behavior violated the ceasefire agreement, which suggests an escalation in tactics worth monitoring."
      )
    ).toBe(false)
  })

  test('@smoke REFUSAL_BODY is a clean declined response contract', () => {
    expect(REFUSAL_BODY.declined).toBe(true)
    expect(typeof REFUSAL_BODY.reason).toBe('string')
  })
})
