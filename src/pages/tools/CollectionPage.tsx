/**
 * Agentic Research Collection Page
 *
 * Comprehensive interface for automated source collection using
 * SearXNG search and AI-powered relevance scoring.
 *
 * Features:
 * - Multi-category search (news, academic, government, social, technical, archives)
 * - Time range filtering
 * - Real-time job status polling
 * - Triage interface with bulk selection
 * - Integration with batch analysis pipeline
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  Database,
  Zap,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  Save,
  Play,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  CollectionJob,
  CollectionJobRequest,
  CollectionJobResponse,
  CollectionResult,
  CollectionResultsResponse,
  CollectionCategory,
  TimeRange,
  ApproveResultsRequest,
  ApproveResultsResponse,
  CollectionResultsSummary,
} from '@/types/collection'
import { getCopHeaders } from '@/lib/cop-auth'

// ============================================
// Constants
// ============================================

const CATEGORIES: { value: CollectionCategory; label: string; description: string }[] = [
  { value: 'news', label: 'News', description: 'News articles and media' },
  { value: 'academic', label: 'Academic', description: 'Research papers and journals' },
  { value: 'government', label: 'Government', description: 'Government sources' },
  { value: 'social', label: 'Social', description: 'Social media and forums' },
  { value: 'technical', label: 'Technical', description: 'Technical docs and repos' },
  { value: 'archives', label: 'Archives', description: 'Historical archives' },
]

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Past 24 Hours' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: 'year', label: 'Past Year' },
  { value: 'all', label: 'All Time' },
]

const MAX_RESULTS_OPTIONS = [50, 100, 150, 200]

// ============================================
// Query Keys
// ============================================

const collectionKeys = {
  all: ['collection'] as const,
  status: (jobId: string) => [...collectionKeys.all, 'status', jobId] as const,
  results: (jobId: string, params?: Record<string, unknown>) =>
    [...collectionKeys.all, 'results', jobId, params] as const,
}

// ============================================
// API Functions
// ============================================

async function startCollection(request: CollectionJobRequest): Promise<CollectionJobResponse> {
  const response = await fetch('/api/collection/start', {
    method: 'POST',
    headers: getCopHeaders(),
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to start collection')
  }
  return response.json()
}

async function getJobStatus(jobId: string): Promise<CollectionJob & { resultsSummary?: CollectionResultsSummary[] }> {
  const response = await fetch(`/api/collection/${jobId}/status`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to get job status')
  }
  return response.json()
}

async function getJobResults(
  jobId: string,
  params: { limit?: number; offset?: number; category?: string; minRelevance?: number; approved?: string }
): Promise<CollectionResultsResponse & { pagination: { total: number; hasMore: boolean } }> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))
  if (params.category) searchParams.set('category', params.category)
  if (params.minRelevance) searchParams.set('minRelevance', String(params.minRelevance))
  if (params.approved) searchParams.set('approved', params.approved)

  const response = await fetch(`/api/collection/${jobId}/results?${searchParams}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to get results')
  }
  return response.json()
}

async function approveResults(
  jobId: string,
  request: ApproveResultsRequest
): Promise<ApproveResultsResponse & { batchJobId?: string; urls?: number }> {
  const response = await fetch(`/api/collection/${jobId}/approve`, {
    method: 'POST',
    headers: getCopHeaders(),
    body: JSON.stringify(request),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to approve results')
  }
  return response.json()
}

// ============================================
// Helper Functions
// ============================================

function getStatusColor(status: CollectionJob['status']): string {
  switch (status) {
    case 'running':
      return 'bg-blue-500'
    case 'complete':
      return 'bg-green-500'
    case 'error':
      return 'bg-red-500'
    case 'pending':
    default:
      return 'bg-gray-500'
  }
}

function getRelevanceColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (score >= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  if (score >= 40) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

function getCategoryColor(category: CollectionCategory): string {
  const colors: Record<CollectionCategory, string> = {
    news: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    academic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    government: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    social: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    technical: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    archives: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  return colors[category] || 'bg-gray-100 text-gray-800'
}

function formatElapsedTime(startDate: string, endDate?: string): string {
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : Date.now()
  const elapsed = Math.floor((end - start) / 1000)

  if (elapsed < 60) return `${elapsed}s`
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`
}

// ============================================
// Main Component
// ============================================

export default function CollectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Search Form State
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<CollectionCategory[]>([
    'news',
    'academic',
    'government',
  ])
  const [timeRange, setTimeRange] = useState<TimeRange>('year')
  const [maxResults, setMaxResults] = useState(100)
  const [useLocalLLM, setUseLocalLLM] = useState(false)

  // Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  // Triage State
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set())
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [filterCategory, setFilterCategory] = useState<CollectionCategory | 'all'>('all')
  const [minRelevanceFilter, setMinRelevanceFilter] = useState(0)

  // ============================================
  // Queries
  // ============================================

  // Poll job status when active
  const {
    data: jobStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: collectionKeys.status(activeJobId || ''),
    queryFn: () => getJobStatus(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const data = query.state.data
      // Poll every 2 seconds while running
      return data?.status === 'running' || data?.status === 'pending' ? 2000 : false
    },
  })

  // Get results when job is complete
  const {
    data: resultsData,
    isLoading: resultsLoading,
  } = useQuery({
    queryKey: collectionKeys.results(activeJobId || '', {
      category: filterCategory === 'all' ? undefined : filterCategory,
      minRelevance: minRelevanceFilter,
    }),
    queryFn: () =>
      getJobResults(activeJobId!, {
        limit: 200,
        category: filterCategory === 'all' ? undefined : filterCategory,
        minRelevance: minRelevanceFilter,
        approved: 'all',
      }),
    enabled: !!activeJobId && jobStatus?.status === 'complete',
  })

  // ============================================
  // Mutations
  // ============================================

  const startMutation = useMutation({
    mutationFn: startCollection,
    onSuccess: (data) => {
      setActiveJobId(data.jobId)
      setSelectedResults(new Set())
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ analyzeNow }: { analyzeNow: boolean }) =>
      approveResults(activeJobId!, {
        selectedIds: Array.from(selectedResults),
        analyzeNow,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.results(activeJobId!) })
      setSelectedResults(new Set())
      if (data.batchJobId) {
        // Optionally navigate to batch processing page
        // navigate(`/dashboard/tools/batch-processing?job=${data.batchJobId}`)
      }
    },
  })

  // ============================================
  // Handlers
  // ============================================

  const handleStartCollection = () => {
    if (!query.trim() || query.trim().length < 3) return

    startMutation.mutate({
      query: query.trim(),
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      timeRange,
      maxResults,
      useLocalLLM,
    })
  }

  const toggleCategory = (category: CollectionCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const toggleResultSelection = (resultId: string) => {
    setSelectedResults((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(resultId)) {
        newSet.delete(resultId)
      } else {
        newSet.add(resultId)
      }
      return newSet
    })
  }

  const toggleResultExpansion = (resultId: string) => {
    setExpandedResults((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(resultId)) {
        newSet.delete(resultId)
      } else {
        newSet.add(resultId)
      }
      return newSet
    })
  }

  const selectHighRelevance = () => {
    if (!resultsData?.results) return
    const highRelevanceIds = resultsData.results
      .filter((r) => r.relevance_score >= 70 && r.approved === 0)
      .map((r) => r.id)
    setSelectedResults(new Set(highRelevanceIds))
  }

  const clearSelection = () => {
    setSelectedResults(new Set())
  }

  const selectAll = () => {
    if (!resultsData?.results) return
    const allIds = resultsData.results.filter((r) => r.approved === 0).map((r) => r.id)
    setSelectedResults(new Set(allIds))
  }

  const resetForm = () => {
    setActiveJobId(null)
    setQuery('')
    setSelectedCategories(['news', 'academic', 'government'])
    setSelectedResults(new Set())
    setExpandedResults(new Set())
    setFilterCategory('all')
    setMinRelevanceFilter(0)
  }

  // ============================================
  // Computed Values
  // ============================================

  const isJobActive = activeJobId && (jobStatus?.status === 'running' || jobStatus?.status === 'pending')
  const isJobComplete = activeJobId && jobStatus?.status === 'complete'
  const isJobError = activeJobId && jobStatus?.status === 'error'

  const pendingResults = useMemo(() => {
    return resultsData?.results?.filter((r) => r.approved === 0) || []
  }, [resultsData])

  const approvedResults = useMemo(() => {
    return resultsData?.results?.filter((r) => r.approved === 1) || []
  }, [resultsData])

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/tools')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tools
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agentic Research</h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered source collection with intelligent relevance scoring
          </p>
        </div>
        {activeJobId && (
          <Button variant="outline" onClick={resetForm}>
            <RefreshCw className="h-4 w-4 mr-2" />
            New Search
          </Button>
        )}
      </div>

      {/* Search Form Card */}
      {!activeJobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Research Query
            </CardTitle>
            <CardDescription>
              Enter your research topic to collect and analyze relevant sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Query Input */}
            <div className="space-y-2">
              <Label htmlFor="query">Research Query</Label>
              <Input
                id="query"
                placeholder="e.g., climate change impact on agriculture in Southeast Asia"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-lg"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Be specific - the AI will expand this into targeted searches across multiple categories
              </p>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Source Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <TooltipProvider key={cat.value}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={selectedCategories.includes(cat.value) ? 'default' : 'outline'}
                          className="cursor-pointer select-none transition-all"
                          onClick={() => toggleCategory(cat.value)}
                        >
                          {cat.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{cat.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCategories.length === 0
                  ? 'All categories will be searched'
                  : `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected`}
              </p>
            </div>

            {/* Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Time Range */}
              <div className="space-y-2">
                <Label htmlFor="time-range">Time Range</Label>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                  <SelectTrigger id="time-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map((tr) => (
                      <SelectItem key={tr.value} value={tr.value}>
                        {tr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Max Results */}
              <div className="space-y-2">
                <Label htmlFor="max-results">Max Results</Label>
                <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
                  <SelectTrigger id="max-results">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAX_RESULTS_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} results
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Local LLM Toggle */}
              <div className="space-y-2">
                <Label htmlFor="local-llm">LLM Provider</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch
                    id="local-llm"
                    checked={useLocalLLM}
                    onCheckedChange={setUseLocalLLM}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {useLocalLLM ? 'Local LLM (Ollama)' : 'OpenAI GPT'}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleStartCollection}
              disabled={!query.trim() || query.trim().length < 3 || startMutation.isPending}
              className="w-full"
              size="lg"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Starting Collection...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Collection
                </>
              )}
            </Button>

            {startMutation.isError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{startMutation.error.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job Status Card */}
      {activeJobId && jobStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Collection Job
              </div>
              <Badge className={getStatusColor(jobStatus.status)}>
                {jobStatus.status === 'running' && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {jobStatus.status === 'complete' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {jobStatus.status === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
              </Badge>
            </CardTitle>
            <CardDescription>Query: {jobStatus.query}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {jobStatus.results_count}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Results Found</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {jobStatus.llm_used === 'local' ? 'Ollama' : 'OpenAI'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">LLM Used</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatElapsedTime(jobStatus.created_at, jobStatus.completed_at)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Elapsed Time</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {jobStatus.categories?.length || 0}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
              </div>
            </div>

            {/* Progress Bar for Running Jobs */}
            {isJobActive && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Collecting sources...</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {jobStatus.results_count} found so far
                  </span>
                </div>
                <Progress value={undefined} className="h-2 animate-pulse" />
              </div>
            )}

            {/* Error Message */}
            {isJobError && jobStatus.error_message && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{jobStatus.error_message}</span>
              </div>
            )}

            {/* Results Summary by Category */}
            {isJobComplete && jobStatus.resultsSummary && jobStatus.resultsSummary.length > 0 && (
              <div className="space-y-2">
                <Label>Results by Category</Label>
                <div className="flex flex-wrap gap-2">
                  {jobStatus.resultsSummary.map((summary) => (
                    <Badge
                      key={summary.category}
                      variant="outline"
                      className={getCategoryColor(summary.category)}
                    >
                      {summary.category}: {summary.count} (avg {Math.round(summary.avg_relevance)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Triage Results Card */}
      {isJobComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Triage Results
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedResults.size} selected
                </Badge>
                <Badge variant="secondary">
                  {pendingResults.length} pending
                </Badge>
                {approvedResults.length > 0 && (
                  <Badge className="bg-green-500">
                    {approvedResults.length} approved
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Review and select relevant sources for analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters and Actions */}
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                {/* Category Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-4 w-4 text-gray-400 shrink-0" />
                  <Select
                    value={filterCategory}
                    onValueChange={(v) => setFilterCategory(v as CollectionCategory | 'all')}
                  >
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Min Relevance Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Label className="text-sm whitespace-nowrap">Min Relevance:</Label>
                  <Select
                    value={String(minRelevanceFilter)}
                    onValueChange={(v) => setMinRelevanceFilter(Number(v))}
                  >
                    <SelectTrigger className="w-full sm:w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="40">40%</SelectItem>
                      <SelectItem value="60">60%</SelectItem>
                      <SelectItem value="70">70%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selection Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectHighRelevance}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select &gt;70%
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <Square className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Results List */}
            {resultsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : resultsData?.results && resultsData.results.length > 0 ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {resultsData.results.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 border rounded-lg transition-all ${
                      result.approved === 1
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : result.approved === -1
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 opacity-50'
                        : selectedResults.has(result.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {result.approved === 0 && (
                        <Checkbox
                          checked={selectedResults.has(result.id)}
                          onCheckedChange={() => toggleResultSelection(result.id)}
                          className="mt-1"
                        />
                      )}
                      {result.approved === 1 && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      )}
                      {result.approved === -1 && (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 dark:text-white truncate">
                              {result.title || result.url}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                              <span>{result.source_domain}</span>
                              {result.published_date && (
                                <>
                                  <span>|</span>
                                  <span>{result.published_date}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={getRelevanceColor(result.relevance_score)}>
                              {result.relevance_score}%
                            </Badge>
                            <Badge variant="outline" className={getCategoryColor(result.category)}>
                              {result.category}
                            </Badge>
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>

                        {/* Snippet (expandable) */}
                        {result.snippet && (
                          <div className="mt-2">
                            <p
                              className={`text-sm text-gray-600 dark:text-gray-400 ${
                                expandedResults.has(result.id) ? '' : 'line-clamp-2'
                              }`}
                            >
                              {result.snippet}
                            </p>
                            {result.snippet.length > 150 && (
                              <button
                                onClick={() => toggleResultExpansion(result.id)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                              >
                                {expandedResults.has(result.id) ? (
                                  <span className="flex items-center gap-1">
                                    <ChevronUp className="h-3 w-3" /> Show less
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <ChevronDown className="h-3 w-3" /> Show more
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No results match your filters
              </div>
            )}

            {/* Action Buttons */}
            {selectedResults.size > 0 && (
              <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedResults.size} result{selectedResults.size !== 1 ? 's' : ''} selected
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => approveMutation.mutate({ analyzeNow: false })}
                    disabled={approveMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save to Library
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate({ analyzeNow: true })}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analyze Selected
                  </Button>
                </div>
              </div>
            )}

            {approveMutation.isError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{approveMutation.error.message}</span>
              </div>
            )}

            {approveMutation.isSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  {approveMutation.data.status === 'analysis_started'
                    ? `${approveMutation.data.approved} results approved and sent for analysis`
                    : `${approveMutation.data.approved} results saved to library`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
