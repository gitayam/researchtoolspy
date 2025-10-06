import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Link2, Plus, ExternalLink, MoreVertical, BookOpen, Trash } from 'lucide-react'
import type { FrameworkItem } from '@/types/frameworks'
import { isQuestionAnswerItem } from '@/types/frameworks'
import { frameworkConfigs } from '@/config/framework-configs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EvidenceLinker, EvidenceBadge, EvidencePanel, EntityQuickCreate, type LinkedEvidence, type EvidenceEntityType } from '@/components/evidence'
import { CitationBadge, CitationPicker } from '@/components/citations'
import type { SavedCitation } from '@/types/citations'
import { AutoGenerateButton } from '@/components/network'
import { generateRelationshipsFromCOG, generateRelationshipsFromCauseway } from '@/utils/framework-relationships'
import { ExportButton } from '@/components/reports/ExportButton'
import { BehaviorTimeline, type TimelineEvent } from '@/components/frameworks/BehaviorTimeline'
import { BCWRecommendations } from '@/components/frameworks/BCWRecommendations'
import { LocationBadge } from '@/components/behavior/LocationBadge'
import type { CreateRelationshipRequest } from '@/types/entities'
import type { ComBDeficits, InterventionFunction } from '@/types/behavior-change-wheel'
import type { LocationContext } from '@/types/behavior'

interface FrameworkSection {
  key: string
  label: string
  color: string
  bgColor: string
  icon: string
}

interface GenericFrameworkData {
  id: string
  title: string
  description: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

interface GenericFrameworkViewProps {
  data: GenericFrameworkData
  sections: FrameworkSection[]
  frameworkTitle: string
  onEdit: () => void
  onDelete: () => void
  backPath: string
}

export function GenericFrameworkView({
  data,
  sections,
  frameworkTitle,
  onEdit,
  onDelete,
  backPath
}: GenericFrameworkViewProps) {
  const navigate = useNavigate()

  // Evidence linking state
  const [linkedEvidence, setLinkedEvidence] = useState<LinkedEvidence[]>([])
  const [showEvidenceLinker, setShowEvidenceLinker] = useState(false)
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [showEntityCreate, setShowEntityCreate] = useState(false)
  const [entityCreateTab, setEntityCreateTab] = useState<EvidenceEntityType>('data')

  // Citation management state
  const [showCitationPicker, setShowCitationPicker] = useState(false)
  const [selectedItemForCitation, setSelectedItemForCitation] = useState<{ section: string; itemId: string } | null>(null)

  // Relationship generation state
  const [generatedRelationships, setGeneratedRelationships] = useState<CreateRelationshipRequest[]>([])

  // Determine framework type for relationship generation
  const frameworkTypeForRelationships = frameworkTitle.toLowerCase().includes('cog') ? 'cog' :
                         frameworkTitle.toLowerCase().includes('causeway') ? 'causeway' : null

  // Determine framework type for export
  const frameworkType = frameworkTitle.toLowerCase().includes('cog') ? 'cog' :
                        frameworkTitle.toLowerCase().includes('pmesii') ? 'pmesii-pt' :
                        frameworkTitle.toLowerCase().includes('dotmlpf') ? 'dotmlpf' :
                        frameworkTitle.toLowerCase().includes('dime') ? 'dime' :
                        frameworkTitle.toLowerCase().includes('causeway') ? 'causeway' :
                        frameworkTitle.toLowerCase().includes('starbursting') ? 'starbursting' :
                        frameworkTitle.toLowerCase().includes('pest') ? 'pest' :
                        frameworkTitle.toLowerCase().includes('stakeholder') ? 'stakeholder' :
                        frameworkTitle.toLowerCase().includes('com-b') || frameworkTitle.toLowerCase().includes('comb') ? 'comb-analysis' :
                        frameworkTitle.toLowerCase().includes('behavior') ? 'behavior' :
                        'generic'

  // Get item type from config
  const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'

  // Load linked evidence on mount
  useEffect(() => {
    const loadLinkedEvidence = async () => {
      if (!data.id) return

      try {
        const response = await fetch(`/api/framework-evidence?framework_id=${data.id}`)
        if (response.ok) {
          const result = await response.json()
          // Transform API response to LinkedEvidence format
          const evidence: LinkedEvidence[] = (result.links || []).map((link: any) => ({
            entity_type: 'data', // Evidence items are 'data' type
            entity_id: link.evidence_id,
            entity_data: {
              id: link.evidence_id,
              title: link.title,
              description: link.description,
              who: link.who,
              what: link.what,
              when_occurred: link.when_occurred,
              where_location: link.where_location,
              evidence_type: link.evidence_type,
              evidence_level: link.evidence_level,
              priority: link.priority,
              status: link.status,
              tags: link.tags
            },
            linked_at: link.created_at
          }))
          setLinkedEvidence(evidence)
        }
      } catch (error) {
        console.error('Failed to load linked evidence:', error)
      }
    }

    loadLinkedEvidence()
  }, [data.id])

  // Generate relationships based on framework type and linked evidence
  useEffect(() => {
    if (!frameworkTypeForRelationships || linkedEvidence.length === 0) {
      setGeneratedRelationships([])
      return
    }

    // Generate relationships based on framework type
    const relationships: CreateRelationshipRequest[] = []

    if (frameworkTypeForRelationships === 'cog') {
      // COG framework: Extract dependencies from critical capabilities/requirements/vulnerabilities
      const cogElements: any[] = [
        ...(data.center_of_gravity || []).map((item: any) => ({ ...item, type: 'CRITICAL_FACTOR' })),
        ...(data.critical_capabilities || []).map((item: any) => ({ ...item, type: 'CAPABILITY' })),
        ...(data.critical_requirements || []).map((item: any) => ({ ...item, type: 'REQUIREMENT' })),
        ...(data.critical_vulnerabilities || []).map((item: any) => ({ ...item, type: 'VULNERABILITY' }))
      ]

      // TODO: Map COG items to entities and generate DEPENDS_ON relationships
      // This requires entity linking infrastructure
      console.log('COG elements for relationship generation:', cogElements)
    } else if (frameworkTypeForRelationships === 'causeway') {
      // Causeway framework: Extract actor-action-target relationships
      const causewayRows: any[] = [
        ...(data.putars || []),
        ...(data.proximate_targets || [])
      ]

      // TODO: Map Causeway rows to actor/event entities and generate TARGETED relationships
      // This requires entity linking infrastructure
      console.log('Causeway rows for relationship generation:', causewayRows)
    }

    setGeneratedRelationships(relationships)
  }, [linkedEvidence, frameworkTypeForRelationships, data])

  const handleLinkEvidence = async (selected: LinkedEvidence[]) => {
    if (!data.id) return

    try {
      // Extract evidence IDs from selected items
      const evidenceIds = selected.map(item => item.entity_id)

      const response = await fetch('/api/framework-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framework_id: data.id,
          evidence_ids: evidenceIds
        })
      })

      if (response.ok) {
        setLinkedEvidence([...linkedEvidence, ...selected])
        console.log('Evidence linked successfully')
      } else {
        const error = await response.json()
        console.error('Failed to link evidence:', error)
        alert('Failed to link evidence. Please try again.')
      }
    } catch (error) {
      console.error('Error linking evidence:', error)
      alert('An error occurred while linking evidence.')
    }
  }

  const handleUnlinkEvidence = async (entity_type: string, entity_id: string | number) => {
    if (!data.id) return

    try {
      const response = await fetch(
        `/api/framework-evidence?framework_id=${data.id}&evidence_id=${entity_id}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setLinkedEvidence(
          linkedEvidence.filter(e => !(e.entity_type === entity_type && e.entity_id === entity_id))
        )
        console.log('Evidence unlinked successfully')
      } else {
        const error = await response.json()
        console.error('Failed to unlink evidence:', error)
        alert('Failed to unlink evidence. Please try again.')
      }
    } catch (error) {
      console.error('Error unlinking evidence:', error)
      alert('An error occurred while unlinking evidence.')
    }
  }

  const handleEntityCreated = (entityType: EvidenceEntityType, entityData: any) => {
    // Auto-link the newly created entity
    const newLink: LinkedEvidence = {
      entity_type: entityType,
      entity_id: entityData.id,
      entity_data: entityData,
      linked_at: new Date().toISOString()
    }
    setLinkedEvidence([...linkedEvidence, newLink])
    setShowEvidencePanel(true) // Show panel to see the newly linked entity
  }

  const openEntityCreate = (type: EvidenceEntityType) => {
    setEntityCreateTab(type)
    setShowEntityCreate(true)
  }

  // Citation management handlers
  const handleAddCitation = (sectionKey: string, itemId: string) => {
    setSelectedItemForCitation({ section: sectionKey, itemId })
    setShowCitationPicker(true)
  }

  const handleSelectCitation = (citation: SavedCitation) => {
    if (!selectedItemForCitation) return

    // TODO: Update the Q&A item with citation info
    // This will require either:
    // 1. API call to update the framework data
    // 2. Local state management + save button
    // For now, we'll show an alert
    alert(`Citation "${citation.fields.title}" will be attached to this item. Implementation pending: need to update framework data persistence.`)

    setShowCitationPicker(false)
    setSelectedItemForCitation(null)
  }

  const handleRemoveCitation = (sectionKey: string, itemId: string) => {
    if (confirm('Remove citation from this item?')) {
      // TODO: Implement citation removal
      alert('Citation removal implementation pending: need to update framework data persistence.')
    }
  }

  const SectionView = ({
    section,
    items,
    sectionKey
  }: {
    section: FrameworkSection
    items: FrameworkItem[]
    sectionKey: string
  }) => (
    <Card className={`border-l-4 ${section.color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          {section.label}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No {section.label.toLowerCase()} identified
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`p-3 rounded-lg ${section.bgColor} text-sm`}
              >
                {itemType === 'qa' && isQuestionAnswerItem(item) ? (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          <span className="text-gray-600 dark:text-gray-400">{index + 1}.</span> Q: {item.question}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 ml-5">
                          A: {item.answer || <span className="italic text-gray-500 dark:text-gray-400">No answer provided</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.citationId && (
                          <CitationBadge
                            citationId={item.citationId}
                            sourceTitle={item.sourceTitle}
                            sourceDate={item.sourceDate}
                            sourceAuthor={item.sourceAuthor}
                            sourceUrl={item.sourceUrl}
                            size="sm"
                          />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!item.citationId ? (
                              <DropdownMenuItem onClick={() => handleAddCitation(sectionKey, item.id)}>
                                <BookOpen className="h-4 w-4 mr-2" />
                                Add Citation
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => handleAddCitation(sectionKey, item.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Change Citation
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRemoveCitation(sectionKey, item.id)}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Remove Citation
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {index + 1}.
                    </span>{' '}
                    {'text' in item ? item.text : (item as any).question || ''}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.title}
              </h1>
              <EvidenceBadge
                linkedEvidence={linkedEvidence}
                onClick={() => setShowEvidencePanel(!showEvidencePanel)}
                showBreakdown
                size="lg"
              />
              {/* Show location badge for behavior analyses */}
              {frameworkType === 'behavior' && data.location_context && (
                <LocationBadge locationContext={data.location_context as LocationContext} />
              )}
            </div>
            {data.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {data.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Entity
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEntityCreate('data')}>
                Create Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEntityCreate('actor')}>
                Create Actor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEntityCreate('source')}>
                Create Source
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEntityCreate('event')}>
                Create Event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setShowEvidenceLinker(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Link Evidence
          </Button>
          {frameworkTypeForRelationships && (
            <AutoGenerateButton
              relationships={generatedRelationships}
              source={frameworkTypeForRelationships === 'cog' ? 'COG' : 'CAUSEWAY'}
              onComplete={(created, failed) => {
                console.log(`Created ${created} relationships, ${failed} failed`)
                // TODO: Refresh network graph or show success message
              }}
              label="Generate Relationships"
              variant="outline"
              size="default"
              disabled={generatedRelationships.length === 0}
            />
          )}
          <ExportButton
            frameworkType={frameworkType}
            frameworkTitle={frameworkTitle}
            data={data}
            analysisId={data.id.toString()}
          />
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

      {/* Metadata */}
      {(data.created_at || data.updated_at || data.source_url) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                {data.created_at && (
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(data.created_at).toLocaleDateString()}
                  </div>
                )}
                {data.updated_at && (
                  <div>
                    <span className="font-medium">Last Updated:</span>{' '}
                    {new Date(data.updated_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              {data.source_url && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Source:</span>
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {data.source_url}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-${sections.length} gap-4 text-center`}>
            {sections.map(section => (
              <div key={section.key} className={`p-4 rounded-lg ${section.bgColor}`}>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {data[section.key]?.length || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {section.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stakeholder-Specific Engagement Recommendations */}
      {frameworkType === 'stakeholder' && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              Engagement Strategy Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-red-700 dark:text-red-400">🎯 Priority Actions (Key Players)</h4>
                <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Schedule regular 1-on-1 meetings ({data.high_power_high_interest?.length || 0} stakeholders)</li>
                  <li>• Involve in major decision points</li>
                  <li>• Build strong personal relationships</li>
                  <li>• Seek input on strategy and direction</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-orange-700 dark:text-orange-400">🤝 Maintain Satisfaction</h4>
                <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Send monthly progress updates ({data.high_power_low_interest?.length || 0} stakeholders)</li>
                  <li>• Address concerns proactively</li>
                  <li>• Keep satisfied but don't over-engage</li>
                  <li>• Monitor for changes in interest level</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400">📢 Communication Plan</h4>
                <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Regular newsletters/updates ({data.low_power_high_interest?.length || 0} stakeholders)</li>
                  <li>• Leverage as advocates and champions</li>
                  <li>• Consult on relevant issues</li>
                  <li>• Build grassroots support</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 dark:text-gray-400">👀 Monitor & Watch</h4>
                <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Periodic updates only ({data.low_power_low_interest?.length || 0} stakeholders)</li>
                  <li>• Minimal engagement effort</li>
                  <li>• Watch for status changes</li>
                  <li>• Include in broad communications</li>
                </ul>
              </div>
            </div>
            <div className="pt-4 border-t border-blue-300 dark:border-blue-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Total Stakeholders:</strong> {(data.high_power_high_interest?.length || 0) + (data.high_power_low_interest?.length || 0) + (data.low_power_high_interest?.length || 0) + (data.low_power_low_interest?.length || 0)}
                {' • '}
                <strong>High Priority:</strong> {(data.high_power_high_interest?.length || 0) + (data.high_power_low_interest?.length || 0)} stakeholders requiring active management
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Framework Sections */}
      <div className={`grid grid-cols-1 ${sections.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
        {sections.map(section => {
          // Special handling for behavior timeline in read-only mode
          if (frameworkType === 'behavior' && section.key === 'timeline') {
            const timelineEvents: TimelineEvent[] = (data[section.key] || []) as any[]
            return (
              <Card key={section.key}>
                <CardContent className="pt-6">
                  <BehaviorTimeline
                    events={timelineEvents}
                    onChange={() => {}} // Read-only, no changes allowed
                    readOnly={true}
                  />
                </CardContent>
              </Card>
            )
          }

          // Default section rendering
          return (
            <SectionView
              key={section.key}
              section={section}
              items={data[section.key] || []}
              sectionKey={section.key}
            />
          )
        })}
      </div>

      {/* BCW Recommendations (Behaviour Change Wheel) - Only for COM-B Analysis framework */}
      {frameworkType === 'comb-analysis' && data.com_b_deficits && (
        <BCWRecommendations
          deficits={data.com_b_deficits as ComBDeficits}
          selectedInterventions={(data.selected_interventions as InterventionFunction[]) || []}
          readOnly={true}
        />
      )}

      {/* COM-B Analyses (for Behavior framework) */}
      {frameworkType === 'behavior' && (
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  COM-B Analyses
                </CardTitle>
                <CardDescription className="mt-2">
                  Target-audience-specific assessments using the COM-B model (Capability, Opportunity, Motivation → Behavior)
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  const url = `/dashboard/analysis-frameworks/comb-analysis/create?behavior_id=${data.id}&behavior_title=${encodeURIComponent(frameworkTitle)}`
                  window.open(url, '_blank')
                }}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create COM-B Analysis
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create target-audience-specific COM-B analyses for this behavior. Each analysis evaluates one audience's
              Capability, Opportunity, and Motivation to perform this behavior and generates evidence-based intervention recommendations.
            </p>
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                COM-B analyses linked to this behavior will appear here once created.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Quick Create Modal */}
      <EntityQuickCreate
        open={showEntityCreate}
        onClose={() => setShowEntityCreate(false)}
        onEntityCreated={handleEntityCreated}
        defaultTab={entityCreateTab}
        frameworkContext={{
          frameworkType: frameworkTitle,
          frameworkId: data.id?.toString()
        }}
      />

      {/* Evidence Linker Modal */}
      <EvidenceLinker
        open={showEvidenceLinker}
        onClose={() => setShowEvidenceLinker(false)}
        onLink={handleLinkEvidence}
        alreadyLinked={linkedEvidence}
        title={`Link Evidence to ${frameworkTitle}`}
        description="Select evidence items to support this analysis"
      />

      {/* Evidence Panel */}
      {showEvidencePanel && (
        <div className="fixed right-0 top-0 h-screen w-96 z-50">
          <EvidencePanel
            linkedEvidence={linkedEvidence}
            onUnlink={handleUnlinkEvidence}
            onClose={() => setShowEvidencePanel(false)}
            title="Linked Evidence"
          />
        </div>
      )}

      {/* Citation Picker Modal */}
      <CitationPicker
        open={showCitationPicker}
        onClose={() => {
          setShowCitationPicker(false)
          setSelectedItemForCitation(null)
        }}
        onSelect={handleSelectCitation}
        onCreateNew={() => {
          // Navigate to citation generator tool
          window.open('/dashboard/tools/citations-generator', '_blank')
        }}
      />
    </div>
  )
}
