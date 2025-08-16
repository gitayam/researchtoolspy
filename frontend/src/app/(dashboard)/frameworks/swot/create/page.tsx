'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Lightbulb, Target, AlertTriangle, TrendingUp, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface SWOTItem {
  id: string
  text: string
}

interface SWOTData {
  strengths: SWOTItem[]
  weaknesses: SWOTItem[]
  opportunities: SWOTItem[]
  threats: SWOTItem[]
}

export default function CreateSWOTPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [swotData, setSWOTData] = useState<SWOTData>({
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: []
  })

  const addItem = (category: keyof SWOTData) => {
    const newItem: SWOTItem = {
      id: Date.now().toString(),
      text: ''
    }
    setSWOTData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }

  const updateItem = (category: keyof SWOTData, id: string, text: string) => {
    setSWOTData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }

  const removeItem = (category: keyof SWOTData, id: string) => {
    setSWOTData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your SWOT analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        objective: title.trim(), // Use title as objective for now
        context: description.trim(),
        initial_strengths: swotData.strengths.filter(item => item.text.trim()).map(item => item.text),
        initial_weaknesses: swotData.weaknesses.filter(item => item.text.trim()).map(item => item.text),
        initial_opportunities: swotData.opportunities.filter(item => item.text.trim()).map(item => item.text),
        initial_threats: swotData.threats.filter(item => item.text.trim()).map(item => item.text),
        request_ai_suggestions: false
      }

      const response = await apiClient.post<{ session_id: number }>('/frameworks/swot/', payload)
      
      toast({
        title: 'Success',
        description: 'SWOT analysis saved successfully'
      })

      router.push(`/frameworks/swot/${response.session_id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SWOT analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const quadrants = [
    {
      key: 'strengths' as keyof SWOTData,
      title: 'Strengths',
      description: 'Internal positive factors and advantages',
      icon: Target,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Strong brand recognition, skilled workforce...'
    },
    {
      key: 'weaknesses' as keyof SWOTData,
      title: 'Weaknesses',
      description: 'Internal negative factors and disadvantages',
      icon: AlertTriangle,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Limited resources, outdated technology...'
    },
    {
      key: 'opportunities' as keyof SWOTData,
      title: 'Opportunities',
      description: 'External positive factors and potential advantages',
      icon: TrendingUp,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., Market expansion, new partnerships...'
    },
    {
      key: 'threats' as keyof SWOTData,
      title: 'Threats',
      description: 'External negative factors and potential risks',
      icon: AlertTriangle,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      placeholder: 'e.g., Economic downturn, increased competition...'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SWOT Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Analyze Strengths, Weaknesses, Opportunities, and Threats
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q1 2024 Strategic Assessment"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the analysis scope and objectives..."
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* SWOT Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {quadrants.map((quadrant) => (
          <Card key={quadrant.key} className={`${quadrant.color}`}>
            <CardHeader className={`${quadrant.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <quadrant.icon className="h-5 w-5" />
                {quadrant.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {quadrant.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {swotData[quadrant.key].map((item) => (
                <div key={item.id} className="flex gap-2">
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(quadrant.key, item.id, e.target.value)}
                    placeholder={quadrant.placeholder}
                    className="flex-1 bg-white border-gray-300"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(quadrant.key, item.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={() => addItem(quadrant.key)}
                className="w-full border-dashed border-2 hover:bg-white/50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {quadrant.title.slice(0, -1)}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Suggestions */}
      <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Lightbulb className="h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI Suggestions</h3>
          <p className="text-gray-500 text-center mb-4">
            Get AI-powered suggestions to help complete your SWOT analysis
          </p>
          <Button variant="outline" disabled>
            <Lightbulb className="h-4 w-4 mr-2" />
            Generate Suggestions (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}