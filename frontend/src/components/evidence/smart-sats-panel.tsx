/**
 * Smart SATS Pre-Evaluation Panel
 * AI-powered initial SATS scoring with manual override capability
 */

'use client'

import { useState } from 'react'
import { 
  Bot, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  TrendingDown,
  Target,
  RefreshCw,
  Info,
  Lightbulb,
  Shield
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { 
  generateSmartSATSEvaluation, 
  checkSmartSATSAvailability,
  suggestEvidenceImprovements,
  SmartSATSResult,
  EvidenceContext 
} from '@/lib/smart-sats-evaluator'
import { EVIDENCE_QUESTIONS } from '@/lib/evidence-evaluation'

interface SmartSATSPanelProps {
  onEvaluationComplete?: (scores: Record<string, number>, rationale?: Record<string, string>) => void
  initialContext?: Partial<EvidenceContext>
  className?: string
}

export function SmartSATSPanel({ 
  onEvaluationComplete, 
  initialContext = {},
  className 
}: SmartSATSPanelProps) {
  const [context, setContext] = useState<EvidenceContext>({
    text: initialContext.text || '',
    source: initialContext.source || '',
    publication: initialContext.publication || '',
    date: initialContext.date || '',
    author: initialContext.author || '',
    url: initialContext.url || '',
    additionalContext: initialContext.additionalContext || ''
  })
  
  const [result, setResult] = useState<SmartSATSResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const [showImprovements, setShowImprovements] = useState(false)
  const { toast } = useToast()

  // Check AI availability on component mount
  useState(() => {
    checkSmartSATSAvailability().then(setAiAvailable)
  })

  const runAnalysis = async () => {
    if (!context.text.trim()) {
      toast({
        title: 'Evidence Text Required',
        description: 'Please provide the evidence text to analyze',
        variant: 'destructive'
      })
      return
    }

    setIsAnalyzing(true)
    try {
      const smartResult = await generateSmartSATSEvaluation(context)
      setResult(smartResult)
      
      if (onEvaluationComplete) {
        onEvaluationComplete(smartResult.scores, smartResult.rationale)
      }
      
      toast({
        title: 'Analysis Complete',
        description: `Evidence rated as ${smartResult.credibility.description} (${smartResult.credibility.letter})`,
      })
    } catch (error) {
      console.error('Failed to generate SATS evaluation:', error)
      toast({
        title: 'Analysis Failed', 
        description: 'Failed to analyze evidence. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 11) return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30'
    if (score >= 8) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20'
    if (score >= 3) return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20'
    return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
  }

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high': return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
      case 'medium': return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30'
      case 'low': return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30'
    }
  }

  if (aiAvailable === false) {
    return (
      <Card className={`bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 ${className}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-gray-400" />
            <CardTitle className="text-gray-600 dark:text-gray-400">Smart SATS Analysis Unavailable</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Smart SATS pre-evaluation requires an OpenAI API key. Use manual evaluation instead or contact your administrator to enable AI-powered analysis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-gray-900 dark:text-gray-100">Smart SATS Pre-Evaluation</CardTitle>
        </div>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          AI-powered initial SATS evidence evaluation with improvement recommendations
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!result ? (
          <div className="space-y-4">
            {/* Evidence Input */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Evidence Text *
              </label>
              <Textarea
                value={context.text}
                onChange={(e) => setContext(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Paste the evidence text to be evaluated using SATS methodology..."
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                rows={4}
              />
            </div>

            {/* Context Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Source
                </label>
                <Input
                  value={context.source}
                  onChange={(e) => setContext(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="e.g., Jane Doe, Company X"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Publication
                </label>
                <Input
                  value={context.publication}
                  onChange={(e) => setContext(prev => ({ ...prev, publication: e.target.value }))}
                  placeholder="e.g., New York Times, Internal Report"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Date
                </label>
                <Input
                  type="date"
                  value={context.date}
                  onChange={(e) => setContext(prev => ({ ...prev, date: e.target.value }))}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Author
                </label>
                <Input
                  value={context.author}
                  onChange={(e) => setContext(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="e.g., John Smith"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                URL (Optional)
              </label>
              <Input
                value={context.url}
                onChange={(e) => setContext(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Additional Context (Optional)
              </label>
              <Textarea
                value={context.additionalContext}
                onChange={(e) => setContext(prev => ({ ...prev, additionalContext: e.target.value }))}
                placeholder="Any additional context that might help with evaluation..."
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                rows={2}
              />
            </div>

            {/* Generate Button */}
            <Button 
              onClick={runAnalysis}
              disabled={isAnalyzing || !context.text.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            >
              {isAnalyzing ? (
                <>
                  <Bot className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Evidence...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Smart SATS Evaluation
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Assessment */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Overall Assessment</h4>
                </div>
                <Badge className={result.credibility.color}>
                  {result.credibility.letter} - {result.credibility.description}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-800 dark:text-blue-200">Confidence Score:</span>
                  <span className="font-medium">{result.confidence.confidence}/13 ({result.confidence.percentage}%)</span>
                </div>
                <Progress value={result.confidence.percentage} className="h-2" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  {result.confidence.level.replace('_', ' ').toLowerCase()} confidence level
                </div>
              </div>
            </div>

            {/* Detailed Scores */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">SATS Criterion Scores</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImprovements(!showImprovements)}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {showImprovements ? 'Hide' : 'Show'} Improvements
                </Button>
              </div>
              
              <div className="grid gap-3">
                {EVIDENCE_QUESTIONS.map((question) => {
                  const score = result.scores[question.id]
                  const rationale = result.rationale[question.id]
                  
                  return (
                    <Card key={question.id} className="border border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {question.category}
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {question.question}
                            </p>
                          </div>
                          <Badge className={getScoreColor(score)}>
                            {score}/13
                          </Badge>
                        </div>
                        {rationale && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                            {rationale}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Warnings
                </h4>
                <ul className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">•</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Analysis Recommendations
                </h4>
                <ul className="space-y-1 text-sm text-green-800 dark:text-green-200">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidence Improvement Suggestions */}
            {showImprovements && (
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Evidence Improvement Priorities
                </h4>
                {(() => {
                  const improvements = suggestEvidenceImprovements(result.scores)
                  return (
                    <div className="space-y-4">
                      {improvements.priorities.length > 0 && (
                        <div className="space-y-3">
                          {improvements.priorities.slice(0, 3).map((priority, index) => (
                            <Card key={index} className="border border-gray-200 dark:border-gray-700">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="font-medium text-gray-900 dark:text-gray-100">
                                    {priority.criterion}
                                  </h5>
                                  <Badge className={getImpactColor(priority.impact)}>
                                    {priority.impact} impact
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                  Current: {priority.currentScore}/13 → Target: {priority.targetScore}/13
                                </div>
                                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                  {priority.actionItems.map((action, actionIndex) => (
                                    <li key={actionIndex} className="flex items-start gap-2">
                                      <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                      
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Overall Strategy</h5>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                          {improvements.overallStrategy.map((strategy, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              {strategy}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null)
                  setShowImprovements(false)
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
              <Button
                onClick={() => {
                  if (onEvaluationComplete) {
                    onEvaluationComplete(result.scores, result.rationale)
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Use These Scores
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}