import { test, expect } from '@playwright/test'
import { parseModelJson } from '../../../functions/api/_shared/ai-gateway'

/**
 * The reason this helper exists: thirteen call sites stripped the markdown fence with a
 * GLOBAL regex, which removes every fence sequence in the string rather than the one
 * wrapping it — corrupting any payload whose own content mentions a fence.
 */
test.describe('model JSON parsing @smoke', () => {
  test('a fenced reply parses, with or without the json tag', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseModelJson('```\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseModelJson('  ```json\r\n{"a":1}\r\n```  ')).toEqual({ a: 1 })
    expect(parseModelJson('```json\n[1,2]\n```')).toEqual([1, 2])
  })

  test('a fence INSIDE a string value survives, which the global regex destroyed', () => {
    // The exact corruption: a model returning a code sample had its own payload mangled,
    // and the parse failure then read as a model error rather than ours.
    const reply = '```json\n{"snippet":"```js\\nconst x = 1\\n```","ok":true}\n```'
    const parsed = parseModelJson<{ snippet: string; ok: boolean }>(reply)
    expect(parsed).not.toBeNull()
    expect(parsed!.ok).toBe(true)
    expect(parsed!.snippet).toContain('```js')
    expect(parsed!.snippet).toContain('const x = 1')

    // The old behaviour on the same input, documented because it is worse than a crash:
    // the global replace strips the fences from INSIDE the string value, so the result is
    // still valid JSON and still parses — carrying quietly wrong content downstream.
    const oldWay = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const corrupted = JSON.parse(oldWay) as { snippet: string }
    expect(corrupted.snippet).not.toContain('```js')
    expect(corrupted.snippet).not.toEqual(parsed!.snippet)
  })

  test('prose around valid JSON is recovered rather than lost', () => {
    expect(parseModelJson('Sure! Here is the result:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 })
  })

  test('input with no JSON returns null instead of a half-parsed object', () => {
    for (const junk of ['', '   ', 'I cannot help with that.', '```json\n```', null, undefined]) {
      expect(parseModelJson(junk as string), String(junk)).toBeNull()
    }
  })
})
