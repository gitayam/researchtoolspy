'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, GitBranch, ArrowRight, Download, Edit, Target } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface FlowNode {
  id: string
  type: 'root_cause' | 'contributing_factor' | 'enabling_condition' | 'trigger_event' | 'outcome'
  title: string
  description: string
  level: number
  connections: string[]
}

interface CausalChain {
  id: string
  name: string
  description: string
  nodes: FlowNode[]
  strength: 'weak' | 'moderate' | 'strong'
  confidence: number
}

interface FundamentalFlowSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  data: {
    problem: string
    context?: string
    scope?: string
    nodes: FlowNode[]
    causal_chains: CausalChain[]
  }
}

export default function FundamentalFlowViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [session, setSession] = useState<FundamentalFlowSession | null>(null)
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
        description: 'Failed to load Fundamental Flow analysis',
        variant: 'destructive'
      })
      router.push('/frameworks/fundamental-flow')
    } finally {
      setLoading(false)
    }
  }

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'root_cause': return 'bg-red-100 text-red-800 border-red-200'
      case 'contributing_factor': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'enabling_condition': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'trigger_event': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'outcome': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'bg-green-100 text-green-800 border-green-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'weak': return 'bg-red-100 text-red-800 border-red-200'
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
            <GitBranch className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis not found</h3>
            <p className="text-gray-500 text-center">
              The Fundamental Flow analysis you're looking for doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const nodes = session.data.nodes || []
  const chains = session.data.causal_chains || []

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
          <Button onClick={() => router.push(`/frameworks/fundamental-flow/${session.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Analysis Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="font-medium">Problem Statement:</Label>
            <p className="text-gray-700 dark:text-gray-300 mt-1">{session.data.problem}</p>
          </div>
          
          {session.data.context && (
            <div>
              <Label className="font-medium">Context & Background:</Label>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{session.data.context}</p>
            </div>
          )}

          {session.data.scope && (
            <div>
              <Label className="font-medium">Analysis Scope:</Label>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{session.data.scope}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <GitBranch className="h-5 w-5" />
            Flow Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">{nodes.length}</div>
              <div className="text-sm text-gray-600">Total Elements</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-600">
                {nodes.filter(n => n.type === 'root_cause').length}
              </div>
              <div className="text-sm text-gray-600">Root Causes</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-600">
                {nodes.filter(n => n.type === 'contributing_factor').length}
              </div>
              <div className="text-sm text-gray-600">Contributing Factors</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">
                {nodes.filter(n => n.type === 'outcome').length}
              </div>
              <div className="text-sm text-gray-600">Outcomes</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">{chains.length}</div>
              <div className="text-sm text-gray-600">Causal Chains</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Elements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Flow Elements ({nodes.length})
          </CardTitle>
          <CardDescription>
            Elements in your causal flow organized by type and level
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No flow elements have been defined yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {nodes
                .sort((a, b) => a.level - b.level || a.type.localeCompare(b.type))
                .map((node) => (
                  <div key={node.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={getNodeTypeColor(node.type)}>
                          {node.type.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-gray-500">Level {node.level}</span>
                      </div>
                    </div>

                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {node.title}
                    </h4>

                    <p className="text-gray-700 dark:text-gray-300">{node.description}</p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Causal Chains */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Causal Chains ({chains.length})
          </CardTitle>
          <CardDescription>
            Defined cause-and-effect relationships and their strength
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chains.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ArrowRight className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No causal chains have been defined yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chains.map((chain) => (
                <div key={chain.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {chain.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge className={getStrengthColor(chain.strength)}>
                        {chain.strength} relationship
                      </Badge>
                      <span className="text-sm text-gray-500">{chain.confidence}% confidence</span>
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300">{chain.description}</p>
                </div>
              ))}
            </div>
          )}
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