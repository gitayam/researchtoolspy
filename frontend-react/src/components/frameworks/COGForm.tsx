import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, ExternalLink, AlertCircle, Link2, Trash2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EvidenceLinker, type LinkedEvidence } from '@/components/evidence'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  Score,
  LinearScore,
  LogarithmicScore,
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

const REQUIREMENT_TYPES = [
  'personnel', 'equipment', 'logistics', 'information', 'infrastructure', 'other'
] as const

const VULNERABILITY_TYPES = [
  'physical', 'cyber', 'human', 'logistical', 'informational', 'other'
] as const

export function COGForm({
  initialData,
  mode,
  onSave,
  backPath,
  frameworkId
}: COGFormProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

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
  const [scoringSystem, setScoringSystem] = useState<ScoringSystem>(
    initialData?.scoring_system || 'linear'
  )

  // COG Data
  const [cogs, setCogs] = useState<CenterOfGravity[]>(initialData?.centers_of_gravity || [])
  const [capabilities, setCapabilities] = useState<CriticalCapability[]>(initialData?.critical_capabilities || [])
  const [requirements, setRequirements] = useState<CriticalRequirement[]>(initialData?.critical_requirements || [])
  const [vulnerabilities, setVulnerabilities] = useState<CriticalVulnerability[]>(initialData?.critical_vulnerabilities || [])

  // Evidence linking
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
        created_by: initialData?.created_by || 1, // TODO: Get from auth
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
  }

  const updateCOG = (id: string, updates: Partial<CenterOfGravity>) => {
    setCogs(cogs.map(cog => cog.id === id ? { ...cog, ...updates } : cog))
  }

  const removeCOG = (id: string) => {
    setCogs(cogs.filter(cog => cog.id !== id))
    // Remove dependent capabilities
    const capIds = capabilities.filter(cap => cap.cog_id === id).map(cap => cap.id)
    setCapabilities(capabilities.filter(cap => cap.cog_id !== id))
    // Remove dependent requirements
    const reqIds = requirements.filter(req => capIds.includes(req.capability_id)).map(req => req.id)
    setRequirements(requirements.filter(req => !capIds.includes(req.capability_id)))
    // Remove dependent vulnerabilities
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
  }

  const updateCapability = (id: string, updates: Partial<CriticalCapability>) => {
    setCapabilities(capabilities.map(cap => cap.id === id ? { ...cap, ...updates } : cap))
  }

  const removeCapability = (id: string) => {
    setCapabilities(capabilities.filter(cap => cap.id !== id))
    // Remove dependent requirements
    const reqIds = requirements.filter(req => req.capability_id === id).map(req => req.id)
    setRequirements(requirements.filter(req => req.capability_id !== id))
    // Remove dependent vulnerabilities
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
  }

  const updateRequirement = (id: string, updates: Partial<CriticalRequirement>) => {
    setRequirements(requirements.map(req => req.id === id ? { ...req, ...updates } : req))
  }

  const removeRequirement = (id: string) => {
    setRequirements(requirements.filter(req => req.id !== id))
    // Remove dependent vulnerabilities
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
        impact_on_cog: 1,
        attainability: 1,
        follow_up_potential: 1,
      },
      composite_score: 3,
      linked_evidence: [],
    }
    setVulnerabilities([...vulnerabilities, newVuln])
  }

  const updateVulnerability = (id: string, updates: Partial<CriticalVulnerability>) => {
    setVulnerabilities(vulnerabilities.map(vuln => {
      if (vuln.id === id) {
        const updated = { ...vuln, ...updates }
        if (updates.scoring) {
          updated.composite_score = calculateCompositeScore(updated.scoring)
        }
        return updated
      }
      return vuln
    }))
  }

  const removeVulnerability = (id: string) => {
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
          linked_evidence: [...cogs.find(c => c.id === activeEvidenceTarget.id)?.linked_evidence || [], ...evidenceIds]
        })
        break
      case 'capability':
        updateCapability(activeEvidenceTarget.id, {
          linked_evidence: [...capabilities.find(c => c.id === activeEvidenceTarget.id)?.linked_evidence || [], ...evidenceIds]
        })
        break
      case 'requirement':
        updateRequirement(activeEvidenceTarget.id, {
          linked_evidence: [...requirements.find(r => r.id === activeEvidenceTarget.id)?.linked_evidence || [], ...evidenceIds]
        })
        break
      case 'vulnerability':
        updateVulnerability(activeEvidenceTarget.id, {
          linked_evidence: [...vulnerabilities.find(v => v.id === activeEvidenceTarget.id)?.linked_evidence || [], ...evidenceIds]
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
      return desc.linear[score as LinearScore] || ''
    } else {
      return desc.logarithmic[score as LogarithmicScore] || ''
    }
  }

  return (
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
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Center of Gravity Analysis (JP 3-0 Methodology)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open('https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Reference Guide
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Analysis'}
          </Button>
        </div>
      </div>

      {/* Continue in next part... */}
    </div>
  )
}
