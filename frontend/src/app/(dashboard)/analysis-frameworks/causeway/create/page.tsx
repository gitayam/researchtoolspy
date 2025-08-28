'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Save,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface RootCause {
  id: string
  cause: string
  category: 'immediate' | 'underlying' | 'root'
  impact: 'high' | 'medium' | 'low'
  likelihood: number // 1-10 scale
  evidence: string[]
  description?: string
}

interface Effect {
  id: string
  effect: string
  severity: 'critical' | 'major' | 'minor'
  timeframe: 'immediate' | 'short-term' | 'long-term'
  description?: string
}

interface MitigationAction {
  id: string
  action: string
  priority: 'high' | 'medium' | 'low'
  timeline: string
  responsible?: string
  resources?: string
}

export default function CausewayCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [rootCauses, setRootCauses] = useState<RootCause[]>([])
  const [effects, setEffects] = useState<Effect[]>([])
  const [mitigationActions, setMitigationActions] = useState<MitigationAction[]>([])

  const categories = [
    { 
      id: 'immediate', 
      name: 'Immediate Causes', 
      icon: CheckCircle, 
      description: 'Direct triggers or immediate factors',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    },
    { 
      id: 'underlying', 
      name: 'Underlying Causes', 
      icon: TrendingUp, 
      description: 'Deeper systematic issues',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    },
    { 
      id: 'root', 
      name: 'Root Causes', 
      icon: AlertTriangle, 
      description: 'Fundamental issues at the core',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    }
  ]

  const addRootCause = () => {
    const newCause: RootCause = {
      id: `cause-${Date.now()}`,
      cause: '',
      category: 'immediate',
      impact: 'medium',
      likelihood: 5,
      evidence: [],
      description: ''
    }
    setRootCauses([...rootCauses, newCause])
  }

  const updateRootCause = (id: string, field: keyof RootCause, value: any) => {
    setRootCauses(rootCauses.map(cause => 
      cause.id === id ? { ...cause, [field]: value } : cause
    ))
  }

  const removeRootCause = (id: string) => {
    setRootCauses(rootCauses.filter(cause => cause.id !== id))
  }

  const addEffect = () => {
    const newEffect: Effect = {
      id: `effect-${Date.now()}`,
      effect: '',
      severity: 'major',
      timeframe: 'short-term',
      description: ''
    }
    setEffects([...effects, newEffect])
  }

  const updateEffect = (id: string, field: keyof Effect, value: any) => {
    setEffects(effects.map(effect => 
      effect.id === id ? { ...effect, [field]: value } : effect
    ))
  }

  const removeEffect = (id: string) => {
    setEffects(effects.filter(effect => effect.id !== id))
  }

  const addMitigationAction = () => {
    const newAction: MitigationAction = {
      id: `action-${Date.now()}`,
      action: '',
      priority: 'medium',
      timeline: '',
      responsible: '',
      resources: ''
    }
    setMitigationActions([...mitigationActions, newAction])
  }

  const updateMitigationAction = (id: string, field: keyof MitigationAction, value: any) => {
    setMitigationActions(mitigationActions.map(action => 
      action.id === id ? { ...action, [field]: value } : action
    ))
  }

  const removeMitigationAction = (id: string) => {
    setMitigationActions(mitigationActions.filter(action => action.id !== id))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your analysis',
        variant: 'destructive'
      })
      return
    }

    if (rootCauses.length === 0) {
      toast({
        title: 'Validation Error', 
        description: 'Please add at least one root cause',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const analysisData = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'causeway',
        status: 'draft',
        data: {
          problemStatement: problemStatement.trim(),
          rootCauses: rootCauses.filter(cause => cause.cause.trim()),
          effects: effects.filter(effect => effect.effect.trim()),
          mitigationActions: mitigationActions.filter(action => action.action.trim())
        }
      }

      const response = await apiClient.post('/frameworks/', analysisData)
      
      toast({
        title: 'Success',
        description: 'Causeway analysis created successfully'
      })
      
      router.push(`/analysis-frameworks/causeway/${response.id}`)
    } catch (error: any) {
      console.error('Failed to create analysis:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create analysis',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(c => c.id === category)
    return categoryData?.icon || GitBranch
  }

  const getCategoryColor = (category: string) => {
    const categoryData = categories.find(c => c.id === category)
    return categoryData?.color || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Create Causeway Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Systematic root cause analysis to identify underlying factors</p>
      </div>

      <div className="space-y-8">
        {/* Basic Information */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Basic Information</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Define the scope and context of your analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">Analysis Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Production Quality Issues Analysis"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the analysis purpose and scope"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label htmlFor="problem" className="text-gray-700 dark:text-gray-300">Problem Statement</Label>
              <Textarea
                id="problem"
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="Clear statement of the problem being analyzed"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
          </CardContent>
        </Card>

        {/* Root Causes Analysis */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-gray-900 dark:text-gray-100">Root Causes</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Identify and categorize potential causes</CardDescription>
              </div>
              <Button onClick={addRootCause} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Cause
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rootCauses.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No root causes added yet. Click "Add Cause" to start.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rootCauses.map((cause) => {
                  const Icon = getCategoryIcon(cause.category)
                  return (
                    <Card key={cause.id} className="border border-gray-200 dark:border-gray-600">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <Badge className={getCategoryColor(cause.category)}>
                              <Icon className="h-3 w-3 mr-1" />
                              {cause.category}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRootCause(cause.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <Input
                            value={cause.cause}
                            onChange={(e) => updateRootCause(cause.id, 'cause', e.target.value)}
                            placeholder="Describe the root cause"
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          />
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300">Category</Label>
                              <Select value={cause.category} onValueChange={(value) => updateRootCause(cause.id, 'category', value)}>
                                <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                                  <SelectItem value="immediate">Immediate</SelectItem>
                                  <SelectItem value="underlying">Underlying</SelectItem>
                                  <SelectItem value="root">Root</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300">Impact</Label>
                              <Select value={cause.impact} onValueChange={(value) => updateRootCause(cause.id, 'impact', value)}>
                                <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-gray-700 dark:text-gray-300">Likelihood: {cause.likelihood}/10</Label>
                              <Slider
                                value={[cause.likelihood]}
                                onValueChange={(value) => updateRootCause(cause.id, 'likelihood', value[0])}
                                max={10}
                                min={1}
                                step={1}
                                className="mt-2"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Effects */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-gray-900 dark:text-gray-100">Effects & Consequences</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Document the impacts and consequences</CardDescription>
              </div>
              <Button onClick={addEffect} variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                <Plus className="h-4 w-4 mr-2" />
                Add Effect
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {effects.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <ArrowRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No effects documented yet. Click "Add Effect" to start.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {effects.map((effect) => (
                  <Card key={effect.id} className="border border-gray-200 dark:border-gray-600">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <Input
                            value={effect.effect}
                            onChange={(e) => updateEffect(effect.id, 'effect', e.target.value)}
                            placeholder="Describe the effect or consequence"
                            className="flex-1 mr-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEffect(effect.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-gray-700 dark:text-gray-300">Severity</Label>
                            <Select value={effect.severity} onValueChange={(value) => updateEffect(effect.id, 'severity', value)}>
                              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="major">Major</SelectItem>
                                <SelectItem value="minor">Minor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-gray-700 dark:text-gray-300">Timeframe</Label>
                            <Select value={effect.timeframe} onValueChange={(value) => updateEffect(effect.id, 'timeframe', value)}>
                              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                                <SelectItem value="immediate">Immediate</SelectItem>
                                <SelectItem value="short-term">Short-term</SelectItem>
                                <SelectItem value="long-term">Long-term</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}