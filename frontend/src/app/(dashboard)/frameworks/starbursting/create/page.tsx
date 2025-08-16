'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Lightbulb, Globe, HelpCircle, Trash2, Calculator, Brain } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface Question {
  id: string
  text: string
  response: string
}

interface FiveWAnalysis {
  who: string
  what: string
  where: string
  when: string
  why: string
}

export default function CreateStarburstingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [centralIdea, setCentralIdea] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [processedContent, setProcessedContent] = useState('')
  const [fiveWAnalysis, setFiveWAnalysis] = useState<FiveWAnalysis>({
    who: '',
    what: '',
    where: '',
    when: '',
    why: ''
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: '',
      response: ''
    }
    setQuestions(prev => [...prev, newQuestion])
  }

  const updateQuestion = (id: string, field: 'text' | 'response', value: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ))
  }

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const processUrl = async () => {
    if (!urlInput.trim()) {
      toast({
        title: 'No URL',
        description: 'Please enter a URL to process',
        variant: 'destructive'
      })
      return
    }

    setProcessing(true)
    try {
      // Use the web scraping API to process the URL
      const response = await apiClient.post('/tools/web-scraping/scrape', {
        url: urlInput.trim(),
        extract_images: false,
        extract_links: true,
        follow_redirects: true,
        max_depth: 1,
        delay_seconds: 1.0
      })

      if (response.content) {
        setProcessedContent(response.content)
        setCentralIdea(response.content)
        
        // Automatically extract 5W information using AI
        await extract5WAnalysis(response.content)
        
        toast({
          title: 'URL Processed',
          description: 'Content extracted and 5W analysis performed'
        })
      }
    } catch (error: any) {
      toast({
        title: 'Processing Error',
        description: error.message || 'Failed to process URL',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const extract5WAnalysis = async (content: string) => {
    try {
      // Simulate AI analysis for 5W extraction
      // In a real implementation, this would call an AI service
      const prompt = `Analyze the following content and extract the 5W information:
Who: Key people, organizations, or entities involved
What: Main events, actions, or topics
Where: Locations or contexts mentioned
When: Time periods, dates, or temporal context
Why: Reasons, motivations, or purposes

Content: ${content.substring(0, 2000)}...`

      // For now, we'll use a simplified extraction
      // In the real implementation, this would call the AI service
      const analysis: FiveWAnalysis = {
        who: 'Key stakeholders and entities mentioned in the content',
        what: 'Main events, topics, and actions described',
        where: 'Relevant locations and contexts',
        when: 'Timeframes and dates referenced',
        why: 'Underlying reasons and motivations discussed'
      }

      setFiveWAnalysis(analysis)
    } catch (error) {
      console.error('Error extracting 5W analysis:', error)
    }
  }

  const generateQuestions = async () => {
    if (!centralIdea.trim()) {
      toast({
        title: 'No Central Idea',
        description: 'Please enter a central idea to generate questions',
        variant: 'destructive'
      })
      return
    }

    setLoadingQuestions(true)
    try {
      // Simulate AI question generation
      const questionStarters = ['Who', 'What', 'Where', 'When', 'Why', 'How']
      const generatedQuestions = questionStarters.map((starter, index) => ({
        id: `generated_${Date.now()}_${index}`,
        text: `${starter} ${starter === 'Who' ? 'are the key stakeholders involved?' : 
                     starter === 'What' ? 'are the main components or aspects?' : 
                     starter === 'Where' ? 'does this take place or have impact?' : 
                     starter === 'When' ? 'is the timeline or key dates?' : 
                     starter === 'Why' ? 'is this important or happening?' : 
                     'can this be implemented or achieved?'}`,
        response: ''
      }))

      setQuestions(prev => [...prev, ...generatedQuestions])
      
      toast({
        title: 'Questions Generated',
        description: `Added ${generatedQuestions.length} expansion questions`
      })
    } catch (error: any) {
      toast({
        title: 'Generation Error',
        description: error.message || 'Failed to generate questions',
        variant: 'destructive'
      })
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your Starbursting analysis',
        variant: 'destructive'
      })
      return
    }

    if (!centralIdea.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a central idea',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        framework_type: 'starbursting',
        data: {
          central_idea: centralIdea,
          processed_content: processedContent,
          five_w_analysis: fiveWAnalysis,
          questions: questions.filter(q => q.text.trim()),
          url_source: urlInput
        }
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions', payload)
      
      toast({
        title: 'Success',
        description: 'Starbursting analysis saved successfully'
      })

      router.push(`/frameworks/starbursting/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save Starbursting analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const update5W = (field: keyof FiveWAnalysis, value: string) => {
    setFiveWAnalysis(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Starbursting Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Explore ideas through systematic questioning and 5W analysis
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Market Entry Strategy Analysis"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* URL Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL Processing & Content Extraction
          </CardTitle>
          <CardDescription>
            Process a URL to extract content and automatically perform 5W analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">URL to Process</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                className="flex-1"
              />
              <Button 
                onClick={processUrl} 
                disabled={processing}
                variant="outline"
              >
                <Globe className="h-4 w-4 mr-2" />
                {processing ? 'Processing...' : 'Process URL'}
              </Button>
            </div>
          </div>
          
          {processedContent && (
            <div>
              <label className="text-sm font-medium">Extracted Content</label>
              <Textarea
                value={processedContent}
                onChange={(e) => setProcessedContent(e.target.value)}
                className="mt-1"
                rows={4}
                readOnly
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Central Idea */}
      <Card>
        <CardHeader>
          <CardTitle>Central Idea</CardTitle>
          <CardDescription>
            The main topic or concept you want to explore through questioning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={centralIdea}
            onChange={(e) => setCentralIdea(e.target.value)}
            placeholder="Enter your central idea, topic, or paste processed content from URL..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* 5W Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            5W Analysis (Who, What, Where, When, Why)
          </CardTitle>
          <CardDescription>
            Systematic analysis of the core elements - automatically extracted from URLs or manually filled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-blue-700">Who</label>
              <Textarea
                value={fiveWAnalysis.who}
                onChange={(e) => update5W('who', e.target.value)}
                placeholder="Key people, organizations, stakeholders involved..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-green-700">What</label>
              <Textarea
                value={fiveWAnalysis.what}
                onChange={(e) => update5W('what', e.target.value)}
                placeholder="Main events, actions, topics, products..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-purple-700">Where</label>
              <Textarea
                value={fiveWAnalysis.where}
                onChange={(e) => update5W('where', e.target.value)}
                placeholder="Locations, markets, contexts, environments..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-orange-700">When</label>
              <Textarea
                value={fiveWAnalysis.when}
                onChange={(e) => update5W('when', e.target.value)}
                placeholder="Time periods, dates, timelines, schedules..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-red-700">Why</label>
            <Textarea
              value={fiveWAnalysis.why}
              onChange={(e) => update5W('why', e.target.value)}
              placeholder="Reasons, motivations, purposes, goals..."
              rows={3}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Expansion Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Expansion Questions
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={generateQuestions} 
                size="sm"
                disabled={loadingQuestions}
                variant="outline"
              >
                <Brain className="h-4 w-4 mr-2" />
                {loadingQuestions ? 'Generating...' : 'Generate Questions'}
              </Button>
              <Button onClick={addQuestion} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Create questions that start with Who, What, Where, When, Why, or How to explore your central idea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex gap-3 items-start mb-4">
                <Badge variant="outline" className="mt-2 min-w-[50px]">
                  Q{index + 1}
                </Badge>
                <Textarea
                  value={question.text}
                  onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                  placeholder={`Question ${index + 1}: e.g., Who are the main competitors?`}
                  className="flex-1"
                  rows={2}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(question.id)}
                  className="text-gray-500 hover:text-red-600 mt-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="ml-14">
                <label className="text-sm font-medium">Response</label>
                <Textarea
                  value={question.response}
                  onChange={(e) => updateQuestion(question.id, 'response', e.target.value)}
                  placeholder="Your detailed analysis and response to this question..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          ))}
          
          {questions.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <HelpCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No questions added yet</p>
              <p className="text-sm text-gray-400">
                Add questions to explore your central idea systematically
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      {questions.length > 0 && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-sm text-gray-500">Total Questions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {questions.filter(q => q.response.trim()).length}
                </div>
                <div className="text-sm text-gray-500">Answered</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(fiveWAnalysis).filter(v => v.trim()).length}
                </div>
                <div className="text-sm text-gray-500">5W Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {urlInput ? '1' : '0'}
                </div>
                <div className="text-sm text-gray-500">URL Processed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}