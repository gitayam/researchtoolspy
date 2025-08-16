'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Lightbulb, 
  Edit, 
  Download, 
  Share2, 
  HelpCircle, 
  Globe, 
  Target,
  Calendar,
  Eye,
  BarChart3,
  Brain
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface StarburstingSession {
  id: string
  title: string
  description?: string
  framework_type: 'starbursting'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    central_idea: string
    processed_content?: string
    five_w_analysis: {
      who: string
      what: string
      where: string
      when: string
      why: string
    }
    questions: Array<{ id: string; text: string; response: string }>
    url_source?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function StarburstingViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<StarburstingSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<StarburstingSession>(`/frameworks/sessions/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load Starbursting analysis',
          variant: 'destructive'
        })
        router.push('/frameworks')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchSession()
    }
  }, [params.id, router, toast])

  const handleEdit = () => {
    router.push(`/frameworks/starbursting/${params.id}/edit`)
  }

  const handleExport = () => {
    toast({
      title: 'Export',
      description: 'Export functionality coming soon'
    })
  }

  const handleShare = () => {
    toast({
      title: 'Share',
      description: 'Share functionality coming soon'
    })
  }

  const generateSummary = () => {
    toast({
      title: 'AI Summary',
      description: 'AI summary generation coming soon'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading Starbursting analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const fiveWColors = {
    who: 'border-blue-200 bg-blue-50',
    what: 'border-green-200 bg-green-50',
    where: 'border-purple-200 bg-purple-50',
    when: 'border-orange-200 bg-orange-50',
    why: 'border-red-200 bg-red-50'
  }

  const answeredQuestions = session.data.questions.filter(q => q.response.trim()).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <Badge className={statusColors[session.status]}>
              {session.status.replace('_', ' ')}
            </Badge>
          </div>
          {session.description && (
            <p className="text-gray-600 dark:text-gray-400">{session.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Created {formatRelativeTime(session.created_at)}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Last updated {formatRelativeTime(session.updated_at)}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleEdit} className="bg-blue-600 hover:bg-blue-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{session.data.questions.length}</div>
              <div className="text-sm text-gray-500">Total Questions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{answeredQuestions}</div>
              <div className="text-sm text-gray-500">Answered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(session.data.five_w_analysis).filter(v => v.trim()).length}
              </div>
              <div className="text-sm text-gray-500">5W Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round((answeredQuestions / Math.max(session.data.questions.length, 1)) * 100)}%
              </div>
              <div className="text-sm text-gray-500">Completion</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Central Idea */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Central Idea
          </CardTitle>
          {session.data.url_source && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Globe className="h-4 w-4" />
              Source: <a href={session.data.url_source} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{session.data.url_source}</a>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
            {session.data.central_idea}
          </p>
        </CardContent>
      </Card>

      {/* 5W Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            5W Analysis
          </CardTitle>
          <CardDescription>
            Who, What, Where, When, Why analysis of the central idea
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(session.data.five_w_analysis).map(([key, value]) => (
              <Card key={key} className={fiveWColors[key as keyof typeof fiveWColors]}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg capitalize">{key}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">
                    {value || <span className="text-gray-500 italic">Not specified</span>}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Questions and Responses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Expansion Questions & Responses
          </CardTitle>
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={generateSummary}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              Generate AI Summary
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {session.data.questions.length > 0 ? (
            <div className="space-y-6">
              {session.data.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge variant="outline" className="mt-1">Q{index + 1}</Badge>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 leading-relaxed">
                        {question.text}
                      </h4>
                    </div>
                  </div>
                  
                  {question.response ? (
                    <div className="ml-14">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {question.response}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="ml-14">
                      <p className="text-gray-500 text-sm italic">No response provided</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No questions added yet</p>
              <p className="text-sm text-gray-400">Edit this analysis to add expansion questions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Insights */}
      {answeredQuestions > 0 && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Analysis Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3">
                <h4 className="font-medium text-blue-800 mb-2">Completion Status</h4>
                <p className="text-sm text-gray-700">
                  {answeredQuestions} of {session.data.questions.length} questions have been answered 
                  ({Math.round((answeredQuestions / session.data.questions.length) * 100)}% complete)
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-3">
                <h4 className="font-medium text-blue-800 mb-2">5W Coverage</h4>
                <p className="text-sm text-gray-700">
                  {Object.values(session.data.five_w_analysis).filter(v => v.trim()).length} of 5 
                  core elements (Who, What, Where, When, Why) have been analyzed
                </p>
              </div>

              {session.data.url_source && (
                <div className="bg-white rounded-lg p-3">
                  <h4 className="font-medium text-blue-800 mb-2">Content Source</h4>
                  <p className="text-sm text-gray-700">
                    Analysis based on content extracted from URL source with automated 5W analysis
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}