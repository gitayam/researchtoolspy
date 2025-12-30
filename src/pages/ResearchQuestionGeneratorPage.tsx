import { useState } from 'react'
import { Check, ArrowLeft, ArrowRight, Loader2, Sparkles, FileText, Upload, Wand2, BookOpen, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'
import ResearchPlanDisplay from '@/components/research/ResearchPlanDisplay'
import { useTranslation } from 'react-i18next'

interface FormData {
  // Step 1: Research Context & Team
  researchContext: 'academic' | 'osint' | 'investigation' | 'business' | 'journalism' | 'personal' | ''
  teamSize: 'solo' | 'small-team' | 'large-team'
  teamRoles: string[]

  // Step 2: Topic & Purpose
  topic: string
  purpose: string[]
  projectType: string

  // Step 3: 5 W's
  who: { population: string; subgroups?: string }
  what: { variables: string; expectedOutcome?: string }
  where: { location: string; specificSettings?: string }
  when: { timePeriod: string; studyType: 'cross-sectional' | 'longitudinal' | 'historical' | 'real-time' }
  why: { importance: string; beneficiaries?: string }

  // Step 4: Constraints
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

const RESEARCH_CONTEXTS = [
  {
    value: 'academic' as const,
    icon: '🎓',
    emphasizes: ['IRB approval', 'Literature review', 'Peer review', 'Methodology rigor']
  },
  {
    value: 'osint' as const,
    icon: '🔍',
    emphasizes: ['Source verification', 'OPSEC', 'Digital footprint', 'Attribution']
  },
  {
    value: 'investigation' as const,
    icon: '🕵️',
    emphasizes: ['Legal boundaries', 'Evidence chain', 'Client confidentiality', 'Surveillance ethics']
  },
  {
    value: 'business' as const,
    icon: '💼',
    emphasizes: ['ROI', 'Stakeholder analysis', 'Market trends', 'Risk assessment']
  },
  {
    value: 'journalism' as const,
    icon: '📰',
    emphasizes: ['Source protection', 'Fact verification', 'Public interest', 'Editorial standards']
  },
  {
    value: 'personal' as const,
    icon: '🌱',
    emphasizes: ['Flexible timeline', 'Community resources', 'Learning goals', 'Passion projects']
  }
]

export default function ResearchQuestionGeneratorPage() {
  const { t } = useTranslation(['researchQuestion', 'common'])
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null)
  const [researchQuestionId, setResearchQuestionId] = useState<string | null>(null)
  const [importedQuestion, setImportedQuestion] = useState('')
  const [aiRecommendTopic, setAiRecommendTopic] = useState('')
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)

  const STEPS = [
    { id: 0, title: t('researchQuestion:steps.0'), description: t('researchQuestion:stepDesc.0') },
    { id: 1, title: t('researchQuestion:steps.1'), description: t('researchQuestion:stepDesc.1') },
    { id: 2, title: t('researchQuestion:steps.2'), description: t('researchQuestion:stepDesc.2') },
    { id: 3, title: t('researchQuestion:steps.3'), description: t('researchQuestion:stepDesc.3') },
    { id: 4, title: t('researchQuestion:steps.4'), description: t('researchQuestion:stepDesc.4') },
    { id: 5, title: t('researchQuestion:steps.5'), description: t('researchQuestion:stepDesc.5') }
  ]

  const [formData, setFormData] = useState<FormData>({
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
    experienceLevel: 'intermediate'
  })

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/research/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          ...formData,
          saveToDatabase: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedQuestions(data.questions || [])
        setResearchQuestionId(data.researchQuestionId || null)
      } else {
        alert(t('researchQuestion:alerts.generateFailed'))
      }
    } catch (error) {
      console.error('Error generating questions:', error)
      alert(t('researchQuestion:alerts.error'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGeneratePlan = async () => {
    if (selectedQuestionIndex === null) return

    setIsGeneratingPlan(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const selectedQuestion = generatedQuestions[selectedQuestionIndex]

      const response = await fetch('/api/research/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          researchQuestionId,
          researchQuestion: selectedQuestion.question,
          duration: formData.duration,
          resources: formData.resources,
          experienceLevel: formData.experienceLevel,
          projectType: formData.projectType,
          fiveWs: {
            who: formData.who,
            what: formData.what,
            where: formData.where,
            when: formData.when,
            why: formData.why
          },
          researchContext: formData.researchContext,
          teamSize: formData.teamSize,
          teamRoles: formData.teamRoles
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResearchPlan(data.plan)
      } else {
        alert(t('researchQuestion:alerts.planFailed'))
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      alert(t('researchQuestion:alerts.error'))
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleImportQuestion = async () => {
    if (!importedQuestion.trim()) {
      alert(t('researchQuestion:alerts.importEmpty'))
      return
    }

    // Skip question generation and go straight to plan generation
    setIsGeneratingPlan(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')

      const response = await fetch('/api/research/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          researchQuestion: importedQuestion,
          duration: '3-6 months', // Default values for imported questions
          resources: [],
          experienceLevel: 'intermediate',
          projectType: 'General research',
          fiveWs: {
            who: { population: 'To be determined based on research scope' },
            what: { variables: 'To be determined based on research focus' },
            where: { location: 'To be determined based on research context' },
            when: { timePeriod: 'To be determined', studyType: 'cross-sectional' },
            why: { importance: 'As specified in research question' }
          },
          researchContext: 'academic', // Default to academic for imported questions
          teamSize: 'solo',
          teamRoles: []
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResearchPlan(data.plan)
        // Create a minimal question object for display
        const question: GeneratedQuestion = {
          question: importedQuestion,
          smartAssessment: {},
          finerAssessment: {},
          nullHypothesis: '',
          alternativeHypothesis: '',
          keyVariables: [],
          dataCollectionMethods: [],
          potentialChallenges: [],
          overallScore: 0
        }
        setGeneratedQuestions([question])
        setSelectedQuestionIndex(0)
        setCurrentStep(4)
      } else {
        alert(t('researchQuestion:alerts.planFailed'))
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      alert(t('researchQuestion:alerts.error'))
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleAIRecommend = async () => {
    if (!aiRecommendTopic.trim()) {
      alert(t('researchQuestion:alerts.recommendEmpty'))
      return
    }

    setIsLoadingRecommendations(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/research/recommend-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          topic: aiRecommendTopic,
          count: 3
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedQuestions(data.questions || [])
        setCurrentStep(4)
      } else {
        alert(t('researchQuestion:alerts.recommendFailed'))
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      alert(t('researchQuestion:alerts.error'))
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  const progressPercent = (currentStep / STEPS.length) * 100

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Button variant="outline" onClick={() => navigate('/dashboard')} size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('researchQuestion:backToDashboard')}
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
          {t('researchQuestion:title')}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
          {t('researchQuestion:subtitle')}
        </p>
      </div>

      {/* Progress Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${ currentStep > index + 1 ? 'bg-green-600 text-white' : currentStep === index + 1 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>
                      {currentStep > index + 1 ? <Check className="h-5 w-5" /> : step.id}
                    </div>
                    <div className="text-center mt-2 hidden sm:block">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{step.description}</div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 ${ currentStep > index + 1 ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 0 && (
        <Step0QuickStart
          importedQuestion={importedQuestion}
          setImportedQuestion={setImportedQuestion}
          aiRecommendTopic={aiRecommendTopic}
          setAiRecommendTopic={setAiRecommendTopic}
          isLoadingRecommendations={isLoadingRecommendations}
          isGeneratingPlan={isGeneratingPlan}
          onStartWizard={() => setCurrentStep(1)}
          onImportQuestion={handleImportQuestion}
          onAIRecommend={handleAIRecommend}
        />
      )}
      {currentStep === 1 && (
        <Step1ResearchContext formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 2 && (
        <Step1TopicContext formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 3 && (
        <Step2FiveWs formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 4 && (
        <Step3Resources formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 5 && (
        <Step4Generate
          formData={formData}
          isGenerating={isGenerating}
          generatedQuestions={generatedQuestions}
          selectedQuestionIndex={selectedQuestionIndex}
          onGenerate={handleGenerate}
          onSelectQuestion={setSelectedQuestionIndex}
          isGeneratingPlan={isGeneratingPlan}
          onGeneratePlan={handleGeneratePlan}
          researchPlan={researchPlan}
        />
      )}

      {/* Navigation */}
      {currentStep < 5 && currentStep !== 0 && (
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common:back')}
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !formData.researchContext) ||
              (currentStep === 2 && (!formData.topic || !formData.projectType)) ||
              (currentStep === 3 && (!formData.who.population || !formData.what.variables || !formData.where.location || !formData.when.timePeriod || !formData.why.importance))
            }
          >
            {t('common:next')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Step 0: Quick Start
function Step0QuickStart({
  importedQuestion,
  setImportedQuestion,
  aiRecommendTopic,
  setAiRecommendTopic,
  isLoadingRecommendations,
  isGeneratingPlan,
  onStartWizard,
  onImportQuestion,
  onAIRecommend
}: {
  importedQuestion: string
  setImportedQuestion: (value: string) => void
  aiRecommendTopic: string
  setAiRecommendTopic: (value: string) => void
  isLoadingRecommendations: boolean
  isGeneratingPlan: boolean
  onStartWizard: () => void
  onImportQuestion: () => void
  onAIRecommend: () => void
}) {
  const { t } = useTranslation(['researchQuestion'])

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">{t('researchQuestion:quickStart.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('researchQuestion:quickStart.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Start Wizard */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <BookOpen className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <CardTitle className="text-center">{t('researchQuestion:quickStart.wizard.title')}</CardTitle>
            <CardDescription className="text-center">
              {t('researchQuestion:quickStart.wizard.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onStartWizard} className="w-full bg-purple-600 hover:bg-purple-700">
              <BookOpen className="h-4 w-4 mr-2" />
              {t('researchQuestion:quickStart.wizard.button')}
            </Button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              {t('researchQuestion:quickStart.wizard.bestFor')}
            </p>
          </CardContent>
        </Card>

        {/* Import Question */}
        <Card className="hover:shadow-lg transition-shadow border-2 hover:border-blue-500">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-center">{t('researchQuestion:quickStart.import.title')}</CardTitle>
            <CardDescription className="text-center">
              {t('researchQuestion:quickStart.import.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={t('researchQuestion:quickStart.import.placeholder')}
              value={importedQuestion}
              onChange={(e) => setImportedQuestion(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <Button
              onClick={onImportQuestion}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!importedQuestion.trim() || isGeneratingPlan}
            >
              {isGeneratingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('researchQuestion:quickStart.import.loading')}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t('researchQuestion:quickStart.import.button')}
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {t('researchQuestion:quickStart.import.bestFor')}
            </p>
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card className="hover:shadow-lg transition-shadow border-2 hover:border-green-500">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Wand2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-center">{t('researchQuestion:quickStart.ai.title')}</CardTitle>
            <CardDescription className="text-center">
              {t('researchQuestion:quickStart.ai.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={t('researchQuestion:quickStart.ai.placeholder')}
              value={aiRecommendTopic}
              onChange={(e) => setAiRecommendTopic(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <Button
              onClick={onAIRecommend}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!aiRecommendTopic.trim() || isLoadingRecommendations}
            >
              {isLoadingRecommendations ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('researchQuestion:quickStart.ai.loading')}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {t('researchQuestion:quickStart.ai.button')}
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {t('researchQuestion:quickStart.ai.bestFor')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Step 1: Research Context & Team
function Step1ResearchContext({
  formData,
  updateFormData
}: {
  formData: FormData
  updateFormData: (updates: Partial<FormData>) => void
}) {
  const { t } = useTranslation(['researchQuestion'])

  return (
    <div className="space-y-6">
      {/* Research Context Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('researchQuestion:context.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {RESEARCH_CONTEXTS.map(context => (
            <Card
              key={context.value}
              className={`cursor-pointer transition-all ${ formData.researchContext === context.value ? 'border-purple-500 border-2 shadow-lg' : 'border-gray-200 hover:border-purple-300 dark:border-gray-700 dark:hover:border-purple-500'}`}
              onClick={() => updateFormData({ researchContext: context.value })}
            >
              <CardHeader>
                <div className="text-4xl mb-2">{context.icon}</div>
                <CardTitle>{t(`researchQuestion:contexts.${context.value}.label`)}</CardTitle>
                <CardDescription>{t(`researchQuestion:contexts.${context.value}.description`)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{t('researchQuestion:context.emphasizes')}</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {context.emphasizes.slice(0, 3).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Team Structure - Only show after context selected */}
      {formData.researchContext && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              {t('researchQuestion:context.teamStructure')}
            </h3>
            <RadioGroup
              value={formData.teamSize}
              onValueChange={(v) => updateFormData({ teamSize: v as any })}
            >
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="solo" id="solo" />
                <Label htmlFor="solo">{t('researchQuestion:context.solo')}</Label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="small-team" id="small-team" />
                <Label htmlFor="small-team">{t('researchQuestion:context.smallTeam')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="large-team" id="large-team" />
                <Label htmlFor="large-team">{t('researchQuestion:context.largeTeam')}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Team Roles - Only for teams */}
          {formData.teamSize !== 'solo' && (
            <div>
              <Label htmlFor="team-roles">{t('researchQuestion:context.teamRoles')}</Label>
              <Textarea
                id="team-roles"
                placeholder={t('researchQuestion:context.teamRolesPlaceholder')}
                value={formData.teamRoles.join('\n')}
                onChange={(e) => updateFormData({
                  teamRoles: e.target.value.split('\n').filter(r => r.trim())
                })}
                rows={6}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('researchQuestion:context.teamRolesDesc')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Step 2: Topic & Purpose (was Step 1)
function Step1TopicContext({ formData, updateFormData }: {
  formData: FormData
  updateFormData: (updates: Partial<FormData>) => void
}) {
  const { t } = useTranslation(['researchQuestion'])
  const purposes = ['Exploratory', 'Descriptive', 'Explanatory', 'Evaluative', 'Policy-oriented', 'Applied research', 'Academic research']
  const projectTypes = ['Academic thesis/dissertation', 'Journal article', 'Policy report', 'Grant proposal', 'Consulting project', 'Internal research', 'Other']

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('researchQuestion:topic.title')}</CardTitle>
        <CardDescription>{t('researchQuestion:topic.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:topic.topicLabel')}
          </label>
          <textarea
            value={formData.topic}
            onChange={(e) => updateFormData({ topic: e.target.value })}
            placeholder={t('researchQuestion:topic.topicPlaceholder')}
            className="w-full p-3 border rounded-lg min-h-[100px] dark:bg-gray-800 dark:border-gray-700"
          />
          <p className="text-xs text-gray-500 mt-1">{t('researchQuestion:topic.topicHint')}</p>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:topic.purposeLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {purposes.map(purpose => (
              <label key={purpose} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.purpose.includes(purpose)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateFormData({ purpose: [...formData.purpose, purpose] })
                    } else {
                      updateFormData({ purpose: formData.purpose.filter(p => p !== purpose) })
                    }
                  }}
                />
                <span className="text-sm">{purpose}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Project Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:topic.projectTypeLabel')}
          </label>
          <select
            value={formData.projectType}
            onChange={(e) => updateFormData({ projectType: e.target.value })}
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">{t('researchQuestion:topic.projectTypePlaceholder')}</option>
            {projectTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 2: The 5 W's
function Step2FiveWs({ formData, updateFormData }: {
  formData: FormData
  updateFormData: (updates: Partial<FormData>) => void
}) {
  const { t } = useTranslation(['researchQuestion'])
  const studyTypes: Array<'cross-sectional' | 'longitudinal' | 'historical' | 'real-time'> = ['cross-sectional', 'longitudinal', 'historical', 'real-time']

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('researchQuestion:fiveWs.title')}</CardTitle>
        <CardDescription>{t('researchQuestion:fiveWs.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* WHO */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            {t('researchQuestion:fiveWs.who.label')}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.who.focusLabel')}
            </label>
            <input
              type="text"
              value={formData.who.population}
              onChange={(e) => updateFormData({ who: { ...formData.who, population: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.who.focusPlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.who.subgroupsLabel')}
            </label>
            <input
              type="text"
              value={formData.who.subgroups || ''}
              onChange={(e) => updateFormData({ who: { ...formData.who, subgroups: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.who.subgroupsPlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* WHAT */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            {t('researchQuestion:fiveWs.what.label')}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.what.variablesLabel')}
            </label>
            <textarea
              value={formData.what.variables}
              onChange={(e) => updateFormData({ what: { ...formData.what, variables: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.what.variablesPlaceholder')}
              className="w-full p-3 border rounded-lg min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.what.outcomeLabel')}
            </label>
            <input
              type="text"
              value={formData.what.expectedOutcome || ''}
              onChange={(e) => updateFormData({ what: { ...formData.what, expectedOutcome: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.what.outcomePlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* WHERE */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            {t('researchQuestion:fiveWs.where.label')}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.where.locationLabel')}
            </label>
            <input
              type="text"
              value={formData.where.location}
              onChange={(e) => updateFormData({ where: { ...formData.where, location: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.where.locationPlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.where.settingsLabel')}
            </label>
            <input
              type="text"
              value={formData.where.specificSettings || ''}
              onChange={(e) => updateFormData({ where: { ...formData.where, specificSettings: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.where.settingsPlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* WHEN */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            {t('researchQuestion:fiveWs.when.label')}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.when.timeLabel')}
            </label>
            <input
              type="text"
              value={formData.when.timePeriod}
              onChange={(e) => updateFormData({ when: { ...formData.when, timePeriod: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.when.timePlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.when.studyTypeLabel')}
            </label>
            <select
              value={formData.when.studyType}
              onChange={(e) => updateFormData({ when: { ...formData.when, studyType: e.target.value as any } })}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              {studyTypes.map(type => (
                <option key={type} value={type}>{type.replace('-', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* WHY */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            {t('researchQuestion:fiveWs.why.label')}
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.why.importanceLabel')}
            </label>
            <textarea
              value={formData.why.importance}
              onChange={(e) => updateFormData({ why: { ...formData.why, importance: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.why.importancePlaceholder')}
              className="w-full p-3 border rounded-lg min-h-[100px] dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('researchQuestion:fiveWs.why.beneficiariesLabel')}
            </label>
            <input
              type="text"
              value={formData.why.beneficiaries || ''}
              onChange={(e) => updateFormData({ why: { ...formData.why, beneficiaries: e.target.value } })}
              placeholder={t('researchQuestion:fiveWs.why.beneficiariesPlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 3: Resources & Constraints
function Step3Resources({ formData, updateFormData }: {
  formData: FormData
  updateFormData: (updates: Partial<FormData>) => void
}) {
  const { t } = useTranslation(['researchQuestion'])
  const [showCustomDuration, setShowCustomDuration] = useState(false)
  const [customDuration, setCustomDuration] = useState('')

  const durations = ['1 day', '2-7 days', '1-2 weeks', '2-4 weeks', '1-3 months', '3-6 months', '6-12 months', '1-2 years', '2+ years', 'Flexible/No deadline', 'Custom']
  const resourceOptions = [
    'Existing datasets',
    'Survey tools',
    'Research assistants',
    'Statistical software',
    'Funding for data collection',
    'Access to participants/subjects',
    'Lab facilities',
    'Institutional support'
  ]
  const experienceLevels = ['beginner', 'intermediate', 'advanced', 'expert']

  const handleDurationChange = (value: string) => {
    if (value === 'Custom') {
      setShowCustomDuration(true)
      updateFormData({ duration: customDuration })
    } else {
      setShowCustomDuration(false)
      updateFormData({ duration: value })
    }
  }

  const handleCustomDurationChange = (value: string) => {
    setCustomDuration(value)
    updateFormData({ duration: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('researchQuestion:resources.title')}</CardTitle>
        <CardDescription>{t('researchQuestion:resources.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:resources.durationLabel')}
          </label>
          <select
            value={showCustomDuration ? 'Custom' : formData.duration}
            onChange={(e) => handleDurationChange(e.target.value)}
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">{t('researchQuestion:resources.durationPlaceholder')}</option>
            {durations.map(duration => (
              <option key={duration} value={duration}>{duration}</option>
            ))}
          </select>
          {showCustomDuration && (
            <input
              type="text"
              value={customDuration}
              onChange={(e) => handleCustomDurationChange(e.target.value)}
              placeholder={t('researchQuestion:resources.customDurationPlaceholder')}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 mt-2"
            />
          )}
        </div>

        {/* Resources */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:resources.resourcesLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resourceOptions.map(resource => (
              <label key={resource} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.resources.includes(resource)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateFormData({ resources: [...formData.resources, resource] })
                    } else {
                      updateFormData({ resources: formData.resources.filter(r => r !== resource) })
                    }
                  }}
                />
                <span className="text-sm">{resource}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:resources.experienceLabel')}
          </label>
          <select
            value={formData.experienceLevel}
            onChange={(e) => updateFormData({ experienceLevel: e.target.value })}
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            {experienceLevels.map(level => (
              <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Constraints */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:resources.constraintsLabel')}
          </label>
          <textarea
            value={formData.constraints || ''}
            onChange={(e) => updateFormData({ constraints: e.target.value })}
            placeholder={t('researchQuestion:resources.constraintsPlaceholder')}
            className="w-full p-3 border rounded-lg min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
          />
        </div>

        {/* Ethical Considerations */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('researchQuestion:resources.ethicalLabel')}
          </label>
          <textarea
            value={formData.ethicalConsiderations || ''}
            onChange={(e) => updateFormData({ ethicalConsiderations: e.target.value })}
            placeholder={t('researchQuestion:resources.ethicalPlaceholder')}
            className="w-full p-3 border rounded-lg min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Step 4: Generate
function Step4Generate({ formData, isGenerating, generatedQuestions, selectedQuestionIndex, onGenerate, onSelectQuestion, isGeneratingPlan, onGeneratePlan, researchPlan }: {
  formData: FormData
  isGenerating: boolean
  generatedQuestions: GeneratedQuestion[]
  selectedQuestionIndex: number | null
  onGenerate: () => void
  onSelectQuestion: (index: number) => void
  isGeneratingPlan: boolean
  onGeneratePlan: () => void
  researchPlan: ResearchPlan | null
}) {
  const { t } = useTranslation(['researchQuestion'])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('researchQuestion:generate.reviewTitle')}</CardTitle>
          <CardDescription>{t('researchQuestion:generate.summary')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generated Sentence */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100 leading-relaxed">
              {t('researchQuestion:generate.sentence', {
                projectType: formData.projectType.toLowerCase(),
                topic: formData.topic,
                population: formData.who.population,
                location: formData.where.location,
                timePeriod: formData.when.timePeriod,
                variables: formData.what.variables,
                importance: formData.why.importance.toLowerCase()
              })}
            </p>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.topic')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.topic}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.projectType')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.projectType}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.who')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.who.population}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.what')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.what.variables}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.where')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.where.location}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.when')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.when.timePeriod}</span>
            </div>
            <div className="md:col-span-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.why')}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.why.importance}</span>
            </div>
            {formData.duration && (
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{t('researchQuestion:generate.labels.duration')}</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">{formData.duration}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      {generatedQuestions.length === 0 && (
        <div className="text-center">
          <Button
            onClick={onGenerate}
            disabled={isGenerating}
            size="lg"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {t('researchQuestion:generate.loading')}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                {t('researchQuestion:generate.button')}
              </>
            )}
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            {t('researchQuestion:generate.aiHint')}
          </p>
        </div>
      )}

      {/* Generated Questions */}
      {generatedQuestions.length > 0 && !researchPlan && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">{t('researchQuestion:generate.resultsTitle')}</h3>
          {generatedQuestions.map((q, index) => (
            <QuestionCard
              key={index}
              question={q}
              index={index}
              isSelected={selectedQuestionIndex === index}
              onSelect={() => onSelectQuestion(index)}
            />
          ))}

          {/* Generate Plan Button */}
          {selectedQuestionIndex !== null && (
            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <h4 className="text-lg font-semibold">{t('researchQuestion:generate.planTitle')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('researchQuestion:generate.planDesc')}
                  </p>
                  <Button
                    onClick={onGeneratePlan}
                    disabled={isGeneratingPlan}
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {t('researchQuestion:generate.planLoading')}
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        {t('researchQuestion:generate.planButton')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Research Plan Display */}
      {researchPlan && (
        <ResearchPlanDisplay plan={researchPlan} />
      )}
    </div>
  )
}

// Question Card Component
function QuestionCard({ question, index, isSelected, onSelect }: {
  question: GeneratedQuestion
  index: number
  isSelected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation(['researchQuestion'])
  const scopeLabel = index === 0 ? 'broad' : index === 1 ? 'moderate' : 'narrow'

  return (
    <Card className={`border-2 ${isSelected ? 'border-purple-600' : 'border-gray-200'}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">
              Question {index + 1} - {t(`researchQuestion:questionCard.scope.${scopeLabel}`)} Scope
            </CardTitle>
            <p className="text-gray-900 dark:text-white mt-2 font-medium">{question.question}</p>
          </div>
          <div className="ml-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{question.overallScore}</div>
              <div className="text-xs text-gray-500">{t('researchQuestion:questionCard.score')}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hypotheses */}
        <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div>
            <span className="font-semibold text-blue-900 dark:text-blue-200">{t('researchQuestion:questionCard.nullHypothesis')}</span>
            <p className="text-gray-700 dark:text-gray-300">{question.nullHypothesis}</p>
          </div>
          <div>
            <span className="font-semibold text-blue-900 dark:text-blue-200">{t('researchQuestion:questionCard.alternativeHypothesis')}</span>
            <p className="text-gray-700 dark:text-gray-300">{question.alternativeHypothesis}</p>
          </div>
        </div>

        {/* Key Variables */}
        <div>
          <span className="font-semibold">{t('researchQuestion:questionCard.keyVariables')}</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {question.keyVariables.map((v, i) => (
              <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">{v}</span>
            ))}
          </div>
        </div>

        {/* SMART Assessment */}
        <div>
          <span className="font-semibold block mb-2">{t('researchQuestion:questionCard.smartCriteria')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(question.smartAssessment).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={value.passed ? 'text-green-600' : 'text-red-600'}>
                  {value.passed ? '✓' : '✗'}
                </span>
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Select Button */}
        <Button
          onClick={onSelect}
          variant={isSelected ? 'default' : 'outline'}
          className="w-full"
        >
          {isSelected ? <Check className="h-4 w-4 mr-2" /> : null}
          {isSelected ? t('researchQuestion:questionCard.selected') : t('researchQuestion:questionCard.select')}
        </Button>
      </CardContent>
    </Card>
  )
}