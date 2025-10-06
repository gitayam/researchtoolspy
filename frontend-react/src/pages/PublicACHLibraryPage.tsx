import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, Copy, ArrowRight, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ACHAnalysis, ACHDomain } from '@/types/ach'

const DOMAIN_LABELS: Record<ACHDomain, string> = {
  intelligence: 'Intelligence',
  security: 'Security',
  business: 'Business',
  research: 'Research',
  medical: 'Medical',
  legal: 'Legal',
  other: 'Other'
}

export function PublicACHLibraryPage() {
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<ACHAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState<ACHDomain | 'all'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent')

  useEffect(() => {
    loadPublicAnalyses()
  }, [domainFilter, sortBy])

  const loadPublicAnalyses = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (domainFilter !== 'all') params.append('domain', domainFilter)
      params.append('sort', sortBy)

      const response = await fetch(`/api/ach/public?${params}`)
      if (!response.ok) throw new Error('Failed to load analyses')

      const data = await response.json()
      setAnalyses(data.analyses || [])
    } catch (error) {
      console.error('Failed to load public analyses:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAnalyses = analyses.filter(analysis => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      analysis.title?.toLowerCase().includes(searchLower) ||
      analysis.question?.toLowerCase().includes(searchLower) ||
      analysis.description?.toLowerCase().includes(searchLower) ||
      analysis.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    )
  })

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Public ACH Analyses
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Explore shared intelligence analyses using the Analysis of Competing Hypotheses methodology
        </p>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search analyses, questions, or tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={domainFilter} onValueChange={(value) => setDomainFilter(value as ACHDomain | 'all')}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {Object.entries(DOMAIN_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'recent' | 'popular')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {loading ? 'Loading...' : `${filteredAnalyses.length} ${filteredAnalyses.length === 1 ? 'analysis' : 'analyses'} found`}
        </p>
      </div>

      {/* Analysis Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading public analyses...</p>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Analyses Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {search ? 'Try adjusting your search or filters' : 'No public ACH analyses have been shared yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAnalyses.map((analysis) => (
            <Card
              key={analysis.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/public/ach/${analysis.share_token}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-wrap gap-2">
                    {analysis.domain && (
                      <Badge variant="secondary" className="text-xs">
                        {DOMAIN_LABELS[analysis.domain]}
                      </Badge>
                    )}
                    {analysis.tags?.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {analysis.tags && analysis.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{analysis.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg line-clamp-2">{analysis.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  <strong>Question:</strong> {analysis.question}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysis.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {analysis.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{analysis.view_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Copy className="h-4 w-4" />
                      <span>{analysis.clone_count || 0}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <strong>{analysis.hypotheses?.length || 0}</strong> Hypotheses
                    </div>
                    <div>
                      <strong>{analysis.evidence?.length || 0}</strong> Evidence
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Banner */}
      <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            About ACH (Analysis of Competing Hypotheses)
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            ACH is a structured analytical technique that helps analysts identify and evaluate alternative explanations
            (hypotheses) by systematically comparing them against available evidence. It's particularly useful for complex
            intelligence problems where multiple explanations are possible and evidence is incomplete or ambiguous.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
