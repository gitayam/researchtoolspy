'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Zap, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Eye,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  Shield,
  Gem,
  Users
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface VRIOResource {
  id: string
  name: string
  description: string
  valuable: 'yes' | 'no' | 'uncertain'
  rare: 'yes' | 'no' | 'uncertain'
  imitable: 'yes' | 'no' | 'uncertain'
  organized: 'yes' | 'no' | 'uncertain'
  competitiveImplication: string
  notes?: string
}

interface VRIOSession {
  id: string
  title: string
  description?: string
  framework_type: 'vrio'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    resources: VRIOResource[]
    context?: string
    industry?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function VRIOViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<VRIOSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<VRIOSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load VRIO analysis',
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
    router.push(`/frameworks/vrio/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading VRIO analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getCompetitiveAdvantage = (resource: VRIOResource): string => {
    const { valuable, rare, imitable, organized } = resource
    
    if (valuable === 'no') return 'Competitive Disadvantage'
    if (valuable === 'uncertain') return 'Uncertain'
    if (rare === 'no') return 'Competitive Parity'
    if (rare === 'uncertain') return 'Potential Advantage'
    if (imitable === 'yes') return 'Temporary Competitive Advantage'
    if (imitable === 'uncertain') return 'Potential Sustained Advantage'
    if (organized === 'no') return 'Unused Competitive Advantage'
    if (organized === 'uncertain') return 'Potential Sustained Advantage'
    
    return 'Sustained Competitive Advantage'
  }

  const getAdvantageColor = (advantage: string): string => {
    switch (advantage) {
      case 'Sustained Competitive Advantage':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Temporary Competitive Advantage':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'Competitive Parity':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'Competitive Disadvantage':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'Unused Competitive Advantage':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  const getIcon = (value: 'yes' | 'no' | 'uncertain') => {
    switch (value) {
      case 'yes':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'no':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'uncertain':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const countByAdvantage = () => {
    const counts: Record<string, number> = {}
    session.data.resources.forEach(resource => {
      const advantage = getCompetitiveAdvantage(resource)
      counts[advantage] = (counts[advantage] || 0) + 1
    })
    return counts
  }

  const advantageCounts = countByAdvantage()

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
          <Button onClick={handleEdit} className="bg-yellow-600 hover:bg-yellow-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Context */}
      {(session.data.context || session.data.industry) && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Competitive Position Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(advantageCounts).map(([advantage, count]) => (
              <div key={advantage} className={`p-3 rounded-lg border ${getAdvantageColor(advantage)}`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm">{advantage}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Resources & Capabilities Analysis
          </CardTitle>
          <CardDescription>
            VRIO framework assessment of organizational resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {session.data.resources.map((resource, index) => {
              const advantage = getCompetitiveAdvantage(resource)
              return (
                <div key={resource.id} className={`border rounded-lg p-4 ${getAdvantageColor(advantage)}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">R{index + 1}</Badge>
                        <h3 className="font-semibold text-lg">{resource.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {resource.description}
                      </p>
                    </div>
                    <Badge className={getAdvantageColor(advantage).replace('border-', '')}>
                      {advantage}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                      {getIcon(resource.valuable)}
                      <div>
                        <div className="text-xs text-gray-500">Valuable</div>
                        <div className="font-medium capitalize">{resource.valuable}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                      {getIcon(resource.rare)}
                      <div>
                        <div className="text-xs text-gray-500">Rare</div>
                        <div className="font-medium capitalize">{resource.rare}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                      {getIcon(resource.imitable)}
                      <div>
                        <div className="text-xs text-gray-500">Imitable</div>
                        <div className="font-medium capitalize">{resource.imitable}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                      {getIcon(resource.organized)}
                      <div>
                        <div className="text-xs text-gray-500">Organized</div>
                        <div className="font-medium capitalize">{resource.organized}</div>
                      </div>
                    </div>
                  </div>

                  {resource.notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="text-sm font-medium mb-1">Notes:</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{resource.notes}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Strategic Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Strategic Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {advantageCounts['Sustained Competitive Advantage'] > 0 && (
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Protect Core Advantages</div>
                  <div className="text-sm text-gray-600">
                    You have {advantageCounts['Sustained Competitive Advantage']} resources providing sustained competitive advantage. 
                    Focus on maintaining and strengthening these capabilities.
                  </div>
                </div>
              </div>
            )}
            {advantageCounts['Temporary Competitive Advantage'] > 0 && (
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium">Extend Temporary Advantages</div>
                  <div className="text-sm text-gray-600">
                    {advantageCounts['Temporary Competitive Advantage']} resources provide temporary advantage. 
                    Work to make these harder to imitate or develop new advantages.
                  </div>
                </div>
              </div>
            )}
            {advantageCounts['Unused Competitive Advantage'] > 0 && (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="font-medium">Organize Unused Potential</div>
                  <div className="text-sm text-gray-600">
                    {advantageCounts['Unused Competitive Advantage']} valuable resources are not fully organized. 
                    Invest in systems and processes to capture this value.
                  </div>
                </div>
              </div>
            )}
            {advantageCounts['Competitive Disadvantage'] > 0 && (
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <div className="font-medium">Address Weaknesses</div>
                  <div className="text-sm text-gray-600">
                    {advantageCounts['Competitive Disadvantage']} resources represent competitive disadvantages. 
                    Consider divesting or improving these areas.
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}