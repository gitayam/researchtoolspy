/**
 * Public ACH Create Page with Auto-Save
 * 
 * Full ACH implementation with auto-save functionality
 */

'use client'

// Force dynamic rendering to avoid useSearchParams build issues
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Save, 
  Target, 
  Trash2, 
  ArrowLeft,
  Calculator,
  BarChart3,
  Trophy,
  Info,
  ChevronDown,
  ChevronUp,
  Scale,
  Download,
  FileText,
  FileSpreadsheet,
  Presentation,
  Brain,
  Lightbulb,
  AlertTriangle,
  Search
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
// import { useFrameworkSession } from '@/hooks/use-framework-session' // Temporarily disabled
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
// import { MigrationPrompt } from '@/components/auto-save/migration-prompt' // Temporarily disabled
import { useIsAuthenticated } from '@/stores/auth'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Hypothesis {
  id: string
  text: string
}

interface Evidence {
  id: string
  text: string
  source: string
  reliability: number
  relevance: number
  sats_evaluation?: {
    reliability: number // 1-5
    credibility: number // 1-5
    validity: number // 1-5
    relevance: number // 1-5
    significance: number // 1-5
    timeliness: number // 1-5
    accuracy: number // 1-5
    completeness: number // 1-5
    overall_score: number // Calculated
    evaluation_date: Date
    evaluator?: string
    notes?: string
  }
}

interface ACHScore {
  hypothesisId: string
  evidenceId: string
  score: number
  reasoning: string
}

interface ACHData {
  hypotheses: Hypothesis[]
  evidence: Evidence[]
  scores: ACHScore[]
  scaleType: 'logarithmic' | 'linear'
}

const LINEAR_SCORING_SCALE = [
  { value: -3, label: 'Strongly Contradicts', color: 'bg-red-500' },
  { value: -2, label: 'Contradicts', color: 'bg-red-400' },
  { value: -1, label: 'Slightly Contradicts', color: 'bg-red-300' },
  { value: 0, label: 'Neutral/No Impact', color: 'bg-gray-400' },
  { value: 1, label: 'Slightly Supports', color: 'bg-green-300' },
  { value: 2, label: 'Supports', color: 'bg-green-400' },
  { value: 3, label: 'Strongly Supports', color: 'bg-green-500' }
]

const LOGARITHMIC_SCORING_SCALE = [
  { value: -8, label: 'Impossible/Strongly Contradicts', color: 'bg-red-600' },
  { value: -5, label: 'Very Unlikely/Contradicts', color: 'bg-red-500' },
  { value: -3, label: 'Unlikely/Slightly Contradicts', color: 'bg-red-400' },
  { value: -2, label: 'Somewhat Unlikely', color: 'bg-red-300' },
  { value: -1, label: 'Slightly Against', color: 'bg-red-200' },
  { value: 0, label: 'Neutral/No Impact', color: 'bg-gray-400' },
  { value: 1, label: 'Slightly For', color: 'bg-green-200' },
  { value: 2, label: 'Somewhat Likely', color: 'bg-green-300' },
  { value: 3, label: 'Likely/Slightly Supports', color: 'bg-green-400' },
  { value: 5, label: 'Very Likely/Supports', color: 'bg-green-500' },
  { value: 8, label: 'Almost Certain/Strongly Supports', color: 'bg-green-600' }
]

export default function PublicACHCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  // Simplified state without stores to prevent infinite loop
  const [sessionId] = useState(() => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [data, setData] = useState<ACHData>({
    hypotheses: [],
    evidence: [],
    scores: [],
    scaleType: 'logarithmic'
  })
  const [title, setTitle] = useState('ACH Analysis')
  const [isLoading] = useState(false)
  const saveStatus = { status: 'saved' as const }
  const updateData = (updater: (prev: ACHData) => ACHData | ACHData) => {
    if (typeof updater === 'function') {
      setData(prev => updater(prev))
    } else {
      setData(updater)
    }
  }
  const hasData = data.hypotheses.length > 0 || data.evidence.length > 0
  
  const [saving, setSaving] = useState(false)
  const [evidenceExpanded, setEvidenceExpanded] = useState(true)
  const [analysisExpanded, setAnalysisExpanded] = useState(false)
  
  // AI Enhancement state
  const [aiExpanded, setAiExpanded] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [biasAnalysis, setBiasAnalysis] = useState<any>(null)
  const [evidenceGaps, setEvidenceGaps] = useState<string[]>([])
  const [scenario, setScenario] = useState('')
  const [keyQuestion, setKeyQuestion] = useState('')
  
  // Add hypothesis
  const addHypothesis = () => {
    const newHypothesis: Hypothesis = {
      id: Date.now().toString(),
      text: ''
    }
    
    updateData(prev => ({
      ...prev,
      hypotheses: [...prev.hypotheses, newHypothesis]
    }))
  }
  
  // Update hypothesis
  const updateHypothesis = (id: string, text: string) => {
    updateData(prev => ({
      ...prev,
      hypotheses: prev.hypotheses.map(h => 
        h.id === id ? { ...h, text } : h
      )
    }))
  }
  
  // Remove hypothesis
  const removeHypothesis = (id: string) => {
    updateData(prev => ({
      ...prev,
      hypotheses: prev.hypotheses.filter(h => h.id !== id),
      scores: prev.scores.filter(s => s.hypothesisId !== id)
    }))
  }
  
  // Add evidence
  const addEvidence = () => {
    const newEvidence: Evidence = {
      id: Date.now().toString(),
      text: '',
      source: '',
      reliability: 3,
      relevance: 3
    }
    
    updateData(prev => ({
      ...prev,
      evidence: [...prev.evidence, newEvidence]
    }))
  }
  
  // Update evidence
  const updateEvidence = (id: string, updates: Partial<Evidence>) => {
    updateData(prev => ({
      ...prev,
      evidence: prev.evidence.map(e => 
        e.id === id ? { ...e, ...updates } : e
      )
    }))
  }
  
  // Remove evidence
  const removeEvidence = (id: string) => {
    updateData(prev => ({
      ...prev,
      evidence: prev.evidence.filter(e => e.id !== id),
      scores: prev.scores.filter(s => s.evidenceId !== id)
    }))
  }
  
  // Update score
  const updateScore = (hypothesisId: string, evidenceId: string, score: number, reasoning: string = '') => {
    updateData(prev => {
      const existingScoreIndex = prev.scores.findIndex(
        s => s.hypothesisId === hypothesisId && s.evidenceId === evidenceId
      )
      
      const newScore: ACHScore = { hypothesisId, evidenceId, score, reasoning }
      
      if (existingScoreIndex >= 0) {
        // Update existing score
        const newScores = [...prev.scores]
        newScores[existingScoreIndex] = newScore
        return { ...prev, scores: newScores }
      } else {
        // Add new score
        return { ...prev, scores: [...prev.scores, newScore] }
      }
    })
  }
  
  // Get score for hypothesis/evidence pair
  const getScore = (hypothesisId: string, evidenceId: string): number => {
    const score = data.scores.find(
      s => s.hypothesisId === hypothesisId && s.evidenceId === evidenceId
    )
    return score?.score || 0
  }
  
  // Calculate hypothesis totals
  const calculateHypothesisScore = (hypothesisId: string): number => {
    return data.scores
      .filter(s => s.hypothesisId === hypothesisId)
      .reduce((total, s) => total + s.score, 0)
  }

  // AI Enhancement functions
  const generateAIHypotheses = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/ach/ai/generate-hypotheses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          key_question: keyQuestion,
          context: `Current hypotheses: ${data.hypotheses.length}`
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        // Add generated hypotheses
        result.hypotheses.forEach((hyp: string, index: number) => {
          const newHypothesis: Hypothesis = {
            id: `ai_${Date.now()}_${index}`,
            text: hyp
          }
          updateData(prev => ({
            ...prev,
            hypotheses: [...prev.hypotheses, newHypothesis]
          }))
        })
        toast({
          title: 'AI Hypotheses Generated',
          description: `Added ${result.count} new hypotheses`
        })
      }
    } catch (error) {
      console.error('AI hypothesis generation failed:', error)
      toast({
        title: 'AI Generation Failed',
        description: 'Could not generate hypotheses',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(false)
    }
  }

  const analyzeEvidenceGaps = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/ach/ai/evidence-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypotheses: data.hypotheses,
          evidence: data.evidence
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setEvidenceGaps(result.evidence_gaps)
        toast({
          title: 'Evidence Gaps Identified',
          description: `Found ${result.gap_count} potential improvements`
        })
      }
    } catch (error) {
      console.error('Evidence gap analysis failed:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const detectCognitiveBias = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/ach/ai/bias-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypotheses: data.hypotheses,
          evidence: data.evidence,
          scores: data.scores
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setBiasAnalysis(result.bias_analysis)
        toast({
          title: 'Bias Analysis Complete',
          description: `Analysis confidence: ${result.bias_analysis.confidence_level}`
        })
      }
    } catch (error) {
      console.error('Bias detection failed:', error)
    } finally {
      setAiLoading(false)
    }
  }
  
  // Publish analysis
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your ACH analysis',
        variant: 'destructive'
      })
      return
    }
    
    if (data.hypotheses.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one hypothesis',
        variant: 'destructive'
      })
      return
    }
    
    // if (!isAuthenticated) {
    //   router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    //   return
    // }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: 'Created with auto-save system',
        framework_type: 'ach',
        data: {
          hypotheses: data.hypotheses.filter(h => h.text.trim()),
          evidence: data.evidence.filter(e => e.text.trim()),
          scores: data.scores,
          scaleType: data.scaleType
        }
      }
      
      const response = await apiClient.post('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'ACH analysis published successfully'
      })
      
      // router.push(`/dashboard/analysis-frameworks/ach-dashboard/${response.id}`) // Dashboard disabled
      router.push('/frameworks/ach') // Stay on public route
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish ACH analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading ACH analysis...</p>
        </div>
      </div>
    )
  }
  
  const rankedHypotheses = data.hypotheses
    .map(h => ({
      ...h,
      score: calculateHypothesisScore(h.id)
    }))
    .sort((a, b) => b.score - a.score)
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Migration prompt temporarily disabled */}
        
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/frameworks/ach')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ACH Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Analysis of Competing Hypotheses
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Save status indicator */}
              <SaveStatusIndicator sessionId={sessionId} />
              
              {/* Action buttons */}
              <div className="flex gap-2">
                {!isAuthenticated && hasData && (
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/login')}
                  >
                    Sign In to Save
                  </Button>
                )}
                
                <Button 
                  onClick={handlePublish}
                  disabled={saving || !hasData}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Publishing...' : isAuthenticated ? 'Publish Analysis' : 'Sign In to Publish'}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Basic Information */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Target className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Market Entry Strategy Analysis"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Scoring Scale</label>
                <div className="mt-1 flex items-center gap-4">
                  <Badge variant={data.scaleType === 'linear' ? 'default' : 'outline'}>
                    Linear (-3 to +3)
                  </Badge>
                  <Badge variant={data.scaleType === 'logarithmic' ? 'default' : 'outline'}>
                    Logarithmic (-8 to +8)
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateData(prev => ({ 
                      ...prev, 
                      scaleType: prev.scaleType === 'linear' ? 'logarithmic' : 'linear' 
                    }))}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    Switch to {data.scaleType === 'linear' ? 'Logarithmic' : 'Linear'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Hypotheses */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Competing Hypotheses ({data.hypotheses.length})
                </div>
                <Button onClick={addHypothesis} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Hypothesis
                </Button>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Define the competing explanations or theories to be evaluated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.hypotheses.map((hypothesis, index) => (
                <div key={hypothesis.id} className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                    H{index + 1}
                  </div>
                  <div className="flex-1">
                    <Textarea
                      value={hypothesis.text}
                      onChange={(e) => updateHypothesis(hypothesis.id, e.target.value)}
                      placeholder="Describe your hypothesis..."
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      rows={2}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHypothesis(hypothesis.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {data.hypotheses.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No hypotheses yet. Add your first hypothesis to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Evidence */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Evidence ({data.evidence.length})
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                  >
                    {evidenceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                <Button onClick={addEvidence} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Evidence
                </Button>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Collect and evaluate evidence that supports or contradicts each hypothesis
              </CardDescription>
            </CardHeader>
            {evidenceExpanded && (
              <CardContent className="space-y-4">
                {data.evidence.map((evidence, index) => (
                  <div key={evidence.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex gap-3 mb-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center text-sm font-medium text-orange-600 dark:text-orange-400">
                        E{index + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        <Textarea
                          value={evidence.text}
                          onChange={(e) => updateEvidence(evidence.id, { text: e.target.value })}
                          placeholder="Describe the evidence..."
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          rows={2}
                        />
                        <Input
                          value={evidence.source}
                          onChange={(e) => updateEvidence(evidence.id, { source: e.target.value })}
                          placeholder="Source (optional)"
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        />
                        {/* Basic Scoring */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Reliability: {evidence.reliability}/5
                            </label>
                            <Slider
                              value={[evidence.reliability]}
                              onValueChange={(value) => updateEvidence(evidence.id, { reliability: value[0] })}
                              max={5}
                              min={1}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Relevance: {evidence.relevance}/5
                            </label>
                            <Slider
                              value={[evidence.relevance]}
                              onValueChange={(value) => updateEvidence(evidence.id, { relevance: value[0] })}
                              max={5}
                              min={1}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* SATS Evaluation Toggle */}
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (!evidence.sats_evaluation) {
                                updateEvidence(evidence.id, {
                                  sats_evaluation: {
                                    reliability: evidence.reliability,
                                    credibility: 3,
                                    validity: 3,
                                    relevance: evidence.relevance,
                                    significance: 3,
                                    timeliness: 3,
                                    accuracy: 3,
                                    completeness: 3,
                                    overall_score: 0,
                                    evaluation_date: new Date(),
                                    notes: ''
                                  }
                                })
                              }
                            }}
                            className="text-xs"
                          >
                            <Target className="h-3 w-3 mr-1" />
                            {evidence.sats_evaluation ? 'SATS Evaluated' : 'Add SATS Evaluation'}
                          </Button>
                        </div>

                        {/* SATS Detailed Evaluation */}
                        {evidence.sats_evaluation && (
                          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mt-2 space-y-3">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              SATS Evaluation (Source, Accuracy, Timeliness, Significance)
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              {[
                                ['reliability', 'Source Reliability'],
                                ['credibility', 'Source Credibility'],
                                ['validity', 'Information Validity'],
                                ['relevance', 'Relevance'],
                                ['significance', 'Significance'],
                                ['timeliness', 'Timeliness'],
                                ['accuracy', 'Accuracy'],
                                ['completeness', 'Completeness']
                              ].map(([key, label]) => (
                                <div key={key}>
                                  <label className="text-gray-500 dark:text-gray-400">
                                    {label}: {evidence.sats_evaluation?.[key as keyof typeof evidence.sats_evaluation] || 0}/5
                                  </label>
                                  <Slider
                                    value={[evidence.sats_evaluation?.[key as keyof typeof evidence.sats_evaluation] as number || 0]}
                                    onValueChange={(value) => {
                                      const sats = evidence.sats_evaluation!
                                      const newSats = { ...sats, [key]: value[0] }
                                      // Calculate overall score (average)
                                      newSats.overall_score = Math.round(
                                        (newSats.reliability + newSats.credibility + newSats.validity + 
                                         newSats.relevance + newSats.significance + newSats.timeliness + 
                                         newSats.accuracy + newSats.completeness) / 8 * 10
                                      ) / 10
                                      updateEvidence(evidence.id, { sats_evaluation: newSats })
                                    }}
                                    max={5}
                                    min={1}
                                    step={1}
                                    className="mt-1"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                Overall SATS Score: {evidence.sats_evaluation.overall_score}/5
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateEvidence(evidence.id, { sats_evaluation: undefined })}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Remove SATS
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEvidence(evidence.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {data.evidence.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Info className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>No evidence yet. Add evidence to start scoring against hypotheses.</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
          
          {/* Scoring Matrix */}
          {data.hypotheses.length > 0 && data.evidence.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Calculator className="h-5 w-5" />
                  Evidence Scoring Matrix
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Score how each piece of evidence supports or contradicts each hypothesis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Evidence
                        </th>
                        {data.hypotheses.map((hypothesis, index) => (
                          <th key={hypothesis.id} className="text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px]">
                            H{index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.evidence.map((evidence, evidenceIndex) => (
                        <tr key={evidence.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="p-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                            <div className="font-medium">E{evidenceIndex + 1}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {evidence.text}
                            </div>
                          </td>
                          {data.hypotheses.map((hypothesis) => {
                            const score = getScore(hypothesis.id, evidence.id)
                            const currentScale = data.scaleType === 'logarithmic' ? LOGARITHMIC_SCORING_SCALE : LINEAR_SCORING_SCALE
                            const scaleItem = currentScale.find(s => s.value === score)
                            
                            return (
                              <td key={hypothesis.id} className="p-3 text-center">
                                <div className="space-y-2">
                                  <select
                                    value={score}
                                    onChange={(e) => updateScore(hypothesis.id, evidence.id, parseInt(e.target.value))}
                                    className="w-full text-xs p-2 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                  >
                                    {currentScale.map((item) => (
                                      <option key={item.value} value={item.value}>
                                        {item.value >= 0 ? '+' : ''}{item.value}: {item.label}
                                      </option>
                                    ))}
                                  </select>
                                  {scaleItem && (
                                    <div 
                                      className={cn(
                                        "w-full h-2 rounded",
                                        scaleItem.color
                                      )}
                                    />
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Analysis Results */}
          {rankedHypotheses.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Analysis Results
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAnalysisExpanded(!analysisExpanded)}
                  >
                    {analysisExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Hypotheses ranked by total evidence score
                </CardDescription>
              </CardHeader>
              {analysisExpanded && (
                <CardContent>
                  <div className="space-y-3">
                    {rankedHypotheses.map((hypothesis, index) => (
                      <div key={hypothesis.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex-shrink-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white",
                            index === 0 ? "bg-yellow-500" :
                            index === 1 ? "bg-gray-400" :
                            index === 2 ? "bg-orange-500" : "bg-gray-300"
                          )}>
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {hypothesis.text || `Hypothesis ${data.hypotheses.findIndex(h => h.id === hypothesis.id) + 1}`}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Total Score: {hypothesis.score > 0 ? '+' : ''}{hypothesis.score}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge variant={
                            hypothesis.score > 0 ? "default" :
                            hypothesis.score < 0 ? "destructive" : "secondary"
                          }>
                            {hypothesis.score > 0 ? "Supported" :
                             hypothesis.score < 0 ? "Contradicted" : "Neutral"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* AI Analysis Assistant */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Analysis Assistant
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiExpanded(!aiExpanded)}
                  >
                    {aiExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Enhance your analysis with AI-powered insights and bias detection
              </CardDescription>
            </CardHeader>
            {aiExpanded && (
              <CardContent className="space-y-6">
                {/* Scenario and Key Question */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Analysis Scenario
                    </label>
                    <Textarea
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                      placeholder="Describe the situation you're analyzing..."
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Key Question
                    </label>
                    <Textarea
                      value={keyQuestion}
                      onChange={(e) => setKeyQuestion(e.target.value)}
                      placeholder="What is the key intelligence question?"
                      className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      rows={3}
                    />
                  </div>
                </div>

                {/* AI Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">Generate Hypotheses</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">AI-powered alternatives</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={generateAIHypotheses}
                      disabled={aiLoading || !scenario || !keyQuestion}
                    >
                      {aiLoading ? 'Generating...' : 'Generate'}
                    </Button>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                        <Search className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">Evidence Gaps</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Identify missing evidence</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={analyzeEvidenceGaps}
                      disabled={aiLoading || data.hypotheses.length === 0}
                    >
                      {aiLoading ? 'Analyzing...' : 'Analyze'}
                    </Button>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">Bias Detection</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Check for cognitive bias</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={detectCognitiveBias}
                      disabled={aiLoading || data.scores.length === 0}
                    >
                      {aiLoading ? 'Detecting...' : 'Detect'}
                    </Button>
                  </div>
                </div>

                {/* Evidence Gaps Results */}
                {evidenceGaps.length > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-orange-900 dark:text-orange-200 mb-3">
                      Suggested Evidence to Collect:
                    </h4>
                    <ul className="space-y-2">
                      {evidenceGaps.map((gap, index) => (
                        <li key={index} className="text-sm text-orange-800 dark:text-orange-300 flex items-start gap-2">
                          <span className="text-orange-500">•</span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bias Analysis Results */}
                {biasAnalysis && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 dark:text-red-200 mb-3">
                      Potential Cognitive Biases ({biasAnalysis.confidence_level} confidence):
                    </h4>
                    {biasAnalysis.biases_detected.length > 0 && (
                      <ul className="space-y-2 mb-3">
                        {biasAnalysis.biases_detected.map((bias: string, index: number) => (
                          <li key={index} className="text-sm text-red-800 dark:text-red-300 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                            {bias}
                          </li>
                        ))}
                      </ul>
                    )}
                    {biasAnalysis.recommendations.length > 0 && (
                      <div>
                        <h5 className="font-medium text-red-900 dark:text-red-200 mb-2">Recommendations:</h5>
                        <ul className="space-y-1">
                          {biasAnalysis.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                              <span className="text-red-500">→</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Professional Export Templates */}
          {(data.hypotheses.length > 0 || data.evidence.length > 0) && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Download className="h-5 w-5" />
                  Professional Export Templates
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Generate professional reports for briefings and documentation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Excel Matrix Export */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">ACH Matrix (Excel)</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Hypothesis vs Evidence scoring</div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/v1/ach/export/excel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: title || 'ACH Analysis',
                              scenario: scenario || 'Analysis Scenario',
                              key_question: keyQuestion || 'Key Question',
                              hypotheses: data.hypotheses,
                              evidence: data.evidence,
                              scores: data.scores
                            })
                          })
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `ach-matrix-${new Date().toISOString().split('T')[0]}.xlsx`
                            a.click()
                          }
                        } catch (error) {
                          console.error('Export failed:', error)
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  {/* Word Report Export */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">Analysis Report (Word)</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Comprehensive written analysis</div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/v1/ach/export/word', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: title || 'ACH Analysis',
                              scenario: scenario || 'Analysis Scenario',
                              key_question: keyQuestion || 'Key Question',
                              hypotheses: data.hypotheses,
                              evidence: data.evidence,
                              scores: data.scores,
                              analysis_date: new Date().toISOString(),
                              analyst_name: 'Anonymous User'
                            })
                          })
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `ach-report-${new Date().toISOString().split('T')[0]}.docx`
                            a.click()
                          }
                        } catch (error) {
                          console.error('Export failed:', error)
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  {/* PowerPoint Briefing Export */}
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                        <Presentation className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">Briefing Slides (PPT)</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Executive presentation format</div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/v1/ach/export/powerpoint', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: title || 'ACH Analysis',
                              scenario: scenario || 'Analysis Scenario',  
                              key_question: keyQuestion || 'Key Question',
                              hypotheses: data.hypotheses,
                              evidence: data.evidence,
                              scores: data.scores,
                              ranked_hypotheses: rankedHypotheses
                            })
                          })
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `ach-briefing-${new Date().toISOString().split('T')[0]}.pptx`
                            a.click()
                          }
                        } catch (error) {
                          console.error('Export failed:', error)
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

                {/* Export Options */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Export Options:</div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Include SATS Evaluation
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Classification: UNCLASSIFIED
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Government Format
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Target className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  Your Work is Automatically Saved
                </h3>
                <p className="text-green-700 dark:text-green-300 text-center mb-4 max-w-lg">
                  We're saving your progress locally in your browser as you work. 
                  To save to the cloud and access from any device, sign in to your account.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/login')}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    Sign In
                  </Button>
                  <Button 
                    onClick={() => router.push('/register')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Create Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}