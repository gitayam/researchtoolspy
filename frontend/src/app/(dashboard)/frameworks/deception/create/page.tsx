'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertTriangle, Eye, Search, Shield, Target, FileText, Brain } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface DeceptionIndicator {
  id: string
  category: 'linguistic' | 'logical' | 'behavioral' | 'contextual'
  indicator: string
  evidence: string
  severity: 'low' | 'medium' | 'high'
  confidence: number
}

interface DeceptionAnalysis {
  content: string
  source: string
  credibilityScore: number
  overallAssessment: 'credible' | 'questionable' | 'likely_deceptive'
  indicators: DeceptionIndicator[]
  recommendations: string[]
}

export default function CreateDeceptionDetectionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [targetContent, setTargetContent] = useState('')
  const [sourceContext, setSourceContext] = useState('')
  const [purpose, setPurpose] = useState('')
  const [analysis, setAnalysis] = useState<DeceptionAnalysis | null>(null)
  const [indicators, setIndicators] = useState<DeceptionIndicator[]>([])
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const addIndicator = () => {
    const newIndicator: DeceptionIndicator = {
      id: Date.now().toString(),
      category: 'linguistic',
      indicator: '',
      evidence: '',
      severity: 'medium',
      confidence: 50
    }
    setIndicators(prev => [...prev, newIndicator])
  }

  const updateIndicator = (id: string, field: keyof DeceptionIndicator, value: any) => {
    setIndicators(prev => prev.map(indicator => 
      indicator.id === id ? { ...indicator, [field]: value } : indicator
    ))
  }

  const removeIndicator = (id: string) => {
    setIndicators(prev => prev.filter(indicator => indicator.id !== id))
  }

  const analyzeDeception = async () => {
    if (!targetContent.trim()) {
      toast({
        title: 'No Content',
        description: 'Please provide content to analyze for deception',
        variant: 'destructive'
      })
      return
    }

    setAnalyzing(true)
    try {
      // Mock analysis for now - will be replaced with AI integration
      const mockAnalysis: DeceptionAnalysis = {
        content: targetContent,
        source: sourceContext || 'Unknown',
        credibilityScore: Math.floor(Math.random() * 100),
        overallAssessment: Math.random() > 0.6 ? 'credible' : Math.random() > 0.3 ? 'questionable' : 'likely_deceptive',
        indicators: [
          {
            id: 'mock1',
            category: 'linguistic',
            indicator: 'Unusual language patterns detected',
            evidence: 'Excessive use of qualifiers and hedging language',
            severity: 'medium',
            confidence: 75
          },
          {
            id: 'mock2',
            category: 'logical',
            indicator: 'Inconsistent timeline references',
            evidence: 'Conflicting dates and sequence of events',
            severity: 'high',
            confidence: 85
          }
        ],
        recommendations: [
          'Cross-reference dates and facts with external sources',
          'Verify claims through independent channels',
          'Consider potential bias or motivation of source'
        ]
      }

      setAnalysis(mockAnalysis)
      setIndicators(mockAnalysis.indicators)

      toast({
        title: 'Analysis Complete',
        description: 'Deception detection analysis has been generated',
      })
    } catch (error: any) {
      toast({
        title: 'Analysis Error',
        description: error.message || 'Failed to analyze content',
        variant: 'destructive'
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your deception detection analysis',
        variant: 'destructive'
      })
      return
    }

    if (!targetContent.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide content to analyze',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        framework_type: 'deception_detection',
        data: {
          target_content: targetContent,
          source_context: sourceContext,
          purpose: purpose,
          analysis: analysis,
          indicators: indicators.filter(i => i.indicator.trim()),
        }
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'Deception detection analysis saved successfully'
      })

      router.push(`/frameworks/deception/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Save Error',
        description: error.message || 'Failed to save deception detection analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'linguistic': return FileText
      case 'logical': return Target
      case 'behavioral': return Eye
      case 'contextual': return Shield
      default: return AlertTriangle
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deception Detection Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Identify potential deception, misinformation, and credibility issues in content
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              <Brain className="h-3 w-3 mr-1" />
              AI-Enhanced (Coming Soon)
            </span>
          </div>
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
            <AlertTriangle className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Analysis Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Social Media Post Credibility Check"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="purpose">Analysis Purpose</Label>
            <Input
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Verify claims in news article, assess testimonial credibility"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Content Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Content to Analyze
          </CardTitle>
          <CardDescription>
            Provide the content you want to analyze for potential deception or credibility issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="target-content">Target Content</Label>
            <Textarea
              id="target-content"
              value={targetContent}
              onChange={(e) => setTargetContent(e.target.value)}
              placeholder="Paste the text, statement, or content you want to analyze..."
              className="mt-1"
              rows={6}
            />
          </div>
          <div>
            <Label htmlFor="source-context">Source Context (Optional)</Label>
            <Textarea
              id="source-context"
              value={sourceContext}
              onChange={(e) => setSourceContext(e.target.value)}
              placeholder="Provide context about the source, timing, or circumstances..."
              className="mt-1"
              rows={3}
            />
          </div>
          <Button 
            onClick={analyzeDeception}
            disabled={analyzing || !targetContent.trim()}
            className="w-full"
            variant="outline"
          >
            <Search className="h-4 w-4 mr-2" />
            {analyzing ? 'Analyzing...' : 'Analyze for Deception'}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{analysis.credibilityScore}%</div>
                <div className="text-sm text-gray-500">Credibility Score</div>
              </div>
              <div className="text-center">
                <Badge variant="outline" className={`${
                  analysis.overallAssessment === 'credible' ? 'border-green-500 text-green-700' :
                  analysis.overallAssessment === 'questionable' ? 'border-yellow-500 text-yellow-700' :
                  'border-red-500 text-red-700'
                }`}>
                  {analysis.overallAssessment.replace('_', ' ').toUpperCase()}
                </Badge>
                <div className="text-sm text-gray-500 mt-1">Overall Assessment</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{indicators.length}</div>
                <div className="text-sm text-gray-500">Indicators Found</div>
              </div>
            </div>

            {analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Recommendations:</h4>
                <ul className="space-y-1">
                  {analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-orange-600 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deception Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Deception Indicators
            </div>
            <Button onClick={addIndicator} size="sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Add Indicator
            </Button>
          </CardTitle>
          <CardDescription>
            Document specific indicators that suggest potential deception or credibility issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {indicators.map((indicator) => {
            const IconComponent = getCategoryIcon(indicator.category)
            return (
              <div key={indicator.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-orange-600" />
                    <select
                      value={indicator.category}
                      onChange={(e) => updateIndicator(indicator.id, 'category', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="linguistic">Linguistic</option>
                      <option value="logical">Logical</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="contextual">Contextual</option>
                    </select>
                    <Badge className={getSeverityColor(indicator.severity)}>
                      {indicator.severity}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeIndicator(indicator.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Indicator Description</Label>
                    <Textarea
                      value={indicator.indicator}
                      onChange={(e) => updateIndicator(indicator.id, 'indicator', e.target.value)}
                      placeholder="Describe the specific indicator..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Supporting Evidence</Label>
                    <Textarea
                      value={indicator.evidence}
                      onChange={(e) => updateIndicator(indicator.id, 'evidence', e.target.value)}
                      placeholder="Provide specific evidence for this indicator..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Severity Level</Label>
                    <select
                      value={indicator.severity}
                      onChange={(e) => updateIndicator(indicator.id, 'severity', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <Label>Confidence Level ({indicator.confidence}%)</Label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={indicator.confidence}
                      onChange={(e) => updateIndicator(indicator.id, 'confidence', parseInt(e.target.value))}
                      className="w-full mt-1"
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {indicators.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No deception indicators added yet</p>
              <p className="text-sm text-gray-400">
                Add indicators to document potential credibility issues
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Framework Guide */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Deception Detection Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Linguistic Indicators:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Unusual language patterns or word choice</li>
                <li>• Excessive qualifiers or hedging language</li>
                <li>• Inconsistent tone or writing style</li>
                <li>• Overly complex or simplified explanations</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Logical Indicators:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Internal contradictions or inconsistencies</li>
                <li>• Missing critical information or context</li>
                <li>• Circular reasoning or logical fallacies</li>
                <li>• Implausible claims or timeline issues</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Behavioral Indicators:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Deflection or topic avoidance</li>
                <li>• Emotional manipulation techniques</li>
                <li>• Credibility appeals without substance</li>
                <li>• Defensive or evasive responses</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Contextual Indicators:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Source credibility and motivation</li>
                <li>• Timing and external circumstances</li>
                <li>• Verification possibilities</li>
                <li>• Consistency with established facts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}