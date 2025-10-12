/**
 * Claim Analysis Display Component
 *
 * Displays extracted objective claims with multi-method deception detection analysis
 * Shows 6 detection methods: internal consistency, source credibility, evidence quality,
 * logical coherence, temporal consistency, and specificity
 *
 * Allows users to adjust risk scores and add comments for their own assessment
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  Clock,
  FileText,
  Quote,
  BarChart3,
  Calendar,
  Link as LinkIcon,
  Info,
  Edit,
  Save,
  X as XIcon,
  MessageSquare,
  Loader2,
  Download
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClaimEvidenceLinker } from './ClaimEvidenceLinker'
import { ClaimEntityLinker } from './ClaimEntityLinker'

interface ClaimAnalysisDisplayProps {
  contentAnalysisId: number
  claimAnalysis: {
    claims: Array<{
      claim: string
      category: string
      source?: string
      deception_analysis: {
        overall_risk: 'low' | 'medium' | 'high'
        risk_score: number
        methods: {
          internal_consistency: { score: number; reasoning: string }
          source_credibility: { score: number; reasoning: string }
          evidence_quality: { score: number; reasoning: string }
          logical_coherence: { score: number; reasoning: string }
          temporal_consistency: { score: number; reasoning: string }
          specificity: { score: number; reasoning: string }
        }
        red_flags: string[]
        confidence_assessment: string
      }
    }>
    summary: {
      total_claims: number
      high_risk_claims: number
      medium_risk_claims: number
      low_risk_claims: number
      most_concerning_claim?: string
      overall_content_credibility: number
    }
  }
}

interface ClaimAdjustment {
  id?: string // Claim adjustment ID from database
  adjustedRiskScore: number
  userComment: string
  adjustedClaimText?: string // User-edited claim wording
  adjustedMethods?: {
    internal_consistency: { score: number; reasoning: string }
    source_credibility: { score: number; reasoning: string }
    evidence_quality: { score: number; reasoning: string }
    logical_coherence: { score: number; reasoning: string }
    temporal_consistency: { score: number; reasoning: string }
    specificity: { score: number; reasoning: string }
  }
  adjustedAt: string
}

interface SavedAdjustment {
  id: string
  claim_index: number
  adjusted_risk_score: number
  user_comment: string
  created_at: string
  updated_at: string
}

export function ClaimAnalysisDisplay({ contentAnalysisId, claimAnalysis }: ClaimAnalysisDisplayProps) {
  if (!claimAnalysis || !claimAnalysis.claims || claimAnalysis.claims.length === 0) {
    return null
  }

  const { claims, summary } = claimAnalysis

  // State for claim adjustments
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adjustments, setAdjustments] = useState<Record<number, ClaimAdjustment>>({})
  const [tempRiskScore, setTempRiskScore] = useState<number>(50)
  const [tempComment, setTempComment] = useState<string>('')
  const [tempClaimText, setTempClaimText] = useState<string>('')
  const [tempMethods, setTempMethods] = useState<{
    internal_consistency: { score: number; reasoning: string }
    source_credibility: { score: number; reasoning: string }
    evidence_quality: { score: number; reasoning: string }
    logical_coherence: { score: number; reasoning: string }
    temporal_consistency: { score: number; reasoning: string }
    specificity: { score: number; reasoning: string }
  }>({
    internal_consistency: { score: 50, reasoning: '' },
    source_credibility: { score: 50, reasoning: '' },
    evidence_quality: { score: 50, reasoning: '' },
    logical_coherence: { score: 50, reasoning: '' },
    temporal_consistency: { score: 50, reasoning: '' },
    specificity: { score: 50, reasoning: '' }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load existing adjustments on mount
  useEffect(() => {
    const loadAdjustments = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const response = await fetch(`/api/claims/get-adjustments/${contentAnalysisId}`, {
          credentials: 'include'
        })

        if (!response.ok) {
          // Silently handle 404 - adjustments might not exist yet
          if (response.status === 404) {
            console.log('No saved adjustments found for this content')
            setIsLoading(false)
            return
          }
          throw new Error(`Failed to load adjustments: ${response.statusText}`)
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Non-JSON response received for claim adjustments')
          setIsLoading(false)
          return
        }

        const data = await response.json()

        if (data.success && data.adjustments) {
          // Convert saved adjustments to component state format
          const loadedAdjustments: Record<number, ClaimAdjustment> = {}
          data.adjustments.forEach((adj: SavedAdjustment) => {
            loadedAdjustments[adj.claim_index] = {
              id: adj.id, // Store the claim_adjustment_id
              adjustedRiskScore: adj.adjusted_risk_score,
              userComment: adj.user_comment || '',
              adjustedAt: adj.updated_at
            }
          })
          setAdjustments(loadedAdjustments)
        }
      } catch (error) {
        console.error('Error loading claim adjustments:', error)
        setLoadError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    loadAdjustments()
  }, [contentAnalysisId])

  // Handle edit mode
  const startEditing = (index: number, currentRiskScore: number) => {
    setEditingIndex(index)
    const claim = claims[index]
    const existing = adjustments[index]

    setTempRiskScore(existing?.adjustedRiskScore ?? currentRiskScore)
    setTempComment(existing?.userComment ?? '')
    setTempClaimText(claim.claim)
    setTempMethods({
      internal_consistency: {
        score: claim.deception_analysis.methods.internal_consistency.score ?? 50,
        reasoning: claim.deception_analysis.methods.internal_consistency.reasoning ?? ''
      },
      source_credibility: {
        score: claim.deception_analysis.methods.source_credibility.score ?? 50,
        reasoning: claim.deception_analysis.methods.source_credibility.reasoning ?? ''
      },
      evidence_quality: {
        score: claim.deception_analysis.methods.evidence_quality.score ?? 50,
        reasoning: claim.deception_analysis.methods.evidence_quality.reasoning ?? ''
      },
      logical_coherence: {
        score: claim.deception_analysis.methods.logical_coherence.score ?? 50,
        reasoning: claim.deception_analysis.methods.logical_coherence.reasoning ?? ''
      },
      temporal_consistency: {
        score: claim.deception_analysis.methods.temporal_consistency.score ?? 50,
        reasoning: claim.deception_analysis.methods.temporal_consistency.reasoning ?? ''
      },
      specificity: {
        score: claim.deception_analysis.methods.specificity.score ?? 50,
        reasoning: claim.deception_analysis.methods.specificity.reasoning ?? ''
      }
    })
  }

  const cancelEditing = () => {
    setEditingIndex(null)
    setTempRiskScore(50)
    setTempComment('')
    setTempClaimText('')
    setTempMethods({
      internal_consistency: { score: 50, reasoning: '' },
      source_credibility: { score: 50, reasoning: '' },
      evidence_quality: { score: 50, reasoning: '' },
      logical_coherence: { score: 50, reasoning: '' },
      temporal_consistency: { score: 50, reasoning: '' },
      specificity: { score: 50, reasoning: '' }
    })
  }

  const saveAdjustment = async (index: number) => {
    try {
      setIsSaving(true)

      const claim = claims[index]
      const payload = {
        content_analysis_id: contentAnalysisId,
        claim_index: index,
        claim_text: claim.claim,
        claim_category: claim.category,
        original_risk_score: claim.deception_analysis.risk_score,
        original_overall_risk: claim.deception_analysis.overall_risk,
        original_methods: claim.deception_analysis.methods,
        adjusted_risk_score: tempRiskScore,
        adjusted_claim_text: tempClaimText !== claim.claim ? tempClaimText : null, // Only send if changed
        adjusted_methods: tempMethods,
        user_comment: tempComment,
        verification_status: 'pending'
      }

      const response = await fetch('/api/claims/save-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Failed to save adjustment: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        // Update local state with ID from server
        setAdjustments({
          ...adjustments,
          [index]: {
            id: data.id, // Store the claim_adjustment_id
            adjustedRiskScore: tempRiskScore,
            userComment: tempComment,
            adjustedClaimText: tempClaimText,
            adjustedMethods: tempMethods,
            adjustedAt: new Date().toISOString()
          }
        })
        setEditingIndex(null)
        setTempRiskScore(50)
        setTempComment('')
        setTempClaimText('')
        setTempMethods({
          internal_consistency: { score: 50, reasoning: '' },
          source_credibility: { score: 50, reasoning: '' },
          evidence_quality: { score: 50, reasoning: '' },
          logical_coherence: { score: 50, reasoning: '' },
          temporal_consistency: { score: 50, reasoning: '' },
          specificity: { score: 50, reasoning: '' }
        })
      }
    } catch (error) {
      console.error('Error saving adjustment:', error)
      alert('Failed to save adjustment. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Get effective risk score (adjusted or original)
  const getEffectiveRiskScore = (index: number, originalScore: number) => {
    return adjustments[index]?.adjustedRiskScore ?? originalScore
  }

  // Get risk color
  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'medium': return 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'high': return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
    }
  }

  const getRiskIcon = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return <CheckCircle2 className="h-4 w-4" />
      case 'medium': return <AlertTriangle className="h-4 w-4" />
      case 'high': return <XCircle className="h-4 w-4" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'statement': return <FileText className="h-4 w-4" />
      case 'quote': return <Quote className="h-4 w-4" />
      case 'statistic': return <BarChart3 className="h-4 w-4" />
      case 'event': return <Calendar className="h-4 w-4" />
      case 'relationship': return <LinkIcon className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'statement': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'quote': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      case 'statistic': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'event': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
      case 'relationship': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  // Export to Markdown
  const exportToMarkdown = async (claimAdjustmentId: string) => {
    try {
      const response = await fetch(`/api/claims/export-markdown/${claimAdjustmentId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to export claim')
      }

      // Trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `claim-${claimAdjustmentId.substring(0, 8)}-${Date.now()}.md`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting claim:', error)
      alert('Failed to export claim to Markdown')
    }
  }

  return (
    <div className="space-y-6">
      {/* Loading/Error State for Adjustments */}
      {isLoading && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Loading saved adjustments...</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load saved adjustments: {loadError}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Claim Analysis Summary
              </CardTitle>
              <CardDescription>
                {summary.total_claims} objective claims extracted and analyzed
              </CardDescription>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">
                {summary.overall_content_credibility}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Overall Credibility
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Low Risk */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {summary.low_risk_claims}
                </div>
                <div className="text-sm text-green-600 dark:text-green-500">Low Risk Claims</div>
              </div>
            </div>

            {/* Medium Risk */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
              <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              <div>
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {summary.medium_risk_claims}
                </div>
                <div className="text-sm text-yellow-600 dark:text-yellow-500">Medium Risk Claims</div>
              </div>
            </div>

            {/* High Risk */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              <div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {summary.high_risk_claims}
                </div>
                <div className="text-sm text-red-600 dark:text-red-500">High Risk Claims</div>
              </div>
            </div>
          </div>

          {/* Most Concerning Claim */}
          {summary.most_concerning_claim && summary.high_risk_claims > 0 && (
            <Alert className="mt-4 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <strong>Most Concerning Claim:</strong> {summary.most_concerning_claim}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Individual Claims */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Extracted Claims ({claims.length})</h3>

        {claims.map((claimData, index) => {
          const effectiveRiskScore = getEffectiveRiskScore(index, claimData.deception_analysis.risk_score)
          const hasAdjustment = adjustments[index] !== undefined
          const isEditing = editingIndex === index

          return (
          <Card key={index} className="border-l-4" style={{
            borderLeftColor: claimData.deception_analysis.overall_risk === 'low' ? '#10b981' :
                            claimData.deception_analysis.overall_risk === 'medium' ? '#f59e0b' : '#ef4444'
          }}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className={getCategoryColor(claimData.category)}>
                      {getCategoryIcon(claimData.category)}
                      <span className="ml-1">{claimData.category.toUpperCase()}</span>
                    </Badge>
                    <Badge className={getRiskColor(claimData.deception_analysis.overall_risk)}>
                      {getRiskIcon(claimData.deception_analysis.overall_risk)}
                      <span className="ml-1">{claimData.deception_analysis.overall_risk.toUpperCase()} RISK</span>
                    </Badge>
                    {hasAdjustment && (
                      <Badge variant="default" className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        <Edit className="h-3 w-3 mr-1" />
                        User Adjusted
                      </Badge>
                    )}
                    {claimData.source && (
                      <Badge variant="outline">
                        Source: {claimData.source}
                      </Badge>
                    )}
                  </div>
                  <p className="text-base font-medium leading-relaxed">
                    {claimData.claim}
                  </p>
                </div>
                <div className="text-center min-w-[80px]">
                  <div className={`text-3xl font-bold ${getScoreColor(100 - effectiveRiskScore)}`}>
                    {effectiveRiskScore}
                    {hasAdjustment && effectiveRiskScore !== claimData.deception_analysis.risk_score && (
                      <span className="text-xs block text-gray-500 line-through">
                        {claimData.deception_analysis.risk_score}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Risk Score</div>
                  {!isEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 text-xs"
                      onClick={() => startEditing(index, effectiveRiskScore)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {hasAdjustment ? 'Edit' : 'Adjust'}
                    </Button>
                  )}
                </div>
              </div>

              {/* User Adjustment UI */}
              {isEditing && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg space-y-4">
                  <Tabs defaultValue="overall" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overall">Overall</TabsTrigger>
                      <TabsTrigger value="claim">Claim Text</TabsTrigger>
                      <TabsTrigger value="methods">Method Scores</TabsTrigger>
                    </TabsList>

                    {/* Overall Tab - Risk Score & Comments */}
                    <TabsContent value="overall" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Adjust Risk Score: {tempRiskScore}
                        </label>
                        <Slider
                          value={[tempRiskScore]}
                          onValueChange={(value) => setTempRiskScore(value[0])}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>Low Risk (0)</span>
                          <span>Medium Risk (50)</span>
                          <span>High Risk (100)</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Your Assessment Comments
                        </label>
                        <Textarea
                          value={tempComment}
                          onChange={(e) => setTempComment(e.target.value)}
                          placeholder="Explain your assessment... (optional)"
                          rows={3}
                          className="w-full"
                        />
                      </div>
                    </TabsContent>

                    {/* Claim Text Tab */}
                    <TabsContent value="claim" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          Edit Claim Wording
                        </label>
                        <Textarea
                          value={tempClaimText}
                          onChange={(e) => setTempClaimText(e.target.value)}
                          placeholder="Edit the claim text..."
                          rows={4}
                          className="w-full font-medium"
                        />
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Refine the claim wording to be more precise or correct any errors.
                        </p>
                      </div>
                    </TabsContent>

                    {/* Method Scores Tab */}
                    <TabsContent value="methods" className="space-y-6 mt-4 max-h-96 overflow-y-auto">
                      {/* Internal Consistency */}
                      <div className="space-y-2 pb-4 border-b">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Internal Consistency
                          </label>
                          <span className="text-sm font-bold">{tempMethods.internal_consistency.score}</span>
                        </div>
                        <Slider
                          value={[tempMethods.internal_consistency.score]}
                          onValueChange={(value) => setTempMethods({
                            ...tempMethods,
                            internal_consistency: { ...tempMethods.internal_consistency, score: value[0] }
                          })}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={tempMethods.internal_consistency.reasoning}
                          onChange={(e) => setTempMethods({
                            ...tempMethods,
                            internal_consistency: { ...tempMethods.internal_consistency, reasoning: e.target.value }
                          })}
                          placeholder="Reasoning..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>

                      {/* Source Credibility */}
                      <div className="space-y-2 pb-4 border-b">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Source Credibility
                          </label>
                          <span className="text-sm font-bold">{tempMethods.source_credibility.score}</span>
                        </div>
                        <Slider
                          value={[tempMethods.source_credibility.score]}
                          onValueChange={(value) => setTempMethods({
                            ...tempMethods,
                            source_credibility: { ...tempMethods.source_credibility, score: value[0] }
                          })}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={tempMethods.source_credibility.reasoning}
                          onChange={(e) => setTempMethods({
                            ...tempMethods,
                            source_credibility: { ...tempMethods.source_credibility, reasoning: e.target.value }
                          })}
                          placeholder="Reasoning..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>

                      {/* Evidence Quality */}
                      <div className="space-y-2 pb-4 border-b">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Evidence Quality
                          </label>
                          <span className="text-sm font-bold">{tempMethods.evidence_quality.score}</span>
                        </div>
                        <Slider
                          value={[tempMethods.evidence_quality.score]}
                          onValueChange={(value) => setTempMethods({
                            ...tempMethods,
                            evidence_quality: { ...tempMethods.evidence_quality, score: value[0] }
                          })}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={tempMethods.evidence_quality.reasoning}
                          onChange={(e) => setTempMethods({
                            ...tempMethods,
                            evidence_quality: { ...tempMethods.evidence_quality, reasoning: e.target.value }
                          })}
                          placeholder="Reasoning..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>

                      {/* Logical Coherence */}
                      <div className="space-y-2 pb-4 border-b">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Logical Coherence
                          </label>
                          <span className="text-sm font-bold">{tempMethods.logical_coherence.score}</span>
                        </div>
                        <Slider
                          value={[tempMethods.logical_coherence.score]}
                          onValueChange={(value) => setTempMethods({
                            ...tempMethods,
                            logical_coherence: { ...tempMethods.logical_coherence, score: value[0] }
                          })}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={tempMethods.logical_coherence.reasoning}
                          onChange={(e) => setTempMethods({
                            ...tempMethods,
                            logical_coherence: { ...tempMethods.logical_coherence, reasoning: e.target.value }
                          })}
                          placeholder="Reasoning..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>

                      {/* Temporal Consistency */}
                      <div className="space-y-2 pb-4 border-b">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Temporal Consistency
                          </label>
                          <span className="text-sm font-bold">{tempMethods.temporal_consistency.score}</span>
                        </div>
                        <Slider
                          value={[tempMethods.temporal_consistency.score]}
                          onValueChange={(value) => setTempMethods({
                            ...tempMethods,
                            temporal_consistency: { ...tempMethods.temporal_consistency, score: value[0] }
                          })}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={tempMethods.temporal_consistency.reasoning}
                          onChange={(e) => setTempMethods({
                            ...tempMethods,
                            temporal_consistency: { ...tempMethods.temporal_consistency, reasoning: e.target.value }
                          })}
                          placeholder="Reasoning..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>

                      {/* Specificity */}
                      <div className="space-y-2 pb-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Specificity
                          </label>
                          <span className="text-sm font-bold">{tempMethods.specificity.score}</span>
                        </div>
                        <Slider
                          value={[tempMethods.specificity.score]}
                          onValueChange={(value) => setTempMethods({
                            ...tempMethods,
                            specificity: { ...tempMethods.specificity, score: value[0] }
                          })}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <Textarea
                          value={tempMethods.specificity.reasoning}
                          onChange={(e) => setTempMethods({
                            ...tempMethods,
                            specificity: { ...tempMethods.specificity, reasoning: e.target.value }
                          })}
                          placeholder="Reasoning..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => saveAdjustment(index)}
                      className="flex-1"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save All Changes
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      <XIcon className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Show saved comment */}
              {!isEditing && hasAdjustment && adjustments[index].userComment && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                        Your Assessment:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {adjustments[index].userComment}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Adjusted {new Date(adjustments[index].adjustedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence & Entity Linking - Only available after claim is saved */}
              {hasAdjustment && adjustments[index].id && (
                <div className="mt-4 flex gap-2">
                  <ClaimEvidenceLinker
                    claimAdjustmentId={adjustments[index].id!}
                  />
                  <ClaimEntityLinker
                    claimAdjustmentId={adjustments[index].id!}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => exportToMarkdown(adjustments[index].id!)}
                  >
                    <Download className="h-4 w-4" />
                    Export to Markdown
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="methods" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="methods">Detection Methods</TabsTrigger>
                  <TabsTrigger value="assessment">Assessment</TabsTrigger>
                </TabsList>

                <TabsContent value="methods" className="space-y-3 mt-4">
                  {/* Internal Consistency */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Internal Consistency
                      </span>
                      <span className={`font-bold ${getScoreColor(claimData.deception_analysis.methods.internal_consistency.score)}`}>
                        {claimData.deception_analysis.methods.internal_consistency.score}
                      </span>
                    </div>
                    <Progress value={claimData.deception_analysis.methods.internal_consistency.score} className="h-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {claimData.deception_analysis.methods.internal_consistency.reasoning}
                    </p>
                  </div>

                  {/* Source Credibility */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Source Credibility
                      </span>
                      <span className={`font-bold ${getScoreColor(claimData.deception_analysis.methods.source_credibility.score)}`}>
                        {claimData.deception_analysis.methods.source_credibility.score}
                      </span>
                    </div>
                    <Progress value={claimData.deception_analysis.methods.source_credibility.score} className="h-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {claimData.deception_analysis.methods.source_credibility.reasoning}
                    </p>
                  </div>

                  {/* Evidence Quality */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Evidence Quality
                      </span>
                      <span className={`font-bold ${getScoreColor(claimData.deception_analysis.methods.evidence_quality.score)}`}>
                        {claimData.deception_analysis.methods.evidence_quality.score}
                      </span>
                    </div>
                    <Progress value={claimData.deception_analysis.methods.evidence_quality.score} className="h-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {claimData.deception_analysis.methods.evidence_quality.reasoning}
                    </p>
                  </div>

                  {/* Logical Coherence */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Logical Coherence
                      </span>
                      <span className={`font-bold ${getScoreColor(claimData.deception_analysis.methods.logical_coherence.score)}`}>
                        {claimData.deception_analysis.methods.logical_coherence.score}
                      </span>
                    </div>
                    <Progress value={claimData.deception_analysis.methods.logical_coherence.score} className="h-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {claimData.deception_analysis.methods.logical_coherence.reasoning}
                    </p>
                  </div>

                  {/* Temporal Consistency */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Temporal Consistency
                      </span>
                      <span className={`font-bold ${getScoreColor(claimData.deception_analysis.methods.temporal_consistency.score)}`}>
                        {claimData.deception_analysis.methods.temporal_consistency.score}
                      </span>
                    </div>
                    <Progress value={claimData.deception_analysis.methods.temporal_consistency.score} className="h-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {claimData.deception_analysis.methods.temporal_consistency.reasoning}
                    </p>
                  </div>

                  {/* Specificity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Specificity
                      </span>
                      <span className={`font-bold ${getScoreColor(claimData.deception_analysis.methods.specificity.score)}`}>
                        {claimData.deception_analysis.methods.specificity.score}
                      </span>
                    </div>
                    <Progress value={claimData.deception_analysis.methods.specificity.score} className="h-2" />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {claimData.deception_analysis.methods.specificity.reasoning}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Confidence Assessment</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {claimData.deception_analysis.confidence_assessment}
                    </p>
                  </div>

                  {claimData.deception_analysis.red_flags.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        Red Flags ({claimData.deception_analysis.red_flags.length})
                      </h4>
                      <ul className="space-y-1">
                        {claimData.deception_analysis.red_flags.map((flag, idx) => (
                          <li key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          )
        })}
      </div>
    </div>
  )
}
