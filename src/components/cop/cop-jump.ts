/**
 * Jump to a COP panel on the workspace page: the phone side menu's "Jump to" and the
 * bottom tab bar (Map, Evidence, Questions, Timeline) both land here.
 *
 * - Uses the first copy of the panel that is laid out (a layout can render a hidden one).
 * - Lands below the sticky header and capture bar (`[data-cop-sticky]`), not under them.
 * - Waits until no overlay's own history pop is pending: closing the side menu pops
 *   its history entry, and the browser's scroll restoration for that pop would put the
 *   page back where it was.
 */
import { whenHistorySettled } from '@/components/cop/shell/overlay'

function laidOutPanel(panelId: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-panel="${panelId}"]`))
    .find((el) => el.getClientRects().length > 0)
}

export function jumpToCopPanel(panelId: string): void {
  // After the current task, so a menu closed by the same tap has started its pop.
  setTimeout(() => {
    void whenHistorySettled().then(() => requestAnimationFrame(() => {
      const el = laidOutPanel(panelId)
      if (!el) return
      const sticky = document.querySelector('[data-cop-sticky]')?.getBoundingClientRect().height ?? 0
      const top = el.getBoundingClientRect().top + window.scrollY - sticky - 8
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
    }))
  }, 0)
}
