/**
 * PlaceSearch — Geocoding autocomplete for COP place creation.
 *
 * Uses OpenStreetMap Nominatim API (free, no API key) to resolve
 * place names to coordinates. Supports countries, cities, regions,
 * facilities, and addresses in English.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'

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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: '1',
        limit: '8',
        'accept-language': 'en',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'ResearchToolsPy/1.0' },
      })
      if (res.ok) {
        const data: NominatimResult[] = await res.json()
        setResults(data)
        setShowResults(true)
      }
    } catch {
      // Nominatim down — fail silently
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 350)
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

    // Show selected name in input, close dropdown
    setQuery(result.display_name.split(',')[0])
    setShowResults(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        Search Place
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder={placeholder ?? 'Type country, city, or place name...'}
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-200 rounded px-2.5 py-1.5 pl-8 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Results dropdown */}
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
                className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{primary}</p>
                  {secondary && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{secondary}</p>
                  )}
                </div>
                <span className="text-[9px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                  {pType}
                </span>
              </button>
            )
          })}
          <div className="px-3 py-1 text-[9px] text-gray-400 border-t border-gray-100 dark:border-gray-700/50">
            Data from OpenStreetMap
          </div>
        </div>
      )}
    </div>
  )
}
