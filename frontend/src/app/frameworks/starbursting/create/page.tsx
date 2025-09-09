/**
 * Public Starbursting Create Page
 * 
 * Starbursting technique for systematic question generation and analysis
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Save, 
  Star, 
  Trash2, 
  ArrowLeft,
  Calculator,
  BarChart3,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Scale,
  Download,
  FileText,
  FileSpreadsheet,
  Presentation,
  Brain,
  Lightbulb,
  Search,
  Target
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
import { useIsAuthenticated } from '@/stores/auth'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface StarburstingQuestion {
  id: string
  category: 'who' | 'what' | 'when' | 'where' | 'why' | 'how'
  question: string
  importance: number
  answered: boolean
  answer: string
  follow_up_questions: string[]
}

interface StarburstingData {
  central_topic: string
  questions: StarburstingQuestion[]
  context: string
  analysis_date: Date
}

const QUESTION_CATEGORIES = [
  { value: 'who', label: 'Who', color: 'bg-red-500', icon: '👥' },
  { value: 'what', label: 'What', color: 'bg-blue-500', icon: '📝' },
  { value: 'when', label: 'When', color: 'bg-green-500', icon: '⏰' },
  { value: 'where', label: 'Where', color: 'bg-orange-500', icon: '📍' },
  { value: 'why', label: 'Why', color: 'bg-purple-500', icon: '🎯' },
  { value: 'how', label: 'How', color: 'bg-pink-500', icon: '⚙️' }
]

const SAMPLE_QUESTIONS = {
  who: [
    'Who are the key stakeholders?',
    'Who will be affected by this?',
    'Who has the authority to decide?',
    'Who has expertise in this area?'
  ],
  what: [
    'What is the main objective?',
    'What are the potential risks?',
    'What resources are needed?',
    'What are the success criteria?'
  ],
  when: [
    'When is the deadline?',
    'When should we start?',
    'When will we see results?',
    'When are the key milestones?'
  ],
  where: [
    'Where will this take place?',
    'Where can we find resources?',
    'Where are the potential obstacles?',
    'Where should we focus first?'
  ],
  why: [
    'Why is this important?',
    'Why should we do this now?',
    'Why not take an alternative approach?',
    'Why might this fail?'
  ],
  how: [
    'How will we measure success?',
    'How will we implement this?',
    'How much will it cost?',
    'How will we handle challenges?'
  ]
}

export default function StarburstingCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  const [sessionId] = useState(() => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [data, setData] = useState<StarburstingData>({
    central_topic: '',
    questions: [],
    context: '',
    analysis_date: new Date()
  })
  const [title, setTitle] = useState('Starbursting Analysis')
  const [saving, setSaving] = useState(false)
  const [questionsExpanded, setQuestionsExpanded] = useState(true)
  const [analysisExpanded, setAnalysisExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  
  const updateData = (updater: (prev: StarburstingData) => StarburstingData | StarburstingData) => {
    if (typeof updater === 'function') {
      setData(prev => updater(prev))
    } else {
      setData(updater)
    }
  }
  
  const hasData = data.questions.length > 0 || data.central_topic.trim() || data.context.trim()

  // Add question
  const addQuestion = (category?: string) => {
    const newQuestion: StarburstingQuestion = {
      id: `q_${Date.now()}`,
      category: (category || selectedCategory || 'what') as any,
      question: '',
      importance: 3,
      answered: false,
      answer: '',
      follow_up_questions: []
    }
    
    updateData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
  }

  // Add sample questions for category
  const addSampleQuestions = (category: string) => {
    const samples = SAMPLE_QUESTIONS[category as keyof typeof SAMPLE_QUESTIONS]
    const newQuestions = samples.map((q, index) => ({
      id: `sample_${category}_${Date.now()}_${index}`,
      category: category as any,
      question: q,
      importance: 3,
      answered: false,
      answer: '',
      follow_up_questions: []
    }))
    
    updateData(prev => ({
      ...prev,
      questions: [...prev.questions, ...newQuestions]
    }))
    
    toast({
      title: 'Sample Questions Added',
      description: `Added ${samples.length} ${category.toUpperCase()} questions`
    })
  }

  // Update question
  const updateQuestion = (id: string, updates: Partial<StarburstingQuestion>) => {
    updateData(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === id ? { ...q, ...updates } : q
      )
    }))
  }

  // Remove question
  const removeQuestion = (id: string) => {
    updateData(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }))
  }

  // Add follow-up question
  const addFollowUpQuestion = (questionId: string) => {
    const followUp = prompt('Enter follow-up question:')
    if (followUp?.trim()) {
      updateQuestion(questionId, {
        follow_up_questions: [...(data.questions.find(q => q.id === questionId)?.follow_up_questions || []), followUp.trim()]
      })
    }
  }

  // Get questions by category
  const getQuestionsByCategory = (category: string) => {
    return data.questions.filter(q => q.category === category)
  }

  // Calculate completion stats
  const getCompletionStats = () => {
    const total = data.questions.length
    const answered = data.questions.filter(q => q.answered).length
    const high_importance = data.questions.filter(q => q.importance >= 4).length
    const completion_rate = total > 0 ? Math.round((answered / total) * 100) : 0
    
    return { total, answered, high_importance, completion_rate }
  }

  // Publish analysis
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your starbursting analysis',
        variant: 'destructive'
      })
      return
    }
    
    if (!data.central_topic.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please specify the central topic',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: 'Starbursting Analysis',
        framework_type: 'starbursting',
        data: {
          central_topic: data.central_topic,
          questions: data.questions,
          context: data.context,
          analysis_date: data.analysis_date,
          completion_stats: getCompletionStats()
        }
      }
      
      const response = await apiClient.post('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'Starbursting analysis published successfully'
      })
      
      router.push('/frameworks/starbursting')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const stats = getCompletionStats()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/frameworks/starbursting')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Starbursting Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Systematic question generation using the 5W+1H framework
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <SaveStatusIndicator sessionId={sessionId} />
              
              <div className="flex gap-2">
                {!isAuthenticated && hasData && (
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/login')}
                  >
                    Sign In to Save
                  </Button>
                )}
                
                <Button 
                  onClick={handlePublish}
                  disabled={saving || !hasData}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Publishing...' : isAuthenticated ? 'Publish Analysis' : 'Sign In to Publish'}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Basic Information */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Star className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Product Launch Strategy Analysis"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Central Topic</label>
                <Input
                  value={data.central_topic}
                  onChange={(e) => updateData(prev => ({ ...prev, central_topic: e.target.value }))}
                  placeholder="e.g., Launch new mobile app"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Context</label>
                <Textarea
                  value={data.context}
                  onChange={(e) => updateData(prev => ({ ...prev, context: e.target.value }))}
                  placeholder="Provide background information and context for this analysis..."
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Completion Stats */}
          {stats.total > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <BarChart3 className="h-5 w-5" />
                  Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.answered}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.high_importance}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">High Priority</div>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "text-2xl font-bold",
                      stats.completion_rate >= 80 ? "text-green-600" :
                      stats.completion_rate >= 50 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {stats.completion_rate}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Complete</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question Categories */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <HelpCircle className="h-5 w-5" />
                Question Categories (5W + 1H)
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Add questions across all categories to ensure comprehensive analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {QUESTION_CATEGORIES.map((category) => {
                  const categoryQuestions = getQuestionsByCategory(category.value)
                  const answeredCount = categoryQuestions.filter(q => q.answered).length
                  
                  return (
                    <div key={category.value} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold", category.color)}>
                          {category.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{category.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {answeredCount}/{categoryQuestions.length} answered
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => addQuestion(category.value)}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Add {category.label} Question
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => addSampleQuestions(category.value)}
                        >
                          Add Sample Questions
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          
          {/* Questions List */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Questions ({data.questions.length})
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuestionsExpanded(!questionsExpanded)}
                  >
                    {questionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            {questionsExpanded && (
              <CardContent className="space-y-4">
                {data.questions.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No questions yet. Use the category buttons above to start adding questions.</p>
                  </div>
                )}
                
                {QUESTION_CATEGORIES.map((category) => {
                  const categoryQuestions = getQuestionsByCategory(category.value)
                  if (categoryQuestions.length === 0) return null
                  
                  return (
                    <div key={category.value}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn("w-4 h-4 rounded-full", category.color)} />
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{category.label} Questions</h4>
                      </div>
                      
                      <div className="space-y-3 ml-6">
                        {categoryQuestions.map((question) => (
                          <div key={question.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={question.answered}
                                  onChange={(e) => updateQuestion(question.id, { answered: e.target.checked })}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <Input
                                    value={question.question}
                                    onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                                    placeholder="Enter your question..."
                                    className="font-medium bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeQuestion(question.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400">
                                  Importance: {question.importance}/5
                                </label>
                                <Slider
                                  value={[question.importance]}
                                  onValueChange={(value) => updateQuestion(question.id, { importance: value[0] })}
                                  max={5}
                                  min={1}
                                  step={1}
                                  className="mt-1"
                                />
                              </div>
                              
                              {question.answered && (
                                <div>
                                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Answer</label>
                                  <Textarea
                                    value={question.answer}
                                    onChange={(e) => updateQuestion(question.id, { answer: e.target.value })}
                                    placeholder="Provide the answer or findings..."
                                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                    rows={3}
                                  />
                                </div>
                              )}
                              
                              {question.follow_up_questions.length > 0 && (
                                <div>
                                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Follow-up Questions</label>
                                  <ul className="mt-1 space-y-1">
                                    {question.follow_up_questions.map((followUp, index) => (
                                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        <span className="text-gray-400">•</span>
                                        {followUp}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addFollowUpQuestion(question.id)}
                                className="text-sm"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Follow-up Question
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            )}
          </Card>
          
          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Star className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  Your Work is Automatically Saved
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-center mb-4 max-w-lg">
                  We're saving your progress locally in your browser as you work. 
                  To save to the cloud and access from any device, sign in to your account.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/login')}
                    className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                  >
                    Sign In
                  </Button>
                  <Button 
                    onClick={() => router.push('/register')}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Create Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}