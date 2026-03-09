/**
 * Cross-type entity search component for selecting relationship targets.
 * Searches across actors, events, places, sources, and behaviors simultaneously.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, User, Calendar, MapPin, Radio, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EntitySearchProps {
  sessionId: string
  onSelect: (entityId: string, entityType: string, entityName: string) => void
  excludeId?: string
  filterTypes?: string[]
  placeholder?: string
  className?: string
}

interface SearchResult {
  id: string
  name: string
  type: string
  subtype?: string
  entityType: string
}

const ENTITY_TYPE_CONFIG: Record<string, {
  label: string
  icon: typeof User
  endpoint: string
  extract: (data: any) => Array<{ id: string; name: string; subtype?: string }>
}> = {
  actors: {
    label: 'Actors',
    icon: User,
    endpoint: '/api/actors',
    extract: (data) => (data.actors || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      subtype: a.type,
    })),
  },
  events: {
    label: 'Events',
    icon: Calendar,
    endpoint: '/api/events',
    extract: (data) => (data.events || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      subtype: e.event_type,
    })),
  },
  places: {
    label: 'Places',
    icon: MapPin,
    endpoint: '/api/places',
    extract: (data) => (data.places || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      subtype: p.place_type,
    })),
  },
  sources: {
    label: 'Sources',
    icon: Radio,
    endpoint: '/api/sources',
    extract: (data) => (data.sources || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      subtype: s.type,
    })),
  },
  behaviors: {
    label: 'Behaviors',
    icon: Zap,
    endpoint: '/api/behaviors',
    extract: (data) => (data.behaviors || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      subtype: b.behavior_type,
    })),
  },
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

export function EntitySearch({
  sessionId,
  onSelect,
  excludeId,
  filterTypes,
  placeholder = 'Search entities...',
  className,
}: EntitySearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<string, SearchResult[]>>({})
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const typesToSearch = filterTypes
    ? Object.keys(ENTITY_TYPE_CONFIG).filter((t) => filterTypes.includes(t))
    : Object.keys(ENTITY_TYPE_CONFIG)

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults({})
        setLoading(false)
        return
      }

      setLoading(true)
      const headers = getHeaders()

      try {
        const fetches = typesToSearch.map(async (typeKey) => {
          const config = ENTITY_TYPE_CONFIG[typeKey]
          const params = new URLSearchParams({
            workspace_id: sessionId,
            search: searchQuery,
            limit: '5',
          })

          const response = await fetch(`${config.endpoint}?${params}`, { headers })
          if (!response.ok) return { typeKey, items: [] }

          const data = await response.json()
          const extracted = config.extract(data)

          const items: SearchResult[] = extracted
            .filter((item) => item.id !== excludeId)
            .map((item) => ({
              id: item.id,
              name: item.name,
              type: typeKey,
              subtype: item.subtype,
              entityType: typeKey,
            }))

          return { typeKey, items }
        })

        const responses = await Promise.allSettled(fetches)
        const grouped: Record<string, SearchResult[]> = {}

        for (const response of responses) {
          if (response.status === 'fulfilled' && response.value.items.length > 0) {
            grouped[response.value.typeKey] = response.value.items
          }
        }

        setResults(grouped)
      } catch (error) {
        console.error('Entity search failed:', error)
        setResults({})
      } finally {
        setLoading(false)
      }
    },
    [sessionId, excludeId, typesToSearch.join(',')]
  )

  const handleInputChange = (value: string) => {
    setQuery(value)
    setShowDropdown(true)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value.trim()) {
      setResults({})
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  const handleSelect = (result: SearchResult) => {
    onSelect(result.id, result.entityType, result.name)
    setQuery('')
    setResults({})
    setShowDropdown(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const hasResults = Object.keys(results).length > 0
  const showEmpty = !loading && query.trim().length > 0 && !hasResults

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.trim()) setShowDropdown(true)
          }}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-700',
            'text-gray-900 dark:text-gray-200',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500'
          )}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {showDropdown && (hasResults || showEmpty) && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full max-h-[240px] overflow-y-auto',
            'bg-white dark:bg-gray-900',
            'border border-gray-200 dark:border-gray-700',
            'shadow-lg rounded-lg'
          )}
        >
          {showEmpty && (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No entities found
            </div>
          )}

          {typesToSearch.map((typeKey) => {
            const typeResults = results[typeKey]
            if (!typeResults || typeResults.length === 0) return null

            const config = ENTITY_TYPE_CONFIG[typeKey]
            const Icon = config.icon

            return (
              <div key={typeKey}>
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Icon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  <span className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                    {config.label}
                  </span>
                </div>
                {typeResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelect(result)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                      'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
                      'text-gray-900 dark:text-gray-200'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{result.name}</div>
                      {result.subtype && (
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {result.subtype}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
