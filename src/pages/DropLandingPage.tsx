import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Plus, ClipboardList, Shield, Globe, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SAFE_SLUG = /^[a-zA-Z0-9_-]+$/

/** Extract a slug/token from user input — handles full URLs, bare slugs, and edge cases */
function extractSlug(raw: string): string {
  let cleaned = raw.trim()
  // Try URL parsing first (handles protocol, query params, fragments)
  try {
    const url = new URL(cleaned)
    const match = url.pathname.match(/^\/(drop|survey)\/(.+?)\/?\s*$/)
    if (match) return match[2]
  } catch {
    // Not a full URL — try protocol-less URLs like researchtools.net/drop/foo
    const pathMatch = cleaned.match(/^[^/]+\/(drop|survey)\/(.+?)(?:[?#].*)?$/)
    if (pathMatch) return pathMatch[2]
  }
  // Strip query/fragment from bare input
  return cleaned.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
}

export default function DropLandingPage() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const inflightRef = useRef(false)

  const handleGo = async () => {
    if (inflightRef.current) return

    const cleaned = extractSlug(slug)
    if (!cleaned) return

    // Validate slug format before making any requests
    if (!SAFE_SLUG.test(cleaned)) {
      setError('Invalid format. Use only letters, numbers, and hyphens.')
      return
    }

    setError('')
    setChecking(true)
    inflightRef.current = true

    try {
      // Try slug resolution — on success, navigate with the resolved token
      const res = await fetch(`/api/surveys/public/by-slug/${encodeURIComponent(cleaned)}`)
      if (res.ok) {
        const data = await res.json()
        navigate(`/drop/${data.share_token || cleaned}`)
        return
      }
      // Try as direct token
      const tokenRes = await fetch(`/api/surveys/public/${encodeURIComponent(cleaned)}`)
      if (tokenRes.ok) {
        navigate(`/drop/${encodeURIComponent(cleaned)}`)
        return
      }
      setError('No survey found with that link or code. Check the URL and try again.')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setChecking(false)
      inflightRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-white hover:opacity-80 transition-opacity">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-sm">ResearchTools</span>
          </Link>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-16 pb-24">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-6">
            <ClipboardList className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Drops
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-md mx-auto">
            Secure intake forms for tips, sightings, and research submissions
          </p>
        </div>

        {/* Go to a survey */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-sm">
          <h2 id="survey-lookup-label" className="font-semibold text-slate-900 dark:text-white mb-1">
            Go to a survey
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Paste a drop link or enter the survey code you were given
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); handleGo() }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setError('') }}
                placeholder="e.g. my-tip-line or researchtools.net/drop/..."
                className="pl-9"
                aria-labelledby="survey-lookup-label"
                maxLength={200}
              />
            </div>
            <Button type="submit" disabled={!slug.trim() || checking}>
              {checking ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Checking</> : <>Go<ArrowRight className="ml-1 h-4 w-4" /></>}
            </Button>
          </form>
          {error && (
            <div role="alert" className="flex items-start gap-2 mt-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Create a new drop */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-8 shadow-sm">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-1">
            Create a new drop
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Build an intake form from a template and share the link to collect responses
          </p>
          <Button variant="outline" className="w-full justify-center" asChild>
            <Link to="/dashboard/drops">
              <Plus className="mr-2 h-4 w-4" />
              Create a Drop
            </Link>
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4">
            <Shield className="h-5 w-5 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anonymous</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No account required to submit. IP hashed, never stored.
            </p>
          </div>
          <div className="p-4">
            <Globe className="h-5 w-5 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Geo-gated</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Restrict submissions by country. Password-protect if needed.
            </p>
          </div>
          <div className="p-4">
            <ClipboardList className="h-5 w-5 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Templates</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tip lines, sighting reports, source debriefs, and more — ready to go.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
