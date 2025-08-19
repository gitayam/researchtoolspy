'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Eye, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Activity,
  AlertTriangle,
  Shield,
  Target,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Info,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface SurveillanceTarget {
  id: string
  name: string
  type: 'competitor' | 'market' | 'technology' | 'regulatory' | 'social' | 'other'
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'emerging' | 'declining' | 'stable'
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly'
  sources: string[]
  indicators: string[]
  lastUpdate?: string
  findings?: string
  risks?: string
  opportunities?: string
  notes?: string
}

interface SurveillanceSession {
  id: string
  title: string
  description?: string
  framework_type: 'surveillance'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    targets: SurveillanceTarget[]
    scope?: string
    objectives?: string
    context?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function SurveillanceViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<SurveillanceSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<SurveillanceSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load surveillance analysis',
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
    router.push(`/frameworks/surveillance/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-gray-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading surveillance analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'competitor':
        return <Target className="h-4 w-4" />
      case 'market':
        return <TrendingUp className="h-4 w-4" />
      case 'technology':
        return <Activity className="h-4 w-4" />
      case 'regulatory':
        return <Shield className="h-4 w-4" />
      case 'social':
        return <Eye className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'competitor':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'market':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'technology':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'regulatory':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'social':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:text-gray-200 border-gray-300'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-50'
      case 'high':
        return 'text-orange-600 bg-orange-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="h-4 w-4 text-green-600" />
      case 'emerging':
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'declining':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getFrequencyValue = (frequency: string) => {
    switch (frequency) {
      case 'continuous': return 100
      case 'daily': return 75
      case 'weekly': return 50
      case 'monthly': return 25
      default: return 0
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const groupTargetsByType = () => {
    const grouped: Record<string, SurveillanceTarget[]> = {}
    session.data.targets.forEach(target => {
      if (!grouped[target.type]) grouped[target.type] = []
      grouped[target.type].push(target)
    })
    return grouped
  }

  const calculatePriorityStats = () => {
    const stats = {
      critical: session.data.targets.filter(t => t.priority === 'critical').length,
      high: session.data.targets.filter(t => t.priority === 'high').length,
      medium: session.data.targets.filter(t => t.priority === 'medium').length,
      low: session.data.targets.filter(t => t.priority === 'low').length,
      active: session.data.targets.filter(t => t.status === 'active').length,
      emerging: session.data.targets.filter(t => t.status === 'emerging').length
    }
    return stats
  }

  const groupedTargets = groupTargetsByType()
  const priorityStats = calculatePriorityStats()

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
          <Button onClick={handleEdit} className="bg-gray-600 hover:bg-gray-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Surveillance Scope */}
      {(session.data.scope || session.data.objectives || session.data.context) && (
        <Card>
          <CardHeader>
            <CardTitle>Surveillance Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.data.scope && (
              <div>
                <span className="font-medium">Scope:</span> {session.data.scope}
              </div>
            )}
            {session.data.objectives && (
              <div>
                <span className="font-medium">Objectives:</span> {session.data.objectives}
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

      {/* Priority Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Surveillance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-300">
              <div className="text-2xl font-bold text-red-800 dark:text-red-300">
                {priorityStats.critical}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">Critical</div>
            </div>
            <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-900/20 border-orange-300">
              <div className="text-2xl font-bold text-orange-800 dark:text-orange-300">
                {priorityStats.high}
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-400">High Priority</div>
            </div>
            <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
                {priorityStats.medium}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Medium</div>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-300">
              <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                {priorityStats.low}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">Low</div>
            </div>
            <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-300">
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                {priorityStats.active}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Active</div>
            </div>
            <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-300">
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                {priorityStats.emerging}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Emerging</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Surveillance Targets by Type */}
      {Object.entries(groupedTargets).map(([type, targets]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTypeIcon(type)}
              <span className="capitalize">{type} Surveillance</span>
              <Badge variant="outline">{targets.length}</Badge>
            </CardTitle>
            <CardDescription>
              {type === 'competitor' && 'Monitoring competitive landscape and activities'}
              {type === 'market' && 'Tracking market trends and opportunities'}
              {type === 'technology' && 'Observing technological developments and innovations'}
              {type === 'regulatory' && 'Monitoring regulatory changes and compliance requirements'}
              {type === 'social' && 'Tracking social trends and public sentiment'}
              {type === 'other' && 'Additional surveillance targets'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {targets.map((target, index) => (
                <div key={target.id} className={`border rounded-lg p-4 ${getTypeColor(target.type)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">T{index + 1}</Badge>
                        <h3 className="font-semibold text-lg">{target.name}</h3>
                        {getStatusIcon(target.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {target.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={getPriorityColor(target.priority)}>
                        {target.priority} priority
                      </Badge>
                      <Badge variant="outline">
                        {target.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Monitoring Frequency</div>
                      <div className="space-y-1">
                        <span className="text-sm font-medium capitalize">{target.frequency}</span>
                        <Progress value={getFrequencyValue(target.frequency)} className="h-1.5" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(target.status)}
                        <span className="text-sm font-medium capitalize">{target.status}</span>
                      </div>
                    </div>
                    {target.lastUpdate && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Last Update</div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span className="text-sm">{target.lastUpdate}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {target.sources && target.sources.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-1">Information Sources:</div>
                      <div className="flex flex-wrap gap-1">
                        {target.sources.map((source, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {target.indicators && target.indicators.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-1">Key Indicators:</div>
                      <div className="flex flex-wrap gap-1">
                        {target.indicators.map((indicator, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {target.findings && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <div className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-300">
                          Key Findings
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-400">{target.findings}</div>
                      </div>
                    )}
                    {target.risks && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded">
                        <div className="text-sm font-medium mb-1 text-red-800 dark:text-red-300">
                          Identified Risks
                        </div>
                        <div className="text-sm text-red-700 dark:text-red-400">{target.risks}</div>
                      </div>
                    )}
                    {target.opportunities && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="text-sm font-medium mb-1 text-green-800 dark:text-green-300">
                          Opportunities
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-400">{target.opportunities}</div>
                      </div>
                    )}
                  </div>

                  {target.notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900 rounded">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{target.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Surveillance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Surveillance Insights & Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {priorityStats.critical > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-300 mb-1">Critical Attention Required</div>
                <div className="text-sm text-red-700 dark:text-red-400">
                  {priorityStats.critical} critical priority target(s) require immediate monitoring and response
                </div>
              </div>
            )}
            {priorityStats.emerging > 0 && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="font-medium text-purple-800 dark:text-purple-300 mb-1">Emerging Patterns</div>
                <div className="text-sm text-purple-700 dark:text-purple-400">
                  {priorityStats.emerging} emerging target(s) detected - consider increasing monitoring frequency
                </div>
              </div>
            )}
            {priorityStats.active > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">Active Monitoring</div>
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  {priorityStats.active} active target(s) under continuous surveillance
                </div>
              </div>
            )}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900/20 rounded-lg">
              <div className="font-medium text-gray-800 dark:text-gray-200 dark:text-gray-300 mb-1">Coverage Analysis</div>
              <div className="text-sm text-gray-700 dark:text-gray-400">
                Monitoring {session.data.targets.length} targets across {Object.keys(groupedTargets).length} categories
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Add missing import for Minus icon
import { Minus } from 'lucide-react'