import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { X, Shield } from 'lucide-react'
import type { Actor, ActorType } from '@/types/entities'

interface ActorFormProps {
  actor?: Actor
  onSubmit: (data: Partial<Actor>) => Promise<void>
  onCancel: () => void
}

export function ActorForm({ actor, onSubmit, onCancel }: ActorFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: actor?.name || '',
    type: (actor?.type || 'PERSON') as ActorType,
    aliases: actor?.aliases || [],
    description: actor?.description || '',
    category: actor?.category || '',
    role: actor?.role || '',
    affiliation: actor?.affiliation || '',
    deception_profile: actor?.deception_profile || {
      mom: {
        motive: 0,
        opportunity: 0,
        means: 0,
        notes: ''
      },
      pop: {
        historical_pattern: 0,
        sophistication_level: 0,
        success_rate: 0,
        notes: ''
      },
      overall_assessment: {
        scores: {
          motive: 0,
          opportunity: 0,
          means: 0,
          historicalPattern: 0,
          sophisticationLevel: 0,
          successRate: 0,
          sourceVulnerability: 0,
          manipulationEvidence: 0,
          internalConsistency: 5,
          externalCorroboration: 5,
          anomalyDetection: 0
        },
        overallLikelihood: 0,
        confidenceLevel: 'LOW',
        riskLevel: 'MINIMAL',
        categoryScores: {
          mom: 0,
          pop: 0,
          moses: 0,
          eve: 0
        },
        breakdown: []
      },
      last_updated: new Date().toISOString()
    }
  })

  const [aliasInput, setAliasInput] = useState('')

  const addAlias = () => {
    if (aliasInput.trim() && !formData.aliases.includes(aliasInput.trim())) {
      setFormData({
        ...formData,
        aliases: [...formData.aliases, aliasInput.trim()]
      })
      setAliasInput('')
    }
  }

  const removeAlias = (alias: string) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter(a => a !== alias)
    })
  }

  const calculateDeceptionRisk = () => {
    const momAvg = (
      formData.deception_profile.mom.motive +
      formData.deception_profile.mom.opportunity +
      formData.deception_profile.mom.means
    ) / 3

    const popAvg = (
      formData.deception_profile.pop.historical_pattern +
      formData.deception_profile.pop.sophistication_level +
      formData.deception_profile.pop.success_rate
    ) / 3

    const overall = (momAvg + popAvg) / 2
    const percentage = (overall / 5) * 100

    let risk: string
    if (percentage >= 75) risk = 'CRITICAL'
    else if (percentage >= 50) risk = 'HIGH'
    else if (percentage >= 25) risk = 'MEDIUM'
    else risk = 'LOW'

    return { percentage: Math.round(percentage), risk }
  }

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL': return 'bg-red-100 text-red-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }

  const { percentage, risk } = calculateDeceptionRisk()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Identify the actor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., John Doe, Acme Corp, Wagner Group"
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Actor Type *</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as ActorType })}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSON">👤 Person</SelectItem>
                <SelectItem value="ORGANIZATION">🏢 Organization</SelectItem>
                <SelectItem value="UNIT">⚔️ Unit</SelectItem>
                <SelectItem value="GOVERNMENT">🏛️ Government</SelectItem>
                <SelectItem value="GROUP">👥 Group</SelectItem>
                <SelectItem value="OTHER">❓ Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="aliases">Aliases / Known As</Label>
            <div className="flex gap-2">
              <Input
                id="aliases"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                placeholder="Add alias and press Enter"
              />
              <Button type="button" onClick={addAlias} variant="outline">Add</Button>
            </div>
            {formData.aliases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.aliases.map(alias => (
                  <Badge key={alias} variant="secondary" className="flex items-center gap-1">
                    {alias}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeAlias(alias)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the actor"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
          <CardDescription>Categorize the actor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Military, Political, Intelligence, Criminal"
            />
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g., Commander, Minister, Operative, CEO"
            />
          </div>

          <div>
            <Label htmlFor="affiliation">Affiliation</Label>
            <Input
              id="affiliation"
              value={formData.affiliation}
              onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
              placeholder="e.g., Russian Federation, Wagner Group, Al-Qaeda"
            />
          </div>
        </CardContent>
      </Card>

      {/* MOM-POP Deception Profile */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                MOM-POP Deception Profile
              </CardTitle>
              <CardDescription>Assess deception capability and patterns</CardDescription>
            </div>
            <Badge className={getRiskBadgeColor(risk)}>
              {risk} RISK ({percentage}%)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MOM - Motive, Opportunity, Means */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">MOM - Current Capability</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Motive</Label>
                <Badge variant="outline">{formData.deception_profile.mom.motive}/5</Badge>
              </div>
              <Slider
                value={[formData.deception_profile.mom.motive]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  deception_profile: {
                    ...formData.deception_profile,
                    mom: { ...formData.deception_profile.mom, motive: v }
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">Why would they deceive? Goals, incentives, pressures</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Opportunity</Label>
                <Badge variant="outline">{formData.deception_profile.mom.opportunity}/5</Badge>
              </div>
              <Slider
                value={[formData.deception_profile.mom.opportunity]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  deception_profile: {
                    ...formData.deception_profile,
                    mom: { ...formData.deception_profile.mom, opportunity: v }
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">Do they have access to execute deception?</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Means</Label>
                <Badge variant="outline">{formData.deception_profile.mom.means}/5</Badge>
              </div>
              <Slider
                value={[formData.deception_profile.mom.means]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  deception_profile: {
                    ...formData.deception_profile,
                    mom: { ...formData.deception_profile.mom, means: v }
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">Resources, capabilities, technical ability</p>
            </div>

            <Textarea
              value={formData.deception_profile.mom.notes}
              onChange={(e) => setFormData({
                ...formData,
                deception_profile: {
                  ...formData.deception_profile,
                  mom: { ...formData.deception_profile.mom, notes: e.target.value }
                }
              })}
              placeholder="Notes on MOM assessment..."
              rows={2}
            />
          </div>

          {/* POP - Patterns of Practice */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">POP - Historical Patterns</h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Historical Pattern</Label>
                <Badge variant="outline">{formData.deception_profile.pop.historical_pattern}/5</Badge>
              </div>
              <Slider
                value={[formData.deception_profile.pop.historical_pattern]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  deception_profile: {
                    ...formData.deception_profile,
                    pop: { ...formData.deception_profile.pop, historical_pattern: v }
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">Track record of past deception</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sophistication Level</Label>
                <Badge variant="outline">{formData.deception_profile.pop.sophistication_level}/5</Badge>
              </div>
              <Slider
                value={[formData.deception_profile.pop.sophistication_level]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  deception_profile: {
                    ...formData.deception_profile,
                    pop: { ...formData.deception_profile.pop, sophistication_level: v }
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">Complexity of past deceptions</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Success Rate</Label>
                <Badge variant="outline">{formData.deception_profile.pop.success_rate}/5</Badge>
              </div>
              <Slider
                value={[formData.deception_profile.pop.success_rate]}
                onValueChange={([v]) => setFormData({
                  ...formData,
                  deception_profile: {
                    ...formData.deception_profile,
                    pop: { ...formData.deception_profile.pop, success_rate: v }
                  }
                })}
                min={0} max={5} step={1}
              />
              <p className="text-xs text-gray-500">How often have they succeeded?</p>
            </div>

            <Textarea
              value={formData.deception_profile.pop.notes}
              onChange={(e) => setFormData({
                ...formData,
                deception_profile: {
                  ...formData.deception_profile,
                  pop: { ...formData.deception_profile.pop, notes: e.target.value }
                }
              })}
              placeholder="Notes on POP assessment..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : actor ? 'Update Actor' : 'Create Actor'}
        </Button>
      </div>
    </form>
  )
}
