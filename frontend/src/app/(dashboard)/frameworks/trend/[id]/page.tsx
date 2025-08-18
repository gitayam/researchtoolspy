'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  TrendingUp, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Eye,
  BarChart3,
  AlertTriangle,
  TrendingDown,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface Trend {
  id: string
  name: string
  description: string
  category: string
  direction: 'increasing' | 'decreasing' | 'stable'
  strength: 'strong' | 'moderate' | 'weak'
  timeframe: 'short' | 'medium' | 'long'
  confidence: 'high' | 'medium' | 'low'
  impact: 'positive' | 'negative' | 'neutral'
  indicators: string[]
  implications?: string
  notes?: string
}

interface TrendSession {
  id: string
  title: string
  description?: string
  framework_type: 'trend'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    trends: Trend[]
    domain?: string
    period?: string
    context?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function TrendViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<TrendSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<TrendSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load trend analysis',
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
    router.push(`/frameworks/trend/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading trend analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return <ArrowUp className="h-4 w-4 text-green-600" />
      case 'decreasing':
        return <ArrowDown className="h-4 w-4 text-red-600" />
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'text-red-600 bg-red-50'
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50'
      case 'weak':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getConfidenceValue = (confidence: string) => {
    switch (confidence) {
      case 'high': return 90
      case 'medium': return 60
      case 'low': return 30
      default: return 0
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'negative':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'neutral':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const groupTrendsByCategory = () => {
    const grouped: Record<string, Trend[]> = {}
    session.data.trends.forEach(trend => {
      if (!grouped[trend.category]) grouped[trend.category] = []
      grouped[trend.category].push(trend)
    })
    return grouped
  }

  const calculateTrendStats = () => {
    const stats = {
      increasing: session.data.trends.filter(t => t.direction === 'increasing').length,
      decreasing: session.data.trends.filter(t => t.direction === 'decreasing').length,
      stable: session.data.trends.filter(t => t.direction === 'stable').length,
      highConfidence: session.data.trends.filter(t => t.confidence === 'high').length,
      strongTrends: session.data.trends.filter(t => t.strength === 'strong').length
    }
    return stats
  }

  const groupedTrends = groupTrendsByCategory()
  const trendStats = calculateTrendStats()

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
          <Button onClick={handleEdit} className="bg-indigo-600 hover:bg-indigo-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Context */}
      {(session.data.domain || session.data.period || session.data.context) && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.data.domain && (
              <div>
                <span className="font-medium">Domain:</span> {session.data.domain}
              </div>
            )}
            {session.data.period && (
              <div>
                <span className="font-medium">Analysis Period:</span> {session.data.period}
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

      {/* Trend Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trend Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-300">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">Increasing</span>
              </div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                {trendStats.increasing}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-300">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-400">Decreasing</span>
              </div>
              <div className="text-2xl font-bold text-red-800 dark:text-red-300">
                {trendStats.decreasing}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-900/20 border-gray-300">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700 dark:text-gray-400">Stable</span>
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-300">
                {trendStats.stable}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-300">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-400">High Confidence</span>
              </div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                {trendStats.highConfidence}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-300">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-700 dark:text-purple-400">Strong Trends</span>
              </div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                {trendStats.strongTrends}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trends by Category */}
      {Object.entries(groupedTrends).map(([category, trends]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {category}
              <Badge variant="outline">{trends.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trends.map((trend, index) => (
                <div key={trend.id} className={`border rounded-lg p-4 ${getImpactColor(trend.impact)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">T{index + 1}</Badge>
                        <h3 className="font-semibold text-lg">{trend.name}</h3>
                        {getDirectionIcon(trend.direction)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {trend.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={getStrengthColor(trend.strength)}>
                        {trend.strength} strength
                      </Badge>
                      <Badge className={getImpactColor(trend.impact).replace('border-', '')}>
                        {trend.impact} impact
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Direction</div>
                      <div className="flex items-center gap-1">
                        {getDirectionIcon(trend.direction)}
                        <span className="text-sm font-medium capitalize">{trend.direction}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Timeframe</div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-sm font-medium capitalize">{trend.timeframe} term</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Confidence</div>
                      <div className="space-y-1">
                        <span className="text-sm font-medium capitalize">{trend.confidence}</span>
                        <Progress value={getConfidenceValue(trend.confidence)} className="h-1.5" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Strength</div>
                      <Badge className={getStrengthColor(trend.strength)}>
                        {trend.strength}
                      </Badge>
                    </div>
                  </div>

                  {trend.indicators && trend.indicators.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-1">Key Indicators:</div>
                      <div className="flex flex-wrap gap-1">
                        {trend.indicators.map((indicator, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {trend.implications && (
                    <div className="mb-2">
                      <div className="text-sm font-medium mb-1">Implications:</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{trend.implications}</div>
                    </div>
                  )}

                  {trend.notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{trend.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Key Trend Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trendStats.strongTrends > 0 && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="font-medium text-purple-800 dark:text-purple-300 mb-1">Strong Trends Detected</div>
                <div className="text-sm text-purple-700 dark:text-purple-400">
                  {trendStats.strongTrends} strong trend(s) require immediate attention and strategic planning
                </div>
              </div>
            )}
            {trendStats.increasing > trendStats.decreasing && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="font-medium text-green-800 dark:text-green-300 mb-1">Growth Momentum</div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  Majority of trends ({trendStats.increasing}) show increasing patterns, indicating growth opportunities
                </div>
              </div>
            )}
            {trendStats.decreasing > trendStats.increasing && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-300 mb-1">Declining Patterns</div>
                <div className="text-sm text-red-700 dark:text-red-400">
                  Majority of trends ({trendStats.decreasing}) show declining patterns, requiring mitigation strategies
                </div>
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">Confidence Level</div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                {trendStats.highConfidence} trend(s) have high confidence ratings, providing reliable planning basis
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}