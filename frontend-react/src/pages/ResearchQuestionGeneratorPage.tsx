import { useState } from 'react'
import { Check, ArrowLeft, ArrowRight, Loader2, Sparkles, FileText, Upload, Wand2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useNavigate } from 'react-router-dom'
import ResearchPlanDisplay from '@/components/research/ResearchPlanDisplay'

interface FormData {
  // Step 1: Basic Context
  topic: string
  purpose: string[]
  projectType: string

  // Step 2: 5 W's
  who: { population: string; subgroups?: string }
  what: { variables: string; expectedOutcome?: string }
  where: { location: string; specificSettings?: string }
  when: { timePeriod: string; studyType: 'cross-sectional' | 'longitudinal' | 'historical' | 'real-time' }
  why: { importance: string; beneficiaries?: string }

  // Step 3: Constraints
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

const STEPS = [
  { id: 0, title: 'Quick Start', description: 'Choose how to begin' },
  { id: 1, title: 'Topic & Purpose', description: 'Define your research area' },
  { id: 2, title: 'The 5 W\'s', description: 'Who, What, Where, When, Why' },
  { id: 3, title: 'Resources & Constraints', description: 'Timeline and limitations' },
  { id: 4, title: 'Review & Generate', description: 'Generate research questions' }
]

export default function ResearchQuestionGeneratorPage() {
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

  const [formData, setFormData] = useState<FormData>({
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
        alert('Failed to generate questions. Please try again.')
      }
    } catch (error) {
      console.error('Error generating questions:', error)
      alert('An error occurred. Please try again.')
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
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResearchPlan(data.plan)
      } else {
        alert('Failed to generate research plan. Please try again.')
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleImportQuestion = () => {
    if (!importedQuestion.trim()) {
      alert('Please enter a research question')
      return
    }
    // Create a question object from imported text
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
  }

  const handleAIRecommend = async () => {
    if (!aiRecommendTopic.trim()) {
      alert('Please enter a topic or area of interest')
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
        alert('Failed to generate recommendations. Please try again.')
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      alert('An error occurred. Please try again.')
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
          Back to Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
          Research Question Generator
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
          Generate high-quality research questions following SMART and FINER criteria
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
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep > index + 1 ? 'bg-green-600 text-white' :
                      currentStep === index + 1 ? 'bg-purple-600 text-white' :
                      'bg-gray-200 text-gray-500 dark:bg-gray-700'
                    }`}>
                      {currentStep > index + 1 ? <Check className="h-5 w-5" /> : step.id}
                    </div>
                    <div className="text-center mt-2 hidden sm:block">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{step.description}</div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 ${
                      currentStep > index + 1 ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
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
          onStartWizard={() => setCurrentStep(1)}
          onImportQuestion={handleImportQuestion}
          onAIRecommend={handleAIRecommend}
        />
      )}
      {currentStep === 1 && (
        <Step1TopicContext formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 2 && (
        <Step2FiveWs formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 3 && (
        <Step3Resources formData={formData} updateFormData={updateFormData} />
      )}
      {currentStep === 4 && (
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
      {currentStep < 4 && currentStep !== 0 && (
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && (!formData.topic || !formData.projectType)) ||
              (currentStep === 2 && (!formData.who.population || !formData.what.variables || !formData.where.location || !formData.when.timePeriod || !formData.why.importance))
            }
          >
            Next
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
  onStartWizard,
  onImportQuestion,
  onAIRecommend
}: {
  importedQuestion: string
  setImportedQuestion: (value: string) => void
  aiRecommendTopic: string
  setAiRecommendTopic: (value: string) => void
  isLoadingRecommendations: boolean
  onStartWizard: () => void
  onImportQuestion: () => void
  onAIRecommend: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">How would you like to start?</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose your preferred way to create a research question
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
            <CardTitle className="text-center">Start Wizard</CardTitle>
            <CardDescription className="text-center">
              Step-by-step guided process to craft your research question
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onStartWizard} className="w-full bg-purple-600 hover:bg-purple-700">
              <BookOpen className="h-4 w-4 mr-2" />
              Begin Guided Process
            </Button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Best for: Comprehensive planning
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
            <CardTitle className="text-center">Import Question</CardTitle>
            <CardDescription className="text-center">
              Already have a research question? Paste it here to start
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste your research question here..."
              value={importedQuestion}
              onChange={(e) => setImportedQuestion(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <Button
              onClick={onImportQuestion}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={!importedQuestion.trim()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import & Continue
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Best for: Quick start with existing questions
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
            <CardTitle className="text-center">AI Recommend</CardTitle>
            <CardDescription className="text-center">
              Get AI-generated research question suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Describe your topic or area of interest..."
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
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Get Recommendations
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Best for: Exploring new research ideas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Step 1: Topic & Purpose
function Step1TopicContext({ formData, updateFormData }: {
  formData: FormData
  updateFormData: (updates: Partial<FormData>) => void
}) {
  const purposes = ['Exploratory', 'Descriptive', 'Explanatory', 'Evaluative', 'Policy-oriented', 'Applied research', 'Academic research']
  const projectTypes = ['Academic thesis/dissertation', 'Journal article', 'Policy report', 'Grant proposal', 'Consulting project', 'Internal research', 'Other']

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic & Purpose</CardTitle>
        <CardDescription>Define your research area and objectives</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What is your general area of interest or research topic? *
          </label>
          <textarea
            value={formData.topic}
            onChange={(e) => updateFormData({ topic: e.target.value })}
            placeholder="Example: Social media impact on mental health in young adults"
            className="w-full p-3 border rounded-lg min-h-[100px] dark:bg-gray-800 dark:border-gray-700"
          />
          <p className="text-xs text-gray-500 mt-1">Be as specific or broad as you like - we'll help refine it</p>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What is the purpose of this research? (Select all that apply)
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
            What type of project is this? *
          </label>
          <select
            value={formData.projectType}
            onChange={(e) => updateFormData({ projectType: e.target.value })}
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">Select a project type...</option>
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
  const studyTypes: Array<'cross-sectional' | 'longitudinal' | 'historical' | 'real-time'> = ['cross-sectional', 'longitudinal', 'historical', 'real-time']

  return (
    <Card>
      <CardHeader>
        <CardTitle>The 5 W's</CardTitle>
        <CardDescription>Define Who, What, Where, When, and Why</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* WHO */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            Who
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              Who or what is the focus of your research? *
            </label>
            <input
              type="text"
              value={formData.who.population}
              onChange={(e) => updateFormData({ who: { ...formData.who, population: e.target.value } })}
              placeholder="Example: Young adults aged 18-25"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Specific subgroups to compare? (Optional)
            </label>
            <input
              type="text"
              value={formData.who.subgroups || ''}
              onChange={(e) => updateFormData({ who: { ...formData.who, subgroups: e.target.value } })}
              placeholder="Example: Male vs female, urban vs rural"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* WHAT */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            What
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              What variables, behaviors, or phenomena will you study? *
            </label>
            <textarea
              value={formData.what.variables}
              onChange={(e) => updateFormData({ what: { ...formData.what, variables: e.target.value } })}
              placeholder="Example: Social media usage time, anxiety levels, depression symptoms"
              className="w-full p-3 border rounded-lg min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Expected relationship or outcome? (Optional)
            </label>
            <input
              type="text"
              value={formData.what.expectedOutcome || ''}
              onChange={(e) => updateFormData({ what: { ...formData.what, expectedOutcome: e.target.value } })}
              placeholder="Example: Increased social media use leads to higher anxiety"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* WHERE */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            Where
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              Where will this research take place? *
            </label>
            <input
              type="text"
              value={formData.where.location}
              onChange={(e) => updateFormData({ where: { ...formData.where, location: e.target.value } })}
              placeholder="Example: United States, Online platforms, Rural Southeast Asia"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Specific settings or contexts? (Optional)
            </label>
            <input
              type="text"
              value={formData.where.specificSettings || ''}
              onChange={(e) => updateFormData({ where: { ...formData.where, specificSettings: e.target.value } })}
              placeholder="Example: University campuses, Healthcare facilities"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* WHEN */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 rounded-full w-8 h-8 flex items-center justify-center text-sm">W</span>
            When
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              What time period will your research cover? *
            </label>
            <input
              type="text"
              value={formData.when.timePeriod}
              onChange={(e) => updateFormData({ when: { ...formData.when, timePeriod: e.target.value } })}
              placeholder="Example: 2020-2024, Next 6 months, Past decade"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Study type
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
            Why
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">
              Why is this research important? *
            </label>
            <textarea
              value={formData.why.importance}
              onChange={(e) => updateFormData({ why: { ...formData.why, importance: e.target.value } })}
              placeholder="Example: Mental health issues are rising among young adults, and understanding the role of social media can inform interventions"
              className="w-full p-3 border rounded-lg min-h-[100px] dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Who will benefit from this research? (Optional)
            </label>
            <input
              type="text"
              value={formData.why.beneficiaries || ''}
              onChange={(e) => updateFormData({ why: { ...formData.why, beneficiaries: e.target.value } })}
              placeholder="Example: Policymakers, Healthcare providers, Educators"
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
        <CardTitle>Resources & Constraints</CardTitle>
        <CardDescription>Define your timeline, resources, and limitations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-2">
            How long do you have to complete this research?
          </label>
          <select
            value={showCustomDuration ? 'Custom' : formData.duration}
            onChange={(e) => handleDurationChange(e.target.value)}
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">Select duration...</option>
            {durations.map(duration => (
              <option key={duration} value={duration}>{duration}</option>
            ))}
          </select>
          {showCustomDuration && (
            <input
              type="text"
              value={customDuration}
              onChange={(e) => handleCustomDurationChange(e.target.value)}
              placeholder="Enter custom duration (e.g., 3 days, 5 hours)"
              className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 mt-2"
            />
          )}
        </div>

        {/* Resources */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What resources do you have access to? (Check all that apply)
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
            What is your research experience level?
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
            Are there areas or topics you want to avoid? (Optional)
          </label>
          <textarea
            value={formData.constraints || ''}
            onChange={(e) => updateFormData({ constraints: e.target.value })}
            placeholder="Example: Sensitive personal data, High-cost experiments, Restricted populations"
            className="w-full p-3 border rounded-lg min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
          />
        </div>

        {/* Ethical Considerations */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Are there any ethical considerations? (Optional)
          </label>
          <textarea
            value={formData.ethicalConsiderations || ''}
            onChange={(e) => updateFormData({ ethicalConsiderations: e.target.value })}
            placeholder="Example: Vulnerable populations, privacy concerns, potential harm"
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
  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Review Your Inputs</CardTitle>
          <CardDescription>Research Summary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generated Sentence */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100 leading-relaxed">
              A {formData.projectType.toLowerCase()} investigating{' '}
              <span className="font-semibold">{formData.topic}</span>,{' '}
              focusing on <span className="font-semibold">{formData.who.population}</span> in{' '}
              <span className="font-semibold">{formData.where.location}</span> during{' '}
              <span className="font-semibold">{formData.when.timePeriod}</span>, by examining{' '}
              <span className="font-semibold">{formData.what.variables}</span>{' '}
              to understand {formData.why.importance.toLowerCase()}.
            </p>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Topic:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.topic}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Project Type:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.projectType}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Who:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.who.population}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">What:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.what.variables}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Where:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.where.location}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">When:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.when.timePeriod}</span>
            </div>
            <div className="md:col-span-2">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Why:</span>{' '}
              <span className="text-gray-600 dark:text-gray-400">{formData.why.importance}</span>
            </div>
            {formData.duration && (
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Duration:</span>{' '}
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
                Generating Questions...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Research Questions
              </>
            )}
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            AI will generate 3 research questions with SMART & FINER assessments
          </p>
        </div>
      )}

      {/* Generated Questions */}
      {generatedQuestions.length > 0 && !researchPlan && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Generated Research Questions</h3>
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
                  <h4 className="text-lg font-semibold">Ready to create your research plan?</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Generate a comprehensive, actionable research plan tailored to your selected question
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
                        Generating Research Plan...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        Generate Research Plan
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
  return (
    <Card className={`border-2 ${isSelected ? 'border-purple-600' : 'border-gray-200'}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">
              Question {index + 1} - {index === 0 ? 'Broad' : index === 1 ? 'Moderate' : 'Narrow'} Scope
            </CardTitle>
            <p className="text-gray-900 dark:text-white mt-2 font-medium">{question.question}</p>
          </div>
          <div className="ml-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{question.overallScore}</div>
              <div className="text-xs text-gray-500">Score</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hypotheses */}
        <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div>
            <span className="font-semibold text-blue-900 dark:text-blue-200">Null Hypothesis (H₀):</span>
            <p className="text-gray-700 dark:text-gray-300">{question.nullHypothesis}</p>
          </div>
          <div>
            <span className="font-semibold text-blue-900 dark:text-blue-200">Alternative Hypothesis (H₁):</span>
            <p className="text-gray-700 dark:text-gray-300">{question.alternativeHypothesis}</p>
          </div>
        </div>

        {/* Key Variables */}
        <div>
          <span className="font-semibold">Key Variables:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {question.keyVariables.map((v, i) => (
              <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">{v}</span>
            ))}
          </div>
        </div>

        {/* SMART Assessment */}
        <div>
          <span className="font-semibold block mb-2">SMART Criteria:</span>
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
          {isSelected ? 'Selected' : 'Select This Question'}
        </Button>
      </CardContent>
    </Card>
  )
}
