'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Zap, Diamond, Copy, Building, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface VRIOResource {
  id: string
  name: string
  description: string
  valuable: boolean | null
  rare: boolean | null
  inimitable: boolean | null
  organized: boolean | null
}

interface VRIOData {
  resources: VRIOResource[]
}

export default function CreateVRIOPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [vrioData, setVRIOData] = useState<VRIOData>({
    resources: []
  })

  const addResource = () => {
    const newResource: VRIOResource = {
      id: Date.now().toString(),
      name: '',
      description: '',
      valuable: null,
      rare: null,
      inimitable: null,
      organized: null
    }
    setVRIOData(prev => ({
      ...prev,
      resources: [...prev.resources, newResource]
    }))
  }

  const updateResource = (id: string, field: keyof VRIOResource, value: any) => {
    setVRIOData(prev => ({
      ...prev,
      resources: prev.resources.map(resource => 
        resource.id === id ? { ...resource, [field]: value } : resource
      )
    }))
  }

  const removeResource = (id: string) => {
    setVRIOData(prev => ({
      ...prev,
      resources: prev.resources.filter(resource => resource.id !== id)
    }))
  }

  const getCompetitiveAdvantage = (resource: VRIOResource) => {
    if (resource.valuable === null) return { label: 'Not Evaluated', color: 'bg-gray-100 text-gray-800' }
    
    if (!resource.valuable) return { label: 'Competitive Disadvantage', color: 'bg-red-100 text-red-800' }
    if (!resource.rare) return { label: 'Competitive Parity', color: 'bg-yellow-100 text-yellow-800' }
    if (!resource.inimitable) return { label: 'Temporary Advantage', color: 'bg-blue-100 text-blue-800' }
    if (!resource.organized) return { label: 'Unused Advantage', color: 'bg-orange-100 text-orange-800' }
    
    return { label: 'Sustained Competitive Advantage', color: 'bg-green-100 text-green-800' }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your VRIO analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'vrio',
        data: {
          resources: vrioData.resources.filter(resource => resource.name.trim() && resource.description.trim())
        },
        status: 'draft'
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/sessions/', payload)
      
      toast({
        title: 'Success',
        description: 'VRIO analysis saved successfully'
      })

      router.push(`/frameworks/vrio/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save VRIO analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const vrioQuestions = [
    {
      key: 'valuable' as keyof VRIOResource,
      title: 'Valuable',
      question: 'Does this resource enable the firm to exploit opportunities or neutralize threats?',
      icon: Diamond,
      color: 'text-purple-600'
    },
    {
      key: 'rare' as keyof VRIOResource,
      title: 'Rare',
      question: 'Is this resource controlled by only a small number of competing firms?',
      icon: Zap,
      color: 'text-blue-600'
    },
    {
      key: 'inimitable' as keyof VRIOResource,
      title: 'Inimitable',
      question: 'Would it be costly for other firms to obtain or develop this resource?',
      icon: Copy,
      color: 'text-orange-600'
    },
    {
      key: 'organized' as keyof VRIOResource,
      title: 'Organized',
      question: 'Is the firm organized to capture the value from this resource?',
      icon: Building,
      color: 'text-green-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">VRIO Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Value, Rarity, Imitability, Organization analysis for competitive advantage
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-yellow-600 hover:bg-yellow-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Strategic Resource Assessment"
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

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Diamond className="h-5 w-5" />
              Strategic Resources
            </div>
            <Button onClick={addResource} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Resource
            </Button>
          </CardTitle>
          <CardDescription>
            Identify and evaluate strategic resources and capabilities for competitive advantage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {vrioData.resources.map((resource) => {
            const advantage = getCompetitiveAdvantage(resource)
            
            return (
              <div key={resource.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <Input
                      value={resource.name}
                      onChange={(e) => updateResource(resource.id, 'name', e.target.value)}
                      placeholder="Resource/Capability Name (e.g., Brand Recognition)"
                      className="font-medium"
                    />
                    <Textarea
                      value={resource.description}
                      onChange={(e) => updateResource(resource.id, 'description', e.target.value)}
                      placeholder="Describe this resource or capability in detail..."
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={advantage.color}>
                      {advantage.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeResource(resource.id)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* VRIO Questions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {vrioQuestions.map((question) => (
                    <div key={question.key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <question.icon className={`h-4 w-4 ${question.color}`} />
                        <span className="font-medium text-sm">{question.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{question.question}</p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateResource(resource.id, question.key, true)}
                          className={`p-1 h-8 w-8 ${
                            resource[question.key] === true 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'hover:bg-green-50'
                          }`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateResource(resource.id, question.key, false)}
                          className={`p-1 h-8 w-8 ${
                            resource[question.key] === false 
                              ? 'bg-red-100 text-red-800 border-red-300' 
                              : 'hover:bg-red-50'
                          }`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          
          {vrioData.resources.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Diamond className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Resources Added</h3>
              <p className="text-gray-500 mb-4">Start by identifying strategic resources and capabilities</p>
              <Button onClick={addResource}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Resource
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VRIO Framework Guide */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            VRIO Framework Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Competitive Advantage Levels:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Sustained Competitive Advantage (V+R+I+O)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>Unused Advantage (V+R+I-O)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Temporary Advantage (V+R-I)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>Competitive Parity (V-R)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Competitive Disadvantage (-V)</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Analysis Tips:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Consider both tangible and intangible resources</li>
                <li>• Evaluate capabilities alongside resources</li>
                <li>• Think about resource bundles and combinations</li>
                <li>• Consider dynamic capabilities and adaptability</li>
                <li>• Assess organizational support systems</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}