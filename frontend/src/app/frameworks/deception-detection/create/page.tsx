/**
 * Public Deception Detection Create Page
 * 
 * Framework for analyzing potential deception and misinformation
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Save, 
  Shield, 
  Trash2, 
  ArrowLeft,
  Calculator,
  BarChart3,
  AlertTriangle,
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
  Search,
  Eye,
  Target
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
import { useIsAuthenticated } from '@/stores/auth'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface DeceptionIndicator {
  id: string
  category: 'verbal' | 'non-verbal' | 'contextual' | 'digital'
  indicator: string
  description: string
  weight: number
  observed: boolean
  notes: string
}

interface DeceptionData {
  indicators: DeceptionIndicator[]
  subject: string
  context: string
  assessment_date: Date
}

const DECEPTION_CATEGORIES = [
  { value: 'verbal', label: 'Verbal Indicators', color: 'bg-blue-500' },
  { value: 'non-verbal', label: 'Non-Verbal Indicators', color: 'bg-green-500' },
  { value: 'contextual', label: 'Contextual Indicators', color: 'bg-orange-500' },
  { value: 'digital', label: 'Digital/Content Indicators', color: 'bg-purple-500' }
]

const DEFAULT_INDICATORS = [
  // Verbal Indicators
  { category: 'verbal', indicator: 'Inconsistent statements', description: 'Contradictions in verbal accounts' },
  { category: 'verbal', indicator: 'Excessive detail', description: 'Unnecessarily detailed explanations' },
  { category: 'verbal', indicator: 'Qualifying language', description: 'Use of hedging words like "I think", "maybe"' },
  { category: 'verbal', indicator: 'Response latency', description: 'Unusual delays before answering' },
  
  // Non-Verbal Indicators
  { category: 'non-verbal', indicator: 'Micro-expressions', description: 'Brief facial expressions inconsistent with statement' },
  { category: 'non-verbal', indicator: 'Body language changes', description: 'Shifts in posture or movement patterns' },
  { category: 'non-verbal', indicator: 'Eye contact patterns', description: 'Unusual eye contact behavior' },
  { category: 'non-verbal', indicator: 'Voice stress', description: 'Changes in vocal pitch, speed, or volume' },
  
  // Contextual Indicators
  { category: 'contextual', indicator: 'Timeline inconsistencies', description: 'Events that don\'t align chronologically' },
  { category: 'contextual', indicator: 'Motivation analysis', description: 'Clear motive for deception exists' },
  { category: 'contextual', indicator: 'Corroborating evidence', description: 'Lack of supporting evidence for claims' },
  { category: 'contextual', indicator: 'Pattern recognition', description: 'Similar deceptive behavior in past' },
  
  // Digital Indicators
  { category: 'digital', indicator: 'Metadata inconsistencies', description: 'Digital forensics show manipulation' },
  { category: 'digital', indicator: 'Content analysis', description: 'Linguistic patterns suggest deception' },
  { category: 'digital', indicator: 'Source verification', description: 'Unable to verify original source' },
  { category: 'digital', indicator: 'Digital provenance', description: 'Suspicious chain of custody for digital content' }
]

export default function DeceptionDetectionCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  const [sessionId] = useState(() => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [data, setData] = useState<DeceptionData>({
    indicators: DEFAULT_INDICATORS.map((indicator, index) => ({
      id: `default_${index}`,
      ...indicator,
      weight: 3,
      observed: false,
      notes: ''
    })) as DeceptionIndicator[],
    subject: '',
    context: '',
    assessment_date: new Date()
  })
  const [title, setTitle] = useState('Deception Detection Analysis')
  const [saving, setSaving] = useState(false)
  const [indicatorsExpanded, setIndicatorsExpanded] = useState(true)
  const [analysisExpanded, setAnalysisExpanded] = useState(false)
  
  const updateData = (updater: (prev: DeceptionData) => DeceptionData | DeceptionData) => {
    if (typeof updater === 'function') {
      setData(prev => updater(prev))
    } else {
      setData(updater)
    }
  }
  
  const hasData = data.indicators.some(i => i.observed) || data.subject.trim() || data.context.trim()

  // Add custom indicator
  const addCustomIndicator = () => {
    const newIndicator: DeceptionIndicator = {
      id: `custom_${Date.now()}`,
      category: 'contextual',
      indicator: '',
      description: '',
      weight: 3,
      observed: false,
      notes: ''
    }
    
    updateData(prev => ({
      ...prev,
      indicators: [...prev.indicators, newIndicator]
    }))
  }

  // Update indicator
  const updateIndicator = (id: string, updates: Partial<DeceptionIndicator>) => {
    updateData(prev => ({
      ...prev,
      indicators: prev.indicators.map(i => 
        i.id === id ? { ...i, ...updates } : i
      )
    }))
  }

  // Remove indicator
  const removeIndicator = (id: string) => {
    updateData(prev => ({
      ...prev,
      indicators: prev.indicators.filter(i => i.id !== id)
    }))
  }

  // Calculate deception probability
  const calculateDeceptionProbability = (): number => {
    const observedIndicators = data.indicators.filter(i => i.observed)
    if (observedIndicators.length === 0) return 0
    
    const totalWeight = observedIndicators.reduce((sum, i) => sum + i.weight, 0)
    const maxPossibleWeight = data.indicators.reduce((sum, i) => sum + 5, 0) // Max weight is 5
    
    return Math.round((totalWeight / maxPossibleWeight) * 100)
  }

  // Get indicators by category
  const getIndicatorsByCategory = (category: string) => {
    return data.indicators.filter(i => i.category === category)
  }

  // Publish analysis
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your deception detection analysis',
        variant: 'destructive'
      })
      return
    }
    
    if (!data.subject.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please specify the subject of analysis',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: 'Deception Detection Analysis',
        framework_type: 'deception-detection',
        data: {
          indicators: data.indicators,
          subject: data.subject,
          context: data.context,
          assessment_date: data.assessment_date,
          deception_probability: calculateDeceptionProbability()
        }
      }
      
      const response = await apiClient.post('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'Deception detection analysis published successfully'
      })
      
      router.push('/frameworks/deception-detection')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const deceptionProbability = calculateDeceptionProbability()
  const observedIndicators = data.indicators.filter(i => i.observed)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/frameworks/deception-detection')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deception Detection Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Systematic analysis of deception indicators
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <SaveStatusIndicator sessionId={sessionId} />
              
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
                  className="bg-red-600 hover:bg-red-700"
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
                <Shield className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Witness Statement Analysis"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                <Input
                  value={data.subject}
                  onChange={(e) => updateData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., John Doe - Interview Subject"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Context</label>
                <Textarea
                  value={data.context}
                  onChange={(e) => updateData(prev => ({ ...prev, context: e.target.value }))}
                  placeholder="Describe the situation, interview setting, or content being analyzed..."
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Deception Probability */}
          {observedIndicators.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <BarChart3 className="h-5 w-5" />
                  Assessment Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={cn(
                    "text-4xl font-bold mb-2",
                    deceptionProbability >= 70 ? "text-red-600" :
                    deceptionProbability >= 40 ? "text-yellow-600" : "text-green-600"
                  )}>
                    {deceptionProbability}%
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 mb-4">
                    Deception Probability
                  </div>
                  <Badge variant={
                    deceptionProbability >= 70 ? "destructive" :
                    deceptionProbability >= 40 ? "secondary" : "default"
                  }>
                    {deceptionProbability >= 70 ? "High Risk" :
                     deceptionProbability >= 40 ? "Moderate Risk" : "Low Risk"}
                  </Badge>
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Based on {observedIndicators.length} observed indicator{observedIndicators.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Deception Indicators */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Deception Indicators ({data.indicators.length})
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIndicatorsExpanded(!indicatorsExpanded)}
                  >
                    {indicatorsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                <Button onClick={addCustomIndicator} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Indicator
                </Button>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Evaluate various indicators that may suggest deceptive behavior
              </CardDescription>
            </CardHeader>
            {indicatorsExpanded && (
              <CardContent className="space-y-6">
                {DECEPTION_CATEGORIES.map((category) => {
                  const categoryIndicators = getIndicatorsByCategory(category.value)
                  if (categoryIndicators.length === 0) return null
                  
                  return (
                    <div key={category.value}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={cn("w-3 h-3 rounded-full", category.color)} />
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{category.label}</h4>
                        <Badge variant="outline">{categoryIndicators.filter(i => i.observed).length}/{categoryIndicators.length}</Badge>
                      </div>
                      
                      <div className="grid gap-3">
                        {categoryIndicators.map((indicator) => (
                          <div key={indicator.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={indicator.observed}
                                onChange={(e) => updateIndicator(indicator.id, { observed: e.target.checked })}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-3">
                                <div>
                                  <Input
                                    value={indicator.indicator}
                                    onChange={(e) => updateIndicator(indicator.id, { indicator: e.target.value })}
                                    placeholder="Indicator name"
                                    className="font-medium bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                  />
                                  <Textarea
                                    value={indicator.description}
                                    onChange={(e) => updateIndicator(indicator.id, { description: e.target.value })}
                                    placeholder="Description"
                                    className="mt-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                    rows={2}
                                  />
                                </div>
                                
                                <div>
                                  <label className="text-xs text-gray-500 dark:text-gray-400">
                                    Weight: {indicator.weight}/5
                                  </label>
                                  <Slider
                                    value={[indicator.weight]}
                                    onValueChange={(value) => updateIndicator(indicator.id, { weight: value[0] })}
                                    max={5}
                                    min={1}
                                    step={1}
                                    className="mt-1"
                                  />
                                </div>
                                
                                {indicator.observed && (
                                  <Textarea
                                    value={indicator.notes}
                                    onChange={(e) => updateIndicator(indicator.id, { notes: e.target.value })}
                                    placeholder="Notes on this observation..."
                                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                    rows={2}
                                  />
                                )}
                              </div>
                              
                              {!indicator.id.startsWith('default_') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeIndicator(indicator.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            )}
          </Card>
          
          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Shield className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Your Work is Automatically Saved
                </h3>
                <p className="text-red-700 dark:text-red-300 text-center mb-4 max-w-lg">
                  We're saving your progress locally in your browser as you work. 
                  To save to the cloud and access from any device, sign in to your account.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/login')}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Sign In
                  </Button>
                  <Button 
                    onClick={() => router.push('/register')}
                    className="bg-red-600 hover:bg-red-700"
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