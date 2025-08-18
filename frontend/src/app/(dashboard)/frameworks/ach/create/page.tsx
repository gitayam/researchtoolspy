'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Plus, 
  Save, 
  Search, 
  X, 
  Trash2, 
  Calculator, 
  BarChart3, 
  Trophy,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Scale
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TechniqueSnippet } from '@/components/frameworks/technique-snippets'
import { ACHEnhancedScoring, ACHScaleSelection } from '@/components/frameworks/ach-enhanced-scoring'
import { EvidenceEvaluationPanel } from '@/components/frameworks/evidence-evaluation-panel'
import { ACHExport } from '@/components/frameworks/ach-export'
import {
  ScaleType,
  ACHScore,
  EvidenceWeight,
  analyzeHypotheses,
  convertLegacyScore,
  getScoreOption,
  LOGARITHMIC_SCORES,
  LINEAR_SCORES
} from '@/lib/ach-scoring'
import type { ACHExportData } from '@/lib/ach-export'

interface Hypothesis {
  id: string
  text: string
}

interface Evidence {
  id: string
  text: string
  weight: EvidenceWeight
  confidenceScore?: number
  evaluationResponses?: Record<string, number>
}

interface EnhancedACHData {
  hypotheses: Hypothesis[]
  evidence: Evidence[]
  scores: Map<string, Map<string, ACHScore>> // evidenceId -> hypothesisId -> score
  scaleType: ScaleType
}

export default function CreateACHPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSnippet, setShowSnippet] = useState(false)
  const [selectedEvidenceForEval, setSelectedEvidenceForEval] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [evidenceExpanded, setEvidenceExpanded] = useState(true)
  
  const [achData, setACHData] = useState<EnhancedACHData>({
    hypotheses: [],
    evidence: [],
    scores: new Map(),
    scaleType: 'logarithmic'
  })

  // Handle edit mode - load existing session data
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) {
      setIsEditMode(true)
      setEditSessionId(editId)
      setLoading(true)
      
      // Load existing session data
      const loadExistingSession = async () => {
        try {
          const sessionData = await apiClient.get(`/frameworks/${editId}`)
          
          // Set basic fields
          setTitle(sessionData.title || '')
          setDescription(sessionData.description || '')
          
          // Convert session data to ACH format
          if (sessionData.data) {
            const scaleType = sessionData.data.scaleType || 'logarithmic'
            const scores = new Map<string, Map<string, ACHScore>>()
            
            // Convert evidence scores to nested Map format
            if (sessionData.data.evidence) {
              sessionData.data.evidence.forEach((evidence: any) => {
                if (evidence.hypotheses_scores) {
                  const evidenceScores = new Map<string, ACHScore>()
                  Object.entries(evidence.hypotheses_scores).forEach(([hypId, score]) => {
                    evidenceScores.set(hypId, score as ACHScore)
                  })
                  scores.set(evidence.id, evidenceScores)
                }
              })
            }
            
            setACHData({
              hypotheses: sessionData.data.hypotheses || [],
              evidence: sessionData.data.evidence || [],
              scores,
              scaleType
            })
          }
        } catch (error: any) {
          toast({
            title: 'Error',
            description: error.message || 'Failed to load session for editing',
            variant: 'destructive'
          })
          router.push('/frameworks/ach')
        } finally {
          setLoading(false)
        }
      }
      
      loadExistingSession()
    }
  }, [searchParams, toast, router])

  const addHypothesis = () => {
    const newHypothesis: Hypothesis = {
      id: Date.now().toString(),
      text: ''
    }
    setACHData(prev => ({
      ...prev,
      hypotheses: [...prev.hypotheses, newHypothesis]
    }))
  }

  const updateHypothesis = (id: string, text: string) => {
    setACHData(prev => ({
      ...prev,
      hypotheses: prev.hypotheses.map(h => h.id === id ? { ...h, text } : h)
    }))
  }

  const removeHypothesis = (id: string) => {
    setACHData(prev => {
      const newScores = new Map(prev.scores)
      newScores.forEach(evidenceMap => {
        evidenceMap.delete(id)
      })
      return {
        ...prev,
        hypotheses: prev.hypotheses.filter(h => h.id !== id),
        scores: newScores
      }
    })
  }

  const addEvidence = () => {
    const newEvidence: Evidence = {
      id: Date.now().toString(),
      text: '',
      weight: { credibility: 3, relevance: 3 }
    }
    
    // Initialize scores for this evidence
    const evidenceScores = new Map<string, ACHScore>()
    achData.hypotheses.forEach(h => {
      evidenceScores.set(h.id, {
        hypothesisId: h.id,
        evidenceId: newEvidence.id,
        score: 0,
        weight: newEvidence.weight
      })
    })
    
    setACHData(prev => {
      const newScores = new Map(prev.scores)
      newScores.set(newEvidence.id, evidenceScores)
      return {
        ...prev,
        evidence: [...prev.evidence, newEvidence],
        scores: newScores
      }
    })
  }

  const updateEvidence = (id: string, text: string) => {
    setACHData(prev => ({
      ...prev,
      evidence: prev.evidence.map(e => e.id === id ? { ...e, text } : e)
    }))
  }

  const updateEvidenceEvaluation = (evidenceId: string, evaluation: {
    confidence: number
    level: string
    responses: Record<string, number>
  }) => {
    setACHData(prev => {
      // Update evidence with new credibility score
      const updatedEvidence = prev.evidence.map(e => 
        e.id === evidenceId 
          ? { ...e, confidenceScore: evaluation.confidence, evaluationResponses: evaluation.responses }
          : e
      )
      
      // Update all scores for this evidence to include the new credibility rating
      const newScores = new Map(prev.scores)
      const evidenceScores = newScores.get(evidenceId)
      if (evidenceScores) {
        const updatedEvidenceScores = new Map()
        evidenceScores.forEach((score, hypothesisId) => {
          updatedEvidenceScores.set(hypothesisId, {
            ...score,
            evidenceCredibility: evaluation.confidence
          })
        })
        newScores.set(evidenceId, updatedEvidenceScores)
      }
      
      return {
        ...prev,
        evidence: updatedEvidence,
        scores: newScores
      }
    })
  }

  const removeEvidence = (id: string) => {
    setACHData(prev => {
      const newScores = new Map(prev.scores)
      newScores.delete(id)
      return {
        ...prev,
        evidence: prev.evidence.filter(e => e.id !== id),
        scores: newScores
      }
    })
  }

  const updateScore = (score: ACHScore) => {
    setACHData(prev => {
      const newScores = new Map(prev.scores)
      let evidenceScores = newScores.get(score.evidenceId)
      if (!evidenceScores) {
        evidenceScores = new Map()
        newScores.set(score.evidenceId, evidenceScores)
      }
      
      // Include evidence credibility from SATS evaluation if available
      const evidence = prev.evidence.find(e => e.id === score.evidenceId)
      const enhancedScore: ACHScore = {
        ...score,
        evidenceCredibility: evidence?.confidenceScore
      }
      
      evidenceScores.set(score.hypothesisId, enhancedScore)
      return {
        ...prev,
        scores: newScores
      }
    })
  }

  const updateScaleType = (scaleType: ScaleType) => {
    // Convert existing scores to new scale
    setACHData(prev => {
      const newScores = new Map<string, Map<string, ACHScore>>()
      
      prev.scores.forEach((evidenceMap, evidenceId) => {
        const newEvidenceMap = new Map<string, ACHScore>()
        evidenceMap.forEach((score, hypothesisId) => {
          // Maintain relative proportions when converting scales
          const oldMax = prev.scaleType === 'logarithmic' ? 13 : 5
          const newMax = scaleType === 'logarithmic' ? 13 : 5
          const convertedScore = Math.round((score.score / oldMax) * newMax)
          
          newEvidenceMap.set(hypothesisId, {
            ...score,
            score: convertedScore
          })
        })
        newScores.set(evidenceId, newEvidenceMap)
      })
      
      return {
        ...prev,
        scores: newScores,
        scaleType
      }
    })
  }

  const getHypothesisAnalysis = () => {
    return analyzeHypotheses(achData.hypotheses, achData.scores, achData.scaleType)
  }

  // Prepare export data
  const prepareExportData = (): ACHExportData => {
    return {
      title: title || 'ACH Analysis',
      description: description || undefined,
      hypotheses: achData.hypotheses,
      evidence: achData.evidence,
      scores: achData.scores,
      scaleType: achData.scaleType,
      analysis: getHypothesisAnalysis(),
      createdAt: new Date(),
      analyst: 'Research Tools Platform User', // Could be made configurable
      organization: undefined // Could be made configurable
    }
  }

  const performAnalysis = () => {
    if (achData.hypotheses.length === 0) {
      toast({
        title: 'No Hypotheses',
        description: 'Add hypotheses first to analyze',
        variant: 'destructive'
      })
      return
    }
    
    if (achData.evidence.length === 0) {
      toast({
        title: 'No Evidence',
        description: 'Add evidence to evaluate hypotheses',
        variant: 'destructive'
      })
      return
    }
    
    const analysis = getHypothesisAnalysis()
    const best = analysis[0]
    
    if (best) {
      toast({
        title: 'Analysis Complete',
        description: `Top hypothesis has score of ${best.weightedScore.toFixed(2)} with ${best.confidenceLevel} confidence`
      })
    }
  }

  const handleSave = async () => {
    if (!title) {
      toast({
        title: 'Missing Title',
        description: 'Please provide a title for your analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      // Convert enhanced data to legacy format for saving
      const legacyData = {
        hypotheses: achData.hypotheses,
        evidence: achData.evidence.map(e => {
          const hypothesesScores: any = {}
          achData.hypotheses.forEach(h => {
            const score = achData.scores.get(e.id)?.get(h.id)
            if (score) {
              // Convert to legacy categories
              if (score.score > 3) hypothesesScores[h.id] = 'supports'
              else if (score.score < -3) hypothesesScores[h.id] = 'contradicts'
              else if (score.score === 0) hypothesesScores[h.id] = 'neutral'
              else hypothesesScores[h.id] = 'neutral'
            }
          })
          return {
            id: e.id,
            text: e.text,
            hypotheses_scores: hypothesesScores
          }
        })
      }

      let response
      if (isEditMode && editSessionId) {
        // Update existing session
        response = await apiClient.put(`/frameworks/${editSessionId}`, {
          title,
          description,
          framework_type: 'ach',
          data: {
            ...legacyData,
            scaleType: achData.scaleType // Preserve scale type in updated data
          }
        })
        
        toast({
          title: 'Success',
          description: 'ACH analysis updated successfully'
        })
        
        router.push(`/frameworks/ach/${editSessionId}`)
      } else {
        // Create new session
        response = await apiClient.post('/frameworks/', {
          title,
          description,
          framework_type: 'ach',
          data: {
            ...legacyData,
            scaleType: achData.scaleType // Include scale type in new data
          }
        })

        toast({
          title: 'Success',
          description: 'ACH analysis saved successfully'
        })
        
        router.push(`/frameworks/ach/${response.id}`)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditMode ? 'Edit ACH Analysis' : 'Create ACH Analysis'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Analysis of Competing Hypotheses for structured analytical thinking
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowSnippet(!showSnippet)}
          >
            <Info className="h-4 w-4 mr-2" />
            {showSnippet ? 'Hide' : 'Show'} Guide
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving 
              ? (isEditMode ? 'Updating...' : 'Saving...') 
              : (isEditMode ? 'Update Analysis' : 'Save Analysis')
            }
          </Button>
        </div>
      </div>

      {/* Technique Snippet */}
      {showSnippet && (
        <div className="relative">
          <TechniqueSnippet technique="ach" expanded={true} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSnippet(false)}
            className="absolute top-2 right-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Basic Information */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Attribution Analysis: Who was responsible?"
              className="mt-1 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the analytical question and scope..."
              className="mt-1 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scale Selection */}
      <ACHScaleSelection 
        currentScale={achData.scaleType}
        onScaleChange={updateScaleType}
      />

      {/* Hypotheses */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Competing Hypotheses
            </div>
            <Button onClick={addHypothesis} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Hypothesis
            </Button>
          </CardTitle>
          <CardDescription className="dark:text-slate-400">
            Define alternative explanations or scenarios to be analyzed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {achData.hypotheses.map((hypothesis, index) => (
            <div key={hypothesis.id} className="flex gap-3 items-start">
              <Badge variant="outline" className="mt-2 min-w-[50px] dark:text-slate-200">
                H{index + 1}
              </Badge>
              <Textarea
                value={hypothesis.text}
                onChange={(e) => updateHypothesis(hypothesis.id, e.target.value)}
                placeholder={`Hypothesis ${index + 1}: e.g., State actor conducted the attack...`}
                className="flex-1 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                rows={2}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeHypothesis(hypothesis.id)}
                className="text-gray-500 hover:text-red-600 mt-2 dark:text-gray-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {achData.hypotheses.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No hypotheses added yet</p>
              <p className="text-sm text-gray-400">Add at least 2 competing hypotheses to begin analysis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence & Scoring */}
      <Card className="dark:bg-slate-900 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Evidence & Evaluation
              {achData.evidence.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                  className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {evidenceExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              )}
            </div>
            <Button 
              onClick={addEvidence} 
              size="sm"
              disabled={achData.hypotheses.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Evidence
            </Button>
          </CardTitle>
          <CardDescription className="dark:text-slate-400">
            Add evidence and evaluate how it relates to each hypothesis
          </CardDescription>
        </CardHeader>
        {evidenceExpanded && (
          <CardContent className="space-y-6">
          {achData.evidence.map((evidence, evidenceIndex) => (
            <div key={evidence.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <div className="space-y-4">
                {/* Evidence Text */}
                <div className="flex gap-3 items-start">
                  <Badge variant="outline" className="mt-2 min-w-[50px] dark:text-slate-200">
                    E{evidenceIndex + 1}
                  </Badge>
                  <Textarea
                    value={evidence.text}
                    onChange={(e) => updateEvidence(evidence.id, e.target.value)}
                    placeholder={`Evidence ${evidenceIndex + 1}: e.g., Technical analysis shows...`}
                    className="flex-1 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEvidence(evidence.id)}
                    className="text-gray-500 hover:text-red-600 mt-2 dark:text-gray-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Evidence Evaluation Button */}
                <div className="ml-14">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedEvidenceForEval(
                      selectedEvidenceForEval === evidence.id ? null : evidence.id
                    )}
                    className="mb-3"
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    {selectedEvidenceForEval === evidence.id ? 'Hide' : 'Evaluate'} Evidence Quality
                    {evidence.confidenceScore && (
                      <Badge className="ml-2" variant="secondary">
                        {evidence.confidenceScore}/13
                      </Badge>
                    )}
                  </Button>

                  {/* Evidence Evaluation Panel */}
                  {selectedEvidenceForEval === evidence.id && (
                    <div className="mb-4">
                      <EvidenceEvaluationPanel
                        evidenceId={evidence.id}
                        evidenceText={evidence.text}
                        onEvaluationComplete={(evaluation) => updateEvidenceEvaluation(evidence.id, evaluation)}
                        initialResponses={evidence.evaluationResponses}
                      />
                    </div>
                  )}

                  {/* Hypothesis Scoring */}
                  {achData.hypotheses.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium mb-3">Evaluation against hypotheses:</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {achData.hypotheses.map((hypothesis, hIndex) => {
                          const currentScore = achData.scores.get(evidence.id)?.get(hypothesis.id)
                          return (
                            <div key={hypothesis.id} className="p-3 border rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs dark:text-slate-200">H{hIndex + 1}</Badge>
                                <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                                  {hypothesis.text || `Hypothesis ${hIndex + 1}`}
                                </span>
                              </div>
                              <ACHEnhancedScoring
                                hypothesisId={hypothesis.id}
                                hypothesisText={hypothesis.text}
                                evidenceId={evidence.id}
                                evidenceText={evidence.text}
                                currentScore={currentScore?.score}
                                currentWeight={evidence.weight}
                                evidenceCredibility={evidence.confidenceScore}
                                scaleType={achData.scaleType}
                                onScoreChange={updateScore}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {achData.evidence.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <Scale className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No evidence added yet</p>
              <p className="text-sm text-gray-400">
                {achData.hypotheses.length === 0 
                  ? 'Add hypotheses first, then add evidence to evaluate'
                  : 'Add evidence and evaluate against your hypotheses'
                }
              </p>
            </div>
          )}
        </CardContent>
        )}
        
        {/* Bottom Collapse/Expand Button */}
        {achData.evidence.length > 0 && (
          <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEvidenceExpanded(!evidenceExpanded)}
              className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {evidenceExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse Evidence Section
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Expand Evidence Section ({achData.evidence.length} items)
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Analysis Results */}
      {achData.hypotheses.length > 0 && achData.evidence.length > 0 && (
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Hypothesis Analysis & Ranking
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Weighted analysis with confidence levels and diagnostic values
            </CardDescription>
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
                  const scores = getHypothesisAnalysis()
                  if (scores.length > 0) {
                    const hypothesis = achData.hypotheses.find(h => h.id === scores[0].hypothesisId)
                    toast({
                      title: 'Strongest Hypothesis',
                      description: `"${hypothesis?.text || 'Hypothesis'}" has the highest score (${scores[0].weightedScore.toFixed(2)})`
                    })
                  }
                }}
              >
                <Trophy className="h-4 w-4" />
                Show Best Hypothesis
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getHypothesisAnalysis().map((analysis, index) => {
                const hypothesis = achData.hypotheses.find(h => h.id === analysis.hypothesisId)
                const rank = index + 1
                
                return (
                  <div key={analysis.hypothesisId} className={cn(
                    "p-4 rounded-lg border-2 transition-all",
                    rank === 1 && "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700",
                    rank === 2 && "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700",
                    rank === 3 && "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700",
                    rank > 3 && "border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-600",
                    analysis.rejectionThreshold && "opacity-60 border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700"
                  )}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={cn(
                            "font-bold",
                            rank === 1 && "bg-green-600",
                            rank === 2 && "bg-blue-600",
                            rank === 3 && "bg-yellow-600",
                            rank > 3 && "bg-gray-600"
                          )}>
                            #{rank}
                          </Badge>
                          {rank === 1 && <Trophy className="h-5 w-5 text-yellow-500" />}
                          {analysis.rejectionThreshold && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Below Threshold
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn(
                            analysis.confidenceLevel === 'High' && "border-green-500 text-green-700 dark:text-green-400",
                            analysis.confidenceLevel === 'Medium' && "border-yellow-500 text-yellow-700 dark:text-yellow-400",
                            analysis.confidenceLevel === 'Low' && "border-red-500 text-red-700 dark:text-red-400"
                          )}>
                            {analysis.confidenceLevel} Confidence
                          </Badge>
                        </div>
                        <p className="font-medium mb-2 dark:text-slate-200">
                          {hypothesis?.text || `Hypothesis ${rank}`}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <div className={cn(
                          "text-2xl font-bold",
                          analysis.weightedScore > 0 && "text-green-600 dark:text-green-400",
                          analysis.weightedScore < 0 && "text-red-600 dark:text-red-400",
                          analysis.weightedScore === 0 && "text-gray-600 dark:text-gray-400"
                        )}>
                          {analysis.weightedScore > 0 && '+'}{analysis.weightedScore.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Weighted Score
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-3" />
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Supporting</span>
                        <div className="font-medium text-green-600 dark:text-green-400">{analysis.supportingEvidence}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Contradicting</span>
                        <div className="font-medium text-red-600 dark:text-red-400">{analysis.contradictingEvidence}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Neutral</span>
                        <div className="font-medium text-gray-600 dark:text-gray-400">{analysis.neutralEvidence}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Diagnostic Value</span>
                        <div className="font-medium text-blue-600 dark:text-blue-400">{analysis.diagnosticValue.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scale Reference */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-slate-200">
            <Info className="h-5 w-5" />
            Current Scale Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Using {achData.scaleType === 'logarithmic' ? 'Logarithmic (Fibonacci)' : 'Linear'} scale
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {(achData.scaleType === 'logarithmic' ? LOGARITHMIC_SCORES : LINEAR_SCORES).map(score => (
                <div key={score.value} className={cn(
                  "p-2 rounded text-xs text-center border",
                  // Color based on score value for better dark mode support
                  score.value > 8 && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200",
                  score.value > 3 && score.value <= 8 && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-600 text-green-700 dark:text-green-300",
                  score.value > 0 && score.value <= 3 && "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-500 text-green-600 dark:text-green-400",
                  score.value === 0 && "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300",
                  score.value < 0 && score.value >= -3 && "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500 text-red-600 dark:text-red-400",
                  score.value < -3 && score.value >= -8 && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-600 text-red-700 dark:text-red-300",
                  score.value < -8 && "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                )}>
                  <div className="font-medium truncate">{score.label}</div>
                  <div className="text-lg font-bold">
                    {score.value > 0 && '+'}{score.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      {(achData.hypotheses.length > 0 && achData.evidence.length > 0) && (
        <ACHExport 
          data={prepareExportData()}
          className="mt-8"
        />
      )}
    </div>
  )
}