import { useState } from 'react'
import { Plus, Filter, SortAsc, SortDesc, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RelationshipCard } from './RelationshipCard'
import type { Relationship, RelationshipType, EntityType } from '@/types/entities'

interface RelationshipListProps {
  relationships: Relationship[]
  entityNames?: Record<string, string>
  onEdit?: (relationship: Relationship) => void
  onDelete?: (relationship: Relationship) => void
  onNavigateToEntity?: (entityId: string, entityType: EntityType) => void
  onCreateNew?: () => void
  compact?: boolean
  showFilters?: boolean
  showValidation?: boolean
}

export function RelationshipList({
  relationships,
  entityNames = {},
  onEdit,
  onDelete,
  onNavigateToEntity,
  onCreateNew,
  compact = false,
  showFilters = true,
  showValidation = true
}: RelationshipListProps) {
  const [sortBy, setSortBy] = useState<'date' | 'weight' | 'type'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterType, setFilterType] = useState<'all' | RelationshipType>('all')
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'SUSPECTED'>('all')
  const [filterValidation, setFilterValidation] = useState<'all' | 'VALIDATED' | 'PENDING' | 'REJECTED'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter relationships
  let filteredRelationships = relationships

  if (filterType !== 'all') {
    filteredRelationships = filteredRelationships.filter(r => r.relationship_type === filterType)
  }

  if (filterConfidence !== 'all') {
    filteredRelationships = filteredRelationships.filter(r => r.confidence === filterConfidence)
  }

  if (filterValidation !== 'all') {
    filteredRelationships = filteredRelationships.filter(r => r.validation_status === filterValidation)
  }

  if (searchQuery) {
    filteredRelationships = filteredRelationships.filter(r => {
      const sourceName = entityNames[r.source_entity_id]?.toLowerCase() || ''
      const targetName = entityNames[r.target_entity_id]?.toLowerCase() || ''
      const description = r.description?.toLowerCase() || ''
      const query = searchQuery.toLowerCase()

      return sourceName.includes(query) ||
             targetName.includes(query) ||
             description.includes(query) ||
             r.relationship_type.toLowerCase().includes(query)
    })
  }

  // Sort relationships
  const sortedRelationships = [...filteredRelationships].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case 'weight':
        comparison = a.weight - b.weight
        break
      case 'type':
        comparison = a.relationship_type.localeCompare(b.relationship_type)
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  const toggleSortOrder = () => {
    setSortOrder(current => current === 'asc' ? 'desc' : 'asc')
  }

  const relationshipTypes: RelationshipType[] = [
    'CONTROLS', 'REPORTS_TO', 'ALLIED_WITH', 'ADVERSARY_OF', 'MEMBER_OF',
    'LOCATED_AT', 'PARTICIPATED_IN', 'PROVIDED_BY', 'EXHIBITS',
    'CORROBORATES', 'CONTRADICTS', 'DEPENDS_ON', 'ASSESSED_FOR',
    'PERFORMED', 'TARGETED', 'USED', 'CUSTOM'
  ]

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      {showFilters && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search relationships..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="weight">Strength</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={toggleSortOrder}>
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            {onCreateNew && (
              <Button onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Relationship
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {relationshipTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterConfidence} onValueChange={(v: any) => setFilterConfidence(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PROBABLE">Probable</SelectItem>
                <SelectItem value="POSSIBLE">Possible</SelectItem>
                <SelectItem value="SUSPECTED">Suspected</SelectItem>
              </SelectContent>
            </Select>

            {showValidation && (
              <Select value={filterValidation} onValueChange={(v: any) => setFilterValidation(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Validation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="VALIDATED">Validated</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {/* Relationship count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {sortedRelationships.length} relationship{sortedRelationships.length !== 1 ? 's' : ''}
        {(filterType !== 'all' || filterConfidence !== 'all' || filterValidation !== 'all' || searchQuery) && ' (filtered)'}
      </div>

      {/* Relationships list */}
      {sortedRelationships.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 mb-4">No relationships found</p>
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Relationship
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRelationships.map((relationship) => (
            <RelationshipCard
              key={relationship.id}
              relationship={relationship}
              sourceEntityName={entityNames[relationship.source_entity_id]}
              targetEntityName={entityNames[relationship.target_entity_id]}
              onEdit={onEdit ? () => onEdit(relationship) : undefined}
              onDelete={onDelete ? () => onDelete(relationship) : undefined}
              onNavigateToSource={onNavigateToEntity ? () => onNavigateToEntity(relationship.source_entity_id, relationship.source_entity_type) : undefined}
              onNavigateToTarget={onNavigateToEntity ? () => onNavigateToEntity(relationship.target_entity_id, relationship.target_entity_type) : undefined}
              compact={compact}
              showValidation={showValidation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
