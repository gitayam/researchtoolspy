'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, GitBranch, ArrowRight, Plus, Trash2, Target, Brain, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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

export default function CreateFundamentalFlowPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [context, setContext] = useState('')
  const [scope, setScope] = useState('')
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [chains, setChains] = useState<CausalChain[]>([])
  const [saving, setSaving] = useState(false)

  const addNode = () => {
    const newNode: FlowNode = {
      id: Date.now().toString(),
      type: 'contributing_factor',
      title: '',
      description: '',
      level: 1,
      connections: []
    }
    setNodes(prev => [...prev, newNode])
  }

  const updateNode = (id: string, field: keyof FlowNode, value: any) => {
    setNodes(prev => prev.map(node => 
      node.id === id ? { ...node, [field]: value } : node
    ))
  }

  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(node => node.id !== id))
    // Remove connections to deleted node
    setNodes(prev => prev.map(node => ({
      ...node,
      connections: node.connections.filter(connId => connId !== id)
    })))
  }

  const addChain = () => {
    const newChain: CausalChain = {
      id: Date.now().toString(),
      name: '',
      description: '',
      nodes: [],
      strength: 'moderate',
      confidence: 50
    }
    setChains(prev => [...prev, newChain])
  }

  const updateChain = (id: string, field: keyof CausalChain, value: any) => {
    setChains(prev => prev.map(chain => 
      chain.id === id ? { ...chain, [field]: value } : chain
    ))
  }

  const removeChain = (id: string) => {
    setChains(prev => prev.filter(chain => chain.id !== id))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your Fundamental Flow analysis',
        variant: 'destructive'
      })
      return
    }

    if (!problem.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please describe the problem or issue being analyzed',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        framework_type: 'fundamental_flow',
        data: {
          problem: problem.trim(),
          context: context.trim() || undefined,
          scope: scope.trim() || undefined,
          nodes: nodes.filter(n => n.title.trim()),
          causal_chains: chains.filter(c => c.name.trim()),
        }
      }

      const response = await apiClient.post<{ id: string }>('/frameworks/', payload)
      
      toast({
        title: 'Success',
        description: 'Fundamental Flow analysis saved successfully'
      })

      router.push(`/frameworks/fundamental-flow/${response.id}`)
    } catch (error: any) {
      toast({
        title: 'Save Error',
        description: error.message || 'Failed to save Fundamental Flow analysis',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fundamental Flow Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Map causal relationships and flow of influence to understand root causes and effects
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <Brain className="h-3 w-3 mr-1" />
              AI-Enhanced (Coming Soon)
            </span>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Analysis'}
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Analysis Framework
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Analysis Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Supply Chain Disruption Analysis"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="problem">Problem Statement</Label>
            <Textarea
              id="problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Clearly define the problem or issue you're analyzing..."
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="context">Context & Background</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Provide relevant background information..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="scope">Analysis Scope</Label>
              <Textarea
                id="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Define the boundaries and limitations of your analysis..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Nodes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Flow Elements
            </div>
            <Button onClick={addNode} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Element
            </Button>
          </CardTitle>
          <CardDescription>
            Identify and categorize different elements in your causal flow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {nodes.map((node) => (
            <div key={node.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={getNodeTypeColor(node.type)}>
                    {node.type.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-gray-500">Level {node.level}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeNode(node.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Element Type</Label>
                  <select
                    value={node.type}
                    onChange={(e) => updateNode(node.id, 'type', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
                  >
                    <option value="root_cause">Root Cause</option>
                    <option value="contributing_factor">Contributing Factor</option>
                    <option value="enabling_condition">Enabling Condition</option>
                    <option value="trigger_event">Trigger Event</option>
                    <option value="outcome">Outcome</option>
                  </select>
                </div>
                <div>
                  <Label>Flow Level</Label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={node.level}
                    onChange={(e) => updateNode(node.id, 'level', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Element Title</Label>
                <Input
                  value={node.title}
                  onChange={(e) => updateNode(node.id, 'title', e.target.value)}
                  placeholder="Brief title for this element..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={node.description}
                  onChange={(e) => updateNode(node.id, 'description', e.target.value)}
                  placeholder="Detailed description of this element's role in the flow..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          ))}

          {nodes.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <GitBranch className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No flow elements added yet</p>
              <p className="text-sm text-gray-400">
                Add elements to map your causal flow
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Causal Chains */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Causal Chains
            </div>
            <Button onClick={addChain} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Chain
            </Button>
          </CardTitle>
          <CardDescription>
            Define sequences of cause-and-effect relationships
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {chains.map((chain) => (
            <div key={chain.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Badge className={getStrengthColor(chain.strength)}>
                  {chain.strength} relationship
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChain(chain.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Chain Name</Label>
                  <Input
                    value={chain.name}
                    onChange={(e) => updateChain(chain.id, 'name', e.target.value)}
                    placeholder="Name for this causal chain..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Relationship Strength</Label>
                  <select
                    value={chain.strength}
                    onChange={(e) => updateChain(chain.id, 'strength', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
                  >
                    <option value="weak">Weak</option>
                    <option value="moderate">Moderate</option>
                    <option value="strong">Strong</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Chain Description</Label>
                <Textarea
                  value={chain.description}
                  onChange={(e) => updateChain(chain.id, 'description', e.target.value)}
                  placeholder="Describe the causal relationship and flow..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Confidence Level ({chain.confidence}%)</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={chain.confidence}
                  onChange={(e) => updateChain(chain.id, 'confidence', parseInt(e.target.value))}
                  className="w-full mt-1"
                />
              </div>
            </div>
          ))}

          {chains.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <ArrowRight className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No causal chains defined yet</p>
              <p className="text-sm text-gray-400">
                Add chains to map cause-and-effect relationships
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      {(nodes.length > 0 || chains.length > 0) && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{nodes.length}</div>
                <div className="text-sm text-gray-500">Flow Elements</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{chains.length}</div>
                <div className="text-sm text-gray-500">Causal Chains</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {nodes.filter(n => n.type === 'root_cause').length}
                </div>
                <div className="text-sm text-gray-500">Root Causes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {nodes.filter(n => n.type === 'outcome').length}
                </div>
                <div className="text-sm text-gray-500">Outcomes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Framework Guide */}
      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Fundamental Flow Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Element Types:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• <strong>Root Cause:</strong> Fundamental underlying factors</li>
                <li>• <strong>Contributing Factor:</strong> Elements that amplify effects</li>
                <li>• <strong>Enabling Condition:</strong> Conditions that allow causation</li>
                <li>• <strong>Trigger Event:</strong> Events that initiate the flow</li>
                <li>• <strong>Outcome:</strong> Results and consequences</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Analysis Principles:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Map both direct and indirect relationships</li>
                <li>• Consider temporal sequences and timing</li>
                <li>• Assess strength and confidence of relationships</li>
                <li>• Look for feedback loops and cyclical effects</li>
                <li>• Identify intervention points and leverage</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}