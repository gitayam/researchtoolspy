/**
 * COP Share-link toast messaging (pure-Node, no browser, no HTTP server).
 *
 * Root cause this guards against: the COP "Share" button copied the PRIVATE
 * dashboard URL to the clipboard with no feedback at all — clicking it looked
 * like nothing happened, and for a private session the URL 403s for any
 * recipient without granted access. The fix toasts visibility-aware copy
 * (`src/lib/cop-share-message.ts`) so the user knows whether the copied link
 * actually grants access.
 *
 * The helper is pure, so it can be exercised here with no `page` fixture and no
 * running server. Mirrors cot-export.spec.ts.
 */
import { test, expect } from '@playwright/test'
import { shareLinkToast } from '../../../src/lib/cop-share-message'

test.describe('COP share-link toast messaging @smoke', () => {
  test('@smoke public session conveys anyone-can-view', () => {
    const { title, description } = shareLinkToast({ isPublic: true })
    expect(title.length).toBeGreaterThan(0)
    expect(description.length).toBeGreaterThan(0)
    expect(description.toLowerCase()).toMatch(/anyone|view/)
  })

  test('@smoke private session conveys recipients-need-access', () => {
    const { title, description } = shareLinkToast({ isPublic: false })
    expect(title.length).toBeGreaterThan(0)
    expect(description.toLowerCase()).toContain('private')
    expect(description.toLowerCase()).toMatch(/need access|grant access|collaborator/)
  })

  test('@smoke both visibilities return a non-empty title', () => {
    expect(shareLinkToast({ isPublic: true }).title.trim().length).toBeGreaterThan(0)
    expect(shareLinkToast({ isPublic: false }).title.trim().length).toBeGreaterThan(0)
  })
})
