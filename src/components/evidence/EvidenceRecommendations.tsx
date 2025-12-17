/**
 * Evidence Recommendations Component
 * Suggests relevant evidence when creating framework analyses
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EvidenceRecommendation {
  id: number
  title: string
  description: string
  who: string
  what: string
  when_occurred: string
  where_location: string
  evidence_type: string
  evidence_level: string
  credibility: string
  reliability: string
  priority: string
  tags: string[]
  relevance_score: number
  match_reasons: string[]
  entity_match_count: number
  keyword_match_count: number
}

interface RecommendationContext {
  title?: string
  description?: string
  entities?: string[]
  keywords?: string[]
  timeframe?: { start: string; end: string }
}

interface EvidenceRecommendationsProps {
  frameworkType: 'ach' | 'cog' | 'swot' | 'pest' | 'dime' | 'comb' | 'other'
  context: RecommendationContext
  onSelectEvidence: (evidence: EvidenceRecommendation) => void
  selectedEvidenceIds?: number[]
  className?: string
}

export function EvidenceRecommendations({
  frameworkType,
  context,
  onSelectEvidence,
  selectedEvidenceIds = [],
  className
}: EvidenceRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<EvidenceRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<any>(null)

  useEffect(() => {
    loadRecommendations()
  }, [frameworkType, JSON.stringify(context)])

  const loadRecommendations = async () => {
    setLoading(true)
    setError(null)

    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/evidence/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          framework_type: frameworkType,
          context,
          workspace_id: '1'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to load evidence recommendations')
      }

      const data = await response.json()
      setRecommendations(data.recommendations || [])
      setBreakdown(data.breakdown || {})
    } catch (error) {
      console.error('Error loading evidence recommendations:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getRelevanceBadgeColor = (score: number) => {
    if (score >= 70) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  const getCredibilityIcon = (credibility: string) => {
    const grade = credibility?.toUpperCase().charAt(0)
    if (['A', 'B'].includes(grade) || credibility === 'verified') {
      return <CheckCircle2 className="h-3 w-3 text-green-600" />
    }
    if (['C', 'D'].includes(grade)) {
      return <AlertCircle className="h-3 w-3 text-yellow-600" />
    }
    return null
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Loading Recommendations...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load recommendations: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (recommendations.length === 0) {
    return null // Don't show if no recommendations
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Suggested Evidence ({recommendations.length})
        </CardTitle>
        <CardDescription>
          Based on {context.entities?.length ? 'entities, ' : ''}
          {context.keywords?.length ? 'keywords, ' : ''}
          and similar analyses
        </CardDescription>
        {breakdown && (
          <div className="flex gap-3 text-sm text-muted-foreground mt-2">
            {breakdown.high_relevance > 0 && (
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {breakdown.high_relevance} high relevance
              </div>
            )}
            {breakdown.entity_matches > 0 && (
              <div>{breakdown.entity_matches} entity matches</div>
            )}
            {breakdown.keyword_matches > 0 && (
              <div>{breakdown.keyword_matches} keyword matches</div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map(evidence => {
          const isSelected = selectedEvidenceIds.includes(evidence.id)

          return (
            <div
              key={evidence.id}
              className={cn(
                'flex items-start justify-between p-4 border rounded-lg transition-all',
                isSelected && 'border-primary bg-primary/5',
                !isSelected && 'hover:border-primary/50 hover:shadow-sm'
              )}
            >
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm line-clamp-1">{evidence.title}</h4>
                    {evidence.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {evidence.description}
                      </p>
                    )}
                  </div>
                  <Badge className={cn('shrink-0', getRelevanceBadgeColor(evidence.relevance_score))}>
                    {evidence.relevance_score}%
                  </Badge>
                </div>

                {/* Evidence metadata */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {evidence.evidence_level && (
                    <Badge variant="outline" className="text-xs">
                      {evidence.evidence_level}
                    </Badge>
                  )}
                  {evidence.credibility && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      {getCredibilityIcon(evidence.credibility)}
                      {evidence.credibility}
                    </Badge>
                  )}
                  {evidence.priority && (
                    <Badge
                      variant={evidence.priority === 'critical' || evidence.priority === 'high' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {evidence.priority}
                    </Badge>
                  )}
                </div>

                {/* Match reasons */}
                {evidence.match_reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {evidence.match_reasons.slice(0, 3).map((reason, idx) => (
                      <span key={idx} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {reason}
                      </span>
                    ))}
                    {evidence.match_reasons.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{evidence.match_reasons.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant={isSelected ? 'secondary' : 'default'}
                onClick={() => onSelectEvidence(evidence)}
                disabled={isSelected}
                className="shrink-0"
              >
                {isSelected ? 'Added' : 'Add'}
              </Button>
            </div>
          )
        })}

        {recommendations.length >= 20 && (
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Showing top 20 recommendations. Refine your search for more specific results.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
