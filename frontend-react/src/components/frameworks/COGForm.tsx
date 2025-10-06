import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, ExternalLink, Link2, Trash2, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { EvidenceLinker, type LinkedEvidence, EvidenceItemBadge } from '@/components/evidence'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  COGAnalysis,
  OperationalContext,
  ScoringSystem,
  CenterOfGravity,
  CriticalCapability,
  CriticalRequirement,
  CriticalVulnerability,
  ActorCategory,
  DIMEFILDomain,
  ScoringCriteria,
  CustomCriterion,
  CustomScoringCriteria,
} from '@/types/cog-analysis'
import {
  ScoringDescriptions,
  LinearScoreValues,
  LogarithmicScoreValues,
  calculateCompositeScore,
  calculateVulnerabilityCompositeScore,
  calculateCustomCompositeScore,
} from '@/types/cog-analysis'

interface COGFormProps {
  initialData?: Partial<COGAnalysis>
  mode: 'create' | 'edit'
  onSave: (data: COGAnalysis) => Promise<void>
  backPath: string
  frameworkId?: string
}

const ACTOR_CATEGORIES: { value: ActorCategory; label: string }[] = [
  { value: 'friendly', label: 'Friendly Forces' },
  { value: 'adversary', label: 'Adversary' },
  { value: 'host_nation', label: 'Host Nation' },
  { value: 'third_party', label: 'Third Party' },
]

const DIMEFIL_DOMAINS: { value: DIMEFILDomain; label: string; icon: string }[] = [
  { value: 'diplomatic', label: 'Diplomatic', icon: '🤝' },
  { value: 'information', label: 'Information', icon: '📡' },
  { value: 'military', label: 'Military', icon: '🎖️' },
  { value: 'economic', label: 'Economic', icon: '💰' },
  { value: 'financial', label: 'Financial', icon: '💵' },
  { value: 'intelligence', label: 'Intelligence', icon: '🔍' },
  { value: 'law_enforcement', label: 'Law Enforcement', icon: '👮' },
  { value: 'cyber', label: 'Cyber', icon: '💻' },
  { value: 'space', label: 'Space', icon: '🛰️' },
]

const REQUIREMENT_TYPES = ['personnel', 'equipment', 'logistics', 'information', 'infrastructure', 'other'] as const
const VULNERABILITY_TYPES = ['physical', 'cyber', 'human', 'logistical', 'informational', 'other'] as const

export function COGForm({ initialData, mode, onSave, backPath, frameworkId }: COGFormProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('context')

  // Basic Info
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')

  // Operational Context
  const [operationalContext, setOperationalContext] = useState<OperationalContext>(
    initialData?.operational_context || {
      objective: '',
      desired_impact: '',
      our_identity: '',
      operating_environment: '',
      constraints: [],
      restraints: [],
      timeframe: '',
      strategic_level: 'operational',
    }
  )

  // Scoring System
  const [scoringSystem, setScoringSystem] = useState<ScoringSystem>(initialData?.scoring_system || 'linear')
  const [customCriteria, setCustomCriteria] = useState<CustomCriterion[]>(
    initialData?.custom_criteria || [
      { id: 'criterion1', name: 'Impact', definition: 'How significantly would this affect the objective?' },
      { id: 'criterion2', name: 'Feasibility', definition: 'How feasible is addressing this?' },
      { id: 'criterion3', name: 'Follow-up', definition: 'What strategic advantages does this enable?' },
    ]
  )

  // COG Data
  const [cogs, setCogs] = useState<CenterOfGravity[]>(initialData?.centers_of_gravity || [])
  const [capabilities, setCapabilities] = useState<CriticalCapability[]>(initialData?.critical_capabilities || [])
  const [requirements, setRequirements] = useState<CriticalRequirement[]>(initialData?.critical_requirements || [])
  const [vulnerabilities, setVulnerabilities] = useState<CriticalVulnerability[]>(initialData?.critical_vulnerabilities || [])

  // UI State
  const [expandedCogs, setExpandedCogs] = useState<Set<string>>(new Set())
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set())
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())
  const [expandedSoWhat, setExpandedSoWhat] = useState<Set<string>>(new Set()) // Track "So What?" sections
  const [evidenceLinkerOpen, setEvidenceLinkerOpen] = useState(false)
  const [activeEvidenceTarget, setActiveEvidenceTarget] = useState<{
    type: 'cog' | 'capability' | 'requirement' | 'vulnerability'
    id: string
  } | null>(null)

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your COG analysis')
      return
    }

    setSaving(true)
    try {
      const data: COGAnalysis = {
        id: frameworkId || crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        operational_context: operationalContext,
        scoring_system: scoringSystem,
        custom_criteria: scoringSystem === 'custom' ? customCriteria : undefined,
        centers_of_gravity: cogs,
        critical_capabilities: capabilities,
        critical_requirements: requirements,
        critical_vulnerabilities: vulnerabilities,
        created_at: initialData?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: initialData?.created_by || 1,
        status: 'active',
      }

      await onSave(data)
      navigate(backPath)
    } catch (error) {
      console.error('Failed to save COG analysis:', error)
      alert('Failed to save COG analysis. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addCOG = () => {
    const newCOG: CenterOfGravity = {
      id: crypto.randomUUID(),
      actor_category: 'friendly',
      domain: 'military',
      description: '',
      rationale: '',
      linked_evidence: [],
    }
    setCogs([...cogs, newCOG])
    setExpandedCogs(new Set([...expandedCogs, newCOG.id]))
  }

  const updateCOG = (id: string, updates: Partial<CenterOfGravity>) => {
    setCogs(cogs.map(cog => (cog.id === id ? { ...cog, ...updates } : cog)))
  }

  const removeCOG = (id: string) => {
    if (!confirm('Remove this COG and all dependent items?')) return
    setCogs(cogs.filter(cog => cog.id !== id))
    const capIds = capabilities.filter(cap => cap.cog_id === id).map(cap => cap.id)
    setCapabilities(capabilities.filter(cap => cap.cog_id !== id))
    const reqIds = requirements.filter(req => capIds.includes(req.capability_id)).map(req => req.id)
    setRequirements(requirements.filter(req => !capIds.includes(req.capability_id)))
    setVulnerabilities(vulnerabilities.filter(vuln => !reqIds.includes(vuln.requirement_id)))
  }

  const addCapability = (cogId: string) => {
    const newCap: CriticalCapability = {
      id: crypto.randomUUID(),
      cog_id: cogId,
      capability: '',
      description: '',
      strategic_contribution: '',
      linked_evidence: [],
    }
    setCapabilities([...capabilities, newCap])
    setExpandedCaps(new Set([...expandedCaps, newCap.id]))
  }

  const updateCapability = (id: string, updates: Partial<CriticalCapability>) => {
    setCapabilities(capabilities.map(cap => (cap.id === id ? { ...cap, ...updates } : cap)))
  }

  const removeCapability = (id: string) => {
    if (!confirm('Remove this capability and all dependent items?')) return
    setCapabilities(capabilities.filter(cap => cap.id !== id))
    const reqIds = requirements.filter(req => req.capability_id === id).map(req => req.id)
    setRequirements(requirements.filter(req => req.capability_id !== id))
    setVulnerabilities(vulnerabilities.filter(vuln => !reqIds.includes(vuln.requirement_id)))
  }

  const addRequirement = (capabilityId: string) => {
    const newReq: CriticalRequirement = {
      id: crypto.randomUUID(),
      capability_id: capabilityId,
      requirement: '',
      requirement_type: 'other',
      description: '',
      linked_evidence: [],
    }
    setRequirements([...requirements, newReq])
    setExpandedReqs(new Set([...expandedReqs, newReq.id]))
  }

  const updateRequirement = (id: string, updates: Partial<CriticalRequirement>) => {
    setRequirements(requirements.map(req => (req.id === id ? { ...req, ...updates } : req)))
  }

  const removeRequirement = (id: string) => {
    if (!confirm('Remove this requirement and all dependent vulnerabilities?')) return
    setRequirements(requirements.filter(req => req.id !== id))
    setVulnerabilities(vulnerabilities.filter(vuln => vuln.requirement_id !== id))
  }

  const addVulnerability = (requirementId: string) => {
    const newVuln: CriticalVulnerability = {
      id: crypto.randomUUID(),
      requirement_id: requirementId,
      vulnerability: '',
      vulnerability_type: 'other',
      description: '',
      ...(scoringSystem === 'custom'
        ? {
            custom_scoring: customCriteria.reduce((acc, criterion) => ({ ...acc, [criterion.id]: 1 }), {}),
            composite_score: customCriteria.length,
          }
        : {
            scoring: {
              impact_on_cog: 1,
              attainability: 1,
              follow_up_potential: 1,
            },
            composite_score: 3,
          }),
      linked_evidence: [],
    }
    setVulnerabilities([...vulnerabilities, newVuln])
  }

  const updateVulnerability = (id: string, updates: Partial<CriticalVulnerability>) => {
    setVulnerabilities(
      vulnerabilities.map(vuln => {
        if (vuln.id === id) {
          const updated = { ...vuln, ...updates }
          // Recalculate composite score if scoring or custom_scoring changed
          if (updates.scoring || updates.custom_scoring) {
            updated.composite_score = calculateVulnerabilityCompositeScore(updated)
          }
          return updated
        }
        return vuln
      })
    )
  }

  const removeVulnerability = (id: string) => {
    if (!confirm('Remove this vulnerability?')) return
    setVulnerabilities(vulnerabilities.filter(vuln => vuln.id !== id))
  }

  const openEvidenceLinker = (type: 'cog' | 'capability' | 'requirement' | 'vulnerability', id: string) => {
    setActiveEvidenceTarget({ type, id })
    setEvidenceLinkerOpen(true)
  }

  const handleEvidenceLink = async (selected: LinkedEvidence[]) => {
    if (!activeEvidenceTarget) return
    const evidenceIds = selected.map(e => String(e.entity_id))

    switch (activeEvidenceTarget.type) {
      case 'cog':
        updateCOG(activeEvidenceTarget.id, {
          linked_evidence: [...(cogs.find(c => c.id === activeEvidenceTarget.id)?.linked_evidence || []), ...evidenceIds],
        })
        break
      case 'capability':
        updateCapability(activeEvidenceTarget.id, {
          linked_evidence: [...(capabilities.find(c => c.id === activeEvidenceTarget.id)?.linked_evidence || []), ...evidenceIds],
        })
        break
      case 'requirement':
        updateRequirement(activeEvidenceTarget.id, {
          linked_evidence: [...(requirements.find(r => r.id === activeEvidenceTarget.id)?.linked_evidence || []), ...evidenceIds],
        })
        break
      case 'vulnerability':
        updateVulnerability(activeEvidenceTarget.id, {
          linked_evidence: [...(vulnerabilities.find(v => v.id === activeEvidenceTarget.id)?.linked_evidence || []), ...evidenceIds],
        })
        break
    }

    setEvidenceLinkerOpen(false)
    setActiveEvidenceTarget(null)
  }

  const getScoreValues = (): readonly number[] => {
    return scoringSystem === 'linear' ? LinearScoreValues : LogarithmicScoreValues
  }

  const getScoreLabel = (criteria: keyof typeof ScoringDescriptions, score: number): string => {
    const desc = ScoringDescriptions[criteria]
    if (scoringSystem === 'linear') {
      return desc.linear[score as 1 | 2 | 3 | 4 | 5] || ''
    } else {
      return desc.logarithmic[score as 1 | 3 | 5 | 8 | 12] || ''
    }
  }

  const toggleExpanded = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const newSet = new Set(set)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setter(newSet)
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-gray-950 z-10 py-4 border-b">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {mode === 'create' ? 'Create' : 'Edit'} COG Analysis
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Center of Gravity Analysis (JP 3-0 Methodology)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open('https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide', '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Reference Guide
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Analysis'}
            </Button>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Title and description for your COG analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Operation XYZ COG Analysis" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide context..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Tabs for organized workflow */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="context">Operational Context</TabsTrigger>
            <TabsTrigger value="cogs">COG Analysis</TabsTrigger>
            <TabsTrigger value="scoring">Scoring System</TabsTrigger>
          </TabsList>

          {/* Operational Context Tab */}
          <TabsContent value="context" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Operational Context</CardTitle>
                <CardDescription>Answer guided questions to define your operational environment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>🎯 What is your analysis objective? *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">A good objective is specific, measurable, and tied to commander's intent.</p>
                          <p className="text-sm">Examples:</p>
                          <ul className="text-sm list-disc ml-4 mt-1">
                            <li>Identify adversary vulnerabilities for targeting</li>
                            <li>Protect friendly COGs from adversary action</li>
                            <li>Assess host nation critical infrastructure</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    value={operationalContext.objective}
                    onChange={e => setOperationalContext({ ...operationalContext, objective: e.target.value })}
                    placeholder="Example: Identify and prioritize adversary information operations vulnerabilities to enable IO counter-campaign and degrade their ability to influence regional populations"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>💥 What impact do we want to achieve?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Describe the desired end-state or effect.</p>
                          <p className="text-sm">Consider:</p>
                          <ul className="text-sm list-disc ml-4 mt-1">
                            <li>What changes in adversary behavior?</li>
                            <li>What capabilities are degraded/neutralized?</li>
                            <li>What strategic advantage is gained?</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    value={operationalContext.desired_impact}
                    onChange={e => setOperationalContext({ ...operationalContext, desired_impact: e.target.value })}
                    placeholder="Example: Reduce adversary IO effectiveness by 60%, forcing them to shift resources from offensive to defensive operations, creating windows for friendly information advantage"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>👥 Who are we? (Friendly Forces Description)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Describe friendly force composition and capabilities.</p>
                          <p className="text-sm">Include: organizational structure, key capabilities, partnered forces, unique advantages</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    value={operationalContext.our_identity}
                    onChange={e => setOperationalContext({ ...operationalContext, our_identity: e.target.value })}
                    placeholder="Example: Joint Task Force with cyber, information operations, and special operations capabilities; partnered with host nation security forces and regional allies"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>🌍 Where are we operating? (PMESII-PT Context)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Describe the operational environment using PMESII-PT:</p>
                          <ul className="text-sm list-disc ml-4 mt-1">
                            <li><strong>P</strong>olitical: Government, power structures</li>
                            <li><strong>M</strong>ilitary: Forces, capabilities, posture</li>
                            <li><strong>E</strong>conomic: Resources, trade, infrastructure</li>
                            <li><strong>S</strong>ocial: Demographics, culture, grievances</li>
                            <li><strong>I</strong>nformation: Media, narratives, connectivity</li>
                            <li><strong>I</strong>nfrastructure: Critical systems, networks</li>
                            <li><strong>P</strong>hysical: Terrain, climate, geography</li>
                            <li><strong>T</strong>ime: Tempo, windows, constraints</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    value={operationalContext.operating_environment}
                    onChange={e => setOperationalContext({ ...operationalContext, operating_environment: e.target.value })}
                    placeholder="Example: Urban environment with high internet penetration (70%+), contested information space with multiple state/non-state actors, weak governance creating information voids, population increasingly mobile-first for news consumption"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>⛓️ What constraints limit us? (comma-separated)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Constraints are things you MUST do or CONDITIONS that limit action.</p>
                          <p className="text-sm">Examples:</p>
                          <ul className="text-sm list-disc ml-4 mt-1">
                            <li>Must coordinate with State Department</li>
                            <li>Limited to defensive cyber operations only</li>
                            <li>Budget ceiling of $5M</li>
                            <li>Requires host nation approval for any kinetic action</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={operationalContext.constraints.join(', ')}
                    onChange={e => setOperationalContext({ ...operationalContext, constraints: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Example: Must obtain interagency approval, Limited to non-attribution operations, Resource cap of 50 personnel"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>🚫 What restraints restrict us? (comma-separated)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Restraints are things you MUST NOT do or PROHIBITED actions.</p>
                          <p className="text-sm">Examples:</p>
                          <ul className="text-sm list-disc ml-4 mt-1">
                            <li>No strikes on religious sites</li>
                            <li>No engagement of state media infrastructure</li>
                            <li>Cannot operate within 50km of border</li>
                            <li>Prohibited from targeting specific platforms</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={operationalContext.restraints.join(', ')}
                    onChange={e => setOperationalContext({ ...operationalContext, restraints: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Example: No targeting of civilian infrastructure, Prohibited from cross-border operations, Cannot disrupt international commerce"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>⏱️ What is the operational timeframe?</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm">Specify the planning horizon or operational window. This helps prioritize vulnerabilities based on when effects are needed.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      value={operationalContext.timeframe}
                      onChange={e => setOperationalContext({ ...operationalContext, timeframe: e.target.value })}
                      placeholder="e.g., 90 days, Q2 2025, Pre-election period"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>📊 At what strategic level?</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="font-semibold mb-2">Strategic levels of war:</p>
                            <ul className="text-sm list-disc ml-4">
                              <li><strong>Strategic:</strong> National/theater objectives</li>
                              <li><strong>Operational:</strong> Campaign/major operation</li>
                              <li><strong>Tactical:</strong> Battle/engagement level</li>
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={operationalContext.strategic_level} onValueChange={(v: any) => setOperationalContext({ ...operationalContext, strategic_level: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tactical">Tactical</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="strategic">Strategic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COG Analysis Tab - Continue in next message due to length */}
          <TabsContent value="cogs" className="space-y-4">
            {/* COG Hierarchy Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Centers of Gravity</CardTitle>
                    <CardDescription>Identify COGs across DIMEFIL domains for each actor</CardDescription>
                  </div>
                  <Button onClick={addCOG}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add COG
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cogs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No COGs defined. Click "Add COG" to begin.</p>
                ) : (
                  cogs.map(cog => (
                    <Card key={cog.id} className="border-l-4 border-red-500">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          {/* COG Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs">Actor Category</Label>
                                <Select value={cog.actor_category} onValueChange={(v: ActorCategory) => updateCOG(cog.id, { actor_category: v })}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ACTOR_CATEGORIES.map(cat => (
                                      <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Domain</Label>
                                <Select value={cog.domain} onValueChange={(v: DIMEFILDomain) => updateCOG(cog.id, { domain: v })}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DIMEFIL_DOMAINS.map(dom => (
                                      <SelectItem key={dom.value} value={dom.value}>
                                        {dom.icon} {dom.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toggleExpanded(expandedCogs, setExpandedCogs, cog.id)}>
                                {expandedCogs.has(cog.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => removeCOG(cog.id)} className="text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {expandedCogs.has(cog.id) && (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">📝 What is this Center of Gravity? *</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-md">
                                        <p className="font-semibold mb-2">A COG is a source of power that provides moral or physical strength, freedom of action, or will to act.</p>
                                        <p className="text-sm mb-2">Examples:</p>
                                        <ul className="text-sm list-disc ml-4">
                                          <li><strong>Military:</strong> Integrated air defense system</li>
                                          <li><strong>Information:</strong> State-controlled media apparatus</li>
                                          <li><strong>Economic:</strong> Oil export infrastructure</li>
                                        </ul>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Textarea
                                  value={cog.description}
                                  onChange={e => updateCOG(cog.id, { description: e.target.value })}
                                  placeholder="Example: Adversary's integrated air defense system provides freedom of maneuver and protects critical infrastructure across the theater"
                                  rows={2}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">🤔 Why is this a COG? (Rationale)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-md">
                                        <p className="font-semibold mb-2">Explain what makes this a true COG:</p>
                                        <ul className="text-sm list-disc ml-4">
                                          <li>What happens if this is neutralized?</li>
                                          <li>What evidence supports this assessment?</li>
                                          <li>How does this enable the actor's objectives?</li>
                                        </ul>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Textarea
                                  value={cog.rationale}
                                  onChange={e => updateCOG(cog.id, { rationale: e.target.value })}
                                  placeholder="Example: Without air defense, adversary loses sanctuary for ground forces, logistics hubs, and C2 nodes. Historical analysis shows air dominance correlates with 85% success rate in similar conflicts."
                                  rows={3}
                                />
                              </div>

                              {/* COG Validation Checklist - COLLAPSIBLE */}
                              <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => {
                                    const key = `checklist-${cog.id}`
                                    setExpandedSoWhat(prev => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(key)) newSet.delete(key)
                                      else newSet.add(key)
                                      return newSet
                                    })
                                  }}
                                >
                                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer">✅ COG Validation Checklist</p>
                                  {expandedSoWhat.has(`checklist-${cog.id}`) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                                {expandedSoWhat.has(`checklist-${cog.id}`) && (
                                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 mt-2">
                                    <li>☐ If neutralized, would this critically degrade objectives?</li>
                                    <li>☐ Is this truly a source of power (not just important)?</li>
                                    <li>☐ Is this at the right level of analysis?</li>
                                    <li>☐ Can this be protected/exploited through its vulnerabilities?</li>
                                  </ul>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs">Linked Evidence ({cog.linked_evidence.length})</Label>
                                <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('cog', cog.id)} className="mt-1">
                                  <Link2 className="h-3 w-3 mr-2" />
                                  Link Evidence
                                </Button>
                              </div>

                              {/* Capabilities for this COG */}
                              <div className="ml-6 space-y-3 border-l-2 border-blue-300 pl-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-semibold">⚡ Critical Capabilities - What can the COG DO?</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-md">
                                          <p className="font-semibold mb-2">Capabilities are ACTIONS (verbs) the COG can perform.</p>
                                          <p className="text-sm mb-2">Examples:</p>
                                          <ul className="text-sm list-disc ml-4">
                                            <li>"Project military power across theater"</li>
                                            <li>"Influence regional public opinion"</li>
                                            <li>"Coordinate multi-domain strike operations"</li>
                                            <li>"Control information narrative"</li>
                                          </ul>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => addCapability(cog.id)}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                </div>
                                {capabilities
                                  .filter(cap => cap.cog_id === cog.id)
                                  .map(cap => (
                                    <Card key={cap.id} className="border-blue-200">
                                      <CardContent className="pt-3 pb-3">
                                        <div className="space-y-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <Input
                                              value={cap.capability}
                                              onChange={e => updateCapability(cap.id, { capability: e.target.value })}
                                              placeholder="Example: Launch coordinated missile strikes OR Influence public perception through social media"
                                              className="flex-1"
                                            />
                                            <div className="flex gap-1">
                                              <Button variant="ghost" size="sm" onClick={() => toggleExpanded(expandedCaps, setExpandedCaps, cap.id)}>
                                                {expandedCaps.has(cap.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                              </Button>
                                              <Button variant="ghost" size="sm" onClick={() => removeCapability(cap.id)} className="text-red-600">
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>

                                          {expandedCaps.has(cap.id) && (
                                            <>
                                              <div className="space-y-1">
                                                <Label className="text-xs">How does this capability work?</Label>
                                                <Textarea
                                                  value={cap.description}
                                                  onChange={e => updateCapability(cap.id, { description: e.target.value })}
                                                  placeholder="Example: Uses network of bot accounts, influencers, and state media to amplify narratives across platforms within 24-48 hours"
                                                  rows={2}
                                                  className="text-sm"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-xs">How does this support the actor's objectives?</Label>
                                                <Textarea
                                                  value={cap.strategic_contribution}
                                                  onChange={e => updateCapability(cap.id, { strategic_contribution: e.target.value })}
                                                  placeholder="Example: Enables shaping of regional opinion to support strategic objectives, undermine adversaries, and prepare information environment for military operations"
                                                  rows={2}
                                                  className="text-sm"
                                                />
                                              </div>
                                              <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('capability', cap.id)}>
                                                <Link2 className="h-3 w-3 mr-2" />
                                                Evidence ({cap.linked_evidence.length})
                                              </Button>

                                              {/* Requirements for this Capability */}
                                              <div className="ml-4 space-y-2 border-l-2 border-yellow-300 pl-3">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <Label className="text-xs font-semibold">📋 Critical Requirements - What does this capability NEED?</Label>
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-md">
                                                          <p className="font-semibold mb-2">Requirements are RESOURCES/CONDITIONS (nouns) the capability needs to function.</p>
                                                          <p className="text-sm mb-2">Examples:</p>
                                                          <ul className="text-sm list-disc ml-4">
                                                            <li>"Trained personnel"</li>
                                                            <li>"Logistics support network"</li>
                                                            <li>"Command and control infrastructure"</li>
                                                            <li>"Platform access (social media accounts)"</li>
                                                          </ul>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  </div>
                                                  <Button variant="outline" size="sm" onClick={() => addRequirement(cap.id)}>
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Add
                                                  </Button>
                                                </div>
                                                {requirements
                                                  .filter(req => req.capability_id === cap.id)
                                                  .map(req => (
                                                    <Card key={req.id} className="border-yellow-200">
                                                      <CardContent className="pt-2 pb-2">
                                                        <div className="space-y-2">
                                                          <div className="flex items-start gap-2">
                                                            <Input
                                                              value={req.requirement}
                                                              onChange={e => updateRequirement(req.id, { requirement: e.target.value })}
                                                              placeholder="Example: Platform policy compliance OR Network of coordinated accounts"
                                                              className="flex-1 h-8 text-sm"
                                                            />
                                                            <Select value={req.requirement_type} onValueChange={(v: any) => updateRequirement(req.id, { requirement_type: v })}>
                                                              <SelectTrigger className="w-32 h-8 text-xs">
                                                                <SelectValue />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                {REQUIREMENT_TYPES.map(type => (
                                                                  <SelectItem key={type} value={type}>
                                                                    {type}
                                                                  </SelectItem>
                                                                ))}
                                                              </SelectContent>
                                                            </Select>
                                                            <div className="flex gap-1">
                                                              <Button variant="ghost" size="sm" onClick={() => toggleExpanded(expandedReqs, setExpandedReqs, req.id)}>
                                                                {expandedReqs.has(req.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                              </Button>
                                                              <Button variant="ghost" size="sm" onClick={() => removeRequirement(req.id)} className="text-red-600">
                                                                <X className="h-3 w-3" />
                                                              </Button>
                                                            </div>
                                                          </div>

                                                          {expandedReqs.has(req.id) && (
                                                            <>
                                                              <div className="space-y-1">
                                                                <Label className="text-xs">What is this requirement and why is it needed?</Label>
                                                                <Textarea
                                                                  value={req.description}
                                                                  onChange={e => updateRequirement(req.id, { description: e.target.value })}
                                                                  placeholder="Example: Requires active accounts on major platforms to distribute content. Must maintain compliance with platform terms of service to avoid account suspension or content removal."
                                                                  rows={2}
                                                                  className="text-xs"
                                                                />
                                                              </div>
                                                              <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('requirement', req.id)}>
                                                                <Link2 className="h-3 w-3 mr-1" />
                                                                Evidence ({req.linked_evidence.length})
                                                              </Button>

                                                              {/* Vulnerabilities for this Requirement */}
                                                              <div className="ml-3 space-y-2 border-l-2 border-orange-300 pl-2">
                                                                <div className="flex items-center justify-between">
                                                                  <div className="flex items-center gap-2">
                                                                    <Label className="text-xs font-semibold">⚠️ Critical Vulnerabilities - What is the WEAKNESS?</Label>
                                                                    <TooltipProvider>
                                                                      <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="max-w-md">
                                                                          <p className="font-semibold mb-2">Vulnerabilities are deficiencies or weaknesses in a requirement that can be exploited.</p>
                                                                          <p className="text-sm mb-2">Examples:</p>
                                                                          <ul className="text-sm list-disc ml-4">
                                                                            <li>"Platform policy enforcement" (requirement: account access)</li>
                                                                            <li>"Single point of failure" (requirement: C2 node)</li>
                                                                            <li>"Insufficient redundancy" (requirement: supply route)</li>
                                                                          </ul>
                                                                        </TooltipContent>
                                                                      </Tooltip>
                                                                    </TooltipProvider>
                                                                  </div>
                                                                  <Button variant="outline" size="sm" onClick={() => addVulnerability(req.id)}>
                                                                    <Plus className="h-3 w-3 mr-1" />
                                                                    Add
                                                                  </Button>
                                                                </div>
                                                                {vulnerabilities
                                                                  .filter(vuln => vuln.requirement_id === req.id)
                                                                  .map(vuln => (
                                                                    <Card key={vuln.id} className="border-orange-200 bg-orange-50 dark:bg-orange-900/10">
                                                                      <CardContent className="pt-2 pb-2">
                                                                        <div className="space-y-2">
                                                                          <div className="flex items-start gap-2">
                                                                            <Input
                                                                              value={vuln.vulnerability}
                                                                              onChange={e => updateVulnerability(vuln.id, { vulnerability: e.target.value })}
                                                                              placeholder="Example: Platform policy enforcement OR Single command node"
                                                                              className="flex-1 h-8 text-xs"
                                                                            />
                                                                            <Select value={vuln.vulnerability_type} onValueChange={(v: any) => updateVulnerability(vuln.id, { vulnerability_type: v })}>
                                                                              <SelectTrigger className="w-28 h-8 text-xs">
                                                                                <SelectValue />
                                                                              </SelectTrigger>
                                                                              <SelectContent>
                                                                                {VULNERABILITY_TYPES.map(type => (
                                                                                  <SelectItem key={type} value={type}>
                                                                                    {type}
                                                                                  </SelectItem>
                                                                                ))}
                                                                              </SelectContent>
                                                                            </Select>
                                                                            <Button variant="ghost" size="sm" onClick={() => removeVulnerability(vuln.id)} className="text-red-600">
                                                                              <X className="h-3 w-3" />
                                                                            </Button>
                                                                          </div>

                                                                          <div className="space-y-1">
                                                                            <Label className="text-xs">What is this vulnerability and how can it be exploited?</Label>
                                                                            <Textarea
                                                                              value={vuln.description}
                                                                              onChange={e => updateVulnerability(vuln.id, { description: e.target.value })}
                                                                              placeholder="Example: Platforms enforce content policies against coordinated inauthentic behavior. Mass reporting campaigns can trigger automated suspensions within 24-48 hours, disrupting the entire influence operation."
                                                                              rows={2}
                                                                              className="text-xs"
                                                                            />
                                                                          </div>

                                                                          {/* Scoring Interface */}
                                                                          <div className="space-y-2 bg-white dark:bg-gray-900 p-2 rounded">
                                                                            <Label className="text-xs font-semibold">Scoring (Composite: {vuln.composite_score})</Label>

                                                                            {/* Default Scoring (Linear/Logarithmic) */}
                                                                            {scoringSystem !== 'custom' && vuln.scoring && (
                                                                              <>
                                                                                {/* Impact on COG */}
                                                                                <div>
                                                                                  <div className="flex items-center justify-between">
                                                                                    <Label className="text-xs">Impact (I)</Label>
                                                                                    <Tooltip>
                                                                                      <TooltipTrigger>
                                                                                        <HelpCircle className="h-3 w-3" />
                                                                                      </TooltipTrigger>
                                                                                      <TooltipContent>
                                                                                        <p className="max-w-xs text-xs">{ScoringDescriptions.impact_on_cog.definition}</p>
                                                                                      </TooltipContent>
                                                                                    </Tooltip>
                                                                                  </div>
                                                                                  <div className="flex items-center gap-2">
                                                                                    <Slider
                                                                                      value={[vuln.scoring.impact_on_cog]}
                                                                                      onValueChange={([v]) =>
                                                                                        updateVulnerability(vuln.id, {
                                                                                          scoring: { ...vuln.scoring, impact_on_cog: v as any },
                                                                                        })
                                                                                      }
                                                                                      min={getScoreValues()[0]}
                                                                                      max={getScoreValues()[getScoreValues().length - 1]}
                                                                                      step={1}
                                                                                      className="flex-1"
                                                                                    />
                                                                                    <Badge variant="outline" className="min-w-[3rem] justify-center">
                                                                                      {vuln.scoring.impact_on_cog}
                                                                                    </Badge>
                                                                                  </div>
                                                                                  <p className="text-xs text-gray-500 mt-1">{getScoreLabel('impact_on_cog', vuln.scoring.impact_on_cog)}</p>
                                                                                </div>

                                                                                {/* Attainability */}
                                                                                <div>
                                                                                  <div className="flex items-center justify-between">
                                                                                    <Label className="text-xs">Attainability (A)</Label>
                                                                                    <Tooltip>
                                                                                      <TooltipTrigger>
                                                                                        <HelpCircle className="h-3 w-3" />
                                                                                      </TooltipTrigger>
                                                                                      <TooltipContent>
                                                                                        <p className="max-w-xs text-xs">{ScoringDescriptions.attainability.definition}</p>
                                                                                      </TooltipContent>
                                                                                    </Tooltip>
                                                                                  </div>
                                                                                  <div className="flex items-center gap-2">
                                                                                    <Slider
                                                                                      value={[vuln.scoring.attainability]}
                                                                                      onValueChange={([v]) =>
                                                                                        updateVulnerability(vuln.id, {
                                                                                          scoring: { ...vuln.scoring, attainability: v as any },
                                                                                        })
                                                                                      }
                                                                                      min={getScoreValues()[0]}
                                                                                      max={getScoreValues()[getScoreValues().length - 1]}
                                                                                      step={1}
                                                                                      className="flex-1"
                                                                                    />
                                                                                    <Badge variant="outline" className="min-w-[3rem] justify-center">
                                                                                      {vuln.scoring.attainability}
                                                                                    </Badge>
                                                                                  </div>
                                                                                  <p className="text-xs text-gray-500 mt-1">{getScoreLabel('attainability', vuln.scoring.attainability)}</p>
                                                                                </div>

                                                                                {/* Follow-up Potential */}
                                                                                <div>
                                                                                  <div className="flex items-center justify-between">
                                                                                    <Label className="text-xs">Follow-up (F)</Label>
                                                                                    <Tooltip>
                                                                                      <TooltipTrigger>
                                                                                        <HelpCircle className="h-3 w-3" />
                                                                                      </TooltipTrigger>
                                                                                      <TooltipContent>
                                                                                        <p className="max-w-xs text-xs">{ScoringDescriptions.follow_up_potential.definition}</p>
                                                                                      </TooltipContent>
                                                                                    </Tooltip>
                                                                                  </div>
                                                                                  <div className="flex items-center gap-2">
                                                                                    <Slider
                                                                                      value={[vuln.scoring.follow_up_potential]}
                                                                                      onValueChange={([v]) =>
                                                                                        updateVulnerability(vuln.id, {
                                                                                          scoring: { ...vuln.scoring, follow_up_potential: v as any },
                                                                                        })
                                                                                      }
                                                                                      min={getScoreValues()[0]}
                                                                                      max={getScoreValues()[getScoreValues().length - 1]}
                                                                                      step={1}
                                                                                      className="flex-1"
                                                                                    />
                                                                                    <Badge variant="outline" className="min-w-[3rem] justify-center">
                                                                                      {vuln.scoring.follow_up_potential}
                                                                                    </Badge>
                                                                                  </div>
                                                                                  <p className="text-xs text-gray-500 mt-1">{getScoreLabel('follow_up_potential', vuln.scoring.follow_up_potential)}</p>
                                                                                </div>
                                                                              </>
                                                                            )}

                                                                            {/* Custom Scoring */}
                                                                            {scoringSystem === 'custom' && vuln.custom_scoring && (
                                                                              <>
                                                                                {customCriteria.map((criterion) => (
                                                                                  <div key={criterion.id}>
                                                                                    <div className="flex items-center justify-between">
                                                                                      <Label className="text-xs">{criterion.name}</Label>
                                                                                      <Tooltip>
                                                                                        <TooltipTrigger>
                                                                                          <HelpCircle className="h-3 w-3" />
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>
                                                                                          <p className="max-w-xs text-xs">{criterion.definition}</p>
                                                                                        </TooltipContent>
                                                                                      </Tooltip>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                      <Slider
                                                                                        value={[vuln.custom_scoring[criterion.id] || 1]}
                                                                                        onValueChange={([v]) =>
                                                                                          updateVulnerability(vuln.id, {
                                                                                            custom_scoring: { ...vuln.custom_scoring, [criterion.id]: v },
                                                                                          })
                                                                                        }
                                                                                        min={1}
                                                                                        max={5}
                                                                                        step={1}
                                                                                        className="flex-1"
                                                                                      />
                                                                                      <Badge variant="outline" className="min-w-[3rem] justify-center">
                                                                                        {vuln.custom_scoring[criterion.id] || 1}
                                                                                      </Badge>
                                                                                    </div>
                                                                                  </div>
                                                                                ))}
                                                                              </>
                                                                            )}
                                                                          </div>

                                                                          {/* "So What?" Section - Expected Effect & Recommended Actions - COLLAPSIBLE */}
                                                                          <div className="bg-green-50 dark:bg-green-950 p-2 rounded-lg border border-green-200 dark:border-green-800">
                                                                            <div
                                                                              className="flex items-center justify-between cursor-pointer"
                                                                              onClick={() => toggleExpanded(expandedSoWhat, setExpandedSoWhat, vuln.id)}
                                                                            >
                                                                              <Label className="text-sm font-semibold text-green-900 dark:text-green-100 cursor-pointer">
                                                                                💡 "So What?" - Impact Analysis
                                                                              </Label>
                                                                              {expandedSoWhat.has(vuln.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                            </div>

                                                                            {expandedSoWhat.has(vuln.id) && (
                                                                              <div className="mt-3 space-y-2">
                                                                                <div className="space-y-1">
                                                                                  <Label className="text-xs">What happens if exploited?</Label>
                                                                                  <Textarea
                                                                                    value={vuln.expected_effect || ''}
                                                                                    onChange={e => updateVulnerability(vuln.id, { expected_effect: e.target.value })}
                                                                                    placeholder="Example: Adversary loses primary influence mechanism within 48 hours."
                                                                                    rows={2}
                                                                                    className="text-xs"
                                                                                  />
                                                                                </div>

                                                                                <div className="space-y-1">
                                                                                  <Label className="text-xs">Recommended Actions</Label>
                                                                                  <Input
                                                                                    value={(vuln.recommended_actions || []).join(', ')}
                                                                                    onChange={e => updateVulnerability(vuln.id, {
                                                                                      recommended_actions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                                                    })}
                                                                                    placeholder="Report accounts, Work with platforms, Monitor adaptation"
                                                                                    className="text-xs"
                                                                                  />
                                                                                </div>

                                                                                <div className="space-y-1">
                                                                                  <Label className="text-xs">Confidence</Label>
                                                                                  <Select
                                                                                    value={vuln.confidence || 'medium'}
                                                                                    onValueChange={(v: 'low' | 'medium' | 'high' | 'confirmed') => updateVulnerability(vuln.id, { confidence: v })}
                                                                                  >
                                                                                    <SelectTrigger className="h-8 text-xs">
                                                                                      <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                      <SelectItem value="low">Low</SelectItem>
                                                                                      <SelectItem value="medium">Medium</SelectItem>
                                                                                      <SelectItem value="high">High</SelectItem>
                                                                                      <SelectItem value="confirmed">Confirmed</SelectItem>
                                                                                    </SelectContent>
                                                                                  </Select>
                                                                                </div>
                                                                              </div>
                                                                            )}
                                                                          </div>

                                                                          <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('vulnerability', vuln.id)}>
                                                                            <Link2 className="h-3 w-3 mr-1" />
                                                                            Evidence ({vuln.linked_evidence.length})
                                                                          </Button>
                                                                        </div>
                                                                      </CardContent>
                                                                    </Card>
                                                                  ))}
                                                              </div>
                                                            </>
                                                          )}
                                                        </div>
                                                      </CardContent>
                                                    </Card>
                                                  ))}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scoring System Tab */}
          <TabsContent value="scoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scoring System</CardTitle>
                <CardDescription>Select scoring method and configure criteria for vulnerability assessment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'linear' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('linear')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">Linear (1-5)</h3>
                      <p className="text-xs text-gray-600 mb-4">Equal intervals</p>
                      <div className="flex justify-between text-xs">
                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'logarithmic' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('logarithmic')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">Logarithmic</h3>
                      <p className="text-xs text-gray-600 mb-4">Exponential scale</p>
                      <div className="flex justify-between text-xs">
                        <span>1</span><span>3</span><span>5</span><span>8</span><span>12</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'custom' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('custom')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">Custom</h3>
                      <p className="text-xs text-gray-600 mb-4">Define your own</p>
                      <div className="text-xs text-center text-gray-500">1-5 criteria</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Default Criteria Info */}
                {(scoringSystem === 'linear' || scoringSystem === 'logarithmic') && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Default Scoring Criteria</h4>
                    <ul className="space-y-2 text-sm">
                      <li><strong>Impact on COG (I):</strong> How significantly would this affect the COG?</li>
                      <li><strong>Attainability (A):</strong> How feasible is addressing this?</li>
                      <li><strong>Follow-up Potential (F):</strong> What strategic advantages does this enable?</li>
                      <li className="pt-2 border-t"><strong>Composite Score = I + A + F</strong></li>
                    </ul>
                  </div>
                )}

                {/* Custom Criteria Configuration */}
                {scoringSystem === 'custom' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Custom Criteria (1-5 criteria)</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (customCriteria.length < 5) {
                              setCustomCriteria([
                                ...customCriteria,
                                {
                                  id: `criterion${customCriteria.length + 1}`,
                                  name: '',
                                  definition: '',
                                },
                              ])
                            }
                          }}
                          disabled={customCriteria.length >= 5}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Criterion
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {customCriteria.map((criterion, index) => (
                        <Card key={criterion.id} className="bg-gray-50 dark:bg-gray-900">
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Criterion Name *</Label>
                                  <Input
                                    value={criterion.name}
                                    onChange={(e) => {
                                      const updated = [...customCriteria]
                                      updated[index].name = e.target.value
                                      setCustomCriteria(updated)
                                    }}
                                    placeholder="e.g., Impact, Risk, Urgency"
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Definition *</Label>
                                  <Input
                                    value={criterion.definition}
                                    onChange={(e) => {
                                      const updated = [...customCriteria]
                                      updated[index].definition = e.target.value
                                      setCustomCriteria(updated)
                                    }}
                                    placeholder="How would you define this criterion?"
                                    className="h-9"
                                  />
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (customCriteria.length > 1) {
                                    setCustomCriteria(customCriteria.filter((_, i) => i !== index))
                                  }
                                }}
                                disabled={customCriteria.length <= 1}
                                className="text-red-600 mt-6"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-900 dark:text-green-100">
                        <strong>Note:</strong> Composite Score = Sum of all criteria scores (1-5 scale per criterion)
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Evidence Linker Modal */}
        <EvidenceLinker
          open={evidenceLinkerOpen}
          onClose={() => {
            setEvidenceLinkerOpen(false)
            setActiveEvidenceTarget(null)
          }}
          onLink={handleEvidenceLink}
          alreadyLinked={[]}
        />
      </div>
    </TooltipProvider>
  )
}
