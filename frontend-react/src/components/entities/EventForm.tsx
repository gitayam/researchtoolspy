import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Event, EventType, EventSignificance, EventConfidence } from '@/types/entities'

interface EventFormProps {
  event?: Event
  onSubmit: (data: Partial<Event>) => Promise<void>
  onCancel: () => void
}

export function EventForm({ event, onSubmit, onCancel }: EventFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: event?.name || '',
    event_type: (event?.event_type || 'ACTIVITY') as EventType,
    description: event?.description || '',
    date_start: event?.date_start ? event.date_start.split('T')[0] : '',
    date_end: event?.date_end ? event.date_end.split('T')[0] : '',
    duration: event?.duration || undefined,
    location_id: event?.location_id || '',
    significance: (event?.significance || 'MEDIUM') as EventSignificance,
    confidence: (event?.confidence || 'POSSIBLE') as EventConfidence
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Calculate duration in minutes if both dates provided
      const submitData = { ...formData }
      if (formData.date_start && formData.date_end) {
        const start = new Date(formData.date_start)
        const end = new Date(formData.date_end)
        submitData.duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
      }
      await onSubmit(submitData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
          <CardDescription>Define the event details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Event Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Operation Desert Storm, Summit Meeting, Cyber Attack"
              required
            />
          </div>

          <div>
            <Label htmlFor="event_type">Event Type *</Label>
            <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v as EventType })}>
              <SelectTrigger id="event_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPERATION">⚔️ Operation</SelectItem>
                <SelectItem value="INCIDENT">⚠️ Incident</SelectItem>
                <SelectItem value="MEETING">🤝 Meeting</SelectItem>
                <SelectItem value="ACTIVITY">📋 Activity</SelectItem>
                <SelectItem value="OTHER">📅 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the event"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Temporal Information */}
      <Card>
        <CardHeader>
          <CardTitle>When</CardTitle>
          <CardDescription>Event timing and duration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="date_start">Start Date *</Label>
            <Input
              id="date_start"
              type="date"
              value={formData.date_start}
              onChange={(e) => setFormData({ ...formData, date_start: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="date_end">End Date</Label>
            <Input
              id="date_end"
              type="date"
              value={formData.date_end}
              onChange={(e) => setFormData({ ...formData, date_end: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">Optional - leave blank for single-day events</p>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Where</CardTitle>
          <CardDescription>Event location</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="location_id">Location</Label>
            <Input
              id="location_id"
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              placeholder="e.g., Baghdad, Pentagon, Moscow"
            />
            <p className="text-xs text-gray-500 mt-1">Future: Link to Places entity</p>
          </div>
        </CardContent>
      </Card>

      {/* Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
          <CardDescription>Assessment and confidence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="significance">Significance</Label>
            <Select value={formData.significance} onValueChange={(v) => setFormData({ ...formData, significance: v as EventSignificance })}>
              <SelectTrigger id="significance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRITICAL">🔴 Critical - Major strategic impact</SelectItem>
                <SelectItem value="HIGH">🟠 High - Significant impact</SelectItem>
                <SelectItem value="MEDIUM">🟡 Medium - Moderate impact</SelectItem>
                <SelectItem value="LOW">🟢 Low - Minor impact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="confidence">Confidence Level</Label>
            <Select value={formData.confidence} onValueChange={(v) => setFormData({ ...formData, confidence: v as EventConfidence })}>
              <SelectTrigger id="confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONFIRMED">✅ Confirmed - Verified by multiple sources</SelectItem>
                <SelectItem value="PROBABLE">🟢 Probable - Likely accurate</SelectItem>
                <SelectItem value="POSSIBLE">🟡 Possible - May be accurate</SelectItem>
                <SelectItem value="DOUBTFUL">🟠 Doubtful - Questionable accuracy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
        </Button>
      </div>
    </form>
  )
}
