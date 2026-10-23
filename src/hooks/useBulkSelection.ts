/**
 * A selection of COP items for bulk tagging (the feed and the task board), keyed by
 * id within one item type.
 */
import { useCallback, useMemo, useState } from 'react'
import type { CopTagTarget, CopTagTargetType } from '@/types/cop'

export function useBulkSelection(targetType: CopTagTargetType) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [active, setActive] = useState(false)
  const toggle = useCallback((id: string | number) => {
    setSelected(prev => {
      const next = new Set(prev)
      const key = String(id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const clear = useCallback(() => setSelected(new Set()), [])
  const stop = useCallback(() => {
    setActive(false)
    setSelected(new Set())
  }, [])
  const targets = useMemo<CopTagTarget[]>(
    () => [...selected].map(id => ({ target_type: targetType, target_id: id })),
    [selected, targetType],
  )
  return { active, setActive, stop, selected, toggle, clear, targets, isSelected: (id: string | number) => selected.has(String(id)) }
}
