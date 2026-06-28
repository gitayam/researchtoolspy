/**
 * EXIF-strip smoke test (E-6c) — pure-Node, no browser, no HTTP server.
 *
 * Pins the privacy guarantee for served uploads: `stripImageExif` removes every
 * JPEG APP1 segment (where EXIF GPS coordinates and XMP live) while leaving the
 * rest of the image byte-identical, and never corrupts non-JPEG or malformed
 * inputs (it returns them unchanged). Imports the helper directly — no `page`
 * fixture, no running server.
 */
import { test, expect } from '@playwright/test'
import { stripImageExif } from '../../../functions/api/uploads/_exif'

// "Exif\0\0" — the EXIF identifier that opens an APP1 EXIF payload.
const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]

/** Build a [FF marker, hi, lo, ...payload] segment with a correct big-endian length. */
function segment(markerCode: number, payload: number[]): number[] {
  const segLen = payload.length + 2 // length field counts its own 2 bytes
  return [0xff, markerCode, (segLen >> 8) & 0xff, segLen & 0xff, ...payload]
}

function bytesIndexOf(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

test.describe('EXIF strip: APP1 removed from served JPEGs, everything else preserved @smoke', () => {
  test('@smoke removes APP1 EXIF, keeps SOI/APP0/SOS/scan/EOI, and shrinks the array', () => {
    const app1 = segment(0xe1, [...EXIF_ID, 0xde, 0xad, 0xbe, 0xef]) // EXIF + a few GPS-ish bytes
    const app0 = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]) // "JFIF\0\1" — keep
    const scan = [0x12, 0x34, 0x56, 0x78]
    const jpeg = new Uint8Array([
      0xff, 0xd8, // SOI
      ...app1, // APP1 EXIF — must be stripped
      ...app0, // APP0 JFIF — must survive
      0xff, 0xda, ...scan, // SOS + entropy-coded scan data
      0xff, 0xd9, // EOI
    ])

    const out = stripImageExif(jpeg, 'image/jpeg')

    // APP1 / EXIF marker is gone.
    expect(bytesIndexOf(out, EXIF_ID)).toBe(-1)
    expect(bytesIndexOf(out, [0xde, 0xad, 0xbe, 0xef])).toBe(-1)
    expect(bytesIndexOf(out, [0xff, 0xe1])).toBe(-1)

    // Structure preserved.
    expect([out[0], out[1]]).toEqual([0xff, 0xd8]) // SOI
    expect(bytesIndexOf(out, app0)).toBeGreaterThan(-1) // APP0 intact
    expect(bytesIndexOf(out, [0xff, 0xda, ...scan])).toBeGreaterThan(-1) // SOS + scan
    expect([out[out.length - 2], out[out.length - 1]]).toEqual([0xff, 0xd9]) // EOI

    // Stripping the APP1 segment makes the result strictly shorter.
    expect(out.byteLength).toBeLessThan(jpeg.byteLength)
  })

  test('@smoke JPEG with no APP1 is returned unchanged', () => {
    const app0 = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      ...app0,
      0xff, 0xda, 0x12, 0x34,
      0xff, 0xd9,
    ])

    const out = stripImageExif(jpeg, 'image/jpeg')
    expect(Array.from(out)).toEqual(Array.from(jpeg))
  })

  test('@smoke non-JPEG (PNG) is returned unchanged', () => {
    // PNG 8-byte signature + a couple of trailing bytes.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
    const out = stripImageExif(png, 'image/png')
    expect(Array.from(out)).toEqual(Array.from(png))
  })

  test('@smoke truncated / garbage JPEG is returned unchanged (defensive, no throw)', () => {
    // Valid SOI then nonsense that does not parse as marker segments.
    const garbage = new Uint8Array([0xff, 0xd8, 0x00, 0x11, 0x22, 0x33, 0x44])
    let out: Uint8Array | undefined
    expect(() => {
      out = stripImageExif(garbage, 'image/jpeg')
    }).not.toThrow()
    expect(Array.from(out as Uint8Array)).toEqual(Array.from(garbage))
  })
})
