import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Save,
  Users,
  Building,
  DollarSign,
  Shield,
  Wifi,
  Globe,
  Clock,
  Calendar,
  Eye,
  Plus,
  Trash2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface PMESIIItem {
  id: string
  text: string
}

interface PMESIISession {
  id: string
  title: string
  description?: string
  framework_type: 'pmesii-pt'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    political: PMESIIItem[]
    military: PMESIIItem[]
    economic: PMESIIItem[]
    social: PMESIIItem[]
    information: PMESIIItem[]
    infrastructure: PMESIIItem[]
    physical_environment: PMESIIItem[]
    time: PMESIIItem[]
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function EditPMESIIPTPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [session, setSession] = useState<PMESIISession | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<PMESIISession>(`/analysis-frameworks/sessions/${params.id}`)
        setSession(data)
        setTitle(data.title)
        setDescription(data.description || '')
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load PMESII-PT analysis',
          variant: 'destructive'
        })
        navigate('/frameworks/pmesii-pt')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchSession()
    }
  }, [params.id, navigate, toast])

  const addItem = (category: keyof typeof session.data) => {
    if (!session) return

    const newItem: PMESIIItem = {
      id: Date.now().toString(),
      text: ''
    }

    setSession(prev => ({
      ...prev!,
      data: {
        ...prev!.data,
        [category]: [...prev!.data[category], newItem]
      }
    }))
  }

  const updateItem = (category: keyof typeof session.data, id: string, text: string) => {
    if (!session) return

    setSession(prev => ({
      ...prev!,
      data: {
        ...prev!.data,
        [category]: prev!.data[category].map(item =>
          item.id === id ? { ...item, text } : item
        )
      }
    }))
  }

  const removeItem = (category: keyof typeof session.data, id: string) => {
    if (!session) return

    setSession(prev => ({
      ...prev!,
      data: {
        ...prev!.data,
        [category]: prev!.data[category].filter(item => item.id !== id)
      }
    }))
  }

  const handleSave = async () => {
    if (!session) return

    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your PMESII-PT analysis',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'pmesii-pt',
        data: {
          political: session.data.political.filter(item => item.text.trim()),
          military: session.data.military.filter(item => item.text.trim()),
          economic: session.data.economic.filter(item => item.text.trim()),
          social: session.data.social.filter(item => item.text.trim()),
          information: session.data.information.filter(item => item.text.trim()),
          infrastructure: session.data.infrastructure.filter(item => item.text.trim()),
          physical_environment: session.data.physical_environment.filter(item => item.text.trim()),
          time: session.data.time.filter(item => item.text.trim())
        },
        status: session.status
      }

      await apiClient.put(`/analysis-frameworks/sessions/${params.id}`, payload)

      toast({
        title: 'Success',
        description: 'PMESII-PT analysis updated successfully'
      })

      navigate(`/frameworks/pmesii-pt/${params.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update PMESII-PT analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading PMESII-PT analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const factors = [
    {
      key: 'political' as keyof typeof session.data,
      title: 'Political',
      description: 'Government structures, policies, and political dynamics',
      icon: Users,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      placeholder: 'e.g., Government stability, political parties, electoral processes...'
    },
    {
      key: 'military' as keyof typeof session.data,
      title: 'Military',
      description: 'Armed forces capabilities, organization, and doctrine',
      icon: Shield,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      placeholder: 'e.g., Force structure, military capabilities, defense budget...'
    },
    {
      key: 'economic' as keyof typeof session.data,
      title: 'Economic',
      description: 'Economic systems, resources, and financial factors',
      icon: DollarSign,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      placeholder: 'e.g., GDP, unemployment, trade relationships, natural resources...'
    },
    {
      key: 'social' as keyof typeof session.data,
      title: 'Social',
      description: 'Cultural, demographic, and societal factors',
      icon: Users,
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-500',
      placeholder: 'e.g., Demographics, cultural norms, education levels, social tensions...'
    },
    {
      key: 'information' as keyof typeof session.data,
      title: 'Information',
      description: 'Information systems, media, and communication networks',
      icon: Wifi,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      placeholder: 'e.g., Media landscape, internet penetration, information warfare...'
    },
    {
      key: 'infrastructure' as keyof typeof session.data,
      title: 'Infrastructure',
      description: 'Physical and technological infrastructure systems',
      icon: Building,
      color: 'bg-teal-50 border-teal-200',
      headerColor: 'bg-teal-500',
      placeholder: 'e.g., Transportation, energy, telecommunications, healthcare systems...'
    },
    {
      key: 'physical_environment' as keyof typeof session.data,
      title: 'Physical Environment',
      description: 'Geography, climate, and environmental factors',
      icon: Globe,
      color: 'bg-emerald-50 border-emerald-200',
      headerColor: 'bg-emerald-500',
      placeholder: 'e.g., Terrain, climate, natural disasters, environmental threats...'
    },
    {
      key: 'time' as keyof typeof session.data,
      title: 'Time',
      description: 'Temporal factors and timing considerations',
      icon: Clock,
      color: 'bg-indigo-50 border-indigo-200',
      headerColor: 'bg-indigo-500',
      placeholder: 'e.g., Timeline constraints, seasonal factors, historical context...'
    }
  ]

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit PMESII-PT Analysis</h1>
            <Badge className={statusColors[session.status]}>
              {session.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Created {formatRelativeTime(session.created_at)}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Last updated {formatRelativeTime(session.updated_at)}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/frameworks/pmesii-pt/${params.id}`)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
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
              placeholder="e.g., Regional Stability Assessment"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
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

      {/* PMESII-PT Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {factors.map((factor) => (
          <Card key={factor.key} className={factor.color}>
            <CardHeader className={`${factor.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <factor.icon className="h-5 w-5" />
                {factor.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {factor.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {session.data[factor.key].map((item) => (
                <div key={item.id} className="flex gap-2">
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(factor.key, item.id, e.target.value)}
                    placeholder={factor.placeholder}
                    className="flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    rows={2}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(factor.key, item.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => addItem(factor.key)}
                className="w-full border-dashed border-2 hover:bg-white/50 dark:hover:bg-gray-700/30"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {factor.title} Factor
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analysis Guidelines */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <BarChart3 className="h-5 w-5" />
            PMESII-PT Analysis Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Key Considerations:</h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Analyze interconnections between factors</li>
                <li>• Consider both current state and trends</li>
                <li>• Identify primary and secondary effects</li>
                <li>• Focus on relevant operational environment</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Best Practices:</h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Use multiple sources of information</li>
                <li>• Regularly update your assessment</li>
                <li>• Consider adversary perspectives</li>
                <li>• Document assumptions and uncertainties</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}