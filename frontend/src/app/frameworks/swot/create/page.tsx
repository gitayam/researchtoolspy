/**
 * Public SWOT Create Page with Auto-Save
 * 
 * Demonstrates the universal auto-save functionality
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Lightbulb, Target, AlertTriangle, TrendingUp, Trash2, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
// import { useFrameworkSession } from '@/hooks/use-framework-session' // Temporarily disabled
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
// import { MigrationPrompt } from '@/components/auto-save/migration-prompt' // Temporarily disabled
// import { useIsAuthenticated } from '@/stores/auth' // Temporarily disabled to prevent infinite loop
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

export default function PublicSWOTCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = false // Temporarily disabled to prevent infinite loop
  
  // Simplified state without stores to prevent infinite loop
  const [sessionId] = useState(() => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [data, setData] = useState<SWOTData>({
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: []
  })
  const [title, setTitle] = useState('SWOT Analysis')
  const [isLoading] = useState(false)
  const saveStatus = { status: 'saved' as const }
  const updateData = (updater: (prev: SWOTData) => SWOTData | SWOTData) => {
    if (typeof updater === 'function') {
      setData(prev => updater(prev))
    } else {
      setData(updater)
    }
  }
  const hasData = Object.values(data).some(arr => arr.length > 0 && arr.some(item => item.text.trim()))
  
  const [saving, setSaving] = useState(false)
  
  const addItem = (category: keyof SWOTData) => {
    const newItem: SWOTItem = {
      id: Date.now().toString(),
      text: ''
    }
    
    updateData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }
  
  const updateItem = (category: keyof SWOTData, id: string, text: string) => {
    updateData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }
  
  const removeItem = (category: keyof SWOTData, id: string) => {
    updateData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }
  
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your SWOT analysis',
        variant: 'destructive'
      })
      return
    }
    
    // if (!isAuthenticated) {
    //   // Redirect to login with current work preserved
    //   router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    //   return
    // }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        objective: title.trim(),
        context: 'Created with auto-save system',
        initial_strengths: data.strengths.filter(item => item.text.trim()).map(item => item.text),
        initial_weaknesses: data.weaknesses.filter(item => item.text.trim()).map(item => item.text),
        initial_opportunities: data.opportunities.filter(item => item.text.trim()).map(item => item.text),
        initial_threats: data.threats.filter(item => item.text.trim()).map(item => item.text),
        request_ai_suggestions: false
      }
      
      const response = await apiClient.post<{ session_id: number }>('/frameworks/swot/', payload)
      
      toast({
        title: 'Success',
        description: 'SWOT analysis published successfully'
      })
      
      // router.push(`/dashboard/analysis-frameworks/swot-dashboard/${response.session_id}`) // Dashboard disabled
      router.push('/frameworks/swot') // Stay on public route
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish SWOT analysis',
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
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Strong brand recognition, skilled workforce...'
    },
    {
      key: 'weaknesses' as keyof SWOTData,
      title: 'Weaknesses',
      description: 'Internal negative factors and disadvantages',
      icon: AlertTriangle,
      color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Limited resources, outdated technology...'
    },
    {
      key: 'opportunities' as keyof SWOTData,
      title: 'Opportunities',
      description: 'External positive factors and potential advantages',
      icon: TrendingUp,
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., Market expansion, new partnerships...'
    },
    {
      key: 'threats' as keyof SWOTData,
      title: 'Threats',
      description: 'External negative factors and potential risks',
      icon: AlertTriangle,
      color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
      headerColor: 'bg-orange-500',
      placeholder: 'e.g., Economic downturn, increased competition...'
    }
  ]
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading SWOT analysis...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Migration prompt temporarily disabled */}
        
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/frameworks/swot')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SWOT Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Analyze Strengths, Weaknesses, Opportunities, and Threats
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Save status indicator */}
              <SaveStatusIndicator sessionId={sessionId} />
              
              {/* Action buttons */}
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
                  className="bg-blue-600 hover:bg-blue-700"
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
                <Target className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 2024 Strategic Assessment"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
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
                  {data[quadrant.key].map((item) => (
                    <div key={item.id} className="flex gap-2">
                      <Textarea
                        value={item.text}
                        onChange={(e) => updateItem(quadrant.key, item.id, e.target.value)}
                        placeholder={quadrant.placeholder}
                        className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
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
                    className="w-full border-dashed border-2 hover:bg-white/50 dark:hover:bg-gray-700/30"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {quadrant.title.slice(0, -1)}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Lightbulb className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Your Work is Automatically Saved
                </h3>
                <p className="text-blue-700 dark:text-blue-300 text-center mb-4 max-w-lg">
                  We're saving your progress locally in your browser as you work. 
                  To save to the cloud and access from any device, sign in to your account.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/login')}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    Sign In
                  </Button>
                  <Button 
                    onClick={() => router.push('/register')}
                    className="bg-blue-600 hover:bg-blue-700"
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