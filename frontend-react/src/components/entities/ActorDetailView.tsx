import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Users, Shield, TrendingUp, AlertTriangle, Link as LinkIcon, Calendar, FileText, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MOMAssessmentList } from './MOMAssessmentList'
import { MOMAssessmentModal } from './MOMAssessmentModal'
import { RelationshipList, RelationshipForm } from '@/components/network'
import type { Actor, MOMAssessment, POPVariation, Relationship, CreateRelationshipRequest, UpdateRelationshipRequest } from '@/types/entities'

interface ActorDetailViewProps {
  actor: Actor
  onEdit: () => void
  onDelete: () => void
}

export function ActorDetailView({ actor, onEdit, onDelete }: ActorDetailViewProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [momAssessments, setMomAssessments] = useState<MOMAssessment[]>([])
  const [loadingMom, setLoadingMom] = useState(false)
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loadingRelationships, setLoadingRelationships] = useState(false)
  const [entityNames, setEntityNames] = useState<Record<string, string>>({})
  const [isRelationshipFormOpen, setIsRelationshipFormOpen] = useState(false)
  const [editingRelationship, setEditingRelationship] = useState<Relationship | undefined>(undefined)
  const [isMomModalOpen, setIsMomModalOpen] = useState(false)
  const [editingMomAssessment, setEditingMomAssessment] = useState<MOMAssessment | undefined>(undefined)

  // Load MOM assessments for this actor
  useEffect(() => {
    const loadMomAssessments = async () => {
      setLoadingMom(true)
      try {
        const response = await fetch(`/api/mom-assessments?actor_id=${actor.id}`)
        if (response.ok) {
          const data = await response.json()
          setMomAssessments(data.assessments || [])
        }
      } catch (error) {
        console.error('Failed to load MOM assessments:', error)
      } finally {
        setLoadingMom(false)
      }
    }

    if (actor.id) {
      loadMomAssessments()
    }
  }, [actor.id])

  // Load relationships for this actor
  useEffect(() => {
    const loadRelationships = async () => {
      setLoadingRelationships(true)
      try {
        const response = await fetch(`/api/relationships?entity_id=${actor.id}&workspace_id=${actor.workspace_id}`)
        if (response.ok) {
          const data = await response.json()
          setRelationships(data.relationships || [])

          // Load entity names
          const uniqueEntityIds = new Set<string>()
          ;(data.relationships || []).forEach((rel: Relationship) => {
            if (rel.source_entity_id !== actor.id) uniqueEntityIds.add(rel.source_entity_id)
            if (rel.target_entity_id !== actor.id) uniqueEntityIds.add(rel.target_entity_id)
          })

          // TODO: Batch load entity names
          const names: Record<string, string> = {}
          for (const entityId of uniqueEntityIds) {
            // For now, just use truncated ID
            names[entityId] = entityId.substring(0, 8)
          }
          setEntityNames(names)
        }
      } catch (error) {
        console.error('Failed to load relationships:', error)
      } finally {
        setLoadingRelationships(false)
      }
    }

    if (actor.id) {
      loadRelationships()
    }
  }, [actor.id])

  const getActorTypeIcon = (type: string) => {
    const icons = {
      PERSON: '👤',
      ORGANIZATION: '🏢',
      UNIT: '⚔️',
      GOVERNMENT: '🏛️',
      GROUP: '👥',
      OTHER: '❓'
    }
    return icons[type as keyof typeof icons] || icons.OTHER
  }

  const getActorTypeBadge = (type: string) => {
    const colors = {
      PERSON: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ORGANIZATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      UNIT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      GOVERNMENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      GROUP: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    }
    return colors[type as keyof typeof colors] || colors.OTHER
  }

  const calculateDeceptionRisk = () => {
    if (!actor.deception_profile || !actor.deception_profile.mom) {
      return { level: 'unknown', score: 0, color: 'gray' }
    }

    const { motive, opportunity, means } = actor.deception_profile.mom
    const avgScore = ((motive || 0) + (opportunity || 0) + (means || 0)) / 3
    const percentage = (avgScore / 5) * 100

    if (avgScore >= 4) return { level: 'Critical', score: percentage, color: 'red' }
    if (avgScore >= 3) return { level: 'High', score: percentage, color: 'orange' }
    if (avgScore >= 1.5) return { level: 'Medium', score: percentage, color: 'yellow' }
    return { level: 'Low', score: percentage, color: 'green' }
  }

  const risk = calculateDeceptionRisk()

  const getRiskColorClasses = (color: string) => {
    const colors = {
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const getProgressColor = (color: string) => {
    const colors = {
      red: 'bg-red-600',
      orange: 'bg-orange-600',
      yellow: 'bg-yellow-600',
      green: 'bg-green-600',
      gray: 'bg-gray-600'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/entities/actors')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Actors
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{getActorTypeIcon(actor.type)}</span>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{actor.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getActorTypeBadge(actor.type)}>{actor.type}</Badge>
                  {risk.level !== 'unknown' && (
                    <Badge className={getRiskColorClasses(risk.color)}>
                      {risk.level} Deception Risk
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {actor.aliases && actor.aliases.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Also known as:</strong> {actor.aliases.join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deception">Deception Profile</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Information */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {actor.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.description}</p>
                  </div>
                )}

                {actor.affiliation && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Affiliation</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.affiliation}</p>
                  </div>
                )}

                {actor.role && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.role}</p>
                  </div>
                )}

                {actor.category && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.category}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Linked Events</span>
                  <Badge variant="secondary">{(actor as any)._event_count || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Evidence Items</span>
                  <Badge variant="secondary">{(actor as any)._evidence_count || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Relationships</span>
                  <Badge variant="secondary">{(actor as any)._relationship_count || 0}</Badge>
                </div>
                <Separator />
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Created: {new Date(actor.created_at).toLocaleDateString()}</div>
                  <div>Updated: {new Date(actor.updated_at).toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deception Profile Tab */}
        <TabsContent value="deception" className="space-y-6">
          {/* Primary POP Assessment */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Primary POP Assessment
                  </CardTitle>
                  <CardDescription>General behavioral deception patterns</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {actor.primary_pop ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Historical Pattern</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{actor.primary_pop.historical_pattern}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={(actor.primary_pop.historical_pattern / 5) * 100} className="h-2 mt-2" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sophistication</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{actor.primary_pop.sophistication_level}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={(actor.primary_pop.sophistication_level / 5) * 100} className="h-2 mt-2" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Success Rate</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{actor.primary_pop.success_rate}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={(actor.primary_pop.success_rate / 5) * 100} className="h-2 mt-2" />
                    </div>
                  </div>
                  {actor.primary_pop.notes && (
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                      <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {actor.primary_pop.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No primary POP assessment available. Click edit to add one.
                </div>
              )}
            </CardContent>
          </Card>

          {/* POP Variations */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Topic-Based POP Variations
                  </CardTitle>
                  <CardDescription>Domain-specific behavioral patterns</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {actor.pop_variations && actor.pop_variations.length > 0 ? (
                <div className="space-y-4">
                  {actor.pop_variations.map((variation, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-600">
                      <CardHeader>
                        <CardTitle className="text-base">{variation.topic}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500 mb-1">Historical Pattern</div>
                            <div className="font-semibold">{variation.assessment.historical_pattern}/5</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Sophistication</div>
                            <div className="font-semibold">{variation.assessment.sophistication_level}/5</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Success Rate</div>
                            <div className="font-semibold">{variation.assessment.success_rate}/5</div>
                          </div>
                        </div>
                        {variation.assessment.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t">
                            {variation.assessment.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No topic-based variations. Add variations to track patterns across different domains.
                </div>
              )}
            </CardContent>
          </Card>

          {/* MOM Assessments */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    MOM Assessments
                  </CardTitle>
                  <CardDescription>Scenario-specific motive, opportunity, and means assessments</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMom ? (
                <div className="text-center py-8 text-gray-500">Loading MOM assessments...</div>
              ) : (
                <MOMAssessmentList
                  assessments={momAssessments}
                  compact={true}
                  showFilters={momAssessments.length > 3}
                  onCreateNew={() => {
                    // TODO: Open MOM assessment creation modal
                    console.log('Create new MOM assessment')
                  }}
                  onEdit={(assessment) => {
                    // TODO: Open MOM assessment edit modal
                    console.log('Edit MOM assessment:', assessment.id)
                  }}
                  onDelete={async (assessment) => {
                    if (!confirm(`Delete MOM assessment "${assessment.scenario_description}"?`)) return
                    try {
                      await fetch(`/api/mom-assessments/${assessment.id}`, { method: 'DELETE' })
                      setMomAssessments(prev => prev.filter(a => a.id !== assessment.id))
                    } catch (error) {
                      console.error('Failed to delete MOM assessment:', error)
                      alert('Failed to delete MOM assessment')
                    }
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Legacy Deception Profile (Backward Compatibility) */}
          {actor.deception_profile && (
            <Card className="border-yellow-300 dark:border-yellow-700 border-2">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Legacy Deception Profile (Deprecated)
                </CardTitle>
                <CardDescription className="text-xs">
                  This data is from the old structure. Please migrate to the new MOM/POP system.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="space-y-2">
                  <div>MOM: Motive {actor.deception_profile.mom?.motive}/5, Opportunity {actor.deception_profile.mom?.opportunity}/5, Means {actor.deception_profile.mom?.means}/5</div>
                  <div>POP: Pattern {actor.deception_profile.pop?.historical_pattern}/5, Sophistication {actor.deception_profile.pop?.sophistication_level}/5, Success {actor.deception_profile.pop?.success_rate}/5</div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Relationships Tab */}
        <TabsContent value="relationships" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Entity Relationships
                  </CardTitle>
                  <CardDescription>
                    Connections to other actors, events, sources, places, and evidence
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRelationships ? (
                <div className="text-center py-12 text-gray-500">
                  Loading relationships...
                </div>
              ) : (
                <RelationshipList
                  relationships={relationships}
                  entityNames={entityNames}
                  compact={false}
                  showFilters={relationships.length > 3}
                  onCreateNew={() => {
                    setEditingRelationship(undefined)
                    setIsRelationshipFormOpen(true)
                  }}
                  onEdit={(relationship) => {
                    setEditingRelationship(relationship)
                    setIsRelationshipFormOpen(true)
                  }}
                  onDelete={async (relationship) => {
                    if (!confirm(`Delete relationship to ${entityNames[relationship.target_entity_id] || relationship.target_entity_id}?`)) return
                    try {
                      await fetch(`/api/relationships/${relationship.id}`, { method: 'DELETE' })
                      setRelationships(prev => prev.filter(r => r.id !== relationship.id))
                    } catch (error) {
                      console.error('Failed to delete relationship:', error)
                      alert('Failed to delete relationship')
                    }
                  }}
                  onNavigateToEntity={(entityId, entityType) => {
                    const paths: Record<string, string> = {
                      ACTOR: `/dashboard/entities/actors/${entityId}`,
                      SOURCE: `/dashboard/entities/sources/${entityId}`,
                      EVENT: `/dashboard/entities/events/${entityId}`,
                      PLACE: `/dashboard/entities/places/${entityId}`,
                      BEHAVIOR: `/dashboard/entities/behaviors/${entityId}`,
                      EVIDENCE: `/dashboard/evidence/${entityId}`
                    }
                    navigate(paths[entityType] || '/dashboard')
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relationship Form Dialog */}
        <Dialog open={isRelationshipFormOpen} onOpenChange={setIsRelationshipFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRelationship ? 'Edit Relationship' : 'Create New Relationship'}
              </DialogTitle>
            </DialogHeader>
            <RelationshipForm
              relationship={editingRelationship}
              sourceEntityId={editingRelationship ? undefined : actor.id}
              sourceEntityType={editingRelationship ? undefined : 'ACTOR'}
              workspaceId={actor.workspace_id}
              onSubmit={async (data) => {
                try {
                  if (editingRelationship) {
                    const response = await fetch(`/api/relationships/${editingRelationship.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data)
                    })
                    if (response.ok) {
                      const updated = await response.json()
                      setRelationships(prev => prev.map(r => r.id === editingRelationship.id ? updated.relationship : r))
                      setIsRelationshipFormOpen(false)
                    }
                  } else {
                    const response = await fetch('/api/relationships', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data)
                    })
                    if (response.ok) {
                      const created = await response.json()
                      setRelationships(prev => [...prev, created.relationship])
                      setIsRelationshipFormOpen(false)
                    }
                  }
                } catch (error) {
                  throw new Error('Failed to save relationship')
                }
              }}
              onCancel={() => setIsRelationshipFormOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Activity timeline coming soon</p>
              <p className="text-sm text-gray-400 mt-2">
                Chronological view of events, evidence updates, and relationship changes
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
