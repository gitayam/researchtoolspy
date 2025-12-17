/**
 * Deception Detection Predictions Component
 * Trend analysis, indicators to watch, and scenario forecasting
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, Eye, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import type { AIDeceptionAnalysis, DeceptionScenario } from '@/lib/ai-deception-analysis'
import { generatePredictions } from '@/lib/ai-deception-analysis'
import type { DeceptionScores } from '@/lib/deception-scoring'

interface DeceptionPredictionsProps {
  currentAnalysis: AIDeceptionAnalysis
  historicalData?: Array<{
    timestamp: string
    likelihood: number
    scores: DeceptionScores
  }>
  scenario?: DeceptionScenario
}

export function DeceptionPredictions({
  currentAnalysis,
  historicalData = [],
  scenario
}: DeceptionPredictionsProps) {
  const [predictions, setPredictions] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPredictions()
  }, [currentAnalysis, historicalData])

  const loadPredictions = async () => {
    setLoading(true)
    try {
      const historicalScores = historicalData.map(d => d.scores)
      const result = await generatePredictions(currentAnalysis, historicalScores)
      setPredictions(result)
    } catch (error) {
      console.error('Failed to generate predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Generating predictions...</p>
        </CardContent>
      </Card>
    )
  }

  if (!predictions) {
    return null
  }

  const TrendIcon = predictions.futureRisk === 'INCREASING' ? TrendingUp :
                    predictions.futureRisk === 'DECREASING' ? TrendingDown : Minus

  const trendColor = predictions.futureRisk === 'INCREASING' ? 'text-red-600' :
                     predictions.futureRisk === 'DECREASING' ? 'text-green-600' : 'text-gray-600'

  const trendBg = predictions.futureRisk === 'INCREASING' ? 'bg-red-50 dark:bg-red-900/20' :
                  predictions.futureRisk === 'DECREASING' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-900/20'

  return (
    <div className="space-y-6">
      {/* Trend Assessment */}
      <Card className={`border-2 ${trendBg}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            Future Risk Trend
          </CardTitle>
          <CardDescription>
            Projected trajectory of deception likelihood
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold">{predictions.futureRisk}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Trend Direction
              </div>
            </div>
            <Badge variant={
              predictions.futureRisk === 'INCREASING' ? 'destructive' :
              predictions.futureRisk === 'DECREASING' ? 'default' : 'secondary'
            } className="text-lg px-4 py-2">
              {predictions.futureRisk}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Confidence Interval</span>
              <span className="font-medium">
                {predictions.confidenceInterval.min}% - {predictions.confidenceInterval.max}%
              </span>
            </div>
            <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-blue-500/30"
                style={{
                  left: `${predictions.confidenceInterval.min}%`,
                  width: `${predictions.confidenceInterval.max - predictions.confidenceInterval.min}%`
                }}
              />
              <div
                className="absolute h-full w-1 bg-blue-600"
                style={{ left: `${currentAnalysis.deceptionLikelihood}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>Current: {currentAnalysis.deceptionLikelihood}%</span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Drivers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Key Risk Drivers
          </CardTitle>
          <CardDescription>
            Primary factors influencing deception assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {predictions.keyDrivers.map((driver: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{idx + 1}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm">{driver}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Forecasts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Scenario Forecasts
          </CardTitle>
          <CardDescription>
            "What if..." analysis for different conditions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictions.scenarioForecasts.map((forecast: any, idx: number) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">
                      {forecast.condition}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {forecast.impact}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {forecast.likelihood}% likely
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Likelihood</span>
                    <span className="font-medium">{forecast.likelihood}%</span>
                  </div>
                  <Progress value={forecast.likelihood} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Indicators to Watch */}
      {currentAnalysis.indicatorsToWatch && currentAnalysis.indicatorsToWatch.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Indicators to Watch
            </CardTitle>
            <CardDescription>
              Monitor these factors for changes in assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentAnalysis.indicatorsToWatch.map((indicator, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{indicator}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Context */}
      {historicalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Context</CardTitle>
            <CardDescription>
              Based on {historicalData.length} previous assessment{historicalData.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">First Assessment</span>
                <span className="font-medium">
                  {historicalData[0].likelihood}% deception likelihood
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Latest Assessment</span>
                <span className="font-medium">
                  {historicalData[historicalData.length - 1].likelihood}% deception likelihood
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Change Over Time</span>
                <span className={`font-medium ${
                  historicalData[historicalData.length - 1].likelihood - historicalData[0].likelihood > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {historicalData[historicalData.length - 1].likelihood - historicalData[0].likelihood > 0 ? '+' : ''}
                  {(historicalData[historicalData.length - 1].likelihood - historicalData[0].likelihood).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {currentAnalysis.collectionPriorities && currentAnalysis.collectionPriorities.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Collection Priorities
            </CardTitle>
            <CardDescription>
              Additional information that would refine this assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {currentAnalysis.collectionPriorities.map((priority, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{priority}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
