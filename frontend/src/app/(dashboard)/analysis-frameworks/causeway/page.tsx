'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  GitBranch, 
  Plus, 
  Search, 
  Grid, 
  MoreVertical,
  TrendingUp,
  AlertTriangle,
  CheckCircle
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

interface CausewayAnalysis {
  id: string
  title: string
  description?: string
  framework_type: 'causeway'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
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

export default function CausewayListPage() {
  const [analyses, setAnalyses] = useState<CausewayAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<CausewayAnalysis[]>('/frameworks/', {
          params: { framework_type: 'causeway' }
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
    analysis.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
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

  const getCategoryCounts = (rootCauses: any[]) => {
    const counts: Record<string, number> = {}
    rootCauses.forEach(cause => {
      counts[cause.category] = (counts[cause.category] || 0) + 1
    })
    return counts
  }

  const calculateRiskScore = (analysis: CausewayAnalysis) => {
    const { rootCauses, effects } = analysis.data
    if (rootCauses.length === 0 || effects.length === 0) return 0
    
    const avgLikelihood = rootCauses.reduce((sum, cause) => sum + cause.likelihood, 0) / rootCauses.length
    const criticalEffects = effects.filter(e => e.severity === 'critical').length
    const majorEffects = effects.filter(e => e.severity === 'major').length
    
    const impactScore = (criticalEffects * 3 + majorEffects * 2) / effects.length
    return Math.round((avgLikelihood * impactScore) * 10)
  }

  const getHighRiskCount = (rootCauses: any[]) => {
    return rootCauses.filter(c => c.impact === 'high').length
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Causeway Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Root cause analysis framework for systematic problem investigation</p>
        </div>
        <Link href="/analysis-frameworks/causeway/create">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
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
            className="pl-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
          <Grid className="h-4 w-4 mr-2" />
          Grid View
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading analyses...</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <Card className="text-center py-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="mx-auto max-w-md">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                {searchTerm ? 'No analyses found' : 'No Causeway Analyses Yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Get started by creating your first causeway root cause analysis'
                }
              </p>
              {!searchTerm && (
                <Link href="/analysis-frameworks/causeway/create">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Analysis
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          filteredAnalyses.map((analysis) => {
            const categoryCounts = getCategoryCounts(analysis.data.rootCauses || [])
            const riskScore = calculateRiskScore(analysis)
            const highRiskCount = getHighRiskCount(analysis.data.rootCauses || [])
            
            return (
              <Card key={analysis.id} className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link href={`/analysis-frameworks/causeway/${analysis.id}`}>
                          <h3 className="text-xl font-semibold hover:text-purple-600 transition-colors text-gray-900 dark:text-gray-100">
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
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Risk Score:</span>
                          <span className={`ml-2 font-medium ${
                            riskScore >= 70 ? 'text-red-600' : 
                            riskScore >= 40 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {riskScore}/100
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Root Causes:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{analysis.data.rootCauses?.length || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Effects:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{analysis.data.effects?.length || 0}</span>
                        </div>
                        {highRiskCount > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">High Risk:</span>
                            <span className="ml-2 font-medium text-red-600">{highRiskCount}</span>
                          </div>
                        )}
                        <div className="text-gray-500 dark:text-gray-400">
                          Updated {formatRelativeTime(analysis.updated_at)}
                        </div>
                      </div>
                      
                      {Object.keys(categoryCounts).length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {Object.entries(categoryCounts).map(([category, count]) => {
                            const Icon = getCategoryIcon(category)
                            return (
                              <Badge key={category} variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                <Icon className="h-3 w-3 mr-1" />
                                {category}: {count}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <DropdownMenuItem asChild>
                          <Link href={`/analysis-frameworks/causeway/${analysis.id}`} className="text-gray-700 dark:text-gray-300">View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/analysis-frameworks/causeway/${analysis.id}/edit`} className="text-gray-700 dark:text-gray-300">Edit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600 dark:text-red-400"
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