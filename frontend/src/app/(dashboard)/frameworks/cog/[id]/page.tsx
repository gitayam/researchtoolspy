'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Brain, 
  Edit, 
  Download, 
  Share2, 
  Target, 
  Zap, 
  Building, 
  Shield,
  Calendar,
  Eye,
  BarChart3,
  Calculator,
  Lightbulb,
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

interface COGSession {
  id: string
  title: string
  description?: string
  framework_type: 'cog'
  status: 'draft' | 'in_progress' | 'completed'
  data: {
    centers_of_gravity: Array<{ id: string; text: string }>
    critical_capabilities: Array<{ id: string; text: string }>
    critical_requirements: Array<{ id: string; text: string }>
    critical_vulnerabilities: Array<{ id: string; text: string }>
  }
  created_at: string
  updated_at: string
  user_id: string
}

export default function COGViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<COGSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [vulnerabilityAssessment, setVulnerabilityAssessment] = useState<any>(null)
  const [showAssessment, setShowAssessment] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<COGSession>(`/frameworks/sessions/${params.id}`)
        setSession(data)
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load COG analysis',
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
    router.push(`/frameworks/cog/${params.id}/edit`)
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
        description: `COG analysis exported as ${format.toUpperCase()}`
      })
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export analysis',
        variant: 'destructive'
      })
    }
  }

  const performVulnerabilityAssessment = async () => {
    setAnalyzing(true)
    
    try {
      // Simulate API call for vulnerability assessment
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Generate vulnerability assessment based on COG analysis
      const assessment = {
        risk_level: calculateRiskLevel(),
        exploitation_potential: analyzeExploitationPotential(),
        mitigation_strategies: generateMitigationStrategies(),
        critical_nodes: identifyCriticalNodes(),
        recommendations: generateRecommendations()
      }
      
      setVulnerabilityAssessment(assessment)
      setShowAssessment(true)
      
      toast({
        title: 'Assessment Complete',
        description: 'Vulnerability assessment generated successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Assessment Failed',
        description: error.message || 'Failed to generate assessment',
        variant: 'destructive'
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const calculateRiskLevel = () => {
    const vulnCount = session.data.critical_vulnerabilities.length
    const capCount = session.data.critical_capabilities.length
    const ratio = vulnCount / (capCount || 1)
    
    if (ratio > 0.7) return 'High'
    if (ratio > 0.4) return 'Medium'
    return 'Low'
  }

  const analyzeExploitationPotential = () => {
    const vulnerabilities = session.data.critical_vulnerabilities
    if (vulnerabilities.length === 0) return []
    
    return vulnerabilities.slice(0, 3).map(vuln => ({
      vulnerability: vuln.text,
      likelihood: Math.random() > 0.5 ? 'High' : 'Medium',
      impact: Math.random() > 0.5 ? 'Severe' : 'Moderate'
    }))
  }

  const generateMitigationStrategies = () => {
    const strategies = []
    
    if (session.data.critical_vulnerabilities.length > 0) {
      strategies.push('Strengthen defensive measures around identified vulnerabilities')
    }
    if (session.data.critical_requirements.length > 0) {
      strategies.push('Diversify critical requirements to reduce single points of failure')
    }
    if (session.data.centers_of_gravity.length > 1) {
      strategies.push('Implement redundancy across multiple centers of gravity')
    }
    strategies.push('Develop contingency plans for critical capability disruption')
    strategies.push('Establish monitoring systems for early warning indicators')
    
    return strategies
  }

  const identifyCriticalNodes = () => {
    const nodes = []
    
    // Identify critical nodes based on COG analysis
    if (session.data.centers_of_gravity.length > 0) {
      nodes.push({
        type: 'Primary COG',
        element: session.data.centers_of_gravity[0].text,
        criticality: 'Essential'
      })
    }
    
    if (session.data.critical_capabilities.length > 0) {
      nodes.push({
        type: 'Key Capability',
        element: session.data.critical_capabilities[0].text,
        criticality: 'High'
      })
    }
    
    if (session.data.critical_requirements.length > 0) {
      nodes.push({
        type: 'Critical Requirement',
        element: session.data.critical_requirements[0].text,
        criticality: 'High'
      })
    }
    
    return nodes
  }

  const generateRecommendations = () => {
    const recommendations = []
    const vulnCount = session.data.critical_vulnerabilities.length
    const reqCount = session.data.critical_requirements.length
    
    if (vulnCount > 3) {
      recommendations.push('Priority: Address top 3 critical vulnerabilities immediately')
    }
    
    if (reqCount > 5) {
      recommendations.push('Consider consolidating or streamlining critical requirements')
    }
    
    recommendations.push('Implement regular vulnerability assessments')
    recommendations.push('Develop resilience strategies for each critical capability')
    recommendations.push('Establish metrics to monitor COG health and stability')
    
    return recommendations
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
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading COG analysis...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const sections = [
    {
      key: 'centers_of_gravity' as keyof typeof session.data,
      title: 'Centers of Gravity',
      description: 'Primary sources of power and strength',
      icon: Target,
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-500',
      items: session.data.centers_of_gravity
    },
    {
      key: 'critical_capabilities' as keyof typeof session.data,
      title: 'Critical Capabilities',
      description: 'Primary abilities enabling the COG',
      icon: Zap,
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-500',
      items: session.data.critical_capabilities
    },
    {
      key: 'critical_requirements' as keyof typeof session.data,
      title: 'Critical Requirements',
      description: 'Essential conditions and resources',
      icon: Building,
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-500',
      items: session.data.critical_requirements
    },
    {
      key: 'critical_vulnerabilities' as keyof typeof session.data,
      title: 'Critical Vulnerabilities',
      description: 'Deficient or vulnerable aspects',
      icon: Shield,
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-500',
      items: session.data.critical_vulnerabilities
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
          <Button 
            variant="outline" 
            onClick={performVulnerabilityAssessment}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Calculator className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analyze Vulnerabilities
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
          <Button onClick={handleEdit} className="bg-green-600 hover:bg-green-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* COG Analysis Sections */}
      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.key} className={section.color}>
            <CardHeader className={`${section.headerColor} text-white rounded-t-lg`}>
              <CardTitle className="flex items-center gap-2 text-white">
                <section.icon className="h-5 w-5" />
                {section.title}
              </CardTitle>
              <CardDescription className="text-white/90">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {section.items.length > 0 ? (
                <ul className="space-y-3">
                  {section.items.map((item, index) => (
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
                  No {section.title.toLowerCase()} identified
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vulnerability Assessment Results */}
      {showAssessment && vulnerabilityAssessment && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-600" />
              Vulnerability Assessment
            </CardTitle>
            <CardDescription>
              Strategic analysis of critical vulnerabilities and mitigation strategies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Risk Level */}
            <div>
              <h4 className="font-medium mb-2">Overall Risk Level</h4>
              <Badge className={`
                ${vulnerabilityAssessment.risk_level === 'High' ? 'bg-red-100 text-red-800' : ''}
                ${vulnerabilityAssessment.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${vulnerabilityAssessment.risk_level === 'Low' ? 'bg-green-100 text-green-800' : ''}
              `}>
                {vulnerabilityAssessment.risk_level} Risk
              </Badge>
            </div>

            {/* Exploitation Potential */}
            {vulnerabilityAssessment.exploitation_potential.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Exploitation Potential</h4>
                <div className="space-y-2">
                  {vulnerabilityAssessment.exploitation_potential.map((item: any, index: number) => (
                    <div key={index} className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-medium">{item.vulnerability}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Likelihood: {item.likelihood}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Impact: {item.impact}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Nodes */}
            {vulnerabilityAssessment.critical_nodes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Critical Nodes</h4>
                <div className="space-y-2">
                  {vulnerabilityAssessment.critical_nodes.map((node: any, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{node.type}: </span>
                        <span className="text-sm">{node.element}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {node.criticality}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mitigation Strategies */}
            <div>
              <h4 className="font-medium mb-2">Mitigation Strategies</h4>
              <ul className="space-y-2">
                {vulnerabilityAssessment.mitigation_strategies.map((strategy: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-sm">{strategy}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <div className="space-y-2">
                {vulnerabilityAssessment.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600">
                {session.data.centers_of_gravity.length}
              </div>
              <div className="text-sm text-gray-500">Centers of Gravity</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {session.data.critical_capabilities.length}
              </div>
              <div className="text-sm text-gray-500">Critical Capabilities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {session.data.critical_requirements.length}
              </div>
              <div className="text-sm text-gray-500">Critical Requirements</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {session.data.critical_vulnerabilities.length}
              </div>
              <div className="text-sm text-gray-500">Critical Vulnerabilities</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}