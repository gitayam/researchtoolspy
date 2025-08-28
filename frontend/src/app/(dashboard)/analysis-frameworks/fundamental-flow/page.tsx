'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, GitBranch, ArrowRight, Calendar, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface FundamentalFlowSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  data: {
    problem?: string
    nodes?: any[]
    causal_chains?: any[]
    context?: string
  }
}

export default function FundamentalFlowPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<FundamentalFlowSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await apiClient.get('/frameworks/?framework_type=fundamental_flow')
      setSessions(response.sessions || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load Fundamental Flow analyses',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fundamental Flow</h1>
            <p className="text-gray-600 dark:text-gray-400">Loading analyses...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded"></div>
                  <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fundamental Flow Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Map causal relationships and flow of influence to understand root causes and effects
          </p>
        </div>
        <Button 
          onClick={() => router.push('/frameworks/fundamental-flow/create')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Overview */}
      <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <GitBranch className="h-5 w-5" />
            About Fundamental Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 dark:text-blue-300">
          <p className="mb-4">
            Fundamental Flow Analysis is a structured approach to understanding complex causal relationships 
            by mapping the flow of influence from root causes through contributing factors to final outcomes. 
            This technique helps identify intervention points and understand system dynamics.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Key Applications:</h4>
              <ul className="text-sm space-y-1">
                <li>• Problem root cause analysis</li>
                <li>• System failure investigation</li>
                <li>• Process improvement planning</li>
                <li>• Risk factor identification</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Flow Elements:</h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>Root Causes:</strong> Fundamental underlying factors</li>
                <li>• <strong>Contributing Factors:</strong> Amplifying elements</li>
                <li>• <strong>Enabling Conditions:</strong> Facilitating circumstances</li>
                <li>• <strong>Trigger Events:</strong> Initiating incidents</li>
                <li>• <strong>Outcomes:</strong> Final results and consequences</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitBranch className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
            <p className="text-gray-500 text-center mb-6 max-w-sm">
              Create your first Fundamental Flow analysis to map causal relationships and identify root causes.
            </p>
            <Button 
              onClick={() => router.push('/frameworks/fundamental-flow/create')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <Link key={session.id} href={`/frameworks/fundamental-flow/${session.id}`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{session.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Analysis
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {session.data.problem && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      Problem: {session.data.problem}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {session.data.nodes?.length || 0} elements
                      </span>
                      <span className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {session.data.causal_chains?.length || 0} chains
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex gap-1">
                      {session.data.nodes && session.data.nodes.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {session.data.nodes.filter((n: any) => n.type === 'root_cause').length} root causes
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      Updated {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}