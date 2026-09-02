import { expect, test } from '@playwright/test'
import { parseCanonicalYouTubeUrl } from '../../../functions/api/_shared/social-url'

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
