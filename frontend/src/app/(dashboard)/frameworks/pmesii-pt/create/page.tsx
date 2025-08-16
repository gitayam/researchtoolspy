'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, BarChart3, Users, Building, DollarSign, Shield, Wifi, Globe, Clock, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface PMESIIItem {
  id: string
  text: string
}

interface PMESIIData {
  political: PMESIIItem[]
  military: PMESIIItem[]
  economic: PMESIIItem[]
  social: PMESIIItem[]
  information: PMESIIItem[]
  infrastructure: PMESIIItem[]
  physical_environment: PMESIIItem[]
  time: PMESIIItem[]
}

export default function CreatePMESIIPTPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [pmesiiData, setPMESIIData] = useState<PMESIIData>({
    political: [],
    military: [],
    economic: [],
    social: [],
    information: [],
    infrastructure: [],
    physical_environment: [],
    time: []
  })

  const addItem = (category: keyof PMESIIData) => {
    const newItem: PMESIIItem = {
      id: Date.now().toString(),
      text: ''
    }
    setPMESIIData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }

  const updateItem = (category: keyof PMESIIData, id: string, text: string) => {
    setPMESIIData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }

  const removeItem = (category: keyof PMESIIData, id: string) => {
    setPMESIIData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your PMESII-PT analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'pmesii-pt',
        data: {
          political: pmesiiData.political.filter(item => item.text.trim()),
          military: pmesiiData.military.filter(item => item.text.trim()),
          economic: pmesiiData.economic.filter(item => item.text.trim()),
          social: pmesiiData.social.filter(item => item.text.trim()),
          information: pmesiiData.information.filter(item => item.text.trim()),
          infrastructure: pmesiiData.infrastructure.filter(item => item.text.trim()),
          physical_environment: pmesiiData.physical_environment.filter(item => item.text.trim()),
          time: pmesiiData.time.filter(item => item.text.trim())
        },
        status: 'draft'
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions/', payload)
      
      toast({
        title: 'Success',
        description: 'PMESII-PT analysis saved successfully'
      })

      router.push(`/frameworks/pmesii-pt/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save PMESII-PT analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const factors = [
    {
      key: 'political' as keyof PMESIIData,
      title: 'Political',
      description: 'Government structures, policies, and political dynamics',
      icon: Users,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Government stability, political parties, electoral processes...'
    },
    {
      key: 'military' as keyof PMESIIData,
      title: 'Military',
      description: 'Armed forces capabilities, organization, and doctrine',
      icon: Shield,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Force structure, military capabilities, defense budget...'
    },
    {
      key: 'economic' as keyof PMESIIData,
      title: 'Economic',
      description: 'Economic systems, resources, and financial factors',
      icon: DollarSign,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., GDP, unemployment, trade relationships, natural resources...'
    },
    {
      key: 'social' as keyof PMESIIData,
      title: 'Social',
      description: 'Cultural, demographic, and societal factors',
      icon: Users,
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-500',
      placeholder: 'e.g., Demographics, cultural norms, education levels, social tensions...'
    },
    {
      key: 'information' as keyof PMESIIData,
      title: 'Information',
      description: 'Information systems, media, and communication networks',
      icon: Wifi,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      placeholder: 'e.g., Media landscape, internet penetration, information warfare...'
    },
    {
      key: 'infrastructure' as keyof PMESIIData,
      title: 'Infrastructure',
      description: 'Physical and technological infrastructure systems',
      icon: Building,
      color: 'bg-teal-50 border-teal-200',
      headerColor: 'bg-teal-500',
      placeholder: 'e.g., Transportation, energy, telecommunications, healthcare systems...'
    },
    {
      key: 'physical_environment' as keyof PMESIIData,
      title: 'Physical Environment',
      description: 'Geography, climate, and environmental factors',
      icon: Globe,
      color: 'bg-emerald-50 border-emerald-200',
      headerColor: 'bg-emerald-500',
      placeholder: 'e.g., Terrain, climate, natural disasters, environmental threats...'
    },
    {
      key: 'time' as keyof PMESIIData,
      title: 'Time',
      description: 'Temporal factors and timing considerations',
      icon: Clock,
      color: 'bg-indigo-50 border-indigo-200',
      headerColor: 'bg-indigo-500',
      placeholder: 'e.g., Timeline constraints, seasonal factors, historical context...'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PMESII-PT Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive environmental analysis framework across 8 key domains
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Regional Stability Assessment"
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

      {/* PMESII-PT Factors */}
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
              {pmesiiData[factor.key].map((item) => (
                <div key={item.id} className="flex gap-2">
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(factor.key, item.id, e.target.value)}
                    placeholder={factor.placeholder}
                    className="flex-1 bg-white border-gray-300"
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
            <BarChart3 className="h-5 w-5" />
            PMESII-PT Analysis Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Key Considerations:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Analyze interconnections between factors</li>
                <li>• Consider both current state and trends</li>
                <li>• Identify primary and secondary effects</li>
                <li>• Focus on relevant operational environment</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Best Practices:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Use multiple sources of information</li>
                <li>• Regularly update your assessment</li>
                <li>• Consider adversary perspectives</li>
                <li>• Document assumptions and uncertainties</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}