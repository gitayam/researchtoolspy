/**
 * EXIF stripping helper (E-6c) — pure, zero-dependency, unit-testable.
 *
 * Camera photos carry EXIF metadata that frequently includes GPS coordinates.
 * When we serve an uploaded image to anyone with the (unguessable) object key,
 * that location data must NOT leak. This module removes the metadata segments
 * from JPEG byte streams before they are served.
 *
 * JPEG stores both EXIF (`Exif\0\0…`, including the GPS IFD) and XMP inside APP1
 * segments (marker `FF E1`). Removing every APP1 segment drops both. We leave the
 * image otherwise byte-identical: SOI, APP0/JFIF, quantization/Huffman tables, the
 * SOS marker, all entropy-coded scan data, and EOI are preserved.
 *
 * Follow-up (not implemented here): PNG carries EXIF in an `eXIf` chunk and WebP in
 * an `EXIF` RIFF chunk. JPEG is the dominant camera-GPS carrier, so it ships first;
 * PNG/WebP stripping is a separate unit. Non-JPEG inputs are returned unchanged.
 */

/**
 * Strip EXIF/XMP (APP1) metadata from a JPEG byte array.
 *
 * For non-JPEG content types or unrecognized bytes, returns `bytes` unchanged.
 * On any malformed/short read, returns the ORIGINAL bytes unchanged so we never
 * corrupt an image we failed to fully parse.
 */
export function stripImageExif(bytes: Uint8Array, contentType: string): Uint8Array {
  const ct = (contentType || '').toLowerCase()
  const looksJpeg = ct === 'image/jpeg' || ct === 'image/jpg'
  const hasJpegMagic = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8

  // Only attempt JPEG processing. Other types (png/webp/gif) pass through; PNG
  // `eXIf` / WebP EXIF stripping is a follow-up unit.
  if (!looksJpeg && !hasJpegMagic) return bytes
  if (!hasJpegMagic) return bytes // claims JPEG by content-type but bytes disagree → leave alone

  try {
    const out: number[] = []
    // Copy SOI (FF D8).
    out.push(0xff, 0xd8)

    let i = 2
    const len = bytes.length

    while (i < len) {
      // Each marker must start with 0xFF.
      if (bytes[i] !== 0xff) {
        // Malformed marker structure — bail out, return original untouched.
        return bytes
      }
      // Skip any fill bytes (0xFF padding) to reach the real marker code.
      let markerPos = i + 1
      while (markerPos < len && bytes[markerPos] === 0xff) markerPos++
      if (markerPos >= len) return bytes // ran off the end looking for a code

      const code = bytes[markerPos]

      // Start Of Scan: copy the SOS marker and ALL remaining bytes verbatim
      // (the entropy-coded scan data and trailing EOI live after it).
      if (code === 0xda) {
        for (let p = i; p < len; p++) out.push(bytes[p])
        return Uint8Array.from(out)
      }

      // End Of Image with no preceding SOS — copy and finish.
      if (code === 0xd9) {
        out.push(0xff, 0xd9)
        return Uint8Array.from(out)
      }

      // Standalone markers carry no length payload:
      //   FF D0–FF D7 (RST0–RST7), FF 01 (TEM). (FF D8/FF D9 handled elsewhere.)
      if ((code >= 0xd0 && code <= 0xd7) || code === 0x01) {
        out.push(0xff, code)
        i = markerPos + 1
        continue
      }

      // All other markers have a 2-byte big-endian length (which INCLUDES the two
      // length bytes themselves) immediately after the marker code.
      const lenHiPos = markerPos + 1
      const lenLoPos = markerPos + 2
      if (lenLoPos >= len) return bytes // truncated length field
      const segLen = (bytes[lenHiPos] << 8) | bytes[lenLoPos]
      if (segLen < 2) return bytes // invalid length (must include its own 2 bytes)

      const payloadStart = lenHiPos // length bytes are part of the segment
      const segEnd = payloadStart + segLen // one past the last byte of this segment
      if (segEnd > len) return bytes // segment runs past end of buffer

      // Drop APP1 (FF E1) entirely — this is EXIF (incl. GPS) and XMP.
      if (code !== 0xe1) {
        out.push(0xff, code)
        for (let p = payloadStart; p < segEnd; p++) out.push(bytes[p])
      }

      i = segEnd
    }

    // Reached end without an SOS/EOI — structurally odd. Don't risk corruption.
    return bytes
  } catch {
    // Any unexpected failure: never emit a damaged image.
    return bytes
  }
}
