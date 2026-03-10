/**
 * CopEntityDrawer -- Right-side slide-in panel for managing all entity types
 * in the COP workspace. Contains tabbed navigation for 5 entity types,
 * search filtering, entity cards with expandable details, and inline creation.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  Loader2,
  Plus,
  Search,
  User,
  Calendar,
  MapPin,
  Radio,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import EntityCard from '@/components/cop/entities/EntityCard'
import EntityCreateForm from '@/components/cop/entities/EntityCreateForm'
import EntityRelationships from '@/components/cop/entities/EntityRelationships'
import EntityEvidenceLinks from '@/components/cop/entities/EntityEvidenceLinks'
import type { Actor, Event, Place, Source, Behavior } from '@/types/entities'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

type TabKey = 'actors' | 'events' | 'places' | 'sources' | 'behaviors'

type AnyEntity = Actor | Event | Place | Source | Behavior

interface CopEntityDrawerProps {
  sessionId: string
  workspaceId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: TabKey
  prefill?: {
    entityType?: string
    data?: Record<string, any>
    personaId?: string
    linkedEvidence?: any
  }
  onPinToMap?: (lat: number, lon: number, label: string) => void
}

// ── Constants ────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'actors', label: 'Actors', icon: User },
  { key: 'events', label: 'Events', icon: Calendar },
  { key: 'places', label: 'Places', icon: MapPin },
  { key: 'sources', label: 'Sources', icon: Radio },
  { key: 'behaviors', label: 'Behaviors', icon: Zap },
]

const EXTRACT_KEYS: Record<TabKey, string> = {
  actors: 'actors',
  events: 'events',
  places: 'places',
  sources: 'sources',
  behaviors: 'behaviors',
}

// ── Helpers ──────────────────────────────────────────────────────


function singularUpper(tab: TabKey): string {
  return tab.slice(0, -1).toUpperCase() // 'actors' → 'ACTOR'
}

function singularLabel(tab: TabKey): string {
  const s = tab.slice(0, -1)
  return s.charAt(0).toUpperCase() + s.slice(1) // 'actors' → 'Actor'
}

// ── Component ────────────────────────────────────────────────────

export default function CopEntityDrawer({
  sessionId,
  workspaceId,
  open,
  onOpenChange,
  initialTab,
  prefill,
  onPinToMap,
}: CopEntityDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'actors')
  const [cache, setCache] = useState<Record<TabKey, AnyEntity[] | null>>({
    actors: null,
    events: null,
    places: null,
    sources: null,
    behaviors: null,
  })
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch entities for a tab ────────────────────────────────────

  const fetchEntities = useCallback(
    async (tab: TabKey, force = false) => {
      if (!force && cache[tab] !== null) return
      setLoading(true)
      try {
        const params = new URLSearchParams({ workspace_id: workspaceId || sessionId })
        const res = await fetch(`/api/${tab}?${params}`, {
          headers: getCopHeaders(),
        })
        if (!res.ok) throw new Error(`Failed to fetch ${tab}`)
        const data = await res.json()
        const key = EXTRACT_KEYS[tab]
        const entities: AnyEntity[] = Array.isArray(data)
          ? data
          : data[key] ?? []
        setCache((prev) => ({ ...prev, [tab]: entities }))
      } catch (err) {
        console.error(`Failed to fetch ${tab}:`, err)
        setCache((prev) => ({ ...prev, [tab]: [] }))
      } finally {
        setLoading(false)
      }
    },
    [sessionId, cache],
  )

  // ── Effects ─────────────────────────────────────────────────────

  // Fetch data when tab changes
  useEffect(() => {
    if (open) {
      fetchEntities(activeTab)
    }
  }, [activeTab, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle initialTab prop
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab)
    }
  }, [open, initialTab])

  // Handle prefill
  useEffect(() => {
    if (open && prefill?.entityType) {
      const tabKey = (
        prefill.entityType.endsWith('s')
          ? prefill.entityType
          : prefill.entityType + 's'
      ).toLowerCase() as TabKey
      if (TABS.some((t) => t.key === tabKey)) {
        setActiveTab(tabKey)
        setShowCreateForm(true)
      }
    }
  }, [open, prefill])

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setExpandedId(null)
      setShowCreateForm(false)
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // ── Handlers ────────────────────────────────────────────────────

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    setSearchQuery('')
    setExpandedId(null)
    setShowCreateForm(false)
  }

  const handleEntityCreated = useCallback(
    (_entity: any) => {
      // Invalidate cache and re-fetch
      setCache((prev) => ({ ...prev, [activeTab]: null }))
      setShowCreateForm(false)
      fetchEntities(activeTab, true)
    },
    [activeTab, fetchEntities],
  )

  const handlePinToMap = (entity: AnyEntity) => {
    if (!onPinToMap) return
    if (activeTab === 'places') {
      const place = entity as Place
      if (place.coordinates) {
        onPinToMap(place.coordinates.lat, place.coordinates.lng, place.name)
        return
      }
    }
    // For non-place entities, inform the user
    console.warn('No location data — add a LOCATED_AT relationship first')
  }

  const handleEdit = (_entity: AnyEntity) => {
    // Placeholder — edit flow is not yet implemented
  }

  // ── Derived state ───────────────────────────────────────────────

  const currentEntities = cache[activeTab] ?? []
  const filteredEntities = searchQuery.trim()
    ? currentEntities.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : currentEntities

  const entityCounts: Record<TabKey, number> = {
    actors: cache.actors?.length ?? 0,
    events: cache.events?.length ?? 0,
    places: cache.places?.length ?? 0,
    sources: cache.sources?.length ?? 0,
    behaviors: cache.behaviors?.length ?? 0,
  }

  const totalEntities = Object.values(entityCounts).reduce((a, b) => a + b, 0)

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-[440px] z-50',
          'transform transition-transform duration-200 ease-out',
          'bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl',
          'flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Entity Drawer"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Entity Drawer
            </h2>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full font-medium">
              {totalEntities}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="px-4 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className={cn(
                'w-full pl-8 pr-3 py-1.5 text-sm rounded-md',
                'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                'text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'focus:outline-none focus:ring-1 focus:ring-purple-500',
              )}
            />
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex gap-1 flex-wrap">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              const count = cache[tab.key]?.length
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                    isActive
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{tab.label}</span>
                  {count !== undefined && (
                    <span className="text-[10px] opacity-70">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Entity list ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-2">
            {/* Loading state */}
            {loading && cache[activeTab] === null && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}

            {/* Empty state */}
            {!loading && currentEntities.length === 0 && !showCreateForm && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No {activeTab} yet. Create one to get started.
                </p>
              </div>
            )}

            {/* Search no-results */}
            {!loading &&
              searchQuery.trim() &&
              filteredEntities.length === 0 &&
              currentEntities.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No results for &lsquo;{searchQuery}&rsquo;
                  </p>
                </div>
              )}

            {/* Entity cards */}
            {filteredEntities.map((entity) => (
              <div key={entity.id}>
                <EntityCard
                  entity={entity}
                  entityType={activeTab}
                  expanded={expandedId === entity.id}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === entity.id ? null : entity.id)
                  }
                  onPinToMap={() => handlePinToMap(entity)}
                  onEdit={() => handleEdit(entity)}
                  onLinkEvidence={() =>
                    setExpandedId(entity.id)
                  }
                  onAddRelationship={() =>
                    setExpandedId(entity.id)
                  }
                />

                {/* Expanded sub-panels */}
                {expandedId === entity.id && (
                  <div className="mt-1 ml-2 space-y-2">
                    <EntityRelationships
                      entityId={entity.id}
                      entityType={singularUpper(activeTab)}
                      sessionId={sessionId}
                      workspaceId={workspaceId || sessionId}
                    />
                    <EntityEvidenceLinks
                      entityId={entity.id}
                      entityType={singularUpper(activeTab)}
                      sessionId={sessionId}
                      workspaceId={workspaceId || sessionId}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add button */}
            {!showCreateForm && !loading && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed',
                  'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400',
                  'hover:border-purple-400 hover:text-purple-500 dark:hover:border-purple-500 dark:hover:text-purple-400',
                  'transition-colors cursor-pointer text-sm',
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Add {singularLabel(activeTab)}
              </button>
            )}

            {/* Inline create form */}
            {showCreateForm && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-3">
                <EntityCreateForm
                  entityType={activeTab}
                  sessionId={sessionId}
                  workspaceId={workspaceId || sessionId}
                  onCreated={handleEntityCreated}
                  onCancel={() => setShowCreateForm(false)}
                  prefill={prefill?.data}
                />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
