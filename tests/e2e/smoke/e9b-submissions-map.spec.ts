/**
 * E-9b — Map tab for geolocated submissions.
 *
 * Pure-Node unit tests — no `page` fixture, no server.
 *
 * Guards:
 *  1. `submission-geo.ts` exists and exports the expected symbols.
 *  2. `extractSubmissionGeo` correctly extracts (or rejects) lat/lng from a
 *     variety of `metadata` shapes.
 *  3. `filterGeoSubmissions` pairs each geolocated submission with its point.
 *  4. The Map tab trigger is registered in `EvidenceSubmissionsPage.tsx`.
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Dynamic import of the pure TS helper (compiled by tsx/playwright transform) ─

import {
  extractSubmissionGeo,
  filterGeoSubmissions,
} from '../../../src/lib/submission-geo'

// ── 1. Source-guard: file exists and exports the right names ──────────────────

test('@smoke submission-geo module exports extractSubmissionGeo and filterGeoSubmissions', () => {
  expect(typeof extractSubmissionGeo).toBe('function')
  expect(typeof filterGeoSubmissions).toBe('function')
})

// ── 2. extractSubmissionGeo — valid cases ─────────────────────────────────────

test('@smoke extracts lat/lng from latitude + longitude string fields', () => {
  const point = extractSubmissionGeo({
    metadata: { latitude: '37.5', longitude: '-122.1' },
  })
  expect(point).not.toBeNull()
  expect(point!.lat).toBeCloseTo(37.5)
  expect(point!.lng).toBeCloseTo(-122.1)
})

test('@smoke extracts lat/lng from numeric latitude + longitude fields', () => {
  const point = extractSubmissionGeo({
    metadata: { latitude: 51.5074, longitude: -0.1278 },
  })
  expect(point).not.toBeNull()
  expect(point!.lat).toBeCloseTo(51.5074)
  expect(point!.lng).toBeCloseTo(-0.1278)
})

test('@smoke extracts lat/lng from short lat + lng fields', () => {
  const point = extractSubmissionGeo({
    metadata: { lat: '48.8566', lng: '2.3522' },
  })
  expect(point).not.toBeNull()
  expect(point!.lat).toBeCloseTo(48.8566)
  expect(point!.lng).toBeCloseTo(2.3522)
})

test('@smoke extracts lat/lng from comma-separated location string', () => {
  const point = extractSubmissionGeo({
    metadata: { location: '37.5,-122.1' },
  })
  expect(point).not.toBeNull()
  expect(point!.lat).toBeCloseTo(37.5)
  expect(point!.lng).toBeCloseTo(-122.1)
})

test('@smoke extracts lat/lng from location object with lat/lng keys', () => {
  const point = extractSubmissionGeo({
    metadata: { location: { lat: 35.6762, lng: 139.6503 } },
  })
  expect(point).not.toBeNull()
  expect(point!.lat).toBeCloseTo(35.6762)
  expect(point!.lng).toBeCloseTo(139.6503)
})

// ── 3. extractSubmissionGeo — invalid / boundary cases ───────────────────────

test('@smoke rejects latitude out of range (> 90)', () => {
  const point = extractSubmissionGeo({
    metadata: { lat: 91, lng: 0 },
  })
  expect(point).toBeNull()
})

test('@smoke rejects longitude out of range (< -180)', () => {
  const point = extractSubmissionGeo({
    metadata: { lat: 0, lng: -181 },
  })
  expect(point).toBeNull()
})

test('@smoke returns null for empty metadata', () => {
  const point = extractSubmissionGeo({ metadata: {} })
  expect(point).toBeNull()
})

test('@smoke returns null when metadata is null', () => {
  const point = extractSubmissionGeo({ metadata: null })
  expect(point).toBeNull()
})

test('@smoke returns null for non-numeric latitude string', () => {
  const point = extractSubmissionGeo({
    metadata: { latitude: 'not-a-number', longitude: '12.0' },
  })
  expect(point).toBeNull()
})

test('@smoke returns null when no geo fields are present', () => {
  const point = extractSubmissionGeo({
    source_url: 'https://example.com',
    content_description: 'Some text',
    metadata: { title: 'My submission', keywords: ['osint'] },
  })
  expect(point).toBeNull()
})

// ── 4. GeoPoint label derivation ──────────────────────────────────────────────

test('@smoke label falls back to source_url when no metadata.title', () => {
  const point = extractSubmissionGeo({
    source_url: 'https://example.com/evidence',
    metadata: { latitude: '10.0', longitude: '20.0' },
  })
  expect(point).not.toBeNull()
  expect(point!.label).toBe('https://example.com/evidence')
})

test('@smoke label uses metadata.title when present', () => {
  const point = extractSubmissionGeo({
    source_url: 'https://example.com',
    metadata: { latitude: '10.0', longitude: '20.0', title: 'Field Report Alpha' },
  })
  expect(point).not.toBeNull()
  expect(point!.label).toBe('Field Report Alpha')
})

// ── 5. filterGeoSubmissions ───────────────────────────────────────────────────

test('@smoke filterGeoSubmissions pairs only geolocated entries', () => {
  const subs = [
    { metadata: { latitude: '37.5', longitude: '-122.1' }, source_url: 'https://a.com' },
    { metadata: { title: 'no geo' } },
    { metadata: { lat: 48.8, lng: 2.35 } },
  ]
  const result = filterGeoSubmissions(subs)
  expect(result).toHaveLength(2)
  expect(result[0].point.lat).toBeCloseTo(37.5)
  expect(result[1].point.lat).toBeCloseTo(48.8)
})

// ── 6. Page source guard: Map tab is registered in EvidenceSubmissionsPage ────

test('@smoke EvidenceSubmissionsPage registers a Map tab', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../src/pages/EvidenceSubmissionsPage.tsx'),
    'utf-8',
  )
  // The tab value must be "map"
  expect(src).toContain('value="map"')
  // The Map tab trigger must reference the MapPin icon
  expect(src).toContain('MapPin')
  // The tab content for map must render SubmissionsMap
  expect(src).toContain('SubmissionsMap')
})
