'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Search, 
  Edit, 
  Download, 
  Share2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  X,
  Calendar,
  Eye,
  TrendingUp,
  BarChart3,
  Calculator,
  Trophy,
  Brain,
  Lightbulb,
  FileText,
  FileDown,
  FileCode
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { exportFrameworkAnalysis, ExportFormat } from '@/lib/export-utils'

interface ACHSession {
  id: string
  title: string
  description?: string
  framework_type: 'ach'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    hypotheses: Array<{ id: string; text: string }>
    evidence: Array<{ 
      id: string
      text: string
      hypotheses_scores: { [hypothesisId: string]: 'supports' | 'contradicts' | 'neutral' | 'not_applicable' }
    }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function ACHViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<ACHSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisInsights, setAnalysisInsights] = useState<any>(null)
  const [showInsights, setShowInsights] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<ACHSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load ACH analysis',
          variant: 'destructive'
        })
        router.push('/frameworks')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchSession()
    }
  }, [params.id, router, toast])

  const handleEdit = () => {
    router.push(`/frameworks/ach/${params.id}/edit`)
  }

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportFrameworkAnalysis({
        title: session.title,
        content: session,
        format
      })
      
      toast({
        title: 'Export Successful',
        description: `ACH analysis exported as ${format.toUpperCase()}`
      })
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export analysis',
        variant: 'destructive'
      })
    }
  }

  const handleShare = () => {
    toast({
      title: 'Share',
      description: 'Share functionality coming soon'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading ACH analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'supports':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'contradicts':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'neutral':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'not_applicable':
        return <X className="h-4 w-4 text-gray-400" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'supports':
        return 'bg-green-50 border-green-200'
      case 'contradicts':
        return 'bg-red-50 border-red-200'
      case 'neutral':
        return 'bg-yellow-50 border-yellow-200'
      case 'not_applicable':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const calculateHypothesisScore = (hypothesisId: string) => {
    const scores = session.data.evidence.map(e => e.hypotheses_scores[hypothesisId]).filter(Boolean)
    if (scores.length === 0) return { supports: 0, contradicts: 0, neutral: 0, not_applicable: 0, weightedScore: 0 }
    
    const counts = {
      supports: scores.filter(s => s === 'supports').length,
      contradicts: scores.filter(s => s === 'contradicts').length,
      neutral: scores.filter(s => s === 'neutral').length,
      not_applicable: scores.filter(s => s === 'not_applicable').length
    }
    
    // Calculate weighted score based on legacy ACH implementation
    // Supports = +1, Contradicts = -1, Neutral = 0, N/A = 0
    const weightedScore = counts.supports * 1.0 + counts.contradicts * -1.0
    
    return { ...counts, weightedScore }
  }
  
  const calculateAllHypothesesScores = () => {
    const hypothesesWithScores = session.data.hypotheses.map(hypothesis => {
      const score = calculateHypothesisScore(hypothesis.id)
      return {
        ...hypothesis,
        ...score
      }
    })
    
    // Sort by weighted score (highest first)
    return hypothesesWithScores.sort((a, b) => b.weightedScore - a.weightedScore)
  }
  
  const performAnalysis = async () => {
    setAnalyzing(true)
    
    try {
      // Simulate API call for analysis
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Generate analysis insights
      const rankedHypotheses = calculateAllHypothesesScores()
      const insights = {
        strongest_hypothesis: rankedHypotheses[0],
        weakest_hypothesis: rankedHypotheses[rankedHypotheses.length - 1],
        most_diagnostic_evidence: identifyDiagnosticEvidence(),
        competing_hypotheses: identifyCompetingHypotheses(rankedHypotheses),
        confidence_assessment: generateConfidenceAssessment(rankedHypotheses),
        recommendations: generateRecommendations(rankedHypotheses)
      }
      
      setAnalysisInsights(insights)
      setShowInsights(true)
      
      toast({
        title: 'Analysis Complete',
        description: 'Generated insights and recommendations'
      })
    } catch (error: any) {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to generate analysis',
        variant: 'destructive'
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const identifyDiagnosticEvidence = () => {
    // Find evidence that most differentiates between hypotheses
    const diagnosticEvidence = session.data.evidence.map(evidence => {
      const scores = Object.values(evidence.hypotheses_scores)
      const uniqueScores = new Set(scores).size
      return {
        ...evidence,
        diagnosticity: uniqueScores // Higher is more diagnostic
      }
    }).sort((a, b) => b.diagnosticity - a.diagnosticity)
    
    return diagnosticEvidence.slice(0, 3)
  }

  const identifyCompetingHypotheses = (rankedHypotheses: any[]) => {
    // Find hypotheses with similar scores (competing for top position)
    if (rankedHypotheses.length < 2) return []
    
    const topScore = rankedHypotheses[0].weightedScore
    const competing = rankedHypotheses.filter(h => 
      Math.abs(h.weightedScore - topScore) <= 2 && h.id !== rankedHypotheses[0].id
    )
    
    return competing
  }

  const generateConfidenceAssessment = (rankedHypotheses: any[]) => {
    if (rankedHypotheses.length === 0) return 'Low'
    
    const topScore = rankedHypotheses[0].weightedScore
    const secondScore = rankedHypotheses[1]?.weightedScore || 0
    const scoreDiff = topScore - secondScore
    
    if (scoreDiff > 5) return 'High'
    if (scoreDiff > 2) return 'Medium'
    return 'Low'
  }

  const generateRecommendations = (rankedHypotheses: any[]) => {
    const recommendations = []
    const confidence = generateConfidenceAssessment(rankedHypotheses)
    
    if (confidence === 'Low') {
      recommendations.push('Gather additional discriminating evidence')
      recommendations.push('Consider additional hypotheses not yet explored')
    }
    
    if (session.data.evidence.length < 5) {
      recommendations.push('Add more evidence to strengthen analysis')
    }
    
    if (rankedHypotheses.length > 0 && rankedHypotheses[0].contradicts > 0) {
      recommendations.push('Investigate contradicting evidence for top hypothesis')
    }
    
    recommendations.push('Review evidence quality and reliability')
    recommendations.push('Consider alternative interpretations of key evidence')
    
    return recommendations
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <Badge className={statusColors[session.status]}>
              {session.status.replace('_', ' ')}
            </Badge>
          </div>
          {session.description && (
            <p className="text-gray-600 dark:text-gray-400">{session.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Created {formatRelativeTime(session.created_at)}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Last updated {formatRelativeTime(session.updated_at)}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={performAnalysis}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Calculator className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Deep Analysis
              </>
            )}
          </Button>
          
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('word')}>
                <FileText className="h-4 w-4 mr-2" />
                Export as Word
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('markdown')}>
                <FileCode className="h-4 w-4 mr-2" />
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileDown className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleEdit} className="bg-orange-600 hover:bg-orange-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Insights */}
      {showInsights && analysisInsights && (
        <Card className="border-2 border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-purple-600" />
              Analysis Insights
            </CardTitle>
            <CardDescription>
              Deep analysis results and recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Strongest Hypothesis */}
            <div>
              <h4 className="font-medium mb-2">Strongest Hypothesis</h4>
              <div className="p-3 bg-green-100 rounded-lg border border-green-200">
                <p className="font-medium">{analysisInsights.strongest_hypothesis.text}</p>
                <div className="mt-2 text-sm text-green-700">
                  Score: {analysisInsights.strongest_hypothesis.weightedScore} 
                  ({analysisInsights.strongest_hypothesis.supports} supports, 
                  {analysisInsights.strongest_hypothesis.contradicts} contradicts)
                </div>
              </div>
            </div>

            {/* Confidence Level */}
            <div>
              <h4 className="font-medium mb-2">Confidence Assessment</h4>
              <Badge className={`
                ${analysisInsights.confidence_assessment === 'High' ? 'bg-green-100 text-green-800' : ''}
                ${analysisInsights.confidence_assessment === 'Medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${analysisInsights.confidence_assessment === 'Low' ? 'bg-red-100 text-red-800' : ''}
              `}>
                {analysisInsights.confidence_assessment} Confidence
              </Badge>
            </div>

            {/* Competing Hypotheses */}
            {analysisInsights.competing_hypotheses.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Competing Hypotheses</h4>
                <div className="space-y-2">
                  {analysisInsights.competing_hypotheses.map((hyp: any, index: number) => (
                    <div key={index} className="p-2 bg-yellow-50 rounded border border-yellow-200">
                      <p className="text-sm">{hyp.text}</p>
                      <p className="text-xs text-yellow-700 mt-1">Score: {hyp.weightedScore}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most Diagnostic Evidence */}
            <div>
              <h4 className="font-medium mb-2">Most Diagnostic Evidence</h4>
              <div className="space-y-2">
                {analysisInsights.most_diagnostic_evidence.map((evidence: any, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs mt-0.5">E{index + 1}</Badge>
                    <p className="text-sm">{evidence.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <ul className="space-y-2">
                {analysisInsights.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {session.data.hypotheses.length}
              </div>
              <div className="text-sm text-gray-500">Hypotheses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {session.data.evidence.length}
              </div>
              <div className="text-sm text-gray-500">Evidence Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {session.data.evidence.reduce((sum, e) => 
                  sum + Object.values(e.hypotheses_scores).filter(s => s === 'supports').length, 0
                )}
              </div>
              <div className="text-sm text-gray-500">Supporting Links</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {session.data.evidence.reduce((sum, e) => 
                  sum + Object.values(e.hypotheses_scores).filter(s => s === 'contradicts').length, 0
                )}
              </div>
              <div className="text-sm text-gray-500">Contradicting Links</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hypothesis Ranking */}
      <Card className="border-2 border-dashed border-orange-300 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Hypothesis Ranking (by Weighted Score)
          </CardTitle>
          <CardDescription>
            Ranked by consistency scores - higher scores indicate stronger hypotheses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {calculateAllHypothesesScores().map((hypothesis, index) => {
              const rank = index + 1
              const hasEvidence = session.data.evidence.length > 0
              const isTop = hasEvidence && hypothesis.weightedScore > 0 && index === 0
              const hasDistinctScore = hasEvidence && hypothesis.weightedScore !== 0
              
              return (
                <div key={hypothesis.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                  hasDistinctScore && rank === 1 ? 'border-green-300 bg-green-50' :
                  hasDistinctScore && rank === 2 ? 'border-blue-300 bg-blue-50' :
                  hasDistinctScore && rank === 3 ? 'border-yellow-300 bg-yellow-50' :
                  'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={hasDistinctScore && isTop ? "default" : "outline"}
                      className={
                        hasDistinctScore && rank === 1 ? 'bg-green-600' :
                        hasDistinctScore && rank === 2 ? 'bg-blue-600' :
                        hasDistinctScore && rank === 3 ? 'bg-yellow-600' : ''
                      }
                    >
                      #{rank}
                    </Badge>
                    {isTop && <Trophy className="h-4 w-4 text-yellow-600" />}
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-relaxed">{hypothesis.text}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      hypothesis.weightedScore > 0 ? 'text-green-600' : 
                      hypothesis.weightedScore < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {hypothesis.weightedScore > 0 ? '+' : ''}{hypothesis.weightedScore}
                    </div>
                    <div className="text-xs text-gray-500">
                      {hypothesis.supports}S / {hypothesis.contradicts}C
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hypotheses Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Hypotheses Analysis
          </CardTitle>
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={performAnalysis}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Calculator className="h-4 w-4" />
              Analyze Hypotheses
            </Button>
            <Button 
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                const scores = calculateAllHypothesesScores()
                toast({
                  title: 'Strongest Hypothesis',
                  description: `"${scores[0]?.text}" has the highest score (${scores[0]?.weightedScore})`
                })
              }}
            >
              <Trophy className="h-4 w-4" />
              Show Best Hypothesis
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calculateAllHypothesesScores().map((hypothesis, index) => {
              const total = hypothesis.supports + hypothesis.contradicts + hypothesis.neutral + hypothesis.not_applicable
              const hasEvidence = session.data.evidence.length > 0
              const allScoresEqual = calculateAllHypothesesScores().every(h => h.weightedScore === hypothesis.weightedScore)
              const isStrongest = hasEvidence && !allScoresEqual && index === 0 && hypothesis.weightedScore > 0
              
              return (
                <div key={hypothesis.id} className={`border rounded-lg p-4 ${
                  isStrongest ? 'border-green-300 bg-green-50' : ''
                }`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={isStrongest ? "default" : "outline"} className="mt-1">
                        H{index + 1}
                      </Badge>
                      {isStrongest && <Trophy className="h-4 w-4 text-yellow-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed font-medium">{hypothesis.text}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                        <span className={`font-medium ${
                          hypothesis.weightedScore > 0 ? 'text-green-600' : 
                          hypothesis.weightedScore < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          Score: {hypothesis.weightedScore}
                        </span>
                        {isStrongest && (
                          <Badge variant="secondary" className="text-xs">
                            Strongest Hypothesis
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {total > 0 && (
                    <div className="ml-14">
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{hypothesis.supports}</span>
                          <span className="text-gray-500">Supports</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium">{hypothesis.neutral}</span>
                          <span className="text-gray-500">Neutral</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="font-medium">{hypothesis.contradicts}</span>
                          <span className="text-gray-500">Contradicts</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <X className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{hypothesis.not_applicable}</span>
                          <span className="text-gray-500">N/A</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Evidence Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Evidence Matrix
          </CardTitle>
          <CardDescription>
            How each piece of evidence relates to the competing hypotheses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session.data.evidence.length > 0 ? (
            <div className="space-y-4">
              {session.data.evidence.map((evidence, evidenceIndex) => (
                <div key={evidence.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge variant="outline" className="mt-1">E{evidenceIndex + 1}</Badge>
                    <p className="text-sm leading-relaxed flex-1">{evidence.text}</p>
                  </div>
                  
                  <div className="ml-14">
                    <div className="grid gap-2">
                      {session.data.hypotheses.map((hypothesis, hIndex) => {
                        const score = evidence.hypotheses_scores[hypothesis.id] || 'neutral'
                        return (
                          <div key={hypothesis.id} className={`flex items-center gap-3 p-2 rounded border ${getScoreColor(score)}`}>
                            <Badge variant="outline" className="text-xs">H{hIndex + 1}</Badge>
                            <div className="flex items-center gap-2">
                              {getScoreIcon(score)}
                              <span className="text-sm capitalize">{score.replace('_', ' ')}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No evidence added yet</p>
              <p className="text-sm text-gray-400">Add evidence to see the evaluation matrix</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}