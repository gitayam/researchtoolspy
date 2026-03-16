import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Brain, ArrowRight, Network } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { getCopHeaders } from '@/lib/cop-auth'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import type {
  HamiltonRuleAnalysis,
  HamiltonActor,
  HamiltonRelationship,
  HamiltonMode,
  RELATEDNESS_PRESETS
} from '@/types/hamilton-rule'

const RELATEDNESS_OPTIONS = [
  { label: 'Identical Twin', value: 1.0 },
  { label: 'Parent/Child', value: 0.5 },
  { label: 'Full Sibling', value: 0.5 },
  { label: 'Half Sibling', value: 0.25 },
  { label: 'Grandparent/Grandchild', value: 0.25 },
  { label: 'First Cousin', value: 0.125 },
  { label: 'Close Friend', value: 0.1 },
  { label: 'Colleague', value: 0.05 },
  { label: 'Same Organization', value: 0.08 },
  { label: 'Same Community', value: 0.05 },
  { label: 'Acquaintance', value: 0.02 },
  { label: 'Stranger', value: 0.01 },
  { label: 'Adversary', value: 0.0 },
]

export function HamiltonRulePage() {
  const { currentWorkspaceId } = useWorkspace()
  const [analyses, setAnalyses] = useState<HamiltonRuleAnalysis[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<HamiltonRuleAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<HamiltonMode>('pairwise')
  const [actors, setActors] = useState<HamiltonActor[]>([])
  const [relationships, setRelationships] = useState<HamiltonRelationship[]>([])

  // New actor form
  const [newActorName, setNewActorName] = useState('')
  const [newActorType, setNewActorType] = useState<string>('individual')

  // New relationship form
  const [newRelActorId, setNewRelActorId] = useState('')
  const [newRelRecipientId, setNewRelRecipientId] = useState('')
  const [newRelRelatedness, setNewRelRelatedness] = useState(0.5)
  const [newRelBenefit, setNewRelBenefit] = useState(10)
  const [newRelCost, setNewRelCost] = useState(3)

  useEffect(() => {
    const controller = new AbortController()
    loadAnalyses(controller.signal)
    return () => controller.abort()
  }, [])

  const loadAnalyses = async (signal?: AbortSignal) => {
    try {
      const wsId = localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id') || ''
      const response = await fetch(`/api/hamilton-rule?workspace_id=${wsId}`, {
        headers: getCopHeaders(),
        signal,
      })
      const data = await response.json()
      setAnalyses(data.analyses || [])
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Failed to load analyses:', err)
    }
  }

  const fetchAnalysis = async (id: string): Promise<HamiltonRuleAnalysis> => {
    const response = await fetch(`/api/hamilton-rule/${id}`, {
      headers: getCopHeaders()
    })
    const data = await response.json()
    return data.analysis
  }

  const handleAddActor = () => {
    if (!newActorName) return
    const actor: HamiltonActor = {
      id: `actor-${Date.now()}`,
      name: newActorName,
      type: newActorType as any
    }
    setActors([...actors, actor])
    setNewActorName('')
  }

  const handleRemoveActor = (id: string) => {
    setActors(actors.filter(a => a.id !== id))
    setRelationships(relationships.filter(r => r.actor_id !== id && r.recipient_id !== id))
  }

  const handleAddRelationship = () => {
    if (!newRelActorId || !newRelRecipientId || newRelActorId === newRelRecipientId) return

    const score = newRelRelatedness * newRelBenefit - newRelCost
    const rel: HamiltonRelationship = {
      id: `rel-${Date.now()}`,
      actor_id: newRelActorId,
      recipient_id: newRelRecipientId,
      relatedness: newRelRelatedness,
      benefit: newRelBenefit,
      cost: newRelCost,
      hamilton_score: score,
      passes_rule: score > 0
    }
    setRelationships([...relationships, rel])

    // Reset
    setNewRelActorId('')
    setNewRelRecipientId('')
  }

  const handleRemoveRelationship = (id: string) => {
    setRelationships(relationships.filter(r => r.id !== id))
  }

  const handleCreate = async () => {
    if (!title || actors.length < 2) {
      setError('Please provide a title and at least 2 actors')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/hamilton-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCopHeaders()
        },
        body: JSON.stringify({
          title,
          description,
          mode,
          actors,
          relationships,
          workspace_id: currentWorkspaceId
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      await loadAnalyses()
      const newAnalysis = await fetchAnalysis(data.id)
      setSelectedAnalysis(newAnalysis)

      // Reset form
      setTitle('')
      setDescription('')
      setActors([])
      setRelationships([])
    } catch (err: any) {
      setError(err.message || 'Failed to create analysis')
    } finally {
      setLoading(false)
    }
  }

  const handleRunAIAnalysis = async () => {
    if (!selectedAnalysis || !selectedAnalysis.relationships?.length) {
      setError('No relationships to analyze')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/hamilton-rule/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCopHeaders()
        },
        body: JSON.stringify({
          analysis_id: selectedAnalysis.id,
          behavior_description: selectedAnalysis.description || selectedAnalysis.title,
          actors: selectedAnalysis.actors,
          relationships: selectedAnalysis.relationships
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      const updated = await fetchAnalysis(selectedAnalysis.id!)
      setSelectedAnalysis(updated)
    } catch (err: any) {
      setError(err.message || 'AI analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis?')) return

    try {
      await fetch(`/api/hamilton-rule/${id}`, {
        method: 'DELETE',
        headers: getCopHeaders()
      })
      await loadAnalyses()
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null)
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const getActorName = (id: string) => {
    const actor = (selectedAnalysis?.actors || actors).find(a => a.id === id)
    return actor?.name || id
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hamilton's Rule Analysis</h1>
          <p className="text-muted-foreground">
            Predict cooperation/defection using rB {'>'} C (relatedness × benefit {'>'} cost)
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel */}
        <div className="space-y-4">
          {/* Create New */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                New Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Team Cooperation Dynamics"
                />
              </div>
              <div>
                <Label>Description (behavior being analyzed)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the cooperative behavior..."
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Network Mode</Label>
                <Switch
                  checked={mode === 'network'}
                  onCheckedChange={(checked) => setMode(checked ? 'network' : 'pairwise')}
                />
              </div>

              <Separator />

              {/* Add Actor */}
              <div>
                <Label>Add Actor</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newActorName}
                    onChange={(e) => setNewActorName(e.target.value)}
                    placeholder="Actor name"
                    className="flex-1"
                  />
                  <Select value={newActorType} onValueChange={setNewActorType}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                      <SelectItem value="organization">Org</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" onClick={handleAddActor}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Actor List */}
              {actors.length > 0 && (
                <div className="space-y-1">
                  {actors.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{a.name} ({a.type})</span>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveActor(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Add Relationship */}
              {actors.length >= 2 && (
                <div className="space-y-2">
                  <Label>Add Relationship</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select value={newRelActorId} onValueChange={setNewRelActorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Actor" />
                      </SelectTrigger>
                      <SelectContent>
                        {actors.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newRelRecipientId} onValueChange={setNewRelRecipientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {actors.filter(a => a.id !== newRelActorId).map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">r (0-1)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={newRelRelatedness}
                        onChange={(e) => setNewRelRelatedness(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Benefit</Label>
                      <Input
                        type="number"
                        value={newRelBenefit}
                        onChange={(e) => setNewRelBenefit(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cost</Label>
                      <Input
                        type="number"
                        value={newRelCost}
                        onChange={(e) => setNewRelCost(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Score: {(newRelRelatedness * newRelBenefit - newRelCost).toFixed(2)}
                    {(newRelRelatedness * newRelBenefit - newRelCost) > 0 ? ' (COOPERATE)' : ' (DEFECT)'}
                  </p>
                  <Button size="sm" onClick={handleAddRelationship} className="w-full">
                    Add Relationship
                  </Button>
                </div>
              )}

              {/* Relationship List */}
              {relationships.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {relationships.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                      <span>
                        {getActorName(r.actor_id)} → {getActorName(r.recipient_id)}
                      </span>
                      <Badge variant={r.passes_rule ? 'default' : 'destructive'}>
                        {r.hamilton_score.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={loading || !title || actors.length < 2}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Analysis'}
              </Button>
            </CardContent>
          </Card>

          {/* Saved Analyses */}
          <Card>
            <CardHeader>
              <CardTitle>Saved Analyses</CardTitle>
            </CardHeader>
            <CardContent>
              {analyses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No analyses yet</p>
              ) : (
                <div className="space-y-2">
                  {analyses.map(a => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-md border cursor-pointer hover:bg-accent ${
                        selectedAnalysis?.id === a.id ? 'border-primary bg-accent' : ''
                      }`}
                      onClick={() => fetchAnalysis(a.id!).then(setSelectedAnalysis).catch(console.error)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.actors?.length || 0} actors, {a.relationships?.length || 0} relationships
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(a.id!)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Analysis View */}
        <div className="lg:col-span-2 space-y-4">
          {selectedAnalysis ? (
            <>
              {/* Header */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedAnalysis.title}</CardTitle>
                      <CardDescription>{selectedAnalysis.description}</CardDescription>
                      <Badge variant="outline" className="mt-2">
                        {selectedAnalysis.mode} mode
                      </Badge>
                    </div>
                    <Button
                      onClick={handleRunAIAnalysis}
                      disabled={analyzing}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Network Stats */}
              {selectedAnalysis.network_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>Network Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-sm text-muted-foreground">Cooperation Score</p>
                        <p className="text-xl font-bold text-green-600">
                          +{selectedAnalysis.network_analysis.total_cooperation_score}
                        </p>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <p className="text-sm text-muted-foreground">Defection Score</p>
                        <p className="text-xl font-bold text-red-600">
                          -{selectedAnalysis.network_analysis.total_defection_score}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Net Cooperation</p>
                        <p className={`text-xl font-bold ${
                          selectedAnalysis.network_analysis.net_cooperation > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {selectedAnalysis.network_analysis.net_cooperation > 0 ? '+' : ''}
                          {selectedAnalysis.network_analysis.net_cooperation}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Stability</p>
                        <Badge variant={
                          selectedAnalysis.network_analysis.network_stability === 'stable' ? 'default' :
                          selectedAnalysis.network_analysis.network_stability === 'transitional' ? 'secondary' :
                          'destructive'
                        }>
                          {selectedAnalysis.network_analysis.network_stability}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Analysis */}
              {selectedAnalysis.ai_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-medium mb-2">Summary</p>
                      <p className="text-sm">{selectedAnalysis.ai_analysis.summary}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Cooperation Likelihood</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${selectedAnalysis.ai_analysis.cooperation_likelihood}%` }}
                            />
                          </div>
                          <span className="font-bold">{selectedAnalysis.ai_analysis.cooperation_likelihood}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Spite Risk</p>
                        <p className="text-sm">{selectedAnalysis.ai_analysis.spite_risk}</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Key Drivers</p>
                        <ul className="space-y-1">
                          {selectedAnalysis.ai_analysis.key_drivers?.map((d, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="w-2 h-2 mt-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Vulnerabilities</p>
                        <ul className="space-y-1">
                          {selectedAnalysis.ai_analysis.vulnerabilities?.map((v, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="w-2 h-2 mt-1.5 bg-orange-500 rounded-full flex-shrink-0" />
                              {v}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {selectedAnalysis.ai_analysis.recommendations?.map((r, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="w-2 h-2 mt-1.5 bg-green-500 rounded-full flex-shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Relationships Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Relationships</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Actor</th>
                          <th className="text-center p-2"></th>
                          <th className="text-left p-2">Recipient</th>
                          <th className="text-center p-2">r</th>
                          <th className="text-center p-2">B</th>
                          <th className="text-center p-2">C</th>
                          <th className="text-center p-2">rB-C</th>
                          <th className="text-center p-2">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAnalysis.relationships?.map((rel) => (
                          <tr key={rel.id} className="border-b">
                            <td className="p-2">{getActorName(rel.actor_id)}</td>
                            <td className="p-2 text-center">
                              <ArrowRight className="h-4 w-4 inline" />
                            </td>
                            <td className="p-2">{getActorName(rel.recipient_id)}</td>
                            <td className="p-2 text-center">{rel.relatedness}</td>
                            <td className="p-2 text-center">{rel.benefit}</td>
                            <td className="p-2 text-center">{rel.cost}</td>
                            <td className="p-2 text-center font-mono">
                              {rel.hamilton_score.toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              <Badge variant={rel.passes_rule ? 'default' : 'destructive'}>
                                {rel.passes_rule ? 'COOPERATE' : 'DEFECT'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Analysis Selected</p>
                <p className="text-muted-foreground">
                  Create a new analysis or select an existing one from the list
                </p>
                <div className="mt-6 p-4 bg-muted rounded-lg text-left max-w-md mx-auto">
                  <p className="font-medium mb-2">Hamilton's Rule: rB {'>'} C</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li><strong>r</strong> = relatedness (0-1)</li>
                    <li><strong>B</strong> = benefit to recipient</li>
                    <li><strong>C</strong> = cost to actor</li>
                    <li>If rB {'>'} C → <strong>Cooperation</strong></li>
                    <li>If rB {'<'} C → <strong>Defection</strong></li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default HamiltonRulePage
