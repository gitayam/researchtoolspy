/**
 * usePanelLayout — Manages reorderable, resizable COP panel layout
 *
 * Stores panel order and width preferences in localStorage per COP session.
 * Panels can be 'full' (spans whole row) or 'half' (shares row with adjacent half).
 * Panels can be moved up/down and hidden/shown.
 */

import { useState, useCallback, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────

export type PanelWidth = 'full' | 'half'

export interface PanelConfig {
  id: string
  width: PanelWidth
  visible: boolean
}

export interface PanelLayoutState {
  panels: PanelConfig[]
  version: number // bump to invalidate stale layouts when we add new panels
}

// ── Defaults ───────────────────────────────────────────────────

const LAYOUT_VERSION = 6

/** Default panel order and widths — matches the original hardcoded layout */
export const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'graph',       width: 'half', visible: true },
  { id: 'timeline',    width: 'half', visible: true },
  { id: 'alerts',      width: 'full', visible: true },
  { id: 'actors',      width: 'full', visible: true },
  { id: 'rfi',         width: 'half', visible: true },
  { id: 'analysis',    width: 'half', visible: true },
  { id: 'poo',         width: 'half', visible: true },
  { id: 'tasks',       width: 'full', visible: true },
  { id: 'submissions', width: 'half', visible: true },
  { id: 'assets',      width: 'half', visible: true },
  { id: 'playbooks',   width: 'full', visible: true },
  { id: 'claims',      width: 'full', visible: true },
  { id: 'evidence',    width: 'full', visible: true },
  { id: 'activity',    width: 'full', visible: true },
]

// All known panel IDs (used to merge new panels into stale layouts)
const ALL_PANEL_IDS = new Set(DEFAULT_PANELS.map((p) => p.id))

// ── Storage ────────────────────────────────────────────────────

function getStorageKey(sessionId: string) {
  return `cop_panel_layout_${sessionId}`
}

function loadLayout(sessionId: string): PanelLayoutState {
  try {
    const raw = localStorage.getItem(getStorageKey(sessionId))
    if (!raw) return { panels: DEFAULT_PANELS, version: LAYOUT_VERSION }

    const saved: PanelLayoutState = JSON.parse(raw)

    // If version mismatch, merge: keep user order for known panels, append new ones
    if (saved.version !== LAYOUT_VERSION) {
      const savedIds = new Set(saved.panels.map((p) => p.id))
      const merged = [
        ...saved.panels.filter((p) => ALL_PANEL_IDS.has(p.id)),
        ...DEFAULT_PANELS.filter((p) => !savedIds.has(p.id)),
      ]
      return { panels: merged, version: LAYOUT_VERSION }
    }

    // Also handle case where saved panels are missing new ones
    const savedIds = new Set(saved.panels.map((p) => p.id))
    const missing = DEFAULT_PANELS.filter((p) => !savedIds.has(p.id))
    if (missing.length > 0) {
      return {
        panels: [...saved.panels.filter((p) => ALL_PANEL_IDS.has(p.id)), ...missing],
        version: LAYOUT_VERSION,
      }
    }

    return saved
  } catch {
    return { panels: DEFAULT_PANELS, version: LAYOUT_VERSION }
  }
}

function saveLayout(sessionId: string, state: PanelLayoutState) {
  localStorage.setItem(getStorageKey(sessionId), JSON.stringify(state))
}

// ── Hook ───────────────────────────────────────────────────────

export function usePanelLayout(sessionId: string) {
  const [state, setState] = useState<PanelLayoutState>(() => loadLayout(sessionId))

  const update = useCallback(
    (updater: (prev: PanelLayoutState) => PanelLayoutState) => {
      setState((prev) => {
        const next = updater(prev)
        saveLayout(sessionId, next)
        return next
      })
    },
    [sessionId]
  )

  const movePanel = useCallback(
    (panelId: string, direction: 'up' | 'down') => {
      update((prev) => {
        const idx = prev.panels.findIndex((p) => p.id === panelId)
        if (idx < 0) return prev
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1
        if (targetIdx < 0 || targetIdx >= prev.panels.length) return prev

        const next = [...prev.panels]
        ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
        return { ...prev, panels: next }
      })
    },
    [update]
  )

  const toggleWidth = useCallback(
    (panelId: string) => {
      update((prev) => ({
        ...prev,
        panels: prev.panels.map((p) =>
          p.id === panelId ? { ...p, width: p.width === 'full' ? 'half' : 'full' } : p
        ),
      }))
    },
    [update]
  )

  const toggleVisible = useCallback(
    (panelId: string) => {
      update((prev) => ({
        ...prev,
        panels: prev.panels.map((p) =>
          p.id === panelId ? { ...p, visible: !p.visible } : p
        ),
      }))
    },
    [update]
  )

  const resetLayout = useCallback(() => {
    update(() => ({ panels: DEFAULT_PANELS, version: LAYOUT_VERSION }))
  }, [update])

  const visiblePanels = useMemo(
    () => state.panels.filter((p) => p.visible),
    [state.panels]
  )

  const hiddenPanels = useMemo(
    () => state.panels.filter((p) => !p.visible),
    [state.panels]
  )

  return {
    panels: state.panels,
    visiblePanels,
    hiddenPanels,
    movePanel,
    toggleWidth,
    toggleVisible,
    resetLayout,
  }
}
