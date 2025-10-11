import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Check, AlertCircle, Lightbulb, FileEdit, Network } from 'lucide-react'
import { AICOGAssistant } from '@/components/ai/AICOGAssistant'
import { ActorPicker } from '@/components/content-intelligence/ActorPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  COGAnalysis,
  OperationalContext,
  CenterOfGravity,
  CriticalCapability,
  CriticalRequirement,
  CriticalVulnerability,
  ActorCategory,
  DIMEFILDomain,
  ScoringSystem,
} from '@/types/cog-analysis'

interface COGWizardProps {
  initialData?: Partial<COGAnalysis>
  onSave: (data: COGAnalysis) => Promise<void>
  backPath: string
}

export function COGWizard({ initialData, onSave, backPath }: COGWizardProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('cog')

  const STEPS = [
    { id: 1, name: t('wizard.steps.context.name'), description: t('wizard.steps.context.description') },
    { id: 2, name: t('wizard.steps.cog.name'), description: t('wizard.steps.cog.description') },
    { id: 3, name: t('wizard.steps.capabilities.name'), description: t('wizard.steps.capabilities.description') },
    { id: 4, name: t('wizard.steps.requirements.name'), description: t('wizard.steps.requirements.description') },
    { id: 5, name: t('wizard.steps.vulnerabilities.name'), description: t('wizard.steps.vulnerabilities.description') },
    { id: 6, name: t('wizard.steps.review.name'), description: t('wizard.steps.review.description') },
  ]

  // Entity generation state
  const [generatingEntities, setGeneratingEntities] = useState(false)
  const [entitiesGenerated, setEntitiesGenerated] = useState(false)
  const [savedFrameworkId, setSavedFrameworkId] = useState<string | number | null>(initialData?.id || null)

  const ACTOR_CATEGORIES: { value: ActorCategory; label: string }[] = [
    { value: 'friendly', label: t('actorCategories.friendly') },
    { value: 'adversary', label: t('actorCategories.adversary') },
    { value: 'host_nation', label: t('actorCategories.hostNation') },
    { value: 'third_party', label: t('actorCategories.thirdParty') },
  ]

  const DIMEFIL_DOMAINS: { value: DIMEFILDomain; label: string }[] = [
    { value: 'diplomatic', label: t('domains.diplomatic') },
    { value: 'information', label: t('domains.information') },
    { value: 'military', label: t('domains.military') },
    { value: 'economic', label: t('domains.economic') },
    { value: 'financial', label: t('domains.financial') },
    { value: 'intelligence', label: t('domains.intelligence') },
    { value: 'law_enforcement', label: t('domains.lawEnforcement') },
    { value: 'cyber', label: t('domains.cyber') },
    { value: 'space', label: t('domains.space') },
  ]
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Form data
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
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

  // COG data
  const [cogActor, setCogActor] = useState<ActorCategory>('adversary')
  const [cogActorLink, setCogActorLink] = useState<{ actor_id: string; actor_name: string } | null>(null)
  const [cogDomain, setCogDomain] = useState<DIMEFILDomain>('military')
  const [cogDescription, setCogDescription] = useState('')
  const [cogRationale, setCogRationale] = useState('')
  const [cogValidation, setCogValidation] = useState({
    criticallyDegrades: false,
    sourceOfPower: false,
    rightLevel: false,
    canBeExploited: false,
  })

  // Capabilities (simplified for wizard)
  const [capabilities, setCapabilities] = useState<Array<{ id: string; capability: string; description: string }>>([
    { id: crypto.randomUUID(), capability: '', description: '' },
  ])

  // Requirements (simplified) - NOW WITH CAPABILITY LINK
  const [requirements, setRequirements] = useState<Array<{ id: string; requirement: string; type: string; capability_id: string }>>([
    { id: crypto.randomUUID(), requirement: '', type: 'other', capability_id: '' },
  ])

  // Vulnerabilities (simplified) - NOW WITH REQUIREMENT LINKS (MULTIPLE)
  const [vulnerabilities, setVulnerabilities] = useState<
    Array<{
      id: string
      vulnerability: string
      description: string
      type: string
      expectedEffect: string
      recommendedActions: string
      requirement_ids: string[]
    }>
  >([{ id: crypto.randomUUID(), vulnerability: '', description: '', type: 'other', expectedEffect: '', recommendedActions: '', requirement_ids: [] }])

  const [scoringSystem, setScoringSystem] = useState<ScoringSystem>('linear')

  const progress = (currentStep / STEPS.length) * 100

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!(
          title &&
          operationalContext.objective &&
          operationalContext.desired_impact &&
          operationalContext.our_identity
        )
      case 2:
        return !!(
          cogDescription &&
          cogRationale &&
          cogValidation.criticallyDegrades &&
          cogValidation.sourceOfPower
        )
      case 3:
        return capabilities.some((c) => c.capability && c.description)
      case 4:
        return requirements.some((r) => r.requirement)
      case 5:
        return vulnerabilities.some((v) => v.vulnerability && v.description)
      case 6:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleGenerateEntities = async () => {
    if (!savedFrameworkId) {
      alert('❌ Please save the COG analysis first before generating entities.')
      return
    }

    if (entitiesGenerated) {
      if (!confirm('Entities have already been generated. Generate again? This will create duplicate entities.')) {
        return
      }
    }

    setGeneratingEntities(true)
    try {
      const response = await fetch(`/api/frameworks/${savedFrameworkId}/generate-entities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Entity generation failed')
      }

      const result = await response.json()
      setEntitiesGenerated(true)

      const message = `✅ Successfully generated ${result.summary.actors} actors, ${result.summary.behaviors} behaviors, and ${result.summary.relationships} relationships!\n\nView them in the Network Graph.`

      if (confirm(message + '\n\nGo to Network Graph now?')) {
        navigate('/network')
      }
    } catch (error) {
      console.error('Failed to generate entities:', error)
      alert(`❌ Entity generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGeneratingEntities(false)
    }
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      // Build COG analysis from wizard data (allowing partial data for drafts)
      const cogId = crypto.randomUUID()
      const capId = crypto.randomUUID()
      const reqId = crypto.randomUUID()

      // Only create COG if we have at least description
      const cogs: CenterOfGravity[] = cogDescription ? [{
        id: cogId,
        actor_category: cogActor || 'adversary',
        actor_name: cogActorLink?.actor_name,
        actor_id: cogActorLink?.actor_id,
        domain: cogDomain || 'military',
        description: cogDescription,
        rationale: cogRationale || '',
        validated: Object.values(cogValidation).every((v) => v),
        confidence: Object.values(cogValidation).every((v) => v) ? 'high' : 'medium',
        priority: 1,
        linked_evidence: [],
      }] : []

      const caps: CriticalCapability[] = capabilities
        .filter((c) => c.capability)
        .map((c, i) => ({
          id: c.id || (i === 0 ? capId : crypto.randomUUID()),
          cog_id: cogId,
          capability: c.capability,
          description: c.description || '',
          strategic_contribution: c.description || '',
          linked_evidence: [],
        }))

      const reqs: CriticalRequirement[] = requirements
        .filter((r) => r.requirement && r.capability_id)
        .map((r, i) => ({
          id: r.id || (i === 0 ? reqId : crypto.randomUUID()),
          capability_id: r.capability_id,
          requirement: r.requirement,
          requirement_type: r.type as any,
          description: r.requirement,
          linked_evidence: [],
        }))

      const vulns: CriticalVulnerability[] = vulnerabilities
        .filter((v) => v.vulnerability && v.requirement_ids.length > 0)
        .flatMap((v) =>
          v.requirement_ids.map((reqId) => ({
            id: crypto.randomUUID(),
            requirement_id: reqId,
            vulnerability: v.vulnerability,
            vulnerability_type: v.type as any,
            description: v.description || '',
            expected_effect: v.expectedEffect || '',
            recommended_actions: v.recommendedActions ? v.recommendedActions.split(',').map((a) => a.trim()) : [],
            confidence: 'medium' as const,
            scoring: {
              impact_on_cog: 3,
              attainability: 3,
              follow_up_potential: 3,
            },
            composite_score: 9,
            linked_evidence: [],
          }))
        )

      const analysis: COGAnalysis = {
        id: initialData?.id || crypto.randomUUID(),
        title: title || `Draft - ${new Date().toLocaleDateString()}`,
        description: description || '',
        operational_context: operationalContext,
        scoring_system: scoringSystem,
        centers_of_gravity: cogs,
        critical_capabilities: caps,
        critical_requirements: reqs,
        critical_vulnerabilities: vulns,
        created_at: initialData?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: initialData?.created_by || 1,
        status: 'draft', // Mark as draft instead of active
      }

      await onSave(analysis)
      setSavedFrameworkId(analysis.id) // Store the framework ID for entity generation
      // Don't navigate away after saving draft - stay in wizard
      alert('✅ Draft saved successfully! You can continue working or come back later.')
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('❌ Failed to save draft. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build COG analysis from wizard data
      const cogId = crypto.randomUUID()
      const capId = crypto.randomUUID()
      const reqId = crypto.randomUUID()

      const cog: CenterOfGravity = {
        id: cogId,
        actor_category: cogActor,
        domain: cogDomain,
        description: cogDescription,
        rationale: cogRationale,
        validated: Object.values(cogValidation).every((v) => v),
        confidence: Object.values(cogValidation).every((v) => v) ? 'high' : 'medium',
        priority: 1,
        linked_evidence: [],
      }

      const caps: CriticalCapability[] = capabilities
        .filter((c) => c.capability)
        .map((c, i) => ({
          id: c.id || (i === 0 ? capId : crypto.randomUUID()),
          cog_id: cogId,
          capability: c.capability,
          description: c.description,
          strategic_contribution: c.description,
          linked_evidence: [],
        }))

      const reqs: CriticalRequirement[] = requirements
        .filter((r) => r.requirement && r.capability_id)
        .map((r, i) => ({
          id: r.id || (i === 0 ? reqId : crypto.randomUUID()),
          capability_id: r.capability_id, // ✅ Use selected capability
          requirement: r.requirement,
          requirement_type: r.type as any,
          description: r.requirement,
          linked_evidence: [],
        }))

      // ✅ Create a vulnerability for EACH selected requirement
      const vulns: CriticalVulnerability[] = vulnerabilities
        .filter((v) => v.vulnerability && v.requirement_ids.length > 0)
        .flatMap((v) =>
          v.requirement_ids.map((reqId) => ({
            id: crypto.randomUUID(),
            requirement_id: reqId, // ✅ Use each selected requirement
            vulnerability: v.vulnerability,
            vulnerability_type: v.type as any,
            description: v.description,
            expected_effect: v.expectedEffect,
            recommended_actions: v.recommendedActions ? v.recommendedActions.split(',').map((a) => a.trim()) : [],
            confidence: 'medium' as const,
            scoring: {
              impact_on_cog: 3,
              attainability: 3,
              follow_up_potential: 3,
            },
            composite_score: 9,
            linked_evidence: [],
          }))
        )

      const analysis: COGAnalysis = {
        id: initialData?.id || crypto.randomUUID(),
        title,
        description,
        operational_context: operationalContext,
        scoring_system: scoringSystem,
        centers_of_gravity: [cog],
        critical_capabilities: caps,
        critical_requirements: reqs,
        critical_vulnerabilities: vulns,
        created_at: initialData?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: initialData?.created_by || 1,
        status: 'active',
      }

      await onSave(analysis)
      setSavedFrameworkId(analysis.id) // Store the framework ID for entity generation
      navigate(backPath)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const switchToAdvancedMode = () => {
    if (confirm(t('wizard.navigation.switchToAdvanced'))) {
      // Build COG data from wizard state
      const cogId = crypto.randomUUID()
      const capId = crypto.randomUUID()
      const reqId = crypto.randomUUID()

      // Only include completed COG if step 2 is done
      const cog: CenterOfGravity | undefined = cogDescription && cogRationale ? {
        id: cogId,
        actor_category: cogActor,
        actor_name: cogActorLink?.actor_name,
        actor_id: cogActorLink?.actor_id,
        domain: cogDomain,
        description: cogDescription,
        rationale: cogRationale,
        validated: Object.values(cogValidation).every((v) => v),
        confidence: Object.values(cogValidation).every((v) => v) ? 'high' : 'medium',
        priority: 1,
        linked_evidence: [],
      } : undefined

      // Only include capabilities that have data
      const caps: CriticalCapability[] = capabilities
        .filter((c) => c.capability)
        .map((c, i) => ({
          id: c.id || (i === 0 ? capId : crypto.randomUUID()),
          cog_id: cog?.id || cogId,
          capability: c.capability,
          description: c.description,
          strategic_contribution: c.description,
          linked_evidence: [],
        }))

      // Only include requirements that have data
      const reqs: CriticalRequirement[] = requirements
        .filter((r) => r.requirement && r.capability_id)
        .map((r, i) => ({
          id: r.id || (i === 0 ? reqId : crypto.randomUUID()),
          capability_id: r.capability_id, // ✅ Use selected capability
          requirement: r.requirement,
          requirement_type: r.type as any,
          description: r.requirement,
          linked_evidence: [],
        }))

      // Only include vulnerabilities that have data - Create one for each requirement
      const vulns: CriticalVulnerability[] = vulnerabilities
        .filter((v) => v.vulnerability && v.requirement_ids.length > 0)
        .flatMap((v) =>
          v.requirement_ids.map((reqId) => ({
            id: crypto.randomUUID(),
            requirement_id: reqId, // ✅ Use each selected requirement
            vulnerability: v.vulnerability,
            vulnerability_type: v.type as any,
            description: v.description,
            expected_effect: v.expectedEffect,
            recommended_actions: v.recommendedActions ? v.recommendedActions.split(',').map((a) => a.trim()) : [],
            confidence: 'medium' as const,
            scoring: {
              impact_on_cog: 3,
              attainability: 3,
              follow_up_potential: 3,
            },
            composite_score: 9,
            linked_evidence: [],
          }))
        )

      // Build partial analysis with all completed data
      const wizardData = {
        title,
        description,
        operational_context: operationalContext,
        scoring_system: scoringSystem,
        centers_of_gravity: cog ? [cog] : [],
        critical_capabilities: caps,
        critical_requirements: reqs,
        critical_vulnerabilities: vulns,
      }

      // Navigate to form with wizard data
      navigate(`${backPath}/create`, {
        state: {
          wizardData,
        },
      })
    }
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('wizard.navigation.back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('wizard.title')}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('wizard.subtitle')}</p>
            </div>
          </div>
          <Button variant="outline" onClick={switchToAdvancedMode}>
            <FileEdit className="h-4 w-4 mr-2" />
            {t('wizard.buttons.advancedMode')}
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('wizard.navigation.stepOf', { current: currentStep, total: STEPS.length, name: STEPS[currentStep - 1].name })}
            </div>
            <div className="text-sm text-gray-500">{Math.round(progress)}% {t('wizard.progressComplete')}</div>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex-1 text-center ${
                  step.id === currentStep ? 'text-blue-600 dark:text-blue-400' : ''
                } ${step.id < currentStep ? 'text-green-600 dark:text-green-400' : ''} ${
                  step.id > currentStep ? 'text-gray-400' : ''
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  {step.id < currentStep ? (
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full ${
                        step.id === currentStep
                          ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-600'
                          : 'bg-gray-100 dark:bg-gray-700'
                      } flex items-center justify-center text-sm font-semibold`}
                    >
                      {step.id}
                    </div>
                  )}
                </div>
                <div className="text-xs hidden sm:block">{step.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].name}</CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Context Setting */}
            {currentStep === 1 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    {t('wizard.step1.alert')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label>{t('wizard.step1.titleRequired')}</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('wizard.step1.titlePlaceholder')} />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.descriptionLabel')}</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('wizard.step1.descriptionPlaceholder')}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.objectiveRequired')}</Label>
                    <Textarea
                      value={operationalContext.objective}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, objective: e.target.value })
                      }
                      placeholder={t('wizard.step1.objectivePlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.impactRequired')}</Label>
                    <Textarea
                      value={operationalContext.desired_impact}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, desired_impact: e.target.value })
                      }
                      placeholder={t('wizard.step1.impactPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.identityRequired')}</Label>
                    <Input
                      value={operationalContext.our_identity}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, our_identity: e.target.value })
                      }
                      placeholder={t('wizard.step1.identityPlaceholder')}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.environmentLabel')}</Label>
                    <Textarea
                      value={operationalContext.operating_environment}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, operating_environment: e.target.value })
                      }
                      placeholder={t('wizard.step1.environmentPlaceholder')}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.timeframeLabel')}</Label>
                    <Input
                      value={operationalContext.timeframe}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, timeframe: e.target.value })
                      }
                      placeholder={t('wizard.step1.timeframePlaceholder')}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step1.strategicLevelLabel')}</Label>
                    <Select
                      value={operationalContext.strategic_level}
                      onValueChange={(value: any) =>
                        setOperationalContext({ ...operationalContext, strategic_level: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tactical">{t('wizard.step1.strategicLevels.tactical')}</SelectItem>
                        <SelectItem value="operational">{t('wizard.step1.strategicLevels.operational')}</SelectItem>
                        <SelectItem value="strategic">{t('wizard.step1.strategicLevels.strategic')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: COG Identification */}
            {currentStep === 2 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    {t('wizard.step2.alert')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label>{t('wizard.step2.actorLabel')}</Label>
                    <Select value={cogActor} onValueChange={(value: ActorCategory) => setCogActor(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTOR_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <ActorPicker
                    value={cogActorLink}
                    onChange={setCogActorLink}
                    label="Link to Actor Entity (Optional)"
                    placeholder="Search for an actor in your database..."
                    helperText="Link this COG to a specific actor from your knowledge base to track credibility and enable cross-analysis pivoting."
                  />

                  <div>
                    <Label>{t('wizard.step2.domainLabel')}</Label>
                    <Select value={cogDomain} onValueChange={(value: DIMEFILDomain) => setCogDomain(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIMEFIL_DOMAINS.map((domain) => (
                          <SelectItem key={domain.value} value={domain.value}>
                            {domain.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('wizard.step2.descriptionRequired')}</Label>
                    <Textarea
                      value={cogDescription}
                      onChange={(e) => setCogDescription(e.target.value)}
                      placeholder={t('wizard.step2.descriptionPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>{t('wizard.step2.rationaleRequired')}</Label>
                    <Textarea
                      value={cogRationale}
                      onChange={(e) => setCogRationale(e.target.value)}
                      placeholder={t('wizard.step2.rationalePlaceholder')}
                      rows={4}
                    />
                  </div>

                  {/* AI Assistance Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <AICOGAssistant
                      mode="suggest-cog"
                      context={{
                        objective: operationalContext.objective,
                        impactGoal: operationalContext.desired_impact,
                        friendlyForces: operationalContext.our_identity,
                        operatingEnvironment: operationalContext.operating_environment,
                        constraints: operationalContext.constraints?.join(', '),
                        timeframe: operationalContext.timeframe,
                        strategicLevel: operationalContext.strategic_level,
                      }}
                      onAccept={(suggestion) => {
                        setCogDescription(suggestion.description)
                        setCogActor(suggestion.actor as ActorCategory)
                        setCogDomain(suggestion.domain as DIMEFILDomain)
                        setCogRationale(suggestion.rationale)
                      }}
                      buttonText={t('wizard.step2.suggestCOG')}
                    />

                    {cogDescription && (
                      <AICOGAssistant
                        mode="validate-cog"
                        context={{
                          objective: operationalContext.objective,
                          impactGoal: operationalContext.desired_impact,
                          friendlyForces: operationalContext.our_identity,
                          operatingEnvironment: operationalContext.operating_environment,
                        }}
                        cog={{
                          description: cogDescription,
                          actor: cogActor,
                          domain: cogDomain,
                          rationale: cogRationale,
                        }}
                        onAccept={(validation) => {
                          // Update validation checkboxes based on AI validation
                          setCogValidation({
                            criticallyDegrades: validation.criteria.criticalDegradation.passes,
                            sourceOfPower: validation.criteria.sourceOfPower.passes,
                            rightLevel: validation.criteria.appropriateLevel.passes,
                            canBeExploited: validation.criteria.exploitable.passes,
                          })
                        }}
                        buttonText={t('wizard.step2.validateCOG')}
                      />
                    )}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <Label className="text-sm font-semibold mb-3 block">{t('wizard.step2.validationTitle')}</Label>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.criticallyDegrades}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, criticallyDegrades: !!checked })
                          }
                        />
                        <label className="text-sm">
                          {t('wizard.step2.validationChecks.criticallyDegrades')}
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.sourceOfPower}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, sourceOfPower: !!checked })
                          }
                        />
                        <label className="text-sm">{t('wizard.step2.validationChecks.sourceOfPower')}</label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.rightLevel}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, rightLevel: !!checked })
                          }
                        />
                        <label className="text-sm">{t('wizard.step2.validationChecks.rightLevel')}</label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.canBeExploited}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, canBeExploited: !!checked })
                          }
                        />
                        <label className="text-sm">
                          {t('wizard.step2.validationChecks.canBeExploited')}
                        </label>
                      </div>
                    </div>
                  </div>

                  {!Object.values(cogValidation).every((v) => v) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {t('wizard.step2.validationWarning')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            )}

            {/* Step 3: Capability Mapping */}
            {currentStep === 3 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    {t('wizard.step3.alert')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {capabilities.map((cap, index) => (
                    <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label>{t('wizard.step3.capabilityLabel', { number: index + 1 })}</Label>
                          <Input
                            value={cap.capability}
                            onChange={(e) => {
                              const updated = [...capabilities]
                              updated[index].capability = e.target.value
                              setCapabilities(updated)
                            }}
                            placeholder={t('wizard.step3.capabilityPlaceholder')}
                          />
                        </div>
                        <div>
                          <Label>{t('wizard.step3.descriptionLabel')}</Label>
                          <Textarea
                            value={cap.description}
                            onChange={(e) => {
                              const updated = [...capabilities]
                              updated[index].description = e.target.value
                              setCapabilities(updated)
                            }}
                            placeholder={t('wizard.step3.descriptionPlaceholder')}
                            rows={2}
                          />
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCapabilities(capabilities.filter((_, i) => i !== index))}
                          >
                            {t('wizard.step3.removeButton')}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => setCapabilities([...capabilities, { id: crypto.randomUUID(), capability: '', description: '' }])}
                    >
                      {t('wizard.step3.addButton')}
                    </Button>

                    {cogDescription && (
                      <AICOGAssistant
                        mode="generate-capabilities"
                        context={{
                          objective: operationalContext.objective,
                          impactGoal: operationalContext.desired_impact,
                          friendlyForces: operationalContext.our_identity,
                          operatingEnvironment: operationalContext.operating_environment,
                        }}
                        cog={{
                          description: cogDescription,
                          actor: cogActor,
                          domain: cogDomain,
                          rationale: cogRationale,
                        }}
                        onAccept={(generatedCapabilities) => {
                          const newCapabilities = generatedCapabilities.map((cap: any) => ({
                            id: crypto.randomUUID(),
                            capability: cap.capability,
                            description: cap.description,
                          }))
                          setCapabilities([...capabilities.filter(c => c.capability), ...newCapabilities])
                        }}
                        buttonText={t('wizard.step3.generateButton')}
                      />
                    )}
                  </div>

                  {!canProceed() && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {t('wizard.step3.validationError')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            )}

            {/* Step 4: Requirement Analysis */}
            {currentStep === 4 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    {t('wizard.step4.alert')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {requirements.map((req, index) => (
                    <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label>{t('wizard.step4.requirementLabel', { number: index + 1 })}</Label>
                          <Input
                            value={req.requirement}
                            onChange={(e) => {
                              const updated = [...requirements]
                              updated[index].requirement = e.target.value
                              setRequirements(updated)
                            }}
                            placeholder={t('wizard.step4.requirementPlaceholder')}
                          />
                        </div>
                        <div>
                          <Label>{t('wizard.step4.typeLabel')}</Label>
                          <Select
                            value={req.type}
                            onValueChange={(value) => {
                              const updated = [...requirements]
                              updated[index].type = value
                              setRequirements(updated)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="personnel">{t('wizard.step4.types.personnel')}</SelectItem>
                              <SelectItem value="equipment">{t('wizard.step4.types.equipment')}</SelectItem>
                              <SelectItem value="logistics">{t('wizard.step4.types.logistics')}</SelectItem>
                              <SelectItem value="information">{t('wizard.step4.types.information')}</SelectItem>
                              <SelectItem value="infrastructure">{t('wizard.step4.types.infrastructure')}</SelectItem>
                              <SelectItem value="other">{t('wizard.step4.types.other')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t('wizard.step4.capabilityLinkRequired')}</Label>
                          <Select
                            value={req.capability_id}
                            onValueChange={(value) => {
                              const updated = [...requirements]
                              updated[index].capability_id = value
                              setRequirements(updated)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('wizard.step4.capabilityLinkPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {capabilities
                                .filter(c => c.capability)
                                .map((cap) => (
                                  <SelectItem key={cap.id} value={cap.id}>
                                    {cap.capability || t('wizard.step4.capabilityItem', { number: capabilities.indexOf(cap) + 1 })}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {!req.capability_id && (
                            <p className="text-xs text-red-600 mt-1">{t('wizard.step4.capabilityLinkWarning')}</p>
                          )}
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
                          >
                            {t('wizard.step4.removeButton')}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => setRequirements([...requirements, { id: crypto.randomUUID(), requirement: '', type: 'other', capability_id: '' }])}
                    >
                      {t('wizard.step4.addButton')}
                    </Button>

                    {/* Generate requirements for first capability with data */}
                    {capabilities.filter(c => c.capability).length > 0 && (
                      <AICOGAssistant
                        mode="generate-requirements"
                        context={{
                          objective: operationalContext.objective,
                          impactGoal: operationalContext.desired_impact,
                        }}
                        cog={{
                          description: cogDescription,
                          actor: cogActor,
                          domain: cogDomain,
                        }}
                        capability={{
                          capability: capabilities.filter(c => c.capability)[0].capability,
                          description: capabilities.filter(c => c.capability)[0].description,
                        }}
                        onAccept={(generatedRequirements) => {
                          const firstCapabilityId = capabilities.filter(c => c.capability)[0].id
                          const newRequirements = generatedRequirements.map((req: any) => ({
                            id: crypto.randomUUID(),
                            requirement: req.requirement,
                            type: req.type || 'other',
                            capability_id: firstCapabilityId,
                          }))
                          setRequirements([...requirements.filter(r => r.requirement), ...newRequirements])
                        }}
                        buttonText={t('wizard.step4.generateButton')}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Step 5: Vulnerability Assessment */}
            {currentStep === 5 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    {t('wizard.step5.alert')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {vulnerabilities.map((vuln, index) => (
                    <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label>{t('wizard.step5.vulnerabilityLabel', { number: index + 1 })}</Label>
                          <Input
                            value={vuln.vulnerability}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].vulnerability = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder={t('wizard.step5.vulnerabilityPlaceholder')}
                          />
                        </div>
                        <div>
                          <Label>{t('wizard.step5.descriptionLabel')}</Label>
                          <Textarea
                            value={vuln.description}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].description = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder={t('wizard.step5.descriptionPlaceholder')}
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>{t('wizard.step5.typeLabel')}</Label>
                          <Select
                            value={vuln.type}
                            onValueChange={(value) => {
                              const updated = [...vulnerabilities]
                              updated[index].type = value
                              setVulnerabilities(updated)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="physical">{t('wizard.step5.types.physical')}</SelectItem>
                              <SelectItem value="cyber">{t('wizard.step5.types.cyber')}</SelectItem>
                              <SelectItem value="human">{t('wizard.step5.types.human')}</SelectItem>
                              <SelectItem value="logistical">{t('wizard.step5.types.logistical')}</SelectItem>
                              <SelectItem value="informational">{t('wizard.step5.types.informational')}</SelectItem>
                              <SelectItem value="other">{t('wizard.step5.types.other')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t('wizard.step5.expectedEffectRequired')}</Label>
                          <Textarea
                            value={vuln.expectedEffect}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].expectedEffect = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder={t('wizard.step5.expectedEffectPlaceholder')}
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>{t('wizard.step5.recommendedActionsLabel')}</Label>
                          <Input
                            value={vuln.recommendedActions}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].recommendedActions = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder={t('wizard.step5.recommendedActionsPlaceholder')}
                          />
                        </div>
                        <div>
                          <Label>{t('wizard.step5.requirementLinkRequired')}</Label>
                          <div className="space-y-2 p-3 border rounded-lg bg-white dark:bg-gray-950 max-h-48 overflow-y-auto">
                            {requirements
                              .filter(r => r.requirement)
                              .map((req) => (
                                <div key={req.id} className="flex items-start gap-2">
                                  <Checkbox
                                    checked={vuln.requirement_ids.includes(req.id)}
                                    onCheckedChange={(checked) => {
                                      const updated = [...vulnerabilities]
                                      if (checked) {
                                        updated[index].requirement_ids.push(req.id)
                                      } else {
                                        updated[index].requirement_ids = updated[index].requirement_ids
                                          .filter(id => id !== req.id)
                                      }
                                      setVulnerabilities(updated)
                                    }}
                                  />
                                  <label className="text-sm flex-1 cursor-pointer">
                                    {req.requirement}
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {capabilities.find(c => c.id === req.capability_id)?.capability || t('wizard.step5.unknownCapability')}
                                    </Badge>
                                  </label>
                                </div>
                              ))}
                            {requirements.filter(r => r.requirement).length === 0 && (
                              <p className="text-sm text-muted-foreground">{t('wizard.step5.noRequirementsWarning')}</p>
                            )}
                          </div>
                          {vuln.requirement_ids.length === 0 && (
                            <p className="text-xs text-red-600 mt-1">{t('wizard.step5.requirementLinkWarning')}</p>
                          )}
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVulnerabilities(vulnerabilities.filter((_, i) => i !== index))}
                          >
                            {t('wizard.step5.removeButton')}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setVulnerabilities([
                          ...vulnerabilities,
                          { id: crypto.randomUUID(), vulnerability: '', description: '', type: 'other', expectedEffect: '', recommendedActions: '', requirement_ids: [] },
                        ])
                      }
                    >
                      {t('wizard.step5.addButton')}
                    </Button>

                    {/* Generate vulnerabilities for first requirement with data */}
                    {requirements.filter(r => r.requirement).length > 0 && capabilities.filter(c => c.capability).length > 0 && (
                      <AICOGAssistant
                        mode="generate-vulnerabilities"
                        context={{
                          objective: operationalContext.objective,
                          impactGoal: operationalContext.desired_impact,
                        }}
                        cog={{
                          description: cogDescription,
                          actor: cogActor,
                          domain: cogDomain,
                        }}
                        capability={{
                          capability: capabilities.filter(c => c.capability)[0].capability,
                          description: capabilities.filter(c => c.capability)[0].description,
                        }}
                        requirement={{
                          requirement: requirements.filter(r => r.requirement)[0].requirement,
                          type: requirements.filter(r => r.requirement)[0].type,
                        }}
                        onAccept={(generatedVulnerabilities) => {
                          const firstRequirementId = requirements.filter(r => r.requirement)[0].id
                          const newVulnerabilities = generatedVulnerabilities.map((vuln: any) => ({
                            id: crypto.randomUUID(),
                            vulnerability: vuln.vulnerability,
                            description: vuln.description,
                            type: vuln.type || 'other',
                            expectedEffect: vuln.expectedEffect || '',
                            recommendedActions: vuln.recommendedActions?.join(', ') || '',
                            requirement_ids: [firstRequirementId],
                          }))
                          setVulnerabilities([...vulnerabilities.filter(v => v.vulnerability), ...newVulnerabilities])
                        }}
                        buttonText={t('wizard.step5.generateButton')}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <>
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 dark:text-green-100">
                    {t('wizard.step6.alert')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{t('wizard.step6.summaryTitle')}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('wizard.step6.titleLabel')}</span>
                        <p className="font-medium">{title}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('wizard.step6.strategicLevelLabel')}</span>
                        <p className="font-medium capitalize">{operationalContext.strategic_level}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('wizard.step6.cogLabel')}</span>
                        <p className="font-medium">{cogDescription || t('wizard.step6.notSpecified')}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">{t('wizard.step6.domainLabel')}</span>
                        <Badge variant="outline" className="capitalize">
                          {cogDomain}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {capabilities.filter((c) => c.capability).length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('wizard.step6.capabilitiesCount')}</div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {requirements.filter((r) => r.requirement).length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('wizard.step6.requirementsCount')}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {vulnerabilities.filter((v) => v.vulnerability).length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('wizard.step6.vulnerabilitiesCount')}</div>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('wizard.step6.advancedModeNote')}
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('wizard.buttons.previous')}
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving || !title}
              title="Save your progress and continue later"
            >
              {saving ? t('wizard.buttons.saving') : 'Save Draft'}
            </Button>

            {currentStep === STEPS.length && savedFrameworkId && (
              <Button
                variant="outline"
                onClick={handleGenerateEntities}
                disabled={generatingEntities || saving}
                title="Automatically generate actors and behaviors from this COG analysis"
              >
                <Network className="h-4 w-4 mr-2" />
                {generatingEntities ? 'Generating...' : entitiesGenerated ? 'Regenerate Entities' : 'Generate Entities'}
              </Button>
            )}

            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                {t('wizard.buttons.next')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={!canProceed() || saving}>
                {saving ? t('wizard.buttons.saving') : t('wizard.buttons.save')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
