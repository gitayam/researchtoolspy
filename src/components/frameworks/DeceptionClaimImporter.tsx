/**
 * Deception Claim Importer
 * Import claims from Content Intelligence and map deception indicators to SATS framework
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileDown, Search, Loader2, Database, ExternalLink, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { DeceptionScores } from '@/lib/deception-scoring'

interface Claim {
  claim_text: string
  claim_category?: string
  deception_analysis?: {
    overall_risk: string
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
  source_url?: string
  content_analysis_id?: number
}

interface SearchResult {
  id: string
  title: string
  url?: string
  claim_count: number
  claims: Claim[]
}

interface DeceptionClaimImporterProps {
  onImport: (data: {
    scenario: string
    scores: Partial<DeceptionScores>
    claimReferences: string[]
    eveIndicators: string[]
    mosesIndicators: string[]
  }) => void
}

export function DeceptionClaimImporter({ onImport }: DeceptionClaimImporterProps) {
  const { t } = useTranslation('deception')
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedClaims, setSelectedClaims] = useState<Claim[]>([])

  const searchClaims = async () => {
    if (!searchQuery.trim()) return

    try {
      setSearching(true)
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '10'
      })

      const response = await fetch(`/api/content-intelligence/search?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search')

      const data = await response.json()
      if (data.success) {
        setResults(data.results || [])
      }
    } catch (error) {
      console.error('Error searching claims:', error)
    } finally {
      setSearching(false)
    }
  }

  const toggleClaim = (claim: Claim) => {
    setSelectedClaims(prev => {
      const exists = prev.find(c => c.claim_text === claim.claim_text)
      if (exists) {
        return prev.filter(c => c.claim_text !== claim.claim_text)
      } else {
        return [...prev, claim]
      }
    })
  }

  const mapClaimsToSATS = (): {
    scores: Partial<DeceptionScores>
    eveIndicators: string[]
    mosesIndicators: string[]
  } => {
    if (selectedClaims.length === 0) {
      return { scores: {}, eveIndicators: [], mosesIndicators: [] }
    }

    const eveIndicators: string[] = []
    const mosesIndicators: string[] = []

    // Aggregate scores across all selected claims
    let totalInternalConsistency = 0
    let totalSourceCredibility = 0
    let totalEvidenceQuality = 0
    let totalLogicalCoherence = 0
    let totalTemporalConsistency = 0
    let totalSpecificity = 0
    let count = 0

    selectedClaims.forEach(claim => {
      if (!claim.deception_analysis) return

      const methods = claim.deception_analysis.methods
      count++

      // Map to 0-5 scale (claim scores are 0-100)
      totalInternalConsistency += methods.internal_consistency.score / 20
      totalSourceCredibility += methods.source_credibility.score / 20
      totalEvidenceQuality += methods.evidence_quality.score / 20
      totalLogicalCoherence += methods.logical_coherence.score / 20
      totalTemporalConsistency += methods.temporal_consistency.score / 20
      totalSpecificity += methods.specificity.score / 20

      // Collect indicators
      claim.deception_analysis.red_flags.forEach(flag => {
        if (flag.toLowerCase().includes('source') || flag.toLowerCase().includes('credibility')) {
          mosesIndicators.push(flag)
        } else {
          eveIndicators.push(flag)
        }
      })
    })

    if (count === 0) {
      return { scores: {}, eveIndicators: [], mosesIndicators: [] }
    }

    // Calculate averages
    const avgInternalConsistency = totalInternalConsistency / count
    const avgSourceCredibility = totalSourceCredibility / count
    const avgEvidenceQuality = totalEvidenceQuality / count
    const avgLogicalCoherence = totalLogicalCoherence / count
    const avgTemporalConsistency = totalTemporalConsistency / count
    const avgSpecificity = totalSpecificity / count

    // Map to SATS categories
    const scores: Partial<DeceptionScores> = {
      // EVE (Evaluation of Evidence) - higher scores = better evidence quality
      // For EVE, we want: high consistency = low deception risk
      internalConsistency: Math.round(Math.max(avgInternalConsistency, avgLogicalCoherence, avgTemporalConsistency)),
      externalCorroboration: Math.round(avgEvidenceQuality),
      anomalyDetection: Math.round(5 - avgSpecificity), // Inverted: low specificity = high anomaly

      // MOSES (My Own Sources) - higher scores = more vulnerable
      sourceVulnerability: Math.round(5 - avgSourceCredibility), // Inverted: low credibility = high vulnerability
      manipulationEvidence: avgSourceCredibility < 2 ? 3 : avgSourceCredibility < 3 ? 2 : 1
    }

    return { scores, eveIndicators, mosesIndicators }
  }

  const handleImport = () => {
    const { scores, eveIndicators, mosesIndicators } = mapClaimsToSATS()

    // Build scenario description from selected claims
    const scenario = selectedClaims
      .map((c, idx) => `Claim ${idx + 1}: ${c.claim_text}`)
      .join('\n\n')

    // Build claim references
    const claimReferences = selectedClaims.map(c =>
      `${c.claim_text}${c.source_url ? ` (Source: ${c.source_url})` : ''}`
    )

    onImport({
      scenario,
      scores,
      claimReferences,
      eveIndicators: [...new Set(eveIndicators)],
      mosesIndicators: [...new Set(mosesIndicators)]
    })

    setIsOpen(false)
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          {t('claimImporter.buttonText')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('claimImporter.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('claimImporter.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>{t('claimImporter.autoMappingTitle')}</strong> {t('claimImporter.autoMappingDescription')}
          </AlertDescription>
        </Alert>

        {/* Search */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('claimImporter.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchClaims()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchClaims} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : t('claimImporter.search')}
            </Button>
          </div>

          {/* Selected Claims Summary */}
          {selectedClaims.length > 0 && (
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription>
                {t('claimImporter.claimsSelected', { count: selectedClaims.length })}
              </AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3 mt-4">
              <h5 className="text-sm font-medium">{t('claimImporter.results')} ({results.length})</h5>
              {results.map((result) => (
                <Card key={result.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h6 className="font-medium text-sm">{result.title}</h6>
                          {result.url && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              {t('claimImporter.viewSource')} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {result.claim_count} {result.claim_count === 1 ? t('claimImporter.claim') : t('claimImporter.claims')}
                        </Badge>
                      </div>

                      {/* Claims */}
                      {result.claims && result.claims.length > 0 && (
                        <div className="space-y-2">
                          {result.claims.map((claim, idx) => {
                            const isSelected = selectedClaims.some(c => c.claim_text === claim.claim_text)
                            const risk = claim.deception_analysis?.overall_risk || 'unknown'
                            const riskScore = claim.deception_analysis?.risk_score || 0

                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                                onClick={() => toggleClaim(claim)}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm">{claim.claim_text}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge className={`text-xs ${getRiskColor(risk)}`}>
                                        {risk.toUpperCase()} ({riskScore}%)
                                      </Badge>
                                      {claim.claim_category && (
                                        <Badge variant="outline" className="text-xs">
                                          {claim.claim_category}
                                        </Badge>
                                      )}
                                      {claim.deception_analysis?.red_flags && claim.deception_analysis.red_flags.length > 0 && (
                                        <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {claim.deception_analysis.red_flags.length} {t('claimImporter.redFlags')}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && results.length === 0 && searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t('claimImporter.noResults')}
            </div>
          )}
        </div>

        {/* Import Button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('claimImporter.cancel')}
          </Button>
          <Button onClick={handleImport} disabled={selectedClaims.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            {t('claimImporter.import')} {selectedClaims.length > 0 && `(${selectedClaims.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
