/**
 * Event Linker
 * Link events to framework items (e.g., Starbursting "When" questions)
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Loader2, Calendar, ExternalLink, X, CheckCircle2 } from 'lucide-react'
import type { Event, EventType, EventSignificance } from '@/types/entities'

export interface LinkedEvent {
  id: string
  name: string
  event_type: EventType
  date_start: string
  date_end?: string
  significance?: EventSignificance
  description?: string
}

interface EventLinkerProps {
  isOpen: boolean
  onClose: () => void
  selectedEvents: LinkedEvent[]
  onEventsChange: (events: LinkedEvent[]) => void
  contextLabel?: string
}

export function EventLinker({
  isOpen,
  onClose,
  selectedEvents,
  onEventsChange,
  contextLabel
}: EventLinkerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Event[]>([])
  const [localSelected, setLocalSelected] = useState<LinkedEvent[]>(selectedEvents)

  useEffect(() => {
    setLocalSelected(selectedEvents)
  }, [selectedEvents, isOpen])

  const searchEvents = async () => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    try {
      setSearching(true)
      const params = new URLSearchParams({
        search: searchQuery,
        limit: '20'
      })

      const response = await fetch(`/api/entities/events?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to search events')

      const data = await response.json()
      if (data.success) {
        setResults(data.events || [])
      }
    } catch (error) {
      console.error('Error searching events:', error)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const toggleEvent = (event: Event) => {
    const linkedEvent: LinkedEvent = {
      id: event.id,
      name: event.name,
      event_type: event.event_type,
      date_start: event.date_start,
      date_end: event.date_end,
      significance: event.significance,
      description: event.description
    }

    const exists = localSelected.find(e => e.id === event.id)
    if (exists) {
      setLocalSelected(localSelected.filter(e => e.id !== event.id))
    } else {
      setLocalSelected([...localSelected, linkedEvent])
    }
  }

  const handleSave = () => {
    onEventsChange(localSelected)
    onClose()
  }

  const handleClose = () => {
    setLocalSelected(selectedEvents)
    onClose()
  }

  const getEventTypeIcon = (type: EventType) => {
    switch (type) {
      case 'OPERATION': return '⚔️'
      case 'INCIDENT': return '⚠️'
      case 'MEETING': return '🤝'
      case 'ACTIVITY': return '📅'
      default: return '📌'
    }
  }

  const getEventTypeBadgeColor = (type: EventType) => {
    switch (type) {
      case 'OPERATION': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'INCIDENT': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'MEETING': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ACTIVITY': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getSignificanceColor = (sig?: EventSignificance) => {
    if (!sig) return ''
    switch (sig) {
      case 'CRITICAL': return 'text-red-600 dark:text-red-400'
      case 'HIGH': return 'text-orange-600 dark:text-orange-400'
      case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400'
      case 'LOW': return 'text-gray-600 dark:text-gray-400'
      default: return ''
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Events {contextLabel && `to ${contextLabel}`}</DialogTitle>
          <DialogDescription>
            Search for and select events/incidents relevant to this {contextLabel || 'item'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events by name, type, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchEvents()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchEvents} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {localSelected.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {localSelected.length} event{localSelected.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {localSelected.map(event => (
                  <Badge key={event.id} variant="secondary" className="flex items-center gap-1">
                    <span>{getEventTypeIcon(event.event_type)}</span>
                    <span>{event.name}</span>
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-600"
                      onClick={() => toggleEvent(event as Event)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2 mt-4">
              <h5 className="text-sm font-medium">Results ({results.length})</h5>
              {results.map((event) => {
                const isSelected = localSelected.some(e => e.id === event.id)
                return (
                  <Card
                    key={event.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 border-2'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => toggleEvent(event)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{getEventTypeIcon(event.event_type)}</span>
                            <h6 className="font-medium text-sm">{event.name}</h6>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={`text-xs ${getEventTypeBadgeColor(event.event_type)}`}>
                              {event.event_type}
                            </Badge>
                            {event.significance && (
                              <Badge variant="outline" className={`text-xs ${getSignificanceColor(event.significance)}`}>
                                {event.significance}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              📅 {formatDate(event.date_start)}
                              {event.date_end && ` - ${formatDate(event.date_end)}`}
                            </Badge>
                          </div>

                          {event.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>

                        <a
                          href={`/dashboard/entities/events/${event.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          <ExternalLink className="h-4 w-4 text-gray-500" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && results.length === 0 && searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No events found. Try a different search term.
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Search for events to link to this {contextLabel || 'item'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Link {localSelected.length > 0 && `(${localSelected.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function EventBadge({ event, onRemove }: { event: LinkedEvent; onRemove?: () => void }) {
  const getEventTypeIcon = (type: EventType) => {
    switch (type) {
      case 'OPERATION': return '⚔️'
      case 'INCIDENT': return '⚠️'
      case 'MEETING': return '🤝'
      case 'ACTIVITY': return '📅'
      default: return '📌'
    }
  }

  const getEventTypeBadgeColor = (type: EventType) => {
    switch (type) {
      case 'OPERATION': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'INCIDENT': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'MEETING': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ACTIVITY': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <Badge className={`flex items-center gap-2 px-2 py-1 ${getEventTypeBadgeColor(event.event_type)}`}>
      <span>{getEventTypeIcon(event.event_type)}</span>
      <div className="flex flex-col items-start">
        <span className="font-medium text-xs">{event.name}</span>
        <span className="text-xs opacity-75">
          {formatDate(event.date_start)}
          {event.date_end && ` - ${formatDate(event.date_end)}`}
        </span>
      </div>
      {onRemove && (
        <X
          className="h-3 w-3 cursor-pointer hover:text-red-600 ml-1"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        />
      )}
    </Badge>
  )
}
