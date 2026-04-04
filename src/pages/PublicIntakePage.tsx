import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PublicIntakeForm from '../components/cop/PublicIntakeForm'

export default function PublicIntakePage() {
  const { token, slugOrToken } = useParams<{ token?: string; slugOrToken?: string }>()
  const [resolvedToken, setResolvedToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const param = token || slugOrToken || ''
  // /public/intake/:token provides `token` — always a direct token
  // /survey/:slugOrToken provides `slugOrToken` — always resolve as slug
  const isToken = !!token

  useEffect(() => {
    if (!param) { setLoading(false); return }

    if (isToken) {
      setResolvedToken(param)
      setLoading(false)
      return
    }

    // Resolve slug to token
    const controller = new AbortController()
    fetch(`/api/surveys/public/by-slug/${param}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Form not found' : 'Failed to load form')
        return res.json()
      })
      .then(data => {
        if (data.share_token) {
          setResolvedToken(data.share_token)
        } else {
          setError('Failed to resolve form link. Please contact the form owner.')
        }
        setLoading(false)
      })
      .catch(err => {
        if (err?.name !== 'AbortError') {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [param, isToken])

  if (!param) return <div className="p-4 text-center text-sm text-red-400">Invalid link</div>

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse text-sm text-slate-500">Loading survey...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    )
  }

  if (!resolvedToken) return null

  return <PublicIntakeForm token={resolvedToken} />
}
