/**
 * UrlConfirmCard (E-5b) — inline, read-only confirm card for `url` fields in the
 * public submitter form.
 *
 * When the submitter has typed a complete http(s) URL, this debounces (~600ms) and
 * POSTs to /api/surveys/public/:token/preview-url, then shows the extracted
 * metadata (title / author / date / summary), an archived-copy link, and a
 * duplicate-warning banner if the link was already submitted to this form.
 *
 * It is purely advisory: it NEVER blocks form submission, and renders only the
 * minimal confirm fields the endpoint returns (no raw analyze result, no IP/UA).
 */
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, Archive, Loader2 } from 'lucide-react'
import { isPreviewableUrl, type PreviewResult } from '../../lib/url-confirm'

interface UrlConfirmCardProps {
  token: string
  url: string
}

const DEBOUNCE_MS = 600

export default function UrlConfirmCard({ token, url }: UrlConfirmCardProps) {
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const trimmed = url.trim()
  const previewable = isPreviewableUrl(trimmed)

  useEffect(() => {
    let cancelled = false

    // Non-previewable / empty input: abort any in-flight call and clear stale
    // state (deferred so we never call setState synchronously inside the effect).
    if (!previewable) {
      abortRef.current?.abort()
      abortRef.current = null
      const reset = setTimeout(() => {
        if (cancelled) return
        setLoading(false)
        setFailed(false)
        setPreview(null)
      }, 0)
      return () => {
        cancelled = true
        clearTimeout(reset)
      }
    }

    const controller = new AbortController()

    const timer = setTimeout(async () => {
      // Abort the previous in-flight request before starting a new one.
      abortRef.current?.abort()
      abortRef.current = controller
      setLoading(true)
      setFailed(false)
      setPreview(null)
      try {
        const res = await fetch(`/api/surveys/public/${token}/preview-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && data && data.ok === true) {
          setPreview(data as PreviewResult)
          setFailed(false)
        } else {
          // {ok:false} or non-2xx — quiet, non-blocking failure.
          setPreview(null)
          setFailed(true)
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        if (cancelled) return
        setPreview(null)
        setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [token, trimmed, previewable])

  // Nothing to show until the user has typed a complete http(s) URL.
  if (!previewable) return null

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-400">Previewing link…</span>
      </div>
    )
  }

  if (failed) {
    return (
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Couldn&apos;t preview this link &mdash; you can still submit it.
      </p>
    )
  }

  if (!preview) return null

  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-2">
      {preview.duplicate && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            This link may have already been submitted to this form.
          </span>
        </div>
      )}

      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1">
          {preview.title ? (
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words">
              {preview.title}
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Link preview</p>
          )}

          {(preview.author || preview.published_date) && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {preview.author}
              {preview.author && preview.published_date ? ' · ' : ''}
              {preview.published_date}
            </p>
          )}

          {preview.summary && (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
              {preview.summary}
            </p>
          )}

          {preview.archive_url && (
            <a
              href={preview.archive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Archive className="h-3 w-3" />
              Archived copy
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
