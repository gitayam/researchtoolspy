'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Shield, Wifi, Briefcase, DollarSign, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface DIMEItem {
  id: string
  text: string
}

interface DIMEData {
  diplomatic: DIMEItem[]
  information: DIMEItem[]
  military: DIMEItem[]
  economic: DIMEItem[]
}

export default function CreateDIMEPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [dimeData, setDIMEData] = useState<DIMEData>({
    diplomatic: [],
    information: [],
    military: [],
    economic: []
  })

  const addItem = (category: keyof DIMEData) => {
    const newItem: DIMEItem = {
      id: Date.now().toString(),
      text: ''
    }
    setDIMEData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }

  const updateItem = (category: keyof DIMEData, id: string, text: string) => {
    setDIMEData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }

  const removeItem = (category: keyof DIMEData, id: string) => {
    setDIMEData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your DIME analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'dime',
        data: {
          diplomatic: dimeData.diplomatic.filter(item => item.text.trim()),
          information: dimeData.information.filter(item => item.text.trim()),
          military: dimeData.military.filter(item => item.text.trim()),
          economic: dimeData.economic.filter(item => item.text.trim())
        },
        status: 'draft'
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions/', payload)
      
      toast({
        title: 'Success',
        description: 'DIME analysis saved successfully'
      })

      router.push(`/frameworks/dime/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save DIME analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const instruments = [
    {
      key: 'diplomatic' as keyof DIMEData,
      title: 'Diplomatic',
      description: 'Political negotiations, alliances, treaties, and international relations',
      icon: Briefcase,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., UN resolutions, bilateral agreements, embassy activities...'
    },
    {
      key: 'information' as keyof DIMEData,
      title: 'Information',
      description: 'Information operations, propaganda, cyber activities, and communication',
      icon: Wifi,
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-500',
      placeholder: 'e.g., Media campaigns, social media influence, cyber operations...'
    },
    {
      key: 'military' as keyof DIMEData,
      title: 'Military',
      description: 'Armed forces, defense capabilities, and military operations',
      icon: Shield,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Troop deployments, military exercises, defense partnerships...'
    },
    {
      key: 'economic' as keyof DIMEData,
      title: 'Economic',
      description: 'Trade policies, sanctions, economic aid, and financial instruments',
      icon: DollarSign,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Trade agreements, economic sanctions, development aid...'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">DIME Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Diplomatic, Information, Military, Economic instruments of national power
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-red-600 hover:bg-red-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Regional Power Assessment"
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

      {/* DIME Instruments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {instruments.map((instrument) => (
          <Card key={instrument.key} className={instrument.color}>
            <CardHeader className={`${instrument.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <instrument.icon className="h-5 w-5" />
                {instrument.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {instrument.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {dimeData[instrument.key].map((item) => (
                <div key={item.id} className="flex gap-2">
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(instrument.key, item.id, e.target.value)}
                    placeholder={instrument.placeholder}
                    className="flex-1 bg-white border-gray-300"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(instrument.key, item.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={() => addItem(instrument.key)}
                className="w-full border-dashed border-2 hover:bg-white/50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {instrument.title} Element
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DIME Framework Guide */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            DIME Framework Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Key Principles:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Analyze coordinated use of all instruments</li>
                <li>• Consider timing and sequencing of actions</li>
                <li>• Evaluate effectiveness and constraints</li>
                <li>• Assess resource requirements and limitations</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Analysis Focus:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Integration across all DIME elements</li>
                <li>• Identification of gaps and redundancies</li>
                <li>• Assessment of strategic objectives</li>
                <li>• Evaluation of opponent responses</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}