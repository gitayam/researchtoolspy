/**
 * PlaceSearch — place lookup for COP place creation.
 *
 * Uses the public OpenStreetMap Nominatim API (no key) to resolve a place name
 * to coordinates. Nominatim's usage policy bans search-as-you-type, so a search
 * runs only when the analyst presses Enter or the Search button, and results
 * carry the OpenStreetMap credit. The browser's own Referer (this site's origin)
 * identifies the app; a User-Agent header can't be set from a browser.
 */

import { useState, useRef, useEffect, useId } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'
import OsmCredit from '../OsmCredit'

// ── Types ────────────────────────────────────────────────────────

export interface PlaceResult {
  displayName: string
  lat: number
  lng: number
  country: string
  region: string
  placeType: string
  boundingBox?: [number, number, number, number]
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  class: string
  address?: {
    country?: string
    state?: string
    county?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
  }
}

interface PlaceSearchProps {
  onSelect: (result: PlaceResult) => void
  placeholder?: string
}

// ── Helpers ──────────────────────────────────────────────────────

function inferPlaceType(result: NominatimResult): string {
  const cls = result.class?.toLowerCase()
  const typ = result.type?.toLowerCase()

  if (typ === 'country' || cls === 'boundary' && typ === 'administrative') {
    // Check if it's a country by looking at display_name parts
    const parts = result.display_name.split(',').map(p => p.trim())
    if (parts.length <= 2) return 'COUNTRY'
    return 'REGION'
  }
  if (typ === 'city' || typ === 'town' || typ === 'village' || typ === 'municipality') return 'CITY'
  if (typ === 'state' || typ === 'province') return 'REGION'
  if (cls === 'military' || cls === 'aeroway' || typ === 'airfield' || typ === 'military') return 'INSTALLATION'
  if (cls === 'building' || cls === 'amenity') return 'FACILITY'
  if (typ === 'country') return 'COUNTRY'
  return 'OTHER'
}

// ── Component ────────────────────────────────────────────────────

export default function PlaceSearch({ onSelect, placeholder }: PlaceSearchProps) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const lastSearched = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close the results on an outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = async () => {
    const q = query.trim()
    if (q.length < 2) {
      setMessage('Type at least two characters, then search.')
      setResults([])
      return
    }
    // The same query again just reopens its results: Nominatim asks clients not to repeat queries.
    if (q === lastSearched.current && results.length > 0) {
      setShowResults(true)
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: '1',
        limit: '8',
        'accept-language': 'en',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      if (!res.ok) {
        setResults([])
        setMessage('Place search is unavailable right now. Try again later or enter coordinates.')
        return
      }
      const data = await res.json() as NominatimResult[]
      lastSearched.current = q
      setResults(Array.isArray(data) ? data : [])
      setMessage(Array.isArray(data) && data.length > 0 ? null : 'No places found. Try a more specific name.')
      setShowResults(true)
    } catch {
      setResults([])
      setMessage('Place search is unavailable right now. Try again later or enter coordinates.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (result: NominatimResult) => {
    const addr = result.address ?? {}
    const country = addr.country ?? ''
    const region = addr.state ?? addr.county ?? ''

    onSelect({
      displayName: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      country,
      region,
      placeType: inferPlaceType(result),
    })

    // Show the chosen name in the input and close the results.
    setQuery(result.display_name.split(',')[0])
    lastSearched.current = null
    setShowResults(false)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && showResults) {
          e.stopPropagation()
          setShowResults(false)
          inputRef.current?.focus()
        }
      }}
    >
      <label htmlFor={inputId} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        Search Place
      </label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Never submit an enclosing form from here.
                e.preventDefault()
                if (!loading) void search()
              }
            }}
            onFocus={() => results.length > 0 && query.trim() === lastSearched.current && setShowResults(true)}
            placeholder={placeholder ?? 'Country, city or place, then Enter'}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-200 rounded px-2.5 py-1.5 pl-8 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1 rounded border border-gray-300 dark:border-gray-600 px-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Search className="h-3.5 w-3.5" aria-hidden="true" />}
          Search
        </button>
      </div>

      <div role="status" aria-live="polite">
        {message && <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">{message}</p>}
      </div>

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => {
            const parts = r.display_name.split(',')
            const primary = parts[0].trim()
            const secondary = parts.slice(1, 3).map(p => p.trim()).join(', ')
            const pType = inferPlaceType(r)

            return (
              <button
                key={r.place_id}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-2 px-3 py-2 min-h-[44px] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500"
              >
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{primary}</p>
                  {secondary && (
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{secondary}</p>
                  )}
                </div>
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                  {pType}
                </span>
              </button>
            )
          })}
          <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700/50">
            <OsmCredit />
          </div>
        </div>
      )}
    </div>
  )
}
