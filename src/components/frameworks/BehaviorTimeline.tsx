import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, GitFork, GripVertical, Link as LinkIcon, ExternalLink, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TimelineEvent as BehaviorTimelineEvent, BehaviorMetadata } from '@/types/behavior'
import { BehaviorSearchDialog } from './BehaviorSearchDialog'

// Re-export the type from behavior for external use
export type { TimelineEvent } from '@/types/behavior'

// Internal UI type that extends the base type with editor-specific fields
interface TimelineEventUI extends BehaviorTimelineEvent {
  order: number
}

interface BehaviorTimelineProps {
  events: BehaviorTimelineEvent[]
  onChange: (events: BehaviorTimelineEvent[]) => void
  readOnly?: boolean
}

export function BehaviorTimeline({ events, onChange, readOnly = false }: BehaviorTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [editingEvent, setEditingEvent] = useState<string | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null)

  // Convert to UI format
  const uiEvents: TimelineEventUI[] = events.map((e, i) => ({ ...e, order: i }))

  const toExternal = (uiEvents: TimelineEventUI[]): BehaviorTimelineEvent[] => {
    return uiEvents.map(({ order, ...e }) => e)
  }

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const addEvent = () => {
    const newEvent: TimelineEventUI = {
      id: `event-${Date.now()}-${Math.random()}`,
      label: '',
      order: uiEvents.length
    }

    onChange(toExternal([...uiEvents, newEvent]))
    setEditingEvent(newEvent.id)
  }

  const addSubStep = (eventId: string) => {
    const updatedEvents = uiEvents.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          sub_steps: [
            ...(event.sub_steps || []),
            {
              label: '',
              description: '',
              duration: ''
            }
          ]
        }
      }
      return event
    })

    onChange(toExternal(updatedEvents))
    setExpandedEvents(new Set([...expandedEvents, eventId]))
  }

  const addFork = (eventId: string) => {
    const updatedEvents = uiEvents.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          forks: [
            ...(event.forks || []),
            {
              condition: '',
              label: '',
              path: []
            }
          ]
        }
      }
      return event
    })

    onChange(toExternal(updatedEvents))
    setExpandedEvents(new Set([...expandedEvents, eventId]))
  }

  const updateEvent = (eventId: string, updates: Partial<TimelineEventUI>) => {
    const updatedEvents = uiEvents.map(event => {
      if (event.id === eventId) {
        return { ...event, ...updates }
      }
      return event
    })

    onChange(toExternal(updatedEvents))
  }

  const deleteEvent = (eventId: string) => {
    const updatedEvents = uiEvents.filter(event => event.id !== eventId)
    onChange(toExternal(updatedEvents))
  }

  const moveEvent = (eventId: string, direction: 'left' | 'right') => {
    const index = uiEvents.findIndex(e => e.id === eventId)
    if (index === -1) return

    const newIndex = direction === 'left' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= uiEvents.length) return

    const newList = [...uiEvents]
    const temp = newList[index]
    newList[index] = newList[newIndex]
    newList[newIndex] = temp

    // Update order numbers
    const reordered = newList.map((event, i) => ({ ...event, order: i }))
    onChange(toExternal(reordered))
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
    const findEventIndex = (eventsList: TimelineEventUI[], eventId: string): number => {
      return eventsList.findIndex(e => e.id === eventId)
    }

    const draggedIndex = findEventIndex(uiEvents, draggedEvent)
    const targetIndex = findEventIndex(uiEvents, targetEventId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newEvents = [...uiEvents]
      const temp = newEvents[draggedIndex]
      newEvents.splice(draggedIndex, 1)
      newEvents.splice(targetIndex, 0, temp)

      // Update order numbers
      onChange(toExternal(newEvents.map((event, i) => ({ ...event, order: i }))))
    }

    setDraggedEvent(null)
  }

  const handleLinkBehavior = (behavior: BehaviorMetadata) => {
    if (!linkingEventId) return

    updateEvent(linkingEventId, {
      linked_behavior_id: behavior.id,
      linked_behavior_title: behavior.title,
      linked_behavior_type: behavior.complexity
    })

    setSearchDialogOpen(false)
    setLinkingEventId(null)
  }

  const unlinkBehavior = (eventId: string) => {
    updateEvent(eventId, {
      linked_behavior_id: undefined,
      linked_behavior_title: undefined,
      linked_behavior_type: undefined
    })
  }

  const renderEvent = (event: TimelineEventUI) => {
    const isEditing = editingEvent === event.id

    return (
      <div key={event.id} className="relative">
        <div
          className="relative mb-3"
          draggable={!readOnly && !isEditing}
          onDragStart={() => handleDragStart(event.id)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(event.id)}
        >
          <Card className={cn(
            "transition-all",
            draggedEvent === event.id && "opacity-50"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                {!readOnly && (
                  <div className="cursor-move text-gray-400 mt-1">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}


                {/* Event content */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={event.label}
                        onChange={(e) => updateEvent(event.id, { label: e.target.value })}
                        placeholder="Event label (e.g., 'Individual decides to participate')"
                        autoFocus
                      />
                      <Textarea
                        value={event.description || ''}
                        onChange={(e) => updateEvent(event.id, { description: e.target.value })}
                        placeholder="Description (optional)"
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={event.time || ''}
                          onChange={(e) => updateEvent(event.id, { time: e.target.value })}
                          placeholder="Time (e.g., 'Day 1', '9:00 AM')"
                        />
                        <Input
                          value={event.location || ''}
                          onChange={(e) => updateEvent(event.id, { location: e.target.value })}
                          placeholder="Location"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setEditingEvent(null)}
                          disabled={!event.label.trim()}
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
                          <h4 className="font-medium text-sm">
                            {event.label || <span className="text-gray-400 italic">Untitled event</span>}
                          </h4>
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
                          </div>
                          {/* Show sub-steps if any */}
                          {event.sub_steps && event.sub_steps.length > 0 && (
                            <div className="mt-2 pl-4 border-l-2 border-gray-300 space-y-1">
                              {event.sub_steps.map((step, idx) => (
                                <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">{idx + 1}.</span> {step.label || 'Untitled step'}
                                  {step.duration && <span className="ml-2 text-gray-500">({step.duration})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Show forks if any */}
                          {event.forks && event.forks.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {event.forks.map((fork, idx) => (
                                <div key={idx} className="text-xs text-purple-600 dark:text-purple-400 flex items-start gap-1">
                                  <GitFork className="h-3 w-3 mt-0.5" />
                                  <span>{fork.condition || fork.label || 'Alternative path'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Show linked behavior if any */}
                          {event.linked_behavior_id && (
                            <div className="mt-3 flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                <LinkIcon className="h-3 w-3" />
                                Linked: {event.linked_behavior_title}
                                {event.linked_behavior_type && (
                                  <span className="text-xs opacity-70">({event.linked_behavior_type.replace('_', ' ')})</span>
                                )}
                              </Badge>
                              {!readOnly && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    unlinkBehavior(event.id)
                                  }}
                                  className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                >
                                  Unlink
                                </Button>
                              )}
                            </div>
                          )}
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

              {/* Add sub-step, link behavior, and fork buttons */}
              {!readOnly && !isEditing && (
                <div className="flex gap-2 mt-3 ml-8 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      addSubStep(event.id)
                    }}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Sub-step
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLinkingEventId(event.id)
                      setSearchDialogOpen(true)
                    }}
                    className="text-xs text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <LinkIcon className="h-3 w-3 mr-1" />
                    Link Behavior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      addFork(event.id)
                    }}
                    className="text-xs text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <GitFork className="h-3 w-3 mr-1" />
                    Add Fork (Alternative)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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

      {uiEvents.length === 0 ? (
        <Card className="p-12 text-center bg-gray-50 dark:bg-gray-800/50">
          <div className="text-gray-400 mb-2">📅</div>
          <p className="text-gray-500 dark:text-gray-400">
            No timeline events yet. Click "Add Event" to begin mapping the behavior sequence.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {uiEvents
            .sort((a, b) => a.order - b.order)
            .map((event) => renderEvent(event))}
        </div>
      )}

      {!readOnly && (
        <div className="text-xs text-gray-500 space-y-1 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <p className="font-medium text-blue-900 dark:text-blue-100">Timeline Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
            <li>Drag events to reorder or use ← → buttons to move chronologically</li>
            <li><strong>Sub-steps</strong>: Break down complex events into detailed steps</li>
            <li><strong>Link Behavior</strong>: Connect timeline events to existing behavior analyses for composable workflows</li>
            <li><strong>Forks</strong>: Show alternative paths or parallel possibilities (marked with purple border)</li>
            <li>Click any event to edit time, location, and duration details</li>
          </ul>
        </div>
      )}

      {/* Behavior Search Dialog */}
      <BehaviorSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelect={handleLinkBehavior}
      />
    </div>
  )
}
