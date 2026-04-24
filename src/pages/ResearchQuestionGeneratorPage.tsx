import { useState, useRef, useEffect } from 'react'
import { Check, ArrowLeft, Loader2, Sparkles, FileText, Wand2, ChevronDown, ChevronUp, Users, RefreshCw, ArrowRight, Plus, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useNavigate } from 'react-router-dom'
import ResearchPlanDisplay from '@/components/research/ResearchPlanDisplay'
import { useTranslation } from 'react-i18next'
import { getCopHeaders } from '@/lib/cop-auth'
import { cn } from '@/lib/utils'

// --- Types ---

interface FormData {
  researchContext: 'academic' | 'osint' | 'investigation' | 'business' | 'journalism' | 'personal' | ''
  teamSize: 'solo' | 'small-team' | 'large-team'
  teamRoles: string[]
  topic: string
  purpose: string[]
  projectType: string
  who: { population: string; subgroups?: string }
  what: { variables: string; expectedOutcome?: string }
  where: { location: string; specificSettings?: string }
  when: { timePeriod: string; studyType: 'cross-sectional' | 'longitudinal' | 'historical' | 'real-time' }
  why: { importance: string; beneficiaries?: string }
  duration: string
  resources: string[]
  experienceLevel: string
  constraints?: string
  ethicalConsiderations?: string
}

interface GeneratedQuestion {
  question: string
  smartAssessment: Record<string, { passed: boolean; explanation: string }>
  finerAssessment: Record<string, { passed: boolean; explanation: string }>
  nullHypothesis: string
  alternativeHypothesis: string
  keyVariables: string[]
  dataCollectionMethods: string[]
  potentialChallenges: string[]
  overallScore: number
}

interface Milestone {
  phase: string
  tasks: string[]
  duration: string
  deliverables: string[]
}

interface ResearchPlan {
  methodology: {
    approach: string
    design: string
    rationale: string
    dataCollection: string[]
    sampling: string
    sampleSize: string
  }
  timeline: {
    totalDuration: string
    milestones: Milestone[]
    criticalPath: string[]
  }
  resources: {
    personnel: string[]
    equipment: string[]
    software: string[]
    funding: string
    facilities: string[]
  }
  literatureReview: {
    databases: string[]
    searchTerms: string[]
    inclusionCriteria: string[]
    exclusionCriteria: string[]
    expectedSources: number
  }
  dataAnalysis: {
    quantitativeTests: string[]
    qualitativeApproaches: string[]
    software: string[]
    validationMethods: string[]
  }
  ethicalConsiderations: {
    irbRequired: boolean
    riskLevel: string
    consentRequired: boolean
    privacyMeasures: string[]
    potentialRisks: string[]
  }
  dissemination: {
    targetJournals: string[]
    conferences: string[]
    stakeholders: string[]
    formats: string[]
  }
}

// --- Constants ---

const RESEARCH_CONTEXTS = [
  { value: 'academic' as const, label: 'Academic', icon: '🎓' },
  { value: 'osint' as const, label: 'OSINT', icon: '🔍' },
  { value: 'investigation' as const, label: 'Investigation', icon: '🕵️' },
  { value: 'business' as const, label: 'Business', icon: '💼' },
  { value: 'journalism' as const, label: 'Journalism', icon: '📰' },
  { value: 'personal' as const, label: 'Personal', icon: '🌱' },
]

const EXAMPLE_TOPICS = [
  'How does social media disinformation spread during elections?',
  'What are the economic impacts of remote work on urban centers?',
  'How effective are community policing programs at reducing crime?',
  'What factors influence public trust in AI-generated content?',
]

const PURPOSE_OPTIONS = ['Exploratory', 'Descriptive', 'Explanatory', 'Evaluative', 'Policy-oriented', 'Applied research', 'Academic research']
const PROJECT_TYPES = ['Academic thesis/dissertation', 'Journal article', 'Policy report', 'Grant proposal', 'Consulting project', 'Internal research', 'Other']
const DURATION_OPTIONS = ['1 day', '2-7 days', '1-2 weeks', '2-4 weeks', '1-3 months', '3-6 months', '6-12 months', '1-2 years', '2+ years']
const RESOURCE_OPTIONS = ['Existing datasets', 'Survey tools', 'Research assistants', 'Statistical software', 'Funding for data collection', 'Access to participants/subjects', 'Lab facilities', 'Institutional support']

const DEFAULT_FORM: FormData = {
  researchContext: '',
  teamSize: 'solo',
  teamRoles: [],
  topic: '',
  purpose: [],
  projectType: '',
  who: { population: '' },
  what: { variables: '' },
  where: { location: '' },
  when: { timePeriod: '', studyType: 'cross-sectional' },
  why: { importance: '' },
  duration: '',
  resources: [],
  experienceLevel: 'intermediate',
}

// --- Main Page ---

export default function ResearchQuestionGeneratorPage() {
  const { t } = useTranslation(['researchQuestion', 'common'])
  const navigate = useNavigate()
  const resultsRef = useRef<HTMLDivElement>(null)

  // Core state
  const [formData, setFormData] = useState<FormData>({ ...DEFAULT_FORM })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null)
  const [researchQuestionId, setResearchQuestionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  // Scroll to results when questions are generated
  useEffect(() => {
    if (generatedQuestions.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [generatedQuestions])

  // --- API calls ---

  const handleGenerate = async () => {
    if (!formData.topic.trim()) return

    setIsGenerating(true)
    setError(null)
    setGeneratedQuestions([])
    setSelectedQuestionIndex(null)
    setResearchPlan(null)

    try {
      // Use the quick recommend endpoint if we only have a topic
      // Use the full generate endpoint if we have detailed context
      const hasDetailedContext = formData.who.population || formData.what.variables || formData.where.location

      if (hasDetailedContext) {
        const response = await fetch('/api/research/generate-question', {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({ ...formData, saveToDatabase: true })
        })
        if (!response.ok) {
          if (response.status === 401) throw new Error('Session expired. Please refresh to continue.')
          throw new Error('Failed to generate questions')
        }
        const data = await response.json()
        setGeneratedQuestions(data.questions || [])
        setResearchQuestionId(data.researchQuestionId || null)
      } else {
        const response = await fetch('/api/research/recommend-questions', {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({
            topic: formData.topic,
            context: formData.researchContext || undefined,
            count: 3
          })
        })
        if (!response.ok) {
          if (response.status === 401) throw new Error('Session expired. Please refresh to continue.')
          throw new Error('Failed to generate questions')
        }
        const data = await response.json()
        setGeneratedQuestions(data.questions || [])
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGeneratePlan = async () => {
    if (selectedQuestionIndex === null) return
    const selectedQuestion = generatedQuestions[selectedQuestionIndex]

    setIsGeneratingPlan(true)
    try {
      const response = await fetch('/api/research/generate-plan', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          researchQuestionId,
          researchQuestion: selectedQuestion.question,
          duration: formData.duration || '3-6 months',
          resources: formData.resources,
          experienceLevel: formData.experienceLevel,
          projectType: formData.projectType || 'General research',
          fiveWs: {
            who: formData.who.population ? formData.who : { population: 'To be determined' },
            what: formData.what.variables ? formData.what : { variables: 'To be determined' },
            where: formData.where.location ? formData.where : { location: 'To be determined' },
            when: formData.when.timePeriod ? formData.when : { timePeriod: 'To be determined', studyType: 'cross-sectional' },
            why: formData.why.importance ? formData.why : { importance: 'As specified in research question' }
          },
          researchContext: formData.researchContext || 'academic',
          teamSize: formData.teamSize,
          teamRoles: formData.teamRoles
        })
      })

      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired. Please refresh to continue.')
        throw new Error('Failed to generate plan')
      }
      const data = await response.json()
      setResearchPlan(data.plan)
    } catch (err: any) {
      setError(err.message || 'Failed to generate research plan')
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleReset = () => {
    setFormData({ ...DEFAULT_FORM })
    setGeneratedQuestions([])
    setSelectedQuestionIndex(null)
    setResearchPlan(null)
    setResearchQuestionId(null)
    setError(null)
  }

  // Count how much optional context has been provided
  const contextCount = [
    formData.researchContext,
    formData.who.population,
    formData.what.variables,
    formData.where.location,
    formData.when.timePeriod,
    formData.why.importance,
    formData.projectType,
    formData.duration,
  ].filter(Boolean).length

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} size="sm" className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-600" />
          Research Question Generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe what you want to research and get well-formed questions with methodology assessment
        </p>
      </div>

      {/* === MAIN INPUT AREA === */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          {/* Topic textarea - the star of the show */}
          <div>
            <Textarea
              value={formData.topic}
              onChange={(e) => updateFormData({ topic: e.target.value })}
              placeholder="What do you want to research? Describe your topic, question, or area of interest..."
              rows={3}
              className="text-base resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey && formData.topic.trim()) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
            />
          </div>

          {/* Example prompts (only show when empty) */}
          {!formData.topic && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_TOPICS.map((example) => (
                  <button
                    key={example}
                    onClick={() => updateFormData({ topic: example })}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Context chips (inline, not a separate step) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Context:</span>
            {RESEARCH_CONTEXTS.map(ctx => (
              <button
                key={ctx.value}
                onClick={() => updateFormData({
                  researchContext: formData.researchContext === ctx.value ? '' : ctx.value
                })}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors',
                  formData.researchContext === ctx.value
                    ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200'
                    : 'border-border hover:border-purple-300 dark:hover:border-purple-600 text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{ctx.icon}</span>
                {ctx.label}
              </button>
            ))}
          </div>

          {/* Generate button + hint */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {contextCount > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-medium">
                  {contextCount} context fields added &middot;{' '}
                </span>
              )}
              Cmd+Enter to generate
            </p>
            <div className="flex gap-2">
              {generatedQuestions.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Start Over
                </Button>
              )}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !formData.topic.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Questions
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === OPTIONAL DETAIL SECTIONS (refine before or after generating) === */}
      {!researchPlan && (
        <Accordion type="multiple" className="mb-6">
          {/* 5 W's */}
          <AccordionItem value="five-ws" className="border rounded-lg mb-2 px-4">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-purple-500" />
                <span>Refine with 5 W's</span>
                {(formData.who.population || formData.what.variables || formData.where.location || formData.when.timePeriod || formData.why.importance) && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                    {[formData.who.population, formData.what.variables, formData.where.location, formData.when.timePeriod, formData.why.importance].filter(Boolean).length}/5
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Who (population/subjects)</Label>
                  <Input
                    value={formData.who.population}
                    onChange={(e) => updateFormData({ who: { ...formData.who, population: e.target.value } })}
                    placeholder="e.g., College students aged 18-25"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">What (variables/phenomena)</Label>
                  <Input
                    value={formData.what.variables}
                    onChange={(e) => updateFormData({ what: { ...formData.what, variables: e.target.value } })}
                    placeholder="e.g., Social media usage and mental health"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Where (location/setting)</Label>
                  <Input
                    value={formData.where.location}
                    onChange={(e) => updateFormData({ where: { ...formData.where, location: e.target.value } })}
                    placeholder="e.g., Urban universities in the US"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">When (time period)</Label>
                  <Input
                    value={formData.when.timePeriod}
                    onChange={(e) => updateFormData({ when: { ...formData.when, timePeriod: e.target.value } })}
                    placeholder="e.g., 2020-2025"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Why (significance)</Label>
                  <Input
                    value={formData.why.importance}
                    onChange={(e) => updateFormData({ why: { ...formData.why, importance: e.target.value } })}
                    placeholder="e.g., Rising mental health concerns among young adults"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Project & Resources */}
          <AccordionItem value="project" className="border rounded-lg mb-2 px-4">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span>Project & Resources</span>
                {(formData.projectType || formData.duration) && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                    {[formData.projectType, formData.duration, ...formData.resources].filter(Boolean).length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Project Type</Label>
                    <select
                      value={formData.projectType}
                      onChange={(e) => updateFormData({ projectType: e.target.value })}
                      className="w-full h-9 px-3 text-sm border rounded-md bg-background"
                    >
                      <option value="">Select...</option>
                      {PROJECT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <select
                      value={formData.duration}
                      onChange={(e) => updateFormData({ duration: e.target.value })}
                      className="w-full h-9 px-3 text-sm border rounded-md bg-background"
                    >
                      <option value="">Select...</option>
                      {DURATION_OPTIONS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Experience Level</Label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => updateFormData({ experienceLevel: e.target.value })}
                      className="w-full h-9 px-3 text-sm border rounded-md bg-background"
                    >
                      {['beginner', 'intermediate', 'advanced', 'expert'].map(l => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Available Resources</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {RESOURCE_OPTIONS.map(resource => (
                      <button
                        key={resource}
                        onClick={() => {
                          const has = formData.resources.includes(resource)
                          updateFormData({
                            resources: has
                              ? formData.resources.filter(r => r !== resource)
                              : [...formData.resources, resource]
                          })
                        }}
                        className={cn(
                          'text-xs px-2 py-1 rounded-full border transition-colors',
                          formData.resources.includes(resource)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                            : 'border-border text-muted-foreground hover:border-blue-300 hover:text-foreground'
                        )}
                      >
                        {resource}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Team & Purpose */}
          <AccordionItem value="team" className="border rounded-lg mb-2 px-4">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <span>Team & Purpose</span>
                {(formData.teamSize !== 'solo' || formData.purpose.length > 0) && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                    {formData.purpose.length + (formData.teamSize !== 'solo' ? 1 : 0)}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Team Size</Label>
                  <RadioGroup
                    value={formData.teamSize}
                    onValueChange={(v) => updateFormData({ teamSize: v as any })}
                    className="flex gap-4 mt-1"
                  >
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="solo" id="solo" />
                      <Label htmlFor="solo" className="text-sm">Solo</Label>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="small-team" id="small-team" />
                      <Label htmlFor="small-team" className="text-sm">Small team (2-5)</Label>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="large-team" id="large-team" />
                      <Label htmlFor="large-team" className="text-sm">Large team (6+)</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Research Purpose</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PURPOSE_OPTIONS.map(purpose => (
                      <button
                        key={purpose}
                        onClick={() => {
                          const has = formData.purpose.includes(purpose)
                          updateFormData({
                            purpose: has
                              ? formData.purpose.filter(p => p !== purpose)
                              : [...formData.purpose, purpose]
                          })
                        }}
                        className={cn(
                          'text-xs px-2 py-1 rounded-full border transition-colors',
                          formData.purpose.includes(purpose)
                            ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                            : 'border-border text-muted-foreground hover:border-green-300 hover:text-foreground'
                        )}
                      >
                        {purpose}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* === GENERATED QUESTIONS === */}
      {generatedQuestions.length > 0 && !researchPlan && (
        <div ref={resultsRef} className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Generated Questions</h2>
            <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isGenerating && 'animate-spin')} />
              Regenerate
            </Button>
          </div>

          {generatedQuestions.map((q, index) => {
            const scopeLabel = index === 0 ? 'Broad' : index === 1 ? 'Moderate' : 'Narrow'
            const isSelected = selectedQuestionIndex === index

            return (
              <Card
                key={index}
                className={cn(
                  'cursor-pointer transition-all',
                  isSelected
                    ? 'border-2 border-purple-500 shadow-md'
                    : 'border hover:border-purple-300 dark:hover:border-purple-600'
                )}
                onClick={() => setSelectedQuestionIndex(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Selection indicator */}
                    <div className={cn(
                      'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      isSelected
                        ? 'bg-purple-600 border-purple-600'
                        : 'border-gray-300 dark:border-gray-600'
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Question + scope + score */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <Badge variant="secondary" className="text-[10px] mb-1.5">{scopeLabel} Scope</Badge>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {q.question}
                          </p>
                        </div>
                        <div className="text-center flex-shrink-0">
                          <div className={cn(
                            'text-xl font-bold',
                            q.overallScore >= 80 ? 'text-green-600' :
                            q.overallScore >= 60 ? 'text-blue-600' :
                            'text-yellow-600'
                          )}>
                            {q.overallScore}
                          </div>
                          <div className="text-[10px] text-muted-foreground">score</div>
                        </div>
                      </div>

                      {/* Key variables */}
                      {q.keyVariables.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mb-2">
                          {q.keyVariables.map((v, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* SMART criteria inline */}
                      {Object.keys(q.smartAssessment).length > 0 && (
                        <div className="flex gap-2 flex-wrap text-[10px]">
                          {Object.entries(q.smartAssessment).map(([key, val]) => (
                            <span
                              key={key}
                              className={cn(
                                'inline-flex items-center gap-0.5',
                                val.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                              )}
                            >
                              {val.passed ? '✓' : '✗'}
                              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expanded details when selected */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                          {/* Hypotheses */}
                          {(q.nullHypothesis || q.alternativeHypothesis) && (
                            <div className="space-y-1.5 text-xs">
                              {q.nullHypothesis && (
                                <div>
                                  <span className="font-semibold text-blue-700 dark:text-blue-300">H₀: </span>
                                  <span className="text-muted-foreground">{q.nullHypothesis}</span>
                                </div>
                              )}
                              {q.alternativeHypothesis && (
                                <div>
                                  <span className="font-semibold text-blue-700 dark:text-blue-300">H₁: </span>
                                  <span className="text-muted-foreground">{q.alternativeHypothesis}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Data collection methods */}
                          {q.dataCollectionMethods.length > 0 && (
                            <div className="text-xs">
                              <span className="font-semibold">Data collection: </span>
                              <span className="text-muted-foreground">{q.dataCollectionMethods.join(', ')}</span>
                            </div>
                          )}

                          {/* Challenges */}
                          {q.potentialChallenges.length > 0 && (
                            <div className="text-xs">
                              <span className="font-semibold">Challenges: </span>
                              <span className="text-muted-foreground">{q.potentialChallenges.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Generate Plan CTA */}
          {selectedQuestionIndex !== null && (
            <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div>
                <p className="font-medium text-sm">Ready to plan this research?</p>
                <p className="text-xs text-muted-foreground">Generate a full methodology, timeline, and resource plan</p>
              </div>
              <Button
                onClick={handleGeneratePlan}
                disabled={isGeneratingPlan}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGeneratingPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Plan...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Research Plan
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* === RESEARCH PLAN === */}
      {researchPlan && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Research Plan</h2>
            <Button variant="ghost" size="sm" onClick={() => setResearchPlan(null)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Questions
            </Button>
          </div>
          <ResearchPlanDisplay plan={researchPlan} />
        </div>
      )}
    </div>
  )
}
