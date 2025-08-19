'use client'

import { useState } from 'react'
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
import { apiClient } from '@/lib/api'

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
      case 'adequate':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'marginal':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'inadequate':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSave = async (status: 'draft' | 'completed' = 'draft') => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a title for your DOTMLPF-P analysis',
        variant: 'destructive'
      })
      return
    }

    if (capabilities.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one capability assessment',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const sessionData = {
        title,
        description,
        framework_type: 'dotmlpf',
        status,
        data: {
          capabilities,
          mission,
          context
        }
      }

      const response = await apiClient.post('/frameworks/', sessionData)
      
      toast({
        title: 'Success',
        description: 'DOTMLPF-P analysis saved successfully'
      })
      
      router.push(`/frameworks/dotmlpf/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save DOTMLPF-P analysis',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateGapAnalysis = () => {
    const summary = {
      total: capabilities.length,
      critical: capabilities.filter(c => c.priority === 'critical').length,
      inadequate: capabilities.filter(c => c.currentState === 'inadequate').length,
      byDomain: {} as Record<string, number>
    }
    
    domains.forEach(domain => {
      summary.byDomain[domain.id] = getCapabilitiesByDomain(domain.id).length
    })
    
    return summary
  }

  const gapSummary = calculateGapAnalysis()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-bold">DOTMLPF-P Analysis</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities, and Policy capability assessment
        </p>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter analysis title..."
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="mission">Mission Statement</Label>
            <Textarea
              id="mission"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Describe the mission or objective..."
              className="mt-1"
              rows={2}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional context..."
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
              placeholder="Describe the operational environment and constraints..."
              className="mt-1"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gap Analysis Summary */}
      {capabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Gap Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200">
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                  {gapSummary.total}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Total Capabilities</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200">
                <div className="text-2xl font-bold text-red-800 dark:text-red-300">
                  {gapSummary.critical}
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">Critical Gaps</div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200">
                <div className="text-2xl font-bold text-orange-800 dark:text-orange-300">
                  {gapSummary.inadequate}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">Inadequate</div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200">
                <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {Object.values(gapSummary.byDomain).filter(v => v > 0).length}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Domains Affected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capability Assessment Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Capability Assessment by Domain</CardTitle>
          <CardDescription>
            Assess current capabilities and identify gaps across all DOTMLPF-P domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-6">
              {domains.map(domain => {
                const DomainIcon = domain.icon
                const domainCaps = getCapabilitiesByDomain(domain.id)
                return (
                  <TabsTrigger key={domain.id} value={domain.id} className="relative">
                    <DomainIcon className="h-4 w-4 mr-1" />
                    <span className="hidden lg:inline">{domain.name}</span>
                    {domainCaps.length > 0 && (
                      <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                        {domainCaps.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {domains.map(domain => {
              const DomainIcon = domain.icon
              const domainCapabilities = getCapabilitiesByDomain(domain.id)
              
              return (
                <TabsContent key={domain.id} value={domain.id} className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DomainIcon className="h-5 w-5 text-amber-600" />
                      <div>
                        <h3 className="font-semibold">{domain.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{domain.description}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => addCapability(domain.id)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Capability
                    </Button>
                  </div>

                  {domainCapabilities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No capabilities assessed yet. Click "Add Capability" to begin.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {domainCapabilities.map((capability, index) => (
                        <div key={capability.id} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-start justify-between">
                            <Badge variant="outline">C{index + 1}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCapability(capability.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Capability Name</Label>
                              <Input
                                value={capability.capability}
                                onChange={(e) => updateCapability(capability.id, 'capability', e.target.value)}
                                placeholder="Enter capability..."
                                className="mt-1"
                              />
                            </div>
                            
                            <div>
                              <Label>Current State</Label>
                              <Select
                                value={capability.currentState}
                                onValueChange={(value) => updateCapability(capability.id, 'currentState', value)}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="adequate">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                      Adequate
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="marginal">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                      Marginal
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="inadequate">
                                    <div className="flex items-center gap-2">
                                      <XCircle className="h-4 w-4 text-red-600" />
                                      Inadequate
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={capability.description}
                              onChange={(e) => updateCapability(capability.id, 'description', e.target.value)}
                              placeholder="Describe the capability..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>

                          <div>
                            <Label>Desired State</Label>
                            <Textarea
                              value={capability.desiredState}
                              onChange={(e) => updateCapability(capability.id, 'desiredState', e.target.value)}
                              placeholder="Describe the desired end state..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>

                          <div>
                            <Label>Gap Analysis</Label>
                            <Textarea
                              value={capability.gap}
                              onChange={(e) => updateCapability(capability.id, 'gap', e.target.value)}
                              placeholder="Describe the gap between current and desired state..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                  <SelectItem value="immediate">Immediate (0-6 months)</SelectItem>
                                  <SelectItem value="short">Short (6-12 months)</SelectItem>
                                  <SelectItem value="medium">Medium (1-3 years)</SelectItem>
                                  <SelectItem value="long">Long (3+ years)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label>Resources Required</Label>
                              <Input
                                value={capability.resources}
                                onChange={(e) => updateCapability(capability.id, 'resources', e.target.value)}
                                placeholder="Est. resources..."
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Notes</Label>
                            <Textarea
                              value={capability.notes}
                              onChange={(e) => updateCapability(capability.id, 'notes', e.target.value)}
                              placeholder="Additional notes or considerations..."
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push('/frameworks')}
        >
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={loading}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave('completed')}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Complete Analysis
          </Button>
        </div>
      </div>
    </div>
  )
}