'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Globe, Users, DollarSign, Zap, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface PESTItem {
  id: string
  text: string
}

interface PESTData {
  political: PESTItem[]
  economic: PESTItem[]
  social: PESTItem[]
  technological: PESTItem[]
}

export default function CreatePESTPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [pestData, setPESTData] = useState<PESTData>({
    political: [],
    economic: [],
    social: [],
    technological: []
  })

  const addItem = (category: keyof PESTData) => {
    const newItem: PESTItem = {
      id: Date.now().toString(),
      text: ''
    }
    setPESTData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }

  const updateItem = (category: keyof PESTData, id: string, text: string) => {
    setPESTData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }

  const removeItem = (category: keyof PESTData, id: string) => {
    setPESTData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your PEST analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'pest',
        data: {
          political: pestData.political.filter(item => item.text.trim()),
          economic: pestData.economic.filter(item => item.text.trim()),
          social: pestData.social.filter(item => item.text.trim()),
          technological: pestData.technological.filter(item => item.text.trim())
        },
        status: 'draft'
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions/', payload)
      
      toast({
        title: 'Success',
        description: 'PEST analysis saved successfully'
      })

      router.push(`/frameworks/pest/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save PEST analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const factors = [
    {
      key: 'political' as keyof PESTData,
      title: 'Political',
      description: 'Government policies, regulations, and political stability',
      icon: Users,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Government regulations, political stability, trade policies...'
    },
    {
      key: 'economic' as keyof PESTData,
      title: 'Economic',
      description: 'Economic trends, market conditions, and financial factors',
      icon: DollarSign,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Economic growth, inflation rates, exchange rates...'
    },
    {
      key: 'social' as keyof PESTData,
      title: 'Social',
      description: 'Cultural trends, demographics, and lifestyle changes',
      icon: Users,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., Population demographics, cultural attitudes, lifestyle trends...'
    },
    {
      key: 'technological' as keyof PESTData,
      title: 'Technological',
      description: 'Technology developments, innovation, and automation',
      icon: Zap,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      placeholder: 'e.g., Technological advances, automation, R&D activities...'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PEST Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Political, Economic, Social, Technological environmental factors analysis
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Market Environment Analysis"
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

      {/* PEST Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {factors.map((factor) => (
          <Card key={factor.key} className={factor.color}>
            <CardHeader className={`${factor.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <factor.icon className="h-5 w-5" />
                {factor.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {factor.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {pestData[factor.key].map((item) => (
                <div key={item.id} className="flex gap-2">
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(factor.key, item.id, e.target.value)}
                    placeholder={factor.placeholder}
                    className="flex-1 bg-white dark:bg-gray-900 border-gray-300"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(factor.key, item.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={() => addItem(factor.key)}
                className="w-full border-dashed border-2 hover:bg-white/50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {factor.title} Factor
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analysis Guidelines */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            PEST Analysis Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Analysis Focus:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Identify external macro-environmental factors</li>
                <li>• Assess impact on organization/industry</li>
                <li>• Consider both current and future trends</li>
                <li>• Evaluate opportunities and threats</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Best Practices:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Use reliable and current data sources</li>
                <li>• Consider interconnections between factors</li>
                <li>• Update analysis regularly</li>
                <li>• Combine with other strategic tools</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}