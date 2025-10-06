import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, AlertCircle, Lightbulb, FileEdit } from 'lucide-react'
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

const STEPS = [
  { id: 1, name: 'Context', description: 'Set operational context' },
  { id: 2, name: 'COG', description: 'Identify Centers of Gravity' },
  { id: 3, name: 'Capabilities', description: 'Map critical capabilities' },
  { id: 4, name: 'Requirements', description: 'Identify critical requirements' },
  { id: 5, name: 'Vulnerabilities', description: 'Assess vulnerabilities' },
  { id: 6, name: 'Review', description: 'Review and save' },
]

const ACTOR_CATEGORIES: { value: ActorCategory; label: string }[] = [
  { value: 'friendly', label: 'Friendly Forces' },
  { value: 'adversary', label: 'Adversary' },
  { value: 'host_nation', label: 'Host Nation' },
  { value: 'third_party', label: 'Third Party' },
]

const DIMEFIL_DOMAINS: { value: DIMEFILDomain; label: string }[] = [
  { value: 'diplomatic', label: 'Diplomatic' },
  { value: 'information', label: 'Information' },
  { value: 'military', label: 'Military' },
  { value: 'economic', label: 'Economic' },
  { value: 'financial', label: 'Financial' },
  { value: 'intelligence', label: 'Intelligence' },
  { value: 'law_enforcement', label: 'Law Enforcement' },
  { value: 'cyber', label: 'Cyber' },
  { value: 'space', label: 'Space' },
]

export function COGWizard({ initialData, onSave, backPath }: COGWizardProps) {
  const navigate = useNavigate()
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
  const [capabilities, setCapabilities] = useState<Array<{ capability: string; description: string }>>([
    { capability: '', description: '' },
  ])

  // Requirements (simplified)
  const [requirements, setRequirements] = useState<Array<{ requirement: string; type: string }>>([
    { requirement: '', type: 'other' },
  ])

  // Vulnerabilities (simplified)
  const [vulnerabilities, setVulnerabilities] = useState<
    Array<{
      vulnerability: string
      description: string
      type: string
      expectedEffect: string
      recommendedActions: string
    }>
  >([{ vulnerability: '', description: '', type: 'other', expectedEffect: '', recommendedActions: '' }])

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
          id: i === 0 ? capId : crypto.randomUUID(),
          cog_id: cogId,
          capability: c.capability,
          description: c.description,
          strategic_contribution: c.description,
          linked_evidence: [],
        }))

      const reqs: CriticalRequirement[] = requirements
        .filter((r) => r.requirement)
        .map((r, i) => ({
          id: i === 0 ? reqId : crypto.randomUUID(),
          capability_id: caps[0]?.id || capId,
          requirement: r.requirement,
          requirement_type: r.type as any,
          description: r.requirement,
          linked_evidence: [],
        }))

      const vulns: CriticalVulnerability[] = vulnerabilities
        .filter((v) => v.vulnerability)
        .map((v) => ({
          id: crypto.randomUUID(),
          requirement_id: reqs[0]?.id || reqId,
          vulnerability: v.vulnerability,
          vulnerability_type: v.type as any,
          description: v.description,
          expected_effect: v.expectedEffect,
          recommended_actions: v.recommendedActions.split(',').map((a) => a.trim()),
          confidence: 'medium',
          scoring: {
            impact_on_cog: 3,
            attainability: 3,
            follow_up_potential: 3,
          },
          composite_score: 9,
          linked_evidence: [],
        }))

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
      navigate(backPath)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const switchToAdvancedMode = () => {
    if (confirm('Switch to advanced mode? Your progress will be saved.')) {
      // Build partial data and navigate to form
      navigate(`${backPath}/create`, {
        state: {
          wizardData: {
            title,
            description,
            operational_context: operationalContext,
          },
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
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">COG Analysis Wizard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Step-by-step guided analysis</p>
            </div>
          </div>
          <Button variant="outline" onClick={switchToAdvancedMode}>
            <FileEdit className="h-4 w-4 mr-2" />
            Advanced Mode
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
            </div>
            <div className="text-sm text-gray-500">{Math.round(progress)}% Complete</div>
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
                    Set the operational context for your analysis. This frames the entire COG assessment.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label>Analysis Title *</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Adversary Command & Control Analysis" />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of this analysis"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>🎯 What is your analysis objective? *</Label>
                    <Textarea
                      value={operationalContext.objective}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, objective: e.target.value })
                      }
                      placeholder="Identify and prioritize adversary command and control vulnerabilities..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>💥 What impact do we want to achieve? *</Label>
                    <Textarea
                      value={operationalContext.desired_impact}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, desired_impact: e.target.value })
                      }
                      placeholder="Disrupt adversary ability to coordinate forces..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>👥 Who are we? (Friendly forces) *</Label>
                    <Input
                      value={operationalContext.our_identity}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, our_identity: e.target.value })
                      }
                      placeholder="Joint Task Force with multi-domain capabilities"
                    />
                  </div>

                  <div>
                    <Label>🌍 Where are we operating? (PMESII-PT)</Label>
                    <Textarea
                      value={operationalContext.operating_environment}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, operating_environment: e.target.value })
                      }
                      placeholder="Theater-level operations against peer adversary..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>⏰ Operational Timeframe</Label>
                    <Input
                      value={operationalContext.timeframe}
                      onChange={(e) =>
                        setOperationalContext({ ...operationalContext, timeframe: e.target.value })
                      }
                      placeholder="30-45 days from assessment to decision point"
                    />
                  </div>

                  <div>
                    <Label>Strategic Level</Label>
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
                        <SelectItem value="tactical">Tactical</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="strategic">Strategic</SelectItem>
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
                    Identify the primary Center of Gravity. A COG is a source of power that provides moral or physical strength, freedom of action, or will to act.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label>Actor Category</Label>
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

                  <div>
                    <Label>DIMEFIL Domain</Label>
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
                    <Label>📝 What is this Center of Gravity? *</Label>
                    <Textarea
                      value={cogDescription}
                      onChange={(e) => setCogDescription(e.target.value)}
                      placeholder="Integrated Command and Control System enabling synchronized multi-domain operations"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>🤔 Why is this a COG? (Rationale) *</Label>
                    <Textarea
                      value={cogRationale}
                      onChange={(e) => setCogRationale(e.target.value)}
                      placeholder="Without this C2 system, adversary cannot coordinate air, ground, and naval forces effectively..."
                      rows={4}
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <Label className="text-sm font-semibold mb-3 block">✅ COG Validation Checklist</Label>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.criticallyDegrades}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, criticallyDegrades: !!checked })
                          }
                        />
                        <label className="text-sm">
                          If neutralized, would this critically degrade the actor's ability to achieve objectives?
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.sourceOfPower}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, sourceOfPower: !!checked })
                          }
                        />
                        <label className="text-sm">Is this truly a source of power (not just important)?</label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.rightLevel}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, rightLevel: !!checked })
                          }
                        />
                        <label className="text-sm">Is this at the right level of analysis?</label>
                      </div>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={cogValidation.canBeExploited}
                          onCheckedChange={(checked) =>
                            setCogValidation({ ...cogValidation, canBeExploited: !!checked })
                          }
                        />
                        <label className="text-sm">
                          Can this be protected/exploited through its critical requirements and vulnerabilities?
                        </label>
                      </div>
                    </div>
                  </div>

                  {!Object.values(cogValidation).every((v) => v) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Complete the validation checklist to ensure this is a valid COG. You can proceed but validation is recommended.
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
                    Map critical capabilities - what can the COG DO? Use action verbs (coordinate, project, influence, etc.)
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {capabilities.map((cap, index) => (
                    <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label>⚡ Critical Capability {index + 1} (Action/Verb)</Label>
                          <Input
                            value={cap.capability}
                            onChange={(e) => {
                              const updated = [...capabilities]
                              updated[index].capability = e.target.value
                              setCapabilities(updated)
                            }}
                            placeholder="e.g., Coordinate multi-domain strike operations"
                          />
                        </div>
                        <div>
                          <Label>How does this work?</Label>
                          <Textarea
                            value={cap.description}
                            onChange={(e) => {
                              const updated = [...capabilities]
                              updated[index].description = e.target.value
                              setCapabilities(updated)
                            }}
                            placeholder="Describe how this capability functions..."
                            rows={2}
                          />
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCapabilities(capabilities.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setCapabilities([...capabilities, { capability: '', description: '' }])}
                  >
                    + Add Another Capability
                  </Button>
                </div>
              </>
            )}

            {/* Step 4: Requirement Analysis */}
            {currentStep === 4 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    Identify critical requirements - what does the COG NEED? Focus on resources, conditions, or infrastructure.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {requirements.map((req, index) => (
                    <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label>📋 Critical Requirement {index + 1} (Noun/Resource)</Label>
                          <Input
                            value={req.requirement}
                            onChange={(e) => {
                              const updated = [...requirements]
                              updated[index].requirement = e.target.value
                              setRequirements(updated)
                            }}
                            placeholder="e.g., Redundant communication network"
                          />
                        </div>
                        <div>
                          <Label>Requirement Type</Label>
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
                              <SelectItem value="personnel">Personnel</SelectItem>
                              <SelectItem value="equipment">Equipment</SelectItem>
                              <SelectItem value="logistics">Logistics</SelectItem>
                              <SelectItem value="information">Information</SelectItem>
                              <SelectItem value="infrastructure">Infrastructure</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRequirements(requirements.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setRequirements([...requirements, { requirement: '', type: 'other' }])}
                  >
                    + Add Another Requirement
                  </Button>
                </div>
              </>
            )}

            {/* Step 5: Vulnerability Assessment */}
            {currentStep === 5 && (
              <>
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    Assess critical vulnerabilities - what are the WEAKNESSES? Identify specific exploitable aspects of requirements.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {vulnerabilities.map((vuln, index) => (
                    <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label>⚠️ Critical Vulnerability {index + 1}</Label>
                          <Input
                            value={vuln.vulnerability}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].vulnerability = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder="e.g., Single point of failure in communication hub"
                          />
                        </div>
                        <div>
                          <Label>Description & Exploitation Method</Label>
                          <Textarea
                            value={vuln.description}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].description = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder="Describe the vulnerability and how it could be exploited..."
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>Vulnerability Type</Label>
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
                              <SelectItem value="physical">Physical</SelectItem>
                              <SelectItem value="cyber">Cyber</SelectItem>
                              <SelectItem value="human">Human</SelectItem>
                              <SelectItem value="logistical">Logistical</SelectItem>
                              <SelectItem value="informational">Informational</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>💡 What happens if exploited? (Expected Effect)</Label>
                          <Textarea
                            value={vuln.expectedEffect}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].expectedEffect = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder="Adversary loses primary C2 capability within 48 hours..."
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>Recommended Actions (comma-separated)</Label>
                          <Input
                            value={vuln.recommendedActions}
                            onChange={(e) => {
                              const updated = [...vulnerabilities]
                              updated[index].recommendedActions = e.target.value
                              setVulnerabilities(updated)
                            }}
                            placeholder="Conduct detailed target analysis, Develop strike options, Coordinate with cyber command"
                          />
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVulnerabilities(vulnerabilities.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setVulnerabilities([
                        ...vulnerabilities,
                        { vulnerability: '', description: '', type: 'other', expectedEffect: '', recommendedActions: '' },
                      ])
                    }
                  >
                    + Add Another Vulnerability
                  </Button>
                </div>
              </>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <>
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-900 dark:text-green-100">
                    Review your COG analysis before saving. You can edit details later in advanced mode.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Analysis Summary</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Title:</span>
                        <p className="font-medium">{title}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Strategic Level:</span>
                        <p className="font-medium capitalize">{operationalContext.strategic_level}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">COG:</span>
                        <p className="font-medium">{cogDescription || 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Domain:</span>
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
                      <div className="text-sm text-gray-600 dark:text-gray-400">Capabilities</div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {requirements.filter((r) => r.requirement).length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Requirements</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {vulnerabilities.filter((v) => v.vulnerability).length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Vulnerabilities</div>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      After saving, you can refine scoring, add additional COGs, and link evidence in advanced mode.
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!canProceed() || saving}>
              {saving ? 'Saving...' : 'Save Analysis'}
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
