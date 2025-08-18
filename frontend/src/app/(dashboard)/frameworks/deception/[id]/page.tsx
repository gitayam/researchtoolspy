'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Eye, Shield, FileText, Target, Download, Edit } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface DeceptionIndicator {
  id: string
  category: 'linguistic' | 'logical' | 'behavioral' | 'contextual'
  indicator: string
  evidence: string
  severity: 'low' | 'medium' | 'high'
  confidence: number
}

interface DeceptionSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  data: {
    target_content: string
    source_context?: string
    purpose?: string
    analysis?: {
      credibilityScore: number
      overallAssessment: 'credible' | 'questionable' | 'likely_deceptive'
      indicators: DeceptionIndicator[]
      recommendations: string[]
    }
    indicators: DeceptionIndicator[]
  }
}

export default function DeceptionDetectionViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<DeceptionSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchSession(params.id as string)
    }
  }, [params.id])

  const fetchSession = async (id: string) => {
    try {
      const response = await apiClient.get(`/frameworks/${id}`)
      setSession(response)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load deception detection analysis',
        variant: 'destructive'
      })
      router.push('/frameworks/deception')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'linguistic': return FileText
      case 'logical': return Target
      case 'behavioral': return Eye
      case 'contextual': return Shield
      default: return AlertTriangle
    }
  }

  const getAssessmentColor = (assessment: string) => {
    switch (assessment) {
      case 'credible': return 'bg-green-100 text-green-800 border-green-200'
      case 'questionable': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'likely_deceptive': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="animate-pulse space-y-6">
          <Card>
            <CardHeader>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-100 rounded w-1/4"></div>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis not found</h3>
            <p className="text-gray-500 text-center">
              The deception detection analysis you're looking for doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allIndicators = session.data.analysis?.indicators || session.data.indicators || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Created {new Date(session.created_at).toLocaleDateString()} • 
              Last updated {new Date(session.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => router.push(`/frameworks/deception/${session.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {session.data.purpose && (
            <div>
              <Label className="font-medium">Purpose:</Label>
              <p className="text-gray-700 dark:text-gray-300">{session.data.purpose}</p>
            </div>
          )}
          
          <div>
            <Label className="font-medium">Target Content:</Label>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-2">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {session.data.target_content}
              </p>
            </div>
          </div>

          {session.data.source_context && (
            <div>
              <Label className="font-medium">Source Context:</Label>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{session.data.source_context}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {session.data.analysis && (
        <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <Shield className="h-5 w-5" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {session.data.analysis.credibilityScore}%
                </div>
                <div className="text-sm text-gray-600">Credibility Score</div>
              </div>
              <div className="text-center">
                <Badge 
                  variant="outline" 
                  className={`${getAssessmentColor(session.data.analysis.overallAssessment)} text-lg px-4 py-2`}
                >
                  {session.data.analysis.overallAssessment.replace('_', ' ').toUpperCase()}
                </Badge>
                <div className="text-sm text-gray-600 mt-2">Overall Assessment</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{allIndicators.length}</div>
                <div className="text-sm text-gray-600">Indicators Identified</div>
              </div>
            </div>

            {session.data.analysis.recommendations && session.data.analysis.recommendations.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium mb-3 text-orange-800 dark:text-orange-200">
                  Recommendations:
                </h4>
                <ul className="space-y-2">
                  {session.data.analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-orange-600 mt-1">•</span>
                      <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deception Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Deception Indicators ({allIndicators.length})
          </CardTitle>
          <CardDescription>
            Specific indicators that suggest potential deception or credibility issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allIndicators.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No deception indicators have been identified yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allIndicators.map((indicator) => {
                const IconComponent = getCategoryIcon(indicator.category)
                return (
                  <div key={indicator.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-orange-600" />
                        <Badge variant="outline" className="capitalize">
                          {indicator.category}
                        </Badge>
                        <Badge className={getSeverityColor(indicator.severity)}>
                          {indicator.severity} severity
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {indicator.confidence}% confidence
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          Indicator:
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">{indicator.indicator}</p>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          Supporting Evidence:
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">{indicator.evidence}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <Card className="border-2 border-dashed border-orange-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {allIndicators.filter(i => i.category === 'linguistic').length}
              </div>
              <div className="text-sm text-gray-500">Linguistic</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {allIndicators.filter(i => i.category === 'logical').length}
              </div>
              <div className="text-sm text-gray-500">Logical</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {allIndicators.filter(i => i.category === 'behavioral').length}
              </div>
              <div className="text-sm text-gray-500">Behavioral</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {allIndicators.filter(i => i.category === 'contextual').length}
              </div>
              <div className="text-sm text-gray-500">Contextual</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Label({ className, children, ...props }: { className?: string; children: React.ReactNode }) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ''}`} {...props}>
      {children}
    </label>
  )
}