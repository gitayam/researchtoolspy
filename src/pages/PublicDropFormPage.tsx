/**
 * PublicDropFormPage — Journalist anonymous tip-line (E-11)
 *
 * Handles the /drop/:slugOrToken route. Resolves a slug to a token (if
 * needed), then renders PublicIntakeForm in drop mode (isDropMode=true)
 * which shows the anonymous tip-line framing and calls drop-submit.
 */
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PublicIntakeForm from '../components/cop/PublicIntakeForm'

export default function PublicDropFormPage() {
  const { slugOrToken } = useParams<{ slugOrToken?: string }>()
  const [resolvedToken, setResolvedToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const param = slugOrToken || ''

  useEffect(() => {
    if (!param) { setLoading(false); return }

    const controller = new AbortController()
    // Try slug resolution first; fall back to treating param as a direct token
    fetch(`/api/surveys/public/by-slug/${encodeURIComponent(param)}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('not_slug')
        return res.json()
      })
      .then(data => {
        setResolvedToken(data.share_token || param)
        setLoading(false)
      })
      .catch(err => {
        if (err?.name === 'AbortError') return
        // Not a slug — treat param as a direct token
        setResolvedToken(param)
        setLoading(false)
      })
    return () => controller.abort()
  }, [param])

  if (!param) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-red-400">Invalid link</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse text-sm text-slate-500">Loading...</div>
      </div>
    )
  }

  if (!resolvedToken) return null

  // Always render in drop mode — this page is only reached via /drop/:token
  return <PublicIntakeForm token={resolvedToken} isDropMode />
}
