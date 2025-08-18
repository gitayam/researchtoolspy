'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, Plus, X, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface SurveillanceIndicator {
  id: string
  category: string
  indicator: string
  observable: boolean
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly'
  source: string
  threshold: string
  currentStatus: 'normal' | 'elevated' | 'critical'
  notes: string
}

interface CounterSurveillance {
  id: string
  technique: string
  implementation: string
  effectiveness: 'high' | 'medium' | 'low'
  cost: 'high' | 'medium' | 'low'
}

export default function CreateSurveillanceAnalysisPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState('')
  const [objectives, setObjectives] = useState('')
  const [indicators, setIndicators] = useState<SurveillanceIndicator[]>([])
  const [counterMeasures, setCounterMeasures] = useState<CounterSurveillance[]>([])
  const [currentIndicator, setCurrentIndicator] = useState<SurveillanceIndicator>({
    id: '',
    category: '',
    indicator: '',
    observable: true,
    frequency: 'daily',
    source: '',
    threshold: '',
    currentStatus: 'normal',
    notes: ''
  })
  const [currentCounterMeasure, setCurrentCounterMeasure] = useState<CounterSurveillance>({
    id: '',
    technique: '',
    implementation: '',
    effectiveness: 'medium',
    cost: 'medium'
  })

  const indicatorCategories = [
    'Physical Surveillance',
    'Digital Surveillance',
    'Communication Monitoring',
    'Behavioral Patterns',
    'Technical Indicators',
    'Environmental Changes',
    'Network Activity',
    'Access Patterns'
  ]

  const addIndicator = () => {
    if (currentIndicator.category && currentIndicator.indicator) {
      setIndicators([...indicators, { ...currentIndicator, id: Date.now().toString() }])
      setCurrentIndicator({
        id: '',
        category: '',
        indicator: '',
        observable: true,
        frequency: 'daily',
        source: '',
        threshold: '',
        currentStatus: 'normal',
        notes: ''
      })
    }
  }

  const removeIndicator = (id: string) => {
    setIndicators(indicators.filter(i => i.id !== id))
  }

  const addCounterMeasure = () => {
    if (currentCounterMeasure.technique && currentCounterMeasure.implementation) {
      setCounterMeasures([...counterMeasures, { ...currentCounterMeasure, id: Date.now().toString() }])
      setCurrentCounterMeasure({
        id: '',
        technique: '',
        implementation: '',
        effectiveness: 'medium',
        cost: 'medium'
      })
    }
  }

  const removeCounterMeasure = (id: string) => {
    setCounterMeasures(counterMeasures.filter(c => c.id !== id))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'elevated': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEffectivenessColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Save to API
    console.log({ title, description, scope, objectives, indicators, counterMeasures })
    router.push('/frameworks/surveillance')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/frameworks/surveillance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create Surveillance Detection Analysis</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Identify and counter surveillance activities</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Details</CardTitle>
            <CardDescription>Define the scope and objectives of your surveillance analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Corporate Security Surveillance Assessment"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the context and purpose of this surveillance analysis..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scope</label>
              <Textarea 
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Define what is included and excluded from this analysis..."
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Objectives</label>
              <Textarea 
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="What are the key objectives of this surveillance detection effort?"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Surveillance Indicators</CardTitle>
            <CardDescription>Define indicators that may suggest surveillance activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select 
                  value={currentIndicator.category}
                  onValueChange={(value) => setCurrentIndicator({...currentIndicator, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {indicatorCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Indicator</label>
                <Input 
                  value={currentIndicator.indicator}
                  onChange={(e) => setCurrentIndicator({...currentIndicator, indicator: e.target.value})}
                  placeholder="Specific indicator to monitor"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Frequency</label>
                <Select 
                  value={currentIndicator.frequency}
                  onValueChange={(value: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly') => 
                    setCurrentIndicator({...currentIndicator, frequency: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="continuous">Continuous</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Current Status</label>
                <Select 
                  value={currentIndicator.currentStatus}
                  onValueChange={(value: 'normal' | 'elevated' | 'critical') => 
                    setCurrentIndicator({...currentIndicator, currentStatus: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="elevated">Elevated</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  checked={currentIndicator.observable}
                  onCheckedChange={(checked) => 
                    setCurrentIndicator({...currentIndicator, observable: checked as boolean})
                  }
                />
                <label className="text-sm font-medium">Observable</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Source</label>
                <Input 
                  value={currentIndicator.source}
                  onChange={(e) => setCurrentIndicator({...currentIndicator, source: e.target.value})}
                  placeholder="e.g., Security logs, CCTV, Network monitoring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Threshold/Trigger</label>
                <Input 
                  value={currentIndicator.threshold}
                  onChange={(e) => setCurrentIndicator({...currentIndicator, threshold: e.target.value})}
                  placeholder="When does this become concerning?"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea 
                value={currentIndicator.notes}
                onChange={(e) => setCurrentIndicator({...currentIndicator, notes: e.target.value})}
                placeholder="Additional context or observations..."
                rows={2}
              />
            </div>

            <Button 
              type="button" 
              onClick={addIndicator}
              disabled={!currentIndicator.category || !currentIndicator.indicator}
            >
              Add Indicator
            </Button>

            {indicators.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="font-medium">Added Indicators ({indicators.length})</h4>
                {indicators.map((indicator) => (
                  <div key={indicator.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{indicator.indicator}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(indicator.currentStatus)}`}>
                            {indicator.currentStatus}
                          </span>
                          {indicator.observable && (
                            <Eye className="h-3 w-3 text-gray-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {indicator.category} • {indicator.frequency} • Source: {indicator.source}
                        </p>
                        {indicator.threshold && (
                          <p className="text-sm text-gray-500 mt-1">
                            Threshold: {indicator.threshold}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIndicator(indicator.id)}
                        className="text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Counter-Surveillance Measures</CardTitle>
            <CardDescription>Define techniques to detect and counter surveillance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Technique</label>
              <Input 
                value={currentCounterMeasure.technique}
                onChange={(e) => setCurrentCounterMeasure({...currentCounterMeasure, technique: e.target.value})}
                placeholder="e.g., Route variation, TSCM sweep, Communication security"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Implementation</label>
              <Textarea 
                value={currentCounterMeasure.implementation}
                onChange={(e) => setCurrentCounterMeasure({...currentCounterMeasure, implementation: e.target.value})}
                placeholder="How will this measure be implemented?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Effectiveness</label>
                <Select 
                  value={currentCounterMeasure.effectiveness}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setCurrentCounterMeasure({...currentCounterMeasure, effectiveness: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Cost/Effort</label>
                <Select 
                  value={currentCounterMeasure.cost}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setCurrentCounterMeasure({...currentCounterMeasure, cost: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              type="button" 
              onClick={addCounterMeasure}
              disabled={!currentCounterMeasure.technique || !currentCounterMeasure.implementation}
            >
              Add Counter-Measure
            </Button>

            {counterMeasures.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="font-medium">Counter-Surveillance Measures ({counterMeasures.length})</h4>
                {counterMeasures.map((measure) => (
                  <div key={measure.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{measure.technique}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{measure.implementation}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span>
                            Effectiveness: 
                            <span className={`ml-1 font-medium ${getEffectivenessColor(measure.effectiveness)}`}>
                              {measure.effectiveness}
                            </span>
                          </span>
                          <span>
                            Cost: 
                            <span className={`ml-1 font-medium ${getEffectivenessColor(measure.cost)}`}>
                              {measure.cost}
                            </span>
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCounterMeasure(measure.id)}
                        className="text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={!title || indicators.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            Save Analysis
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/frameworks/surveillance')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}