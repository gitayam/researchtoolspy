/**
 * SWOT Insights Component
 *
 * Displays strategic insights, balance analysis, and TOWS recommendations
 * Uses the enhanced report library to provide preview of report content
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Lightbulb,
  Target,
  Shield,
  Rocket,
  AlertTriangle
} from 'lucide-react'

// Import SwotItem type from reports library to ensure consistency
import type { SwotItem as SwotItemType } from '@/lib/reports'

type SwotItem = SwotItemType

interface SwotInsightsProps {
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  goal?: string
  options?: string[]
}

export function SwotInsights({ strengths, weaknesses, opportunities, threats, goal, options }: SwotInsightsProps) {
  const [insights, setInsights] = useState<string[]>([])
  const [towsStrategies, setTowsStrategies] = useState<{
    SO: string[]
    ST: string[]
    WO: string[]
    WT: string[]
  } | null>(null)
  const [decisionRecommendation, setDecisionRecommendation] = useState<any>(null)
  const [balance, setBalance] = useState<'internal-focused' | 'external-focused' | 'balanced'>('balanced')
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | 'neutral'>('neutral')

  useEffect(() => {
    const loadInsights = async () => {
      try {
        // Use rich SwotItem objects directly
        const swotData = {
          strengths,
          weaknesses,
          opportunities,
          threats,
          goal,
          options
        }

        // Dynamically import insights functions
        const { analyzeSWOTData, generateTOWSStrategies, generateSWOTInsightsSummary, generateDecisionRecommendation } =
          await import('@/lib/reports')

        // Analyze data
        const analysis = analyzeSWOTData(swotData)
        setBalance(analysis.balance)
        setSentiment(analysis.sentiment)

        // Generate insights
        const insightsSummary = generateSWOTInsightsSummary(swotData)
        setInsights(insightsSummary)

        // Generate TOWS strategies
        const tows = generateTOWSStrategies(swotData)
        setTowsStrategies(tows)

        // Generate decision recommendation if options are provided
        if (options && options.length > 0) {
          const decision = generateDecisionRecommendation(swotData)
          setDecisionRecommendation(decision)
        }
      } catch (error) {
        console.error('Failed to load insights:', error)
      }
    }

    if (strengths.length > 0 || weaknesses.length > 0 ||
        opportunities.length > 0 || threats.length > 0) {
      loadInsights()
    }
  }, [strengths, weaknesses, opportunities, threats, goal, options])

  const total = strengths.length + weaknesses.length + opportunities.length + threats.length

  if (total === 0) {
    return null
  }

  const internal = strengths.length + weaknesses.length
  const external = opportunities.length + threats.length
  const positive = strengths.length + opportunities.length
  const negative = weaknesses.length + threats.length

  return (
    <div className="space-y-6">
      {/* Strategic Position Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Strategic Position Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance Indicator */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Analysis Focus</p>
              <p className="text-lg font-semibold">
                {balance === 'internal-focused' && '🏢 Internal-Focused'}
                {balance === 'external-focused' && '🌍 External-Focused'}
                {balance === 'balanced' && '⚖️ Balanced'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Internal vs External</p>
              <p className="text-lg font-semibold">{internal} vs {external}</p>
            </div>
          </div>

          {/* Sentiment Indicator */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Overall Outlook</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                {sentiment === 'positive' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Positive
                  </>
                )}
                {sentiment === 'negative' && (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Challenging
                  </>
                )}
                {sentiment === 'neutral' && (
                  <>
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Neutral
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Positive vs Negative</p>
              <p className="text-lg font-semibold">{positive} vs {negative}</p>
            </div>
          </div>

          {/* Key Insights */}
          {insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Key Insights
              </p>
              {insights.map((insight, idx) => (
                <Alert key={idx} className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <AlertDescription className="text-sm">
                    {insight}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Recommendation (if options provided) */}
      {decisionRecommendation && (
        <Card className="border-2 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Decision Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Goal Display */}
            {decisionRecommendation.goal && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">🎯 Goal: </span>
                <span className="text-sm text-blue-800 dark:text-blue-300">{decisionRecommendation.goal}</span>
              </div>
            )}

            {/* Top Recommendation */}
            <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg">
              <p className="text-sm font-medium text-white/90 mb-1">Recommended Choice</p>
              <p className="text-2xl font-bold text-white">{decisionRecommendation.topChoice}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-white/30">
                  Score: {decisionRecommendation.scores[0].netScore.toFixed(1)}
                </Badge>
                <Badge className="bg-white/20 text-white border-white/30">
                  {decisionRecommendation.scores[0].recommendation.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Key Reasoning */}
            {decisionRecommendation.reasoning && decisionRecommendation.reasoning.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Key Reasoning
                </p>
                <ul className="space-y-1.5 ml-4">
                  {decisionRecommendation.reasoning.map((reason: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                      • {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comparison Matrix */}
            {decisionRecommendation.comparisonMatrix && decisionRecommendation.comparisonMatrix.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Options Comparison Matrix
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="text-left p-2 border border-gray-300 dark:border-gray-600">Option</th>
                        <th className="text-center p-2 border border-gray-300 dark:border-gray-600">Str</th>
                        <th className="text-center p-2 border border-gray-300 dark:border-gray-600">Weak</th>
                        <th className="text-center p-2 border border-gray-300 dark:border-gray-600">Opp</th>
                        <th className="text-center p-2 border border-gray-300 dark:border-gray-600">Threat</th>
                        <th className="text-center p-2 border border-gray-300 dark:border-gray-600 font-bold">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisionRecommendation.comparisonMatrix.map((row: any, idx: number) => (
                        <tr
                          key={idx}
                          className={idx === 0
                            ? 'bg-green-50 dark:bg-green-900/20 font-semibold'
                            : idx % 2 === 0
                              ? 'bg-gray-50 dark:bg-gray-800/50'
                              : ''
                          }
                        >
                          <td className="p-2 border border-gray-300 dark:border-gray-600">
                            {idx === 0 && '🥇 '}
                            {idx === 1 && '🥈 '}
                            {idx === 2 && '🥉 '}
                            {row.option}
                          </td>
                          <td className="text-center p-2 border border-gray-300 dark:border-gray-600">{row.strengths}</td>
                          <td className="text-center p-2 border border-gray-300 dark:border-gray-600">{row.weaknesses}</td>
                          <td className="text-center p-2 border border-gray-300 dark:border-gray-600">{row.opportunities}</td>
                          <td className="text-center p-2 border border-gray-300 dark:border-gray-600">{row.threats}</td>
                          <td className={`text-center p-2 border border-gray-300 dark:border-gray-600 font-bold ${
                            row.score > 5 ? 'text-green-600 dark:text-green-400' :
                            row.score > 2 ? 'text-blue-600 dark:text-blue-400' :
                            row.score > 0 ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {row.score.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Option Analysis */}
            {decisionRecommendation.scores && decisionRecommendation.scores.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Detailed Option Analysis
                </p>
                {decisionRecommendation.scores.map((score: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-l-4 ${
                      idx === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-500' :
                      idx === 1 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' :
                      idx === 2 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' :
                      'bg-gray-50 dark:bg-gray-800/50 border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {idx === 0 && '🥇 '}
                        {idx === 1 && '🥈 '}
                        {idx === 2 && '🥉 '}
                        {idx > 2 && `${idx + 1}. `}
                        {score.option}
                      </p>
                      <div className="flex gap-2">
                        <Badge variant={score.recommendation === 'highly_recommended' ? 'default' : 'secondary'}>
                          {score.recommendation.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={
                          score.netScore > 5 ? 'border-green-500 text-green-700 dark:text-green-400' :
                          score.netScore > 2 ? 'border-blue-500 text-blue-700 dark:text-blue-400' :
                          score.netScore > 0 ? 'border-orange-500 text-orange-700 dark:text-orange-400' :
                          'border-red-500 text-red-700 dark:text-red-400'
                        }>
                          Score: {score.netScore.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                    {score.reasoning && score.reasoning.length > 0 && (
                      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        {score.reasoning.map((reason: string, reasonIdx: number) => (
                          <li key={reasonIdx}>• {reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TOWS Strategic Recommendations */}
      {towsStrategies && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              TOWS Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SO Strategies (Growth) */}
            {towsStrategies.SO.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Rocket className="h-3 w-3 mr-1" />
                    SO Growth Strategies
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Use Strengths to exploit Opportunities
                  </span>
                </div>
                <ul className="space-y-1 ml-4">
                  {towsStrategies.SO.map((strategy, idx) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                      • {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* WO Strategies (Development) */}
            {towsStrategies.WO.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    WO Development Strategies
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Address Weaknesses to exploit Opportunities
                  </span>
                </div>
                <ul className="space-y-1 ml-4">
                  {towsStrategies.WO.map((strategy, idx) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                      • {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ST Strategies (Diversification) */}
            {towsStrategies.ST.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    <Shield className="h-3 w-3 mr-1" />
                    ST Diversification Strategies
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Use Strengths to mitigate Threats
                  </span>
                </div>
                <ul className="space-y-1 ml-4">
                  {towsStrategies.ST.map((strategy, idx) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                      • {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* WT Strategies (Defensive) */}
            {towsStrategies.WT.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    WT Defensive Strategies
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Minimize Weaknesses and avoid Threats
                  </span>
                </div>
                <ul className="space-y-1 ml-4">
                  {towsStrategies.WT.map((strategy, idx) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                      • {strategy}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export Tip */}
      <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <Lightbulb className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Tip:</strong> Click "Enhanced SWOT Report" in the Export menu to generate a
          professional PDF including these insights, visualizations, and methodology.
        </AlertDescription>
      </Alert>
    </div>
  )
}
