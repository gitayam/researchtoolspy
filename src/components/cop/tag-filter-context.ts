/**
 * The page-wide tag filter's state (CopTagFilterProvider fills it). Panels and the
 * map read it with `useCopTagFilter()`; outside a provider it lets everything pass.
 */
import { createContext, useContext } from 'react'
import type { CopTagTargetType } from '@/types/cop'

export interface CopTagFilterState {
  active: string[]
  match: 'any' | 'all'
  setActive: (active: string[]) => void
  setMatch: (match: 'any' | 'all') => void
  clear: () => void
  /** True while a filter is set. */
  filtering: boolean
  /** Does this item pass the filter? Always true while none is set. */
  passes: (targetType: CopTagTargetType, targetId: string | number) => boolean
}

export const CopTagFilterContext = createContext<CopTagFilterState | null>(null)

const PASS_ALL: CopTagFilterState = {
  active: [],
  match: 'any',
  setActive: () => {},
  setMatch: () => {},
  clear: () => {},
  filtering: false,
  passes: () => true,
}

/** The page's tag filter, or a no-op filter outside a provider. */
export function useCopTagFilter(): CopTagFilterState {
  return useContext(CopTagFilterContext) ?? PASS_ALL
}
