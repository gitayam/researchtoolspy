'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Shield, 
  Edit, 
  Download, 
  Share2, 
  Briefcase, 
  Wifi, 
  DollarSign,
  Calendar,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface DIMESession {
  id: string
  title: string
  description?: string
  framework_type: 'dime'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    diplomatic: Array<{ id: string; text: string }>
    information: Array<{ id: string; text: string }>
    military: Array<{ id: string; text: string }>
    economic: Array<{ id: string; text: string }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function DIMEViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<DIMESession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<DIMESession>(`/frameworks/sessions/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load DIME analysis',
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
    router.push(`/frameworks/dime/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading DIME analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const instruments = [
    {
      key: 'diplomatic' as keyof typeof session.data,
      title: 'Diplomatic',
      description: 'Political negotiations and international relations',
      icon: Briefcase,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      items: session.data.diplomatic
    },
    {
      key: 'information' as keyof typeof session.data,
      title: 'Information',
      description: 'Information operations and communication',
      icon: Wifi,
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-500',
      items: session.data.information
    },
    {
      key: 'military' as keyof typeof session.data,
      title: 'Military',
      description: 'Armed forces and defense capabilities',
      icon: Shield,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      items: session.data.military
    },
    {
      key: 'economic' as keyof typeof session.data,
      title: 'Economic',
      description: 'Trade policies and financial instruments',
      icon: DollarSign,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      items: session.data.economic
    }
  ]

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  const totalElements = instruments.reduce((sum, instrument) => sum + instrument.items.length, 0)

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
          <Button onClick={handleEdit} className="bg-red-600 hover:bg-red-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600">{totalElements}</div>
              <div className="text-sm text-gray-500">Total Elements</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {instruments.filter(i => i.items.length > 0).length}
              </div>
              <div className="text-sm text-gray-500">Instruments Used</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">4</div>
              <div className="text-sm text-gray-500">DIME Domains</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round((instruments.filter(i => i.items.length > 0).length / 4) * 100)}%
              </div>
              <div className="text-sm text-gray-500">Completion</div>
            </div>
          </div>
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
            <CardContent className="pt-4">
              {instrument.items.length > 0 ? (
                <ul className="space-y-3">
                  {instrument.items.map((item, index) => (
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
                  No {instrument.title.toLowerCase()} elements identified
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}