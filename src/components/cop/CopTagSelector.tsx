/**
 * CopTagSelector -- Taxonomy-aware tag picker with type-ahead search.
 *
 * Allows tagging evidence items with OSINT clue taxonomy tags,
 * grouped by category with search filtering and custom free-text tags.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Tag, Plus, X, Search, ChevronDown, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── OSINT Clue Taxonomy ─────────────────────────────────────────

const CLUE_TAXONOMY: Record<string, string[]> = {
  architecture: ['Building style', 'Window type', 'Roof type', 'Door style', 'Construction material'],
  infrastructure: ['Power outlet type', 'Street light', 'Road marking', 'Traffic sign', 'Utility pole'],
  flora_fauna: ['Tree species', 'Vegetation type', 'Crop type', 'Animal species'],
  logos_brands: ['Vehicle brand', 'Store chain', 'Telecom provider', 'Bus company', 'Fuel station'],
  language_text: ['Script type', 'Language detected', 'Sign text', 'License plate format'],
  geography: ['Terrain type', 'Coastline', 'Mountain range', 'Water body', 'Soil color'],
  transport: ['Vehicle type', 'Road surface', 'Rail type', 'Port infrastructure'],
  people_culture: ['Clothing style', 'Religious symbol', 'Flag', 'Currency'],
}

const CATEGORY_COLORS: Record<string, string> = {
  architecture: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  infrastructure: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flora_fauna: 'bg-green-500/20 text-green-400 border-green-500/30',
  logos_brands: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  language_text: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  geography: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  transport: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  people_culture: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  custom: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

interface ExistingTag {
  tag_category: string
  tag_value: string
}

// ── Props ────────────────────────────────────────────────────────

interface CopTagSelectorProps {
  evidenceId: string
  sessionId: string
  existingTags: ExistingTag[]
  onTagAdded?: () => void
}

// ── Helpers ──────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

function formatCategory(cat: string): string {
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Component ────────────────────────────────────────────────────

export default function CopTagSelector({
  evidenceId,
  sessionId,
  existingTags,
  onTagAdded,
}: CopTagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [customTag, setCustomTag] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [isOpen])

  // ── Filtered taxonomy ──────────────────────────────────────

  const filteredTaxonomy = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return CLUE_TAXONOMY

    const result: Record<string, string[]> = {}
    for (const [category, tags] of Object.entries(CLUE_TAXONOMY)) {
      const catMatch = category.toLowerCase().includes(q)
      const matchingTags = tags.filter((t) => t.toLowerCase().includes(q))
      if (catMatch) {
        result[category] = tags
      } else if (matchingTags.length > 0) {
        result[category] = matchingTags
      }
    }
    return result
  }, [search])

  // Check if tag already exists
  const isTagged = useCallback(
    (category: string, value: string) =>
      existingTags.some(
        (t) => t.tag_category === category && t.tag_value === value,
      ),
    [existingTags],
  )

  // ── Add tag ────────────────────────────────────────────────

  const addTag = useCallback(
    async (category: string, value: string) => {
      if (isTagged(category, value) || submitting) return

      setSubmitting(true)
      try {
        const res = await fetch(`/api/cop/${sessionId}/evidence-tags`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            evidence_id: evidenceId,
            tag_category: category,
            tag_value: value,
          }),
        })
        if (!res.ok) throw new Error('Failed to add tag')
        onTagAdded?.()
      } catch {
        // Silent failure
      } finally {
        setSubmitting(false)
      }
    },
    [evidenceId, sessionId, isTagged, submitting, onTagAdded],
  )

  const handleAddCustom = useCallback(() => {
    const trimmed = customTag.trim()
    if (!trimmed) return
    addTag('custom', trimmed)
    setCustomTag('')
  }, [customTag, addTag])

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Existing tags display */}
      <div className="flex flex-wrap gap-1 items-center">
        {existingTags.map((tag, i) => (
          <Badge
            key={`${tag.tag_category}-${tag.tag_value}-${i}`}
            variant="outline"
            className={cn(
              'text-[9px] px-1.5 py-0 leading-4',
              CATEGORY_COLORS[tag.tag_category] ?? CATEGORY_COLORS.custom,
            )}
          >
            {tag.tag_value}
          </Badge>
        ))}

        {/* Add tag button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px]',
            'border border-dashed border-gray-300 dark:border-gray-600 text-gray-500',
            'hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors',
            'cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500',
          )}
          aria-label="Add tag"
        >
          <Tag className="h-2.5 w-2.5" />
          Tag
          <ChevronDown className="h-2 w-2" />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
          {/* Search */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 p-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-1.5 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1">
              <Search className="h-3 w-3 text-gray-500 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tags..."
                className="flex-1 bg-transparent text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
              />
              {submitting && <Loader2 className="h-3 w-3 animate-spin text-gray-500" />}
            </div>
          </div>

          {/* Taxonomy groups */}
          <div className="p-1.5 space-y-2">
            {Object.entries(filteredTaxonomy).map(([category, tags]) => (
              <div key={category}>
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider px-1.5 mb-0.5">
                  {formatCategory(category)}
                </p>
                <div className="flex flex-wrap gap-1 px-1">
                  {tags.map((tag) => {
                    const tagged = isTagged(category, tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(category, tag)}
                        disabled={tagged || submitting}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                          'cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500',
                          tagged
                            ? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : cn(
                                CATEGORY_COLORS[category] ?? CATEGORY_COLORS.custom,
                                'hover:opacity-80',
                              ),
                        )}
                      >
                        {tagged && <span className="mr-0.5">+</span>}
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {Object.keys(filteredTaxonomy).length === 0 && (
              <p className="text-[10px] text-gray-500 text-center py-2">
                No matching tags found.
              </p>
            )}

            {/* Custom tag input */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-2 px-1">
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Custom Tag
              </p>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCustom()
                    }
                  }}
                  placeholder="Type custom tag..."
                  className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1 text-[10px] text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customTag.trim() || submitting}
                  className="px-1.5 py-1 rounded bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-40 cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
