'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Shield, 
  Plus, 
  Search, 
  Grid, 
  Calendar,
  Eye,
  MoreVertical,
  FileText,
  Building,
  GraduationCap,
  Package,
  UserCheck,
  Users,
  Home,
  Briefcase
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

interface DOTMLPFAnalysis {
  id: string
  title: string
  description?: string
  framework_type: 'dotmlpf'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    capabilities: Array<{
      domain: string
      capability: string
      currentState: string
      priority: string
    }>
    mission?: string
  }
  created_at: string
  updated_at: string
}

export default function DOTMLPFListPage() {
  const [analyses, setAnalyses] = useState<DOTMLPFAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<DOTMLPFAnalysis[]>('/frameworks/', {
          params: { framework_type: 'dotmlpf' }
        })
        setAnalyses(response)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load DOTMLPF-P analyses',
          variant: 'destructive'
        })
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
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case 'doctrine': return FileText
      case 'organization': return Building
      case 'training': return GraduationCap
      case 'materiel': return Package
      case 'leadership': return UserCheck
      case 'personnel': return Users
      case 'facilities': return Home
      case 'policy': return Briefcase
      default: return Shield
    }
  }

  const getDomainCounts = (capabilities: any[]) => {
    const counts: Record<string, number> = {}
    capabilities.forEach(cap => {
      counts[cap.domain] = (counts[cap.domain] || 0) + 1
    })
    return counts
  }

  const getCriticalCount = (capabilities: any[]) => {
    return capabilities.filter(c => c.priority === 'critical').length
  }

  const getInadequateCount = (capabilities: any[]) => {
    return capabilities.filter(c => c.currentState === 'inadequate').length
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">DOTMLPF-P Analysis</h1>
          <p className="text-gray-600 mt-2">Military capability assessment framework</p>
        </div>
        <Link href="/frameworks/dotmlpf/create">
          <Button className="bg-amber-600 hover:bg-amber-700">
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
            <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading analyses...</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <Card className="text-center py-12">
            <div className="mx-auto max-w-md">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm ? 'No analyses found' : 'No DOTMLPF-P Analyses Yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Get started by creating your first capability assessment'
                }
              </p>
              {!searchTerm && (
                <Link href="/frameworks/dotmlpf/create">
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
            const domainCounts = getDomainCounts(analysis.data.capabilities || [])
            const criticalCount = getCriticalCount(analysis.data.capabilities || [])
            const inadequateCount = getInadequateCount(analysis.data.capabilities || [])
            
            return (
              <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link href={`/frameworks/dotmlpf/${analysis.id}`}>
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
                      {analysis.data.mission && (
                        <p className="text-sm text-gray-500 mb-3 italic">
                          Mission: {analysis.data.mission}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Capabilities:</span>
                          <span className="ml-2 font-medium">{analysis.data.capabilities?.length || 0}</span>
                        </div>
                        {criticalCount > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Critical Gaps:</span>
                            <span className="ml-2 font-medium text-red-600">{criticalCount}</span>
                          </div>
                        )}
                        {inadequateCount > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Inadequate:</span>
                            <span className="ml-2 font-medium text-orange-600">{inadequateCount}</span>
                          </div>
                        )}
                        <div className="text-gray-500 dark:text-gray-400">
                          Updated {formatRelativeTime(analysis.updated_at)}
                        </div>
                      </div>
                      
                      {Object.keys(domainCounts).length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {Object.entries(domainCounts).map(([domain, count]) => {
                            const Icon = getDomainIcon(domain)
                            return (
                              <Badge key={domain} variant="outline" className="text-xs">
                                <Icon className="h-3 w-3 mr-1" />
                                {domain}: {count}
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
                          <Link href={`/frameworks/dotmlpf/${analysis.id}`}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/frameworks/dotmlpf/${analysis.id}/edit`}>Edit</Link>
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