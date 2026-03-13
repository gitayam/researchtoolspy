/**
 * ScoreCell — Click-to-score cell with method-appropriate input.
 *
 * Supports: numeric, likert, traffic (R/A/G), ternary (+/0/-),
 * binary (yes/no), ach (CC/C/N/I/II).
 * Per-column scoring_override for Kepner-Tregoe.
 * Right-click → notes popover. Heat-map background color.
 */

import { useState, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getColumnScoringMethod,
  getColumnNormConfig,
  normalizeScore,
} from '@/lib/cross-table/engine/scoring'
import type { ScoringMethod, CrossTableColumn, CrossTableConfig } from '@/lib/cross-table/types'

// ── Props ───────────────────────────────────────────────────────

interface ScoreCellProps {
  value: number | string | null
  notes?: string
  confidence?: number
  column: CrossTableColumn
  config: CrossTableConfig
  delphiEnabled?: boolean
  onChange: (value: number | string | null) => void
  onNotesChange?: (notes: string) => void
  onConfidenceChange?: (confidence: number) => void
  readOnly?: boolean
}

// ── Heat map color (0→red, 0.5→amber, 1→green) ────────────────

function heatColor(norm: number): string {
  if (norm <= 0.33) return 'bg-red-100 text-red-900'
  if (norm <= 0.66) return 'bg-amber-100 text-amber-900'
  return 'bg-green-100 text-green-900'
}

// ── ACH labels ──────────────────────────────────────────────────

const ACH_OPTIONS = [
  { value: 'CC', label: 'CC', title: 'Strongly Consistent' },
  { value: 'C', label: 'C', title: 'Consistent' },
  { value: 'N', label: 'N', title: 'Neutral' },
  { value: 'I', label: 'I', title: 'Inconsistent' },
  { value: 'II', label: 'II', title: 'Strongly Inconsistent' },
]

// ── Component ───────────────────────────────────────────────────

export function ScoreCell({
  value,
  notes,
  confidence,
  column,
  config,
  delphiEnabled,
  onChange,
  onNotesChange,
  onConfidenceChange,
  readOnly,
}: ScoreCellProps) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes ?? '')
  const cellRef = useRef<HTMLDivElement>(null)

  const method = getColumnScoringMethod(column, config.scoring.method)
  const normConfig = getColumnNormConfig(column, {
    min: config.scoring.scale?.min,
    max: config.scoring.scale?.max,
    likert_labels: config.scoring.labels ?? undefined,
  })

  const norm = normalizeScore(value, method, normConfig)
  const hasValue = value !== null && value !== undefined
  const colorClass = hasValue ? heatColor(norm) : 'bg-slate-50 text-slate-400'

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setLocalNotes(notes ?? '')
    setNotesOpen(true)
  }

  const saveNotes = () => {
    onNotesChange?.(localNotes)
    setNotesOpen(false)
  }

  return (
    <Popover open={notesOpen} onOpenChange={setNotesOpen}>
      <PopoverTrigger asChild>
        <div
          ref={cellRef}
          className={cn(
            'relative min-h-[44px] min-w-[80px] flex items-center justify-center p-1 border border-slate-200 rounded cursor-pointer transition-colors',
            colorClass,
            readOnly && 'cursor-default'
          )}
          onContextMenu={handleContextMenu}
        >
          {/* Notes indicator */}
          {notes && (
            <MessageSquare className="absolute top-0.5 right-0.5 h-3 w-3 text-muted-foreground opacity-50" />
          )}

          {/* Score input by method */}
          {readOnly ? (
            <ScoreDisplay value={value} method={method} normConfig={normConfig} />
          ) : (
            <ScoreInput
              value={value}
              method={method}
              normConfig={normConfig}
              onChange={onChange}
            />
          )}

          {/* Delphi confidence micro-slider */}
          {delphiEnabled && !readOnly && (
            <input
              type="range"
              min={0}
              max={100}
              value={confidence ?? 50}
              onChange={(e) => onConfidenceChange?.(Number(e.target.value) / 100)}
              className="absolute bottom-0 left-0 right-0 h-1 appearance-none bg-transparent opacity-50 hover:opacity-100"
              title={`Confidence: ${confidence ?? 50}%`}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </PopoverTrigger>

      {/* Notes popover */}
      <PopoverContent className="w-64" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium">Cell Notes</p>
          <Textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Add notes..."
            className="text-xs min-h-[60px]"
            readOnly={readOnly}
          />
          {!readOnly && (
            <div className="flex justify-end">
              <Button size="sm" onClick={saveNotes} className="text-xs h-7">
                Save
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Read-only display ───────────────────────────────────────────

function ScoreDisplay({
  value,
  method,
  normConfig,
}: {
  value: number | string | null
  method: ScoringMethod
  normConfig: { min?: number; max?: number; likert_labels?: string[] }
}) {
  if (value === null || value === undefined) return <span className="text-xs">--</span>

  switch (method) {
    case 'traffic':
      return <TrafficDisplay value={String(value)} />
    case 'ternary':
      return <span className="text-lg font-bold">{value}</span>
    case 'binary':
      return <span className="text-xs font-medium">{value === 'yes' ? 'Yes' : 'No'}</span>
    case 'ach':
      return <span className="text-sm font-bold">{value}</span>
    case 'likert': {
      const labels = normConfig.likert_labels ?? ['SD', 'D', 'N', 'A', 'SA']
      const idx = Number(value)
      return <span className="text-xs font-medium">{labels[idx] ?? value}</span>
    }
    default:
      return <span className="text-sm font-medium">{value}</span>
  }
}

// ── Traffic light display ───────────────────────────────────────

function TrafficDisplay({ value }: { value: string }) {
  const colors: Record<string, string> = {
    R: 'bg-red-500',
    A: 'bg-amber-400',
    G: 'bg-green-500',
  }
  return <div className={cn('h-6 w-6 rounded-full', colors[value] ?? 'bg-slate-300')} />
}

// ── Interactive score input ─────────────────────────────────────

function ScoreInput({
  value,
  method,
  normConfig,
  onChange,
}: {
  value: number | string | null
  method: ScoringMethod
  normConfig: { min?: number; max?: number; likert_labels?: string[] }
  onChange: (value: number | string | null) => void
}) {
  switch (method) {
    case 'numeric':
      return (
        <NumericInput
          value={value as number | null}
          min={normConfig.min ?? 0}
          max={normConfig.max ?? 10}
          onChange={onChange}
        />
      )
    case 'likert':
      return (
        <LikertInput
          value={value as number | null}
          labels={normConfig.likert_labels ?? ['SD', 'D', 'N', 'A', 'SA']}
          onChange={onChange}
        />
      )
    case 'traffic':
      return <TrafficInput value={value as string | null} onChange={onChange} />
    case 'ternary':
      return <TernaryInput value={value as string | null} onChange={onChange} />
    case 'binary':
      return <BinaryInput value={value as string | null} onChange={onChange} />
    case 'ach':
      return <ACHInput value={value as string | null} onChange={onChange} />
    default:
      return <span className="text-xs text-muted-foreground">?</span>
  }
}

// ── Numeric Input ───────────────────────────────────────────────

function NumericInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number | null
  min: number
  max: number
  onChange: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(value !== null ? String(value) : '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const num = parseFloat(draft)
    if (isNaN(num)) {
      onChange(null)
    } else {
      onChange(Math.max(min, Math.min(max, num)))
    }
  }

  if (editing) {
    return (
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        autoFocus
        className="w-full h-full text-center text-sm bg-transparent outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="w-full h-full text-sm font-medium text-center min-h-[44px] flex items-center justify-center"
    >
      {value !== null ? value : '--'}
    </button>
  )
}

// ── Likert Button Group ─────────────────────────────────────────

function LikertInput({
  value,
  labels,
  onChange,
}: {
  value: number | null
  labels: string[]
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-0.5 flex-wrap justify-center p-0.5">
      {labels.map((label, idx) => (
        <button
          key={idx}
          onClick={(e) => { e.stopPropagation(); onChange(idx) }}
          className={cn(
            'px-1.5 py-0.5 text-[10px] rounded transition-colors min-h-[28px]',
            value === idx
              ? 'bg-[#4F5BFF] text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          )}
          title={label}
        >
          {label.length > 4 ? label.slice(0, 3) : label}
        </button>
      ))}
    </div>
  )
}

// ── Traffic Light (R/A/G) ───────────────────────────────────────

function TrafficInput({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string) => void
}) {
  const options = [
    { value: 'R', color: 'bg-red-500', ring: 'ring-red-300' },
    { value: 'A', color: 'bg-amber-400', ring: 'ring-amber-300' },
    { value: 'G', color: 'bg-green-500', ring: 'ring-green-300' },
  ]

  return (
    <div className="flex gap-1.5 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => { e.stopPropagation(); onChange(opt.value) }}
          className={cn(
            'h-7 w-7 rounded-full transition-all',
            opt.color,
            value === opt.value ? `ring-2 ${opt.ring} scale-110` : 'opacity-40 hover:opacity-70'
          )}
          title={opt.value === 'R' ? 'Red' : opt.value === 'A' ? 'Amber' : 'Green'}
        />
      ))}
    </div>
  )
}

// ── Ternary (+/0/-) ─────────────────────────────────────────────

function TernaryInput({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string) => void
}) {
  const options = [
    { value: '+', label: '+', title: 'Better' },
    { value: '0', label: '0', title: 'Same' },
    { value: '-', label: '-', title: 'Worse' },
  ]

  return (
    <div className="flex gap-0.5 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => { e.stopPropagation(); onChange(opt.value) }}
          className={cn(
            'h-8 w-8 rounded text-sm font-bold transition-colors flex items-center justify-center',
            value === opt.value
              ? 'bg-[#4F5BFF] text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          )}
          title={opt.title}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Binary (Yes/No) ─────────────────────────────────────────────

function BinaryInput({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1 p-0.5">
      {(['yes', 'no'] as const).map((opt) => (
        <button
          key={opt}
          onClick={(e) => { e.stopPropagation(); onChange(opt) }}
          className={cn(
            'px-2.5 py-1 rounded text-xs font-medium transition-colors min-h-[32px]',
            value === opt
              ? opt === 'yes'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          )}
        >
          {opt === 'yes' ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

// ── ACH Dropdown ────────────────────────────────────────────────

function ACHInput({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-0.5 p-0.5 flex-wrap justify-center">
      {ACH_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => { e.stopPropagation(); onChange(opt.value) }}
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors min-h-[28px]',
            value === opt.value
              ? 'bg-[#4F5BFF] text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          )}
          title={opt.title}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
