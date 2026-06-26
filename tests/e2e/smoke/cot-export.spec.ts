/**
 * COP CoT export helper (pure-Node, no browser, no HTTP server).
 *
 * Root cause this guards against: the COP "Export CoT/ATAK" button used to call
 * `window.open('/api/cop/:id/cot')`, a browser navigation that cannot attach the
 * `X-User-Hash` auth header the endpoint requires → 401 (owner) / 403 (others),
 * so the feature was 100% non-functional. The fix downloads the XML via an
 * authenticated `fetch` + Blob download (`src/lib/cop-cot-export.ts`).
 *
 * The helper is dependency-injectable (fetch/document/URL) precisely so it can
 * be exercised here with fakes — no `page` fixture, no running server. Mirrors
 * deception-pdf-scale.spec.ts.
 */
import { test, expect } from '@playwright/test'
import {
  cotExportFilename,
  downloadCotExport,
  type CotAnchorLike,
  type CotDocumentLike,
  type CotFetch,
  type CotUrlLike,
} from '../../../src/lib/cop-cot-export'

test.describe('COP CoT export helper @smoke', () => {
  test('@smoke cotExportFilename derives cop-<id>.cot.xml', () => {
    expect(cotExportFilename('cop-abc')).toBe('cop-abc.cot.xml')
  })

  test('@smoke downloadCotExport clicks an anchor with the export filename + object URL, then revokes it', async () => {
    const OBJECT_URL = 'blob:fake-object-url'
    const clicks: CotAnchorLike[] = []
    const revoked: string[] = []
    let createdBlob: Blob | undefined

    const anchor: CotAnchorLike = {
      href: '',
      download: '',
      click() {
        clicks.push({ href: this.href, download: this.download, click: this.click })
      },
    }

    const fetchImpl: CotFetch = async (input) => {
      expect(input).toBe('/api/cop/cop-abc/cot')
      return { ok: true, status: 200, text: async () => '<events/>' }
    }
    const documentImpl: CotDocumentLike = {
      createElement: () => anchor,
    }
    const urlImpl: CotUrlLike = {
      createObjectURL: (obj) => {
        createdBlob = obj
        return OBJECT_URL
      },
      revokeObjectURL: (url) => {
        revoked.push(url)
      },
    }

    await downloadCotExport({
      sessionId: 'cop-abc',
      headers: { 'X-User-Hash': 'hash1234567890abcd' },
      fetchImpl,
      documentImpl,
      urlImpl,
    })

    expect(clicks).toHaveLength(1)
    expect(clicks[0].download).toBe('cop-abc.cot.xml')
    expect(clicks[0].href).toBe(OBJECT_URL)
    expect(createdBlob).toBeInstanceOf(Blob)
    expect(revoked).toEqual([OBJECT_URL])
  })

  test('@smoke downloadCotExport rejects on a 401 so the UI can toast', async () => {
    const fetchImpl: CotFetch = async () => ({
      ok: false,
      status: 401,
      text: async () => '<error>Authentication required</error>',
    })
    let createdUrl = false
    const documentImpl: CotDocumentLike = {
      createElement: () => {
        throw new Error('anchor should not be created on a failed response')
      },
    }
    const urlImpl: CotUrlLike = {
      createObjectURL: () => {
        createdUrl = true
        return 'blob:should-not-happen'
      },
      revokeObjectURL: () => {},
    }

    await expect(
      downloadCotExport({
        sessionId: 'cop-abc',
        headers: {},
        fetchImpl,
        documentImpl,
        urlImpl,
      })
    ).rejects.toThrow(/401/)

    expect(createdUrl).toBe(false)
  })
})
