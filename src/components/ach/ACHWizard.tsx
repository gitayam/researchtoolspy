import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Sparkles, Plus, X, Search, AlertCircle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { ACHAnalysis, ACHHypothesis, ACHEvidenceLink, ScaleType } from '@/types/ach'
import type { EvidenceItem } from '@/types/evidence'
import { cn } from '@/lib/utils'

interface ACHWizardProps {
  initialData?: Partial<ACHAnalysis>
  onSave: (data: Partial<ACHAnalysis>) => Promise<string> // Returns ACH ID
  onComplete?: (achId: string) => void
  backPath: string
}

interface WizardHypothesis {
  id: string
  text: string
  rationale?: string
  source?: string
}

const TEMPLATES = [
  {
    id: 'geopolitical',
    name: 'Geopolitical Analysis',
    question: 'What is the primary motivation behind [Actor]\'s actions in [Region]?',
    sampleHypotheses: [
      'Economic interests and resource control',
      'Strategic territorial expansion',
      'Defensive security concerns',
      'Domestic political considerations'
    ]
  },
  {
    id: 'threat',
    name: 'Threat Assessment',
    question: 'What threat does [Actor/Group] pose to [Target]?',
    sampleHypotheses: [
      'Imminent kinetic attack capability',
      'Cyber operations and information warfare',
      'Economic coercion and sanctions',
      'Limited or no actual threat'
    ]
  },
  {
    id: 'attribution',
    name: 'Attribution Analysis',
    question: 'Who is responsible for [Incident/Event]?',
    sampleHypotheses: [
      'State actor with advanced capabilities',
      'Non-state actor or proxy group',
      'Criminal organization',
      'Accidental or natural cause'
    ]
  },
  {
    id: 'intent',
    name: 'Intent Assessment',
    question: 'What does [Actor] intend to achieve through [Actions]?',
    sampleHypotheses: [
      'Strategic long-term objectives',
      'Tactical short-term gains',
      'Signaling or deterrence',
      'Unintended consequences of other actions'
    ]
  },
  {
    id: 'custom',
    name: 'Custom Analysis',
    question: '',
    sampleHypotheses: []
  }
]

export function ACHWizard({ initialData, onSave, onComplete, backPath }: ACHWizardProps) {
  const navigate = useNavigate()

  const STEPS = [
    { id: 1, name: 'Define Question', description: 'Formulate your intelligence question' },
    { id: 2, name: 'Generate Hypotheses', description: 'Create competing hypotheses' },
    { id: 3, name: 'Select Evidence', description: 'Link relevant evidence' },
    { id: 4, name: 'Score Matrix', description: 'Evaluate evidence against hypotheses' },
    { id: 5, name: 'Review & Finalize', description: 'Review and save your analysis' }
  ]

  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [savedAchId, setSavedAchId] = useState<string | null>(null)

  // Step 1: Question Definition
  const [title, setTitle] = useState(initialData?.title || '')
  const [question, setQuestion] = useState(initialData?.question || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [analyst, setAnalyst] = useState(initialData?.analyst || '')
  const [organization, setOrganization] = useState(initialData?.organization || '')
  const [scaleType, setScaleType] = useState<ScaleType>(initialData?.scale_type || 'logarithmic')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom')

  // Step 2: Hypotheses
  const [hypotheses, setHypotheses] = useState<WizardHypothesis[]>(
    initialData?.hypotheses?.map(h => ({
      id: h.id,
      text: h.text,
      rationale: h.rationale,
      source: h.source
    })) || [{ id: crypto.randomUUID(), text: '', rationale: '', source: '' }]
  )
  const [generatingHypotheses, setGeneratingHypotheses] = useState(false)

  // Step 3: Evidence
  const [allEvidence, setAllEvidence] = useState<EvidenceItem[]>([])
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>(
    initialData?.evidence?.map(e => e.evidence_id) || []
  )
  const [evidenceSearch, setEvidenceSearch] = useState('')
  const [loadingEvidence, setLoadingEvidence] = useState(false)

  const progress = (currentStep / STEPS.length) * 100

  // Load evidence library
  const loadEvidence = async () => {
    if (allEvidence.length > 0) return // Already loaded

    setLoadingEvidence(true)
    try {
      const response = await fetch('/api/evidence-items')
      if (response.ok) {
        const data = await response.json()
        setAllEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    } finally {
      setLoadingEvidence(false)
    }
  }

  // Generate hypotheses using GPT
  const generateHypotheses = async () => {
    if (!question.trim()) {
      alert('Please enter an intelligence question first')
      return
    }

    setGeneratingHypotheses(true)
    try {
      const response = await fetch('/api/ach/generate-hypotheses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })

      if (!response.ok) throw new Error('Failed to generate hypotheses')

      const data = await response.json()
      const generated: WizardHypothesis[] = data.hypotheses.map((text: string) => ({
        id: crypto.randomUUID(),
        text,
        rationale: 'Generated by AI based on question analysis',
        source: 'GPT-4o-mini'
      }))

      setHypotheses(generated)
    } catch (error) {
      console.error('Failed to generate hypotheses:', error)
      alert('Failed to generate hypotheses. Please create them manually.')
    } finally {
      setGeneratingHypotheses(false)
    }
  }

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    setSelectedTemplate(templateId)
    if (template.question) {
      setQuestion(template.question)
    }
    if (template.sampleHypotheses.length > 0) {
      setHypotheses(template.sampleHypotheses.map(text => ({
        id: crypto.randomUUID(),
        text,
        rationale: 'From template',
        source: template.name
      })))
    }
  }

  // Add/remove hypotheses
  const addHypothesis = () => {
    setHypotheses([...hypotheses, { id: crypto.randomUUID(), text: '', rationale: '', source: '' }])
  }

  const removeHypothesis = (id: string) => {
    if (hypotheses.length <= 1) {
      alert('You must have at least one hypothesis')
      return
    }
    setHypotheses(hypotheses.filter(h => h.id !== id))
  }

  const updateHypothesis = (id: string, field: keyof WizardHypothesis, value: string) => {
    setHypotheses(hypotheses.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  // Evidence selection
  const toggleEvidence = (evidenceId: string) => {
    setSelectedEvidence(prev =>
      prev.includes(evidenceId)
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    )
  }

  const filteredEvidence = allEvidence.filter(e => {
    if (!evidenceSearch) return true
    const search = evidenceSearch.toLowerCase()
    return (
      e.title.toLowerCase().includes(search) ||
      e.description?.toLowerCase().includes(search) ||
      e.tags.some(tag => tag.toLowerCase().includes(search))
    )
  })

  // Validation
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!(title && question)
      case 2:
        return hypotheses.filter(h => h.text.trim()).length >= 2
      case 3:
        return selectedEvidence.length > 0
      case 4:
        return true // Scoring is optional
      case 5:
        return true
      default:
        return false
    }
  }

  // Navigation
  const handleNext = () => {
    if (currentStep === 3 && allEvidence.length === 0) {
      loadEvidence()
    }
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

  // Save and finish
  const handleSave = async () => {
    setSaving(true)
    try {
      // Save ACH analysis
      const achId = await onSave({
        title,
        question,
        description,
        analyst,
        organization,
        scale_type: scaleType,
        status: 'draft'
      })

      setSavedAchId(achId)

      // Save hypotheses
      for (let i = 0; i < hypotheses.length; i++) {
        const hyp = hypotheses[i]
        if (hyp.text.trim()) {
          await fetch('/api/ach/hypotheses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ach_analysis_id: achId,
              text: hyp.text,
              rationale: hyp.rationale,
              source: hyp.source,
              order_num: i
            })
          })
        }
      }

      // Link evidence
      for (const evidenceId of selectedEvidence) {
        await fetch('/api/ach/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ach_analysis_id: achId,
            evidence_id: evidenceId
          })
        })
      }

      // Complete
      if (onComplete) {
        onComplete(achId)
      } else {
        navigate(`/dashboard/analysis-frameworks/ach/${achId}`)
      }
    } catch (error) {
      console.error('Failed to save ACH:', error)
      alert('Failed to save ACH analysis')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{STEPS[currentStep - 1].name}</h3>
                <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
              </div>
              <Badge variant="outline">Step {currentStep} of {STEPS.length}</Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Question Definition */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Define Intelligence Question</CardTitle>
            <CardDescription>
              A clear, specific question will help generate better hypotheses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Analysis Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Russian Intentions in Ukraine"
              />
            </div>

            <div>
              <Label>Intelligence Question *</Label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., What is Russia's primary strategic objective in Ukraine?"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Good questions are specific, answerable, and intelligence-relevant
              </p>
            </div>

            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Background context and scope of analysis"
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Analyst</Label>
                <Input
                  value={analyst}
                  onChange={(e) => setAnalyst(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label>Organization</Label>
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Agency/Unit"
                />
              </div>
            </div>

            <div>
              <Label>Scoring Scale</Label>
              <Select value={scaleType} onValueChange={(v) => setScaleType(v as ScaleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="logarithmic">Logarithmic (-5 to +5)</SelectItem>
                  <SelectItem value="linear">Linear (-3 to +3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Hypotheses */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generate Hypotheses</CardTitle>
                  <CardDescription>
                    Create 4-6 competing hypotheses that answer your question
                  </CardDescription>
                </div>
                <Button
                  onClick={generateHypotheses}
                  disabled={generatingHypotheses || !question}
                  variant="outline"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generatingHypotheses ? 'Generating...' : 'AI Generate'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  <strong>ACH Tips:</strong> Hypotheses should be mutually exclusive where possible,
                  cover the spectrum of possibilities, and include at least one contrarian view.
                </AlertDescription>
              </Alert>

              {hypotheses.map((hyp, index) => (
                <Card key={hyp.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Badge className="mt-1">H{index + 1}</Badge>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={hyp.text}
                          onChange={(e) => updateHypothesis(hyp.id, 'text', e.target.value)}
                          placeholder="Hypothesis statement"
                        />
                        <Textarea
                          value={hyp.rationale || ''}
                          onChange={(e) => updateHypothesis(hyp.id, 'rationale', e.target.value)}
                          placeholder="Rationale (optional)"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      {hypotheses.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeHypothesis(hyp.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              <Button onClick={addHypothesis} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Hypothesis
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Evidence Selection */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Evidence</CardTitle>
            <CardDescription>
              Choose evidence from your library to evaluate against hypotheses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={evidenceSearch}
                onChange={(e) => setEvidenceSearch(e.target.value)}
                placeholder="Search evidence..."
                className="flex-1"
              />
            </div>

            {loadingEvidence ? (
              <div className="text-center py-8 text-muted-foreground">Loading evidence...</div>
            ) : filteredEvidence.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No evidence found</p>
                <Button
                  variant="link"
                  onClick={() => navigate('/dashboard/evidence')}
                  className="mt-2"
                >
                  Create evidence in Evidence Library →
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredEvidence.map(ev => (
                  <div
                    key={ev.id}
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                      selectedEvidence.includes(String(ev.id))
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-accent"
                    )}
                    onClick={() => toggleEvidence(String(ev.id))}
                  >
                    <Checkbox
                      checked={selectedEvidence.includes(String(ev.id))}
                      onCheckedChange={() => toggleEvidence(String(ev.id))}
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{ev.title}</h4>
                      {ev.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                      {ev.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ev.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selected {selectedEvidence.length} evidence item(s). You can add more evidence after creating the analysis.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Matrix Scoring Info */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Matrix Scoring</CardTitle>
            <CardDescription>
              You'll score evidence against hypotheses in the next step
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">How ACH Matrix Scoring Works:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Positive scores (+)</strong> = Evidence supports hypothesis</li>
                    <li><strong>Negative scores (−)</strong> = Evidence contradicts hypothesis</li>
                    <li><strong>Zero (0)</strong> = Evidence is neutral or N/A</li>
                    <li><strong>Key insight:</strong> The hypothesis with the LEAST contradictory evidence is typically most likely</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Your Analysis Setup:</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Question:</p>
                  <p className="font-medium">{question}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Scale:</p>
                  <p className="font-medium">{scaleType === 'logarithmic' ? 'Logarithmic (-5 to +5)' : 'Linear (-3 to +3)'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hypotheses:</p>
                  <p className="font-medium">{hypotheses.filter(h => h.text).length} hypotheses</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Evidence:</p>
                  <p className="font-medium">{selectedEvidence.length} items</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Finalize</CardTitle>
            <CardDescription>
              Review your analysis before saving
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Analysis Details</h4>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Title:</dt>
                <dd className="font-medium">{title}</dd>
                <dt className="text-muted-foreground">Question:</dt>
                <dd className="font-medium">{question}</dd>
                {analyst && (
                  <>
                    <dt className="text-muted-foreground">Analyst:</dt>
                    <dd className="font-medium">{analyst}</dd>
                  </>
                )}
              </dl>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Hypotheses ({hypotheses.filter(h => h.text).length})</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {hypotheses.filter(h => h.text).map(h => (
                  <li key={h.id}>{h.text}</li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Evidence ({selectedEvidence.length})</h4>
              <p className="text-sm text-muted-foreground">
                {selectedEvidence.length} evidence items selected from library
              </p>
            </div>

            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Click "Finish & Score" to create your ACH analysis. You'll be taken to the scoring matrix.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => currentStep === 1 ? navigate(backPath) : handlePrevious()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Cancel' : 'Previous'}
        </Button>

        {currentStep < STEPS.length ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving || !canProceed()}>
            <Check className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Finish & Score'}
          </Button>
        )}
      </div>
    </div>
  )
}
