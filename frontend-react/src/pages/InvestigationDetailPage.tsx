/**
 * Investigation Detail Page
 * View and manage an investigation with all linked research components
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Folder,
  FileText,
  Users,
  Database,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Brain,
  Loader2,
  Network,
  Activity,
  Zap,
  Target,
  MapPin,
  Link as LinkIcon
} from 'lucide-react'

interface Investigation {
  id: string
  title: string
  description?: string
  type: 'structured_research' | 'general_topic' | 'rapid_analysis'
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  created_by_username?: string
  research_question_topic?: string
  research_question_text?: string
  evidence_count: number
  actor_count: number
  source_count: number
  event_count: number
  framework_count: number
  tags: string[]
  metadata?: any
}

export function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadInvestigation()
    }
  }, [id])

  const loadInvestigation = async () => {
    try {
      setLoading(true)
      setError(null)
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch(`/api/investigations/${id}`, {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Investigation not found')
        } else if (response.status === 403) {
          setError('Access denied: You do not have permission to view this investigation')
        } else {
          const data = await response.json().catch(() => ({}))
          setError(data.error || 'Failed to load investigation')
        }
        return
      }

      const data = await response.json()
      if (data.success && data.investigation) {
        setInvestigation(data.investigation)
      } else {
        setError('Invalid response from server')
      }
    } catch (error) {
      console.error('Error loading investigation:', error)
      setError('Network error: Unable to load investigation')
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'structured_research': return <FileText className="h-5 w-5" />
      case 'rapid_analysis': return <Zap className="h-5 w-5" />
      default: return <Folder className="h-5 w-5" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'structured_research': return 'Structured Research'
      case 'rapid_analysis': return 'Rapid Analysis'
      default: return 'General Topic'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </div>
    )
  }

  if (error || !investigation) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Investigation not found'}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/dashboard/investigations')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Investigations
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-4">
        <Button onClick={() => navigate('/dashboard/investigations')} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              {getTypeIcon(investigation.type)}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{investigation.title}</h1>
            </div>
            {investigation.description && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{investigation.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">
              {getTypeLabel(investigation.type)}
            </Badge>
            <Badge className={getStatusColor(investigation.status)}>
              {investigation.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Created {new Date(investigation.created_at).toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1">
          <Activity className="h-4 w-4" />
          Updated {new Date(investigation.updated_at).toLocaleDateString()}
        </span>
        {investigation.created_by_username && (
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            by {investigation.created_by_username}
          </span>
        )}
      </div>

      {/* Research Question */}
      {investigation.research_question_topic && (
        <Card className="bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Research Question</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Topic: {investigation.research_question_topic}
            </p>
            {investigation.research_question_text && (
              <p className="text-gray-900 dark:text-white">
                {investigation.research_question_text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {investigation.tags.length > 0 && (
        <div className="flex gap-2">
          {investigation.tags.map((tag, idx) => (
            <Badge key={idx} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-3xl font-bold">{investigation.evidence_count}</div>
              <div className="text-sm text-gray-500">Evidence</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-3xl font-bold">{investigation.actor_count}</div>
              <div className="text-sm text-gray-500">Actors</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <LinkIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-3xl font-bold">{investigation.source_count}</div>
              <div className="text-sm text-gray-500">Sources</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <div className="text-3xl font-bold">{investigation.event_count || 0}</div>
              <div className="text-sm text-gray-500">Events</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <div className="text-3xl font-bold">{investigation.framework_count}</div>
              <div className="text-sm text-gray-500">Analyses</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">
            Evidence ({investigation.evidence_count})
          </TabsTrigger>
          <TabsTrigger value="entities">
            Entities ({investigation.actor_count + investigation.source_count + (investigation.event_count || 0)})
          </TabsTrigger>
          <TabsTrigger value="frameworks">
            Frameworks ({investigation.framework_count})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Investigation Overview</CardTitle>
              <CardDescription>
                Manage your research components and apply analytical frameworks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => navigate('/dashboard/evidence')} className="h-auto py-4">
                  <div className="text-left w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="h-4 w-4" />
                      <span className="font-semibold">Add Evidence</span>
                    </div>
                    <p className="text-xs text-gray-500">Link evidence items to this investigation</p>
                  </div>
                </Button>

                <Button variant="outline" onClick={() => navigate('/dashboard/entities/actors')} className="h-auto py-4">
                  <div className="text-left w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4" />
                      <span className="font-semibold">Add Actors</span>
                    </div>
                    <p className="text-xs text-gray-500">Track people and organizations</p>
                  </div>
                </Button>

                <Button variant="outline" onClick={() => navigate('/dashboard/entities/sources')} className="h-auto py-4">
                  <div className="text-left w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <LinkIcon className="h-4 w-4" />
                      <span className="font-semibold">Add Sources</span>
                    </div>
                    <p className="text-xs text-gray-500">Document information sources</p>
                  </div>
                </Button>

                <Button variant="outline" onClick={() => navigate('/dashboard/analysis-frameworks')} className="h-auto py-4">
                  <div className="text-left w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="h-4 w-4" />
                      <span className="font-semibold">Apply Framework</span>
                    </div>
                    <p className="text-xs text-gray-500">Run analytical frameworks</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Evidence linking will be available soon</p>
                <Button variant="outline" onClick={() => navigate('/dashboard/evidence')}>
                  Go to Evidence Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities" className="mt-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Entity management will be available soon</p>
                <Button variant="outline" onClick={() => navigate('/dashboard/entities/actors')}>
                  Go to Actors Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frameworks" className="mt-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Framework results will be displayed here</p>
                <Button variant="outline" onClick={() => navigate('/dashboard/analysis-frameworks')}>
                  Browse Frameworks
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default InvestigationDetailPage
