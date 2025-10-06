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
  ScoringDescriptions,
  LinearScoreValues,
  LogarithmicScoreValues,
  calculateCompositeScore,
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

  // COG Data
  const [cogs, setCogs] = useState<CenterOfGravity[]>(initialData?.centers_of_gravity || [])
  const [capabilities, setCapabilities] = useState<CriticalCapability[]>(initialData?.critical_capabilities || [])
  const [requirements, setRequirements] = useState<CriticalRequirement[]>(initialData?.critical_requirements || [])
  const [vulnerabilities, setVulnerabilities] = useState<CriticalVulnerability[]>(initialData?.critical_vulnerabilities || [])

  // UI State
  const [expandedCogs, setExpandedCogs] = useState<Set<string>>(new Set())
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set())
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())
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
      scoring: {
        impact_on_cog: scoringSystem === 'linear' ? 1 : 1,
        attainability: scoringSystem === 'linear' ? 1 : 1,
        follow_up_potential: scoringSystem === 'linear' ? 1 : 1,
      },
      composite_score: 3,
      linked_evidence: [],
    }
    setVulnerabilities([...vulnerabilities, newVuln])
  }

  const updateVulnerability = (id: string, updates: Partial<CriticalVulnerability>) => {
    setVulnerabilities(
      vulnerabilities.map(vuln => {
        if (vuln.id === id) {
          const updated = { ...vuln, ...updates }
          if (updates.scoring) {
            updated.composite_score = calculateCompositeScore(updated.scoring)
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
    const evidenceIds = selected.map(e => e.entity_id)

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
              <CardContent className="space-y-4">
                <div>
                  <Label>Objective *</Label>
                  <Textarea
                    value={operationalContext.objective}
                    onChange={e => setOperationalContext({ ...operationalContext, objective: e.target.value })}
                    placeholder="What is the operational objective?"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Desired Impact</Label>
                  <Textarea
                    value={operationalContext.desired_impact}
                    onChange={e => setOperationalContext({ ...operationalContext, desired_impact: e.target.value })}
                    placeholder="What impact do we want to achieve?"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Our Identity</Label>
                  <Textarea
                    value={operationalContext.our_identity}
                    onChange={e => setOperationalContext({ ...operationalContext, our_identity: e.target.value })}
                    placeholder="Who are we? (friendly forces description)"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Operating Environment</Label>
                  <Textarea
                    value={operationalContext.operating_environment}
                    onChange={e => setOperationalContext({ ...operationalContext, operating_environment: e.target.value })}
                    placeholder="Where are we operating? (PMESII-PT context)"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Constraints (comma-separated)</Label>
                  <Input
                    value={operationalContext.constraints.join(', ')}
                    onChange={e => setOperationalContext({ ...operationalContext, constraints: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g., Legal limitations, Policy restrictions"
                  />
                </div>
                <div>
                  <Label>Restraints (comma-separated)</Label>
                  <Input
                    value={operationalContext.restraints.join(', ')}
                    onChange={e => setOperationalContext({ ...operationalContext, restraints: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g., Rules of engagement, Prohibited actions"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Timeframe</Label>
                    <Input
                      value={operationalContext.timeframe}
                      onChange={e => setOperationalContext({ ...operationalContext, timeframe: e.target.value })}
                      placeholder="e.g., 6 months, Q1 2025"
                    />
                  </div>
                  <div>
                    <Label>Strategic Level</Label>
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
                              <div>
                                <Label className="text-xs">Description *</Label>
                                <Textarea value={cog.description} onChange={e => updateCOG(cog.id, { description: e.target.value })} placeholder="Describe this COG..." rows={2} />
                              </div>
                              <div>
                                <Label className="text-xs">Rationale</Label>
                                <Textarea value={cog.rationale} onChange={e => updateCOG(cog.id, { rationale: e.target.value })} placeholder="Why is this a COG?" rows={2} />
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
                                  <Label className="text-sm font-semibold">⚡ Critical Capabilities</Label>
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
                                              placeholder="Capability (verb/action)..."
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
                                              <Textarea
                                                value={cap.description}
                                                onChange={e => updateCapability(cap.id, { description: e.target.value })}
                                                placeholder="Description..."
                                                rows={2}
                                                className="text-sm"
                                              />
                                              <Textarea
                                                value={cap.strategic_contribution}
                                                onChange={e => updateCapability(cap.id, { strategic_contribution: e.target.value })}
                                                placeholder="Strategic contribution..."
                                                rows={2}
                                                className="text-sm"
                                              />
                                              <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('capability', cap.id)}>
                                                <Link2 className="h-3 w-3 mr-2" />
                                                Evidence ({cap.linked_evidence.length})
                                              </Button>

                                              {/* Requirements for this Capability */}
                                              <div className="ml-4 space-y-2 border-l-2 border-yellow-300 pl-3">
                                                <div className="flex items-center justify-between">
                                                  <Label className="text-xs font-semibold">📋 Requirements</Label>
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
                                                              placeholder="Requirement (noun/resource)..."
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
                                                              <Textarea
                                                                value={req.description}
                                                                onChange={e => updateRequirement(req.id, { description: e.target.value })}
                                                                placeholder="Description..."
                                                                rows={2}
                                                                className="text-xs"
                                                              />
                                                              <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('requirement', req.id)}>
                                                                <Link2 className="h-3 w-3 mr-1" />
                                                                Evidence ({req.linked_evidence.length})
                                                              </Button>

                                                              {/* Vulnerabilities for this Requirement */}
                                                              <div className="ml-3 space-y-2 border-l-2 border-orange-300 pl-2">
                                                                <div className="flex items-center justify-between">
                                                                  <Label className="text-xs font-semibold">⚠️ Vulnerabilities</Label>
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
                                                                              placeholder="Vulnerability (weakness)..."
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

                                                                          <Textarea
                                                                            value={vuln.description}
                                                                            onChange={e => updateVulnerability(vuln.id, { description: e.target.value })}
                                                                            placeholder="Description..."
                                                                            rows={2}
                                                                            className="text-xs"
                                                                          />

                                                                          {/* Scoring Interface */}
                                                                          <div className="space-y-2 bg-white dark:bg-gray-900 p-2 rounded">
                                                                            <Label className="text-xs font-semibold">Scoring (Composite: {vuln.composite_score})</Label>

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
                <CardDescription>Select linear or logarithmic scoring for vulnerability assessment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'linear' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('linear')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">Linear Scale (1-5)</h3>
                      <p className="text-sm text-gray-600 mb-4">Equal intervals for straightforward assessment</p>
                      <div className="flex justify-between text-xs">
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                        <span>4</span>
                        <span>5</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'logarithmic' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('logarithmic')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">Logarithmic Scale (1,3,5,8,12)</h3>
                      <p className="text-sm text-gray-600 mb-4">Exponential scale for significant impact differences</p>
                      <div className="flex justify-between text-xs">
                        <span>1</span>
                        <span>3</span>
                        <span>5</span>
                        <span>8</span>
                        <span>12</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Scoring Criteria</h4>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <strong>Impact on COG (I):</strong> How significantly would exploiting this vulnerability affect the COG?
                    </li>
                    <li>
                      <strong>Attainability (A):</strong> How feasible is exploiting or mitigating this with available resources?
                    </li>
                    <li>
                      <strong>Follow-up Potential (F):</strong> What strategic advantages or additional actions does this enable?
                    </li>
                    <li className="pt-2 border-t">
                      <strong>Composite Score = I + A + F</strong> (used for prioritization)
                    </li>
                  </ul>
                </div>
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
