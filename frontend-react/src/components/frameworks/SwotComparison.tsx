import { useState, useEffect } from 'react'
import { Scale, TrendingUp, TrendingDown, AlertTriangle, Target, X, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: number
}

interface SwotAnalysis {
  id: string
  title: string
  description: string
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  created_at?: string
}

interface ComparisonScore {
  overall: number
  strengths: number
  weaknesses: number  // Lower is better for weaknesses
  opportunities: number
  threats: number  // Lower is better for threats
}

interface ComparisonRecommendation {
  winner: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
  keyFactors: string[]
  risks: string[]
}

interface SwotComparisonProps {
  currentSwot: SwotAnalysis
  open: boolean
  onClose: () => void
}

export function SwotComparison({ currentSwot, open, onClose }: SwotComparisonProps) {
  const [availableSwots, setAvailableSwots] = useState<SwotAnalysis[]>([])
  const [selectedSwot, setSelectedSwot] = useState<SwotAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [scores, setScores] = useState<{ current: ComparisonScore; selected: ComparisonScore } | null>(null)
  const [recommendation, setRecommendation] = useState<ComparisonRecommendation | null>(null)

  useEffect(() => {
    if (open) {
      loadAvailableSwots()
    }
  }, [open])

  useEffect(() => {
    if (selectedSwot) {
      calculateComparison()
    }
  }, [selectedSwot])

  const loadAvailableSwots = async () => {
    setLoading(true)
    try {
      // Load all SWOT analyses except the current one
      const response = await fetch('/api/frameworks?framework_type=swot')
      if (response.ok) {
        const data = await response.json()
        const swots = (data.frameworks || [])
          .filter((f: any) => f.id !== currentSwot.id)
          .map((f: any) => ({
            id: f.id,
            title: f.title,
            description: f.description,
            ...f.data,
            created_at: f.created_at
          }))
        setAvailableSwots(swots)
      }
    } catch (error) {
      console.error('Failed to load SWOT analyses:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateItemScore = (items: SwotItem[]): number => {
    if (items.length === 0) return 0

    // Calculate weighted score based on:
    // 1. Number of items (30%)
    // 2. Evidence backing (40%)
    // 3. Confidence levels (30%)

    const countScore = Math.min(items.length / 10, 1) * 30
    const evidenceScore = (items.filter(i => (i.evidence_ids?.length || 0) > 0).length / Math.max(items.length, 1)) * 40
    const avgConfidence = items.reduce((sum, i) => {
      const evidenceCount = i.evidence_ids?.length || 0
      const confidence = i.confidence || (evidenceCount > 0 ? 50 + (evidenceCount * 10) : 0)
      return sum + confidence
    }, 0) / items.length
    const confidenceScore = (avgConfidence / 100) * 30

    return countScore + evidenceScore + confidenceScore
  }

  const calculateComparison = () => {
    if (!selectedSwot) return

    // Calculate scores for each quadrant
    const currentScores: ComparisonScore = {
      strengths: calculateItemScore(currentSwot.strengths),
      weaknesses: calculateItemScore(currentSwot.weaknesses),
      opportunities: calculateItemScore(currentSwot.opportunities),
      threats: calculateItemScore(currentSwot.threats),
      overall: 0
    }

    const selectedScores: ComparisonScore = {
      strengths: calculateItemScore(selectedSwot.strengths),
      weaknesses: calculateItemScore(selectedSwot.weaknesses),
      opportunities: calculateItemScore(selectedSwot.opportunities),
      threats: calculateItemScore(selectedSwot.threats),
      overall: 0
    }

    // Overall score: Strengths + Opportunities - Weaknesses - Threats
    currentScores.overall = currentScores.strengths + currentScores.opportunities -
                           (currentScores.weaknesses * 0.5) - (currentScores.threats * 0.5)
    selectedScores.overall = selectedScores.strengths + selectedScores.opportunities -
                            (selectedScores.weaknesses * 0.5) - (selectedScores.threats * 0.5)

    setScores({ current: currentScores, selected: selectedScores })

    // Generate recommendation
    generateRecommendation(currentScores, selectedScores)
  }

  const generateRecommendation = (current: ComparisonScore, selected: ComparisonScore) => {
    const winner = current.overall > selected.overall ? currentSwot.title : selectedSwot!.title
    const scoreDiff = Math.abs(current.overall - selected.overall)

    let confidence: 'high' | 'medium' | 'low' = 'medium'
    if (scoreDiff > 20) confidence = 'high'
    else if (scoreDiff < 10) confidence = 'low'

    const reasoning: string[] = []
    const keyFactors: string[] = []
    const risks: string[] = []

    // Analyze strengths
    if (current.strengths > selected.strengths + 10) {
      keyFactors.push(`${currentSwot.title} has significantly more strengths (${currentSwot.strengths.length} vs ${selectedSwot!.strengths.length})`)
    } else if (selected.strengths > current.strengths + 10) {
      keyFactors.push(`${selectedSwot!.title} has significantly more strengths (${selectedSwot!.strengths.length} vs ${currentSwot.strengths.length})`)
    }

    // Analyze weaknesses
    if (current.weaknesses < selected.weaknesses - 10) {
      keyFactors.push(`${currentSwot.title} has fewer weaknesses (${currentSwot.weaknesses.length} vs ${selectedSwot!.weaknesses.length})`)
    } else if (current.weaknesses > selected.weaknesses + 10) {
      risks.push(`${currentSwot.title} has more weaknesses that need mitigation (${currentSwot.weaknesses.length})`)
    }

    // Analyze opportunities
    if (current.opportunities > selected.opportunities + 10) {
      keyFactors.push(`${currentSwot.title} offers more opportunities (${currentSwot.opportunities.length} vs ${selectedSwot!.opportunities.length})`)
    } else if (selected.opportunities > current.opportunities + 10) {
      keyFactors.push(`${selectedSwot!.title} offers more opportunities (${selectedSwot!.opportunities.length} vs ${currentSwot.opportunities.length})`)
    }

    // Analyze threats
    if (current.threats < selected.threats - 5) {
      keyFactors.push(`${currentSwot.title} faces fewer threats (${currentSwot.threats.length} vs ${selectedSwot!.threats.length})`)
    } else if (current.threats > selected.threats + 5) {
      risks.push(`${currentSwot.title} faces more significant threats (${currentSwot.threats.length})`)
    }

    // Generate overall reasoning
    if (winner === currentSwot.title) {
      reasoning.push(`Based on comprehensive analysis, ${currentSwot.title} appears to be the stronger option`)
      reasoning.push(`Overall advantage score: +${scoreDiff.toFixed(1)} points`)
    } else {
      reasoning.push(`Based on comprehensive analysis, ${selectedSwot!.title} appears to be the stronger option`)
      reasoning.push(`Overall advantage score: +${scoreDiff.toFixed(1)} points`)
    }

    if (current.strengths > selected.strengths && current.opportunities > selected.opportunities) {
      reasoning.push('Demonstrates superior strengths and opportunities for growth')
    }

    if (confidence === 'low') {
      reasoning.push('⚠️ The options are closely matched - consider qualitative factors')
    }

    setRecommendation({ winner, confidence, reasoning, keyFactors, risks })
  }

  const ComparisonMetric = ({
    label,
    currentValue,
    selectedValue,
    inverse = false
  }: {
    label: string
    currentValue: number
    selectedValue: number
    inverse?: boolean
  }) => {
    const currentWins = inverse ? currentValue < selectedValue : currentValue > selectedValue
    const diff = Math.abs(currentValue - selectedValue)

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          <span className={cn(
            "text-xs",
            diff < 5 ? "text-gray-500" : currentWins ? "text-green-600" : "text-blue-600"
          )}>
            {diff < 5 ? "Tied" : currentWins ? `+${diff.toFixed(1)}` : `-${diff.toFixed(1)}`}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">{currentSwot.title}</div>
            <Progress value={currentValue} className="h-2" />
            <div className="text-xs text-gray-500 mt-1">{currentValue.toFixed(1)}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">{selectedSwot?.title}</div>
            <Progress value={selectedValue} className="h-2" />
            <div className="text-xs text-gray-500 mt-1">{selectedValue.toFixed(1)}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Compare SWOT Analyses
          </DialogTitle>
        </DialogHeader>

        {!selectedSwot ? (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select a SWOT analysis to compare with "{currentSwot.title}".
                This helps make data-driven decisions between different options (e.g., locations, vendors, strategies).
              </AlertDescription>
            </Alert>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading available analyses...</div>
            ) : availableSwots.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <p>No other SWOT analyses available for comparison.</p>
                  <p className="text-sm mt-2">Create additional SWOT analyses to enable comparisons.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableSwots.map(swot => (
                  <Card
                    key={swot.id}
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedSwot(swot)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{swot.title}</CardTitle>
                      {swot.description && (
                        <CardDescription>{swot.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-bold text-green-600">{swot.strengths.length}</div>
                          <div className="text-gray-500">Strengths</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-red-600">{swot.weaknesses.length}</div>
                          <div className="text-gray-500">Weaknesses</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-blue-600">{swot.opportunities.length}</div>
                          <div className="text-gray-500">Opportunities</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-orange-600">{swot.threats.length}</div>
                          <div className="text-gray-500">Threats</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
              <TabsTrigger value="side-by-side">Side-by-Side</TabsTrigger>
              <TabsTrigger value="recommendation">Recommendation</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Comparing:</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSwot(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Change Selection
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-lg">{currentSwot.title}</CardTitle>
                    <Badge variant="secondary">Current</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Score:</span>
                      <span className="font-bold">{scores?.current.overall.toFixed(1)}</span>
                    </div>
                    <Progress value={(scores?.current.overall || 0) + 50} className="h-2" />
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-500">
                  <CardHeader>
                    <CardTitle className="text-lg">{selectedSwot.title}</CardTitle>
                    <Badge variant="secondary">Comparing</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Score:</span>
                      <span className="font-bold">{scores?.selected.overall.toFixed(1)}</span>
                    </div>
                    <Progress value={(scores?.selected.overall || 0) + 50} className="h-2" />
                  </CardContent>
                </Card>
              </div>

              {recommendation && (
                <Card className="bg-blue-50 dark:bg-blue-900/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Quick Recommendation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          recommendation.confidence === 'high' ? 'bg-green-600' :
                          recommendation.confidence === 'medium' ? 'bg-yellow-600' :
                          'bg-orange-600'
                        )}>
                          {recommendation.confidence} confidence
                        </Badge>
                        <span className="font-semibold">{recommendation.winner}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {recommendation.reasoning[0]}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              {scores && (
                <div className="space-y-6">
                  <ComparisonMetric
                    label="💪 Strengths"
                    currentValue={scores.current.strengths}
                    selectedValue={scores.selected.strengths}
                  />
                  <ComparisonMetric
                    label="⚠️ Weaknesses"
                    currentValue={scores.current.weaknesses}
                    selectedValue={scores.selected.weaknesses}
                    inverse
                  />
                  <ComparisonMetric
                    label="🎯 Opportunities"
                    currentValue={scores.current.opportunities}
                    selectedValue={scores.selected.opportunities}
                  />
                  <ComparisonMetric
                    label="⚡ Threats"
                    currentValue={scores.current.threats}
                    selectedValue={scores.selected.threats}
                    inverse
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="side-by-side" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map(quadrant => (
                  <Card key={quadrant}>
                    <CardHeader>
                      <CardTitle className="capitalize text-sm">{quadrant}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2">{currentSwot.title}</div>
                        <ul className="space-y-1 text-xs">
                          {currentSwot[quadrant].slice(0, 5).map((item, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-gray-500">•</span>
                              <span>{item.text}</span>
                            </li>
                          ))}
                          {currentSwot[quadrant].length > 5 && (
                            <li className="text-gray-500 italic">+{currentSwot[quadrant].length - 5} more</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2">{selectedSwot.title}</div>
                        <ul className="space-y-1 text-xs">
                          {selectedSwot[quadrant].slice(0, 5).map((item, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-gray-500">•</span>
                              <span>{item.text}</span>
                            </li>
                          ))}
                          {selectedSwot[quadrant].length > 5 && (
                            <li className="text-gray-500 italic">+{selectedSwot[quadrant].length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recommendation" className="space-y-4">
              {recommendation && (
                <>
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5" />
                        Decision Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-gray-600 mb-2">Winner</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {recommendation.winner}
                        </div>
                        <Badge className={cn(
                          "mt-2",
                          recommendation.confidence === 'high' ? 'bg-green-600' :
                          recommendation.confidence === 'medium' ? 'bg-yellow-600' :
                          'bg-orange-600'
                        )}>
                          {recommendation.confidence} confidence
                        </Badge>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-600 mb-2">Reasoning</div>
                        <ul className="space-y-2">
                          {recommendation.reasoning.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-blue-500">✓</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {recommendation.keyFactors.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          Key Success Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {recommendation.keyFactors.map((factor, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-green-500">+</span>
                              <span>{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {recommendation.risks.length > 0 && (
                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          Risk Considerations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {recommendation.risks.map((risk, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-orange-500">⚠</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This recommendation is based on quantitative analysis of SWOT factors.
                      Consider qualitative factors, strategic priorities, and organizational context when making final decisions.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
