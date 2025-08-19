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
  Eye,
  Brain,
  Calculator,
  Lightbulb,
  FileText,
  FileDown,
  FileCode,
  Target
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
  const [analyzing, setAnalyzing] = useState(false)
  const [systemAnalysis, setSystemAnalysis] = useState<any>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)

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

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportFrameworkAnalysis({
        title: session.title,
        content: session,
        format
      })
      
      toast({
        title: 'Export Successful',
        description: `PMESII-PT analysis exported as ${format.toUpperCase()}`
      })
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export analysis',
        variant: 'destructive'
      })
    }
  }

  const performSystemAnalysis = async () => {
    setAnalyzing(true)
    
    try {
      // Simulate API call for system analysis
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Generate system analysis based on PMESII-PT factors
      const analysis = {
        system_complexity: calculateSystemComplexity(),
        critical_factors: identifyCriticalFactors(),
        interdependencies: analyzeInterdependencies(),
        stability_assessment: assessSystemStability(),
        risk_areas: identifyRiskAreas(),
        opportunities: identifyOpportunities()
      }
      
      setSystemAnalysis(analysis)
      setShowAnalysis(true)
      
      toast({
        title: 'Analysis Complete',
        description: 'System analysis generated successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to generate analysis',
        variant: 'destructive'
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const calculateSystemComplexity = () => {
    const totalFactors = factors.reduce((sum, f) => sum + f.items.length, 0)
    const activeDomains = factors.filter(f => f.items.length > 0).length
    
    if (totalFactors > 20 && activeDomains >= 6) return 'High'
    if (totalFactors > 10 && activeDomains >= 4) return 'Medium'
    return 'Low'
  }

  const identifyCriticalFactors = () => {
    return factors
      .filter(f => f.items.length > 2)
      .map(f => ({
        domain: f.title,
        count: f.items.length,
        significance: f.items.length > 4 ? 'Critical' : 'Important'
      }))
      .slice(0, 3)
  }

  const analyzeInterdependencies = () => {
    const interdependencies = []
    
    if (session.data.political.length > 0 && session.data.military.length > 0) {
      interdependencies.push('Political-Military coordination')
    }
    if (session.data.economic.length > 0 && session.data.infrastructure.length > 0) {
      interdependencies.push('Economic-Infrastructure linkage')
    }
    if (session.data.social.length > 0 && session.data.information.length > 0) {
      interdependencies.push('Social-Information dynamics')
    }
    if (session.data.physical_environment.length > 0 && session.data.infrastructure.length > 0) {
      interdependencies.push('Environment-Infrastructure constraints')
    }
    
    return interdependencies
  }

  const assessSystemStability = () => {
    const activeDomains = factors.filter(f => f.items.length > 0).length
    const balanceScore = activeDomains / 8
    
    if (balanceScore > 0.75) return 'Stable'
    if (balanceScore > 0.5) return 'Moderate'
    return 'Unstable'
  }

  const identifyRiskAreas = () => {
    const risks = []
    const emptyDomains = factors.filter(f => f.items.length === 0)
    
    if (emptyDomains.length > 0) {
      risks.push(`Gap in ${emptyDomains.map(d => d.title).join(', ')} analysis`)
    }
    if (session.data.time.length === 0) {
      risks.push('Temporal factors not considered')
    }
    if (session.data.physical_environment.length === 0) {
      risks.push('Environmental constraints overlooked')
    }
    
    return risks
  }

  const identifyOpportunities = () => {
    const opportunities = []
    
    if (session.data.economic.length > 2) {
      opportunities.push('Strong economic analysis provides strategic leverage')
    }
    if (session.data.social.length > 2) {
      opportunities.push('Deep social understanding enables targeted engagement')
    }
    if (session.data.information.length > 2) {
      opportunities.push('Information domain mastery offers influence potential')
    }
    
    return opportunities
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
          <Button 
            variant="outline" 
            onClick={performSystemAnalysis}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Calculator className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                System Analysis
              </>
            )}
          </Button>
          
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
          <Button onClick={handleEdit} className="bg-purple-600 hover:bg-purple-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* System Analysis Results */}
      {showAnalysis && systemAnalysis && (
        <Card className="border-2 border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-indigo-600" />
              System Analysis
            </CardTitle>
            <CardDescription>
              Comprehensive PMESII-PT operational environment assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* System Complexity */}
            <div>
              <h4 className="font-medium mb-2">System Complexity</h4>
              <Badge className={`
                ${systemAnalysis.system_complexity === 'High' ? 'bg-red-100 text-red-800' : ''}
                ${systemAnalysis.system_complexity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${systemAnalysis.system_complexity === 'Low' ? 'bg-green-100 text-green-800' : ''}
              `}>
                {systemAnalysis.system_complexity} Complexity
              </Badge>
            </div>

            {/* Stability Assessment */}
            <div>
              <h4 className="font-medium mb-2">System Stability</h4>
              <Badge className={`
                ${systemAnalysis.stability_assessment === 'Stable' ? 'bg-green-100 text-green-800' : ''}
                ${systemAnalysis.stability_assessment === 'Moderate' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${systemAnalysis.stability_assessment === 'Unstable' ? 'bg-red-100 text-red-800' : ''}
              `}>
                {systemAnalysis.stability_assessment}
              </Badge>
            </div>

            {/* Critical Factors */}
            {systemAnalysis.critical_factors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Critical Factors</h4>
                <div className="space-y-2">
                  {systemAnalysis.critical_factors.map((factor: any, index: number) => (
                    <div key={index} className="p-3 bg-white rounded-lg border">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{factor.domain}</span>
                        <Badge variant="outline" className="text-xs">
                          {factor.significance}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {factor.count} factors identified
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interdependencies */}
            {systemAnalysis.interdependencies.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Key Interdependencies</h4>
                <ul className="space-y-2">
                  {systemAnalysis.interdependencies.map((dep: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-indigo-500 mt-0.5" />
                      <span className="text-sm">{dep}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Areas */}
            {systemAnalysis.risk_areas.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Risk Areas</h4>
                <ul className="space-y-2">
                  {systemAnalysis.risk_areas.map((risk: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">⚠</span>
                      <span className="text-sm">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Opportunities */}
            {systemAnalysis.opportunities.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Strategic Opportunities</h4>
                <ul className="space-y-2">
                  {systemAnalysis.opportunities.map((opp: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span className="text-sm">{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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