/** Content-specific adapters built on the shared outbound transport policy. */
import {
  SafeFetchError,
  safeFetchBytes,
  type SafeFetchBytesResult,
  type SafeFetchOptions,
  type SafeFetchResult,
} from './safe-fetch'

export const SAFE_PDF_MAX_BYTES = 10 * 1024 * 1024
export const SAFE_IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const SAFE_DOCUMENT_TEXT_MAX_BYTES = 2 * 1024 * 1024

const PDF_CONTENT_TYPES = ['application/pdf'] as const
const DOCUMENT_CONTENT_TYPES = [
  'text/',
  'application/xhtml+xml',
  'application/xml',
  'application/json',
  ...PDF_CONTENT_TYPES,
] as const
const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
] as const

export type SafeContentFetchOptions = Omit<
  SafeFetchOptions,
  'allowedContentTypes' | 'contentTypeMaxResponseBytes' | 'maxResponseBytes'
>

export interface SafeFetchPdfResult extends SafeFetchBytesResult {
  mimeType: 'application/pdf'
}

export type SafeImageMimeType = typeof IMAGE_CONTENT_TYPES[number]

export interface SafeFetchImageResult extends SafeFetchBytesResult {
  mimeType: SafeImageMimeType
}

export interface SafeFetchTextDocumentResult extends SafeFetchResult {
  kind: 'text'
  mimeType: string
  text: string
}

export interface SafeFetchPdfDocumentResult extends SafeFetchResult {
  kind: 'pdf'
  mimeType: 'application/pdf'
  bytes: Uint8Array
}

export type SafeFetchDocumentResult = SafeFetchTextDocumentResult | SafeFetchPdfDocumentResult

function normalizedMimeType(contentType: string): string {
  return contentType.split(';', 1)[0].trim().toLowerCase()
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
}

function asciiAt(bytes: Uint8Array, offset: number, expected: string): boolean {
  if (bytes.length < offset + expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false
  }
  return true
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return asciiAt(bytes, 0, '%PDF-')
}

function hasAvifSignature(bytes: Uint8Array): boolean {
  if (!asciiAt(bytes, 4, 'ftyp')) return false
  const scanLimit = Math.min(bytes.length - 3, 32)
  for (let offset = 8; offset < scanLimit; offset += 4) {
    if (asciiAt(bytes, offset, 'avif') || asciiAt(bytes, offset, 'avis')) return true
  }
  return false
}

function hasImageSignature(bytes: Uint8Array, mimeType: SafeImageMimeType): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif':
      return asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a')
    case 'image/webp':
      return asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')
    case 'image/avif':
      return hasAvifSignature(bytes)
    default: {
      const exhaustive: never = mimeType
      return exhaustive
    }
  }
}

function withoutBytes(result: SafeFetchBytesResult): SafeFetchResult {
  return {
    response: result.response,
    finalUrl: result.finalUrl,
    redirects: result.redirects,
    bytesRead: result.bytesRead,
    contentType: result.contentType,
  }
}

function assertPdfSignature(bytes: Uint8Array): void {
  if (!hasPdfSignature(bytes)) {
    throw new SafeFetchError('unsupported_content_type', 'PDF response does not have a valid %PDF- signature')
  }
}

/** Fetch a PDF with a strict MIME contract, a 10 MiB budget, and magic validation. */
export async function safeFetchPdf(
  input: string | URL,
  options: SafeContentFetchOptions = {},
): Promise<SafeFetchPdfResult> {
  const result = await safeFetchBytes(input, {
    ...options,
    maxResponseBytes: SAFE_PDF_MAX_BYTES,
    allowedContentTypes: PDF_CONTENT_TYPES,
  })
  assertPdfSignature(result.bytes)
  return { ...result, mimeType: 'application/pdf' }
}

/** Fetch a bounded image and require its declared MIME to match its magic bytes. */
export async function safeFetchImage(
  input: string | URL,
  options: SafeContentFetchOptions = {},
): Promise<SafeFetchImageResult> {
  const result = await safeFetchBytes(input, {
    ...options,
    maxResponseBytes: SAFE_IMAGE_MAX_BYTES,
    allowedContentTypes: IMAGE_CONTENT_TYPES,
  })
  const mimeType = normalizedMimeType(result.contentType)
  if (!IMAGE_CONTENT_TYPES.includes(mimeType as SafeImageMimeType)
    || !hasImageSignature(result.bytes, mimeType as SafeImageMimeType)) {
    throw new SafeFetchError('unsupported_content_type', 'Image MIME type does not match its signature')
  }
  return { ...result, mimeType: mimeType as SafeImageMimeType }
}

/** Fetch either bounded textual content or a validated PDF in one request. */
export async function safeFetchDocument(
  input: string | URL,
  options: SafeContentFetchOptions = {},
): Promise<SafeFetchDocumentResult> {
  const result = await safeFetchBytes(input, {
    ...options,
    maxResponseBytes: SAFE_PDF_MAX_BYTES,
    allowedContentTypes: DOCUMENT_CONTENT_TYPES,
    contentTypeMaxResponseBytes: {
      'text/': SAFE_DOCUMENT_TEXT_MAX_BYTES,
      'application/xhtml+xml': SAFE_DOCUMENT_TEXT_MAX_BYTES,
      'application/xml': SAFE_DOCUMENT_TEXT_MAX_BYTES,
      'application/json': SAFE_DOCUMENT_TEXT_MAX_BYTES,
      'application/pdf': SAFE_PDF_MAX_BYTES,
    },
  })
  const mimeType = normalizedMimeType(result.contentType)
  const shared = withoutBytes(result)

  if (mimeType === 'application/pdf') {
    assertPdfSignature(result.bytes)
    return { ...shared, kind: 'pdf', mimeType, bytes: result.bytes }
  }
  const declaredLength = Number(result.response.headers.get('content-length'))
  if (result.bytesRead > SAFE_DOCUMENT_TEXT_MAX_BYTES
    || (Number.isFinite(declaredLength) && declaredLength > SAFE_DOCUMENT_TEXT_MAX_BYTES)) {
    throw new SafeFetchError(
      'response_too_large',
      `Text response exceeds the ${SAFE_DOCUMENT_TEXT_MAX_BYTES}-byte limit`,
    )
  }
  return {
    ...shared,
    kind: 'text',
    mimeType,
    text: new TextDecoder().decode(result.bytes),
  }
}
