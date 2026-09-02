import { expect, test } from '@playwright/test'
import {
  parseCanonicalInstagramUrl,
  parseCanonicalYouTubeUrl,
} from '../../../functions/api/_shared/social-url'

const VIDEO_ID = 'AbC_dEf-123'
const CANONICAL_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`

test.describe('canonical social URL contract @smoke', () => {
  const accepted = [
    `https://youtube.com/watch?v=${VIDEO_ID}`,
    `http://www.youtube.com/watch/?v=${VIDEO_ID}`,
    `https://m.youtube.com/embed/${VIDEO_ID}`,
    `https://youtube.com/embed/${VIDEO_ID}/`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `http://m.youtube.com/shorts/${VIDEO_ID}/`,
    `https://youtube.com/live/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}/`,
    `https://youtu.be/${VIDEO_ID}`,
    `http://youtu.be/${VIDEO_ID}/`,
    `HTTPS://WWW.YOUTUBE.COM/watch?v=${VIDEO_ID}`,
  ]

  for (const input of accepted) {
    test(`@smoke canonicalizes ${input}`, () => {
      expect(parseCanonicalYouTubeUrl(input)).toEqual({
        platform: 'youtube',
        videoId: VIDEO_ID,
        canonicalUrl: CANONICAL_URL,
      })
    })
  }

  const rejected = [
    '',
    ' https://youtu.be/AbC_dEf-123',
    'https://youtu.be/AbC_dEf-123\n',
    'ftp://youtu.be/AbC_dEf-123',
    'javascript:alert(1)',
    'https://user@youtube.com/watch?v=AbC_dEf-123',
    'https://user:pass@youtube.com/watch?v=AbC_dEf-123',
    'https://youtube.com:443/watch?v=AbC_dEf-123',
    'http://youtu.be:80/AbC_dEf-123',
    'https://youtube.com.evil.test/watch?v=AbC_dEf-123',
    'https://notyoutube.com/watch?v=AbC_dEf-123',
    'https://www.youtube.com.evil.test/watch?v=AbC_dEf-123',
    'https://youtube%2ecom/watch?v=AbC_dEf-123',
    'https://youtube。com/watch?v=AbC_dEf-123',
    'https://youtube．com/watch?v=AbC_dEf-123',
    'https://youtube｡com/watch?v=AbC_dEf-123',
    'https://ｗｗｗ.youtube.com/watch?v=AbC_dEf-123',
    'https://ｙｏｕｔｕｂｅ.com/watch?v=AbC_dEf-123',
    'https://youtube.com\\@evil.test/watch?v=AbC_dEf-123',
    'https://youtube.com/watch?v=AbC_dEf-123#fragment',
    'https://youtube.com/watch?v=AbC_dEf-123&list=secret',
    'https://youtube.com/watch?list=playlist-only',
    'https://youtube.com/watch?v=AbC_dEf-123&v=ZyX_wVu-987',
    'https://youtube.com/watch?v=AbC_dEf-123?v=ZyX_wVu-987',
    'https://youtube.com/watch?V=AbC_dEf-123',
    'https://youtube.com/watch?v=',
    'https://youtube.com/watch?v=too_short',
    'https://youtube.com/watch?v=AbC_dEf-1234',
    'https://youtube.com/watch?v=AbC%5fdEf-123',
    'https://youtube.com/embed/AbC_dEf-123/extra',
    'https://youtube.com/shorts/AbC_dEf-123?feature=share',
    'https://youtube.com/live/AbC_dEf-123//',
    'https://youtu.be/AbC_dEf-123/extra',
    'https://youtu.be/AbC_dEf-123?secret=value',
    'https://youtu.be/',
    'https://youtube.com/playlist?list=PL123',
    'https://youtube.com/v/AbC_dEf-123',
    'https://youtube.com/embed/../AbC_dEf-123',
    'https://youtube.com/embed/%2e%2e/AbC_dEf-123',
    'https://youtube.com/embed%2fAbC_dEf-123',
    'https://youtube.com/embed%5cAbC_dEf-123',
    'https://youtube.com/watch?v=%ZZ',
    `https://youtu.be/${'a'.repeat(2049)}`,
  ]

  for (const input of rejected) {
    test(`@smoke rejects ${JSON.stringify(input).slice(0, 100)}`, () => {
      expect(parseCanonicalYouTubeUrl(input)).toBeNull()
    })
  }

  test('@smoke preserves distinct canonical identities', () => {
    const secondId = 'ZyX_wVu-987'
    expect(parseCanonicalYouTubeUrl(`https://youtu.be/${VIDEO_ID}`)?.canonicalUrl).toBe(CANONICAL_URL)
    expect(parseCanonicalYouTubeUrl(`https://youtu.be/${secondId}`)?.canonicalUrl)
      .toBe(`https://www.youtube.com/watch?v=${secondId}`)
  })
})

test.describe('canonical Instagram URL contract @smoke', () => {
  const accepted = [
    ['https://instagram.com/p/AbC_123-xYz', 'p'],
    ['https://www.instagram.com/p/AbC_123-xYz/', 'p'],
    ['HTTPS://INSTAGRAM.COM/reel/a', 'reel'],
    ['https://WWW.INSTAGRAM.COM/reel/a/', 'reel'],
    ['https://instagram.com/tv/0123456789_-', 'tv'],
    [`https://www.instagram.com/p/${'a'.repeat(64)}`, 'p'],
  ] as const

  for (const [input, kind] of accepted) {
    test(`@smoke canonicalizes ${input}`, () => {
      const shortcode = input.match(/\/(?:p|reel|tv)\/([^/]+)/)?.[1]
      expect(parseCanonicalInstagramUrl(input)).toEqual({
        platform: 'instagram',
        kind,
        shortcode,
        canonicalUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
      })
    })
  }

  const rejected = [
    '',
    ' https://instagram.com/p/AbC_123-xYz',
    'https://instagram.com/p/AbC_123-xYz ',
    'https://instagram.com/p/AbC_123-xYz\n',
    `https://instagram.com/p/${'a'.repeat(64)}\u0000`,
    `https://instagram.com/p/${'a'.repeat(65)}`,
    'http://instagram.com/p/AbC_123-xYz',
    'ftp://instagram.com/p/AbC_123-xYz',
    'javascript:alert(1)',
    'https://user@instagram.com/p/AbC_123-xYz',
    'https://user:pass@instagram.com/p/AbC_123-xYz',
    'https://instagram.com:443/p/AbC_123-xYz',
    'https://instagram.com./p/AbC_123-xYz',
    'https://m.instagram.com/p/AbC_123-xYz',
    'https://instagram.com.evil.test/p/AbC_123-xYz',
    'https://notinstagram.com/p/AbC_123-xYz',
    'https://evil.test/instagram.com/p/AbC_123-xYz',
    'https://instagram%2ecom/p/AbC_123-xYz',
    'https://instagram。com/p/AbC_123-xYz',
    'https://instagram．com/p/AbC_123-xYz',
    'https://instagram｡com/p/AbC_123-xYz',
    'https://ｗｗｗ.instagram.com/p/AbC_123-xYz',
    'https://ｉｎｓｔａｇｒａｍ.com/p/AbC_123-xYz',
    'https://instagram.com\\@evil.test/p/AbC_123-xYz',
    'https://instagram.com/p/AbC_123-xYz?igsh=secret',
    'https://instagram.com/p/AbC_123-xYz?',
    'https://instagram.com/p/AbC_123-xYz#fragment',
    'https://instagram.com/p/AbC_123-xYz%2fextra',
    'https://instagram.com/p/%41bC_123-xYz',
    'https://instagram.com/%70/AbC_123-xYz',
    'https://instagram.com/p/AbC_123-xYz/extra',
    'https://instagram.com/p//AbC_123-xYz',
    'https://instagram.com//p/AbC_123-xYz',
    'https://instagram.com/p/../AbC_123-xYz',
    'https://instagram.com/p/./AbC_123-xYz',
    'https://instagram.com/P/AbC_123-xYz',
    'https://instagram.com/reels/AbC_123-xYz',
    'https://instagram.com/stories/AbC_123-xYz',
    'https://instagram.com/p/',
    'https://instagram.com/p/a.b',
    'https://instagram.com/p/a~b',
    'https://instagram.com/p/a+b',
    'https://instagram.com/p/a=b',
    'https://instagram.com/p/a%20b',
    'https://instagram.com/',
  ]

  for (const input of rejected) {
    test(`@smoke rejects ${JSON.stringify(input)}`, () => {
      expect(parseCanonicalInstagramUrl(input)).toBeNull()
    })
  }

  test('@smoke preserves kind and shortcode as distinct canonical identities', () => {
    expect(parseCanonicalInstagramUrl('https://instagram.com/p/same_id')?.canonicalUrl)
      .toBe('https://www.instagram.com/p/same_id/')
    expect(parseCanonicalInstagramUrl('https://instagram.com/reel/same_id')?.canonicalUrl)
      .toBe('https://www.instagram.com/reel/same_id/')
  })

  test('@smoke rejects input longer than 2048 characters', () => {
    expect(parseCanonicalInstagramUrl(`https://instagram.com/p/a${'b'.repeat(2048)}`)).toBeNull()
  })
})
