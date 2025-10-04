/**
 * Deception Detection View
 * Display completed deception analysis with visual dashboard
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Edit, Trash2, Download, Share2, Sparkles, FileText, File, Link2, Plus } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DeceptionDashboard } from './DeceptionDashboard'
import { DeceptionPredictions } from './DeceptionPredictions'
import type { DeceptionAssessment, DeceptionScores } from '@/lib/deception-scoring'
import type { AIDeceptionAnalysis } from '@/lib/ai-deception-analysis'
import { generatePDFReport, generateDOCXReport, generateExecutiveBriefing, type ReportOptions } from '@/lib/deception-report-generator'
import { EvidenceLinker, EvidenceBadge, EvidencePanel, EntityQuickCreate, type LinkedEvidence, type EvidenceEntityType } from '@/components/evidence'
import { AutoGenerateButton } from '@/components/network'
import { generateRelationshipsFromMOM } from '@/utils/framework-relationships'
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | 'briefing'>('pdf')
  const [classification, setClassification] = useState<'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET'>('UNCLASSIFIED')
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

  // TODO: Generate relationships from linked evidence when actors/events are linked
  // For now, this is a placeholder for when entity linking with MOM is implemented
  useEffect(() => {
    // When linkedEvidence contains actors and events, generate MOM relationships
    const actors = linkedEvidence.filter(e => e.entity_type === 'actor')
    const events = linkedEvidence.filter(e => e.entity_type === 'event')

    if (actors.length > 0 && events.length > 0 && data.calculatedAssessment) {
      // TODO: Map deception analysis to MOMAssessment structure
      // This will be implemented when entity linking is fully integrated
      setGeneratedRelationships([])
    }
  }, [linkedEvidence, data.calculatedAssessment])

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
        updated_at: data.updated_at
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

  const handleShare = () => {
    // TODO: Implement sharing functionality
    console.log('Share functionality coming soon')
  }

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
          Back to Analyses
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
              <span>Created {new Date(data.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span>Updated {new Date(data.updated_at).toLocaleDateString()}</span>
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

            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>

            {/* Export Dialog */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Export Intelligence Report</DialogTitle>
                  <DialogDescription>
                    Generate a professional intelligence report with classification markings
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Export Format */}
                  <div className="space-y-2">
                    <Label htmlFor="format">Report Format</Label>
                    <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                      <SelectTrigger id="format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Full Report (PDF)</div>
                              <div className="text-xs text-muted-foreground">Complete analysis with all sections</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="briefing">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Executive Briefing (PDF)</div>
                              <div className="text-xs text-muted-foreground">1-page summary for commanders</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="docx">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Editable Report (DOCX)</div>
                              <div className="text-xs text-muted-foreground">Microsoft Word format</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Classification Level */}
                  <div className="space-y-2">
                    <Label htmlFor="classification">Classification Level</Label>
                    <Select value={classification} onValueChange={(value: any) => setClassification(value)}>
                      <SelectTrigger id="classification">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNCLASSIFIED">UNCLASSIFIED</SelectItem>
                        <SelectItem value="CONFIDENTIAL">CONFIDENTIAL</SelectItem>
                        <SelectItem value="SECRET">SECRET</SelectItem>
                        <SelectItem value="TOP SECRET">TOP SECRET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label htmlFor="org">Organization Name</Label>
                    <Input
                      id="org"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Intelligence Analysis Unit"
                    />
                  </div>

                  {/* Analyst Name */}
                  <div className="space-y-2">
                    <Label htmlFor="analyst">Analyst Name</Label>
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
                    Cancel
                  </Button>
                  <Button onClick={handleExport} disabled={exporting}>
                    {exporting ? 'Generating...' : 'Generate Report'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
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
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    Bottom Line Up Front (BLUF)
                  </h4>
                  <p className="text-sm">{data.aiAnalysis.bottomLine}</p>
                </div>

                <Separator />

                {/* Executive Summary */}
                <div>
                  <h4 className="font-semibold mb-2">Executive Summary</h4>
                  <p className="text-sm">{data.aiAnalysis.executiveSummary}</p>
                </div>

                <Separator />

                {/* Key Indicators */}
                <div>
                  <h4 className="font-semibold mb-2">Key Indicators</h4>
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
                      <h4 className="font-semibold mb-2">Counter-Indicators</h4>
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
                  <h4 className="font-semibold mb-2">Recommendations</h4>
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
                      <h4 className="font-semibold mb-2">Collection Priorities</h4>
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
                      <h4 className="font-semibold mb-2">Alternative Explanations</h4>
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
                    <h4 className="font-semibold mb-1">Trend Assessment</h4>
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
                  Predictions & Trend Analysis
                </CardTitle>
                <CardDescription>
                  Future risk projections and indicators to monitor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeceptionPredictions
                  currentAnalysis={data.aiAnalysis}
                  scenario={{
                    scenario: data.scenario,
                    mom: data.mom,
                    pop: data.pop,
                    moses: data.moses,
                    eve: data.eve
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dashboard Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            {data.scores && data.calculatedAssessment && (
              <DeceptionDashboard
                scores={data.scores}
                assessment={data.calculatedAssessment}
              />
            )}

            {(!data.scores || !data.calculatedAssessment) && (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    No scoring data available for this analysis
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
