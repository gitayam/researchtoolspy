'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Shield, 
  Download, 
  Share2, 
  Edit,
  Calendar,
  Eye,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Building,
  GraduationCap,
  Package,
  UserCheck,
  Users,
  Home,
  Briefcase,
  BarChart3,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface DOTMLPFCapability {
  id: string
  domain: 'doctrine' | 'organization' | 'training' | 'materiel' | 'leadership' | 'personnel' | 'facilities' | 'policy'
  capability: string
  description: string
  currentState: 'adequate' | 'marginal' | 'inadequate'
  desiredState: string
  gap: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  timeline: 'immediate' | 'short' | 'medium' | 'long'
  resources?: string
  dependencies?: string[]
  notes?: string
}

interface DOTMLPFSession {
  id: string
  title: string
  description?: string
  framework_type: 'dotmlpf'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    capabilities: DOTMLPFCapability[]
    mission?: string
    context?: string
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function DOTMLPFViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<DOTMLPFSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<DOTMLPFSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load DOTMLPF-P analysis',
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
    router.push(`/frameworks/dotmlpf/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading DOTMLPF-P analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const domains = [
    { id: 'doctrine', name: 'Doctrine', icon: FileText, color: 'bg-blue-100 text-blue-800' },
    { id: 'organization', name: 'Organization', icon: Building, color: 'bg-green-100 text-green-800' },
    { id: 'training', name: 'Training', icon: GraduationCap, color: 'bg-purple-100 text-purple-800' },
    { id: 'materiel', name: 'Materiel', icon: Package, color: 'bg-orange-100 text-orange-800' },
    { id: 'leadership', name: 'Leadership', icon: UserCheck, color: 'bg-pink-100 text-pink-800' },
    { id: 'personnel', name: 'Personnel', icon: Users, color: 'bg-cyan-100 text-cyan-800' },
    { id: 'facilities', name: 'Facilities', icon: Home, color: 'bg-gray-100 text-gray-800' },
    { id: 'policy', name: 'Policy', icon: Briefcase, color: 'bg-amber-100 text-amber-800' }
  ]

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'adequate':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'marginal':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'inadequate':
        return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-gray-100 text-gray-800 dark:text-gray-200 border-gray-300'
    }
  }

  const getTimelineValue = (timeline: string) => {
    switch (timeline) {
      case 'immediate': return 100
      case 'short': return 75
      case 'medium': return 50
      case 'long': return 25
      default: return 0
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const groupCapabilitiesByDomain = () => {
    const grouped: Record<string, DOTMLPFCapability[]> = {}
    domains.forEach(domain => {
      grouped[domain.id] = session.data.capabilities.filter(cap => cap.domain === domain.id)
    })
    return grouped
  }

  const calculateStats = () => {
    const capabilities = session.data.capabilities
    const stats = {
      total: capabilities.length,
      critical: capabilities.filter(c => c.priority === 'critical').length,
      inadequate: capabilities.filter(c => c.currentState === 'inadequate').length,
      marginal: capabilities.filter(c => c.currentState === 'marginal').length,
      adequate: capabilities.filter(c => c.currentState === 'adequate').length,
      immediate: capabilities.filter(c => c.timeline === 'immediate').length
    }
    return stats
  }

  const groupedCapabilities = groupCapabilitiesByDomain()
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
          <Button onClick={handleEdit} className="bg-amber-600 hover:bg-amber-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Mission Context */}
      {(session.data.mission || session.data.context) && (
        <Card>
          <CardHeader>
            <CardTitle>Mission & Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.data.mission && (
              <div>
                <span className="font-medium">Mission:</span> {session.data.mission}
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

      {/* Capability Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Capability Assessment Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-300">
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.total}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Capabilities</div>
            </div>
            <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-300">
              <div className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.critical}</div>
              <div className="text-sm text-red-600 dark:text-red-400">Critical</div>
            </div>
            <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-900/20 border-orange-300">
              <div className="text-2xl font-bold text-orange-800 dark:text-orange-300">{stats.inadequate}</div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Inadequate</div>
            </div>
            <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{stats.marginal}</div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Marginal</div>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-300">
              <div className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.adequate}</div>
              <div className="text-sm text-green-600 dark:text-green-400">Adequate</div>
            </div>
            <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-300">
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">{stats.immediate}</div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Immediate Action</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Analysis */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 lg:grid-cols-9 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {domains.map(domain => {
            const domainCaps = groupedCapabilities[domain.id]
            const DomainIcon = domain.icon
            return (
              <TabsTrigger key={domain.id} value={domain.id} className="relative">
                <DomainIcon className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">{domain.name}</span>
                {domainCaps.length > 0 && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                    {domainCaps.length}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Domain Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Domain Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {domains.map(domain => {
                    const domainCaps = groupedCapabilities[domain.id]
                    const criticalInDomain = domainCaps.filter(c => c.priority === 'critical').length
                    const inadequateInDomain = domainCaps.filter(c => c.currentState === 'inadequate').length
                    const DomainIcon = domain.icon
                    
                    return (
                      <div key={domain.id} className={`p-4 rounded-lg border ${domain.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <DomainIcon className="h-4 w-4" />
                          <span className="font-medium">{domain.name}</span>
                        </div>
                        <div className="text-2xl font-bold mb-1">{domainCaps.length}</div>
                        <div className="text-xs space-y-1">
                          {criticalInDomain > 0 && (
                            <div className="flex justify-between">
                              <span>Critical:</span>
                              <span className="font-medium text-red-600">{criticalInDomain}</span>
                            </div>
                          )}
                          {inadequateInDomain > 0 && (
                            <div className="flex justify-between">
                              <span>Inadequate:</span>
                              <span className="font-medium text-orange-600">{inadequateInDomain}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Priority Actions */}
            {stats.critical > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Critical Capability Gaps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {session.data.capabilities
                      .filter(cap => cap.priority === 'critical')
                      .map((capability, index) => (
                        <div key={capability.id} className="p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">C{index + 1}</Badge>
                                <span className="font-medium">{capability.capability}</span>
                                {getStateIcon(capability.currentState)}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {capability.description}
                              </p>
                              <div className="text-sm">
                                <span className="font-medium">Gap: </span>
                                {capability.gap}
                              </div>
                            </div>
                            <Badge className="bg-red-100 text-red-800">
                              {capability.timeline}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {domains.map(domain => {
          const domainCapabilities = groupedCapabilities[domain.id]
          const DomainIcon = domain.icon
          
          return (
            <TabsContent key={domain.id} value={domain.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DomainIcon className="h-5 w-5" />
                    {domain.name} Domain Assessment
                  </CardTitle>
                  <CardDescription>
                    {domainCapabilities.length} capabilities assessed in this domain
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {domainCapabilities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No capabilities assessed in this domain yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {domainCapabilities.map((capability, index) => (
                        <div key={capability.id} className={`border rounded-lg p-4 ${getPriorityColor(capability.priority)}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{domain.name[0]}{index + 1}</Badge>
                                <h3 className="font-semibold">{capability.capability}</h3>
                                {getStateIcon(capability.currentState)}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {capability.description}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <Badge className={getPriorityColor(capability.priority).replace('border-', '')}>
                                {capability.priority} priority
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                              <div className="text-sm font-medium mb-1">Current State</div>
                              <div className="flex items-center gap-2">
                                {getStateIcon(capability.currentState)}
                                <span className="capitalize">{capability.currentState}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-1">Timeline</div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span className="capitalize">{capability.timeline} term</span>
                                </div>
                                <Progress value={getTimelineValue(capability.timeline)} className="h-1.5" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-1">Desired State</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">{capability.desiredState}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-1">Gap Analysis</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">{capability.gap}</div>
                            </div>
                            {capability.resources && (
                              <div>
                                <div className="text-sm font-medium mb-1">Resources Required</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{capability.resources}</div>
                              </div>
                            )}
                            {capability.notes && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-800 dark:bg-gray-900 rounded">
                                <div className="text-sm text-gray-600 dark:text-gray-400">{capability.notes}</div>
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
            <Target className="h-5 w-5" />
            Strategic Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.critical > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-300 mb-1">Immediate Action Required</div>
                <div className="text-sm text-red-700 dark:text-red-400">
                  {stats.critical} critical capability gap(s) require immediate attention and resource allocation
                </div>
              </div>
            )}
            {stats.inadequate > 0 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="font-medium text-orange-800 dark:text-orange-300 mb-1">Capability Development</div>
                <div className="text-sm text-orange-700 dark:text-orange-400">
                  {stats.inadequate} capability area(s) assessed as inadequate need focused development efforts
                </div>
              </div>
            )}
            {stats.immediate > 0 && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="font-medium text-purple-800 dark:text-purple-300 mb-1">Short-term Focus</div>
                <div className="text-sm text-purple-700 dark:text-purple-400">
                  {stats.immediate} capability improvement(s) scheduled for immediate implementation
                </div>
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-medium text-blue-800 dark:text-blue-300 mb-1">Overall Assessment</div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                {stats.total} total capabilities assessed across {Object.values(groupedCapabilities).filter(caps => caps.length > 0).length} DOTMLPF-P domains
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}