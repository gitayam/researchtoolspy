import { useState } from 'react'
import { Plus, Users, Database, FileText, Calendar, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EvidenceEntityType } from '@/types/framework-evidence'
import type { EvidenceType } from '@/types/evidence'
import type { ActorType } from '@/types/entities'

interface EntityQuickCreateProps {
  open: boolean
  onClose: () => void
  onEntityCreated: (entityType: EvidenceEntityType, entityData: any) => void
  defaultTab?: EvidenceEntityType
  frameworkContext?: {
    frameworkType: string
    frameworkId?: string
    sectionKey?: string
  }
}

export function EntityQuickCreate({
  open,
  onClose,
  onEntityCreated,
  defaultTab = 'data',
  frameworkContext
}: EntityQuickCreateProps) {
  const [activeTab, setActiveTab] = useState<EvidenceEntityType>(defaultTab)
  const [loading, setLoading] = useState(false)

  // Data form state
  const [dataForm, setDataForm] = useState({
    title: '',
    what: '',
    when: '',
    where: '',
    who: '',
    evidence_type: 'official_document' as EvidenceType
  })

  // Actor form state
  const [actorForm, setActorForm] = useState({
    name: '',
    type: 'PERSON' as ActorType,
    affiliation: '',
    description: ''
  })

  // Source form state
  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'WEBSITE' as any,
    description: '',
    url: ''
  })

  // Event form state
  const [eventForm, setEventForm] = useState({
    name: '',
    event_type: 'incident',
    date_start: '',
    location: '',
    description: ''
  })

  const resetForms = () => {
    setDataForm({ title: '', what: '', when: '', where: '', who: '', evidence_type: 'official_document' })
    setActorForm({ name: '', type: 'PERSON', affiliation: '', description: '' })
    setSourceForm({ name: '', type: 'WEBSITE', description: '', url: '' })
    setEventForm({ name: '', event_type: 'incident', date_start: '', location: '', description: '' })
  }

  const handleClose = () => {
    resetForms()
    onClose()
  }

  const handleCreateData = async () => {
    if (!dataForm.title || !dataForm.what) {
      alert('Please fill in required fields (Title and What)')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dataForm,
          workspace_id: 1,
          status: 'active'
        })
      })

      if (response.ok) {
        const result = await response.json()
        onEntityCreated('data', result.evidence)
        handleClose()
      } else {
        const error = await response.json()
        alert(`Failed to create data: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create data:', error)
      alert('Failed to create data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateActor = async () => {
    if (!actorForm.name) {
      alert('Please enter actor name')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/actors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...actorForm,
          workspace_id: 1
        })
      })

      if (response.ok) {
        const result = await response.json()
        onEntityCreated('actor', result.actor)
        handleClose()
      } else {
        const error = await response.json()
        alert(`Failed to create actor: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create actor:', error)
      alert('Failed to create actor')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSource = async () => {
    if (!sourceForm.name) {
      alert('Please enter source name')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sourceForm,
          workspace_id: 1
        })
      })

      if (response.ok) {
        const result = await response.json()
        onEntityCreated('source', result.source)
        handleClose()
      } else {
        const error = await response.json()
        alert(`Failed to create source: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create source:', error)
      alert('Failed to create source')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async () => {
    if (!eventForm.name || !eventForm.date_start) {
      alert('Please fill in required fields (Name and Date)')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventForm,
          workspace_id: 1
        })
      })

      if (response.ok) {
        const result = await response.json()
        onEntityCreated('event', result.event)
        handleClose()
      } else {
        const error = await response.json()
        alert(`Failed to create event: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create event:', error)
      alert('Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create & Link Entity</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EvidenceEntityType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="data">
              <FileText className="h-4 w-4 mr-2" />
              Data
            </TabsTrigger>
            <TabsTrigger value="actor">
              <Users className="h-4 w-4 mr-2" />
              Actor
            </TabsTrigger>
            <TabsTrigger value="source">
              <Database className="h-4 w-4 mr-2" />
              Source
            </TabsTrigger>
            <TabsTrigger value="event">
              <Calendar className="h-4 w-4 mr-2" />
              Event
            </TabsTrigger>
          </TabsList>

          {/* Data Form */}
          <TabsContent value="data" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="data-title">Title *</Label>
              <Input
                id="data-title"
                value={dataForm.title}
                onChange={(e) => setDataForm({ ...dataForm, title: e.target.value })}
                placeholder="Brief title for this data"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-type">Evidence Type</Label>
              <Select
                value={dataForm.evidence_type}
                onValueChange={(value) => setDataForm({ ...dataForm, evidence_type: value as EvidenceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="official_document">Official Document</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="testimony">Testimony</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="news_article">News Article</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-what">What (Description) *</Label>
              <Textarea
                id="data-what"
                value={dataForm.what}
                onChange={(e) => setDataForm({ ...dataForm, what: e.target.value })}
                placeholder="What is this evidence about?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-when">When</Label>
                <Input
                  id="data-when"
                  value={dataForm.when}
                  onChange={(e) => setDataForm({ ...dataForm, when: e.target.value })}
                  placeholder="Time/date information"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-where">Where</Label>
                <Input
                  id="data-where"
                  value={dataForm.where}
                  onChange={(e) => setDataForm({ ...dataForm, where: e.target.value })}
                  placeholder="Location information"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-who">Who</Label>
              <Input
                id="data-who"
                value={dataForm.who}
                onChange={(e) => setDataForm({ ...dataForm, who: e.target.value })}
                placeholder="People or organizations involved"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreateData} disabled={loading}>
                {loading ? 'Creating...' : 'Create & Link Data'}
              </Button>
            </div>
          </TabsContent>

          {/* Actor Form */}
          <TabsContent value="actor" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="actor-name">Name *</Label>
              <Input
                id="actor-name"
                value={actorForm.name}
                onChange={(e) => setActorForm({ ...actorForm, name: e.target.value })}
                placeholder="Actor name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actor-type">Type</Label>
              <Select
                value={actorForm.type}
                onValueChange={(value) => setActorForm({ ...actorForm, type: value as ActorType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSON">Person</SelectItem>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  <SelectItem value="GROUP">Group</SelectItem>
                  <SelectItem value="GOVERNMENT">Government</SelectItem>
                  <SelectItem value="UNIT">Unit</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actor-affiliation">Affiliation</Label>
              <Input
                id="actor-affiliation"
                value={actorForm.affiliation}
                onChange={(e) => setActorForm({ ...actorForm, affiliation: e.target.value })}
                placeholder="Organization or group affiliation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actor-description">Description</Label>
              <Textarea
                id="actor-description"
                value={actorForm.description}
                onChange={(e) => setActorForm({ ...actorForm, description: e.target.value })}
                placeholder="Additional details about this actor"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreateActor} disabled={loading}>
                {loading ? 'Creating...' : 'Create & Link Actor'}
              </Button>
            </div>
          </TabsContent>

          {/* Source Form */}
          <TabsContent value="source" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="source-name">Name *</Label>
              <Input
                id="source-name"
                value={sourceForm.name}
                onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                placeholder="Source name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-type">Type</Label>
              <Select
                value={sourceForm.type}
                onValueChange={(value) => setSourceForm({ ...sourceForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSON">Person</SelectItem>
                  <SelectItem value="DOCUMENT">Document</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="DATABASE">Database</SelectItem>
                  <SelectItem value="MEDIA">Media</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-url">URL</Label>
              <Input
                id="source-url"
                type="url"
                value={sourceForm.url}
                onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-description">Description</Label>
              <Textarea
                id="source-description"
                value={sourceForm.description}
                onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
                placeholder="Additional details about this source"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreateSource} disabled={loading}>
                {loading ? 'Creating...' : 'Create & Link Source'}
              </Button>
            </div>
          </TabsContent>

          {/* Event Form */}
          <TabsContent value="event" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="event-name">Name *</Label>
              <Input
                id="event-name"
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="Event name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-type">Event Type</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={(value) => setEventForm({ ...eventForm, event_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="activity">Activity</SelectItem>
                  <SelectItem value="operation">Operation</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventForm.date_start}
                  onChange={(e) => setEventForm({ ...eventForm, date_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="Event location"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Additional details about this event"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreateEvent} disabled={loading}>
                {loading ? 'Creating...' : 'Create & Link Event'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
