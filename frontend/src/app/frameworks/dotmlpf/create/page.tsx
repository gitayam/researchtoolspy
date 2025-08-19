'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Shield, 
  Plus, 
  Trash2, 
  Save,
  AlertCircle,
  Building,
  Users,
  GraduationCap,
  Package,
  UserCheck,
  Home,
  FileText,
  Briefcase,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { useFrameworkSession } from '@/hooks/use-framework-session'
import { AutoSaveIndicator } from '@/components/auto-save/auto-save-indicator'

interface DOTMLPFCapability {
  id: string
  domain: 'doctrine' | 'organization' | 'training' | 'materiel' | 'leadership' | 'personnel' | 'facilities' | 'policy'
  capability: string
  description: string
  currentState: 'adequate' | 'marginal' | 'inadequate'
  desiredState: string
  gap: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  timeline: 'immediate' | 'short' | 'medium' | 'long'
  resources?: string
  dependencies?: string[]
  notes?: string
}

interface DOTMLPFData {
  title: string
  description: string
  mission: string
  context: string
  capabilities: DOTMLPFCapability[]
}

export default function DOTMLPFCreatePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mission, setMission] = useState('')
  const [context, setContext] = useState('')
  const [capabilities, setCapabilities] = useState<DOTMLPFCapability[]>([])
  const [activeTab, setActiveTab] = useState('doctrine')

  // Initialize auto-save session
  const { 
    sessionId, 
    saveStatus, 
    lastSaved, 
    saveSession,
    publishSession 
  } = useFrameworkSession<DOTMLPFData>({
    frameworkType: 'dotmlpf',
    autoSaveInterval: 30000, // Auto-save every 30 seconds
    initialData: {
      title: '',
      description: '',
      mission: '',
      context: '',
      capabilities: []
    }
  })

  const domains = [
    { id: 'doctrine', name: 'Doctrine', icon: FileText, description: 'Fundamental principles and tactics' },
    { id: 'organization', name: 'Organization', icon: Building, description: 'Organizational structure and design' },
    { id: 'training', name: 'Training', icon: GraduationCap, description: 'Education and skill development' },
    { id: 'materiel', name: 'Materiel', icon: Package, description: 'Equipment and supplies' },
    { id: 'leadership', name: 'Leadership', icon: UserCheck, description: 'Leader development and education' },
    { id: 'personnel', name: 'Personnel', icon: Users, description: 'Human resources and manning' },
    { id: 'facilities', name: 'Facilities', icon: Home, description: 'Infrastructure and real property' },
    { id: 'policy', name: 'Policy', icon: Briefcase, description: 'Rules, regulations, and laws' }
  ]

  // Load saved session data on mount
  useEffect(() => {
    const savedData = localStorage.getItem(`dotmlpf_session_${sessionId}`)
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        if (parsed.data) {
          setTitle(parsed.data.title || '')
          setDescription(parsed.data.description || '')
          setMission(parsed.data.mission || '')
          setContext(parsed.data.context || '')
          setCapabilities(parsed.data.capabilities || [])
        }
      } catch (error) {
        // Invalid saved data, ignore
      }
    }
  }, [sessionId])

  // Save session data whenever it changes
  useEffect(() => {
    const sessionData: DOTMLPFData = {
      title,
      description,
      mission,
      context,
      capabilities
    }
    saveSession(sessionData)
  }, [title, description, mission, context, capabilities, saveSession])

  const addCapability = (domain: string) => {
    const newCapability: DOTMLPFCapability = {
      id: `cap-${Date.now()}`,
      domain: domain as any,
      capability: '',
      description: '',
      currentState: 'adequate',
      desiredState: '',
      gap: '',
      priority: 'medium',
      timeline: 'medium',
      resources: '',
      dependencies: [],
      notes: ''
    }
    setCapabilities([...capabilities, newCapability])
  }

  const updateCapability = (id: string, field: keyof DOTMLPFCapability, value: any) => {
    setCapabilities(capabilities.map(cap => 
      cap.id === id ? { ...cap, [field]: value } : cap
    ))
  }

  const removeCapability = (id: string) => {
    setCapabilities(capabilities.filter(cap => cap.id !== id))
  }

  const getCapabilitiesByDomain = (domain: string) => {
    return capabilities.filter(cap => cap.domain === domain)
  }

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'adequate': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'marginal': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'inadequate': return <XCircle className="h-4 w-4 text-red-500" />
      default: return null
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const handlePublish = async () => {
    if (!title || !mission) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title and mission statement',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const sessionData: DOTMLPFData = {
        title,
        description,
        mission,
        context,
        capabilities
      }
      
      const result = await publishSession(sessionData)
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'DOTMLpf analysis published successfully'
        })
        
        router.push('/frameworks/dotmlpf')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish DOTMLpf analysis',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold">DOTMLpf Analysis</h1>
              <p className="text-gray-600 dark:text-gray-400">Capability-based assessment framework</p>
            </div>
          </div>
          <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
        </div>

        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Analysis Overview</CardTitle>
            <CardDescription>Define the scope and context of your capability assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Analysis Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter analysis title"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this analysis"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="mission">Mission Statement *</Label>
              <Textarea
                id="mission"
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="Define the mission or operational requirement"
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="context">Operational Context</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Describe the operational environment and constraints"
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* DOTMLpf Domains */}
        <Card>
          <CardHeader>
            <CardTitle>Capability Assessment</CardTitle>
            <CardDescription>Analyze capabilities across all DOTMLpf domains</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-6">
                {domains.map((domain) => (
                  <TabsTrigger key={domain.id} value={domain.id} className="text-xs">
                    <domain.icon className="h-4 w-4" />
                  </TabsTrigger>
                ))}
              </TabsList>

              {domains.map((domain) => (
                <TabsContent key={domain.id} value={domain.id} className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <domain.icon className="h-5 w-5" />
                        {domain.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{domain.description}</p>
                    </div>
                    <Button onClick={() => addCapability(domain.id)} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Capability
                    </Button>
                  </div>

                  {getCapabilitiesByDomain(domain.id).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No capabilities defined for {domain.name}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getCapabilitiesByDomain(domain.id).map((capability) => (
                        <Card key={capability.id}>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div>
                                  <Label>Capability Name</Label>
                                  <Input
                                    value={capability.capability}
                                    onChange={(e) => updateCapability(capability.id, 'capability', e.target.value)}
                                    placeholder="Enter capability name"
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>Description</Label>
                                  <Textarea
                                    value={capability.description}
                                    onChange={(e) => updateCapability(capability.id, 'description', e.target.value)}
                                    placeholder="Describe the capability"
                                    className="mt-1"
                                    rows={2}
                                  />
                                </div>
                                <div>
                                  <Label>Current State</Label>
                                  <RadioGroup
                                    value={capability.currentState}
                                    onValueChange={(value) => updateCapability(capability.id, 'currentState', value)}
                                    className="flex gap-4 mt-1"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="adequate" id={`${capability.id}-adequate`} />
                                      <Label htmlFor={`${capability.id}-adequate`} className="flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                        Adequate
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="marginal" id={`${capability.id}-marginal`} />
                                      <Label htmlFor={`${capability.id}-marginal`} className="flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                        Marginal
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="inadequate" id={`${capability.id}-inadequate`} />
                                      <Label htmlFor={`${capability.id}-inadequate`} className="flex items-center gap-1">
                                        <XCircle className="h-3 w-3 text-red-500" />
                                        Inadequate
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <Label>Desired State</Label>
                                  <Input
                                    value={capability.desiredState}
                                    onChange={(e) => updateCapability(capability.id, 'desiredState', e.target.value)}
                                    placeholder="Describe the desired end state"
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label>Gap Analysis</Label>
                                  <Textarea
                                    value={capability.gap}
                                    onChange={(e) => updateCapability(capability.id, 'gap', e.target.value)}
                                    placeholder="Identify gaps between current and desired state"
                                    className="mt-1"
                                    rows={2}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Priority</Label>
                                    <Select
                                      value={capability.priority}
                                      onValueChange={(value) => updateCapability(capability.id, 'priority', value)}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="critical">Critical</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Timeline</Label>
                                    <Select
                                      value={capability.timeline}
                                      onValueChange={(value) => updateCapability(capability.id, 'timeline', value)}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="immediate">Immediate</SelectItem>
                                        <SelectItem value="short">Short-term</SelectItem>
                                        <SelectItem value="medium">Medium-term</SelectItem>
                                        <SelectItem value="long">Long-term</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex justify-between items-center">
                              <div className="flex gap-2">
                                <Badge className={getPriorityColor(capability.priority)}>
                                  {capability.priority} priority
                                </Badge>
                                <Badge variant="outline">
                                  {capability.timeline}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCapability(capability.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" onClick={() => router.push('/frameworks/dotmlpf')}>
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button onClick={handlePublish} disabled={loading}>
              {loading ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Publish Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}