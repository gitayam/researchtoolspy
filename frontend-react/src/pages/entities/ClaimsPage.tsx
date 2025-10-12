import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, FileText, AlertTriangle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Claim {
  id: string
  claim_text: string
  claim_category: string
  adjusted_claim_text?: string
  original_risk_score: number
  adjusted_risk_score: number
  verification_status: string
  user_comment?: string
  content_title?: string
  content_url?: string
  content_domain?: string
  adjusted_by_username?: string
  created_at: string
  updated_at: string
}

export function ClaimsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    if (!id) {
      loadClaims()
    }
  }, [filterStatus, filterCategory, id])

  const loadClaims = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(filterCategory !== 'all' && { category: filterCategory })
      })

      const response = await fetch(`/api/claims?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (response.ok) {
        setClaims(data.claims || [])
      }
    } catch (error) {
      console.error('Failed to load claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
    if (score <= 70) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20'
  }

  const getRiskIcon = (score: number) => {
    if (score <= 30) return <CheckCircle2 className="h-4 w-4" />
    if (score <= 70) return <AlertTriangle className="h-4 w-4" />
    return <XCircle className="h-4 w-4" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'debunked': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'investigating': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'statement': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'quote': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'statistic': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'event': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const filteredClaims = claims.filter(claim => {
    const searchLower = searchQuery.toLowerCase()
    const claimText = (claim.adjusted_claim_text || claim.claim_text).toLowerCase()
    const contentTitle = (claim.content_title || '').toLowerCase()
    return claimText.includes(searchLower) || contentTitle.includes(searchLower)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading claims...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claims</h1>
          <p className="text-muted-foreground mt-1">
            Track and verify factual claims from analyzed content
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search claims..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="debunked">Debunked</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="statement">Statement</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
            <SelectItem value="statistic">Statistic</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="relationship">Relationship</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Claims</CardDescription>
            <CardTitle className="text-2xl">{claims.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Verified</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {claims.filter(c => c.verification_status === 'verified').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Debunked</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {claims.filter(c => c.verification_status === 'debunked').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Investigating</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {claims.filter(c => c.verification_status === 'investigating').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {filteredClaims.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'No claims match your filters'
                  : 'No saved claims yet. Analyze content with claim detection to see claims here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredClaims.map((claim) => (
            <Card key={claim.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getCategoryColor(claim.claim_category)}>
                        {claim.claim_category}
                      </Badge>
                      <Badge className={getStatusColor(claim.verification_status)}>
                        {claim.verification_status}
                      </Badge>
                      {claim.adjusted_claim_text && (
                        <Badge variant="outline">Edited</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg leading-relaxed">
                      {claim.adjusted_claim_text || claim.claim_text}
                    </CardTitle>
                    {claim.content_title && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>From:</span>
                        <a
                          href={claim.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          {claim.content_title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="text-center min-w-[100px]">
                    <div className={`text-3xl font-bold flex items-center justify-center gap-2 ${getRiskColor(claim.adjusted_risk_score).split(' ')[0]}`}>
                      {getRiskIcon(claim.adjusted_risk_score)}
                      {claim.adjusted_risk_score}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Risk Score</div>
                    {claim.adjusted_risk_score !== claim.original_risk_score && (
                      <div className="text-xs text-muted-foreground line-through">
                        {claim.original_risk_score}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              {claim.user_comment && (
                <CardContent>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Assessment:</p>
                    <p className="text-sm">{claim.user_comment}</p>
                  </div>
                </CardContent>
              )}
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Updated {new Date(claim.updated_at).toLocaleDateString()}</span>
                  {claim.adjusted_by_username && (
                    <span>By {claim.adjusted_by_username}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
