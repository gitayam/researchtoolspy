/**
 * Shared context, reducer, and types for cross-table editors.
 * Used by both CrossTableEditor (full editor) and ScorerView (scorer-only).
 */

import { createContext, useContext, type Dispatch } from 'react'
import type { CrossTable, CrossTableConfig, Score } from '@/lib/cross-table/types'

// ── State & Actions ─────────────────────────────────────────────

export interface EditorState {
  table: CrossTable
  scores: Score[]
  scoresDirty: boolean
  configVersion: number
  activeTab: string
}

export type EditorAction =
  | { type: 'SET_TABLE'; table: CrossTable }
  | { type: 'SET_SCORES'; scores: Score[] }
  | { type: 'UPDATE_CONFIG'; config: Partial<CrossTableConfig> }
  | { type: 'UPDATE_TITLE'; title: string }
  | { type: 'UPDATE_SCORE'; rowId: string; colId: string; score: number | string | null; confidence?: number; notes?: string }
  | { type: 'MARK_SCORES_CLEAN' }
  | { type: 'SET_TAB'; tab: string }

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TABLE':
      return { ...state, table: action.table }

    case 'SET_SCORES':
      return { ...state, scores: action.scores, scoresDirty: false }

    case 'UPDATE_CONFIG':
      return {
        ...state,
        table: {
          ...state.table,
          config: { ...state.table.config, ...action.config },
        },
        configVersion: state.configVersion + 1,
      }

    case 'UPDATE_TITLE':
      return {
        ...state,
        table: { ...state.table, title: action.title },
        configVersion: state.configVersion + 1,
      }

    case 'UPDATE_SCORE': {
      const idx = state.scores.findIndex(
        (s) => s.row_id === action.rowId && s.col_id === action.colId
      )
      const updated = { row_id: action.rowId, col_id: action.colId, score: action.score } as Score
      if (action.confidence !== undefined) updated.confidence = action.confidence
      if (action.notes !== undefined) updated.notes = action.notes

      const newScores = [...state.scores]
      if (idx >= 0) {
        newScores[idx] = { ...newScores[idx], ...updated }
      } else {
        newScores.push(updated)
      }
      return { ...state, scores: newScores, scoresDirty: true }
    }

    case 'MARK_SCORES_CLEAN':
      return { ...state, scoresDirty: false }

    case 'SET_TAB':
      return { ...state, activeTab: action.tab }

    default:
      return state
  }
}

// ── Context ─────────────────────────────────────────────────────

export interface CrossTableContextValue {
  state: EditorState
  dispatch: Dispatch<EditorAction>
}

export const CrossTableContext = createContext<CrossTableContextValue | null>(null)

export function useCrossTable() {
  const ctx = useContext(CrossTableContext)
  if (!ctx) throw new Error('useCrossTable must be used within a CrossTable provider')
  return ctx
}
