import { expect, test } from '@playwright/test'
import { SAFE_PDF_MAX_BYTES } from '../../../functions/api/_shared/safe-content'
import { extractPDFText } from '../../../functions/api/content-intelligence/pdf-extractor'

type DnsAnswers = Record<string, string[]>

function dnsResponse(query: URL, answers: DnsAnswers): Response {
  const hostname = query.searchParams.get('name') || ''
  const type = query.searchParams.get('type')
  const records = (answers[hostname] || [])
    .filter(address => type === 'AAAA' ? address.includes(':') : !address.includes(':'))
    .map(address => ({ type: type === 'AAAA' ? 28 : 1, data: address }))
  return Response.json({ Status: 0, Answer: records })
}

function minimalTextPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

test.describe('PDF URL safe-fetch migration @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke denies private or mixed DNS and private redirects before target transport', async () => {
    const originalFetch = globalThis.fetch
    const targetUrls: string[] = []
    const answers: DnsAnswers = {
      'private.example': ['10.0.0.1'],
      'mixed.example': ['93.184.216.34', '10.0.0.2'],
      'public.example': ['93.184.216.34'],
      'redirect-private.example': ['127.0.0.1'],
    }
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') return dnsResponse(url, answers)
      targetUrls.push(url.href)
      if (url.hostname === 'public.example') {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://redirect-private.example/secret.pdf' },
        })
      }
      throw new Error(`Unexpected target transport: ${url.href}`)
    }) as typeof fetch

    try {
      await expect(extractPDFText('https://private.example/report.pdf'))
        .rejects.toMatchObject({ code: 'unsafe_url' })
      await expect(extractPDFText('https://mixed.example/report.pdf'))
        .rejects.toMatchObject({ code: 'unsafe_url' })
      await expect(extractPDFText('https://public.example/start.pdf'))
        .rejects.toMatchObject({ code: 'unsafe_url' })
      expect(targetUrls).toEqual(['https://public.example/start.pdf'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke rejects oversized, wrong-MIME, and invalid-signature downloads deterministically', async () => {
    const originalFetch = globalThis.fetch
    let responseKind: 'oversized' | 'mime' | 'signature' = 'oversized'
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        return dnsResponse(url, { 'documents.example': ['93.184.216.34'] })
      }
      if (responseKind === 'oversized') {
        return new Response(new TextEncoder().encode('%PDF-1.7'), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(SAFE_PDF_MAX_BYTES + 1),
          },
        })
      }
      if (responseKind === 'mime') {
        return new Response(new TextEncoder().encode('%PDF-1.7'), {
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      }
      return new Response(new TextEncoder().encode('not-a-pdf'), {
        headers: { 'Content-Type': 'application/pdf' },
      })
    }) as typeof fetch

    try {
      await expect(extractPDFText('https://documents.example/large.pdf'))
        .rejects.toMatchObject({ code: 'response_too_large' })
      responseKind = 'mime'
      await expect(extractPDFText('https://documents.example/wrong-mime.pdf'))
        .rejects.toMatchObject({ code: 'unsupported_content_type' })
      responseKind = 'signature'
      await expect(extractPDFText('https://documents.example/fake.pdf'))
        .rejects.toMatchObject({ code: 'unsupported_content_type' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke sends valid PDF bytes to unpdf without exposing the pdf.co key', async () => {
    const originalFetch = globalThis.fetch
    const bytes = minimalTextPdf('Hello Safe PDF')
    let callerHeaders = new Headers()
    let providerCalls = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        return dnsResponse(url, { 'documents.example': ['93.184.216.34'] })
      }
      if (url.hostname === 'documents.example') {
        callerHeaders = new Headers(init?.headers)
        return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } })
      }
      if (url.hostname === 'api.pdf.co') providerCalls += 1
      throw new Error(`Unexpected fetch: ${url.href}`)
    }) as typeof fetch

    try {
      const result = await extractPDFText('https://documents.example/report.pdf', 'pdfco-secret')
      expect(result.text).toContain('Hello Safe PDF')
      expect(callerHeaders.has('x-api-key')).toBe(false)
      expect(callerHeaders.has('authorization')).toBe(false)
      expect(providerCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke keeps pdf.co as a fixed-host fallback and uploads only validated bytes', async () => {
    const originalFetch = globalThis.fetch
    const downloaded = new TextEncoder().encode('%PDF-1.7\ncorrupt-but-signature-valid')
    let callerHeaders = new Headers()
    let uploadedBytes = new Uint8Array()
    const providerHeaders: Headers[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        return dnsResponse(url, { 'documents.example': ['93.184.216.34'] })
      }
      if (url.hostname === 'documents.example') {
        callerHeaders = new Headers(init?.headers)
        return new Response(downloaded, { headers: { 'Content-Type': 'application/pdf' } })
      }
      if (url.href === 'https://api.pdf.co/v1/file/upload') {
        providerHeaders.push(new Headers(init?.headers))
        uploadedBytes = new Uint8Array(init?.body as ArrayBuffer)
        return Response.json({ url: 'https://files.pdf.co/validated-upload.pdf' })
      }
      if (url.href === 'https://api.pdf.co/v1/pdf/convert/to/text') {
        providerHeaders.push(new Headers(init?.headers))
        return Response.json({ body: 'OCR fallback text', pageCount: 1 })
      }
      throw new Error(`Unexpected fetch: ${url.href}`)
    }) as typeof fetch

    try {
      const result = await extractPDFText('https://documents.example/scanned.pdf', 'pdfco-secret')
      expect(result).toEqual({ text: 'OCR fallback text', metadata: { pageCount: 1 } })
      expect([...uploadedBytes]).toEqual([...downloaded])
      expect(callerHeaders.has('x-api-key')).toBe(false)
      expect(providerHeaders).toHaveLength(2)
      for (const headers of providerHeaders) expect(headers.get('x-api-key')).toBe('pdfco-secret')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
