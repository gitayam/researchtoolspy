/**
 * CopPlayersCspGate -- makes sure a COP page runs in a document loaded on a COP
 * path, whose CSP (public/_headers) admits the webcam players.
 *
 * The browser keeps the CSP of the page first loaded, so entering a COP by in-app
 * navigation from another page would leave its players blocked. The gate reloads
 * the COP URL once in that case; moving between COP pages stays in-app. If the
 * reload has just happened and the check still fails, it renders the page anyway
 * and the camera grid offers its own "Reload page" fallback.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { camPlayersAllowedHere } from './cams/cam-players'

const RELOAD_KEY = 'cop-csp-reload'
const RELOAD_WINDOW_MS = 15_000

type GateMode = 'ok' | 'reload' | 'fallback'

/** Reload unless this URL was reloaded moments ago (or storage can't say). */
function gateMode(): GateMode {
  if (typeof window === 'undefined' || camPlayersAllowedHere()) return 'ok'
  try {
    const previous = JSON.parse(sessionStorage.getItem(RELOAD_KEY) ?? 'null') as { href?: string; at?: number } | null
    const justReloaded = previous?.href === window.location.href && Date.now() - Number(previous.at) < RELOAD_WINDOW_MS
    return justReloaded ? 'fallback' : 'reload'
  } catch {
    // Without storage there is no loop guard, so don't reload.
    return 'fallback'
  }
}

export default function CopPlayersCspGate({ children }: { children: ReactNode }) {
  const [mode] = useState(gateMode)

  useEffect(() => {
    if (mode !== 'reload') return
    const href = window.location.href
    try {
      sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ href, at: Date.now() }))
    } catch {
      // Storage was readable a moment ago; the reloaded document passes the check anyway.
    }
    window.location.replace(href)
  }, [mode])

  if (mode === 'reload') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" aria-hidden="true" />
        <span className="sr-only">Opening the common operating picture…</span>
      </div>
    )
  }
  return <>{children}</>
}
