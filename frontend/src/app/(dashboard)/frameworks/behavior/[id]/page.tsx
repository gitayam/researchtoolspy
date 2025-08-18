'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Brain, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Eye,
  Target,
  Lightbulb,
  Zap,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface BehaviorFactor {
  id: string
  component: 'capability' | 'opportunity' | 'motivation'
  factor: string
  description: string
  currentLevel: number // 1-10 scale
  desiredLevel: number // 1-10 scale
  impact: 'high' | 'medium' | 'low'
  changeability: 'easy' | 'moderate' | 'difficult'
  interventions: string[]
  barriers?: string
  enablers?: string
  notes?: string
}

interface BehaviorSession {
  id: string
  title: string
  description?: string
  framework_type: 'behavior'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    factors: BehaviorFactor[]
    targetBehavior?: string
    context?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function BehaviorViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<BehaviorSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<BehaviorSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        console.warn('API not available, redirecting to frameworks:', error.message)
        // Redirect to frameworks page if API is not available
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
    router.push(`/frameworks/behavior/${params.id}/edit`)
  }

  const handleShare = () => {
    toast({
      title: 'Share',
      description: 'Share functionality coming soon'
    })
  }

  const handleExport = () => {
    toast({
      title: 'Export',
      description: 'Export functionality coming soon'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading behavior analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const components = [
    { 
      id: 'capability', 
      name: 'Capability', 
      icon: Zap, 
      color: 'bg-blue-100 text-blue-800',
      description: 'Physical and psychological ability to perform the behavior'
    },
    { 
      id: 'opportunity', 
      name: 'Opportunity', 
      icon: Target, 
      color: 'bg-green-100 text-green-800',
      description: 'External factors that enable or prompt the behavior'
    },
    { 
      id: 'motivation', 
      name: 'Motivation', 
      icon: Lightbulb, 
      color: 'bg-purple-100 text-purple-800',
      description: 'Internal processes that energize and direct behavior'
    }
  ]

  const getChangeabilityIcon = (changeability: string) => {
    switch (changeability) {
      case 'easy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'moderate': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'difficult': return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const groupFactorsByComponent = () => {
    const grouped: Record<string, BehaviorFactor[]> = {}
    components.forEach(component => {
      grouped[component.id] = session.data.factors.filter(factor => factor.component === component.id)
    })
    return grouped
  }

  const calculateBehaviorScore = () => {
    const factors = session.data.factors
    if (factors.length === 0) return { score: 0, gaps: 0 }
    
    const averageGap = factors.reduce((sum, factor) => {
      return sum + (factor.desiredLevel - factor.currentLevel)
    }, 0) / factors.length
    
    const behaviorScore = Math.max(0, 100 - (averageGap * 10))
    const significantGaps = factors.filter(f => (f.desiredLevel - f.currentLevel) >= 3).length
    
    return { score: Math.round(behaviorScore), gaps: significantGaps }
  }

  const calculateStats = () => {
    const factors = session.data.factors
    const stats = {
      total: factors.length,
      highImpact: factors.filter(f => f.impact === 'high').length,
      easyToChange: factors.filter(f => f.changeability === 'easy').length,
      difficult: factors.filter(f => f.changeability === 'difficult').length
    }
    return stats
  }

  const groupedFactors = groupFactorsByComponent()
  const behaviorMetrics = calculateBehaviorScore()
  const stats = calculateStats()

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
          <Button onClick={handleEdit} className="bg-emerald-600 hover:bg-emerald-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Target Behavior & Context */}
      {(session.data.targetBehavior || session.data.context) && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.data.targetBehavior && (
              <div>
                <span className="font-medium">Target Behavior:</span> {session.data.targetBehavior}
              </div>
            )}
            {session.data.context && (
              <div>
                <span className="font-medium">Context:</span> {session.data.context}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Behavior Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Behavior Change Readiness Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-300">
              <div className="text-3xl font-bold text-blue-800 dark:text-blue-300">
                {behaviorMetrics.score}%
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Readiness Score</div>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-300">
              <div className="text-3xl font-bold text-orange-800 dark:text-orange-300">
                {behaviorMetrics.gaps}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Significant Gaps</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300">
              <div className="text-3xl font-bold text-red-800 dark:text-red-300">
                {stats.highImpact}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">High Impact</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-300">
              <div className="text-3xl font-bold text-green-800 dark:text-green-300">
                {stats.easyToChange}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Easy to Change</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* COM-B Analysis */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {components.map(component => {
            const componentFactors = groupedFactors[component.id]
            const ComponentIcon = component.icon
            return (
              <TabsTrigger key={component.id} value={component.id} className="relative">
                <ComponentIcon className="h-4 w-4 mr-2" />
                {component.name}
                {componentFactors.length > 0 && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                    {componentFactors.length}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Component Summary */}
            <Card>
              <CardHeader>
                <CardTitle>COM-B Component Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {components.map(component => {
                    const componentFactors = groupedFactors[component.id]
                    const ComponentIcon = component.icon
                    const avgGap = componentFactors.length > 0 
                      ? componentFactors.reduce((sum, f) => sum + (f.desiredLevel - f.currentLevel), 0) / componentFactors.length 
                      : 0
                    
                    return (
                      <div key={component.id} className={`p-4 rounded-lg border ${component.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <ComponentIcon className="h-4 w-4" />
                          <span className="font-medium">{component.name}</span>
                        </div>
                        <div className="text-2xl font-bold mb-1">{componentFactors.length}</div>
                        <div className="text-xs mb-2">{component.description}</div>
                        {avgGap > 0 && (
                          <div className="text-xs">
                            <span>Avg Gap: </span>
                            <span className={`font-medium ${avgGap >= 3 ? 'text-red-600' : avgGap >= 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {avgGap.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Priority Actions */}
            {stats.highImpact > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    High Impact Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {session.data.factors
                      .filter(factor => factor.impact === 'high')
                      .map((factor, index) => (
                        <div key={factor.id} className="p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">H{index + 1}</Badge>
                                <span className="font-medium">{factor.factor}</span>
                                {getChangeabilityIcon(factor.changeability)}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {factor.description}
                              </p>
                              <div className="text-sm">
                                <span className="font-medium">Gap: </span>
                                {factor.desiredLevel - factor.currentLevel} points
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {components.map(component => {
          const componentFactors = groupedFactors[component.id]
          const ComponentIcon = component.icon
          
          return (
            <TabsContent key={component.id} value={component.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ComponentIcon className="h-5 w-5" />
                    {component.name} Analysis
                  </CardTitle>
                  <CardDescription>
                    {componentFactors.length} factors assessed • {component.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {componentFactors.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No {component.name.toLowerCase()} factors assessed yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {componentFactors.map((factor, index) => (
                        <div key={factor.id} className={`border rounded-lg p-4 ${getImpactColor(factor.impact)}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{component.name[0]}{index + 1}</Badge>
                                <h3 className="font-semibold">{factor.factor}</h3>
                                {getChangeabilityIcon(factor.changeability)}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {factor.description}
                              </p>
                            </div>
                            <Badge className={getImpactColor(factor.impact).replace('border-', '')}>
                              {factor.impact} impact
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                              <div className="text-sm font-medium mb-1">Current Level</div>
                              <div className="flex items-center gap-2">
                                <Progress value={factor.currentLevel * 10} className="flex-1" />
                                <span className="text-sm font-medium">{factor.currentLevel}/10</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-1">Desired Level</div>
                              <div className="flex items-center gap-2">
                                <Progress value={factor.desiredLevel * 10} className="flex-1" />
                                <span className="text-sm font-medium">{factor.desiredLevel}/10</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-1">Gap Analysis</div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${
                                  (factor.desiredLevel - factor.currentLevel) >= 3 ? 'text-red-600' : 
                                  (factor.desiredLevel - factor.currentLevel) >= 2 ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {factor.desiredLevel - factor.currentLevel} point gap
                                </span>
                                <span className="text-xs text-gray-500 capitalize">• {factor.changeability} to change</span>
                              </div>
                            </div>

                            {factor.barriers && (
                              <div>
                                <div className="text-sm font-medium mb-1">Barriers</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{factor.barriers}</div>
                              </div>
                            )}

                            {factor.enablers && (
                              <div>
                                <div className="text-sm font-medium mb-1">Enablers</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{factor.enablers}</div>
                              </div>
                            )}

                            {factor.notes && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                                <div className="text-sm text-gray-600 dark:text-gray-400">{factor.notes}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Behavior Change Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {behaviorMetrics.score < 70 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-300 mb-1">Low Readiness Score</div>
                <div className="text-sm text-red-700 dark:text-red-400">
                  Current readiness score of {behaviorMetrics.score}% suggests significant barriers to behavior change
                </div>
              </div>
            )}
            {stats.highImpact > 0 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="font-medium text-orange-800 dark:text-orange-300 mb-1">High Impact Priorities</div>
                <div className="text-sm text-orange-700 dark:text-orange-400">
                  {stats.highImpact} high-impact factor(s) identified - prioritize these for intervention
                </div>
              </div>
            )}
            {stats.easyToChange > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="font-medium text-green-800 dark:text-green-300 mb-1">Quick Wins Available</div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  {stats.easyToChange} factor(s) marked as easy to change - consider addressing these first
                </div>
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">Overall Assessment</div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                {stats.total} factors analyzed across {Object.values(groupedFactors).filter(factors => factors.length > 0).length} COM-B components
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}