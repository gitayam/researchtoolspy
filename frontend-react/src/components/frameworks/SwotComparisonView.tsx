import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, AlertTriangle, Target, Zap, Award, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface SwotItem {
  id: string
  text: string
  details?: string
  evidence_ids?: string[]
  confidence?: 'low' | 'medium' | 'high'
  tags?: string[]
}

interface SwotData {
  id: string
  title: string
  description: string
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  tags?: string[]
}

interface SwotComparisonViewProps {
  analyses: SwotData[]
  comparisonTag: string
  onClose: () => void
}

export function SwotComparisonView({ analyses, comparisonTag, onClose }: SwotComparisonViewProps) {
  const navigate = useNavigate()

  // Helper: Calculate confidence weight
  const getConfidenceWeight = (confidence?: 'low' | 'medium' | 'high'): number => {
    switch (confidence) {
      case 'high': return 1.0
      case 'medium': return 0.7
      case 'low': return 0.4
      default: return 0.5 // No confidence specified
    }
  }

  // Helper: Calculate weighted score for items
  const getWeightedScore = (items: SwotItem[]): number => {
    return items.reduce((sum, item) => {
      const confidenceWeight = getConfidenceWeight(item.confidence)
      const evidenceBonus = (item.evidence_ids?.length || 0) * 0.15
      return sum + confidenceWeight + evidenceBonus
    }, 0)
  }

  // Calculate comprehensive metrics with confidence weighting
  const metrics = analyses.map(analysis => {
    const strengthScore = getWeightedScore(analysis.strengths)
    const weaknessScore = getWeightedScore(analysis.weaknesses)
    const opportunityScore = getWeightedScore(analysis.opportunities)
    const threatScore = getWeightedScore(analysis.threats)

    // Count high-confidence items
    const highConfidenceCount = [
      ...analysis.strengths,
      ...analysis.weaknesses,
      ...analysis.opportunities,
      ...analysis.threats
    ].filter(item => item.confidence === 'high').length

    const totalPositive = strengthScore + opportunityScore
    const totalNegative = weaknessScore + threatScore

    // Overall score: Positive factors - Negative factors + High confidence bonus
    const score = (totalPositive * 2.0) - (totalNegative * 1.5) + (highConfidenceCount * 0.3)

    return {
      id: analysis.id,
      title: analysis.title,
      strengthCount: analysis.strengths.length,
      weaknessCount: analysis.weaknesses.length,
      opportunityCount: analysis.opportunities.length,
      threatCount: analysis.threats.length,
      strengthScore,
      weaknessScore,
      opportunityScore,
      threatScore,
      totalPositive,
      totalNegative,
      highConfidenceCount,
      score,
      evidenceCount: [
        ...analysis.strengths,
        ...analysis.weaknesses,
        ...analysis.opportunities,
        ...analysis.threats
      ].reduce((sum, item) => sum + (item.evidence_ids?.length || 0), 0)
    }
  })

  // Sort by score (highest first)
  const scoredAnalyses = [...metrics].sort((a, b) => b.score - a.score)

  const getBestInCategory = (category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats') => {
    const counts = analyses.map(a => ({
      title: a.title,
      count: a[category].length
    }))
    return counts.sort((a, b) => b.count - a.count)[0]
  }

  const CategoryComparison = ({
    title,
    items,
    color,
    bgColor,
    icon: Icon
  }: {
    title: string
    items: { analysis: string; items: SwotItem[] }[]
    color: string
    bgColor: string
    icon: any
  }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map(({ analysis, items: categoryItems }, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {analysis}
                </h4>
                <Badge variant="secondary">{categoryItems.length}</Badge>
              </div>
              {categoryItems.length === 0 ? (
                <p className="text-xs text-gray-500 italic pl-2">None identified</p>
              ) : (
                <ul className="space-y-1.5">
                  {categoryItems.slice(0, 3).map((item, itemIdx) => (
                    <li key={itemIdx} className={`text-sm p-2 rounded ${bgColor} flex items-start gap-2`}>
                      {item.confidence && (
                        <span className="flex-shrink-0 text-base" title={`Confidence: ${item.confidence}`}>
                          {item.confidence === 'high' && '🟢'}
                          {item.confidence === 'medium' && '🟡'}
                          {item.confidence === 'low' && '🔴'}
                        </span>
                      )}
                      <div className="flex-1">
                        <div>{item.text}</div>
                        {item.details && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 border-l-2 border-gray-300 pl-2">
                            {item.details.slice(0, 100)}{item.details.length > 100 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      {item.evidence_ids && item.evidence_ids.length > 0 && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          📎 {item.evidence_ids.length}
                        </Badge>
                      )}
                    </li>
                  ))}
                  {categoryItems.length > 3 && (
                    <p className="text-xs text-gray-500 italic pl-2">
                      +{categoryItems.length - 3} more...
                    </p>
                  )}
                </ul>
              )}
              {idx < items.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Comparison: {comparisonTag}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comparing {analyses.length} options for decision-making
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Close Comparison
        </Button>
      </div>

      {/* Scoring Methodology */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">📊 Scoring Methodology</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-gray-700 dark:text-gray-300">
            Options are ranked using a weighted scoring system that considers both quantity and quality:
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="space-y-1.5">
              <p className="font-semibold text-gray-800 dark:text-gray-200">Confidence Weights:</p>
              <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                <li>🟢 High confidence: 1.0 point</li>
                <li>🟡 Medium confidence: 0.7 points</li>
                <li>🔴 Low confidence: 0.4 points</li>
                <li>⚪ No confidence: 0.5 points</li>
                <li>📎 Evidence bonus: +0.15 per evidence item</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-gray-800 dark:text-gray-200">Final Score Calculation:</p>
              <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                <li>Positive factors (S + O) × 2.0</li>
                <li>Negative factors (W + T) × 1.5</li>
                <li>High confidence items × 0.3 bonus</li>
                <li><span className="font-semibold">Score = Positive - Negative + Bonus</span></li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-2">
            Higher scores indicate stronger overall positions. Options with more high-confidence strengths and opportunities will rank higher.
          </p>
        </CardContent>
      </Card>

      {/* Ranking Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-600" />
            Decision Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scoredAnalyses.map((item, idx) => {
              const analysis = analyses.find(a => a.id === item.id)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer hover:shadow-md ${
                    idx === 0
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400'
                      : 'bg-white dark:bg-gray-800 border'
                  }`}
                  onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${item.id}`)}
                >
                  <div className="flex-shrink-0">
                    {idx === 0 && <span className="text-3xl">🏆</span>}
                    {idx === 1 && <span className="text-3xl">🥈</span>}
                    {idx === 2 && <span className="text-3xl">🥉</span>}
                    {idx > 2 && (
                      <span className="text-xl font-bold text-gray-400">#{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {analysis?.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        💪 {item.strengthCount} ({item.strengthScore.toFixed(1)} pts)
                      </Badge>
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        ⚠️ {item.weaknessCount} ({item.weaknessScore.toFixed(1)} pts)
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        🎯 {item.opportunityCount} ({item.opportunityScore.toFixed(1)} pts)
                      </Badge>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700">
                        ⚡ {item.threatCount} ({item.threatScore.toFixed(1)} pts)
                      </Badge>
                      {item.highConfidenceCount > 0 && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          🟢 {item.highConfidenceCount} high confidence
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {item.score.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">total score</div>
                    <div className="text-xs space-y-0.5">
                      <div className="text-green-600 dark:text-green-400">
                        +{item.totalPositive.toFixed(1)} pos
                      </div>
                      <div className="text-red-600 dark:text-red-400">
                        -{item.totalNegative.toFixed(1)} neg
                      </div>
                      {item.evidenceCount > 0 && (
                        <div className="text-purple-600 dark:text-purple-400">
                          📎 {item.evidenceCount} evidence
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Decision Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Decision Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-semibold">Option</th>
                  <th className="text-center py-2 px-4 font-semibold text-green-600">Strengths</th>
                  <th className="text-center py-2 px-4 font-semibold text-red-600">Weaknesses</th>
                  <th className="text-center py-2 px-4 font-semibold text-blue-600">Opportunities</th>
                  <th className="text-center py-2 px-4 font-semibold text-orange-600">Threats</th>
                  <th className="text-center py-2 px-4 font-semibold text-purple-600">High Confidence</th>
                  <th className="text-center py-2 px-4 font-semibold text-blue-600">Score</th>
                </tr>
              </thead>
              <tbody>
                {scoredAnalyses.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                      idx === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                    }`}
                    onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${item.id}`)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <span className="text-lg">🏆</span>}
                        {idx === 1 && <span className="text-lg">🥈</span>}
                        {idx === 2 && <span className="text-lg">🥉</span>}
                        <span className="font-medium">{item.title}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="font-bold text-green-600">{item.strengthCount}</div>
                      <div className="text-xs text-gray-500">{item.strengthScore.toFixed(1)} pts</div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="font-bold text-red-600">{item.weaknessCount}</div>
                      <div className="text-xs text-gray-500">{item.weaknessScore.toFixed(1)} pts</div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="font-bold text-blue-600">{item.opportunityCount}</div>
                      <div className="text-xs text-gray-500">{item.opportunityScore.toFixed(1)} pts</div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="font-bold text-orange-600">{item.threatCount}</div>
                      <div className="text-xs text-gray-500">{item.threatScore.toFixed(1)} pts</div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="font-bold text-purple-600">{item.highConfidenceCount}</div>
                      <div className="text-xs text-gray-500">items</div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="text-xl font-bold text-blue-600">{item.score.toFixed(1)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Strengths</div>
              <div className="font-bold text-green-600 dark:text-green-400 text-lg">
                {getBestInCategory('strengths').title}
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {getBestInCategory('strengths').count}
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Weaknesses</div>
              <div className="font-bold text-red-600 dark:text-red-400 text-lg">
                {getBestInCategory('weaknesses').title}
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {getBestInCategory('weaknesses').count}
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Opportunities</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                {getBestInCategory('opportunities').title}
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {getBestInCategory('opportunities').count}
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Threats</div>
              <div className="font-bold text-orange-600 dark:text-orange-400 text-lg">
                {getBestInCategory('threats').title}
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {getBestInCategory('threats').count}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CategoryComparison
          title="Strengths"
          items={analyses.map(a => ({ analysis: a.title, items: a.strengths }))}
          color="border-green-500"
          bgColor="bg-green-50 dark:bg-green-900/20"
          icon={TrendingUp}
        />
        <CategoryComparison
          title="Weaknesses"
          items={analyses.map(a => ({ analysis: a.title, items: a.weaknesses }))}
          color="border-red-500"
          bgColor="bg-red-50 dark:bg-red-900/20"
          icon={AlertTriangle}
        />
        <CategoryComparison
          title="Opportunities"
          items={analyses.map(a => ({ analysis: a.title, items: a.opportunities }))}
          color="border-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          icon={Target}
        />
        <CategoryComparison
          title="Threats"
          items={analyses.map(a => ({ analysis: a.title, items: a.threats }))}
          color="border-orange-500"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
          icon={Zap}
        />
      </div>

      {/* Individual Analysis Links */}
      <Card>
        <CardHeader>
          <CardTitle>View Individual Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {analyses.map(analysis => (
              <Button
                key={analysis.id}
                variant="outline"
                className="justify-start"
                onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${analysis.id}`)}
              >
                {analysis.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
