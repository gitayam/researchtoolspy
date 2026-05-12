/**
 * BCT Selector — pick Behaviour Change Techniques (BCW Step 7)
 *
 * Source: Michie, Atkins, West (2014). The Behaviour Change Wheel — A Guide
 *   to Designing Interventions, Step 7 + Table 3.3.
 * Taxonomy: BCTTv1 — 93 BCTs in 16 groupings (see src/utils/bct-taxonomy.ts).
 *
 * Behaviour: when one or more intervention functions have been selected,
 *   surface the most-frequently-used BCTs for those functions first
 *   (per BCW Guide Table 3.3), then offer the full taxonomy grouped by
 *   the 16 expert card-sort categories.
 *
 * P1-2 follow-through — see docs/frameworks/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
 * Canon: irregularpedia.org/general/behavior-analysis/ (Behaviour Change Techniques).
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react'
import {
  BCT_GROUPINGS,
  BCT_TAXONOMY,
  BCT_BY_FUNCTION,
  type InterventionFunction,
} from '@/utils/bct-taxonomy'

export interface BCTSelectorProps {
  /** Intervention functions selected upstream (Step 5). When non-empty, the
   *  recommended BCTs are surfaced first per BCW Guide Table 3.3. */
  selectedInterventions: InterventionFunction[]
  /** Currently selected BCT ids (e.g. ['1.1', '2.3']). */
  selectedBcts: string[]
  /** Setter — receives the new full id list. */
  onChange: (ids: string[]) => void
  readOnly?: boolean
}

export function BCTSelector({
  selectedInterventions,
  selectedBcts,
  onChange,
  readOnly = false,
}: BCTSelectorProps) {
  const selectedSet = useMemo(() => new Set(selectedBcts), [selectedBcts])
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set())

  const toggle = (id: string) => {
    if (readOnly) return
    if (selectedSet.has(id)) {
      onChange(selectedBcts.filter((x) => x !== id))
    } else {
      onChange([...selectedBcts, id])
    }
  }

  const toggleGroup = (n: number) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  // Build recommended BCT id set from selected intervention functions
  const recommended = useMemo(() => {
    const most = new Set<string>()
    const less = new Set<string>()
    selectedInterventions.forEach((fn) => {
      const map = BCT_BY_FUNCTION[fn]
      if (!map) return
      map.mostFrequent.forEach((id) => most.add(id))
      map.lessFrequent.forEach((id) => {
        if (!most.has(id)) less.add(id)
      })
    })
    return { most, less }
  }, [selectedInterventions])

  const recommendedBCTs = useMemo(() => {
    const ids = new Set([...recommended.most, ...recommended.less])
    return BCT_TAXONOMY.filter((b) => ids.has(b.id))
  }, [recommended])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>🧩</span> Behaviour Change Techniques (BCW Step 7)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the active ingredients of the intervention from BCTTv1 (93 BCTs in 16 groupings).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedBcts.length === 0
              ? 'No BCTs selected yet.'
              : `${selectedBcts.length} BCT${selectedBcts.length === 1 ? '' : 's'} selected.`}
          </span>
          {selectedInterventions.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Functions: {selectedInterventions.join(', ')}
            </Badge>
          )}
        </div>

        {/* Recommended for selected intervention functions (BCW Table 3.3) */}
        {recommendedBCTs.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-sm text-amber-900 dark:text-amber-100">
                Recommended for your selected intervention functions
              </span>
              <Badge variant="secondary" className="text-[10px]">
                BCW Table 3.3
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendedBCTs.map((bct) => {
                const isSelected = selectedSet.has(bct.id)
                const isMostFrequent = recommended.most.has(bct.id)
                return (
                  <button
                    key={bct.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggle(bct.id)}
                    aria-pressed={isSelected}
                    title={bct.definition || bct.label}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100'
                        : isMostFrequent
                        ? 'border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                        : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    <span className="font-mono">{bct.id}</span>
                    <span className="font-medium">{bct.label}</span>
                    {isMostFrequent && (
                      <span className="text-[9px] uppercase tracking-wide opacity-60">
                        most frequent
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Full taxonomy grouped by the 16 BCTTv1 groupings */}
        <div>
          <div className="text-sm font-medium mb-2">Full BCTTv1 taxonomy (16 groupings, 93 BCTs)</div>
          <div className="space-y-1">
            {BCT_GROUPINGS.map((group) => {
              const groupBCTs = BCT_TAXONOMY.filter((b) => b.group === group.number)
              const groupSelectedCount = groupBCTs.filter((b) => selectedSet.has(b.id)).length
              const isOpen = openGroups.has(group.number)
              return (
                <div
                  key={group.number}
                  className="rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.number)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {group.number}.
                      </span>
                      <span>{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({groupBCTs.length} BCTs)
                      </span>
                    </span>
                    {groupSelectedCount > 0 && (
                      <Badge variant="default" className="text-[10px]">
                        {groupSelectedCount} selected
                      </Badge>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3 py-2 bg-gray-50/50 dark:bg-gray-900/30 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupBCTs.map((bct) => {
                        const isSelected = selectedSet.has(bct.id)
                        return (
                          <button
                            key={bct.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => toggle(bct.id)}
                            aria-pressed={isSelected}
                            title={bct.definition || bct.label}
                            className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs text-left transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                            }`}
                          >
                            <span className="font-mono text-[10px] mt-0.5 opacity-60">
                              {bct.id}
                            </span>
                            <span className="flex-1">{bct.label}</span>
                            {isSelected && <Check className="h-3 w-3 mt-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
