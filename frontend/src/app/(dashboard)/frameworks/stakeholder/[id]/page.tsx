'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Users, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Eye,
  Target,
  AlertTriangle,
  UserCheck,
  UserX,
  Heart,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface Stakeholder {
  id: string
  name: string
  role: string
  interest: 'high' | 'medium' | 'low'
  influence: 'high' | 'medium' | 'low'
  attitude: 'supportive' | 'neutral' | 'opposed'
  strategy: string
  communication: string
  notes?: string
}

interface StakeholderSession {
  id: string
  title: string
  description?: string
  framework_type: 'stakeholder'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    stakeholders: Stakeholder[]
    project?: string
    context?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function StakeholderViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<StakeholderSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<StakeholderSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load stakeholder analysis',
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
    router.push(`/frameworks/stakeholder/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading stakeholder analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getEngagementStrategy = (interest: string, influence: string): string => {
    if (influence === 'high' && interest === 'high') return 'Manage Closely'
    if (influence === 'high' && interest === 'medium') return 'Keep Satisfied'
    if (influence === 'high' && interest === 'low') return 'Keep Satisfied'
    if (influence === 'medium' && interest === 'high') return 'Keep Informed'
    if (influence === 'low' && interest === 'high') return 'Keep Informed'
    if (influence === 'medium' && interest === 'medium') return 'Regular Updates'
    return 'Monitor'
  }

  const getStrategyColor = (strategy: string): string => {
    switch (strategy) {
      case 'Manage Closely':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'Keep Satisfied':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'Keep Informed':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Regular Updates':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'Monitor':
        return 'bg-gray-100 text-gray-800 dark:text-gray-200 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:text-gray-200 border-gray-300'
    }
  }

  const getAttitudeIcon = (attitude: string) => {
    switch (attitude) {
      case 'supportive':
        return <UserCheck className="h-4 w-4 text-green-600" />
      case 'opposed':
        return <UserX className="h-4 w-4 text-red-600" />
      case 'neutral':
        return <Users className="h-4 w-4 text-gray-600" />
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <Zap className="h-3 w-3 text-red-600" />
      case 'medium':
        return <Zap className="h-3 w-3 text-yellow-600" />
      case 'low':
        return <Zap className="h-3 w-3 text-gray-400" />
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const groupStakeholdersByStrategy = () => {
    const grouped: Record<string, Stakeholder[]> = {}
    session.data.stakeholders.forEach(stakeholder => {
      const strategy = getEngagementStrategy(stakeholder.interest, stakeholder.influence)
      if (!grouped[strategy]) grouped[strategy] = []
      grouped[strategy].push(stakeholder)
    })
    return grouped
  }

  const countByAttitude = () => {
    const counts = {
      supportive: 0,
      neutral: 0,
      opposed: 0
    }
    session.data.stakeholders.forEach(s => {
      counts[s.attitude]++
    })
    return counts
  }

  const groupedStakeholders = groupStakeholdersByStrategy()
  const attitudeCounts = countByAttitude()

  // Create a 2x2 matrix for power/interest grid
  const createPowerInterestMatrix = () => {
    const matrix: Record<string, Stakeholder[]> = {
      'high-high': [],
      'high-medium': [],
      'high-low': [],
      'medium-high': [],
      'medium-medium': [],
      'medium-low': [],
      'low-high': [],
      'low-medium': [],
      'low-low': []
    }
    
    session.data.stakeholders.forEach(stakeholder => {
      const key = `${stakeholder.influence}-${stakeholder.interest}`
      matrix[key].push(stakeholder)
    })
    
    return matrix
  }

  const powerInterestMatrix = createPowerInterestMatrix()

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
          <Button onClick={handleEdit} className="bg-pink-600 hover:bg-pink-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Project Context */}
      {(session.data.project || session.data.context) && (
        <Card>
          <CardHeader>
            <CardTitle>Project Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.data.project && (
              <div>
                <span className="font-medium">Project:</span> {session.data.project}
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

      {/* Stakeholder Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Stakeholder Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-300">
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                {session.data.stakeholders.length}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Stakeholders</div>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-300">
              <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                {attitudeCounts.supportive}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Supportive</div>
            </div>
            <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
                {attitudeCounts.neutral}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Neutral</div>
            </div>
            <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-300">
              <div className="text-2xl font-bold text-red-800 dark:text-red-300">
                {attitudeCounts.opposed}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">Opposed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Power/Interest Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Power/Interest Grid
          </CardTitle>
          <CardDescription>
            Stakeholder engagement strategy based on influence and interest levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {/* Header row */}
            <div></div>
            <div className="text-center text-sm font-medium">Low Interest</div>
            <div className="text-center text-sm font-medium">Medium Interest</div>
            <div className="text-center text-sm font-medium">High Interest</div>
            
            {/* High Influence */}
            <div className="text-sm font-medium text-right pr-2">High Influence</div>
            <div className="border rounded p-2 min-h-24 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="text-xs font-medium mb-1">Keep Satisfied</div>
              {powerInterestMatrix['high-low'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            <div className="border rounded p-2 min-h-24 bg-orange-50 dark:bg-orange-900/20">
              <div className="text-xs font-medium mb-1">Keep Satisfied</div>
              {powerInterestMatrix['high-medium'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            <div className="border rounded p-2 min-h-24 bg-red-50 dark:bg-red-900/20">
              <div className="text-xs font-medium mb-1">Manage Closely</div>
              {powerInterestMatrix['high-high'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            
            {/* Medium Influence */}
            <div className="text-sm font-medium text-right pr-2">Medium Influence</div>
            <div className="border rounded p-2 min-h-24 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900/20">
              <div className="text-xs font-medium mb-1">Monitor</div>
              {powerInterestMatrix['medium-low'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            <div className="border rounded p-2 min-h-24 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="text-xs font-medium mb-1">Regular Updates</div>
              {powerInterestMatrix['medium-medium'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            <div className="border rounded p-2 min-h-24 bg-blue-50 dark:bg-blue-900/20">
              <div className="text-xs font-medium mb-1">Keep Informed</div>
              {powerInterestMatrix['medium-high'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            
            {/* Low Influence */}
            <div className="text-sm font-medium text-right pr-2">Low Influence</div>
            <div className="border rounded p-2 min-h-24 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900/20">
              <div className="text-xs font-medium mb-1">Monitor</div>
              {powerInterestMatrix['low-low'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            <div className="border rounded p-2 min-h-24 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900/20">
              <div className="text-xs font-medium mb-1">Monitor</div>
              {powerInterestMatrix['low-medium'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
            <div className="border rounded p-2 min-h-24 bg-blue-50 dark:bg-blue-900/20">
              <div className="text-xs font-medium mb-1">Keep Informed</div>
              {powerInterestMatrix['low-high'].map(s => (
                <Badge key={s.id} variant="outline" className="text-xs mr-1 mb-1">
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Stakeholder List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Stakeholder Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {session.data.stakeholders.map((stakeholder, index) => {
              const strategy = getEngagementStrategy(stakeholder.interest, stakeholder.influence)
              return (
                <div key={stakeholder.id} className={`border rounded-lg p-4 ${getStrategyColor(strategy)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">S{index + 1}</Badge>
                        <h3 className="font-semibold text-lg">{stakeholder.name}</h3>
                        {getAttitudeIcon(stakeholder.attitude)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{stakeholder.role}</p>
                    </div>
                    <Badge className={getStrategyColor(strategy).replace('border-', '')}>
                      {strategy}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Interest</div>
                        <div className="flex items-center gap-1">
                          {getLevelIcon(stakeholder.interest)}
                          <span className="text-sm font-medium capitalize">{stakeholder.interest}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Influence</div>
                        <div className="flex items-center gap-1">
                          {getLevelIcon(stakeholder.influence)}
                          <span className="text-sm font-medium capitalize">{stakeholder.influence}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Attitude</div>
                        <div className="text-sm font-medium capitalize">{stakeholder.attitude}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Strategy</div>
                        <div className="text-sm font-medium">{strategy}</div>
                      </div>
                    </div>
                  </div>

                  {stakeholder.strategy && (
                    <div className="mb-2">
                      <div className="text-sm font-medium mb-1">Engagement Strategy:</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{stakeholder.strategy}</div>
                    </div>
                  )}

                  {stakeholder.communication && (
                    <div className="mb-2">
                      <div className="text-sm font-medium mb-1">Communication Approach:</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{stakeholder.communication}</div>
                    </div>
                  )}

                  {stakeholder.notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900 rounded">
                      <div className="text-sm font-medium mb-1">Notes:</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{stakeholder.notes}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Priorities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Engagement Priorities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {groupedStakeholders['Manage Closely']?.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-300 mb-1">Critical Stakeholders</div>
                <div className="text-sm text-red-700 dark:text-red-400">
                  {groupedStakeholders['Manage Closely'].map(s => s.name).join(', ')} require close management
                </div>
              </div>
            )}
            {attitudeCounts.opposed > 0 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="font-medium text-orange-800 dark:text-orange-300 mb-1">Opposition Management</div>
                <div className="text-sm text-orange-700 dark:text-orange-400">
                  {attitudeCounts.opposed} opposed stakeholder(s) need specific engagement strategies
                </div>
              </div>
            )}
            {attitudeCounts.supportive > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="font-medium text-green-800 dark:text-green-300 mb-1">Champion Leverage</div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  {attitudeCounts.supportive} supportive stakeholder(s) can help champion the project
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}