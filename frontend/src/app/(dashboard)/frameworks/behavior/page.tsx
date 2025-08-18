'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Brain, 
  Plus, 
  Search, 
  Grid, 
  Calendar,
  Eye,
  MoreVertical,
  Target,
  Lightbulb,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface BehaviorAnalysis {
  id: string
  title: string
  description?: string
  framework_type: 'behavior'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    factors: Array<{
      component: string
      factor: string
      currentLevel: number
      desiredLevel: number
      impact: string
    }>
    targetBehavior?: string
  }
  created_at: string
  updated_at: string
}

export default function BehaviorListPage() {
  const [analyses, setAnalyses] = useState<BehaviorAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<BehaviorAnalysis[]>('/frameworks/', {
          params: { framework_type: 'behavior' }
        })
        setAnalyses(response)
      } catch (error: any) {
        console.warn('API not available, using empty data:', error.message)
        // Don't show error toast for missing API endpoints in development
        setAnalyses([])
      } finally {
        setLoading(false)
      }
    }

    fetchAnalyses()
  }, [toast])

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/frameworks/${id}`)
      setAnalyses(analyses.filter(a => a.id !== id))
      toast({
        title: 'Success',
        description: 'Analysis deleted successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete analysis',
        variant: 'destructive'
      })
    }
  }

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.data.targetBehavior?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'capability': return Zap
      case 'opportunity': return Target
      case 'motivation': return Lightbulb
      default: return Brain
    }
  }

  const getComponentCounts = (factors: any[]) => {
    const counts: Record<string, number> = {}
    factors.forEach(factor => {
      counts[factor.component] = (counts[factor.component] || 0) + 1
    })
    return counts
  }

  const calculateBehaviorScore = (factors: any[]) => {
    if (factors.length === 0) return 0
    const averageGap = factors.reduce((sum, factor) => {
      return sum + (factor.desiredLevel - factor.currentLevel)
    }, 0) / factors.length
    return Math.max(0, Math.round(100 - (averageGap * 10)))
  }

  const getHighImpactCount = (factors: any[]) => {
    return factors.filter(f => f.impact === 'high').length
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">COM-B Behavior Analysis</h1>
          <p className="text-gray-600 mt-2">Capability, Opportunity, Motivation framework for behavior change</p>
        </div>
        <Link href="/frameworks/behavior/create">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search analyses..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Grid className="h-4 w-4 mr-2" />
          Grid View
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading analyses...</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <Card className="text-center py-12">
            <div className="mx-auto max-w-md">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm ? 'No analyses found' : 'No Behavior Analyses Yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Get started by creating your first COM-B behavior analysis'
                }
              </p>
              {!searchTerm && (
                <Link href="/frameworks/behavior/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Analysis
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          filteredAnalyses.map((analysis) => {
            const componentCounts = getComponentCounts(analysis.data.factors || [])
            const behaviorScore = calculateBehaviorScore(analysis.data.factors || [])
            const highImpactCount = getHighImpactCount(analysis.data.factors || [])
            
            return (
              <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link href={`/frameworks/behavior/${analysis.id}`}>
                          <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                            {analysis.title}
                          </h3>
                        </Link>
                        <Badge className={getStatusColor(analysis.status)}>
                          {analysis.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {analysis.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-3">{analysis.description}</p>
                      )}
                      {analysis.data.targetBehavior && (
                        <p className="text-sm text-gray-500 mb-3 italic">
                          Target: {analysis.data.targetBehavior}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">Behavior Score:</span>
                          <span className={`ml-2 font-medium ${
                            behaviorScore >= 80 ? 'text-green-600' : 
                            behaviorScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {behaviorScore}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Factors:</span>
                          <span className="ml-2 font-medium">{analysis.data.factors?.length || 0}</span>
                        </div>
                        {highImpactCount > 0 && (
                          <div>
                            <span className="text-gray-500">High Impact:</span>
                            <span className="ml-2 font-medium text-red-600">{highImpactCount}</span>
                          </div>
                        )}
                        <div className="text-gray-500">
                          Updated {formatRelativeTime(analysis.updated_at)}
                        </div>
                      </div>
                      
                      {Object.keys(componentCounts).length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {Object.entries(componentCounts).map(([component, count]) => {
                            const Icon = getComponentIcon(component)
                            return (
                              <Badge key={component} variant="outline" className="text-xs">
                                <Icon className="h-3 w-3 mr-1" />
                                {component}: {count}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/frameworks/behavior/${analysis.id}`}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/frameworks/behavior/${analysis.id}/edit`}>Edit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleDelete(analysis.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}