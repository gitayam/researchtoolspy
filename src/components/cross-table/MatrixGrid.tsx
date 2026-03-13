/**
 * MatrixGrid — Interactive scoring table.
 *
 * Rows = alternatives, Columns = criteria.
 * Inline cell editing via ScoreCell.
 * Row/column add/remove/reorder (drag disabled during Delphi).
 */

import { useState, useCallback } from 'react'
import {
  Plus,
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCrossTable } from './cross-table-context'
import { ScoreCell } from './ScoreCell'
import type { CrossTableRow, CrossTableColumn } from '@/lib/cross-table/types'

// ── Helper: generate short ID ───────────────────────────────────

function shortId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Component ───────────────────────────────────────────────────

export function MatrixGrid() {
  const { state, dispatch } = useCrossTable()
  const { table, scores } = state
  const { rows, columns } = table.config
  const delphiActive = table.config.delphi.current_round > 0

  // ── Row management ──────────────────────────────────────────

  const addRow = () => {
    const newRow: CrossTableRow = {
      id: shortId(),
      label: `Option ${rows.length + 1}`,
      order: rows.length,
    }
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { rows: [...rows, newRow] },
    })
  }

  const removeRow = (rowId: string) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { rows: rows.filter((r) => r.id !== rowId).map((r, i) => ({ ...r, order: i })) },
    })
  }

  const renameRow = (rowId: string, label: string) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { rows: rows.map((r) => (r.id === rowId ? { ...r, label } : r)) },
    })
  }

  const moveRow = (rowId: string, direction: -1 | 1) => {
    const idx = rows.findIndex((r) => r.id === rowId)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= rows.length) return
    const newRows = [...rows]
    ;[newRows[idx], newRows[target]] = [newRows[target], newRows[idx]]
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { rows: newRows.map((r, i) => ({ ...r, order: i })) },
    })
  }

  // ── Column management ───────────────────────────────────────

  const addColumn = () => {
    const newCol: CrossTableColumn = {
      id: shortId(),
      label: `Criterion ${columns.length + 1}`,
      order: columns.length,
      weight: 1,
    }
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { columns: [...columns, newCol] },
    })
  }

  const removeColumn = (colId: string) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { columns: columns.filter((c) => c.id !== colId).map((c, i) => ({ ...c, order: i })) },
    })
  }

  const renameColumn = (colId: string, label: string) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { columns: columns.map((c) => (c.id === colId ? { ...c, label } : c)) },
    })
  }

  const moveColumn = (colId: string, direction: -1 | 1) => {
    const idx = columns.findIndex((c) => c.id === colId)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= columns.length) return
    const newCols = [...columns]
    ;[newCols[idx], newCols[target]] = [newCols[target], newCols[idx]]
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { columns: newCols.map((c, i) => ({ ...c, order: i })) },
    })
  }

  // ── Score lookup ────────────────────────────────────────────

  const getScore = (rowId: string, colId: string) => {
    return scores.find((s) => s.row_id === rowId && s.col_id === colId)
  }

  // ── Render ──────────────────────────────────────────────────

  const sortedRows = [...rows].sort((a, b) => a.order - b.order)
  const sortedCols = [...columns].sort((a, b) => a.order - b.order)

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Scrollable matrix */}
        <ScrollArea className="w-full overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="border-collapse">
              {/* Column headers */}
              <thead>
                <tr>
                  {/* Corner cell */}
                  <th className="sticky left-0 z-10 bg-white min-w-[160px] p-2 border border-slate-200" />

                  {sortedCols.map((col, colIdx) => (
                    <th
                      key={col.id}
                      className="min-w-[100px] max-w-[160px] p-2 border border-slate-200 bg-slate-50"
                    >
                      <div className="space-y-1">
                        <EditableLabel
                          value={col.label}
                          onChange={(v) => renameColumn(col.id, v)}
                          className="text-xs font-semibold text-center"
                        />
                        <div className="flex items-center justify-center gap-1">
                          {col.scoring_override && (
                            <Badge variant="outline" className="text-[9px] font-normal px-1 py-0">
                              {col.scoring_override}
                            </Badge>
                          )}
                          {col.group && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              {col.group}
                            </Badge>
                          )}
                        </div>
                        {!delphiActive && (
                          <div className="flex items-center justify-center gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => moveColumn(col.id, -1)}
                                  disabled={colIdx === 0}
                                  className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30"
                                >
                                  <ChevronUp className="h-3 w-3 -rotate-90" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Move left</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => moveColumn(col.id, 1)}
                                  disabled={colIdx === sortedCols.length - 1}
                                  className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30"
                                >
                                  <ChevronDown className="h-3 w-3 -rotate-90" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Move right</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => removeColumn(col.id)}
                                  className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Remove criterion</p></TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}

                  {/* Add column button */}
                  {!delphiActive && (
                    <th className="p-2 border border-slate-200 bg-slate-50">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={addColumn}
                            className="p-2 rounded hover:bg-slate-200 text-muted-foreground hover:text-[#4F5BFF] transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Add criterion</p></TooltipContent>
                      </Tooltip>
                    </th>
                  )}
                </tr>
              </thead>

              {/* Row data */}
              <tbody>
                {sortedRows.map((row, rowIdx) => (
                  <tr key={row.id}>
                    {/* Row header (sticky left) */}
                    <td className="sticky left-0 z-10 bg-white p-2 border border-slate-200">
                      <div className="flex items-center gap-1">
                        {!delphiActive && (
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-40" />
                        )}
                        <EditableLabel
                          value={row.label}
                          onChange={(v) => renameRow(row.id, v)}
                          className="text-xs font-medium flex-1"
                        />
                        {!delphiActive && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => moveRow(row.id, -1)}
                              disabled={rowIdx === 0}
                              className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveRow(row.id, 1)}
                              disabled={rowIdx === sortedRows.length - 1}
                              className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeRow(row.id)}
                              className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Score cells */}
                    {sortedCols.map((col) => {
                      const s = getScore(row.id, col.id)
                      return (
                        <td key={col.id} className="p-0.5 border border-slate-200">
                          <ScoreCell
                            value={s?.score ?? null}
                            notes={s?.notes}
                            confidence={s?.confidence}
                            column={col}
                            config={table.config}
                            delphiEnabled={delphiActive}
                            onChange={(v) =>
                              dispatch({
                                type: 'UPDATE_SCORE',
                                rowId: row.id,
                                colId: col.id,
                                score: v,
                              })
                            }
                            onNotesChange={(n) =>
                              dispatch({
                                type: 'UPDATE_SCORE',
                                rowId: row.id,
                                colId: col.id,
                                score: s?.score ?? null,
                                notes: n,
                              })
                            }
                            onConfidenceChange={(c) =>
                              dispatch({
                                type: 'UPDATE_SCORE',
                                rowId: row.id,
                                colId: col.id,
                                score: s?.score ?? null,
                                confidence: c,
                              })
                            }
                          />
                        </td>
                      )
                    })}

                    {/* Empty cell under "add column" */}
                    {!delphiActive && <td className="border border-slate-200" />}
                  </tr>
                ))}

                {/* Add row button */}
                {!delphiActive && (
                  <tr>
                    <td className="sticky left-0 z-10 bg-white p-2 border border-slate-200" colSpan={sortedCols.length + 2}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addRow}
                        className="text-muted-foreground hover:text-[#4F5BFF]"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Alternative
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
}

// ── Editable Label (inline rename) ──────────────────────────────

function EditableLabel({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onChange(trimmed)
    }
  }

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
        className={cn('bg-transparent outline-none border-b border-[#4F5BFF] w-full', className)}
      />
    )
  }

  return (
    <span
      onDoubleClick={startEdit}
      className={cn('cursor-text truncate block', className)}
      title="Double-click to rename"
    >
      {value}
    </span>
  )
}
