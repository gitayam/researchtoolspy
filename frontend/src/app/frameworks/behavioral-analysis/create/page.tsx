/**
 * Behavioral Analysis Framework Create Page
 * 
 * COM-B based behavioral analysis framework
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Save, 
  ArrowLeft,
  Brain,
  Target,
  MapPin,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  Lightbulb,
  AlertTriangle,
  Clock
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/use-toast'
// import { SaveStatusIndicator } from '@/components/ui/save-status-indicator'
import { useIsAuthenticated } from '@/stores/auth'
import { apiClient } from '@/lib/api'

interface COMBAnalysis {
  physical_capability: string
  psychological_capability: string
  physical_opportunity: string
  social_opportunity: string
  reflective_motivation: string
  automatic_motivation: string
}

interface Vulnerability {
  id: string
  description: string
  severity: number
  exploitability: number
  impact: number
}

interface Stakeholder {
  id: string
  name: string
  role: string
  influence: number
  stance: 'supportive' | 'neutral' | 'opposing'
}

interface BehavioralData {
  objective_effect: string
  action_behavior: string
  location: string
  comb_analysis: COMBAnalysis
  vulnerabilities: Vulnerability[]
  stakeholders: Stakeholder[]
  historical_examples: string
  obstacles: string
  consequences: string
  environmental_factors: string
  intervention_strategies: string
}

export default function BehavioralAnalysisCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  const [sessionId] = useState(() => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [data, setData] = useState<BehavioralData>({
    objective_effect: '',
    action_behavior: '',
    location: '',
    comb_analysis: {
      physical_capability: '',
      psychological_capability: '',
      physical_opportunity: '',
      social_opportunity: '',
      reflective_motivation: '',
      automatic_motivation: ''
    },
    vulnerabilities: [],
    stakeholders: [],
    historical_examples: '',
    obstacles: '',
    consequences: '',
    environmental_factors: '',
    intervention_strategies: ''
  })
  const [title, setTitle] = useState('Behavioral Analysis')
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    comb: true,
    vulnerabilities: false,
    stakeholders: false,
    analysis: false
  })
  
  // AI Enhancement state
  const [aiLoading, setAiLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<string[]>([])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const updateData = (updater: (prev: BehavioralData) => BehavioralData) => {
    setData(prev => updater(prev))
  }

  // Add Vulnerability
  const addVulnerability = () => {
    const newVulnerability: Vulnerability = {
      id: Date.now().toString(),
      description: '',
      severity: 3,
      exploitability: 3,
      impact: 3
    }
    updateData(prev => ({
      ...prev,
      vulnerabilities: [...prev.vulnerabilities, newVulnerability]
    }))
  }

  // Update Vulnerability
  const updateVulnerability = (id: string, updates: Partial<Vulnerability>) => {
    updateData(prev => ({
      ...prev,
      vulnerabilities: prev.vulnerabilities.map(vuln => 
        vuln.id === id ? { ...vuln, ...updates } : vuln
      )
    }))
  }

  // Remove Vulnerability
  const removeVulnerability = (id: string) => {
    updateData(prev => ({
      ...prev,
      vulnerabilities: prev.vulnerabilities.filter(vuln => vuln.id !== id)
    }))
  }

  // Add Stakeholder
  const addStakeholder = () => {
    const newStakeholder: Stakeholder = {
      id: Date.now().toString(),
      name: '',
      role: '',
      influence: 3,
      stance: 'neutral'
    }
    updateData(prev => ({
      ...prev,
      stakeholders: [...prev.stakeholders, newStakeholder]
    }))
  }

  // Update Stakeholder
  const updateStakeholder = (id: string, updates: Partial<Stakeholder>) => {
    updateData(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.map(stakeholder => 
        stakeholder.id === id ? { ...stakeholder, ...updates } : stakeholder
      )
    }))
  }

  // Remove Stakeholder
  const removeStakeholder = (id: string) => {
    updateData(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.filter(stakeholder => stakeholder.id !== id)
    }))
  }

  // AI Enhancement functions
  const generateCOMBRecommendations = async () => {
    if (!data.action_behavior || !data.location) {
      toast({
        title: 'Validation Error',
        description: 'Please provide target behavior and location first',
        variant: 'destructive'
      })
      return
    }

    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/behavioral/ai/comb-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_behavior: data.action_behavior,
          location: data.location,
          objective: data.objective_effect
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        updateData(prev => ({
          ...prev,
          comb_analysis: {
            physical_capability: result.physical_capability || prev.comb_analysis.physical_capability,
            psychological_capability: result.psychological_capability || prev.comb_analysis.psychological_capability,
            physical_opportunity: result.physical_opportunity || prev.comb_analysis.physical_opportunity,
            social_opportunity: result.social_opportunity || prev.comb_analysis.social_opportunity,
            reflective_motivation: result.reflective_motivation || prev.comb_analysis.reflective_motivation,
            automatic_motivation: result.automatic_motivation || prev.comb_analysis.automatic_motivation
          }
        }))
        toast({
          title: 'COM-B Analysis Generated',
          description: 'AI has populated the COM-B framework components'
        })
      }
    } catch (error) {
      console.error('AI COM-B analysis failed:', error)
      toast({
        title: 'AI Generation Failed',
        description: 'Could not generate COM-B analysis',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(false)
    }
  }

  const analyzeVulnerabilities = async () => {
    if (!data.action_behavior || Object.values(data.comb_analysis).every(v => !v.trim())) {
      toast({
        title: 'Validation Error',
        description: 'Please complete the COM-B analysis first',
        variant: 'destructive'
      })
      return
    }

    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/behavioral/ai/vulnerability-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_behavior: data.action_behavior,
          comb_analysis: data.comb_analysis,
          location: data.location
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        result.vulnerabilities.forEach((vuln: any) => {
          const newVulnerability: Vulnerability = {
            id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            description: vuln.description,
            severity: vuln.severity || 3,
            exploitability: vuln.exploitability || 3,
            impact: vuln.impact || 3
          }
          updateData(prev => ({
            ...prev,
            vulnerabilities: [...prev.vulnerabilities, newVulnerability]
          }))
        })
        toast({
          title: 'Vulnerabilities Identified',
          description: `Added ${result.vulnerabilities.length} potential vulnerabilities`
        })
      }
    } catch (error) {
      console.error('AI vulnerability analysis failed:', error)
      toast({
        title: 'AI Analysis Failed',
        description: 'Could not analyze vulnerabilities',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(false)
    }
  }

  const generateInterventionRecommendations = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/v1/behavioral/ai/intervention-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_behavior: data.action_behavior,
          comb_analysis: data.comb_analysis,
          vulnerabilities: data.vulnerabilities,
          stakeholders: data.stakeholders
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setRecommendations(result.recommendations)
        toast({
          title: 'Recommendations Generated',
          description: `Generated ${result.recommendations.length} intervention strategies`
        })
      }
    } catch (error) {
      console.error('AI recommendation generation failed:', error)
      toast({
        title: 'AI Generation Failed',
        description: 'Could not generate recommendations',
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
        description: 'Please provide a title for your behavioral analysis',
        variant: 'destructive'
      })
      return
    }
    
    if (!data.action_behavior || !data.location) {
      toast({
        title: 'Validation Error',
        description: 'Please provide target behavior and location',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: 'Behavioral Analysis using COM-B Framework',
        framework_type: 'behavioral',
        data: data
      }
      
      await apiClient.post('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'Behavioral analysis published successfully'
      })
      
      router.push('/frameworks/behavioral-analysis')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish behavioral analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const hasData = data.action_behavior || data.location || data.vulnerabilities.length > 0

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
                onClick={() => router.push('/frameworks/behavioral-analysis')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Behavioral Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  COM-B Framework for Target Audience Analysis
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
                <Brain className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Youth Engagement Behavioral Analysis"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </CardContent>
          </Card>

          {/* Basic Analysis Section */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Basic Analysis
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('basic')}
                >
                  {expandedSections.basic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Define the objective, target behavior, and context
              </CardDescription>
            </CardHeader>
            {expandedSections.basic && (
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Planner's Objective or Effect</label>
                  <Textarea
                    value={data.objective_effect}
                    onChange={(e) => updateData(prev => ({ ...prev, objective_effect: e.target.value }))}
                    placeholder="Describe your objective as a planner. What effect or outcome are you trying to achieve?"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Action or Behavior</label>
                  <Textarea
                    value={data.action_behavior}
                    onChange={(e) => updateData(prev => ({ ...prev, action_behavior: e.target.value }))}
                    placeholder="Describe the specific action or behavior you want others to take..."
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                  <Input
                    value={data.location}
                    onChange={(e) => updateData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Specify the location where the behavior occurs"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* COM-B Analysis */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  COM-B Framework Analysis
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateCOMBRecommendations}
                    disabled={aiLoading || !data.action_behavior}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI: Generate COM-B Analysis
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('comb')}
                  >
                    {expandedSections.comb ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Capability, Opportunity, and Motivation analysis for behavior change
              </CardDescription>
            </CardHeader>
            {expandedSections.comb && (
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Capability</h4>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Physical Capability Requirements</label>
                      <Textarea
                        value={data.comb_analysis.physical_capability}
                        onChange={(e) => updateData(prev => ({
                          ...prev,
                          comb_analysis: { ...prev.comb_analysis, physical_capability: e.target.value }
                        }))}
                        placeholder="List physical skills, strength, endurance needed..."
                        className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Psychological Capability Requirements</label>
                      <Textarea
                        value={data.comb_analysis.psychological_capability}
                        onChange={(e) => updateData(prev => ({
                          ...prev,
                          comb_analysis: { ...prev.comb_analysis, psychological_capability: e.target.value }
                        }))}
                        placeholder="List knowledge, skills, mental capacity needed..."
                        className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Opportunity</h4>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Physical Opportunity Requirements</label>
                      <Textarea
                        value={data.comb_analysis.physical_opportunity}
                        onChange={(e) => updateData(prev => ({
                          ...prev,
                          comb_analysis: { ...prev.comb_analysis, physical_opportunity: e.target.value }
                        }))}
                        placeholder="List resources, time, location needed..."
                        className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Social Opportunity Requirements</label>
                      <Textarea
                        value={data.comb_analysis.social_opportunity}
                        onChange={(e) => updateData(prev => ({
                          ...prev,
                          comb_analysis: { ...prev.comb_analysis, social_opportunity: e.target.value }
                        }))}
                        placeholder="List social and cultural requirements..."
                        className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Motivation</h4>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reflective Motivation Requirements</label>
                      <Textarea
                        value={data.comb_analysis.reflective_motivation}
                        onChange={(e) => updateData(prev => ({
                          ...prev,
                          comb_analysis: { ...prev.comb_analysis, reflective_motivation: e.target.value }
                        }))}
                        placeholder="List conscious goals, plans needed..."
                        className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Automatic Motivation Requirements</label>
                      <Textarea
                        value={data.comb_analysis.automatic_motivation}
                        onChange={(e) => updateData(prev => ({
                          ...prev,
                          comb_analysis: { ...prev.comb_analysis, automatic_motivation: e.target.value }
                        }))}
                        placeholder="List habitual/emotional requirements..."
                        className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Vulnerabilities Analysis */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Critical Vulnerabilities ({data.vulnerabilities.length})
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={analyzeVulnerabilities}
                    disabled={aiLoading || !data.action_behavior}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI: Analyze Vulnerabilities
                  </Button>
                  <Button onClick={addVulnerability} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Vulnerability
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('vulnerabilities')}
                  >
                    {expandedSections.vulnerabilities ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Critical vulnerabilities that could be targeted to affect the behavior
              </CardDescription>
            </CardHeader>
            {expandedSections.vulnerabilities && (
              <CardContent className="space-y-4">
                {data.vulnerabilities.map((vulnerability, index) => (
                  <div key={vulnerability.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center text-sm font-medium text-red-600 dark:text-red-400">
                        V{index + 1}
                      </div>
                      <div className="flex-1 space-y-4">
                        <Textarea
                          value={vulnerability.description}
                          onChange={(e) => updateVulnerability(vulnerability.id, { description: e.target.value })}
                          placeholder="Describe the vulnerability..."
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          rows={2}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Severity: {vulnerability.severity}/5
                            </label>
                            <Slider
                              value={[vulnerability.severity]}
                              onValueChange={(value) => updateVulnerability(vulnerability.id, { severity: value[0] })}
                              max={5}
                              min={1}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Exploitability: {vulnerability.exploitability}/5
                            </label>
                            <Slider
                              value={[vulnerability.exploitability]}
                              onValueChange={(value) => updateVulnerability(vulnerability.id, { exploitability: value[0] })}
                              max={5}
                              min={1}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                              Impact: {vulnerability.impact}/5
                            </label>
                            <Slider
                              value={[vulnerability.impact]}
                              onValueChange={(value) => updateVulnerability(vulnerability.id, { impact: value[0] })}
                              max={5}
                              min={1}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVulnerability(vulnerability.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {data.vulnerabilities.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>No vulnerabilities identified yet. Add vulnerabilities to analyze intervention points.</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Brain className="h-5 w-5" />
                  AI-Generated Intervention Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                        {index + 1}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Recommendations Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={generateInterventionRecommendations}
              disabled={aiLoading || !data.action_behavior}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Brain className="h-4 w-4 mr-2" />
              {aiLoading ? 'Generating...' : 'AI: Generate Intervention Recommendations'}
            </Button>
          </div>

          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Brain className="h-12 w-12 text-green-500 mb-4" />
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