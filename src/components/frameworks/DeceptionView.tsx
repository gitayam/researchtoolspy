/**
 * Deception Detection View
 * Display completed deception analysis with visual dashboard
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Edit, Trash2, Download, Share2, Sparkles, FileText, File, Link2, Plus, UserCircle, Check, AlertCircle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DeceptionDashboard } from './DeceptionDashboard'
import { DeceptionPredictions } from './DeceptionPredictions'
import type { DeceptionAssessment, DeceptionScores } from '@/lib/deception-scoring'
import { calculateDeceptionLikelihood } from '@/lib/deception-scoring'
import type { AIDeceptionAnalysis } from '@/lib/ai-deception-analysis'
import { generatePDFReport, generateDOCXReport, generateExecutiveBriefing, type ReportOptions } from '@/lib/deception-report-generator'
import { EvidenceLinker, EvidenceBadge, EvidencePanel, EntityQuickCreate, type LinkedEvidence, type EvidenceEntityType } from '@/components/evidence'
import { AutoGenerateButton } from '@/components/network'
import { generateRelationshipsFromMOM, deduplicateRelationships } from '@/utils/framework-relationships'
import { CommentThread } from '@/components/comments/CommentThread'
import { ShareButton } from './ShareButton'
import type { CreateRelationshipRequest } from '@/types/entities'

interface DeceptionViewProps {
  data: {
    id: string
    title: string
    description?: string
    scenario: string
    mom?: string
    pop?: string
    moses?: string
    eve?: string
    assessment?: string
    scores?: Partial<DeceptionScores>
    aiAnalysis?: AIDeceptionAnalysis
    calculatedAssessment?: DeceptionAssessment
    created_at: string
    updated_at: string
    is_public?: boolean
    share_token?: string
  }
  onEdit: () => void
  onDelete: () => void
  backPath?: string
}

export function DeceptionView({
  data,
  onEdit,
  onDelete,
  backPath = '/dashboard/analysis-frameworks/deception'
}: DeceptionViewProps) {
  const { t } = useTranslation('deception')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | 'briefing'>('pdf')
  // Classification is always UNCLASSIFIED - this is a commercial application
  const classification = 'UNCLASSIFIED' as const
  const [organizationName, setOrganizationName] = useState('Intelligence Analysis Unit')
  const [analystName, setAnalystName] = useState('AI-Assisted Analysis')
  const [exporting, setExporting] = useState(false)

  // Evidence linking state
  const [linkedEvidence, setLinkedEvidence] = useState<LinkedEvidence[]>([])
  const [showEvidenceLinker, setShowEvidenceLinker] = useState(false)
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [showEntityCreate, setShowEntityCreate] = useState(false)
  const [entityCreateTab, setEntityCreateTab] = useState<EvidenceEntityType>('data')

  // Relationship generation state
  const [generatedRelationships, setGeneratedRelationships] = useState<CreateRelationshipRequest[]>([])

  // Save to actor state
  const [savingToActor, setSavingToActor] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Historical data for trends and predictions
  const [historicalData, setHistoricalData] = useState<Array<{
    id: string
    title: string
    timestamp: string
    likelihood: number
    scores: any
  }>>([])

  // Calculate assessment on-the-fly if missing (for backward compatibility with old analyses)
  const calculatedAssessment = data.calculatedAssessment ||
    (data.scores && Object.keys(data.scores).length > 0
      ? calculateDeceptionLikelihood(data.scores)
      : null)

  // Memoize historical data transformations to prevent infinite loops
  // Creating new arrays in render causes useEffect in child components to re-run
  const historicalDataForPredictions = useMemo(() =>
    historicalData.map(h => ({
      timestamp: h.timestamp,
      likelihood: h.likelihood,
      scores: h.scores as DeceptionScores
    })),
    [historicalData]
  )

  const historicalDataForDashboard = useMemo(() =>
    historicalData.map(h => ({
      timestamp: h.timestamp,
      likelihood: h.likelihood
    })),
    [historicalData]
  )

  // Memoize scenario object to prevent new object reference on every render
  const scenarioForPredictions = useMemo(() => ({
    scenario: data.scenario,
    mom: data.mom,
    pop: data.pop,
    moses: data.moses,
    eve: data.eve
  }), [data.scenario, data.mom, data.pop, data.moses, data.eve])

  // Generate relationships from linked evidence when actors/events are linked
  useEffect(() => {
    const actors = linkedEvidence.filter(e => e.entity_type === 'actor')
    const events = linkedEvidence.filter(e => e.entity_type === 'event')
    const workspaceId = localStorage.getItem('current_workspace_id') || '1'

    // Generate relationships when we have both actors and events linked
    if (actors.length > 0 && events.length > 0 && calculatedAssessment && data.scores) {
      const newRelationships: CreateRelationshipRequest[] = []

      // For each actor-event pair, create relationship based on MOM scores
      for (const actor of actors) {
        for (const event of events) {
          const momAssessment = {
            id: data.id,
            actor_id: String(actor.entity_id),
            event_id: String(event.entity_id),
            scenario_description: data.scenario || data.title,
            motive_score: (data.scores.motive || 0) / 5, // Normalize 0-5 to 0-1
            opportunity_score: (data.scores.opportunity || 0) / 5,
            means_score: (data.scores.means || 0) / 5,
            overall_likelihood: calculatedAssessment.overallLikelihood / 100,
            created_at: data.created_at
          }

          const relationships = generateRelationshipsFromMOM(momAssessment, workspaceId)
          newRelationships.push(...relationships)
        }
      }

      setGeneratedRelationships(deduplicateRelationships(newRelationships))
    } else if (actors.length === 0 || events.length === 0) {
      // Clear relationships if actors or events are unlinked
      setGeneratedRelationships([])
    }
  }, [linkedEvidence, calculatedAssessment, data.scores, data.id, data.scenario, data.title, data.created_at])

  // Load linked evidence and entities on mount
  useEffect(() => {
    const loadLinkedEvidence = async () => {
      if (!data.id) return

      try {
        // Load evidence items from framework-evidence API
        const evidenceResponse = await fetch(`/api/framework-evidence?framework_id=${data.id}`)
        let evidenceLinks: LinkedEvidence[] = []

        if (evidenceResponse.ok) {
          const result = await evidenceResponse.json()
          evidenceLinks = (result.links || []).map((link: any) => ({
            entity_type: 'data' as const,
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
        }

        // Load actors, sources, events from framework-entities API
        const entitiesResponse = await fetch(`/api/framework-entities?framework_id=${data.id}`)
        let entityLinks: LinkedEvidence[] = []

        if (entitiesResponse.ok) {
          const result = await entitiesResponse.json()
          entityLinks = (result.links || []).map((link: any) => ({
            entity_type: link.entity_type as EvidenceEntityType,
            entity_id: link.entity_id,
            entity_data: link.entity_data || {},
            relevance: link.relevance_note,
            linked_at: link.created_at
          }))
        }

        // Combine all linked items
        setLinkedEvidence([...evidenceLinks, ...entityLinks])
      } catch (error) {
        console.error('Failed to load linked evidence:', error)
      }
    }

    loadLinkedEvidence()
  }, [data.id])

  // Load historical data for trend analysis
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (!data.id) return

      try {
        // Get workspace_id from localStorage or default
        const workspaceId = localStorage.getItem('workspace_id') || '1'
        const response = await fetch(
          `/api/deception/history?workspace_id=${workspaceId}&exclude_id=${data.id}&limit=20`
        )
        if (response.ok) {
          const result = await response.json()
          if (result.history && result.history.length > 0) {
            setHistoricalData(result.history)
          }
        }
      } catch (error) {
        console.error('Failed to load historical data:', error)
      }
    }

    loadHistoricalData()
  }, [data.id])

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

  const handleExport = async () => {
    setExporting(true)
    try {
      const reportData = {
        ...data,
        id: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        calculatedAssessment: calculatedAssessment // Use the calculated assessment
      }

      const options: ReportOptions = {
        classification,
        organizationName,
        analystName,
        includeVisualizations: true,
        includeAIAnalysis: true
      }

      if (exportFormat === 'pdf') {
        await generatePDFReport(reportData, options)
      } else if (exportFormat === 'docx') {
        await generateDOCXReport(reportData, options)
      } else if (exportFormat === 'briefing') {
        await generateExecutiveBriefing(reportData, options)
      }

      setExportDialogOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleLinkEvidence = async (selected: LinkedEvidence[]) => {
    if (!data.id) return

    try {
      // Separate data items from other entity types
      const dataItems = selected.filter(item => item.entity_type === 'data')
      const entityItems = selected.filter(item => item.entity_type !== 'data')

      const results: { success: boolean; type: string }[] = []

      // Link data items via framework-evidence API
      if (dataItems.length > 0) {
        const evidenceIds = dataItems.map(item => item.entity_id)
        const response = await fetch('/api/framework-evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            framework_id: data.id,
            evidence_ids: evidenceIds
          })
        })
        results.push({ success: response.ok, type: 'data' })
      }

      // Link actors, sources, events via framework-entities API
      if (entityItems.length > 0) {
        const entities = entityItems.map(item => ({
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          relevance_note: item.notes
        }))

        const response = await fetch('/api/framework-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            framework_id: data.id,
            entities
          })
        })
        results.push({ success: response.ok, type: 'entities' })
      }

      // Check if all requests succeeded
      const allSucceeded = results.every(r => r.success)

      if (allSucceeded) {
        setLinkedEvidence([...linkedEvidence, ...selected])
        console.log('Evidence and entities linked successfully')
      } else {
        console.error('Some links failed:', results)
        // Still update UI with what we have
        setLinkedEvidence([...linkedEvidence, ...selected])
        alert('Some items may not have been linked properly.')
      }
    } catch (error) {
      console.error('Error linking evidence:', error)
      alert('An error occurred while linking evidence.')
    }
  }

  const handleUnlinkEvidence = async (entity_type: string, entity_id: string | number) => {
    if (!data.id) return

    try {
      let response: Response

      if (entity_type === 'data') {
        // Use framework-evidence API for data items
        response = await fetch(
          `/api/framework-evidence?framework_id=${data.id}&evidence_id=${entity_id}`,
          { method: 'DELETE' }
        )
      } else {
        // Use framework-entities API for actors, sources, events
        response = await fetch(
          `/api/framework-entities?framework_id=${data.id}&entity_type=${entity_type}&entity_id=${entity_id}`,
          { method: 'DELETE' }
        )
      }

      if (response.ok) {
        setLinkedEvidence(
          linkedEvidence.filter(e => !(e.entity_type === entity_type && String(e.entity_id) === String(entity_id)))
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

  // Get linked actors for "Save to Actor" feature
  const linkedActors = linkedEvidence.filter(e => e.entity_type === 'actor')

  // Save MOM scores to an actor's deception profile
  const handleSaveToActor = async (actorId: string | number, actorName: string) => {
    if (!data.scores || !calculatedAssessment) return

    setSavingToActor(String(actorId))
    setSaveSuccess(null)

    try {
      const deceptionProfile = {
        mom: {
          motive: data.scores.motive || 0,
          opportunity: data.scores.opportunity || 0,
          means: data.scores.means || 0,
          notes: `From deception analysis: ${data.title}`
        },
        pop: {
          historical_pattern: data.scores.historicalPattern || 0,
          sophistication_level: data.scores.sophisticationLevel || 0,
          success_rate: data.scores.successRate || 0,
          notes: data.pop || ''
        },
        overall_assessment: calculatedAssessment,
        last_updated: new Date().toISOString()
      }

      const response = await fetch(`/api/actors/${actorId}/deception`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deceptionProfile)
      })

      if (response.ok) {
        setSaveSuccess(String(actorId))
        // Note: Not updating local state here as the entity_data structure
        // is complex and varies by type. The profile will be visible on reload.
        console.log(`MOM scores saved to actor ${actorId}`)
        // Clear success indicator after 3 seconds
        setTimeout(() => setSaveSuccess(null), 3000)
      } else {
        const error = await response.json()
        console.error('Failed to save to actor:', error)
        alert(`Failed to save MOM scores to ${actorName}. Please try again.`)
      }
    } catch (error) {
      console.error('Error saving to actor:', error)
      alert('An error occurred while saving MOM scores.')
    } finally {
      setSavingToActor(null)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => window.location.href = backPath}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('view.backToList')}
        </Button>

        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {data.title}
              </h1>
              <EvidenceBadge
                linkedEvidence={linkedEvidence}
                onClick={() => setShowEvidencePanel(!showEvidencePanel)}
                showBreakdown
                size="lg"
              />
            </div>
            {data.description && (
              <p className="text-gray-600 dark:text-gray-400">{data.description}</p>
            )}
            <div className="flex gap-2 mt-3 text-sm text-muted-foreground">
              <span>{t('view.created')} {new Date(data.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span>{t('view.updated')} {new Date(data.updated_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('view.evidence.createEntity')}
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
              {t('view.evidence.linkEvidence')}
            </Button>

            <AutoGenerateButton
              relationships={generatedRelationships}
              source="MOM"
              onComplete={(created, failed) => {
                console.log(`Created ${created} relationships, ${failed} failed`)
                // TODO: Refresh network graph or show success message
              }}
              label="Generate Relationships"
              variant="outline"
              size="default"
              disabled={generatedRelationships.length === 0}
            />

            {/* Save to Actor Profile - shows linked actors */}
            {linkedActors.length > 0 && data.scores && calculatedAssessment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <UserCircle className="h-4 w-4 mr-2" />
                    Save to Actor
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {linkedActors.map(actor => {
                    const actorData = actor.entity_data as { id: string; name: string }
                    const isSaving = savingToActor === String(actor.entity_id)
                    const isSuccess = saveSuccess === String(actor.entity_id)

                    return (
                      <DropdownMenuItem
                        key={actor.entity_id}
                        onClick={() => handleSaveToActor(actor.entity_id, actorData.name || 'Unknown')}
                        disabled={isSaving}
                        className="flex items-center gap-2"
                      >
                        {isSaving ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : isSuccess ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <UserCircle className="h-4 w-4" />
                        )}
                        <div className="flex-1 truncate">
                          <span>{actorData.name || 'Unknown Actor'}</span>
                        </div>
                        {isSuccess && (
                          <span className="text-xs text-green-600">Saved!</span>
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                  {linkedActors.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No linked actors. Link an actor first.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Tooltip when no actors linked */}
            {linkedActors.length === 0 && data.scores && (
              <Button variant="outline" disabled title="Link an actor first to save MOM scores">
                <UserCircle className="h-4 w-4 mr-2" />
                Save to Actor
              </Button>
            )}

            <ShareButton
              frameworkId={data.id}
              frameworkType="deception"
              isPublic={data.is_public || false}
              shareToken={data.share_token}
            />

            {/* Export Dialog */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  {t('view.export')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t('view.exportDialog.title')}</DialogTitle>
                  <DialogDescription>
                    {t('view.exportDialog.fullReportDesc')}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Export Format */}
                  <div className="space-y-2">
                    <Label htmlFor="format">{t('view.exportDialog.reportFormat')}</Label>
                    <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                      <SelectTrigger id="format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{t('view.exportDialog.fullReport')}</div>
                              <div className="text-xs text-muted-foreground">{t('view.exportDialog.fullReportDesc')}</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="briefing">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{t('view.exportDialog.executiveBriefing')}</div>
                              <div className="text-xs text-muted-foreground">{t('view.exportDialog.executiveBriefingDesc')}</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="docx">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{t('view.exportDialog.editableReport')}</div>
                              <div className="text-xs text-muted-foreground">{t('view.exportDialog.editableReportDesc')}</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Classification Level - Always UNCLASSIFIED for commercial use */}
                  <div className="space-y-2">
                    <Label>{t('view.exportDialog.classification')}</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground">
                      UNCLASSIFIED
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label htmlFor="org">{t('view.exportDialog.organizationName')}</Label>
                    <Input
                      id="org"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Intelligence Analysis Unit"
                    />
                  </div>

                  {/* Analyst Name */}
                  <div className="space-y-2">
                    <Label htmlFor="analyst">{t('view.exportDialog.analystName')}</Label>
                    <Input
                      id="analyst"
                      value={analystName}
                      onChange={(e) => setAnalystName(e.target.value)}
                      placeholder="AI-Assisted Analysis"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                    {t('common:buttons.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={handleExport} disabled={exporting}>
                    {exporting ? t('view.exportDialog.generating') : t('view.exportDialog.generateReport')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              {t('view.edit')}
            </Button>
            <Button variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              {t('view.delete')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scenario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Scenario
              </CardTitle>
              <CardDescription>
                Information or situation being analyzed for potential deception
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{data.scenario}</p>
              </div>
            </CardContent>
          </Card>

          {/* MOM Analysis */}
          {data.mom && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  MOM (Motive, Opportunity, Means)
                </CardTitle>
                <CardDescription>
                  Assessment of adversary's capability to deceive
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{data.mom}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* POP Analysis */}
          {data.pop && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  POP (Patterns of Practice)
                </CardTitle>
                <CardDescription>
                  Historical deception patterns of this actor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{data.pop}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MOSES Analysis */}
          {data.moses && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🔍</span>
                  MOSES (My Own Sources Evaluation)
                </CardTitle>
                <CardDescription>
                  Vulnerability of information sources to manipulation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{data.moses}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* EVE Analysis */}
          {data.eve && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">✓</span>
                  EVE (Evaluation of Evidence)
                </CardTitle>
                <CardDescription>
                  Internal consistency and corroboration of evidence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{data.eve}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Assessment */}
          {data.assessment && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  Overall Assessment
                </CardTitle>
                <CardDescription>
                  Synthesized findings and deception likelihood determination
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{data.assessment}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Results */}
          {data.aiAnalysis && (
            <Card className="border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  AI-Generated Analysis
                </CardTitle>
                <CardDescription>
                  GPT-4 powered deception detection insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bottom Line */}
                {data.aiAnalysis.bottomLine && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        {t('view.aiAnalysis.bluf')}
                      </h4>
                      <p className="text-sm">{data.aiAnalysis.bottomLine}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {!data.aiAnalysis.bottomLine && (
                  <>
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      <p>{t('view.aiAnalysis.noBluf')}</p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Executive Summary */}
                <div>
                  <h4 className="font-semibold mb-2">{t('view.aiAnalysis.executiveSummary')}</h4>
                  <p className="text-sm">{data.aiAnalysis.executiveSummary}</p>
                </div>

                <Separator />

                {/* Key Indicators */}
                <div>
                  <h4 className="font-semibold mb-2">{t('view.aiAnalysis.keyIndicators')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {data.aiAnalysis.keyIndicators.map((indicator, idx) => (
                      <li key={idx}>{indicator}</li>
                    ))}
                  </ul>
                </div>

                {/* Counter-Indicators */}
                {data.aiAnalysis.counterIndicators.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">{t('view.aiAnalysis.counterIndicators')}</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {data.aiAnalysis.counterIndicators.map((indicator, idx) => (
                          <li key={idx}>{indicator}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                <Separator />

                {/* Recommendations */}
                <div>
                  <h4 className="font-semibold mb-2">{t('view.aiAnalysis.recommendations')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {data.aiAnalysis.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>

                {/* Collection Priorities */}
                {data.aiAnalysis.collectionPriorities.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">{t('view.aiAnalysis.collectionPriorities')}</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {data.aiAnalysis.collectionPriorities.map((priority, idx) => (
                          <li key={idx}>{priority}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Alternative Explanations */}
                {data.aiAnalysis.alternativeExplanations.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">{t('view.aiAnalysis.alternativeExplanations')}</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {data.aiAnalysis.alternativeExplanations.map((exp, idx) => (
                          <li key={idx}>{exp}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* Trend Assessment */}
                <Separator />
                <div className="flex items-center gap-4">
                  <div>
                    <h4 className="font-semibold mb-1">{t('view.aiAnalysis.trendAssessment')}</h4>
                    <Badge variant={
                      data.aiAnalysis.trendAssessment === 'INCREASING' ? 'destructive' :
                      data.aiAnalysis.trendAssessment === 'DECREASING' ? 'default' : 'secondary'
                    }>
                      {data.aiAnalysis.trendAssessment}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Predictions & Trend Analysis */}
          {data.aiAnalysis && (
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  {t('view.aiAnalysis.trendAssessment')}
                </CardTitle>
                <CardDescription>
                  {t('dashboard.likelihoodOverTime')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeceptionPredictions
                  currentAnalysis={data.aiAnalysis}
                  historicalData={historicalDataForPredictions}
                  scenario={scenarioForPredictions}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dashboard Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            {data.scores && calculatedAssessment && (
              <DeceptionDashboard
                scores={data.scores}
                assessment={calculatedAssessment}
                showHistorical={historicalData.length > 1}
                historicalData={historicalDataForDashboard}
              />
            )}

            {(!data.scores || !calculatedAssessment) && (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    No scoring data available for this analysis. Complete the scoring section to see risk assessment dashboard.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Entity Quick Create Modal */}
      <EntityQuickCreate
        open={showEntityCreate}
        onClose={() => setShowEntityCreate(false)}
        onEntityCreated={handleEntityCreated}
        defaultTab={entityCreateTab}
        frameworkContext={{
          frameworkType: 'deception',
          frameworkId: data.id?.toString()
        }}
      />

      {/* Evidence Linker Modal */}
      <EvidenceLinker
        open={showEvidenceLinker}
        onClose={() => setShowEvidenceLinker(false)}
        onLink={handleLinkEvidence}
        alreadyLinked={linkedEvidence}
        title="Link Evidence to Deception Analysis"
        description="Select evidence items (Data, Actors, Sources, Events) that support or inform this deception analysis"
      />

      {/* Comments Section */}
      <CommentThread
        entityType="framework"
        entityId={data.id}
      />

      {/* Evidence Panel - Right Sidebar */}
      {showEvidencePanel && (
        <div className="fixed right-0 top-0 h-screen w-96 shadow-2xl z-50">
          <EvidencePanel
            linkedEvidence={linkedEvidence}
            onUnlink={handleUnlinkEvidence}
            onClose={() => setShowEvidencePanel(false)}
            title="Linked Evidence"
          />
        </div>
      )}
    </div>
  )
}
