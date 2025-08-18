'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Brain, 
  Plus, 
  Trash2, 
  Save,
  User,
  Settings,
  Target,
  Lightbulb,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface BehaviorFactor {
  id: string
  component: 'capability' | 'opportunity' | 'motivation'
  factor: string
  description: string
  currentLevel: number // 1-10 scale
  desiredLevel: number // 1-10 scale
  impact: 'high' | 'medium' | 'low'
  changeability: 'easy' | 'moderate' | 'difficult'
  interventions: string[]
  barriers?: string
  enablers?: string
  notes?: string
}

export default function BehaviorCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetBehavior, setTargetBehavior] = useState('')
  const [context, setContext] = useState('')
  const [factors, setFactors] = useState<BehaviorFactor[]>([])
  const [activeTab, setActiveTab] = useState('capability')

  const components = [
    { 
      id: 'capability', 
      name: 'Capability', 
      icon: Zap, 
      description: 'Physical and psychological ability to perform the behavior',
      color: 'bg-blue-100 text-blue-800 border-blue-300'
    },
    { 
      id: 'opportunity', 
      name: 'Opportunity', 
      icon: Target, 
      description: 'External factors that enable or prompt the behavior',
      color: 'bg-green-100 text-green-800 border-green-300'
    },
    { 
      id: 'motivation', 
      name: 'Motivation', 
      icon: Lightbulb, 
      description: 'Internal processes that energize and direct behavior',
      color: 'bg-purple-100 text-purple-800 border-purple-300'
    }
  ]

  const addFactor = (component: string) => {
    const newFactor: BehaviorFactor = {
      id: `factor-${Date.now()}`,
      component: component as any,
      factor: '',
      description: '',
      currentLevel: 5,
      desiredLevel: 8,
      impact: 'medium',
      changeability: 'moderate',
      interventions: [],
      barriers: '',
      enablers: '',
      notes: ''
    }
    setFactors([...factors, newFactor])
  }

  const updateFactor = (id: string, field: keyof BehaviorFactor, value: any) => {
    setFactors(factors.map(factor => 
      factor.id === id ? { ...factor, [field]: value } : factor
    ))
  }

  const removeFactor = (id: string) => {
    setFactors(factors.filter(factor => factor.id !== id))
  }

  const getFactorsByComponent = (component: string) => {
    return factors.filter(factor => factor.component === component)
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getChangeabilityIcon = (changeability: string) => {
    switch (changeability) {
      case 'easy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'moderate': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'difficult': return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const handleSave = async (status: 'draft' | 'completed' = 'draft') => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a title for your behavior analysis',
        variant: 'destructive'
      })
      return
    }

    if (!targetBehavior.trim()) {
      toast({
        title: 'Error',
        description: 'Please specify the target behavior',
        variant: 'destructive'
      })
      return
    }

    if (factors.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one behavior factor',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const sessionData = {
        title,
        description,
        framework_type: 'behavior',
        status,
        data: {
          factors,
          targetBehavior,
          context
        }
      }

      const response = await apiClient.post('/frameworks/', sessionData)
      
      toast({
        title: 'Success',
        description: 'Behavior analysis saved successfully'
      })
      
      router.push(`/frameworks/behavior/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save behavior analysis',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateBehaviorScore = () => {
    const totalFactors = factors.length
    if (totalFactors === 0) return { score: 0, gaps: 0 }
    
    const averageGap = factors.reduce((sum, factor) => {
      return sum + (factor.desiredLevel - factor.currentLevel)
    }, 0) / totalFactors
    
    const behaviorScore = Math.max(0, 100 - (averageGap * 10))
    const significantGaps = factors.filter(f => (f.desiredLevel - f.currentLevel) >= 3).length
    
    return { score: Math.round(behaviorScore), gaps: significantGaps }
  }

  const behaviorMetrics = calculateBehaviorScore()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-bold">COM-B Behavior Analysis</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Capability, Opportunity, Motivation framework for understanding and changing behavior
        </p>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior Analysis Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Analysis Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter analysis title..."
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="targetBehavior">Target Behavior</Label>
            <Input
              id="targetBehavior"
              value={targetBehavior}
              onChange={(e) => setTargetBehavior(e.target.value)}
              placeholder="Describe the specific behavior you want to analyze..."
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional context about the analysis..."
              className="mt-1"
              rows={2}
            />
          </div>
          
          <div>
            <Label htmlFor="context">Context & Environment</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe the environment, stakeholders, and circumstances..."
              className="mt-1"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Behavior Analysis Summary */}
      {factors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Behavior Change Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200">
                <div className="text-3xl font-bold text-blue-800 dark:text-blue-300">
                  {behaviorMetrics.score}%
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Behavior Readiness Score</div>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200">
                <div className="text-3xl font-bold text-orange-800 dark:text-orange-300">
                  {behaviorMetrics.gaps}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">Significant Gaps</div>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200">
                <div className="text-3xl font-bold text-green-800 dark:text-green-300">
                  {factors.length}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Factors Analyzed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* COM-B Factor Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>COM-B Factor Analysis</CardTitle>
          <CardDescription>
            Analyze factors affecting behavior across Capability, Opportunity, and Motivation domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-6">
              {components.map(component => {
                const ComponentIcon = component.icon
                const componentFactors = getFactorsByComponent(component.id)
                return (
                  <TabsTrigger key={component.id} value={component.id} className="relative">
                    <ComponentIcon className="h-4 w-4 mr-2" />
                    {component.name}
                    {componentFactors.length > 0 && (
                      <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                        {componentFactors.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {components.map(component => {
              const ComponentIcon = component.icon
              const componentFactors = getFactorsByComponent(component.id)
              
              return (
                <TabsContent key={component.id} value={component.id} className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ComponentIcon className="h-5 w-5 text-emerald-600" />
                      <div>
                        <h3 className="font-semibold">{component.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{component.description}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => addFactor(component.id)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Factor
                    </Button>
                  </div>

                  {componentFactors.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No {component.name.toLowerCase()} factors added yet. Click "Add Factor" to begin.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {componentFactors.map((factor, index) => (
                        <div key={factor.id} className={`border rounded-lg p-4 space-y-4 ${component.color}`}>
                          <div className="flex items-start justify-between">
                            <Badge variant="outline">{component.name[0]}{index + 1}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFactor(factor.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Factor Name</Label>
                              <Input
                                value={factor.factor}
                                onChange={(e) => updateFactor(factor.id, 'factor', e.target.value)}
                                placeholder="Enter factor name..."
                                className="mt-1"
                              />
                            </div>
                            
                            <div>
                              <Label>Impact Level</Label>
                              <Select
                                value={factor.impact}
                                onValueChange={(value) => updateFactor(factor.id, 'impact', value)}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">High Impact</SelectItem>
                                  <SelectItem value="medium">Medium Impact</SelectItem>
                                  <SelectItem value="low">Low Impact</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={factor.description}
                              onChange={(e) => updateFactor(factor.id, 'description', e.target.value)}
                              placeholder="Describe this factor..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Current Level ({factor.currentLevel}/10)</Label>
                              <div className="mt-1 px-3">
                                <Slider
                                  value={[factor.currentLevel]}
                                  onValueChange={(value) => updateFactor(factor.id, 'currentLevel', value[0])}
                                  max={10}
                                  min={1}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <Label>Desired Level ({factor.desiredLevel}/10)</Label>
                              <div className="mt-1 px-3">
                                <Slider
                                  value={[factor.desiredLevel]}
                                  onValueChange={(value) => updateFactor(factor.id, 'desiredLevel', value[0])}
                                  max={10}
                                  min={1}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label>Changeability</Label>
                            <Select
                              value={factor.changeability}
                              onValueChange={(value) => updateFactor(factor.id, 'changeability', value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    Easy to Change
                                  </div>
                                </SelectItem>
                                <SelectItem value="moderate">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    Moderate Effort
                                  </div>
                                </SelectItem>
                                <SelectItem value="difficult">
                                  <div className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    Difficult to Change
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Barriers</Label>
                              <Textarea
                                value={factor.barriers}
                                onChange={(e) => updateFactor(factor.id, 'barriers', e.target.value)}
                                placeholder="What prevents this factor from improving?"
                                className="mt-1"
                                rows={2}
                              />
                            </div>
                            
                            <div>
                              <Label>Enablers</Label>
                              <Textarea
                                value={factor.enablers}
                                onChange={(e) => updateFactor(factor.id, 'enablers', e.target.value)}
                                placeholder="What could help improve this factor?"
                                className="mt-1"
                                rows={2}
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Notes</Label>
                            <Textarea
                              value={factor.notes}
                              onChange={(e) => updateFactor(factor.id, 'notes', e.target.value)}
                              placeholder="Additional observations or considerations..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push('/frameworks')}
        >
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={loading}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave('completed')}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Complete Analysis
          </Button>
        </div>
      </div>
    </div>
  )
}