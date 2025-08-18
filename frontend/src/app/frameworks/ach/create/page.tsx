/**
 * Public ACH Create Page with Auto-Save
 * 
 * Full ACH implementation with auto-save functionality
 */

'use client'

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
import { useFrameworkSession } from '@/hooks/use-framework-session'
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
import { MigrationPrompt } from '@/components/auto-save/migration-prompt'
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

const SCORING_SCALE = [
  { value: -3, label: 'Strongly Contradicts', color: 'bg-red-500' },
  { value: -2, label: 'Contradicts', color: 'bg-red-400' },
  { value: -1, label: 'Slightly Contradicts', color: 'bg-red-300' },
  { value: 0, label: 'Neutral/No Impact', color: 'bg-gray-400' },
  { value: 1, label: 'Slightly Supports', color: 'bg-green-300' },
  { value: 2, label: 'Supports', color: 'bg-green-400' },
  { value: 3, label: 'Strongly Supports', color: 'bg-green-500' }
]

export default function PublicACHCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  // Use the universal framework session hook
  const {
    sessionId,
    data,
    title,
    isLoading,
    saveStatus,
    updateData,
    setTitle,
    hasData
  } = useFrameworkSession<ACHData>('ach', {
    hypotheses: [],
    evidence: [],
    scores: [],
    scaleType: 'linear'
  }, {
    title: 'ACH Analysis',
    loadFromUrl: true,
    autoSaveEnabled: true
  })
  
  const [saving, setSaving] = useState(false)
  const [evidenceExpanded, setEvidenceExpanded] = useState(true)
  const [analysisExpanded, setAnalysisExpanded] = useState(false)
  
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
    
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    
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
      
      router.push(`/dashboard/analysis-frameworks/ach-dashboard/${response.id}`)
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
        {/* Migration prompt for authenticated users */}
        <MigrationPrompt compact />
        
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
                        <div className="grid grid-cols-2 gap-4">
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
                            const scaleItem = SCORING_SCALE.find(s => s.value === score)
                            
                            return (
                              <td key={hypothesis.id} className="p-3 text-center">
                                <div className="space-y-2">
                                  <select
                                    value={score}
                                    onChange={(e) => updateScore(hypothesis.id, evidence.id, parseInt(e.target.value))}
                                    className="w-full text-xs p-2 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                  >
                                    {SCORING_SCALE.map((item) => (
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