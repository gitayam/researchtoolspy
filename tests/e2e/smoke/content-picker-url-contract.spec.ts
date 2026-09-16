import { test, expect } from '@playwright/test'
import { analyzableUrlFrom } from '../../../src/lib/content-url'

/**
 * The picker's search box doubles as a URL field. Getting this wrong in either direction
 * is a real cost: too strict and a pasted link silently stays a failing search, too loose
 * and every ordinary search offers to "analyse" a phrase that is not a link.
 */
test.describe('content picker URL detection @smoke', () => {
  test('a pasted link is recognised, with or without a scheme', () => {
    expect(analyzableUrlFrom('https://example.com/story')).toBe('https://example.com/story')
    // People paste bare hosts far more often than full URLs.
    expect(analyzableUrlFrom('example.com/story')).toBe('https://example.com/story')
    expect(analyzableUrlFrom('  https://example.com/a  ')).toBe('https://example.com/a')
    expect(analyzableUrlFrom('http://sub.example.co.uk/a?b=c#d')).toBe('http://sub.example.co.uk/a?b=c#d')
  })

  test('an ordinary search is not mistaken for a link', () => {
    // The screenshot case: a bare slug with no host is a search, not something to fetch.
    expect(analyzableUrlFrom('-kirk-family-alleges-uvu-knew-rooftop-security-risk')).toBeNull()
    for (const query of ['', '   ', 'kirk family', 'rooftop security risk', 'notadomain', 'trailing.']) {
      expect(analyzableUrlFrom(query), query).toBeNull()
    }
  })

  test('schemes that are not web fetches are refused', () => {
    for (const hostile of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'ftp://example.com/a']) {
      expect(analyzableUrlFrom(hostile), hostile).toBeNull()
    }
  })
})
