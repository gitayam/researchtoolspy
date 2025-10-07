import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Save, Plus, X, ExternalLink, Link2, Trash2, HelpCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { COGQuickScore } from './COGQuickScore'
import { AICOGAssistant } from '@/components/ai/AICOGAssistant'
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

export function COGForm({ initialData, mode, onSave, backPath, frameworkId }: COGFormProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('cog')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('context')

  // Translated data structures
  const ACTOR_CATEGORIES: { value: ActorCategory; label: string }[] = [
    { value: 'friendly', label: t('actorCategories.friendly') },
    { value: 'adversary', label: t('actorCategories.adversary') },
    { value: 'host_nation', label: t('actorCategories.hostNation') },
    { value: 'third_party', label: t('actorCategories.thirdParty') },
  ]

  const DIMEFIL_DOMAINS: { value: DIMEFILDomain; label: string; icon: string }[] = [
    { value: 'diplomatic', label: t('domains.diplomatic'), icon: '🤝' },
    { value: 'information', label: t('domains.information'), icon: '📡' },
    { value: 'military', label: t('domains.military'), icon: '🎖️' },
    { value: 'economic', label: t('domains.economic'), icon: '💰' },
    { value: 'financial', label: t('domains.financial'), icon: '💵' },
    { value: 'intelligence', label: t('domains.intelligence'), icon: '🔍' },
    { value: 'law_enforcement', label: t('domains.lawEnforcement'), icon: '👮' },
    { value: 'cyber', label: t('domains.cyber'), icon: '💻' },
    { value: 'space', label: t('domains.space'), icon: '🛰️' },
  ]

  const REQUIREMENT_TYPES = [
    { value: 'personnel', label: t('form.requirementTypes.personnel') },
    { value: 'equipment', label: t('form.requirementTypes.equipment') },
    { value: 'logistics', label: t('form.requirementTypes.logistics') },
    { value: 'information', label: t('form.requirementTypes.information') },
    { value: 'infrastructure', label: t('form.requirementTypes.infrastructure') },
    { value: 'other', label: t('form.requirementTypes.other') },
  ] as const

  const VULNERABILITY_TYPES = [
    { value: 'physical', label: t('form.vulnerabilityTypes.physical') },
    { value: 'cyber', label: t('form.vulnerabilityTypes.cyber') },
    { value: 'human', label: t('form.vulnerabilityTypes.human') },
    { value: 'logistical', label: t('form.vulnerabilityTypes.logistical') },
    { value: 'informational', label: t('form.vulnerabilityTypes.informational') },
    { value: 'other', label: t('form.vulnerabilityTypes.other') },
  ] as const

  const STRATEGIC_LEVELS = [
    { value: 'tactical', label: t('form.strategicLevels.tactical') },
    { value: 'operational', label: t('form.strategicLevels.operational') },
    { value: 'strategic', label: t('form.strategicLevels.strategic') },
  ] as const

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
  const [quickScoreOpen, setQuickScoreOpen] = useState(false)
  const [activeEvidenceTarget, setActiveEvidenceTarget] = useState<{
    type: 'cog' | 'capability' | 'requirement' | 'vulnerability'
    id: string
  } | null>(null)

  const handleSave = async () => {
    if (!title.trim()) {
      alert(t('form.validation.titleRequired'))
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
      alert(t('form.validation.saveFailed'))
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
    if (!confirm(t('form.confirmations.removeCOG'))) return
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
    if (!confirm(t('form.confirmations.removeCapability'))) return
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
    if (!confirm(t('form.confirmations.removeRequirement'))) return
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
    if (!confirm(t('form.confirmations.removeVulnerability'))) return
    setVulnerabilities(vulnerabilities.filter(vuln => vuln.id !== id))
  }

  // AI Handler Functions
  const handleAICOGsSuggestions = (cogSuggestions: Array<{ description: string; rationale: string; validation: string }>) => {
    const newCOGs: CenterOfGravity[] = cogSuggestions.map(suggestion => ({
      id: crypto.randomUUID(),
      actor_category: 'friendly',
      domain: 'military',
      description: suggestion.description,
      rationale: suggestion.rationale,
      validation_notes: suggestion.validation,
      linked_evidence: [],
    }))
    setCogs([...cogs, ...newCOGs])
    // Expand all new COGs
    setExpandedCogs(new Set([...expandedCogs, ...newCOGs.map(c => c.id)]))
  }

  const handleAICapabilities = (cogId: string, capSuggestions: Array<{ description: string; how_it_works: string; support_to_objectives: string }>) => {
    const newCaps: CriticalCapability[] = capSuggestions.map(suggestion => ({
      id: crypto.randomUUID(),
      cog_id: cogId,
      capability: suggestion.description,
      description: suggestion.how_it_works,
      strategic_contribution: suggestion.support_to_objectives,
      linked_evidence: [],
    }))
    setCapabilities([...capabilities, ...newCaps])
    // Expand all new capabilities
    setExpandedCaps(new Set([...expandedCaps, ...newCaps.map(c => c.id)]))
  }

  const handleAIRequirements = (capabilityId: string, reqSuggestions: Array<{ description: string; type: string; justification: string }>) => {
    const newReqs: CriticalRequirement[] = reqSuggestions.map(suggestion => ({
      id: crypto.randomUUID(),
      capability_id: capabilityId,
      requirement: suggestion.description,
      requirement_type: suggestion.type as any || 'other',
      description: suggestion.justification,
      linked_evidence: [],
    }))
    setRequirements([...requirements, ...newReqs])
    // Expand all new requirements
    setExpandedReqs(new Set([...expandedReqs, ...newReqs.map(r => r.id)]))
  }

  const handleAIVulnerabilities = (requirementId: string, vulnSuggestions: Array<{
    vulnerability: string
    type: string
    description: string
    exploitation_method: string
    expected_effect: string
    recommended_actions: string
  }>) => {
    const newVulns: CriticalVulnerability[] = vulnSuggestions.map(suggestion => ({
      id: crypto.randomUUID(),
      requirement_id: requirementId,
      vulnerability: suggestion.vulnerability,
      vulnerability_type: suggestion.type as any || 'other',
      description: suggestion.description,
      exploitation_method: suggestion.exploitation_method,
      expected_effect: suggestion.expected_effect,
      recommended_actions: suggestion.recommended_actions.split(',').map(a => a.trim()),
      confidence: 'medium',
      ...(scoringSystem === 'custom'
        ? {
            custom_scoring: customCriteria.reduce((acc, criterion) => ({ ...acc, [criterion.id]: 3 }), {}),
            composite_score: customCriteria.length * 3,
          }
        : {
            scoring: {
              impact_on_cog: 3,
              attainability: 3,
              follow_up_potential: 3,
            },
            composite_score: 9,
          }),
      linked_evidence: [],
    }))
    setVulnerabilities([...vulnerabilities, ...newVulns])
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
              {t('form.buttons.back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {mode === 'create' ? t('form.header.createTitle') : t('form.header.editTitle')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{t('form.header.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open('https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide', '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('form.buttons.referenceGuide')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('form.buttons.saving') : t('form.buttons.saveAnalysis')}
            </Button>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('form.basicInfo.title')}</CardTitle>
            <CardDescription>{t('form.basicInfo.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('form.basicInfo.titleLabel')}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('form.basicInfo.titlePlaceholder')} />
            </div>
            <div>
              <Label>{t('form.basicInfo.descriptionLabel')}</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('form.basicInfo.descriptionPlaceholder')} rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Tabs for organized workflow */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="context">{t('form.tabs.operationalContext')}</TabsTrigger>
            <TabsTrigger value="cogs">{t('form.tabs.cogAnalysis')}</TabsTrigger>
            <TabsTrigger value="scoring">{t('form.tabs.scoringSystem')}</TabsTrigger>
          </TabsList>

          {/* Operational Context Tab */}
          <TabsContent value="context" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('form.operationalContext.title')}</CardTitle>
                <CardDescription>{t('form.operationalContext.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>🎯 {t('form.operationalContext.objectiveLabel')}</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">{t('form.tooltips.objective.title')}</p>
                          <p className="text-sm">{t('form.tooltips.objective.examples')}</p>
                          <ul className="text-sm list-disc ml-4 mt-1">
                            <li>{t('form.tooltips.objective.example1')}</li>
                            <li>{t('form.tooltips.objective.example2')}</li>
                            <li>{t('form.tooltips.objective.example3')}</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    value={operationalContext.objective}
                    onChange={e => setOperationalContext({ ...operationalContext, objective: e.target.value })}
                    placeholder={t('form.operationalContext.objectivePlaceholder')}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>💥 {t('form.operationalContext.impactLabel')}</Label>
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
                    placeholder={t('form.operationalContext.impactPlaceholder')}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>👥 {t('form.operationalContext.identityLabel')}</Label>
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
                    placeholder={t('form.operationalContext.identityPlaceholder')}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>🌍 {t('form.operationalContext.environmentLabel')}</Label>
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
                    placeholder={t('form.operationalContext.environmentPlaceholder')}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>⛓️ {t('form.operationalContext.constraintsLabel')}</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Constraints are things you MUST do or CONDITIONS that limit action.</p>
                          <p className="text-sm">{t('form.tooltips.objective.examples')}</p>
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
                    placeholder={t('form.operationalContext.constraintsPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>🚫 {t('form.operationalContext.restraintsLabel')}</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="font-semibold mb-2">Restraints are things you MUST NOT do or PROHIBITED actions.</p>
                          <p className="text-sm">{t('form.tooltips.objective.examples')}</p>
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
                    placeholder={t('form.operationalContext.restraintsPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>⏱️ {t('form.operationalContext.timeframeLabel')}</Label>
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
                      placeholder={t('form.operationalContext.timeframePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>📊 {t('form.operationalContext.strategicLevelLabel')}</Label>
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
                        <SelectItem value="tactical">{STRATEGIC_LEVELS[0].label}</SelectItem>
                        <SelectItem value="operational">{STRATEGIC_LEVELS[1].label}</SelectItem>
                        <SelectItem value="strategic">{STRATEGIC_LEVELS[2].label}</SelectItem>
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
                    <CardTitle>{t('form.cog.title')}</CardTitle>
                    <CardDescription>{t('form.cog.description')}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {vulnerabilities.length > 0 && (
                      <Button variant="outline" onClick={() => setQuickScoreOpen(true)}>
                        <Zap className="h-4 w-4 mr-2" />
                        {t('form.buttons.quickScore')}
                      </Button>
                    )}
                    <AICOGAssistant
                      mode="suggest-cog"
                      context={{
                        objective: operationalContext.objective,
                        impactGoal: operationalContext.desired_impact,
                        friendlyForces: operationalContext.our_identity,
                        operatingEnvironment: operationalContext.operating_environment,
                      }}
                      onAccept={(suggestion: any) => {
                        const newCOG: CenterOfGravity = {
                          id: crypto.randomUUID(),
                          description: suggestion.description || '',
                          actor_category: suggestion.actor || 'Adversary',
                          domain: suggestion.domain || 'Military',
                          rationale: suggestion.rationale || '',
                          linked_evidence: [],
                        }
                        setCogs([...cogs, newCOG])
                      }}
                      buttonText="{t('form.buttons.suggestCOG')}"
                      buttonVariant="outline"
                    />
                    <Button onClick={addCOG}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('form.buttons.addCOG')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cogs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">{t('form.cog.emptyState')}</p>
                ) : (
                  cogs.map(cog => (
                    <Card key={cog.id} className="border-l-4 border-red-500">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          {/* COG Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs">{t('form.cog.actorCategoryLabel')}</Label>
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
                                <Label className="text-xs">{t('form.cog.domainLabel')}</Label>
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
                                  <Label className="text-sm">📝 {t('form.cog.descriptionLabel')}</Label>
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
                                  placeholder={t('form.cog.descriptionPlaceholder')}
                                  rows={2}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">🤔 {t('form.cog.rationaleLabel')}</Label>
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
                                  placeholder={t('form.cog.rationalePlaceholder')}
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
                                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer">✅ {t('form.cog.validationChecklist')}</p>
                                  {expandedSoWhat.has(`checklist-${cog.id}`) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                                {expandedSoWhat.has(`checklist-${cog.id}`) && (
                                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 mt-2">
                                    <li>☐ {t('form.cog.validationCheck1')}</li>
                                    <li>☐ {t('form.cog.validationCheck2')}</li>
                                    <li>☐ {t('form.cog.validationCheck3')}</li>
                                    <li>☐ {t('form.cog.validationCheck4')}</li>
                                  </ul>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs">{t('form.cog.linkedEvidenceLabel', { count: cog.linked_evidence.length })}</Label>
                                <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('cog', cog.id)} className="mt-1">
                                  <Link2 className="h-3 w-3 mr-2" />
                                  {t('form.buttons.linkEvidence')}
                                </Button>
                              </div>

                              {/* Capabilities for this COG */}
                              <div className="ml-6 space-y-3 border-l-2 border-blue-300 pl-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-semibold">⚡ {t('form.capabilities.title')}</Label>
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
                                  <div className="flex gap-2">
                                    <AICOGAssistant
                                      mode="generate-capabilities"
                                      context={{
                                        objective: operationalContext.objective,
                                        impactGoal: operationalContext.desired_impact,
                                        friendlyForces: operationalContext.our_identity,
                                        operatingEnvironment: operationalContext.operating_environment,
                                      }}
                                      cog={{
                                        description: cog.description,
                                        actor: cog.actor_category,
                                        domain: cog.domain,
                                        rationale: cog.rationale,
                                      }}
                                      onAccept={(generatedCapabilities: any[]) => {
                                        const newCapabilities = generatedCapabilities.map((cap: any) => ({
                                          id: crypto.randomUUID(),
                                          cog_id: cog.id,
                                          capability: cap.capability || '',
                                          description: cap.description || '',
                                          strategic_contribution: cap.strategic_contribution || '',
                                          linked_evidence: [],
                                        }))
                                        setCapabilities([...capabilities, ...newCapabilities])
                                      }}
                                      buttonText="{t('form.buttons.generateCapabilities')}"
                                      buttonVariant="outline"
                                      buttonSize="sm"
                                    />
                                    <Button variant="outline" size="sm" onClick={() => addCapability(cog.id)}>
                                      <Plus className="h-3 w-3 mr-1" />
                                      {t('form.buttons.addCapability')}
                                    </Button>
                                  </div>
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
                                              placeholder={t('form.capabilities.capabilityPlaceholder')}
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
                                                <Label className="text-xs">{t('form.capabilities.howItWorksLabel')}</Label>
                                                <Textarea
                                                  value={cap.description}
                                                  onChange={e => updateCapability(cap.id, { description: e.target.value })}
                                                  placeholder={t('form.capabilities.howItWorksPlaceholder')}
                                                  rows={2}
                                                  className="text-sm"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-xs">{t('form.capabilities.strategicContributionLabel')}</Label>
                                                <Textarea
                                                  value={cap.strategic_contribution}
                                                  onChange={e => updateCapability(cap.id, { strategic_contribution: e.target.value })}
                                                  placeholder={t('form.capabilities.strategicContributionPlaceholder')}
                                                  rows={2}
                                                  className="text-sm"
                                                />
                                              </div>
                                              <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('capability', cap.id)}>
                                                <Link2 className="h-3 w-3 mr-2" />
                                                {t('form.cog.linkedEvidenceLabel', { count: cap.linked_evidence.length })}
                                              </Button>

                                              {/* Requirements for this Capability */}
                                              <div className="ml-4 space-y-2 border-l-2 border-yellow-300 pl-3">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <Label className="text-xs font-semibold">📋 {t('form.requirements.title')}</Label>
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
                                                  <div className="flex gap-2">
                                                    <AICOGAssistant
                                                      mode="generate-requirements"
                                                      context={{
                                                        objective: operationalContext.objective,
                                                        impactGoal: operationalContext.desired_impact,
                                                        friendlyForces: operationalContext.our_identity,
                                                        operatingEnvironment: operationalContext.operating_environment,
                                                      }}
                                                      cog={{
                                                        description: cog.description,
                                                        actor: cog.actor_category,
                                                        domain: cog.domain,
                                                        rationale: cog.rationale,
                                                      }}
                                                      capability={{
                                                        capability: cap.capability,
                                                        description: cap.description,
                                                      }}
                                                      onAccept={(generatedRequirements: any[]) => {
                                                        const newRequirements = generatedRequirements.map((req: any) => ({
                                                          id: crypto.randomUUID(),
                                                          capability_id: cap.id,
                                                          requirement: req.requirement || '',
                                                          requirement_type: req.type || 'other',
                                                          description: req.description || '',
                                                          linked_evidence: [],
                                                        }))
                                                        setRequirements([...requirements, ...newRequirements])
                                                      }}
                                                      buttonText="{t('form.buttons.generateCapabilities')}"
                                                      buttonVariant="outline"
                                                      buttonSize="sm"
                                                    />
                                                    <Button variant="outline" size="sm" onClick={() => addRequirement(cap.id)}>
                                                      <Plus className="h-3 w-3 mr-1" />
                                                      {t('form.buttons.addRequirement')}
                                                    </Button>
                                                  </div>
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
                                                              placeholder={t('form.requirements.requirementPlaceholder')}
                                                              className="flex-1 h-8 text-sm"
                                                            />
                                                            <Select value={req.requirement_type} onValueChange={(v: any) => updateRequirement(req.id, { requirement_type: v })}>
                                                              <SelectTrigger className="w-32 h-8 text-xs">
                                                                <SelectValue />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                {REQUIREMENT_TYPES.map(item => (
                                                                  <SelectItem key={item.value} value={item.value}>
                                                                    {item.label}
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
                                                                <Label className="text-xs">{t('form.requirements.descriptionLabel')}</Label>
                                                                <Textarea
                                                                  value={req.description}
                                                                  onChange={e => updateRequirement(req.id, { description: e.target.value })}
                                                                  placeholder={t('form.requirements.descriptionPlaceholder')}
                                                                  rows={2}
                                                                  className="text-xs"
                                                                />
                                                              </div>
                                                              <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('requirement', req.id)}>
                                                                <Link2 className="h-3 w-3 mr-1" />
                                                                {t('form.cog.linkedEvidenceLabel', { count: req.linked_evidence.length })}
                                                              </Button>

                                                              {/* Vulnerabilities for this Requirement */}
                                                              <div className="ml-3 space-y-2 border-l-2 border-orange-300 pl-2">
                                                                <div className="flex items-center justify-between">
                                                                  <div className="flex items-center gap-2">
                                                                    <Label className="text-xs font-semibold">⚠️ {t('form.vulnerabilities.title')}</Label>
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
                                                                  <div className="flex gap-2">
                                                                    <AICOGAssistant
                                                                      mode="generate-vulnerabilities"
                                                                      context={{
                                                                        objective: operationalContext.objective,
                                                                        impactGoal: operationalContext.desired_impact,
                                                                        friendlyForces: operationalContext.our_identity,
                                                                        operatingEnvironment: operationalContext.operating_environment,
                                                                      }}
                                                                      cog={{
                                                                        description: cog.description,
                                                                        actor: cog.actor_category,
                                                                        domain: cog.domain,
                                                                        rationale: cog.rationale,
                                                                      }}
                                                                      capability={{
                                                                        capability: cap.capability,
                                                                        description: cap.description,
                                                                      }}
                                                                      requirement={{
                                                                        requirement: req.requirement,
                                                                        type: req.requirement_type,
                                                                      }}
                                                                      onAccept={(generatedVulnerabilities: any[]) => {
                                                                        const newVulnerabilities = generatedVulnerabilities.map((vuln: any) => ({
                                                                          id: crypto.randomUUID(),
                                                                          requirement_id: req.id,
                                                                          vulnerability: vuln.vulnerability || '',
                                                                          vulnerability_type: vuln.type || 'other',
                                                                          description: vuln.description || '',
                                                                          feasibility_score: vuln.feasibility || 3,
                                                                          impact_score: vuln.impact || 3,
                                                                          composite_score: ((vuln.feasibility || 3) * (vuln.impact || 3)),
                                                                          linked_evidence: [],
                                                                        }))
                                                                        setVulnerabilities([...vulnerabilities, ...newVulnerabilities])
                                                                      }}
                                                                      buttonText="{t('form.buttons.generateCapabilities')}"
                                                                      buttonVariant="outline"
                                                                      buttonSize="sm"
                                                                    />
                                                                    <Button variant="outline" size="sm" onClick={() => addVulnerability(req.id)}>
                                                                      <Plus className="h-3 w-3 mr-1" />
                                                                      {t('form.buttons.addVulnerability')}
                                                                    </Button>
                                                                  </div>
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
                                                                              placeholder={t('form.vulnerabilities.vulnerabilityPlaceholder')}
                                                                              className="flex-1 h-8 text-xs"
                                                                            />
                                                                            <Select value={vuln.vulnerability_type} onValueChange={(v: any) => updateVulnerability(vuln.id, { vulnerability_type: v })}>
                                                                              <SelectTrigger className="w-28 h-8 text-xs">
                                                                                <SelectValue />
                                                                              </SelectTrigger>
                                                                              <SelectContent>
                                                                                {VULNERABILITY_TYPES.map(item => (
                                                                                  <SelectItem key={item.value} value={item.value}>
                                                                                    {item.label}
                                                                                  </SelectItem>
                                                                                ))}
                                                                              </SelectContent>
                                                                            </Select>
                                                                            <Button variant="ghost" size="sm" onClick={() => removeVulnerability(vuln.id)} className="text-red-600">
                                                                              <X className="h-3 w-3" />
                                                                            </Button>
                                                                          </div>

                                                                          <div className="space-y-1">
                                                                            <Label className="text-xs">{t('form.vulnerabilities.descriptionLabel')}</Label>
                                                                            <Textarea
                                                                              value={vuln.description}
                                                                              onChange={e => updateVulnerability(vuln.id, { description: e.target.value })}
                                                                              placeholder={t('form.vulnerabilities.descriptionPlaceholder')}
                                                                              rows={2}
                                                                              className="text-xs"
                                                                            />
                                                                          </div>

                                                                          {/* Scoring Interface */}
                                                                          <div className="space-y-2 bg-white dark:bg-gray-900 p-2 rounded">
                                                                            <Label className="text-xs font-semibold">{t('form.vulnerabilities.scoringLabel', { score: vuln.composite_score })}</Label>

                                                                            {/* Default Scoring (Linear/Logarithmic) */}
                                                                            {scoringSystem !== 'custom' && vuln.scoring && (
                                                                              <>
                                                                                {/* Impact on COG */}
                                                                                <div>
                                                                                  <div className="flex items-center justify-between">
                                                                                    <Label className="text-xs">{t('form.vulnerabilities.impactLabel')}</Label>
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
                                                                                    <Label className="text-xs">{t('form.vulnerabilities.attainabilityLabel')}</Label>
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
                                                                                    <Label className="text-xs">{t('form.vulnerabilities.followUpLabel')}</Label>
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
                                                                                        value={[vuln.custom_scoring?.[criterion.id] || 1]}
                                                                                        onValueChange={([v]) =>
                                                                                          updateVulnerability(vuln.id, {
                                                                                            custom_scoring: { ...vuln.custom_scoring, [criterion.id]: v as any },
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
                                                                                💡 {t('form.vulnerabilities.soWhatTitle')}
                                                                              </Label>
                                                                              {expandedSoWhat.has(vuln.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                            </div>

                                                                            {expandedSoWhat.has(vuln.id) && (
                                                                              <div className="mt-3 space-y-2">
                                                                                <div className="space-y-1">
                                                                                  <Label className="text-xs">{t('form.vulnerabilities.expectedEffectLabel')}</Label>
                                                                                  <Textarea
                                                                                    value={vuln.expected_effect || ''}
                                                                                    onChange={e => updateVulnerability(vuln.id, { expected_effect: e.target.value })}
                                                                                    placeholder={t('form.vulnerabilities.expectedEffectPlaceholder')}
                                                                                    rows={2}
                                                                                    className="text-xs"
                                                                                  />
                                                                                </div>

                                                                                <div className="space-y-1">
                                                                                  <Label className="text-xs">{t('form.vulnerabilities.recommendedActionsLabel')}</Label>
                                                                                  <Input
                                                                                    value={(vuln.recommended_actions || []).join(', ')}
                                                                                    onChange={e => updateVulnerability(vuln.id, {
                                                                                      recommended_actions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                                                    })}
                                                                                    placeholder={t('form.vulnerabilities.recommendedActionsPlaceholder')}
                                                                                    className="text-xs"
                                                                                  />
                                                                                </div>

                                                                                <div className="space-y-1">
                                                                                  <Label className="text-xs">{t('form.vulnerabilities.confidenceLabel')}</Label>
                                                                                  <Select
                                                                                    value={vuln.confidence || 'medium'}
                                                                                    onValueChange={(v: 'low' | 'medium' | 'high' | 'confirmed') => updateVulnerability(vuln.id, { confidence: v })}
                                                                                  >
                                                                                    <SelectTrigger className="h-8 text-xs">
                                                                                      <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                      <SelectItem value="low">{t('form.vulnerabilities.confidenceLow')}</SelectItem>
                                                                                      <SelectItem value="medium">{t('form.vulnerabilities.confidenceMedium')}</SelectItem>
                                                                                      <SelectItem value="high">{t('form.vulnerabilities.confidenceHigh')}</SelectItem>
                                                                                      <SelectItem value="confirmed">{t('form.vulnerabilities.confidenceConfirmed')}</SelectItem>
                                                                                    </SelectContent>
                                                                                  </Select>
                                                                                </div>
                                                                              </div>
                                                                            )}
                                                                          </div>

                                                                          <Button variant="outline" size="sm" onClick={() => openEvidenceLinker('vulnerability', vuln.id)}>
                                                                            <Link2 className="h-3 w-3 mr-1" />
                                                                            {t('form.cog.linkedEvidenceLabel', { count: vuln.linked_evidence.length })}
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
                <CardTitle>{t('form.scoring.title')}</CardTitle>
                <CardDescription>{t('form.scoring.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'linear' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('linear')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">{t('form.scoring.linearTitle')}</h3>
                      <p className="text-xs text-gray-600 mb-4">{t('form.scoring.linearDescription')}</p>
                      <div className="flex justify-between text-xs">
                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'logarithmic' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('logarithmic')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">{t('form.scoring.logarithmicTitle')}</h3>
                      <p className="text-xs text-gray-600 mb-4">{t('form.scoring.logarithmicDescription')}</p>
                      <div className="flex justify-between text-xs">
                        <span>1</span><span>3</span><span>5</span><span>8</span><span>12</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-all ${scoringSystem === 'custom' ? 'border-blue-500 border-2' : ''}`} onClick={() => setScoringSystem('custom')}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-2">{t('form.scoring.customTitle')}</h3>
                      <p className="text-xs text-gray-600 mb-4">{t('form.scoring.customDescription')}</p>
                      <div className="text-xs text-center text-gray-500">{t('form.scoring.customCriteriaRange')}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Default Criteria Info */}
                {(scoringSystem === 'linear' || scoringSystem === 'logarithmic') && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">{t('form.scoring.defaultCriteriaTitle')}</h4>
                    <ul className="space-y-2 text-sm">
                      <li><strong>{t('form.scoring.impactCriterion')}</strong></li>
                      <li><strong>{t('form.scoring.attainabilityCriterion')}</strong></li>
                      <li><strong>{t('form.scoring.followUpCriterion')}</strong></li>
                      <li className="pt-2 border-t"><strong>{t('form.scoring.compositeFormula')}</strong></li>
                    </ul>
                  </div>
                )}

                {/* Custom Criteria Configuration */}
                {scoringSystem === 'custom' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{t('form.scoring.customCriteriaTitle')}</h4>
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
                          {t('form.buttons.addCriterion')}
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
                                  <Label className="text-xs">{t('form.scoring.criterionNameLabel')}</Label>
                                  <Input
                                    value={criterion.name}
                                    onChange={(e) => {
                                      const updated = [...customCriteria]
                                      updated[index].name = e.target.value
                                      setCustomCriteria(updated)
                                    }}
                                    placeholder={t('form.scoring.criterionNamePlaceholder')}
                                    className="h-9"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{t('form.scoring.criterionDefinitionLabel')}</Label>
                                  <Input
                                    value={criterion.definition}
                                    onChange={(e) => {
                                      const updated = [...customCriteria]
                                      updated[index].definition = e.target.value
                                      setCustomCriteria(updated)
                                    }}
                                    placeholder={t('form.scoring.criterionDefinitionPlaceholder')}
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
                        <strong>{t('form.scoring.customCompositeNote')}</strong>
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

        {/* {t('form.buttons.quickScore')} Modal */}
        <COGQuickScore
          open={quickScoreOpen}
          onClose={() => setQuickScoreOpen(false)}
          vulnerabilities={vulnerabilities}
          onUpdate={(updated) => setVulnerabilities(updated)}
          scoringSystem={scoringSystem}
        />
      </div>
    </TooltipProvider>
  )
}
