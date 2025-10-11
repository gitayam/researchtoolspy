/**
 * Investigation Detail Page
 * View and manage an investigation packet with all linked content and claims
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Folder,
  FileText,
  Link as LinkIcon,
  Users,
  Database,
  Plus,
  ExternalLink,
  Loader2,
  ArrowLeft,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Brain,
  ChevronDown
} from 'lucide-react'

interface InvestigationPacket {
  id: string
  title: string
  description?: string
  investigation_type?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'completed' | 'archived'
  category?: string
  tags: string[]
  created_at: string
  updated_at: string
}

interface ContentAnalysis {
  link_id: string
  content_analysis_id: number
  url: string
  title?: string
  publication_date?: string
  added_at: string
  notes?: string
  claims: Claim[]
  claim_count: number
}

interface Claim {
  adjustment_id: string
  claim_index: number
  claim_text: string
  claim_category?: string
  original_risk_score: number
  adjusted_risk_score?: number
  user_comment?: string
  verification_status: string
  evidence_count: number
  entity_count: number
}

interface Statistics {
  total_content: number
  total_claims: number
  total_evidence: number
  total_entities: number
}

export function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [packet, setPacket] = useState<InvestigationPacket | null>(null)
  const [content, setContent] = useState<ContentAnalysis[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add content state
  const [isAddContentOpen, setIsAddContentOpen] = useState(false)
  const [newContentUrl, setNewContentUrl] = useState('')
  const [analyzingUrl, setAnalyzingUrl] = useState(false)

  useEffect(() => {
    if (id) {
      loadInvestigation()
    }
  }, [id])

  const loadInvestigation = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/investigation-packets/${id}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load investigation')
      }

      const data = await response.json()
      if (data.success) {
        setPacket(data.packet)
        setContent(data.content || [])
        setStatistics(data.statistics)
      }
    } catch (error) {
      console.error('Error loading investigation:', error)
      setError(error instanceof Error ? error.message : 'Failed to load investigation')
    } finally {
      setLoading(false)
    }
  }

  const analyzeAndAddUrl = async () => {
    if (!newContentUrl.trim()) {
      alert('Please enter a URL')
      return
    }

    try {
      setAnalyzingUrl(true)

      // First, analyze the URL
      const analyzeResponse = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: newContentUrl.trim(),
          options: {
            extract_claims: true,
            analyze_deception: true
          }
        })
      })

      if (!analyzeResponse.ok) {
        const data = await analyzeResponse.json()
        throw new Error(data.error || 'Failed to analyze URL')
      }

      const analyzeData = await analyzeResponse.json()
      if (!analyzeData.success || !analyzeData.content_analysis_id) {
        throw new Error('Analysis did not return content ID')
      }

      // Then add to investigation packet
      const addResponse = await fetch(`/api/investigation-packets/add-content/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content_analysis_id: analyzeData.content_analysis_id
        })
      })

      if (!addResponse.ok) {
        const data = await addResponse.json()
        throw new Error(data.error || 'Failed to add content to investigation')
      }

      // Reload investigation
      await loadInvestigation()

      // Close dialog and reset
      setIsAddContentOpen(false)
      setNewContentUrl('')
    } catch (error) {
      console.error('Error analyzing and adding URL:', error)
      alert(error instanceof Error ? error.message : 'Failed to add URL to investigation')
    } finally {
      setAnalyzingUrl(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'archived': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 75) return 'text-red-600 dark:text-red-400'
    if (score >= 50) return 'text-orange-600 dark:text-orange-400'
    if (score >= 25) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  const generateFramework = (frameworkType: 'cog' | 'swot') => {
    // Navigate to framework creation page with investigation context
    const state = {
      fromInvestigation: true,
      investigationId: id,
      investigationTitle: packet?.title,
      investigationData: {
        content,
        statistics,
        description: packet?.description
      }
    }

    if (frameworkType === 'cog') {
      navigate('/dashboard/analysis-frameworks/cog/create', { state })
    } else if (frameworkType === 'swot') {
      navigate('/dashboard/analysis-frameworks/swot-dashboard/create', { state })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !packet) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Investigation not found'}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/investigations')} className="mt-4" variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Investigations
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/investigations')} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Folder className="h-6 w-6" />
            <h1 className="text-3xl font-bold">{packet.title}</h1>
          </div>
          {packet.description && (
            <p className="text-muted-foreground mt-2">{packet.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge className={getPriorityColor(packet.priority)}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {packet.priority.toUpperCase()}
          </Badge>
          <Badge className={getStatusColor(packet.status)}>
            {packet.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        {packet.investigation_type && (
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {packet.investigation_type}
          </span>
        )}
        {packet.category && (
          <span className="flex items-center gap-1">
            <Folder className="h-4 w-4" />
            {packet.category}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Created {new Date(packet.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Tags */}
      {packet.tags.length > 0 && (
        <div className="flex gap-2">
          {packet.tags.map((tag, idx) => (
            <Badge key={idx} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-3xl font-bold">{statistics.total_content}</div>
                <div className="text-sm text-muted-foreground">
                  {statistics.total_content === 1 ? 'Source' : 'Sources'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <LinkIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-3xl font-bold">{statistics.total_claims}</div>
                <div className="text-sm text-muted-foreground">
                  {statistics.total_claims === 1 ? 'Claim' : 'Claims'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Database className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-3xl font-bold">{statistics.total_evidence}</div>
                <div className="text-sm text-muted-foreground">
                  Evidence {statistics.total_evidence === 1 ? 'Link' : 'Links'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-3xl font-bold">{statistics.total_entities}</div>
                <div className="text-sm text-muted-foreground">
                  {statistics.total_entities === 1 ? 'Entity' : 'Entities'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generate Framework Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <Brain className="h-4 w-4" />
            Generate Framework from Investigation
            <ChevronDown className="h-4 w-4 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Choose Framework Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => generateFramework('cog')}>
            <Brain className="h-4 w-4 mr-2" />
            <div>
              <div className="font-medium">Center of Gravity (COG)</div>
              <div className="text-xs text-muted-foreground">
                Identify critical capabilities and vulnerabilities
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => generateFramework('swot')}>
            <TrendingUp className="h-4 w-4 mr-2" />
            <div>
              <div className="font-medium">SWOT Analysis</div>
              <div className="text-xs text-muted-foreground">
                Analyze strengths, weaknesses, opportunities, threats
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Content Button */}
      <Dialog open={isAddContentOpen} onOpenChange={setIsAddContentOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add URL to Investigation
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add URL to Investigation</DialogTitle>
            <DialogDescription>
              Analyze a new URL and add it to this investigation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL</label>
              <Input
                value={newContentUrl}
                onChange={(e) => setNewContentUrl(e.target.value)}
                placeholder="https://example.com/article"
                disabled={analyzingUrl}
              />
            </div>
            <Button onClick={analyzeAndAddUrl} disabled={analyzingUrl} className="w-full">
              {analyzingUrl ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Analyze & Add to Investigation
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Sources in Investigation</h2>

        {content.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sources added yet. Add a URL to get started.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          content.map((item) => (
            <Card key={item.link_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {item.title || 'Untitled'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        {item.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/content-intelligence?analysis_id=${item.content_analysis_id}`)}
                  >
                    View Analysis
                  </Button>
                </div>

                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <span>{item.claim_count} {item.claim_count === 1 ? 'claim' : 'claims'}</span>
                  <span>Added {new Date(item.added_at).toLocaleDateString()}</span>
                </div>
              </CardHeader>

              {/* Claims from this source */}
              {item.claims.length > 0 && (
                <CardContent>
                  <div className="space-y-3">
                    {item.claims.map((claim) => {
                      const effectiveScore = claim.adjusted_risk_score ?? claim.original_risk_score
                      return (
                        <div
                          key={claim.adjustment_id}
                          className="p-3 bg-muted rounded-lg space-y-2"
                        >
                          <p className="text-sm">{claim.claim_text}</p>
                          <div className="flex items-center gap-4 text-xs">
                            <span className={`font-semibold ${getRiskColor(effectiveScore)}`}>
                              Risk: {effectiveScore}
                            </span>
                            {claim.claim_category && (
                              <Badge variant="outline" className="text-xs">
                                {claim.claim_category}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {claim.evidence_count} evidence
                            </span>
                            <span className="text-muted-foreground">
                              {claim.entity_count} entities
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
