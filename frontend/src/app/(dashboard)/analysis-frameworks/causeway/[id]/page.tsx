'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GitBranch, Edit, Trash2, Download, Share2, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface CausewayAnalysis {
  id: string
  title: string
  description?: string
  framework_type: 'causeway'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    problemStatement?: string
    rootCauses: Array<{
      id: string
      cause: string
      category: 'immediate' | 'underlying' | 'root'
      impact: 'high' | 'medium' | 'low'
      likelihood: number
      evidence?: string[]
    }>
    effects: Array<{
      id: string
      effect: string
      severity: 'critical' | 'major' | 'minor'
      timeframe: 'immediate' | 'short-term' | 'long-term'
    }>
    mitigationActions?: Array<{
      action: string
      priority: 'high' | 'medium' | 'low'
      timeline: string
    }>
  }
  created_at: string
  updated_at: string
}

export default function CausewayDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [analysis, setAnalysis] = useState<CausewayAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<CausewayAnalysis>(`/frameworks/${params.id}`)
        setAnalysis(response)
      } catch (error: any) {
        console.warn('API not available, using mock data:', error.message)
        // Mock data for development
        setAnalysis({
          id: params.id as string,
          title: 'Sample Causeway Analysis',
          description: 'This is a sample causeway analysis for development purposes',
          framework_type: 'causeway',
          status: 'in_progress',
          data: {
            problemStatement: 'Sample problem statement for demonstration',
            rootCauses: [
              {
                id: '1',
                cause: 'Inadequate training procedures',
                category: 'root',
                impact: 'high',
                likelihood: 8,
                evidence: ['Training records', 'Performance metrics']
              },
              {
                id: '2', 
                cause: 'Equipment malfunction',
                category: 'immediate',
                impact: 'medium',
                likelihood: 6
              }
            ],
            effects: [
              {
                id: '1',
                effect: 'Decreased productivity',
                severity: 'major',
                timeframe: 'short-term'
              }
            ]
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchAnalysis()
    }
  }, [params.id])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this analysis?')) return
    
    try {
      await apiClient.delete(`/frameworks/${params.id}`)
      toast({
        title: 'Success',
        description: 'Analysis deleted successfully'
      })
      router.push('/analysis-frameworks/causeway')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete analysis',
        variant: 'destructive'
      })
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'root': return AlertTriangle
      case 'underlying': return TrendingUp
      case 'immediate': return CheckCircle
      default: return GitBranch
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'root': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'underlying': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'immediate': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'major': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'minor': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading analysis...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center py-12">
          <GitBranch className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Analysis Not Found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested causeway analysis could not be found.</p>
          <Button onClick={() => router.push('/analysis-frameworks/causeway')}>
            Back to Causeway Analyses
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analysis.title}</h1>
          {analysis.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">{analysis.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <Badge className={`${
              analysis.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              analysis.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {analysis.status.replace('_', ' ')}
            </Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Updated {formatRelativeTime(analysis.updated_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 border-red-300 hover:bg-red-50">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Problem Statement */}
        {analysis.data.problemStatement && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">Problem Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300">{analysis.data.problemStatement}</p>
            </CardContent>
          </Card>
        )}

        {/* Root Causes */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Root Causes ({analysis.data.rootCauses.length})</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Identified causes categorized by type</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.data.rootCauses.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No root causes identified yet.</p>
            ) : (
              <div className="space-y-4">
                {analysis.data.rootCauses.map((cause) => {
                  const Icon = getCategoryIcon(cause.category)
                  return (
                    <Card key={cause.id} className="border border-gray-200 dark:border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <Badge className={getCategoryColor(cause.category)}>
                            <Icon className="h-3 w-3 mr-1" />
                            {cause.category}
                          </Badge>
                          <div className="flex gap-2">
                            <Badge variant="outline" className={`${getImpactColor(cause.impact)} border-current`}>
                              {cause.impact} impact
                            </Badge>
                            <Badge variant="outline">
                              {cause.likelihood}/10 likelihood
                            </Badge>
                          </div>
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{cause.cause}</p>
                        {cause.evidence && cause.evidence.length > 0 && (
                          <div className="mt-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Evidence: </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{cause.evidence.join(', ')}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Effects */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Effects & Consequences ({analysis.data.effects.length})</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Documented impacts and consequences</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.data.effects.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No effects documented yet.</p>
            ) : (
              <div className="space-y-4">
                {analysis.data.effects.map((effect) => (
                  <Card key={effect.id} className="border border-gray-200 dark:border-gray-600">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-900 dark:text-gray-100 font-medium flex-1">{effect.effect}</p>
                        <div className="flex gap-2 ml-4">
                          <Badge className={getSeverityColor(effect.severity)}>
                            {effect.severity}
                          </Badge>
                          <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                            {effect.timeframe}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mitigation Actions */}
        {analysis.data.mitigationActions && analysis.data.mitigationActions.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">Mitigation Actions</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">Recommended actions to address root causes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.data.mitigationActions.map((action, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-gray-900 dark:text-gray-100">{action.action}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className={`${
                        action.priority === 'high' ? 'text-red-600 border-red-300' :
                        action.priority === 'medium' ? 'text-yellow-600 border-yellow-300' :
                        'text-green-600 border-green-300'
                      }`}>
                        {action.priority}
                      </Badge>
                      {action.timeline && (
                        <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                          {action.timeline}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}