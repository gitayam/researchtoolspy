'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Search, 
  Edit, 
  Download, 
  Share2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  X,
  Calendar,
  Eye,
  TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface ACHSession {
  id: string
  title: string
  description?: string
  framework_type: 'ach'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    hypotheses: Array<{ id: string; text: string }>
    evidence: Array<{ 
      id: string
      text: string
      hypotheses_scores: { [hypothesisId: string]: 'supports' | 'contradicts' | 'neutral' | 'not_applicable' }
    }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function ACHViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<ACHSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<ACHSession>(`/frameworks/sessions/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load ACH analysis',
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
    router.push(`/frameworks/ach/${params.id}/edit`)
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
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading ACH analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'supports':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'contradicts':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'neutral':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'not_applicable':
        return <X className="h-4 w-4 text-gray-400" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'supports':
        return 'bg-green-50 border-green-200'
      case 'contradicts':
        return 'bg-red-50 border-red-200'
      case 'neutral':
        return 'bg-yellow-50 border-yellow-200'
      case 'not_applicable':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const calculateHypothesisScore = (hypothesisId: string) => {
    const scores = session.data.evidence.map(e => e.hypotheses_scores[hypothesisId]).filter(Boolean)
    if (scores.length === 0) return { supports: 0, contradicts: 0, neutral: 0, not_applicable: 0 }
    
    return {
      supports: scores.filter(s => s === 'supports').length,
      contradicts: scores.filter(s => s === 'contradicts').length,
      neutral: scores.filter(s => s === 'neutral').length,
      not_applicable: scores.filter(s => s === 'not_applicable').length
    }
  }

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
          <Button onClick={handleEdit} className="bg-orange-600 hover:bg-orange-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {session.data.hypotheses.length}
              </div>
              <div className="text-sm text-gray-500">Hypotheses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {session.data.evidence.length}
              </div>
              <div className="text-sm text-gray-500">Evidence Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {session.data.evidence.reduce((sum, e) => 
                  sum + Object.values(e.hypotheses_scores).filter(s => s === 'supports').length, 0
                )}
              </div>
              <div className="text-sm text-gray-500">Supporting Links</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {session.data.evidence.reduce((sum, e) => 
                  sum + Object.values(e.hypotheses_scores).filter(s => s === 'contradicts').length, 0
                )}
              </div>
              <div className="text-sm text-gray-500">Contradicting Links</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hypotheses Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Hypotheses Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {session.data.hypotheses.map((hypothesis, index) => {
              const scores = calculateHypothesisScore(hypothesis.id)
              const total = scores.supports + scores.contradicts + scores.neutral + scores.not_applicable
              
              return (
                <div key={hypothesis.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge variant="outline" className="mt-1">H{index + 1}</Badge>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{hypothesis.text}</p>
                    </div>
                  </div>
                  
                  {total > 0 && (
                    <div className="ml-14">
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{scores.supports}</span>
                          <span className="text-gray-500">Supports</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium">{scores.neutral}</span>
                          <span className="text-gray-500">Neutral</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="font-medium">{scores.contradicts}</span>
                          <span className="text-gray-500">Contradicts</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <X className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{scores.not_applicable}</span>
                          <span className="text-gray-500">N/A</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Evidence Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Evidence Matrix
          </CardTitle>
          <CardDescription>
            How each piece of evidence relates to the competing hypotheses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session.data.evidence.length > 0 ? (
            <div className="space-y-4">
              {session.data.evidence.map((evidence, evidenceIndex) => (
                <div key={evidence.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge variant="outline" className="mt-1">E{evidenceIndex + 1}</Badge>
                    <p className="text-sm leading-relaxed flex-1">{evidence.text}</p>
                  </div>
                  
                  <div className="ml-14">
                    <div className="grid gap-2">
                      {session.data.hypotheses.map((hypothesis, hIndex) => {
                        const score = evidence.hypotheses_scores[hypothesis.id] || 'neutral'
                        return (
                          <div key={hypothesis.id} className={`flex items-center gap-3 p-2 rounded border ${getScoreColor(score)}`}>
                            <Badge variant="outline" className="text-xs">H{hIndex + 1}</Badge>
                            <div className="flex items-center gap-2">
                              {getScoreIcon(score)}
                              <span className="text-sm capitalize">{score.replace('_', ' ')}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No evidence added yet</p>
              <p className="text-sm text-gray-400">Add evidence to see the evaluation matrix</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}