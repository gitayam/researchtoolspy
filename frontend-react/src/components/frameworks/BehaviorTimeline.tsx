import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, GitFork, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface TimelineEvent {
  id: string
  title: string
  description?: string
  time?: string
  location?: string
  duration?: string
  order: number
  parentId?: string
  isFork?: boolean
  children?: TimelineEvent[]
}

interface BehaviorTimelineProps {
  events: TimelineEvent[]
  onChange: (events: TimelineEvent[]) => void
  readOnly?: boolean
}

export function BehaviorTimeline({ events, onChange, readOnly = false }: BehaviorTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null)

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const addEvent = (parentId?: string, isFork = false) => {
    const newEvent: TimelineEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      title: '',
      order: events.length,
      parentId,
      isFork,
      children: []
    }

    if (parentId) {
      // Adding as child/fork
      const updatedEvents = addChildToParent([...events], parentId, newEvent)
      onChange(updatedEvents)
      setEditingEvent(newEvent.id)
      setExpandedEvents(new Set([...expandedEvents, parentId]))
    } else {
      // Adding to root
      onChange([...events, newEvent])
      setEditingEvent(newEvent.id)
    }
  }

  const addChildToParent = (eventsList: TimelineEvent[], parentId: string, newChild: TimelineEvent): TimelineEvent[] => {
    return eventsList.map(event => {
      if (event.id === parentId) {
        return {
          ...event,
          children: [...(event.children || []), newChild]
        }
      } else if (event.children && event.children.length > 0) {
        return {
          ...event,
          children: addChildToParent(event.children, parentId, newChild)
        }
      }
      return event
    })
  }

  const updateEvent = (eventId: string, updates: Partial<TimelineEvent>) => {
    const updateInList = (eventsList: TimelineEvent[]): TimelineEvent[] => {
      return eventsList.map(event => {
        if (event.id === eventId) {
          return { ...event, ...updates }
        } else if (event.children && event.children.length > 0) {
          return {
            ...event,
            children: updateInList(event.children)
          }
        }
        return event
      })
    }

    onChange(updateInList([...events]))
  }

  const deleteEvent = (eventId: string) => {
    const deleteFromList = (eventsList: TimelineEvent[]): TimelineEvent[] => {
      return eventsList
        .filter(event => event.id !== eventId)
        .map(event => {
          if (event.children && event.children.length > 0) {
            return {
              ...event,
              children: deleteFromList(event.children)
            }
          }
          return event
        })
    }

    onChange(deleteFromList([...events]))
  }

  const moveEvent = (eventId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'left' || direction === 'right') {
      // Reorder chronologically
      const reorderList = (eventsList: TimelineEvent[]): TimelineEvent[] => {
        const index = eventsList.findIndex(e => e.id === eventId)
        if (index === -1) {
          return eventsList.map(event => {
            if (event.children && event.children.length > 0) {
              return {
                ...event,
                children: reorderList(event.children)
              }
            }
            return event
          })
        }

        const newIndex = direction === 'left' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= eventsList.length) return eventsList

        const newList = [...eventsList]
        const temp = newList[index]
        newList[index] = newList[newIndex]
        newList[newIndex] = temp

        // Update order numbers
        return newList.map((event, i) => ({ ...event, order: i }))
      }

      onChange(reorderList([...events]))
    }
  }

  const handleDragStart = (eventId: string) => {
    setDraggedEvent(eventId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetEventId: string) => {
    if (!draggedEvent || draggedEvent === targetEventId) {
      setDraggedEvent(null)
      return
    }

    // Find positions of dragged and target events
    const findEventIndex = (eventsList: TimelineEvent[], eventId: string): number => {
      return eventsList.findIndex(e => e.id === eventId)
    }

    const draggedIndex = findEventIndex(events, draggedEvent)
    const targetIndex = findEventIndex(events, targetEventId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newEvents = [...events]
      const temp = newEvents[draggedIndex]
      newEvents.splice(draggedIndex, 1)
      newEvents.splice(targetIndex, 0, temp)

      // Update order numbers
      onChange(newEvents.map((event, i) => ({ ...event, order: i })))
    }

    setDraggedEvent(null)
  }

  const renderEvent = (event: TimelineEvent, level = 0, index = 0, siblingCount = 0) => {
    const isEditing = editingEvent === event.id
    const isExpanded = expandedEvents.has(event.id)
    const hasChildren = event.children && event.children.length > 0

    return (
      <div key={event.id} className="relative">
        {/* Timeline connector */}
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center">
            <div className={cn(
              "w-px bg-gray-300 dark:bg-gray-600",
              index === siblingCount - 1 ? "h-1/2" : "h-full"
            )} />
            <div className="absolute left-0 top-1/2 w-8 h-px bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        <div
          className={cn(
            "relative mb-3",
            level > 0 && "ml-8"
          )}
          draggable={!readOnly && !isEditing}
          onDragStart={() => handleDragStart(event.id)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(event.id)}
        >
          <Card className={cn(
            "transition-all",
            draggedEvent === event.id && "opacity-50",
            event.isFork && "border-l-4 border-l-purple-500"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                {!readOnly && (
                  <div className="cursor-move text-gray-400 mt-1">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}

                {/* Expand/collapse */}
                {hasChildren && (
                  <button
                    onClick={() => toggleExpanded(event.id)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>
                )}

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={event.title}
                        onChange={(e) => updateEvent(event.id, { title: e.target.value })}
                        placeholder="Event title (e.g., 'Individual decides to participate')"
                        autoFocus
                      />
                      <Textarea
                        value={event.description || ''}
                        onChange={(e) => updateEvent(event.id, { description: e.target.value })}
                        placeholder="Description (optional)"
                        rows={2}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={event.time || ''}
                          onChange={(e) => updateEvent(event.id, { time: e.target.value })}
                          placeholder="Time (e.g., 'Day 1')"
                        />
                        <Input
                          value={event.location || ''}
                          onChange={(e) => updateEvent(event.id, { location: e.target.value })}
                          placeholder="Location"
                        />
                        <Input
                          value={event.duration || ''}
                          onChange={(e) => updateEvent(event.id, { duration: e.target.value })}
                          placeholder="Duration"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setEditingEvent(null)}
                          disabled={!event.title.trim()}
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingEvent(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => !readOnly && setEditingEvent(event.id)} className={!readOnly ? "cursor-pointer" : ""}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {event.isFork && (
                              <GitFork className="h-4 w-4 text-purple-600" />
                            )}
                            <h4 className="font-medium text-sm">
                              {event.title || <span className="text-gray-400 italic">Untitled event</span>}
                            </h4>
                          </div>
                          {event.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {event.description}
                            </p>
                          )}
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            {event.time && (
                              <span>🕐 {event.time}</span>
                            )}
                            {event.location && (
                              <span>📍 {event.location}</span>
                            )}
                            {event.duration && (
                              <span>⏱️ {event.duration}</span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!readOnly && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                moveEvent(event.id, 'left')
                              }}
                              title="Move earlier in timeline"
                              className="h-7 w-7 p-0"
                            >
                              ←
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                moveEvent(event.id, 'right')
                              }}
                              title="Move later in timeline"
                              className="h-7 w-7 p-0"
                            >
                              →
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteEvent(event.id)
                              }}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Add sub-step and fork buttons */}
              {!readOnly && !isEditing && (
                <div className="flex gap-2 mt-3 ml-8">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addEvent(event.id, false)}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Sub-step
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addEvent(event.id, true)}
                    className="text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <GitFork className="h-3 w-3 mr-1" />
                    Add Fork (Alternative)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Render children */}
        {isExpanded && hasChildren && (
          <div className="ml-4">
            {event.children!.map((child, idx) =>
              renderEvent(child, level + 1, idx, event.children!.length)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Behavior Timeline</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Document when, where, and how long the behavior occurs. Add sub-steps and alternative paths (forks).
          </p>
        </div>
        {!readOnly && (
          <Button onClick={() => addEvent()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <Card className="p-12 text-center bg-gray-50 dark:bg-gray-800/50">
          <div className="text-gray-400 mb-2">📅</div>
          <p className="text-gray-500 dark:text-gray-400">
            No timeline events yet. Click "Add Event" to begin mapping the behavior sequence.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events
            .filter(e => !e.parentId)
            .sort((a, b) => a.order - b.order)
            .map((event, idx, arr) => renderEvent(event, 0, idx, arr.length))}
        </div>
      )}

      {!readOnly && (
        <div className="text-xs text-gray-500 space-y-1 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <p className="font-medium text-blue-900 dark:text-blue-100">Timeline Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
            <li>Drag events to reorder or use ← → buttons to move chronologically</li>
            <li><strong>Sub-steps</strong>: Break down complex events into detailed steps</li>
            <li><strong>Forks</strong>: Show alternative paths or parallel possibilities (marked with purple border)</li>
            <li>Click any event to edit time, location, and duration details</li>
          </ul>
        </div>
      )}
    </div>
  )
}
