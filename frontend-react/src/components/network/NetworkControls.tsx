import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Filter, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { EntityType, RelationshipConfidence } from '@/types/entities'

export interface NetworkFilters {
  entityTypes: Set<EntityType>
  minConfidence: number
  searchQuery: string
  showLabels: boolean
}

interface NetworkControlsProps {
  filters: NetworkFilters
  onFiltersChange: (filters: NetworkFilters) => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
  totalNodes: number
  totalEdges: number
}

const ENTITY_TYPES: EntityType[] = ['ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR', 'EVIDENCE']

const CONFIDENCE_LEVELS: Record<number, RelationshipConfidence> = {
  0: 'SUSPECTED',
  1: 'POSSIBLE',
  2: 'PROBABLE',
  3: 'CONFIRMED'
}

export function NetworkControls({
  filters,
  onFiltersChange,
  onZoomIn,
  onZoomOut,
  onFitView,
  totalNodes,
  totalEdges
}: NetworkControlsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleEntityTypeToggle = (entityType: EntityType) => {
    const newTypes = new Set(filters.entityTypes)
    if (newTypes.has(entityType)) {
      newTypes.delete(entityType)
    } else {
      newTypes.add(entityType)
    }
    onFiltersChange({ ...filters, entityTypes: newTypes })
  }

  const handleSelectAllEntityTypes = () => {
    onFiltersChange({
      ...filters,
      entityTypes: new Set(ENTITY_TYPES)
    })
  }

  const handleDeselectAllEntityTypes = () => {
    onFiltersChange({
      ...filters,
      entityTypes: new Set()
    })
  }

  const handleConfidenceChange = (value: number[]) => {
    onFiltersChange({ ...filters, minConfidence: value[0] })
  }

  const handleSearchChange = (query: string) => {
    onFiltersChange({ ...filters, searchQuery: query })
  }

  return (
    <Card className="w-80 h-full overflow-y-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" />
            Network Controls
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '−' : '+'}
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {totalNodes} nodes, {totalEdges} edges
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Search */}
          <div>
            <Label className="text-sm font-semibold mb-2">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search entities..."
                value={filters.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Entity Type Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Entity Types</Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllEntityTypes}
                  className="h-6 px-2 text-xs"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAllEntityTypes}
                  className="h-6 px-2 text-xs"
                >
                  None
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {ENTITY_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`entity-${type}`}
                    checked={filters.entityTypes.has(type)}
                    onCheckedChange={() => handleEntityTypeToggle(type)}
                  />
                  <label
                    htmlFor={`entity-${type}`}
                    className="text-sm cursor-pointer"
                  >
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence Filter */}
          <div>
            <Label className="text-sm font-semibold mb-2">
              Minimum Confidence: {CONFIDENCE_LEVELS[filters.minConfidence]}
            </Label>
            <Slider
              value={[filters.minConfidence]}
              onValueChange={handleConfidenceChange}
              min={0}
              max={3}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Suspected</span>
              <span>Confirmed</span>
            </div>
          </div>

          {/* View Controls */}
          <div>
            <Label className="text-sm font-semibold mb-2">View Controls</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onZoomIn}
                disabled={!onZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onZoomOut}
                disabled={!onZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onFitView}
                disabled={!onFitView}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Display Options */}
          <div>
            <Label className="text-sm font-semibold mb-2">Display</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-labels"
                checked={filters.showLabels}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showLabels: !!checked })
                }
              />
              <label htmlFor="show-labels" className="text-sm cursor-pointer">
                Show all labels
              </label>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
