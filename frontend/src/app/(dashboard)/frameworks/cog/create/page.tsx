'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Brain, Target, Zap, Shield, Users, Building, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface COGItem {
  id: string
  text: string
}

interface COGData {
  centers_of_gravity: COGItem[]
  critical_capabilities: COGItem[]
  critical_requirements: COGItem[]
  critical_vulnerabilities: COGItem[]
}

export default function CreateCOGPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [cogData, setCOGData] = useState<COGData>({
    centers_of_gravity: [],
    critical_capabilities: [],
    critical_requirements: [],
    critical_vulnerabilities: []
  })

  const addItem = (category: keyof COGData) => {
    const newItem: COGItem = {
      id: Date.now().toString(),
      text: ''
    }
    setCOGData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }

  const updateItem = (category: keyof COGData, id: string, text: string) => {
    setCOGData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }

  const removeItem = (category: keyof COGData, id: string) => {
    setCOGData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your COG analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'cog',
        data: {
          centers_of_gravity: cogData.centers_of_gravity.filter(item => item.text.trim()),
          critical_capabilities: cogData.critical_capabilities.filter(item => item.text.trim()),
          critical_requirements: cogData.critical_requirements.filter(item => item.text.trim()),
          critical_vulnerabilities: cogData.critical_vulnerabilities.filter(item => item.text.trim())
        },
        status: 'draft'
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions/', payload)
      
      toast({
        title: 'Success',
        description: 'COG analysis saved successfully'
      })

      router.push(`/frameworks/cog/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save COG analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    {
      key: 'centers_of_gravity' as keyof COGData,
      title: 'Centers of Gravity',
      description: 'Primary sources of power, strength, and resistance',
      icon: Target,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Political leadership, economic infrastructure, military command...'
    },
    {
      key: 'critical_capabilities' as keyof COGData,
      title: 'Critical Capabilities',
      description: 'Primary abilities that enable the centers of gravity to function',
      icon: Zap,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., Command and control, logistics systems, communication networks...'
    },
    {
      key: 'critical_requirements' as keyof COGData,
      title: 'Critical Requirements',
      description: 'Essential conditions, resources, and means for critical capabilities',
      icon: Building,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Fuel supplies, trained personnel, secure communications...'
    },
    {
      key: 'critical_vulnerabilities' as keyof COGData,
      title: 'Critical Vulnerabilities',
      description: 'Aspects that are deficient or vulnerable to attack',
      icon: Shield,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      placeholder: 'e.g., Single points of failure, exposed supply lines, weak encryption...'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">COG Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Center of Gravity analysis for identifying critical capabilities and vulnerabilities
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-green-600 hover:bg-green-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Adversary Command Structure Analysis"
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

      {/* COG Analysis Framework */}
      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.key} className={section.color}>
            <CardHeader className={`${section.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <section.icon className="h-5 w-5" />
                {section.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {cogData[section.key].map((item) => (
                <div key={item.id} className="flex gap-2">
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(section.key, item.id, e.target.value)}
                    placeholder={section.placeholder}
                    className="flex-1 bg-white border-gray-300"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(section.key, item.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={() => addItem(section.key)}
                className="w-full border-dashed border-2 hover:bg-white/50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {section.title.replace('Critical ', '').slice(0, -1)}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analysis Flow */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            COG Analysis Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">Identify Centers of Gravity</h4>
                <p className="text-sm text-gray-600">Primary sources of power and strength</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">Define Critical Capabilities</h4>
                <p className="text-sm text-gray-600">Abilities that enable the COG to function</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">Identify Critical Requirements</h4>
                <p className="text-sm text-gray-600">Essential conditions and resources needed</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                4
              </div>
              <div>
                <h4 className="font-medium">Analyze Critical Vulnerabilities</h4>
                <p className="text-sm text-gray-600">Deficient or vulnerable aspects to exploit</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}