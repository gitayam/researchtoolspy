import { expect, test } from '@playwright/test'
import {
  SAFE_DOCUMENT_TEXT_MAX_BYTES,
  SAFE_IMAGE_MAX_BYTES,
  SAFE_PDF_MAX_BYTES,
  safeFetchDocument,
  safeFetchImage,
  safeFetchPdf,
  type SafeImageMimeType,
} from '../../../functions/api/_shared/safe-content'
import type { HostnameResolver } from '../../../functions/api/_shared/safe-fetch'

const publicResolver: HostnameResolver = async () => ['93.184.216.34']

function responseWithBytes(bytes: Uint8Array, contentType: string, headers: HeadersInit = {}): Response {
  return new Response(bytes, {
    headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': contentType },
  })
}

const pdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n')

test.describe('safe outbound content adapters @smoke', () => {
  test('@smoke accepts only bounded PDF MIME with a %PDF- signature', async () => {
    const result = await safeFetchPdf('https://documents.example/report.pdf', {
      fetchImpl: (async () => responseWithBytes(pdfBytes, 'application/pdf')) as typeof fetch,
      resolveHostname: publicResolver,
    })
    expect(result.mimeType).toBe('application/pdf')
    expect(new TextDecoder().decode(result.bytes)).toContain('%PDF-1.7')

    await expect(safeFetchPdf('https://documents.example/fake.pdf', {
      fetchImpl: (async () => responseWithBytes(new TextEncoder().encode('not a pdf'), 'application/pdf')) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsupported_content_type' })

    await expect(safeFetchPdf('https://documents.example/report.pdf', {
      fetchImpl: (async () => responseWithBytes(pdfBytes, 'application/octet-stream')) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsupported_content_type' })
  })

  test('@smoke enforces the fixed 10 MiB PDF budget before reading', async () => {
    let cancelled = false
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(pdfBytes)
      },
      async cancel() {
        await Promise.resolve()
        cancelled = true
      },
    })
    await expect(safeFetchPdf('https://documents.example/large.pdf', {
      fetchImpl: (async () => new Response(body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(SAFE_PDF_MAX_BYTES + 1),
        },
      })) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'response_too_large' })
    expect(cancelled).toBe(true)
  })

  test('@smoke validates supported image MIME types against magic signatures', async () => {
    const fixtures: Array<{ mimeType: SafeImageMimeType; bytes: Uint8Array }> = [
      { mimeType: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]) },
      { mimeType: 'image/png', bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
      { mimeType: 'image/gif', bytes: new TextEncoder().encode('GIF89a') },
      { mimeType: 'image/webp', bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]) },
      { mimeType: 'image/avif', bytes: new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]) },
    ]

    for (const fixture of fixtures) {
      const result = await safeFetchImage(`https://pbs.twimg.com/${fixture.mimeType.slice(6)}`, {
        allowedHostnames: ['PBS.TWIMG.COM.'],
        fetchImpl: (async () => responseWithBytes(fixture.bytes, `${fixture.mimeType}; charset=binary`)) as typeof fetch,
        resolveHostname: publicResolver,
      })
      expect(result.mimeType).toBe(fixture.mimeType)
    }

    await expect(safeFetchImage('https://pbs.twimg.com/mismatch', {
      allowedHostnames: ['pbs.twimg.com'],
      fetchImpl: (async () => responseWithBytes(new TextEncoder().encode('GIF89a'), 'image/png')) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsupported_content_type' })
  })

  test('@smoke enforces exact image hosts on every redirect and the fixed 8 MiB budget', async () => {
    const fetchedUrls: string[] = []
    await expect(safeFetchImage('https://pbs.twimg.com/start', {
      allowedHostnames: ['pbs.twimg.com'],
      fetchImpl: (async (input: RequestInfo | URL) => {
        fetchedUrls.push(String(input))
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://images.attacker.example/payload' },
        })
      }) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'unsafe_url' })
    expect(fetchedUrls).toEqual(['https://pbs.twimg.com/start'])

    await expect(safeFetchImage('https://pbs.twimg.com/large', {
      allowedHostnames: ['pbs.twimg.com'],
      fetchImpl: (async () => responseWithBytes(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg', {
        'Content-Length': String(SAFE_IMAGE_MAX_BYTES + 1),
      })) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'response_too_large' })
  })

  test('@smoke returns a discriminated text or PDF document without changing transport policy', async () => {
    const text = await safeFetchDocument('https://documents.example/article', {
      fetchImpl: (async () => responseWithBytes(
        new TextEncoder().encode('<html><title>Article</title></html>'),
        'text/html; charset=utf-8',
      )) as typeof fetch,
      resolveHostname: publicResolver,
    })
    expect(text.kind).toBe('text')
    if (text.kind === 'text') expect(text.text).toContain('<title>Article</title>')

    const pdf = await safeFetchDocument('https://documents.example/download', {
      fetchImpl: (async () => responseWithBytes(pdfBytes, 'application/pdf')) as typeof fetch,
      resolveHostname: publicResolver,
    })
    expect(pdf.kind).toBe('pdf')
    if (pdf.kind === 'pdf') expect(pdf.bytes).toEqual(pdfBytes)
  })

  test('@smoke applies the 2 MiB text budget inside the mixed document adapter', async () => {
    await expect(safeFetchDocument('https://documents.example/large.html', {
      fetchImpl: (async () => responseWithBytes(new TextEncoder().encode('<html></html>'), 'text/html', {
        'Content-Length': String(SAFE_DOCUMENT_TEXT_MAX_BYTES + 1),
      })) as typeof fetch,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'response_too_large' })
  })
})
