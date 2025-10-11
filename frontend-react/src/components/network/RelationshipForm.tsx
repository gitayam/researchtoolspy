import { useState, useEffect } from 'react'
import { Save, X, Search, ArrowRight, Calendar as CalendarIcon, Sparkles, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type {
  Relationship,
  CreateRelationshipRequest,
  UpdateRelationshipRequest,
  EntityType,
  RelationshipType,
  RelationshipConfidence
} from '@/types/entities'

interface RelationshipFormProps {
  relationship?: Relationship
  sourceEntityId?: string
  sourceEntityType?: EntityType
  workspaceId: string
  onSubmit: (data: CreateRelationshipRequest | UpdateRelationshipRequest) => Promise<void>
  onCancel: () => void
}

interface EntityOption {
  id: string
  type: EntityType
  name: string
}

export function RelationshipForm({
  relationship,
  sourceEntityId,
  sourceEntityType,
  workspaceId,
  onSubmit,
  onCancel
}: RelationshipFormProps) {
  const isEditing = !!relationship

  const [formData, setFormData] = useState({
    source_entity_id: relationship?.source_entity_id || sourceEntityId || '',
    source_entity_type: relationship?.source_entity_type || sourceEntityType || 'ACTOR' as EntityType,
    target_entity_id: relationship?.target_entity_id || '',
    target_entity_type: relationship?.target_entity_type || 'ACTOR' as EntityType,
    relationship_type: relationship?.relationship_type || 'CUSTOM' as RelationshipType,
    description: relationship?.description || '',
    weight: relationship?.weight || 0.5,
    confidence: relationship?.confidence || 'POSSIBLE' as RelationshipConfidence,
    start_date: relationship?.start_date || '',
    end_date: relationship?.end_date || ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entitySearch, setEntitySearch] = useState({ source: '', target: '' })
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [searchingEntities, setSearchingEntities] = useState(false)

  // GPT Inference State
  const [inferenceLoading, setInferenceLoading] = useState(false)
  const [inferenceResult, setInferenceResult] = useState<{
    inferred_type: string
    confidence: string
    explanation: string
  } | null>(null)

  // Entity type options
  const entityTypes: EntityType[] = ['ACTOR', 'SOURCE', 'EVIDENCE', 'EVENT', 'PLACE', 'BEHAVIOR']

  // Relationship type options with descriptions
  const relationshipTypes: Array<{ value: RelationshipType; label: string; description: string }> = [
    { value: 'CONTROLS', label: 'Controls', description: 'Has authority or control over' },
    { value: 'REPORTS_TO', label: 'Reports To', description: 'Reports to or is subordinate to' },
    { value: 'ALLIED_WITH', label: 'Allied With', description: 'Cooperative or allied relationship' },
    { value: 'ADVERSARY_OF', label: 'Adversary Of', description: 'Opposing or hostile relationship' },
    { value: 'MEMBER_OF', label: 'Member Of', description: 'Member or part of' },
    { value: 'LOCATED_AT', label: 'Located At', description: 'Physically located at' },
    { value: 'PARTICIPATED_IN', label: 'Participated In', description: 'Took part in or attended' },
    { value: 'PROVIDED_BY', label: 'Provided By', description: 'Information or resource provided by' },
    { value: 'EXHIBITS', label: 'Exhibits', description: 'Demonstrates or shows behavior' },
    { value: 'CORROBORATES', label: 'Corroborates', description: 'Supports or confirms' },
    { value: 'CONTRADICTS', label: 'Contradicts', description: 'Conflicts with or refutes' },
    { value: 'DEPENDS_ON', label: 'Depends On', description: 'Requires or relies on' },
    { value: 'ASSESSED_FOR', label: 'Assessed For', description: 'MOM assessment relationship' },
    { value: 'PERFORMED', label: 'Performed', description: 'Executed or carried out action' },
    { value: 'TARGETED', label: 'Targeted', description: 'Directed action toward' },
    { value: 'USED', label: 'Used', description: 'Utilized or employed' },
    { value: 'CUSTOM', label: 'Custom', description: 'Custom relationship (describe below)' }
  ]

  // Confidence options
  const confidenceOptions: Array<{ value: RelationshipConfidence; label: string; color: string }> = [
    { value: 'CONFIRMED', label: 'Confirmed', color: 'bg-green-100 text-green-800' },
    { value: 'PROBABLE', label: 'Probable', color: 'bg-blue-100 text-blue-800' },
    { value: 'POSSIBLE', label: 'Possible', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'SUSPECTED', label: 'Suspected', color: 'bg-orange-100 text-orange-800' }
  ]

  // Search entities
  const searchEntities = async (query: string, entityType: EntityType) => {
    if (!query || query.length < 2) return []

    setSearchingEntities(true)
    try {
      const endpoint = getEntityEndpoint(entityType)
      const response = await fetch(`${endpoint}?search=${encodeURIComponent(query)}&workspace_id=${workspaceId}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        const key = getEntityArrayKey(entityType)
        return (data[key] || []).map((entity: any) => ({
          id: entity.id,
          type: entityType,
          name: entity.name || entity.title
        }))
      }
    } catch (error) {
      console.error('Entity search failed:', error)
    } finally {
      setSearchingEntities(false)
    }
    return []
  }

  const getEntityEndpoint = (type: EntityType): string => {
    const endpoints: Record<EntityType, string> = {
      ACTOR: '/api/actors',
      SOURCE: '/api/sources',
      EVENT: '/api/events',
      PLACE: '/api/places',
      BEHAVIOR: '/api/behaviors',
      EVIDENCE: '/api/evidence'
    }
    return endpoints[type]
  }

  const getEntityArrayKey = (type: EntityType): string => {
    const keys: Record<EntityType, string> = {
      ACTOR: 'actors',
      SOURCE: 'sources',
      EVENT: 'events',
      PLACE: 'places',
      BEHAVIOR: 'behaviors',
      EVIDENCE: 'evidence'
    }
    return keys[type]
  }

  // GPT Inference Function
  const inferRelationshipType = async () => {
    if (!formData.source_entity_id || !formData.target_entity_id) {
      setError('Please select both source and target entities first')
      return
    }

    setInferenceLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/relationships/infer-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_entity_id: formData.source_entity_id,
          source_entity_type: formData.source_entity_type,
          target_entity_id: formData.target_entity_id,
          target_entity_type: formData.target_entity_type,
          context: formData.description || undefined,
          evidence_text: undefined // Could be populated if we have evidence context
        })
      })

      if (response.ok) {
        const data = await response.json()
        setInferenceResult({
          inferred_type: data.inferred_type,
          confidence: data.confidence,
          explanation: data.explanation
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to infer relationship type')
      }
    } catch (error) {
      console.error('Inference error:', error)
      setError('Failed to infer relationship type. Please try again.')
    } finally {
      setInferenceLoading(false)
    }
  }

  const applyInferredType = () => {
    if (inferenceResult) {
      setFormData({ ...formData, relationship_type: inferenceResult.inferred_type as RelationshipType })
      setInferenceResult(null)
    }
  }

  useEffect(() => {
    const loadOptions = async () => {
      const sourceResults = await searchEntities(entitySearch.source, formData.source_entity_type)
      const targetResults = await searchEntities(entitySearch.target, formData.target_entity_type)
      setEntityOptions([...sourceResults, ...targetResults])
    }

    if (entitySearch.source || entitySearch.target) {
      loadOptions()
    }
  }, [entitySearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isEditing) {
        const updateData: UpdateRelationshipRequest = {
          relationship_type: formData.relationship_type,
          description: formData.description,
          weight: formData.weight,
          confidence: formData.confidence,
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined
        }
        await onSubmit(updateData)
      } else {
        const createData: CreateRelationshipRequest = {
          source_entity_id: formData.source_entity_id,
          source_entity_type: formData.source_entity_type,
          target_entity_id: formData.target_entity_id,
          target_entity_type: formData.target_entity_type,
          relationship_type: formData.relationship_type,
          description: formData.description,
          weight: formData.weight,
          confidence: formData.confidence,
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined,
          workspace_id: workspaceId
        }
        await onSubmit(createData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save relationship')
    } finally {
      setLoading(false)
    }
  }

  const selectedRelationType = relationshipTypes.find(rt => rt.value === formData.relationship_type)

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Relationship' : 'Create Relationship'}</CardTitle>
          <CardDescription>
            Define a relationship between two entities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Entity Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Source Entity */}
            <div className="space-y-2">
              <Label>Source Entity *</Label>
              <Select
                value={formData.source_entity_type}
                onValueChange={(value: EntityType) => setFormData({ ...formData, source_entity_type: value })}
                disabled={isEditing || !!sourceEntityType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search source entity..."
                value={entitySearch.source}
                onChange={(e) => setEntitySearch({ ...entitySearch, source: e.target.value })}
                disabled={isEditing || !!sourceEntityId}
              />
              {formData.source_entity_id && (
                <Badge variant="secondary">ID: {formData.source_entity_id.substring(0, 8)}...</Badge>
              )}
            </div>

            {/* Arrow */}
            <div className="text-center">
              <ArrowRight className="h-6 w-6 mx-auto text-gray-400" />
            </div>

            {/* Target Entity */}
            <div className="space-y-2">
              <Label>Target Entity *</Label>
              <Select
                value={formData.target_entity_type}
                onValueChange={(value: EntityType) => setFormData({ ...formData, target_entity_type: value })}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search target entity..."
                value={entitySearch.target}
                onChange={(e) => setEntitySearch({ ...entitySearch, target: e.target.value })}
                disabled={isEditing}
              />
              {formData.target_entity_id && (
                <Badge variant="secondary">ID: {formData.target_entity_id.substring(0, 8)}...</Badge>
              )}
            </div>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label htmlFor="relationship_type">Relationship Type *</Label>
            <Select
              value={formData.relationship_type}
              onValueChange={(value: RelationshipType) => setFormData({ ...formData, relationship_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {relationshipTypes.map(rt => (
                  <SelectItem key={rt.value} value={rt.value}>
                    <div>
                      <div className="font-semibold">{rt.label}</div>
                      <div className="text-xs text-gray-500">{rt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRelationType && (
              <p className="text-xs text-gray-500">{selectedRelationType.description}</p>
            )}
          </div>

          {/* GPT Inference Section */}
          {!isEditing && (
            <div className="space-y-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">AI-Powered Type Suggestion</h4>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={inferRelationshipType}
                  disabled={inferenceLoading || !formData.source_entity_id || !formData.target_entity_id}
                >
                  {inferenceLoading ? 'Analyzing...' : 'Suggest Type'}
                </Button>
              </div>

              {inferenceResult && (
                <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-purple-300 dark:border-purple-700 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="default" className="bg-purple-600">
                          {inferenceResult.inferred_type.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className={
                          inferenceResult.confidence === 'HIGH' ? 'border-green-500 text-green-700' :
                          inferenceResult.confidence === 'MEDIUM' ? 'border-yellow-500 text-yellow-700' :
                          'border-gray-500 text-gray-700'
                        }>
                          {inferenceResult.confidence} Confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        {inferenceResult.explanation}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={applyInferredType}
                      className="ml-3 bg-purple-600 hover:bg-purple-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Use This
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-600 dark:text-gray-400">
                GPT will analyze the selected entities and suggest the most appropriate relationship type based on their context.
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this relationship in detail..."
              rows={3}
            />
          </div>

          {/* Weight Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Relationship Strength</Label>
              <span className="text-sm font-semibold">{(formData.weight * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[formData.weight * 100]}
              onValueChange={([value]) => setFormData({ ...formData, weight: value / 100 })}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              How strong or significant is this relationship? (0% = weak, 100% = very strong)
            </p>
          </div>

          {/* Confidence */}
          <div className="space-y-2">
            <Label>Confidence Level</Label>
            <div className="grid grid-cols-4 gap-2">
              {confidenceOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, confidence: option.value })}
                  className={`p-2 rounded text-sm font-medium transition-all ${
                    formData.confidence === option.value
                      ? option.color + ' border-2 border-gray-900'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Temporal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date (Optional)</Label>
              <Input
                type="date"
                id="start_date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date (Optional)</Label>
              <Input
                type="date"
                id="end_date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.source_entity_id || !formData.target_entity_id}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : isEditing ? 'Update Relationship' : 'Create Relationship'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
