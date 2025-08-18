'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Globe, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Eye,
  TrendingUp,
  Building,
  DollarSign,
  Users,
  Cpu,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface PESTFactor {
  id: string
  category: 'political' | 'economic' | 'social' | 'technological'
  factor: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  importance: 'high' | 'medium' | 'low'
  timeframe: 'short' | 'medium' | 'long'
  notes?: string
}

interface PESTSession {
  id: string
  title: string
  description?: string
  framework_type: 'pest'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    factors: PESTFactor[]
    context?: string
    region?: string
    industry?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function PESTViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<PESTSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<PESTSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load PEST analysis',
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
    router.push(`/frameworks/pest/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading PEST analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'political':
        return <Building className="h-4 w-4" />
      case 'economic':
        return <DollarSign className="h-4 w-4" />
      case 'social':
        return <Users className="h-4 w-4" />
      case 'technological':
        return <Cpu className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'political':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'economic':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'social':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'technological':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'negative':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'neutral':
        return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'text-red-600 bg-red-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const groupFactorsByCategory = () => {
    const grouped: Record<string, PESTFactor[]> = {
      political: [],
      economic: [],
      social: [],
      technological: []
    }
    session.data.factors.forEach(factor => {
      grouped[factor.category].push(factor)
    })
    return grouped
  }

  const calculateCategoryStats = (category: string) => {
    const factors = session.data.factors.filter(f => f.category === category)
    const positive = factors.filter(f => f.impact === 'positive').length
    const negative = factors.filter(f => f.impact === 'negative').length
    const high = factors.filter(f => f.importance === 'high').length
    return { total: factors.length, positive, negative, high }
  }

  const groupedFactors = groupFactorsByCategory()
  const categories = ['political', 'economic', 'social', 'technological']

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
          <Button onClick={handleEdit} className="bg-teal-600 hover:bg-teal-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Context */}
      {(session.data.context || session.data.region || session.data.industry) && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.data.region && (
              <div>
                <span className="font-medium">Region:</span> {session.data.region}
              </div>
            )}
            {session.data.industry && (
              <div>
                <span className="font-medium">Industry:</span> {session.data.industry}
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

      {/* Category Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Environmental Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(category => {
              const stats = calculateCategoryStats(category)
              const percentage = session.data.factors.length > 0 
                ? (stats.total / session.data.factors.length) * 100 
                : 0
              
              return (
                <div key={category} className={`p-4 rounded-lg border ${getCategoryColor(category)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(category)}
                    <span className="font-medium capitalize">{category}</span>
                  </div>
                  <div className="text-2xl font-bold mb-1">{stats.total}</div>
                  <Progress value={percentage} className="h-2 mb-2" />
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Positive:</span>
                      <span className="font-medium">{stats.positive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Negative:</span>
                      <span className="font-medium">{stats.negative}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>High Priority:</span>
                      <span className="font-medium">{stats.high}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Factors by Category */}
      {categories.map(category => {
        const factors = groupedFactors[category]
        if (factors.length === 0) return null
        
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getCategoryIcon(category)}
                <span className="capitalize">{category} Factors</span>
                <Badge variant="outline">{factors.length}</Badge>
              </CardTitle>
              <CardDescription>
                {category === 'political' && 'Government policies, regulations, and political stability'}
                {category === 'economic' && 'Economic conditions, trends, and financial factors'}
                {category === 'social' && 'Demographics, cultural trends, and societal changes'}
                {category === 'technological' && 'Technology advancements and digital transformation'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {factors.map((factor, index) => (
                  <div key={factor.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">F{index + 1}</Badge>
                          <h4 className="font-semibold">{factor.factor}</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {factor.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getImpactIcon(factor.impact)}
                        <Badge className={getImportanceColor(factor.importance)}>
                          {factor.importance} priority
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Impact:</span>
                        <span className="font-medium capitalize">{factor.impact}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Timeframe:</span>
                        <span className="font-medium capitalize">{factor.timeframe} term</span>
                      </div>
                    </div>
                    
                    {factor.notes && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{factor.notes}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Key Environmental Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {session.data.factors.filter(f => f.importance === 'high' && f.impact === 'positive').length > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="font-medium text-green-800 dark:text-green-300 mb-1">Key Opportunities</div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  {session.data.factors.filter(f => f.importance === 'high' && f.impact === 'positive').length} high-priority positive factors identified
                </div>
              </div>
            )}
            {session.data.factors.filter(f => f.importance === 'high' && f.impact === 'negative').length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-300 mb-1">Critical Threats</div>
                <div className="text-sm text-red-700 dark:text-red-400">
                  {session.data.factors.filter(f => f.importance === 'high' && f.impact === 'negative').length} high-priority negative factors require attention
                </div>
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">Strategic Focus</div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                Monitor {session.data.factors.filter(f => f.timeframe === 'short').length} short-term factors for immediate action
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}