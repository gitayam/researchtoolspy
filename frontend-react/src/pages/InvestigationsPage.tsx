import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Folder, FileText, Zap, Archive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Investigation {
  id: string
  title: string
  description: string
  type: 'structured_research' | 'general_topic' | 'rapid_analysis'
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  created_by_username: string
  research_question_topic?: string
  research_question_text?: string
  evidence_count: number
  actor_count: number
  source_count: number
  framework_count: number
  tags: string[]
}

export default function InvestigationsPage() {
  const navigate = useNavigate()
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'archived'>('active')

  useEffect(() => {
    loadInvestigations()
  }, [statusFilter])

  const loadInvestigations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch(`/api/investigations?status=${statusFilter}`, {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (response.ok) {
        const data = await response.json()
        setInvestigations(data.investigations || [])
      } else if (response.status === 401) {
        setError('Authentication required. Please log in to view your investigations.')
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to load investigations')
      }
    } catch (error) {
      console.error('Error loading investigations:', error)
      setError('Network error: Unable to load investigations. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredInvestigations = investigations.filter(inv =>
    inv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'structured_research': return <FileText className="h-4 w-4" />
      case 'rapid_analysis': return <Zap className="h-4 w-4" />
      default: return <Folder className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'structured_research': return 'Structured Research'
      case 'rapid_analysis': return 'Rapid Analysis'
      default: return 'General Topic'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Investigations</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            Organize your research with investigation-centric workflows
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/investigations/new')} className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Investigation
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search investigations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs by Status */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          {error ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-red-500 mb-4">⚠️</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Error Loading Investigations
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {error}
                  </p>
                  <Button onClick={() => loadInvestigations()} variant="outline">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : filteredInvestigations.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No investigations found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {searchTerm ? 'Try adjusting your search' : 'Create your first investigation to get started'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => navigate('/dashboard/investigations/new')} className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Investigation
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredInvestigations.map((inv) => (
                <Card
                  key={inv.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/dashboard/investigations/${inv.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeIcon(inv.type)}
                          <Badge variant="outline" className="text-xs">
                            {getTypeLabel(inv.type)}
                          </Badge>
                          <Badge className={getStatusColor(inv.status)}>
                            {inv.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl mb-2">{inv.title}</CardTitle>
                        {inv.description && (
                          <CardDescription className="line-clamp-2">
                            {inv.description}
                          </CardDescription>
                        )}
                        {inv.research_question_topic && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              Research Question
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="text-xl font-bold text-purple-600">{inv.evidence_count}</div>
                        <div className="text-xs text-gray-500">Evidence</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="text-xl font-bold text-blue-600">{inv.actor_count}</div>
                        <div className="text-xs text-gray-500">Actors</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="text-xl font-bold text-green-600">{inv.source_count}</div>
                        <div className="text-xs text-gray-500">Sources</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="text-xl font-bold text-orange-600">{inv.framework_count}</div>
                        <div className="text-xs text-gray-500">Analyses</div>
                      </div>
                    </div>

                    {/* Tags */}
                    {inv.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {inv.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {inv.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{inv.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-gray-500">
                      Updated {new Date(inv.updated_at).toLocaleDateString()} by {inv.created_by_username}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
