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
}: CopLayerPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCategory = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-700 flex flex-col overflow-y-auto shrink-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
          Layers
        </h2>
      </div>

      {/* Category sections */}
      <div className="flex-1 py-1">
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
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide hover:text-gray-200 transition-colors"
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
                        onClick={() => onToggleLayer(layer.id)}
                        className={`w-full flex items-center gap-2 px-4 py-1.5 text-left text-xs transition-colors hover:bg-gray-800 ${
                          isActive ? 'text-gray-200' : 'text-gray-500'
                        }`}
                      >
                        {/* Checkbox */}
                        <span
                          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border shrink-0 ${
                            isActive
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-600 bg-transparent'
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
                        {count != null && (
                          <span className="text-[10px] text-gray-500 tabular-nums">
                            {count}
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
      </div>
    </aside>
  )
}
