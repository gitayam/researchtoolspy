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
  Eye,
  Brain,
  BarChart3,
  Target,
  Lightbulb,
  Calculator,
  FileText,
  FileDown,
  FileCode
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { exportFrameworkAnalysis, ExportFormat } from '@/lib/export-utils'

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
  const [analyzing, setAnalyzing] = useState(false)
  const [powerAssessment, setPowerAssessment] = useState<any>(null)
  const [showAssessment, setShowAssessment] = useState(false)

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

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportFrameworkAnalysis({
        title: session.title,
        content: session,
        format
      })
      
      toast({
        title: 'Export Successful',
        description: `DIME analysis exported as ${format.toUpperCase()}`
      })
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export analysis',
        variant: 'destructive'
      })
    }
  }

  const handleShare = () => {
    toast({
      title: 'Share',
      description: 'Share functionality coming soon'
    })
  }

  const performPowerAnalysis = async () => {
    if (!session) return

    setAnalyzing(true)
    try {
      const totalElements = instruments.reduce((sum, instrument) => sum + instrument.items.length, 0)
      
      // Calculate power distribution
      const powerDistribution = instruments.map(instrument => ({
        instrument: instrument.title,
        count: instrument.items.length,
        percentage: totalElements > 0 ? Math.round((instrument.items.length / totalElements) * 100) : 0,
        strength: instrument.items.length > 3 ? 'Strong' : instrument.items.length > 1 ? 'Moderate' : instrument.items.length > 0 ? 'Weak' : 'None'
      }))

      // Generate strategic insights
      const dominantInstruments = powerDistribution.filter(p => p.percentage > 25)
      const underutilizedInstruments = powerDistribution.filter(p => p.count === 0)
      
      const assessment = {
        distribution: powerDistribution,
        insights: [
          `Power Balance: ${dominantInstruments.length > 0 ? `Primarily focused on ${dominantInstruments.map(d => d.instrument).join(' and ')} instruments` : 'Balanced across all DIME instruments'}`,
          `Coverage: ${4 - underutilizedInstruments.length} out of 4 DIME instruments are actively utilized`,
          `Strategic Posture: ${totalElements > 12 ? 'Comprehensive multi-domain approach' : totalElements > 6 ? 'Moderate engagement' : 'Limited scope analysis'}`,
          underutilizedInstruments.length > 0 ? `Gaps: ${underutilizedInstruments.map(u => u.instrument).join(', ')} instruments need development` : 'All instruments are engaged',
          `Recommendation: ${dominantInstruments.length === 1 ? 'Consider diversifying power instruments for resilience' : 'Maintain current balanced approach while strengthening weaker areas'}`
        ],
        totalPowerElements: totalElements,
        balanceScore: Math.round(((4 - underutilizedInstruments.length) / 4) * 100)
      }

      setPowerAssessment(assessment)
      setShowAssessment(true)
      
      toast({
        title: 'Power Analysis Complete',
        description: 'National power assessment generated successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Analysis Error',
        description: error.message || 'Failed to generate power analysis',
        variant: 'destructive'
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const generateStrategies = () => {
    if (!session) return

    toast({
      title: 'Strategy Generation',
      description: 'Multi-domain strategies will be generated based on your DIME analysis'
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('word')}>
                <FileText className="h-4 w-4 mr-2" />
                Export as Word
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('markdown')}>
                <FileCode className="h-4 w-4 mr-2" />
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileDown className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleEdit} className="bg-red-600 hover:bg-red-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Power Analysis Overview
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={performPowerAnalysis}
                disabled={analyzing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                {analyzing ? 'Analyzing...' : 'Analyze Power'}
              </Button>
              <Button 
                onClick={generateStrategies}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Target className="h-4 w-4" />
                Generate Strategies
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
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
              <div className="text-sm text-gray-500">Coverage</div>
            </div>
          </div>

          {/* Power Distribution */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            {instruments.map((instrument) => (
              <div key={instrument.key} className="text-center">
                <div className={`text-lg font-semibold ${
                  instrument.items.length > 3 ? 'text-green-600' :
                  instrument.items.length > 1 ? 'text-yellow-600' :
                  instrument.items.length > 0 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {instrument.items.length}
                </div>
                <div className="text-xs text-gray-500">{instrument.title}</div>
                <div className="text-xs text-gray-400">
                  {totalElements > 0 ? Math.round((instrument.items.length / totalElements) * 100) : 0}%
                </div>
              </div>
            ))}
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

      {/* Power Assessment Results */}
      {showAssessment && powerAssessment && (
        <Card className="border-2 border-dashed border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              National Power Assessment
            </CardTitle>
            <CardDescription>
              Analysis of power distribution across DIME instruments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Power Distribution Chart */}
            <div className="mb-6">
              <h4 className="font-medium text-red-800 mb-3">Power Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {powerAssessment.distribution.map((item: any) => (
                  <div key={item.instrument} className="bg-white rounded-lg p-3 border border-red-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{item.instrument}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.strength === 'Strong' ? 'bg-green-100 text-green-800' :
                        item.strength === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                        item.strength === 'Weak' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.strength}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{item.count}</div>
                    <div className="text-xs text-gray-500">{item.percentage}% of total</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Insights */}
            <div className="space-y-4">
              <h4 className="font-medium text-red-800">Strategic Insights</h4>
              {powerAssessment.insights.map((insight: string, index: number) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-red-200">
                  <p className="text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>

            {/* Assessment Summary */}
            <div className="mt-6 pt-4 border-t border-red-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {powerAssessment.totalPowerElements}
                  </div>
                  <div className="text-xs text-gray-500">Total Power Elements</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {powerAssessment.balanceScore}%
                  </div>
                  <div className="text-xs text-gray-500">Balance Score</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {powerAssessment.distribution.filter((d: any) => d.count > 0).length}/4
                  </div>
                  <div className="text-xs text-gray-500">Active Instruments</div>
                </div>
              </div>
              <p className="text-xs text-red-600 mt-4">
                💡 This assessment analyzes the distribution and utilization of national power instruments. 
                A balanced approach across all DIME instruments typically provides the most strategic flexibility.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}