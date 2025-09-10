/**
 * Causeway Framework Create Page
 * 
 * COG-based causal pathway analysis framework
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Save, 
  ArrowLeft,
  GitBranch,
  Target,
  Layers,
  Trash2,
  ChevronDown,
  ChevronUp,
  Brain,
  Search,
  MapPin,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
import { useIsAuthenticated } from '@/stores/auth'
import { apiClient } from '@/lib/api'

interface UltimateTarget {
  id: string
  name: string
  objective: string
  capabilities: Capability[]
}

interface Capability {
  id: string
  name: string
  requirements: Requirement[]
}

interface Requirement {
  id: string
  name: string
  proximateTargets: string[]
}

interface CausewayData {
  issue: string
  location: string
  threat: string
  ultimateTargets: UltimateTarget[]
}

export default function CausewayCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  const [sessionId] = useState(() => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [data, setData] = useState<CausewayData>({
    issue: '',
    location: '',
    threat: '',
    ultimateTargets: []
  })
  const [title, setTitle] = useState('Causeway Analysis')
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    scenario: true,
    targets: true,
    capabilities: false,
    requirements: false,
    proximateTargets: false
  })
  
  // AI Enhancement state
  const [aiLoading, setAiLoading] = useState(false)
  const [threatSuggestions, setThreatSuggestions] = useState<string[]>([])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const updateData = (updater: (prev: CausewayData) => CausewayData) => {
    setData(prev => updater(prev))
  }

  // Add Ultimate Target
  const addUltimateTarget = () => {
    const newTarget: UltimateTarget = {
      id: Date.now().toString(),
      name: '',
      objective: '',
      capabilities: []
    }
    updateData(prev => ({
      ...prev,
      ultimateTargets: [...prev.ultimateTargets, newTarget]
    }))
  }

  // Update Ultimate Target
  const updateUltimateTarget = (id: string, updates: Partial<UltimateTarget>) => {
    updateData(prev => ({
      ...prev,
      ultimateTargets: prev.ultimateTargets.map(target => 
        target.id === id ? { ...target, ...updates } : target
      )
    }))
  }

  // Remove Ultimate Target
  const removeUltimateTarget = (id: string) => {
    updateData(prev => ({
      ...prev,
      ultimateTargets: prev.ultimateTargets.filter(target => target.id !== id)
    }))
  }

  // Add Capability to Target
  const addCapability = (targetId: string) => {
    const newCapability: Capability = {
      id: Date.now().toString(),
      name: '',
      requirements: []
    }
    updateData(prev => ({
      ...prev,
      ultimateTargets: prev.ultimateTargets.map(target => 
        target.id === targetId 
          ? { ...target, capabilities: [...target.capabilities, newCapability] }
          : target
      )
    }))
  }

  // Update Capability
  const updateCapability = (targetId: string, capId: string, updates: Partial<Capability>) => {
    updateData(prev => ({
      ...prev,
      ultimateTargets: prev.ultimateTargets.map(target => 
        target.id === targetId 
          ? {
              ...target,
              capabilities: target.capabilities.map(cap => 
                cap.id === capId ? { ...cap, ...updates } : cap
              )
            }
          : target
      )
    }))
  }

  // Remove Capability
  const removeCapability = (targetId: string, capId: string) => {
    updateData(prev => ({
      ...prev,
      ultimateTargets: prev.ultimateTargets.map(target => 
        target.id === targetId 
          ? { ...target, capabilities: target.capabilities.filter(cap => cap.id !== capId) }
          : target
      )
    }))
  }

  // Add Requirement to Capability
  const addRequirement = (targetId: string, capId: string) => {
    const newRequirement: Requirement = {
      id: Date.now().toString(),
      name: '',
      proximateTargets: []
    }
    updateData(prev => ({
      ...prev,
      ultimateTargets: prev.ultimateTargets.map(target => 
        target.id === targetId 
          ? {
              ...target,
              capabilities: target.capabilities.map(cap => 
                cap.id === capId 
                  ? { ...cap, requirements: [...cap.requirements, newRequirement] }
                  : cap
              )
            }
          : target
      )
    }))
  }

  // AI Enhancement functions
  const generateThreatSuggestions = async () => {
    if (!data.issue || !data.location) {
      toast({
        title: 'Validation Error',
        description: 'Please provide both issue and location first',
        variant: 'destructive'
      })
      return
    }

    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/causeway/ai/threat-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue: data.issue,
          location: data.location
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setThreatSuggestions(result.threats)
        toast({
          title: 'Threats Generated',
          description: `Generated ${result.threats.length} threat suggestions`
        })
      }
    } catch (error) {
      console.error('AI threat generation failed:', error)
      toast({
        title: 'AI Generation Failed',
        description: 'Could not generate threat suggestions',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(false)
    }
  }

  const generateUltimateTargets = async () => {
    if (!data.threat || !data.issue || !data.location) {
      toast({
        title: 'Validation Error', 
        description: 'Please complete the scenario section first',
        variant: 'destructive'
      })
      return
    }

    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/causeway/ai/ultimate-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue: data.issue,
          location: data.location,
          threat: data.threat
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        result.targets.forEach((targetName: string) => {
          const newTarget: UltimateTarget = {
            id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: targetName,
            objective: '',
            capabilities: []
          }
          updateData(prev => ({
            ...prev,
            ultimateTargets: [...prev.ultimateTargets, newTarget]
          }))
        })
        toast({
          title: 'Ultimate Targets Generated',
          description: `Added ${result.targets.length} potential ultimate targets`
        })
      }
    } catch (error) {
      console.error('AI target generation failed:', error)
      toast({
        title: 'AI Generation Failed',
        description: 'Could not generate ultimate targets',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(false)
    }
  }

  // Publish analysis
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your Causeway analysis',
        variant: 'destructive'
      })
      return
    }
    
    if (!data.issue || !data.location || !data.threat) {
      toast({
        title: 'Validation Error',
        description: 'Please complete the scenario section',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: 'Causeway Framework Analysis',
        framework_type: 'causeway',
        data: {
          issue: data.issue,
          location: data.location,
          threat: data.threat,
          ultimateTargets: data.ultimateTargets.filter(t => t.name.trim()),
        }
      }
      
      await apiClient.post('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'Causeway analysis published successfully'
      })
      
      router.push('/frameworks/causeway')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish Causeway analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const hasData = data.issue || data.location || data.threat || data.ultimateTargets.length > 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/frameworks/causeway')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Causeway Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Center of Gravity Framework for Causal Pathway Analysis
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <SaveStatusIndicator sessionId={sessionId} />
              
              <div className="flex gap-2">
                {!isAuthenticated && hasData && (
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/login')}
                  >
                    Sign In to Save
                  </Button>
                )}
                
                <Button 
                  onClick={handlePublish}
                  disabled={saving || !hasData}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Publishing...' : isAuthenticated ? 'Publish Analysis' : 'Sign In to Publish'}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Basic Information */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <GitBranch className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Strategic COG Analysis for Regional Stability"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </CardContent>
          </Card>

          {/* Scenario Development */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Scenario Development
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('scenario')}
                >
                  {expandedSections.scenario ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Define the issue, location, and primary threat for your analysis
              </CardDescription>
            </CardHeader>
            {expandedSections.scenario && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Issue of Concern</label>
                    <Input
                      value={data.issue}
                      onChange={(e) => updateData(prev => ({ ...prev, issue: e.target.value }))}
                      placeholder="e.g., Environmental sustainability, free speech"
                      className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                    <Input
                      value={data.location}
                      onChange={(e) => updateData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g., Eastern Europe, Southeast Asia"
                      className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Primary Threat</label>
                  <Textarea
                    value={data.threat}
                    onChange={(e) => updateData(prev => ({ ...prev, threat: e.target.value }))}
                    placeholder="Describe the primary threat to your issue of concern..."
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                </div>

                {/* AI Threat Suggestions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateThreatSuggestions}
                    disabled={aiLoading || !data.issue || !data.location}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    {aiLoading ? 'Generating...' : 'AI: Generate Threat Suggestions'}
                  </Button>
                </div>

                {threatSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Suggestions:</label>
                    <div className="grid grid-cols-1 gap-2">
                      {threatSuggestions.map((threat, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{threat}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateData(prev => ({ ...prev, threat }))}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Ultimate Targets */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ultimate Targets ({data.ultimateTargets.length})
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateUltimateTargets}
                    disabled={aiLoading || !data.threat}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI: Generate Targets
                  </Button>
                  <Button onClick={addUltimateTarget} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Target
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('targets')}
                  >
                    {expandedSections.targets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Entities that directly pose a threat to your issue of concern
              </CardDescription>
            </CardHeader>
            {expandedSections.targets && (
              <CardContent className="space-y-4">
                {data.ultimateTargets.map((target, index) => (
                  <div key={target.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center text-sm font-medium text-red-600 dark:text-red-400">
                        T{index + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        <Input
                          value={target.name}
                          onChange={(e) => updateUltimateTarget(target.id, { name: e.target.value })}
                          placeholder="Ultimate Target name..."
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        />
                        <Textarea
                          value={target.objective}
                          onChange={(e) => updateUltimateTarget(target.id, { objective: e.target.value })}
                          placeholder="Describe the target's objective..."
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          rows={2}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUltimateTarget(target.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {data.ultimateTargets.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Target className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>No ultimate targets yet. Add targets to begin your analysis.</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <GitBranch className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  Your Work is Automatically Saved
                </h3>
                <p className="text-green-700 dark:text-green-300 text-center mb-4 max-w-lg">
                  We're saving your progress locally in your browser as you work. 
                  To save to the cloud and access from any device, sign in to your account.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/login')}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    Sign In
                  </Button>
                  <Button 
                    onClick={() => router.push('/register')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Create Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}