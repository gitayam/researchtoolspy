import { Edit, Trash2, ArrowRight, Calendar, Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Relationship, EntityType, RelationshipType } from '@/types/entities'

interface RelationshipCardProps {
  relationship: Relationship
  sourceEntityName?: string
  targetEntityName?: string
  onEdit?: () => void
  onDelete?: () => void
  onNavigateToSource?: () => void
  onNavigateToTarget?: () => void
  compact?: boolean
  showValidation?: boolean
}

export function RelationshipCard({
  relationship,
  sourceEntityName,
  targetEntityName,
  onEdit,
  onDelete,
  onNavigateToSource,
  onNavigateToTarget,
  compact = false,
  showValidation = true
}: RelationshipCardProps) {

  const getEntityTypeIcon = (type: EntityType) => {
    const icons = {
      ACTOR: '👤',
      SOURCE: '📚',
      EVIDENCE: '📄',
      EVENT: '📅',
      PLACE: '📍',
      BEHAVIOR: '🎯'
    }
    return icons[type] || '❓'
  }

  const getEntityTypeBadge = (type: EntityType) => {
    const colors = {
      ACTOR: 'bg-blue-100 text-blue-800',
      SOURCE: 'bg-purple-100 text-purple-800',
      EVIDENCE: 'bg-green-100 text-green-800',
      EVENT: 'bg-orange-100 text-orange-800',
      PLACE: 'bg-pink-100 text-pink-800',
      BEHAVIOR: 'bg-yellow-100 text-yellow-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getRelationshipLabel = (type: RelationshipType) => {
    const labels: Record<RelationshipType, string> = {
      CONTROLS: 'Controls',
      REPORTS_TO: 'Reports To',
      ALLIED_WITH: 'Allied With',
      ADVERSARY_OF: 'Adversary Of',
      MEMBER_OF: 'Member Of',
      LOCATED_AT: 'Located At',
      PARTICIPATED_IN: 'Participated In',
      PROVIDED_BY: 'Provided By',
      EXHIBITS: 'Exhibits',
      CORROBORATES: 'Corroborates',
      CONTRADICTS: 'Contradicts',
      DEPENDS_ON: 'Depends On',
      ASSESSED_FOR: 'Assessed For',
      PERFORMED: 'Performed',
      TARGETED: 'Targeted',
      USED: 'Used',
      CUSTOM: 'Custom'
    }
    return labels[type] || type
  }

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null

    const colors = {
      CONFIRMED: 'bg-green-100 text-green-800',
      PROBABLE: 'bg-blue-100 text-blue-800',
      POSSIBLE: 'bg-yellow-100 text-yellow-800',
      SUSPECTED: 'bg-orange-100 text-orange-800'
    }

    return (
      <Badge className={colors[confidence as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {confidence}
      </Badge>
    )
  }

  const getValidationBadge = () => {
    if (!showValidation) return null

    const badges = {
      VALIDATED: <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Validated</Badge>,
      PENDING: <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>,
      REJECTED: <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Rejected</Badge>
    }

    return badges[relationship.validation_status]
  }

  const getGenerationSourceBadge = () => {
    if (!relationship.auto_generated) return null

    const labels = {
      MANUAL: 'Manual',
      MOM_ASSESSMENT: 'MOM',
      COG_ANALYSIS: 'COG',
      CAUSEWAY_ANALYSIS: 'Causeway',
      FRAMEWORK_INFERENCE: 'Inferred'
    }

    return (
      <Badge variant="outline" className="text-xs">
        Auto: {labels[relationship.generation_source]}
      </Badge>
    )
  }

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getEntityTypeIcon(relationship.source_entity_type)}</span>
                <button
                  onClick={onNavigateToSource}
                  className="text-sm font-medium hover:underline"
                >
                  {sourceEntityName || relationship.source_entity_id.substring(0, 8)}
                </button>
              </div>

              <ArrowRight className="h-4 w-4 text-gray-400" />

              <Badge variant="secondary" className="text-xs">
                {getRelationshipLabel(relationship.relationship_type)}
              </Badge>

              <ArrowRight className="h-4 w-4 text-gray-400" />

              <div className="flex items-center gap-2">
                <span className="text-xl">{getEntityTypeIcon(relationship.target_entity_type)}</span>
                <button
                  onClick={onNavigateToTarget}
                  className="text-sm font-medium hover:underline"
                >
                  {targetEntityName || relationship.target_entity_id.substring(0, 8)}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getConfidenceBadge(relationship.confidence)}
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            {/* Source → Relationship → Target */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{getEntityTypeIcon(relationship.source_entity_type)}</span>
                <div>
                  <Badge className={getEntityTypeBadge(relationship.source_entity_type)}>
                    {relationship.source_entity_type}
                  </Badge>
                  <button
                    onClick={onNavigateToSource}
                    className="block text-lg font-semibold hover:underline mt-1"
                  >
                    {sourceEntityName || relationship.source_entity_id.substring(0, 8)}
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="h-6 w-6 text-gray-400" />
                <Badge variant="secondary" className="mt-1">
                  {getRelationshipLabel(relationship.relationship_type)}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-3xl">{getEntityTypeIcon(relationship.target_entity_type)}</span>
                <div>
                  <Badge className={getEntityTypeBadge(relationship.target_entity_type)}>
                    {relationship.target_entity_type}
                  </Badge>
                  <button
                    onClick={onNavigateToTarget}
                    className="block text-lg font-semibold hover:underline mt-1"
                  >
                    {targetEntityName || relationship.target_entity_id.substring(0, 8)}
                  </button>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {getConfidenceBadge(relationship.confidence)}
              {getValidationBadge()}
              {getGenerationSourceBadge()}
              {relationship.conflicts_with && relationship.conflicts_with.length > 0 && (
                <Badge className="bg-red-100 text-red-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Conflicts ({relationship.conflicts_with.length})
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Relationship Strength */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Relationship Strength</span>
            <span className="text-sm text-gray-600">{(relationship.weight * 100).toFixed(0)}%</span>
          </div>
          <Progress value={relationship.weight * 100} className="h-2" />
        </div>

        {/* Description */}
        {relationship.description && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Description</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{relationship.description}</p>
          </div>
        )}

        {/* Temporal Info */}
        {(relationship.start_date || relationship.end_date) && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            {relationship.start_date && (
              <span>From: {new Date(relationship.start_date).toLocaleDateString()}</span>
            )}
            {relationship.end_date && (
              <span>To: {new Date(relationship.end_date).toLocaleDateString()}</span>
            )}
          </div>
        )}

        {/* Conflicts */}
        {relationship.conflicts_with && relationship.conflicts_with.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-3 rounded">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-900">Conflicts Detected</h4>
                {relationship.conflict_reason && (
                  <p className="text-sm text-red-800 mt-1">{relationship.conflict_reason}</p>
                )}
                <p className="text-xs text-red-700 mt-1">
                  {relationship.conflicts_with.length} conflicting relationship(s)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-3 border-t text-xs text-gray-500 flex items-center justify-between">
          <span>Created: {new Date(relationship.created_at).toLocaleDateString()}</span>
          {relationship.validated_at && (
            <span>Validated: {new Date(relationship.validated_at).toLocaleDateString()}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
