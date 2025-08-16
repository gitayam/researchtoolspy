'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Target, 
  Edit, 
  Download, 
  Share2, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  User,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface SWOTSession {
  id: string
  title: string
  description?: string
  framework_type: 'swot'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    strengths: Array<{ id: string; text: string }>
    weaknesses: Array<{ id: string; text: string }>
    opportunities: Array<{ id: string; text: string }>
    threats: Array<{ id: string; text: string }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function SWOTViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<SWOTSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<SWOTSession>(`/frameworks/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load SWOT analysis',
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
    router.push(`/frameworks/swot/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading SWOT analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const quadrants = [
    {
      key: 'strengths' as keyof typeof session.data,
      title: 'Strengths',
      description: 'Internal positive factors',
      icon: Target,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      items: session.data.strengths
    },
    {
      key: 'weaknesses' as keyof typeof session.data,
      title: 'Weaknesses',
      description: 'Internal negative factors',
      icon: AlertTriangle,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      items: session.data.weaknesses
    },
    {
      key: 'opportunities' as keyof typeof session.data,
      title: 'Opportunities',
      description: 'External positive factors',
      icon: TrendingUp,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      items: session.data.opportunities
    },
    {
      key: 'threats' as keyof typeof session.data,
      title: 'Threats',
      description: 'External negative factors',
      icon: AlertTriangle,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      items: session.data.threats
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
          <Button onClick={handleEdit} className="bg-blue-600 hover:bg-blue-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* SWOT Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {quadrants.map((quadrant) => (
          <Card key={quadrant.key} className={quadrant.color}>
            <CardHeader className={`${quadrant.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <quadrant.icon className="h-5 w-5" />
                {quadrant.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {quadrant.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {quadrant.items.length > 0 ? (
                <ul className="space-y-2">
                  {quadrant.items.map((item, index) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span className="text-sm font-medium text-gray-500 mt-1">
                        {index + 1}.
                      </span>
                      <span className="text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm italic">
                  No {quadrant.title.toLowerCase()} identified
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {session.data.strengths.length}
              </div>
              <div className="text-sm text-gray-500">Strengths</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {session.data.weaknesses.length}
              </div>
              <div className="text-sm text-gray-500">Weaknesses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {session.data.opportunities.length}
              </div>
              <div className="text-sm text-gray-500">Opportunities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {session.data.threats.length}
              </div>
              <div className="text-sm text-gray-500">Threats</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}