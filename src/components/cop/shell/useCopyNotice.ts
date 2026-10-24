/** What a question list's live region (CopyNotice) says after a copy. */
import { useCallback, useState } from 'react'

export interface CopyNoticeState {
  text: string
  /** Bumped on every announcement, so the same message twice is read twice. */
  n: number
}

export function useCopyNotice() {
  const [notice, setNotice] = useState<CopyNoticeState>({ text: '', n: 0 })
  const announce = useCallback((text: string) => setNotice((prev) => ({ text, n: prev.n + 1 })), [])
  return { notice, announce }
}
