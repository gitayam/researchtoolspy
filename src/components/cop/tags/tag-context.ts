/**
 * The page-wide tags context (see CopTagsProvider). Panels read it with
 * `useCopTagsContext()`; null outside a provider means "render no tag UI".
 */
import { createContext, useContext } from 'react'
import type { UseCopTags } from '@/hooks/useCopTags'

export const CopTagsContext = createContext<UseCopTags | null>(null)

export function useCopTagsContext(): UseCopTags | null {
  return useContext(CopTagsContext)
}
