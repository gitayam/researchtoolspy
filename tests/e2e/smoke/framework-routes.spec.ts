import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frameworkSegment, frameworkSessionHref } from '../../../src/lib/framework-routes'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const router = readFileSync(resolve(root, 'src/routes/index.tsx'), 'utf8')

/** Every `analysis-frameworks/...` path the router actually declares. */
const declared = new Set(
  [...router.matchAll(/path: '(analysis-frameworks\/[^']*)'/g)].map(match => match[1]),
)

/**
 * The route patterns a generated href could legitimately match, with the id replaced by its
 * placeholder. An action segment matches either a route that names it literally
 * (`cog/:id/edit`) or one that takes any action (`starbursting/:id/:action`).
 */
function routePatternsFor(href: string): string[] {
  const parts = href.replace('/dashboard/', '').split('/')
  // analysis-frameworks/<segment>/<id>[/<action>] — the id is always the third part.
  parts[2] = ':id'
  const patterns = [parts.join('/')]
  if (parts.length === 4) patterns.push([...parts.slice(0, 3), ':action'].join('/'))
  return patterns
}

/**
 * Every framework type with sessions in production, plus the two whose route segment differs
 * from their stored type. The point of the list is that it is drawn from real stored data:
 * a helper that is correct only for types nobody uses is not correct.
 */
const STORED_TYPES = [
  'starbursting', 'behavior', 'dime', 'cog', 'swot', 'comb-analysis', 'deception', 'ach',
  'pmesii-pt', 'dotmlpf', 'causeway', 'pest', 'stakeholder', 'surveillance', 'fundamental-flow',
]

test.describe('framework session routes @smoke', () => {
  test('every generated href matches a route the router declares', () => {
    for (const type of STORED_TYPES) {
      const href = frameworkSessionHref(type, 42)
      expect(href, type).not.toBeNull()
      const patterns = routePatternsFor(href!)
      expect(
        patterns.some(pattern => declared.has(pattern)),
        `${type} -> ${href} (tried ${patterns.join(', ')})`,
      ).toBe(true)
    }
  })

  test('the dashboard prefix is present, which is what broke Recent Activity', () => {
    for (const type of STORED_TYPES) {
      expect(frameworkSessionHref(type, 1)!.startsWith('/dashboard/analysis-frameworks/'), type).toBe(true)
    }
  })

  test('the two renamed segments are not passed through as-is', () => {
    // `swot` and `ach` are stored as such but routed under a `-dashboard` segment. Passing
    // the stored type straight into the URL is the mistake this map exists to prevent.
    expect(frameworkSegment('swot')).toBe('swot-dashboard')
    expect(frameworkSegment('ach')).toBe('ach-dashboard')
    expect(frameworkSessionHref('swot', 7)).toBe('/dashboard/analysis-frameworks/swot-dashboard/7')
    expect(frameworkSessionHref('ach', 7)).toBe('/dashboard/analysis-frameworks/ach-dashboard/7')
    // Unmapped types keep their own name.
    expect(frameworkSegment('starbursting')).toBe('starbursting')
  })

  test('a framework routed as :id/:action gets an action rather than a bare id', () => {
    // Without one, `/starbursting/89` matches `starbursting/:action` and the id is read as
    // a verb — a wrong page rather than an error.
    expect(frameworkSessionHref('starbursting', 89)).toBe('/dashboard/analysis-frameworks/starbursting/89/view')
    expect(frameworkSessionHref('dime', 3)).toBe('/dashboard/analysis-frameworks/dime/3/view')
    // And the ones with a real bare-id route do not get a spurious action.
    expect(frameworkSessionHref('behavior', 27)).toBe('/dashboard/analysis-frameworks/behavior/27')
    expect(frameworkSessionHref('cog', 2)).toBe('/dashboard/analysis-frameworks/cog/2')
  })

  test('an unknown type produces nothing rather than a guess', () => {
    expect(frameworkSessionHref('', 1)).toBeNull()
  })
})
