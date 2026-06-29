/**
 * cite-source — pure-Node unit test for `buildCitationGeneratorUrl` (E-12).
 *
 * Guards the deep-link the reviewer hands to the citation generator: it must
 * carry an ENCODED `url` (so the generator's on-mount param read + scrape kicks
 * in), append `title` only when present, and return `null` for anything that
 * isn't a usable http(s) url (so the UI can hide the button instead of linking
 * to a broken pre-fill). No `page` fixture, no server — mirrors
 * research-forms-api.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  CITATION_GENERATOR_PATH,
  buildCitationGeneratorUrl,
} from '../../../src/lib/cite-source'

test.describe('buildCitationGeneratorUrl @smoke', () => {
  test('@smoke route constant is the canonical citation-generator path', () => {
    expect(CITATION_GENERATOR_PATH).toBe('/dashboard/tools/citations-generator')
  })

  test('@smoke builds an encoded url + title link', () => {
    const link = buildCitationGeneratorUrl({ url: 'https://x.com/a', title: 'T' })
    expect(link).toBe('/dashboard/tools/citations-generator?url=https%3A%2F%2Fx.com%2Fa&title=T')

    // Parse it back to prove the params survive round-trip decoding.
    const parsed = new URLSearchParams(link!.split('?')[1])
    expect(link!.split('?')[0]).toBe(CITATION_GENERATOR_PATH)
    expect(parsed.get('url')).toBe('https://x.com/a')
    expect(parsed.get('title')).toBe('T')
  })

  test('@smoke encodes url query strings and spaces in the title', () => {
    const link = buildCitationGeneratorUrl({
      url: 'https://example.com/article?id=1&ref=2',
      title: 'A Long Title',
    })
    const parsed = new URLSearchParams(link!.split('?')[1])
    // The submission url is preserved intact through encode/decode (its own
    // query string must NOT leak into the generator's params).
    expect(parsed.get('url')).toBe('https://example.com/article?id=1&ref=2')
    expect(parsed.get('title')).toBe('A Long Title')
  })

  test('@smoke omits title param when title is missing or blank', () => {
    for (const title of [undefined, null, '', '   ']) {
      const link = buildCitationGeneratorUrl({ url: 'https://x.com/a', title })
      const parsed = new URLSearchParams(link!.split('?')[1])
      expect(parsed.get('url')).toBe('https://x.com/a')
      expect(parsed.has('title')).toBe(false)
    }
  })

  test('@smoke returns null for no / empty / non-http url', () => {
    expect(buildCitationGeneratorUrl({ url: null })).toBeNull()
    expect(buildCitationGeneratorUrl({ url: undefined })).toBeNull()
    expect(buildCitationGeneratorUrl({ url: '' })).toBeNull()
    expect(buildCitationGeneratorUrl({ url: '   ' })).toBeNull()
    expect(buildCitationGeneratorUrl({ url: 'not a url' })).toBeNull()
    expect(buildCitationGeneratorUrl({ url: 'ftp://x.com/a' })).toBeNull()
    expect(buildCitationGeneratorUrl({ url: 'javascript:alert(1)' })).toBeNull()
    // Even with a title, a missing url means no link.
    expect(buildCitationGeneratorUrl({ url: null, title: 'T' })).toBeNull()
  })

  test('@smoke trims surrounding whitespace from the url', () => {
    const link = buildCitationGeneratorUrl({ url: '  https://x.com/a  ' })
    const parsed = new URLSearchParams(link!.split('?')[1])
    expect(parsed.get('url')).toBe('https://x.com/a')
  })
})
