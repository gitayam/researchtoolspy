/**
 * ScorerToggle — Segmented control for switching between score views:
 * "Your Scores" / "Other Analyst" (dropdown) / "Merged (Median)"
 *
 * Emits the selected scorer user_id (or null for merged) to parent.
 */

import { useState, useEffect, useCallback } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ──────────────────────────────────────────────────────

interface ScorerInfo {
  id: string
  user_id: number | null
  status: string
  completion_percent: number
}

type ViewMode = 'mine' | 'other' | 'merged'

interface ScorerToggleProps {
  tableId: string
  currentUserId: number
  onViewChange: (mode: ViewMode, scorerUserId: number | null) => void
}

// ── Component ──────────────────────────────────────────────────

export function ScorerToggle({ tableId, currentUserId, onViewChange }: ScorerToggleProps) {
  const [mode, setMode] = useState<ViewMode>('mine')
  const [scorers, setScorers] = useState<ScorerInfo[]>([])
  const [selectedScorerId, setSelectedScorerId] = useState<string>('')

  const fetchScorers = useCallback(async () => {
    try {
      const res = await fetch(`/api/cross-table/${tableId}/scorers`, {
        headers: getCopHeaders(),
      })
      if (!res.ok) return
      const data = await res.json()
      setScorers((data.scorers ?? []).filter((s: ScorerInfo) => s.user_id !== null))
    } catch {
      // Silent — toggle still works for "mine" and "merged"
    }
  }, [tableId])

  useEffect(() => {
    fetchScorers()
  }, [fetchScorers])

  const otherScorers = scorers.filter(
    (s) => s.user_id !== null && s.user_id !== currentUserId
  )

  const handleModeChange = (newMode: ViewMode) => {
    setMode(newMode)
    if (newMode === 'mine') {
      onViewChange('mine', currentUserId)
    } else if (newMode === 'merged') {
      onViewChange('merged', null)
    }
    // 'other' waits for dropdown selection
  }

  const handleScorerSelect = (scorerUserId: string) => {
    setSelectedScorerId(scorerUserId)
    setMode('other')
    onViewChange('other', Number(scorerUserId))
  }

  // Don't render if there are no other scorers
  if (otherScorers.length === 0) return null

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50">
      {/* Your Scores */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-3 text-xs rounded-md',
          mode === 'mine' && 'bg-white shadow-sm text-[#4F5BFF] font-semibold'
        )}
        onClick={() => handleModeChange('mine')}
      >
        Your Scores
      </Button>

      {/* Other Analyst */}
      <div className="relative">
        <Select
          value={mode === 'other' ? selectedScorerId : ''}
          onValueChange={handleScorerSelect}
        >
          <SelectTrigger
            className={cn(
              'h-7 min-w-[120px] border-0 bg-transparent text-xs px-3',
              mode === 'other' && 'bg-white shadow-sm text-[#4F5BFF] font-semibold rounded-md'
            )}
          >
            <Users className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Other Analyst" />
          </SelectTrigger>
          <SelectContent>
            {otherScorers.map((s) => (
              <SelectItem key={s.id} value={String(s.user_id)}>
                Analyst #{s.user_id} ({s.completion_percent}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Merged (Median) */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-3 text-xs rounded-md',
          mode === 'merged' && 'bg-white shadow-sm text-[#4F5BFF] font-semibold'
        )}
        onClick={() => handleModeChange('merged')}
      >
        Merged
      </Button>
    </div>
  )
}
