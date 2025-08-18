/**
 * Public PMESII-PT Create Page with Auto-Save
 * 
 * Full PMESII-PT implementation with auto-save functionality
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Save, 
  BarChart3, 
  Users, 
  Building, 
  DollarSign, 
  Shield, 
  Wifi, 
  Globe, 
  Clock, 
  Trash2,
  ArrowLeft
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useFrameworkSession } from '@/hooks/use-framework-session'
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
import { MigrationPrompt } from '@/components/auto-save/migration-prompt'
import { useIsAuthenticated } from '@/stores/auth'
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

const PMESII_CATEGORIES = [
  { key: 'political' as keyof PMESIIData, label: 'Political', icon: Building, color: 'bg-red-500' },
  { key: 'military' as keyof PMESIIData, label: 'Military', icon: Shield, color: 'bg-blue-500' },
  { key: 'economic' as keyof PMESIIData, label: 'Economic', icon: DollarSign, color: 'bg-green-500' },
  { key: 'social' as keyof PMESIIData, label: 'Social', icon: Users, color: 'bg-purple-500' },
  { key: 'information' as keyof PMESIIData, label: 'Information', icon: Wifi, color: 'bg-orange-500' },
  { key: 'infrastructure' as keyof PMESIIData, label: 'Infrastructure', icon: Building, color: 'bg-gray-500' },
  { key: 'physical_environment' as keyof PMESIIData, label: 'Physical Environment', icon: Globe, color: 'bg-emerald-500' },
  { key: 'time' as keyof PMESIIData, label: 'Time', icon: Clock, color: 'bg-yellow-500' }
]

export default function PublicPMESIIPTCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = useIsAuthenticated()
  
  // Use the universal framework session hook
  const {
    sessionId,
    data,
    title,
    isLoading,
    saveStatus,
    updateData,
    setTitle,
    hasData
  } = useFrameworkSession<PMESIIData>('pmesii-pt', {
    political: [],
    military: [],
    economic: [],
    social: [],
    information: [],
    infrastructure: [],
    physical_environment: [],
    time: []
  }, {
    title: 'PMESII-PT Analysis',
    loadFromUrl: true,
    autoSaveEnabled: true
  })
  
  const [saving, setSaving] = useState(false)
  
  // Add item to category
  const addItem = (category: keyof PMESIIData) => {
    const newItem: PMESIIItem = {
      id: Date.now().toString(),
      text: ''
    }
    
    updateData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }))
  }
  
  // Update item in category
  const updateItem = (category: keyof PMESIIData, id: string, text: string) => {
    updateData(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, text } : item
      )
    }))
  }
  
  // Remove item from category
  const removeItem = (category: keyof PMESIIData, id: string) => {
    updateData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }))
  }
  
  // Publish analysis
  const handlePublish = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your PMESII-PT analysis',
        variant: 'destructive'
      })
      return
    }
    
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: 'Created with auto-save system',
        framework_type: 'pmesii-pt',
        data: {
          political: data.political.filter(item => item.text.trim()),
          military: data.military.filter(item => item.text.trim()),
          economic: data.economic.filter(item => item.text.trim()),
          social: data.social.filter(item => item.text.trim()),
          information: data.information.filter(item => item.text.trim()),
          infrastructure: data.infrastructure.filter(item => item.text.trim()),
          physical_environment: data.physical_environment.filter(item => item.text.trim()),
          time: data.time.filter(item => item.text.trim())
        }
      }
      
      const response = await apiClient.post('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'PMESII-PT analysis published successfully'
      })
      
      router.push(`/dashboard/analysis-frameworks/pmesii-pt/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish PMESII-PT analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading PMESII-PT analysis...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Migration prompt for authenticated users */}
        <MigrationPrompt compact />
        
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/frameworks/pmesii-pt')}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PMESII-PT Analysis</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time
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
                <BarChart3 className="h-5 w-5" />
                Analysis Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Regional Security Assessment Q1 2024"
                  className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* PMESII-PT Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PMESII_CATEGORIES.map((category) => {
              const Icon = category.icon
              const items = data[category.key] || []
              
              return (
                <Card key={category.key} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${category.color}`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        {category.label} ({items.length})
                      </div>
                      <Button 
                        onClick={() => addItem(category.key)} 
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Add {category.label.toLowerCase()} factors for analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {items.map((item, index) => (
                      <div key={item.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <Textarea
                            value={item.text}
                            onChange={(e) => updateItem(category.key, item.id, e.target.value)}
                            placeholder={`Describe ${category.label.toLowerCase()} factor...`}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            rows={2}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(category.key, item.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {items.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Icon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                        <p>No {category.label.toLowerCase()} factors yet. Add your first factor to get started.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          
          {/* Info for Anonymous Users */}
          {!isAuthenticated && (
            <Card className="border-dashed border-2 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BarChart3 className="h-12 w-12 text-green-500 mb-4" />
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