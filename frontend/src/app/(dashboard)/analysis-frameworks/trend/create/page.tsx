'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, TrendingUp, Plus, X } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TrendData {
  id: string
  date: string
  value: number
  notes: string
}

interface Trend {
  id: string
  name: string
  category: string
  type: 'linear' | 'exponential' | 'cyclical' | 'step' | 'irregular'
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  strength: 'strong' | 'moderate' | 'weak'
  timeframe: string
  dataPoints: TrendData[]
  drivers: string[]
  implications: string
  uncertainties: string
  indicators: string[]
}

export default function CreateTrendAnalysisPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [trends, setTrends] = useState<Trend[]>([])
  const [currentTrend, setCurrentTrend] = useState<Trend>({
    id: '',
    name: '',
    category: '',
    type: 'linear',
    direction: 'stable',
    strength: 'moderate',
    timeframe: '',
    dataPoints: [],
    drivers: [],
    implications: '',
    uncertainties: '',
    indicators: []
  })
  const [newDataPoint, setNewDataPoint] = useState<TrendData>({
    id: '',
    date: '',
    value: 0,
    notes: ''
  })
  const [newDriver, setNewDriver] = useState('')
  const [newIndicator, setNewIndicator] = useState('')

  const addDataPoint = () => {
    if (newDataPoint.date && newDataPoint.value) {
      setCurrentTrend({
        ...currentTrend,
        dataPoints: [...currentTrend.dataPoints, { ...newDataPoint, id: Date.now().toString() }]
      })
      setNewDataPoint({ id: '', date: '', value: 0, notes: '' })
    }
  }

  const removeDataPoint = (id: string) => {
    setCurrentTrend({
      ...currentTrend,
      dataPoints: currentTrend.dataPoints.filter(dp => dp.id !== id)
    })
  }

  const addDriver = () => {
    if (newDriver.trim()) {
      setCurrentTrend({
        ...currentTrend,
        drivers: [...currentTrend.drivers, newDriver.trim()]
      })
      setNewDriver('')
    }
  }

  const removeDriver = (index: number) => {
    setCurrentTrend({
      ...currentTrend,
      drivers: currentTrend.drivers.filter((_, i) => i !== index)
    })
  }

  const addIndicator = () => {
    if (newIndicator.trim()) {
      setCurrentTrend({
        ...currentTrend,
        indicators: [...currentTrend.indicators, newIndicator.trim()]
      })
      setNewIndicator('')
    }
  }

  const removeIndicator = (index: number) => {
    setCurrentTrend({
      ...currentTrend,
      indicators: currentTrend.indicators.filter((_, i) => i !== index)
    })
  }

  const addTrend = () => {
    if (currentTrend.name && currentTrend.category) {
      setTrends([...trends, { ...currentTrend, id: Date.now().toString() }])
      setCurrentTrend({
        id: '',
        name: '',
        category: '',
        type: 'linear',
        direction: 'stable',
        strength: 'moderate',
        timeframe: '',
        dataPoints: [],
        drivers: [],
        implications: '',
        uncertainties: '',
        indicators: []
      })
    }
  }

  const removeTrend = (id: string) => {
    setTrends(trends.filter(t => t.id !== id))
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing': return '↗️'
      case 'decreasing': return '↘️'
      case 'stable': return '→'
      case 'volatile': return '↕️'
      default: return '•'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Save to API
    router.push('/frameworks/trend')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/frameworks/trend">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create Trend Analysis</h1>
            <p className="text-gray-600 mt-1">Identify and analyze patterns over time</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Details</CardTitle>
            <CardDescription>Basic information about your trend analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Technology Adoption Trends 2024"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope and purpose of this trend analysis..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Trend</CardTitle>
            <CardDescription>Define a trend and its characteristics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Trend Name</label>
                <Input 
                  value={currentTrend.name}
                  onChange={(e) => setCurrentTrend({...currentTrend, name: e.target.value})}
                  placeholder="e.g., AI Adoption Rate"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input 
                  value={currentTrend.category}
                  onChange={(e) => setCurrentTrend({...currentTrend, category: e.target.value})}
                  placeholder="e.g., Technology, Economic, Social"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select 
                  value={currentTrend.type}
                  onValueChange={(value: 'linear' | 'exponential' | 'cyclical' | 'step' | 'irregular') => 
                    setCurrentTrend({...currentTrend, type: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="exponential">Exponential</SelectItem>
                    <SelectItem value="cyclical">Cyclical</SelectItem>
                    <SelectItem value="step">Step Change</SelectItem>
                    <SelectItem value="irregular">Irregular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Direction</label>
                <Select 
                  value={currentTrend.direction}
                  onValueChange={(value: 'increasing' | 'decreasing' | 'stable' | 'volatile') => 
                    setCurrentTrend({...currentTrend, direction: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increasing">Increasing</SelectItem>
                    <SelectItem value="decreasing">Decreasing</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="volatile">Volatile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Strength</label>
                <Select 
                  value={currentTrend.strength}
                  onValueChange={(value: 'strong' | 'moderate' | 'weak') => 
                    setCurrentTrend({...currentTrend, strength: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strong">Strong</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="weak">Weak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Timeframe</label>
                <Input 
                  value={currentTrend.timeframe}
                  onChange={(e) => setCurrentTrend({...currentTrend, timeframe: e.target.value})}
                  placeholder="e.g., 2020-2025"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Points</label>
              <div className="space-y-2 mb-2">
                <div className="flex gap-2">
                  <Input 
                    type="date"
                    value={newDataPoint.date}
                    onChange={(e) => setNewDataPoint({...newDataPoint, date: e.target.value})}
                    className="flex-1"
                  />
                  <Input 
                    type="number"
                    value={newDataPoint.value}
                    onChange={(e) => setNewDataPoint({...newDataPoint, value: parseFloat(e.target.value)})}
                    placeholder="Value"
                    className="w-32"
                  />
                  <Input 
                    value={newDataPoint.notes}
                    onChange={(e) => setNewDataPoint({...newDataPoint, notes: e.target.value})}
                    placeholder="Notes (optional)"
                    className="flex-1"
                  />
                  <Button type="button" onClick={addDataPoint} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {currentTrend.dataPoints.map((dp) => (
                  <div key={dp.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <span className="text-sm">{dp.date}</span>
                    <span className="text-sm font-medium">{dp.value}</span>
                    {dp.notes && <span className="text-sm text-gray-600">- {dp.notes}</span>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDataPoint(dp.id)}
                      className="ml-auto"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Key Drivers</label>
              <div className="flex gap-2 mb-2">
                <Input 
                  value={newDriver}
                  onChange={(e) => setNewDriver(e.target.value)}
                  placeholder="Add a driver of this trend..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDriver())}
                />
                <Button type="button" onClick={addDriver} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentTrend.drivers.map((driver, index) => (
                  <div key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    {driver}
                    <button type="button" onClick={() => removeDriver(index)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Leading Indicators</label>
              <div className="flex gap-2 mb-2">
                <Input 
                  value={newIndicator}
                  onChange={(e) => setNewIndicator(e.target.value)}
                  placeholder="Add a leading indicator..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIndicator())}
                />
                <Button type="button" onClick={addIndicator} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentTrend.indicators.map((indicator, index) => (
                  <div key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    {indicator}
                    <button type="button" onClick={() => removeIndicator(index)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Implications</label>
                <Textarea 
                  value={currentTrend.implications}
                  onChange={(e) => setCurrentTrend({...currentTrend, implications: e.target.value})}
                  placeholder="What are the implications of this trend?"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Uncertainties</label>
                <Textarea 
                  value={currentTrend.uncertainties}
                  onChange={(e) => setCurrentTrend({...currentTrend, uncertainties: e.target.value})}
                  placeholder="What uncertainties could affect this trend?"
                  rows={3}
                />
              </div>
            </div>

            <Button 
              type="button" 
              onClick={addTrend}
              disabled={!currentTrend.name || !currentTrend.category}
            >
              Add Trend to Analysis
            </Button>
          </CardContent>
        </Card>

        {trends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Identified Trends ({trends.length})</CardTitle>
              <CardDescription>Summary of trends in this analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trends.map((trend) => (
                  <div key={trend.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <span>{getTrendIcon(trend.direction)}</span>
                          {trend.name}
                        </h4>
                        <p className="text-sm text-gray-600">{trend.category} • {trend.type} • {trend.timeframe}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTrend(trend.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Direction:</span>
                        <span className="ml-2 font-medium capitalize">{trend.direction}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Strength:</span>
                        <span className="ml-2 font-medium capitalize">{trend.strength}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Data Points:</span>
                        <span className="ml-2 font-medium">{trend.dataPoints.length}</span>
                      </div>
                    </div>

                    {trend.drivers.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Drivers:</p>
                        <div className="flex flex-wrap gap-1">
                          {trend.drivers.map((driver, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              {driver}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {trend.implications && (
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Implications:</span>
                        <p className="text-gray-600 mt-1">{trend.implications}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={!title || trends.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            Save Analysis
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/frameworks/trend')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}