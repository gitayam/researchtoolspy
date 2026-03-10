import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Calendar,
  Users,
  GitBranch,
  Flame,
  Newspaper,
  Eye,
  Brain,
  Crosshair,
  Pencil,
} from 'lucide-react'
import { COP_LAYERS } from '@/components/cop/CopLayerCatalog'
import type { CopLayerCategory, CopLayerDef } from '@/types/cop'

// ── Icon lookup ─────────────────────────────────────────────────
const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  MapPin,
  Calendar,
  Users,
  GitBranch,
  Flame,
  Newspaper,
  Eye,
  Brain,
  Crosshair,
  Pencil,
}

// ── Category metadata ───────────────────────────────────────────
interface CategoryMeta {
  key: CopLayerCategory
  label: string
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'entities', label: 'Your Data' },
  { key: 'external', label: 'World Events' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'tactical', label: 'Tactical' },
]

// ── Props ───────────────────────────────────────────────────────
export interface CopLayerPanelProps {
  activeLayers: string[]
  onToggleLayer: (layerId: string) => void
  layerCounts?: Record<string, number>
  loading?: boolean
}

// ── Group layers by category ────────────────────────────────────
function groupByCategory(): Record<CopLayerCategory, CopLayerDef[]> {
  const groups: Record<string, CopLayerDef[]> = {
    entities: [],
    external: [],
    analysis: [],
    tactical: [],
  }
  for (const layer of COP_LAYERS) {
    groups[layer.category]?.push(layer)
  }
  return groups as Record<CopLayerCategory, CopLayerDef[]>
}

const LAYER_GROUPS = groupByCategory()

// ── Component ───────────────────────────────────────────────────
export default function CopLayerPanel({
  activeLayers,
  onToggleLayer,
  layerCounts,
  loading = false,
}: CopLayerPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCategory = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <aside className="w-full md:w-56 bg-white dark:bg-gray-900 md:border-r border-slate-200 dark:border-gray-700 flex flex-col overflow-y-auto shrink-0">
      {/* Header — hidden on mobile since parent overlay provides its own */}
      <div className="hidden md:block px-3 py-3 border-b border-slate-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200 uppercase tracking-wider">
          Layers
        </h2>
      </div>

      {/* Category sections */}
      <div className="flex-1 py-1">
        {loading ? (
          <div className="px-3 py-2 space-y-3">
            {[0, 1, 2].map(g => (
              <div key={g} className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-gray-800 animate-pulse" />
                {[0, 1, 2].map(r => (
                  <div key={r} className="flex items-center gap-2 px-1">
                    <div className="h-3.5 w-3.5 rounded bg-slate-200 dark:bg-gray-800 animate-pulse" />
                    <div className="h-3 w-3 rounded bg-slate-200 dark:bg-gray-800 animate-pulse" />
                    <div className="h-3 flex-1 rounded bg-slate-200 dark:bg-gray-800 animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
        <>
        {CATEGORIES.map(({ key, label }) => {
          const layers = LAYER_GROUPS[key]
          if (!layers || layers.length === 0) return null
          const isCollapsed = collapsed[key] ?? false

          return (
            <div key={key}>
              {/* Category toggle */}
              <button
                type="button"
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide hover:text-slate-800 dark:hover:text-gray-200 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="shrink-0" />
                ) : (
                  <ChevronDown size={14} className="shrink-0" />
                )}
                {label}
              </button>

              {/* Layer rows */}
              {!isCollapsed && (
                <div className="pb-1">
                  {layers.map((layer) => {
                    const isActive = activeLayers.includes(layer.id)
                    const IconComponent = ICON_MAP[layer.icon]
                    const count = layerCounts?.[layer.id]

                    return (
                      <button
                        key={layer.id}
                        type="button"
                        role="checkbox"
                        aria-checked={isActive}
                        aria-label={`${layer.name}: ${isActive ? 'enabled' : 'disabled'}`}
                        onClick={() => onToggleLayer(layer.id)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 md:py-1.5 text-left text-xs transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded touch-manipulation ${
                          isActive ? 'text-slate-800 dark:text-gray-200' : 'text-slate-500 dark:text-gray-500'
                        }`}
                      >
                        {/* Checkbox */}
                        <span
                          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border shrink-0 ${
                            isActive
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-slate-300 dark:border-gray-600 bg-transparent'
                          }`}
                        >
                          {isActive && (
                            <svg
                              viewBox="0 0 12 12"
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </span>

                        {/* Icon colored by layer render.color */}
                        {IconComponent && (
                          <IconComponent
                            size={14}
                            className="shrink-0"
                            style={{ color: layer.render.color }}
                          />
                        )}

                        {/* Layer name */}
                        <span className="truncate flex-1">{layer.name}</span>

                        {/* Optional count badge */}
                        {count != null && count > 0 && (
                          <span className="text-[10px] text-slate-400 dark:text-gray-500 tabular-nums">
                            {count}
                          </span>
                        )}
                        {isActive && count === 0 && (
                          <span className="text-[10px] text-slate-400 dark:text-gray-600 italic">
                            empty
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Hint when no layers have features */}
        {(() => {
          const hasFeatures = activeLayers.some(id => (layerCounts?.[id] ?? 0) > 0)
          if (!hasFeatures) {
            return (
              <p className="px-3 py-2 text-[10px] text-slate-400 dark:text-gray-500 italic">
                Toggle layers above to see data on the map.
              </p>
            )
          }
          return null
        })()}
        </>
        )}
      </div>
    </aside>
  )
}
