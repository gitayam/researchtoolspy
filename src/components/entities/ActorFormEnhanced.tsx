import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { X, Shield, AlertCircle, Globe, Users, MapPin } from 'lucide-react'
import type { Actor, ActorType } from '@/types/entities'

interface ActorFormProps {
  actor?: Actor
  onSubmit: (data: Partial<Actor>) => Promise<void>
  onCancel: () => void
}

export function ActorFormEnhanced({ actor, onSubmit, onCancel }: ActorFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: actor?.name || '',
    type: (actor?.type || 'PERSON') as ActorType,
    aliases: actor?.aliases || [],
    description: actor?.description || '',
    category: actor?.category || '',
    role: actor?.role || '',
    affiliation: actor?.affiliation || '',

    // Extended fields stored in description as JSON
    online_presence: {
      websites: [] as string[],
      social_media: [] as string[],
      emails: [] as string[]
    },

    physical_details: {
      nationality: '',
      location: '',
      headquarters: '',
      areas_of_operation: [] as string[]
    },

    organizational_details: {
      size: '',
      structure: '',
      founded: '',
      leadership: [] as string[]
    },

    capabilities: {
      known_capabilities: [] as string[],
      resources: '',
      expertise_areas: [] as string[]
    },

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
        confidenceLevel: 'LOW' as const,
        riskLevel: 'MINIMAL' as const,
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
  const [websiteInput, setWebsiteInput] = useState('')
  const [socialMediaInput, setSocialMediaInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [operationAreaInput, setOperationAreaInput] = useState('')
  const [capabilityInput, setCapabilityInput] = useState('')

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

  const addToArray = (field: string, subfield: string, value: string, setValue: (v: string) => void) => {
    if (!value.trim()) return

    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [subfield]: [...prev[field][subfield], value.trim()]
      }
    }))
    setValue('')
  }

  const removeFromArray = (field: string, subfield: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [subfield]: prev[field][subfield].filter(item => item !== value)
      }
    }))
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
    setError(null)

    try {
      // Serialize extended data into description field
      const extendedData = {
        online_presence: formData.online_presence,
        physical_details: formData.physical_details,
        organizational_details: formData.organizational_details,
        capabilities: formData.capabilities
      }

      const submitData = {
        name: formData.name,
        type: formData.type,
        aliases: formData.aliases,
        description: JSON.stringify(extendedData),
        category: formData.category,
        role: formData.role,
        affiliation: formData.affiliation,
        deception_profile: formData.deception_profile
      }

      await onSubmit(submitData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save actor')
      setLoading(false)
    }
  }

  const { percentage, risk } = calculateDeceptionRisk()
  const isPerson = formData.type === 'PERSON'
  const isOrganization = ['ORGANIZATION', 'UNIT', 'GOVERNMENT', 'GROUP'].includes(formData.type)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                <SelectItem value="PERSON">👤 Person / Individual</SelectItem>
                <SelectItem value="ORGANIZATION">🏢 Organization / Company</SelectItem>
                <SelectItem value="UNIT">⚔️ Military / Intelligence Unit</SelectItem>
                <SelectItem value="GOVERNMENT">🏛️ Government / State Actor</SelectItem>
                <SelectItem value="GROUP">👥 Group / Collective</SelectItem>
                <SelectItem value="OTHER">❓ Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="aliases">Aliases / Also Known As</Label>
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
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader>
          <CardTitle>Classification & Role</CardTitle>
          <CardDescription>Categorize and describe the actor's position</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder={isPerson ? "e.g., Military, Political, Intelligence, Criminal" : "e.g., Defense, Technology, Finance, Media"}
            />
          </div>

          <div>
            <Label htmlFor="role">Role / Position</Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder={isPerson ? "e.g., Commander, Minister, Operative, CEO" : "e.g., Defense Contractor, Think Tank, PMC"}
            />
          </div>

          <div>
            <Label htmlFor="affiliation">Affiliation / Parent Organization</Label>
            <Input
              id="affiliation"
              value={formData.affiliation}
              onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
              placeholder="e.g., Russian Federation, Wagner Group, NATO"
            />
          </div>
        </CardContent>
      </Card>

      {/* Online Presence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Online Presence & Contact
          </CardTitle>
          <CardDescription>Digital footprint and contact methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Websites</Label>
            <div className="flex gap-2">
              <Input
                value={websiteInput}
                onChange={(e) => setWebsiteInput(e.target.value)}
                placeholder="https://..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('online_presence', 'websites', websiteInput, setWebsiteInput))}
              />
              <Button type="button" onClick={() => addToArray('online_presence', 'websites', websiteInput, setWebsiteInput)} variant="outline">Add</Button>
            </div>
            {formData.online_presence.websites.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.online_presence.websites.map(site => (
                  <Badge key={site} variant="secondary" className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {site}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray('online_presence', 'websites', site)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Social Media Profiles</Label>
            <div className="flex gap-2">
              <Input
                value={socialMediaInput}
                onChange={(e) => setSocialMediaInput(e.target.value)}
                placeholder="@username or full URL"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('online_presence', 'social_media', socialMediaInput, setSocialMediaInput))}
              />
              <Button type="button" onClick={() => addToArray('online_presence', 'social_media', socialMediaInput, setSocialMediaInput)} variant="outline">Add</Button>
            </div>
            {formData.online_presence.social_media.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.online_presence.social_media.map(account => (
                  <Badge key={account} variant="secondary" className="flex items-center gap-1">
                    {account}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray('online_presence', 'social_media', account)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Email Addresses</Label>
            <div className="flex gap-2">
              <Input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@example.com"
                type="email"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('online_presence', 'emails', emailInput, setEmailInput))}
              />
              <Button type="button" onClick={() => addToArray('online_presence', 'emails', emailInput, setEmailInput)} variant="outline">Add</Button>
            </div>
            {formData.online_presence.emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.online_presence.emails.map(email => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray('online_presence', 'emails', email)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location & Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Areas of Operation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPerson && (
            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formData.physical_details.nationality}
                onChange={(e) => setFormData({
                  ...formData,
                  physical_details: { ...formData.physical_details, nationality: e.target.value }
                })}
                placeholder="e.g., Russian, American, British"
              />
            </div>
          )}

          <div>
            <Label htmlFor="location">{isOrganization ? 'Headquarters / Main Location' : 'Known Location'}</Label>
            <Input
              id="location"
              value={isOrganization ? formData.physical_details.headquarters : formData.physical_details.location}
              onChange={(e) => setFormData({
                ...formData,
                physical_details: {
                  ...formData.physical_details,
                  [isOrganization ? 'headquarters' : 'location']: e.target.value
                }
              })}
              placeholder="e.g., Moscow, Washington DC, London"
            />
          </div>

          <div>
            <Label>Areas of Operation</Label>
            <div className="flex gap-2">
              <Input
                value={operationAreaInput}
                onChange={(e) => setOperationAreaInput(e.target.value)}
                placeholder="Geographic area or region"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('physical_details', 'areas_of_operation', operationAreaInput, setOperationAreaInput))}
              />
              <Button type="button" onClick={() => addToArray('physical_details', 'areas_of_operation', operationAreaInput, setOperationAreaInput)} variant="outline">Add</Button>
            </div>
            {formData.physical_details.areas_of_operation.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.physical_details.areas_of_operation.map(area => (
                  <Badge key={area} variant="secondary" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {area}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray('physical_details', 'areas_of_operation', area)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization-specific fields */}
      {isOrganization && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Organizational Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="size">Size / Personnel</Label>
                <Input
                  id="size"
                  value={formData.organizational_details.size}
                  onChange={(e) => setFormData({
                    ...formData,
                    organizational_details: { ...formData.organizational_details, size: e.target.value }
                  })}
                  placeholder="e.g., 10,000+ employees, 50-100 operatives"
                />
              </div>

              <div>
                <Label htmlFor="founded">Founded / Established</Label>
                <Input
                  id="founded"
                  value={formData.organizational_details.founded}
                  onChange={(e) => setFormData({
                    ...formData,
                    organizational_details: { ...formData.organizational_details, founded: e.target.value }
                  })}
                  placeholder="e.g., 2014, 1990s, Post-Soviet era"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="structure">Structure / Organization Type</Label>
              <Input
                id="structure"
                value={formData.organizational_details.structure}
                onChange={(e) => setFormData({
                  ...formData,
                  organizational_details: { ...formData.organizational_details, structure: e.target.value }
                })}
                placeholder="e.g., Hierarchical, Cellular, Network, State-owned"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>Capabilities & Expertise</CardTitle>
          <CardDescription>Known capabilities, resources, and areas of expertise</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Known Capabilities</Label>
            <div className="flex gap-2">
              <Input
                value={capabilityInput}
                onChange={(e) => setCapabilityInput(e.target.value)}
                placeholder="e.g., Cyber operations, Disinformation, Military training"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('capabilities', 'known_capabilities', capabilityInput, setCapabilityInput))}
              />
              <Button type="button" onClick={() => addToArray('capabilities', 'known_capabilities', capabilityInput, setCapabilityInput)} variant="outline">Add</Button>
            </div>
            {formData.capabilities.known_capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.capabilities.known_capabilities.map(cap => (
                  <Badge key={cap} variant="secondary" className="flex items-center gap-1">
                    {cap}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromArray('capabilities', 'known_capabilities', cap)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="resources">Resources & Funding</Label>
            <Textarea
              id="resources"
              value={formData.capabilities.resources}
              onChange={(e) => setFormData({
                ...formData,
                capabilities: { ...formData.capabilities, resources: e.target.value }
              })}
              placeholder="Describe funding sources, equipment, infrastructure..."
              rows={2}
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
