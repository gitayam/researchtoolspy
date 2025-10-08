import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Grid3x3, List, TrendingUp, Star, GitFork, Eye, ThumbsUp } from 'lucide-react'
import { ForkDialog } from '@/components/library/ForkDialog'
import { RatingDialog } from '@/components/library/RatingDialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface LibraryFramework {
  id: string
  framework_id: string
  framework_type: string
  title: string
  description: string
  tags: string
  category: string
  published_by: string
  published_at: string
  view_count: number
  fork_count: number
  vote_score: number
  rating_avg: number
  rating_count: number
  user_vote?: string
  user_rating?: number
  user_subscribed?: number
}

export function PublicLibraryPage() {
  const { t } = useTranslation(['library', 'common'])
  const navigate = useNavigate()
  const [frameworks, setFrameworks] = useState<LibraryFramework[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [frameworkType, setFrameworkType] = useState('')
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState('popular')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 20
  const [forkDialogOpen, setForkDialogOpen] = useState(false)
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<LibraryFramework | null>(null)

  useEffect(() => {
    fetchFrameworks()
  }, [searchTerm, frameworkType, category, sortBy, offset])

  const fetchFrameworks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortBy,
      })

      if (searchTerm) params.append('search', searchTerm)
      if (frameworkType) params.append('type', frameworkType)
      if (category) params.append('category', category)

      const userHash = localStorage.getItem('omnicore_user_hash')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (userHash) {
        headers['X-User-Hash'] = userHash
      }

      const response = await fetch(`/api/library?${params}`, { headers })
      if (response.ok) {
        const data = await response.json()
        setFrameworks(data.frameworks || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('[Library] Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (libraryFrameworkId: string, voteType: 'up' | 'down') => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) {
      alert(t('common:errors.loginRequired'))
      return
    }

    try {
      const response = await fetch('/api/library/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({ library_framework_id: libraryFrameworkId, vote_type: voteType }),
      })

      if (response.ok) {
        await fetchFrameworks()
      }
    } catch (error) {
      console.error('[Library] Vote error:', error)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('library:title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('library:subtitle')}</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('library:search.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Framework Type */}
          <Select value={frameworkType || "all"} onValueChange={(v) => setFrameworkType(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('library:filters.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('library:filters.allTypes')}</SelectItem>
              <SelectItem value="cog">COG Analysis</SelectItem>
              <SelectItem value="ach">ACH Analysis</SelectItem>
              <SelectItem value="swot">SWOT Analysis</SelectItem>
              <SelectItem value="pest">PEST Analysis</SelectItem>
              <SelectItem value="pmesii-pt">PMESII-PT</SelectItem>
              <SelectItem value="dotmlpf">DOTMLPF</SelectItem>
            </SelectContent>
          </Select>

          {/* Category */}
          <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('library:filters.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('library:filters.allCategories')}</SelectItem>
              <SelectItem value="adversary_analysis">{t('library:categories.adversary_analysis')}</SelectItem>
              <SelectItem value="friendly_analysis">{t('library:categories.friendly_analysis')}</SelectItem>
              <SelectItem value="host_nation">{t('library:categories.host_nation')}</SelectItem>
              <SelectItem value="strategic_planning">{t('library:categories.strategic_planning')}</SelectItem>
              <SelectItem value="intelligence">{t('library:categories.intelligence')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">{t('library:filters.sort.popular')}</SelectItem>
              <SelectItem value="recent">{t('library:filters.sort.recent')}</SelectItem>
              <SelectItem value="trending">{t('library:filters.sort.trending')}</SelectItem>
              <SelectItem value="top_rated">{t('library:filters.sort.top_rated')}</SelectItem>
              <SelectItem value="most_forked">{t('library:filters.sort.most_forked')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
              <TabsList>
                <TabsTrigger value="grid">
                  <Grid3x3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Results Count */}
      {!loading && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {t('library:search.results', { count: total })}
        </div>
      )}

      {/* Framework Grid/List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      ) : frameworks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">{t('library:empty.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{t('library:empty.description')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {frameworks.map((framework) => (
            <Card key={framework.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{framework.title}</CardTitle>
                    <div className="flex gap-2 mb-2">
                      <Badge variant="outline">{framework.framework_type.toUpperCase()}</Badge>
                      {framework.category && (
                        <Badge variant="secondary">{t(`library:categories.${framework.category}`)}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <CardDescription className="line-clamp-3">{framework.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-gray-500" />
                    <span>{framework.vote_score}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span>
                      {framework.rating_count > 0
                        ? `${framework.rating_avg.toFixed(1)} (${framework.rating_count})`
                        : t('library:card.noRating')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GitFork className="h-4 w-4 text-gray-500" />
                    <span>{framework.fork_count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-500" />
                    <span>{framework.view_count}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={framework.user_vote === 'up' ? 'default' : 'outline'}
                      onClick={() => handleVote(framework.id, 'up')}
                      className="flex-1"
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {t('library:card.upvote')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedFramework(framework)
                        setRatingDialogOpen(true)
                      }}
                      className="flex-1"
                    >
                      <Star className="h-4 w-4 mr-1" />
                      {t('library:card.rate')}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedFramework(framework)
                        setForkDialogOpen(true)
                      }}
                      className="flex-1"
                    >
                      <GitFork className="h-4 w-4 mr-1" />
                      {t('library:card.fork')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/dashboard/frameworks/${framework.framework_type}/${framework.framework_id}`)}
                      className="flex-1"
                    >
                      {t('library:card.viewDetails')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            {t('common:pagination.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            {t('common:pagination.next')}
          </Button>
        </div>
      )}

      {/* Fork Dialog */}
      {selectedFramework && (
        <ForkDialog
          open={forkDialogOpen}
          onOpenChange={setForkDialogOpen}
          libraryFrameworkId={selectedFramework.id}
          frameworkTitle={selectedFramework.title}
          frameworkType={selectedFramework.framework_type}
        />
      )}

      {/* Rating Dialog */}
      {selectedFramework && (
        <RatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          libraryFrameworkId={selectedFramework.id}
          frameworkTitle={selectedFramework.title}
          currentRating={selectedFramework.user_rating || 0}
          onRatingSubmitted={fetchFrameworks}
        />
      )}
    </div>
  )
}
