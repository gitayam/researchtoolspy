import { useState, useEffect } from 'react'
import { AlertTriangle, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AIFieldAssistant } from '@/components/ai'
import type { MOMAssessment, CreateMOMAssessmentRequest, UpdateMOMAssessmentRequest } from '@/types/entities'

interface MOMAssessmentFormProps {
  assessment?: MOMAssessment
  actorId?: string
  eventId?: string
  workspaceId: string
  onSubmit: (data: CreateMOMAssessmentRequest | UpdateMOMAssessmentRequest) => Promise<void>
  onCancel: () => void
}

export function MOMAssessmentForm({
  assessment,
  actorId,
  eventId,
  workspaceId,
  onSubmit,
  onCancel
}: MOMAssessmentFormProps) {
  const isEditing = !!assessment

  const [formData, setFormData] = useState({
    actor_id: assessment?.actor_id || actorId || '',
    event_id: assessment?.event_id || eventId || '',
    scenario_description: assessment?.scenario_description || '',
    motive: assessment?.motive || 0,
    opportunity: assessment?.opportunity || 0,
    means: assessment?.means || 0,
    notes: assessment?.notes || ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch actor/event lists from API
  const [actors, setActors] = useState<Array<{ id: string; name: string }>>([])
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    const fetchActorsAndEvents = async () => {
      try {
        // Fetch actors
        const actorResponse = await fetch(`/api/actors?workspace_id=${workspaceId}`)
        if (actorResponse.ok) {
          const actorData = await actorResponse.json()
          setActors(
            actorData.actors?.map((actor: any) => ({
              id: actor.id,
              name: actor.name
            })) || []
          )
        }

        // Fetch events
        const eventResponse = await fetch(`/api/events?workspace_id=${workspaceId}`)
        if (eventResponse.ok) {
          const eventData = await eventResponse.json()
          setEvents(
            eventData.events?.map((event: any) => ({
              id: event.id,
              name: event.title
            })) || []
          )
        }
      } catch (error) {
        console.error('Failed to fetch actors/events:', error)
      }
    }

    fetchActorsAndEvents()
  }, [workspaceId])

  const calculateOverallRisk = () => {
    const avgScore = (formData.motive + formData.opportunity + formData.means) / 3
    const percentage = (avgScore / 5) * 100

    if (avgScore >= 4) {
      return { level: 'CRITICAL', percentage, color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-800' }
    } else if (avgScore >= 3) {
      return { level: 'HIGH', percentage, color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800' }
    } else if (avgScore >= 1.5) {
      return { level: 'MEDIUM', percentage, color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' }
    } else {
      return { level: 'LOW', percentage, color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800' }
    }
  }

  const risk = calculateOverallRisk()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isEditing) {
        // Update existing assessment
        const updateData: UpdateMOMAssessmentRequest = {
          scenario_description: formData.scenario_description,
          motive: formData.motive,
          opportunity: formData.opportunity,
          means: formData.means,
          notes: formData.notes
        }
        await onSubmit(updateData)
      } else {
        // Create new assessment
        const createData: CreateMOMAssessmentRequest = {
          actor_id: formData.actor_id,
          event_id: formData.event_id || undefined,
          scenario_description: formData.scenario_description,
          motive: formData.motive,
          opportunity: formData.opportunity,
          means: formData.means,
          notes: formData.notes,
          workspace_id: workspaceId
        }
        await onSubmit(createData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment')
    } finally {
      setLoading(false)
    }
  }

  const getScoreLabel = (score: number) => {
    if (score === 0) return 'None'
    if (score === 1) return 'Very Low'
    if (score === 2) return 'Low'
    if (score === 3) return 'Medium'
    if (score === 4) return 'High'
    if (score === 5) return 'Very High'
    return 'Unknown'
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{isEditing ? 'Edit MOM Assessment' : 'Create MOM Assessment'}</CardTitle>
              <CardDescription>
                Assess Motive, Opportunity, and Means for a specific scenario
              </CardDescription>
            </div>
            <Badge className={`${risk.bgColor} ${risk.textColor}`}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {risk.level} RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Actor Selection (only for new assessments) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="actor_id">Actor *</Label>
              <Select
                value={formData.actor_id}
                onValueChange={(value) => setFormData({ ...formData, actor_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select actor to assess" />
                </SelectTrigger>
                <SelectContent>
                  {actors.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No actors available
                    </SelectItem>
                  ) : (
                    actors.map((actor) => (
                      <SelectItem key={actor.id} value={actor.id}>
                        {actor.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Who is being assessed for this scenario?
              </p>
            </div>
          )}

          {/* Event Selection (optional) */}
          <div className="space-y-2">
            <Label htmlFor="event_id">Link to Event (Optional)</Label>
            <Select
              value={formData.event_id}
              onValueChange={(value) => setFormData({ ...formData, event_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No event (general scenario)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No event (general scenario)</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Link this assessment to a specific event or leave blank for general scenarios
            </p>
          </div>

          {/* Scenario Description */}
          <div className="space-y-2">
            <Label htmlFor="scenario_description">Scenario Description *</Label>
            <div className="flex gap-2">
              <Textarea
                id="scenario_description"
                value={formData.scenario_description}
                onChange={(e) => setFormData({ ...formData, scenario_description: e.target.value })}
                placeholder="Describe the specific scenario being assessed (e.g., 'Stealing classified documents', 'Sabotaging critical infrastructure')"
                rows={3}
                required
              />
              <AIFieldAssistant
                fieldName="Scenario Description"
                currentValue={formData.scenario_description}
                onAccept={(value) => setFormData({ ...formData, scenario_description: value })}
                context={{
                  framework: 'MOM Assessment',
                  relatedFields: {
                    motive: formData.motive,
                    opportunity: formData.opportunity,
                    means: formData.means,
                    notes: formData.notes
                  }
                }}
                placeholder="Describe the scenario..."
              />
            </div>
            <p className="text-xs text-gray-500">
              What specific deception or action is being assessed?
            </p>
          </div>

          {/* MOM Scores Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold">MOM Scores (0-5 scale)</h3>

            {/* Motive */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Motive</Label>
                <span className="text-sm font-semibold">
                  {formData.motive}/5 - {getScoreLabel(formData.motive)}
                </span>
              </div>
              <Slider
                value={[formData.motive]}
                onValueChange={([value]) => setFormData({ ...formData, motive: value })}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Why would they deceive in this scenario? (financial, ideological, coercion, etc.)
              </p>
            </div>

            {/* Opportunity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Opportunity</Label>
                <span className="text-sm font-semibold">
                  {formData.opportunity}/5 - {getScoreLabel(formData.opportunity)}
                </span>
              </div>
              <Slider
                value={[formData.opportunity]}
                onValueChange={([value]) => setFormData({ ...formData, opportunity: value })}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Can they access or execute the deception? (access, timing, monitoring gaps)
              </p>
            </div>

            {/* Means */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Means</Label>
                <span className="text-sm font-semibold">
                  {formData.means}/5 - {getScoreLabel(formData.means)}
                </span>
              </div>
              <Slider
                value={[formData.means]}
                onValueChange={([value]) => setFormData({ ...formData, means: value })}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Do they have the skills, resources, and capabilities to execute?
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Assessment Notes</Label>
            <div className="flex gap-2">
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional context, rationale, or supporting evidence for this assessment..."
                rows={4}
              />
              <AIFieldAssistant
                fieldName="Assessment Notes"
                currentValue={formData.notes}
                onAccept={(value) => setFormData({ ...formData, notes: value })}
                context={{
                  framework: 'MOM Assessment',
                  relatedFields: {
                    scenario: formData.scenario_description,
                    motive: formData.motive,
                    opportunity: formData.opportunity,
                    means: formData.means
                  }
                }}
                placeholder="Additional assessment notes..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : isEditing ? 'Update Assessment' : 'Create Assessment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
