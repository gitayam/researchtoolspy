'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, AlertTriangle, Eye, Calendar, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface DeceptionSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  data: {
    analysis?: {
      credibilityScore?: number
      overallAssessment?: string
      indicators?: any[]
    }
    target_content?: string
    purpose?: string
  }
}

export default function DeceptionDetectionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<DeceptionSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await apiClient.get('/frameworks/?framework_type=deception_detection')
      setSessions(response.sessions || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load deception detection analyses',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getAssessmentColor = (assessment: string) => {
    switch (assessment) {
      case 'credible': return 'bg-green-100 text-green-800 border-green-200'
      case 'questionable': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'likely_deceptive': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deception Detection</h1>
            <p className="text-gray-600 dark:text-gray-400">Loading analyses...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded"></div>
                  <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deception Detection</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Analyze content for potential deception, misinformation, and credibility issues
          </p>
        </div>
        <Button 
          onClick={() => router.push('/frameworks/deception/create')}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Overview */}
      <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
            <AlertTriangle className="h-5 w-5" />
            About Deception Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="text-orange-700 dark:text-orange-300">
          <p className="mb-4">
            Deception Detection is a structured analytic technique used to identify potential deception, 
            misinformation, or credibility issues in various forms of content including statements, 
            documents, claims, and narratives.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Key Applications:</h4>
              <ul className="text-sm space-y-1">
                <li>• Information verification and fact-checking</li>
                <li>• Source credibility assessment</li>
                <li>• Disinformation campaign analysis</li>
                <li>• Testimonial and witness statement evaluation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Analysis Categories:</h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>Linguistic:</strong> Language patterns and word choice</li>
                <li>• <strong>Logical:</strong> Consistency and reasoning</li>
                <li>• <strong>Behavioral:</strong> Communication patterns</li>
                <li>• <strong>Contextual:</strong> Source and circumstantial factors</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
            <p className="text-gray-500 text-center mb-6 max-w-sm">
              Create your first deception detection analysis to identify potential credibility issues in content.
            </p>
            <Button 
              onClick={() => router.push('/frameworks/deception/create')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <Link key={session.id} href={`/frameworks/deception/${session.id}`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Analysis
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {session.data.analysis && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Credibility:</span>
                        <span className="font-medium text-orange-600">
                          {session.data.analysis.credibilityScore || 0}%
                        </span>
                      </div>
                      {session.data.analysis.overallAssessment && (
                        <Badge 
                          variant="outline" 
                          className={getAssessmentColor(session.data.analysis.overallAssessment)}
                        >
                          {session.data.analysis.overallAssessment.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {session.data.purpose && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      Purpose: {session.data.purpose}
                    </p>
                  )}

                  {session.data.target_content && (
                    <p className="text-sm text-gray-500 line-clamp-3">
                      {session.data.target_content.substring(0, 150)}
                      {session.data.target_content.length > 150 ? '...' : ''}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Eye className="h-3 w-3" />
                      <span>
                        {session.data.analysis?.indicators?.length || 0} indicators
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      Updated {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}