'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Shield, Wifi, Briefcase, DollarSign, Trash2, Globe, Target, Map, Brain } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  const [scenario, setScenario] = useState('')
  const [region, setRegion] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [strategicObjective, setStrategicObjective] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urls, setUrls] = useState<string[]>([])
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

  const addUrl = () => {
    if (urlInput.trim() && !urls.includes(urlInput.trim())) {
      setUrls(prev => [...prev, urlInput.trim()])
      setUrlInput('')
    }
  }

  const removeUrl = (urlToRemove: string) => {
    setUrls(prev => prev.filter(url => url !== urlToRemove))
  }

  const scrapeUrls = async () => {
    if (urls.length === 0) {
      toast({
        title: 'No URLs',
        description: 'Please add URLs to scrape',
        variant: 'destructive'
      })
      return
    }

    try {
      // Start scraping job for the URLs
      const scrapingRequest = urls.length === 1 
        ? { url: urls[0], extract_images: false, extract_links: true, follow_redirects: true, max_depth: 1, delay_seconds: 1.0 }
        : { urls: urls, extract_images: false, extract_links: true, follow_redirects: true, delay_seconds: 1.0 }

      const endpoint = urls.length === 1 ? '/tools/scraping/scrape' : '/tools/scraping/scrape/batch'
      const response = await apiClient.post(endpoint, scrapingRequest)

      toast({
        title: 'Scraping Started',
        description: `Started scraping ${urls.length} URL(s). Results will be available in the Tools > Web Scraping section.`,
      })

    } catch (error: any) {
      toast({
        title: 'Scraping Error',
        description: error.message || 'Failed to start web scraping',
        variant: 'destructive'
      })
    }
  }

  const generateDimeSuggestions = async () => {
    try {
      const response = await apiClient.post('/ai/dime/suggestions', {
        scenario: scenario.trim(),
        objective: strategicObjective.trim()
      })

      if (response) {
        // Add AI suggestions to each DIME category
        const categories = ['diplomatic', 'information', 'military', 'economic'] as const
        
        categories.forEach(category => {
          if (response[category] && response[category].length > 0) {
            response[category].forEach((suggestion: string) => {
              const newItem = {
                id: Date.now().toString() + Math.random(),
                text: suggestion
              }
              setDIMEData(prev => ({
                ...prev,
                [category]: [...prev[category], newItem]
              }))
            })
          }
        })

        toast({
          title: 'AI Suggestions Generated',
          description: 'GPT-5-mini has provided DIME framework recommendations',
        })
      }
    } catch (error: any) {
      toast({
        title: 'AI Service Unavailable',
        description: 'Configure OpenAI API key to use AI suggestions',
        variant: 'destructive'
      })
    }
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

    if (!scenario.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a scenario for your DIME analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        scenario: scenario.trim(),
        region: region.trim() || undefined,
        timeframe: timeframe.trim() || undefined,
        strategic_objective: strategicObjective.trim() || undefined,
        request_ai_analysis: true
      }

      const response = await apiClient.post<{ session_id: number }>('/frameworks/dime/', payload)
      
      toast({
        title: 'Success',
        description: 'DIME analysis created successfully'
      })

      router.push(`/frameworks/dime/${response.session_id}`)
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
            <Target className="h-5 w-5" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Regional Power Assessment"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="scenario">Scenario (Situation Context)</Label>
            <Textarea
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="Describe the situation, background, and context for this analysis..."
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="strategic-objective">Strategic Objective (Goal)</Label>
              <Input
                id="strategic-objective"
                value={strategicObjective}
                onChange={(e) => setStrategicObjective(e.target.value)}
                placeholder="e.g., Assess regional stability"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g., Southeast Asia"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="timeframe">Timeframe</Label>
            <Input
              id="timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder="e.g., 6 months, Q1 2024"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* URL Scraping Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL Scraping Integration
          </CardTitle>
          <CardDescription>
            Add URLs to scrape for relevant information to inform your DIME analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="url-input">Add URLs for Analysis</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="url-input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/relevant-article"
                onKeyPress={(e) => e.key === 'Enter' && addUrl()}
              />
              <Button type="button" onClick={addUrl} disabled={!urlInput.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
          
          {urls.length > 0 && (
            <div className="space-y-2">
              <Label>URLs to Scrape ({urls.length})</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {urls.map((url, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <span className="text-sm truncate flex-1 mr-2">{url}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUrl(url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button 
                type="button" 
                onClick={scrapeUrls} 
                variant="outline" 
                className="w-full"
              >
                <Globe className="h-4 w-4 mr-2" />
                Start Scraping URLs
              </Button>
            </div>
          )}
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
                    className="flex-1 bg-white dark:bg-gray-900 border-gray-300"
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
                className="w-full border-dashed border-2 hover:bg-white/50 dark:hover:bg-gray-700/30"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {instrument.title} Element
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Assistance */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            AI-Powered DIME Suggestions
          </CardTitle>
          <CardDescription>
            Generate intelligent recommendations for each DIME element using GPT-5-mini
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={generateDimeSuggestions}
            variant="outline" 
            className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
            disabled={!scenario.trim() || !strategicObjective.trim()}
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate AI Suggestions
          </Button>
          {(!scenario.trim() || !strategicObjective.trim()) && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              Fill in scenario and strategic objective to enable AI suggestions
            </p>
          )}
        </CardContent>
      </Card>

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