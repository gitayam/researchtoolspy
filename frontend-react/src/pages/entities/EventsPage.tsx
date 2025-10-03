import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, Calendar, MapPin, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EventForm } from '@/components/entities/EventForm'
import { EventDetailView } from '@/components/entities/EventDetailView'
import type { Event, EventType } from '@/types/entities'

export function EventsPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')
  const [workspaceId, setWorkspaceId] = useState<number>(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(undefined)

  const isDetailView = id && !location.pathname.includes('/edit')
  const isEditMode = id && location.pathname.includes('/edit')

  useEffect(() => {
    if (!isDetailView && !isEditMode) {
      loadEvents()
    }
  }, [workspaceId, filterType, isDetailView, isEditMode])

  useEffect(() => {
    if (id) {
      loadEvent(id)
    }
  }, [id])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId.toString(),
        ...(filterType !== 'all' && { event_type: filterType })
      })

      const response = await fetch(`/api/events?${params}`)
      const data = await response.json()

      if (response.ok) {
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEvent = async (eventId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/events/${eventId}`)
      const data = await response.json()

      if (response.ok) {
        setCurrentEvent(data.event)
        if (isEditMode) {
          setEditingEvent(data.event)
        }
      }
    } catch (error) {
      console.error('Failed to load event:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (data: Partial<Event>) => {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, workspace_id: workspaceId })
    })

    if (response.ok) {
      setIsFormOpen(false)
      setEditingEvent(undefined)
      loadEvents()
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create event')
    }
  }

  const handleUpdateEvent = async (data: Partial<Event>) => {
    if (!editingEvent) return

    const response = await fetch(`/api/events/${editingEvent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (response.ok) {
      setIsFormOpen(false)
      setEditingEvent(undefined)
      if (id) {
        navigate(`/dashboard/entities/events/${id}`)
        loadEvent(id)
      } else {
        loadEvents()
      }
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update event')
    }
  }

  const handleDelete = async () => {
    if (!currentEvent) return
    if (!confirm(`Are you sure you want to delete "${currentEvent.name}"?`)) return

    try {
      const response = await fetch(`/api/events/${currentEvent.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        navigate('/dashboard/entities/events')
      } else {
        const error = await response.json()
        alert(`Failed to delete event: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      alert('Failed to delete event')
    }
  }

  const viewEventDetail = (event: Event) => {
    navigate(`/dashboard/entities/events/${event.id}`)
  }

  const openCreateForm = () => {
    setEditingEvent(undefined)
    setIsFormOpen(true)
  }

  const openEditForm = (event: Event) => {
    setEditingEvent(event)
    setIsFormOpen(true)
  }

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getEventTypeIcon = (type: EventType) => {
    const icons = {
      OPERATION: '⚔️',
      INCIDENT: '⚠️',
      MEETING: '🤝',
      ACTIVITY: '📋',
      OTHER: '📅'
    }
    return icons[type] || icons.OTHER
  }

  const getSignificanceBadge = (significance: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800',
      HIGH: 'bg-orange-100 text-orange-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-green-100 text-green-800',
    }
    return colors[significance] || colors.LOW
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString()
  }

  // Detail view mode
  if (isDetailView && currentEvent) {
    return (
      <EventDetailView
        event={currentEvent}
        onEdit={() => navigate(`/dashboard/entities/events/${currentEvent.id}/edit`)}
        onDelete={handleDelete}
      />
    )
  }

  // Edit mode
  if (isEditMode && editingEvent) {
    return (
      <div className="p-6">
        <EventForm
          event={editingEvent}
          onSubmit={handleUpdateEvent}
          onCancel={() => navigate(`/dashboard/entities/events/${editingEvent.id}`)}
        />
      </div>
    )
  }

  // Loading state
  if (loading && (isDetailView || isEditMode)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Loading event...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // List view (default)
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Events
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Operations, incidents, meetings, and activities timeline
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{events.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {events.filter(e => e.significance === 'CRITICAL').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {events.filter(e => e.event_type === 'OPERATION').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {events.filter(e => {
                if (!e.date_start) return false
                const eventDate = new Date(e.date_start)
                const now = new Date()
                return eventDate.getMonth() === now.getMonth() &&
                       eventDate.getFullYear() === now.getFullYear()
              }).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as EventType | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="OPERATION">Operation</SelectItem>
                <SelectItem value="INCIDENT">Incident</SelectItem>
                <SelectItem value="MEETING">Meeting</SelectItem>
                <SelectItem value="ACTIVITY">Activity</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Loading events...</p>
          </CardContent>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No events found</p>
            <Button className="mt-4" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openEditForm(event)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getEventTypeIcon(event.event_type)}</span>
                    <div>
                      <CardTitle className="text-lg">{event.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{event.event_type}</Badge>
                        <Badge className={getSignificanceBadge(event.significance)}>
                          {event.significance}
                        </Badge>
                        {event.confidence && (
                          <Badge variant="secondary">{event.confidence}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 text-right">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(event.date_start)}
                    </div>
                    {event.location_id && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {event.location_id}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {event.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  {(event as any)._actor_count !== undefined && (
                    <span>{(event as any)._actor_count} actors</span>
                  )}
                  {(event as any)._evidence_count !== undefined && (
                    <span>{(event as any)._evidence_count} evidence</span>
                  )}
                  {event.duration && (
                    <span>Duration: {Math.round(event.duration / 60 / 24)} days</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open)
        if (!open) setEditingEvent(undefined)
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </DialogTitle>
          </DialogHeader>
          <EventForm
            event={editingEvent}
            onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingEvent(undefined)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
