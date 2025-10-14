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

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: number
}

interface SwotInsightsProps {
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
}

export function SwotInsights({ strengths, weaknesses, opportunities, threats }: SwotInsightsProps) {
  const [insights, setInsights] = useState<string[]>([])
  const [towsStrategies, setTowsStrategies] = useState<{
    SO: string[]
    ST: string[]
    WO: string[]
    WT: string[]
  } | null>(null)
  const [balance, setBalance] = useState<'internal-focused' | 'external-focused' | 'balanced'>('balanced')
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | 'neutral'>('neutral')

  useEffect(() => {
    const loadInsights = async () => {
      try {
        // Transform data to simple string arrays
        const swotData = {
          strengths: strengths.map(s => s.text),
          weaknesses: weaknesses.map(w => w.text),
          opportunities: opportunities.map(o => o.text),
          threats: threats.map(t => t.text)
        }

        // Dynamically import insights functions
        const { analyzeSWOTData, generateTOWSStrategies, generateSWOTInsightsSummary } =
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
      } catch (error) {
        console.error('Failed to load insights:', error)
      }
    }

    if (strengths.length > 0 || weaknesses.length > 0 ||
        opportunities.length > 0 || threats.length > 0) {
      loadInsights()
    }
  }, [strengths, weaknesses, opportunities, threats])

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
