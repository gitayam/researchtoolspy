/**
 * Entity Quick Filter Component
 * Search and filter entities extracted from content analysis
 * Displays entity counts by type with highlighting support
 */

import { useState, useMemo } from 'react'
import { Search, X, Users, Building2, MapPin, Calendar, Hash, DollarSign, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ContentAnalysis, EntityMention } from '@/types/content-intelligence'

interface EntityQuickFilterProps {
  analysis: ContentAnalysis
  onEntityClick?: (entity: string, type: string) => void
  highlightedEntity?: string | null
}

type EntityType = 'person' | 'organization' | 'location' | 'date' | 'money' | 'event' | 'product' | 'percentage' | 'email'

const ENTITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  person: Users,
  organization: Building2,
  location: MapPin,
  date: Calendar,
  money: DollarSign,
  event: Tag,
  product: Tag,
  percentage: Hash,
  email: Hash,
  DEFAULT: Hash,
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: 'bg-blue-500 hover:bg-blue-600',
  organization: 'bg-green-500 hover:bg-green-600',
  location: 'bg-orange-500 hover:bg-orange-600',
  date: 'bg-purple-500 hover:bg-purple-600',
  money: 'bg-emerald-500 hover:bg-emerald-600',
  event: 'bg-pink-500 hover:bg-pink-600',
  product: 'bg-cyan-500 hover:bg-cyan-600',
  percentage: 'bg-amber-500 hover:bg-amber-600',
  email: 'bg-indigo-500 hover:bg-indigo-600',
  DEFAULT: 'bg-gray-500 hover:bg-gray-600',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: 'People',
  organization: 'Organizations',
  location: 'Locations',
  date: 'Dates',
  money: 'Money',
  event: 'Events',
  product: 'Products',
  percentage: 'Percentages',
  email: 'Emails',
}

interface ProcessedEntity {
  name: string
  type: EntityType
  count: number
  contexts?: string[]
}

export function EntityQuickFilter({
  analysis,
  onEntityClick,
  highlightedEntity,
}: EntityQuickFilterProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTypeFilter, setActiveTypeFilter] = useState<EntityType | null>(null)

  // Process entities from the analysis
  const entityData = useMemo(() => {
    const entities: ProcessedEntity[] = []
    const typeCounts: Record<EntityType, number> = {} as Record<EntityType, number>

    if (!analysis.entities) {
      return { entities: [], types: [], typeCounts: {} }
    }

    // Process each entity type
    const processEntityArray = (arr: EntityMention[] | undefined, type: EntityType) => {
      if (!arr) return
      for (const entity of arr) {
        entities.push({
          name: entity.name,
          type,
          count: entity.count,
          contexts: entity.contexts,
        })
        typeCounts[type] = (typeCounts[type] || 0) + 1
      }
    }

    processEntityArray(analysis.entities.people, 'person')
    processEntityArray(analysis.entities.organizations, 'organization')
    processEntityArray(analysis.entities.locations, 'location')
    processEntityArray(analysis.entities.dates, 'date')
    processEntityArray(analysis.entities.money, 'money')
    processEntityArray(analysis.entities.events, 'event')
    processEntityArray(analysis.entities.products, 'product')
    processEntityArray(analysis.entities.percentages, 'percentage')

    // Process emails separately (different structure)
    if (analysis.entities.emails) {
      for (const email of analysis.entities.emails) {
        entities.push({
          name: email.email,
          type: 'email',
          count: email.count,
        })
        typeCounts['email'] = (typeCounts['email'] || 0) + 1
      }
    }

    // Get unique types that have entities
    const types = Object.keys(typeCounts).sort() as EntityType[]

    return { entities, types, typeCounts }
  }, [analysis.entities])

  // Filter entities based on search and type filter
  const filteredEntities = useMemo(() => {
    let result = entityData.entities

    // Apply type filter
    if (activeTypeFilter) {
      result = result.filter((e) => e.type === activeTypeFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((e) => e.name.toLowerCase().includes(query))
    }

    // Sort by count (descending), then alphabetically
    return result.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name)
    })
  }, [entityData.entities, activeTypeFilter, searchQuery])

  const handleEntityClick = (entity: ProcessedEntity) => {
    if (onEntityClick) {
      onEntityClick(entity.name, entity.type)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setActiveTypeFilter(null)
  }

  const hasActiveFilters = searchQuery.trim() !== '' || activeTypeFilter !== null

  const getIcon = (type: string) => {
    const Icon = ENTITY_TYPE_ICONS[type] || ENTITY_TYPE_ICONS.DEFAULT
    return Icon
  }

  const getColor = (type: string) => {
    return ENTITY_TYPE_COLORS[type] || ENTITY_TYPE_COLORS.DEFAULT
  }

  if (entityData.entities.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No entities found in this content.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Type Filter Badges */}
        <div className="flex flex-wrap gap-1.5">
          {entityData.types.map((type) => {
            const Icon = getIcon(type)
            const isActive = activeTypeFilter === type
            const count = entityData.typeCounts[type]

            return (
              <button
                key={type}
                onClick={() => setActiveTypeFilter(isActive ? null : type)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                  isActive
                    ? `${getColor(type)} text-white`
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{ENTITY_TYPE_LABELS[type] || type}</span>
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px]',
                    isActive ? 'bg-white/20' : 'bg-background'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Entity List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredEntities.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No entities match your filters.
            </div>
          ) : (
            filteredEntities.map((entity, index) => {
              const Icon = getIcon(entity.type)
              const isHighlighted = highlightedEntity === entity.name
              const colorClass = getColor(entity.type)

              return (
                <button
                  key={`${entity.type}-${entity.name}-${index}`}
                  onClick={() => handleEntityClick(entity)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-all',
                    'hover:bg-accent',
                    isHighlighted && 'ring-2 ring-primary bg-accent'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-1.5 rounded-md text-white shrink-0',
                        colorClass.split(' ')[0] // Only use the base color, not hover
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'font-medium truncate',
                            isHighlighted && 'text-primary'
                          )}
                        >
                          {entity.name}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {entity.count}x
                        </Badge>
                      </div>
                      {entity.contexts && entity.contexts.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {entity.contexts[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer with total count */}
      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {filteredEntities.length} of {entityData.entities.length} entities
          {activeTypeFilter && ` (${ENTITY_TYPE_LABELS[activeTypeFilter] || activeTypeFilter})`}
        </p>
      </div>
    </div>
  )
}
