/**
 * CopMapWithLayers — Modern map layout with floating layer controls.
 *
 * Desktop (md+): Side-by-side layer panel + map (traditional layout)
 * Mobile (<md): Full-width map with floating "Layers" pill button.
 *   Tapping the pill opens a slide-up overlay panel for layer toggles.
 */

import { useState, useCallback } from 'react'
import { Layers, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import CopMap from '@/components/cop/CopMap'
import CopLayerPanel from '@/components/cop/CopLayerPanel'
import type { CopMapProps } from '@/components/cop/CopMap'
import type { CopLayerPanelProps } from '@/components/cop/CopLayerPanel'

interface CopMapWithLayersProps {
  expanded: boolean
  mapProps: CopMapProps
  layerProps: CopLayerPanelProps
}

export default function CopMapWithLayers({
  expanded,
  mapProps,
  layerProps,
}: CopMapWithLayersProps) {
  const [showMobileLayers, setShowMobileLayers] = useState(false)

  const openLayers = useCallback(() => setShowMobileLayers(true), [])
  const closeLayers = useCallback(() => setShowMobileLayers(false), [])

  return (
    <div className={cn('relative flex h-full', expanded ? 'min-h-[400px] sm:min-h-[600px]' : '')}>
      {/* ── Desktop: traditional side-by-side layer panel ────────── */}
      {expanded && (
        <div className="hidden md:block">
          <CopLayerPanel {...layerProps} />
        </div>
      )}

      {/* ── Map (always full width on mobile) ────────────────────── */}
      <div className="flex-1 relative min-h-0">
        <CopMap {...mapProps} />

        {/* ── Mobile: floating layers pill button ──────────────────── */}
        {expanded && (
          <button
            type="button"
            onClick={openLayers}
            className={cn(
              'absolute top-3 left-3 z-10 md:hidden',
              'flex items-center gap-1.5 px-3 py-2 rounded-full',
              'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm',
              'border border-slate-200 dark:border-slate-600',
              'text-xs font-medium text-slate-700 dark:text-slate-200',
              'shadow-lg active:scale-95 transition-transform',
              'cursor-pointer touch-manipulation',
              'min-h-[44px]',
            )}
            aria-label="Open layer controls"
          >
            <Layers className="h-4 w-4" />
            <span>Layers</span>
            {layerProps.activeLayers.length > 0 && (
              <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-semibold tabular-nums">
                {layerProps.activeLayers.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Mobile: slide-up layer overlay ─────────────────────────── */}
      {expanded && showMobileLayers && (
        <div
          className="absolute inset-0 z-20 md:hidden flex flex-col"
          role="dialog"
          aria-label="Map layers"
          aria-modal="true"
        >
          {/* Backdrop — tap to close */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-pointer"
            onClick={closeLayers}
            aria-label="Close layer panel"
            tabIndex={-1}
          />

          {/* Panel slides up from bottom */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-700 animate-[slideUp_200ms_ease-out]">
            {/* Handle bar + header */}
            <div className="flex flex-col items-center pt-2 pb-1 px-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              {/* Drag handle indicator */}
              <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mb-2" />
              <div className="w-full flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Map Layers
                </h2>
                <button
                  type="button"
                  onClick={closeLayers}
                  className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                  aria-label="Close layers"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Layer panel content (scrollable) */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <CopLayerPanel {...layerProps} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
