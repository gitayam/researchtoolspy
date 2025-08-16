'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Search, X, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface Hypothesis {
  id: string
  text: string
}

interface Evidence {
  id: string
  text: string
  hypotheses_scores: { [hypothesisId: string]: 'supports' | 'contradicts' | 'neutral' | 'not_applicable' }
}

interface ACHData {
  hypotheses: Hypothesis[]
  evidence: Evidence[]
}

export default function CreateACHPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [achData, setACHData] = useState<ACHData>({
    hypotheses: [],
    evidence: []
  })

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
    setACHData(prev => ({
      ...prev,
      hypotheses: prev.hypotheses.filter(h => h.id !== id),
      evidence: prev.evidence.map(e => ({
        ...e,
        hypotheses_scores: Object.fromEntries(
          Object.entries(e.hypotheses_scores).filter(([hId]) => hId !== id)
        )
      }))
    }))
  }

  const addEvidence = () => {
    const newEvidence: Evidence = {
      id: Date.now().toString(),
      text: '',
      hypotheses_scores: Object.fromEntries(
        achData.hypotheses.map(h => [h.id, 'neutral' as const])
      )
    }
    setACHData(prev => ({
      ...prev,
      evidence: [...prev.evidence, newEvidence]
    }))
  }

  const updateEvidence = (id: string, text: string) => {
    setACHData(prev => ({
      ...prev,
      evidence: prev.evidence.map(e => e.id === id ? { ...e, text } : e)
    }))
  }

  const updateEvidenceScore = (evidenceId: string, hypothesisId: string, score: 'supports' | 'contradicts' | 'neutral' | 'not_applicable') => {
    setACHData(prev => ({
      ...prev,
      evidence: prev.evidence.map(e => 
        e.id === evidenceId 
          ? { 
              ...e, 
              hypotheses_scores: { ...e.hypotheses_scores, [hypothesisId]: score }
            }
          : e
      )
    }))
  }

  const removeEvidence = (id: string) => {
    setACHData(prev => ({
      ...prev,
      evidence: prev.evidence.filter(e => e.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your ACH analysis',
        variant: 'destructive'
      })
      return
    }

    if (achData.hypotheses.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least 2 hypotheses for analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'ach',
        data: {
          hypotheses: achData.hypotheses.filter(h => h.text.trim()),
          evidence: achData.evidence.filter(e => e.text.trim())
        },
        status: 'draft'
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions/', payload)
      
      toast({
        title: 'Success',
        description: 'ACH analysis saved successfully'
      })

      router.push(`/frameworks/ach/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save ACH analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
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
        return 'bg-green-100 text-green-800 border-green-200'
      case 'contradicts':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'neutral':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'not_applicable':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ACH Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Analysis of Competing Hypotheses for structured analytical thinking
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
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
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the analytical question and scope..."
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Hypotheses */}
      <Card>
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
          <CardDescription>
            Define alternative explanations or scenarios to be analyzed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {achData.hypotheses.map((hypothesis, index) => (
            <div key={hypothesis.id} className="flex gap-3 items-start">
              <Badge variant="outline" className="mt-2 min-w-[50px]">
                H{index + 1}
              </Badge>
              <Textarea
                value={hypothesis.text}
                onChange={(e) => updateHypothesis(hypothesis.id, e.target.value)}
                placeholder={`Hypothesis ${index + 1}: e.g., State actor conducted the attack...`}
                className="flex-1"
                rows={2}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeHypothesis(hypothesis.id)}
                className="text-gray-500 hover:text-red-600 mt-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {achData.hypotheses.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No hypotheses added yet</p>
              <p className="text-sm text-gray-400">Add at least 2 competing hypotheses to begin analysis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Evidence & Evaluation
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
          <CardDescription>
            Add evidence and evaluate how it relates to each hypothesis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {achData.evidence.map((evidence, evidenceIndex) => (
            <div key={evidence.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex gap-3 items-start mb-4">
                <Badge variant="outline" className="mt-2 min-w-[50px]">
                  E{evidenceIndex + 1}
                </Badge>
                <Textarea
                  value={evidence.text}
                  onChange={(e) => updateEvidence(evidence.id, e.target.value)}
                  placeholder={`Evidence ${evidenceIndex + 1}: e.g., Technical analysis shows...`}
                  className="flex-1"
                  rows={2}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEvidence(evidence.id)}
                  className="text-gray-500 hover:text-red-600 mt-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {achData.hypotheses.length > 0 && (
                <div className="ml-14">
                  <h4 className="text-sm font-medium mb-3">Evaluation against hypotheses:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {achData.hypotheses.map((hypothesis, hIndex) => (
                      <div key={hypothesis.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">H{hIndex + 1}</Badge>
                        <div className="flex gap-1">
                          {['supports', 'neutral', 'contradicts', 'not_applicable'].map((score) => (
                            <Button
                              key={score}
                              variant="outline"
                              size="sm"
                              onClick={() => updateEvidenceScore(evidence.id, hypothesis.id, score as any)}
                              className={`p-1 h-8 w-8 ${
                                evidence.hypotheses_scores[hypothesis.id] === score 
                                  ? getScoreColor(score)
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {getScoreIcon(score)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {achData.evidence.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No evidence added yet</p>
              <p className="text-sm text-gray-400">
                {achData.hypotheses.length === 0 
                  ? 'Add hypotheses first, then add evidence to evaluate'
                  : 'Add evidence and evaluate against your hypotheses'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Evaluation Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Supports</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm">Neutral</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm">Contradicts</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-gray-400" />
              <span className="text-sm">Not Applicable</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}