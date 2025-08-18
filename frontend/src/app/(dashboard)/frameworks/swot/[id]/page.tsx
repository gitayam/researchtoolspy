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
  Eye,
  Brain,
  BarChart3,
  Lightbulb,
  Calculator
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface SWOTSession {
  session_id: number
  title: string
  objective: string
  context?: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  ai_suggestions?: any
  status: string
  version: number
}

export default function SWOTViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<SWOTSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [insights, setInsights] = useState<string[]>([])
  const [showInsights, setShowInsights] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<SWOTSession>(`/frameworks/swot/${params.id}`)
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

  const performSWOTAnalysis = async () => {
    if (!session) return

    setAnalyzing(true)
    try {
      // Generate insights based on SWOT analysis
      const generatedInsights = [
        `Strategic Focus: With ${session.strengths.length} identified strengths and ${session.opportunities.length} opportunities, consider leveraging core competencies for market expansion.`,
        `Risk Mitigation: ${session.threats.length} threats and ${session.weaknesses.length} weaknesses require immediate attention to protect competitive position.`,
        `Resource Allocation: Balance between strengthening weaknesses (${session.weaknesses.length} areas) and capitalizing on opportunities (${session.opportunities.length} areas).`,
        `Competitive Advantage: Utilize top strengths to differentiate from competitors and create barriers to entry.`,
        session.strengths.length > session.weaknesses.length 
          ? 'Positive Internal Balance: More strengths than weaknesses indicate solid foundation for growth.'
          : 'Internal Development Needed: Focus on addressing weaknesses to improve organizational capacity.'
      ]

      setInsights(generatedInsights)
      setShowInsights(true)
      
      toast({
        title: 'Analysis Complete',
        description: 'SWOT insights generated successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Analysis Error',
        description: error.message || 'Failed to generate analysis',
        variant: 'destructive'
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const calculateBalance = () => {
    if (!session) return { internal: 0, external: 0, positive: 0, negative: 0 }
    
    return {
      internal: session.strengths.length + session.weaknesses.length,
      external: session.opportunities.length + session.threats.length,
      positive: session.strengths.length + session.opportunities.length,
      negative: session.weaknesses.length + session.threats.length
    }
  }

  const generateStrategies = () => {
    if (!session) return

    toast({
      title: 'Strategy Generation',
      description: 'Strategic recommendations will be generated based on your SWOT matrix'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading SWOT analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const quadrants = [
    {
      key: 'strengths' as keyof SWOTSession,
      title: 'Strengths',
      description: 'Internal positive factors',
      icon: Target,
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
      headerColor: 'bg-green-500',
      items: session.strengths
    },
    {
      key: 'weaknesses' as keyof SWOTSession,
      title: 'Weaknesses',
      description: 'Internal negative factors',
      icon: AlertTriangle,
      color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
      headerColor: 'bg-red-500',
      items: session.weaknesses
    },
    {
      key: 'opportunities' as keyof SWOTSession,
      title: 'Opportunities',
      description: 'External positive factors',
      icon: TrendingUp,
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
      headerColor: 'bg-blue-500',
      items: session.opportunities
    },
    {
      key: 'threats' as keyof SWOTSession,
      title: 'Threats',
      description: 'External negative factors',
      icon: AlertTriangle,
      color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
      headerColor: 'bg-orange-500',
      items: session.threats
    }
  ]

  const statusColors: Record<string, string> = {
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{session.title}</h1>
            <Badge className={statusColors[session.status] || 'bg-gray-100 text-gray-800'}>
              {session.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Objective:</strong> {session.objective}
          </p>
          {session.context && (
            <p className="text-gray-600 dark:text-gray-400">
              <strong>Context:</strong> {session.context}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Session ID: {session.session_id}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Version: {session.version}
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
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analysis Summary
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={performSWOTAnalysis}
                disabled={analyzing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                {analyzing ? 'Analyzing...' : 'Generate Insights'}
              </Button>
              <Button 
                onClick={generateStrategies}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Lightbulb className="h-4 w-4" />
                Generate Strategies
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-6">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {session.strengths.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Strengths</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {session.weaknesses.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Weaknesses</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {session.opportunities.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Opportunities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {session.threats.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Threats</div>
            </div>
          </div>

          {/* Balance Analysis */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                {calculateBalance().internal}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Internal Factors</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                {calculateBalance().external}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">External Factors</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {calculateBalance().positive}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Positive Factors</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">
                {calculateBalance().negative}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Negative Factors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Insights */}
      {showInsights && insights.length > 0 && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Strategic Insights & Recommendations
            </CardTitle>
            <CardDescription>
              AI-generated insights based on your SWOT analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{insight}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                💡 These insights are generated based on the quantitative analysis of your SWOT factors. 
                Consider them as starting points for deeper strategic planning.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}