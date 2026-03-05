import { useState, useCallback } from 'react'
import { Plus, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CopSession, EventFact } from '@/types/cop'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '@/types/cop'
import type { CopEventType } from '@/types/cop'

// ── Props ────────────────────────────────────────────────────────

interface CopEventTabProps {
  session: CopSession
  onSessionUpdate: (updates: Partial<CopSession>) => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopEventTab({ session, onSessionUpdate }: CopEventTabProps) {
  const [factTime, setFactTime] = useState('')
  const [factText, setFactText] = useState('')

  const eventType = session.event_type as CopEventType | null
  const eventColor = eventType ? EVENT_TYPE_COLORS[eventType] : '#6b7280'
  const eventLabel = eventType ? EVENT_TYPE_LABELS[eventType] : 'Unknown'
  const facts: EventFact[] = session.event_facts ?? []

  const addFact = useCallback(() => {
    const trimmedText = factText.trim()
    if (!trimmedText) return

    const newFact: EventFact = {
      time: factTime || new Date().toISOString().slice(0, 16),
      text: trimmedText,
    }
    const updatedFacts = [...facts, newFact]
    onSessionUpdate({ event_facts: updatedFacts })
    setFactTime('')
    setFactText('')
  }, [factTime, factText, facts, onSessionUpdate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        addFact()
      }
    },
    [addFact]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Event</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Event type badge */}
        <div>
          <Badge
            className="text-white text-xs font-medium"
            style={{ backgroundColor: eventColor, borderColor: eventColor }}
          >
            {eventLabel}
          </Badge>
        </div>

        {/* Event description */}
        {session.event_description && (
          <p className="text-sm text-gray-300 leading-relaxed">
            {session.event_description}
          </p>
        )}

        {/* Key Facts timeline */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Key Facts
          </h3>

          {/* Add fact form */}
          <div className="flex gap-1.5 items-start">
            <input
              type="text"
              value={factTime}
              onChange={e => setFactTime(e.target.value)}
              placeholder="Time"
              className="w-16 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={factText}
              onChange={e => setFactText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New fact..."
              className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button
              size="sm"
              onClick={addFact}
              disabled={!factText.trim()}
              className="h-6 w-6 p-0 shrink-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Facts list */}
          {facts.length > 0 ? (
            <div className="space-y-1.5">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-500 shrink-0 flex items-center gap-0.5 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {fact.time}
                  </span>
                  <span className="text-gray-300">{fact.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No facts recorded yet.</p>
          )}
        </div>
      </div>

      {/* Summary counts at bottom */}
      <div className="px-3 py-2 border-t border-gray-700 flex items-center gap-4 text-xs text-gray-400 shrink-0">
        <span>Claims: 0</span>
        <span>Entities: 0</span>
      </div>
    </div>
  )
}
