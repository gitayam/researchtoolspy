'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  BarChart3, 
  Edit, 
  Download, 
  Share2, 
  Users, 
  Building, 
  DollarSign, 
  Shield, 
  Wifi, 
  Globe, 
  Clock,
  Calendar,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface PMESIISession {
  id: string
  title: string
  description?: string
  framework_type: 'pmesii-pt'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    political: Array<{ id: string; text: string }>
    military: Array<{ id: string; text: string }>
    economic: Array<{ id: string; text: string }>
    social: Array<{ id: string; text: string }>
    information: Array<{ id: string; text: string }>
    infrastructure: Array<{ id: string; text: string }>
    physical_environment: Array<{ id: string; text: string }>
    time: Array<{ id: string; text: string }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function PMESIIPTViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<PMESIISession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<PMESIISession>(`/frameworks/sessions/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load PMESII-PT analysis',
          variant: 'destructive'
        })
        router.push('/frameworks')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchSession()
    }
  }, [params.id, router, toast])

  const handleEdit = () => {
    router.push(`/frameworks/pmesii-pt/${params.id}/edit`)
  }

  const handleExport = () => {
    toast({
      title: 'Export',
      description: 'Export functionality coming soon'
    })
  }

  const handleShare = () => {
    toast({
      title: 'Share',
      description: 'Share functionality coming soon'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading PMESII-PT analysis...</p>
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
      description: 'Government structures and policies',
      icon: Users,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      items: session.data.political
    },
    {
      key: 'military' as keyof typeof session.data,
      title: 'Military',
      description: 'Armed forces capabilities',
      icon: Shield,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      items: session.data.military
    },
    {
      key: 'economic' as keyof typeof session.data,
      title: 'Economic',
      description: 'Economic systems and resources',
      icon: DollarSign,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      items: session.data.economic
    },
    {
      key: 'social' as keyof typeof session.data,
      title: 'Social',
      description: 'Cultural and demographic factors',
      icon: Users,
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-500',
      items: session.data.social
    },
    {
      key: 'information' as keyof typeof session.data,
      title: 'Information',
      description: 'Information systems and media',
      icon: Wifi,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      items: session.data.information
    },
    {
      key: 'infrastructure' as keyof typeof session.data,
      title: 'Infrastructure',
      description: 'Physical infrastructure systems',
      icon: Building,
      color: 'bg-teal-50 border-teal-200',
      headerColor: 'bg-teal-500',
      items: session.data.infrastructure
    },
    {
      key: 'physical_environment' as keyof typeof session.data,
      title: 'Physical Environment',
      description: 'Geography and climate',
      icon: Globe,
      color: 'bg-emerald-50 border-emerald-200',
      headerColor: 'bg-emerald-500',
      items: session.data.physical_environment
    },
    {
      key: 'time' as keyof typeof session.data,
      title: 'Time',
      description: 'Temporal factors',
      icon: Clock,
      color: 'bg-indigo-50 border-indigo-200',
      headerColor: 'bg-indigo-500',
      items: session.data.time
    }
  ]

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const totalFactors = factors.reduce((sum, factor) => sum + factor.items.length, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <Badge className={statusColors[session.status]}>
              {session.status.replace('_', ' ')}
            </Badge>
          </div>
          {session.description && (
            <p className="text-gray-600 dark:text-gray-400">{session.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
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
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleEdit} className="bg-purple-600 hover:bg-purple-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-600">{totalFactors}</div>
              <div className="text-sm text-gray-500">Total Factors</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {factors.filter(f => f.items.length > 0).length}
              </div>
              <div className="text-sm text-gray-500">Domains Analyzed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">8</div>
              <div className="text-sm text-gray-500">PMESII-PT Domains</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round((factors.filter(f => f.items.length > 0).length / 8) * 100)}%
              </div>
              <div className="text-sm text-gray-500">Completion</div>
            </div>
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
            <CardContent className="pt-4">
              {factor.items.length > 0 ? (
                <ul className="space-y-3">
                  {factor.items.map((item, index) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <span className="text-sm font-medium text-gray-500 mt-1 min-w-[24px]">
                        {index + 1}.
                      </span>
                      <span className="text-sm leading-relaxed">{item.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm italic">
                  No {factor.title.toLowerCase()} factors identified
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}