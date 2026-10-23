/**
 * One `useCopTags` per page. Panels read it with `useCopTagsContext()` (from
 * ./tag-context) instead of each loading the vocabulary and item tags themselves,
 * and each refetching on every `cop:changed`.
 */
import type { ReactNode } from 'react'
import { useCopTags } from '@/hooks/useCopTags'
import { CopTagsContext } from './tag-context'

export default function CopTagsProvider({ sessionId, enabled = true, children }: {
  sessionId: string
  enabled?: boolean
  children: ReactNode
}) {
  const value = useCopTags(sessionId, { enabled })
  return <CopTagsContext.Provider value={value}>{children}</CopTagsContext.Provider>
}
