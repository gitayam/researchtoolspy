/**
 * FindWebcamsDialog -- search Windy for public webcams near a place, the COP's
 * map center, or the place a non-camera page link describes, and add them.
 *
 * The server does the searching (GET /api/cop/:id/webcams/nearby): it geocodes
 * the place, asks the AI only when the place name is ambiguous or comes from a
 * page link, and never fetches the page itself. Searches run on submit only:
 * Nominatim's usage policy bans search-as-you-type. Previews are Windy's own images,
 * loaded by this browser only after the analyst asks for them (Windy then sees
 * the viewer's IP), each linked to its Windy page as Windy's terms require.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, ImageOff, Loader2, Search, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CopWebcam, CopWebcamCandidate, CopWebcamNearbyResponse } from '@/types/cop'
import OsmCredit from '../OsmCredit'
import { camRequest, isWindyHttpsUrl, nearbyErrorMessage } from './webcam-api'

const RADII_KM = [2, 5, 10, 25] as const
const DEFAULT_RADIUS_KM = 5
const RESULT_LIMIT = 20
const PREVIEWS_KEY = 'cop-cams-show-previews'
const WINDY_CREDIT_URL = 'https://www.windy.com/webcams'

interface FindWebcamsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  /** A page link that is not a camera: search near the place it describes. */
  fromUrl: string | null
  onClearFromUrl: () => void
  /** Called after a camera is added to the COP. */
  onAdded: () => void
}

const inputClass =
  'w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'
const badgeClass = 'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium'

function readPreviewsPreference(): boolean {
  try {
    return localStorage.getItem(PREVIEWS_KEY) === '1'
  } catch {
    return false
  }
}

function formatKm(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

/** A page link shown without its query string or fragment, which can carry tokens. */
function shortLink(url: string): string {
  try {
    const parsed = new URL(url)
    const text = `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`
    return text.length > 70 ? `${text.slice(0, 69)}…` : text
  } catch {
    return url.length > 70 ? `${url.slice(0, 69)}…` : url
  }
}

type RowState = { adding?: boolean; error?: string }

export default function FindWebcamsDialog({
  open,
  onOpenChange,
  sessionId,
  fromUrl,
  onClearFromUrl,
  onAdded,
}: FindWebcamsDialogProps) {
  const [place, setPlace] = useState('')
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CopWebcamNearbyResponse | null>(null)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [showPreviews, setShowPreviews] = useState(readPreviewsPreference)
  const [brokenPreviews, setBrokenPreviews] = useState<Set<string>>(() => new Set())
  const abortRef = useRef<AbortController | null>(null)
  const searchedFromUrl = useRef<string | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const search = async (opts: { place: string; fromUrl: string | null; radiusKm: number }) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const params = new URLSearchParams({ radius_km: String(opts.radiusKm), limit: String(RESULT_LIMIT) })
    const placeText = opts.place.trim()
    if (placeText) params.set('place', placeText)
    else if (opts.fromUrl) params.set('from_url', opts.fromUrl)

    setLoading(true)
    setError(null)
    try {
      const res = await camRequest<CopWebcamNearbyResponse>(
        `/api/cop/${sessionId}/webcams/nearby?${params}`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      if (!res.ok) {
        setResult(null)
        setError(nearbyErrorMessage(res, !placeText && !!opts.fromUrl))
        return
      }
      setResult({ ...res.data, webcams: Array.isArray(res.data.webcams) ? res.data.webcams : [] })
      setRows({})
      setBrokenPreviews(new Set())
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setError('The search failed. Try again.')
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  // Opened from the Add dialog with a page link: search near that page's place once.
  useEffect(() => {
    if (!fromUrl) {
      searchedFromUrl.current = null
      return
    }
    if (!open || searchedFromUrl.current === fromUrl) return
    searchedFromUrl.current = fromUrl
    setPlace('')
    void search({ place: '', fromUrl, radiusKm })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link, with the radius then chosen
  }, [open, fromUrl])

  const togglePreviews = () => {
    const next = !showPreviews
    setShowPreviews(next)
    try {
      localStorage.setItem(PREVIEWS_KEY, next ? '1' : '0')
    } catch {
      // A per-viewer convenience only.
    }
  }

  const markOnSession = (id: string) => {
    setResult((r) => r && { ...r, webcams: r.webcams.map((c) => (c.windy_id === id ? { ...c, on_session: true } : c)) })
  }

  const addCandidate = async (cam: CopWebcamCandidate) => {
    setRows((r) => ({ ...r, [cam.windy_id]: { adding: true } }))
    const res = await camRequest<{ webcam: CopWebcam | null }>(`/api/cop/${sessionId}/webcams`, {
      method: 'POST',
      // The server fills the position (and the title, when it can reach Windy).
      body: { url: `windy:${cam.windy_id}`, label: cam.title.trim().slice(0, 120) || undefined },
    })
    if (res.ok) {
      setRows((r) => ({ ...r, [cam.windy_id]: {} }))
      markOnSession(cam.windy_id)
      onAdded()
      return
    }
    if (res.code === 'WEBCAM_DUPLICATE') {
      setRows((r) => ({ ...r, [cam.windy_id]: {} }))
      markOnSession(cam.windy_id)
      return
    }
    const message =
      res.code === 'WEBCAM_LIMIT' ? 'This COP already holds its maximum number of cameras.'
        : res.code === 'WEBCAM_UNAVAILABLE' ? 'Windy no longer offers this camera.'
          : res.code === 'WEBCAM_NOT_FOUND' ? 'Windy has no camera with this id any more.'
            : res.status === 403 ? 'Only the session owner or an editor can add cameras.'
              : res.status === 0 ? 'Could not reach the server. Try again.'
                : res.error ?? `The camera could not be added (HTTP ${res.status}).`
    setRows((r) => ({ ...r, [cam.windy_id]: { error: message } }))
  }

  const usingFromUrl = !!fromUrl && place.trim() === ''
  const creditUrl = result && isWindyHttpsUrl(result.attribution_url) ? result.attribution_url : WINDY_CREDIT_URL
  const cams = result?.webcams ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find cameras</DialogTitle>
          <DialogDescription>
            Public Windy webcams near a place. Leave the place blank to search around this COP&apos;s map center.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!loading) void search({ place, fromUrl, radiusKm })
          }}
        >
          {usingFromUrl && (
            <div className="flex items-start gap-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300">
              <p className="min-w-0 flex-1">
                Searching near the place this page describes:{' '}
                <span className="break-all font-medium text-gray-900 dark:text-gray-100">{shortLink(fromUrl)}</span>.
                The page itself is not opened.
              </p>
              <button
                type="button"
                onClick={onClearFromUrl}
                className="inline-flex h-11 w-11 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
                aria-label="Stop searching near this page"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <label htmlFor="find-cam-place" className={labelClass}>Place (optional)</label>
              <input
                id="find-cam-place"
                type="text"
                maxLength={120}
                autoComplete="off"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Stade de France, Saint-Denis"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="find-cam-radius" className={labelClass}>Within</label>
              <select
                id="find-cam-radius"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className={`${inputClass} sm:w-24`}
              >
                {RADII_KM.map((km) => <option key={km} value={km}>{km} km</option>)}
              </select>
            </div>
            <Button type="submit" disabled={loading} className="min-h-[44px] sm:min-h-[38px]">
              {loading
                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />
                : <Search className="h-3.5 w-3.5 mr-1" aria-hidden="true" />}
              Search
            </Button>
          </div>
        </form>

        <div role="status" aria-live="polite" className="space-y-2">
          {loading && <p className="text-xs text-gray-500 dark:text-gray-400">Searching Windy…</p>}
          {!loading && error && (
            <p className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {!loading && result && <ResolutionLine result={result} />}
        </div>

        {!loading && result && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {cams.length === 0
                  ? `No Windy webcams within ${result.radius_km} km. Try a larger radius or another place.`
                  : result.total > cams.length
                    ? `The ${cams.length} nearest of ${result.total} cameras within ${result.radius_km} km`
                    : `${cams.length} camera${cams.length === 1 ? '' : 's'} within ${result.radius_km} km`}
              </p>
              {cams.length > 0 && (
                <button
                  type="button"
                  onClick={togglePreviews}
                  aria-pressed={showPreviews}
                  className="inline-flex min-h-[44px] sm:min-h-0 sm:h-7 items-center rounded border border-gray-300 dark:border-gray-600 px-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
                >
                  {showPreviews ? 'Hide previews' : 'Show previews'}
                </button>
              )}
            </div>
            {cams.length > 0 && !showPreviews && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Previews load from Windy, which then sees your IP.</p>
            )}
            <ul className="space-y-1.5">
              {cams.map((cam) => (
                <CandidateRow
                  key={cam.windy_id}
                  cam={cam}
                  showPreview={showPreviews && !brokenPreviews.has(cam.windy_id)}
                  onPreviewError={() => setBrokenPreviews((s) => new Set(s).add(cam.windy_id))}
                  state={rows[cam.windy_id] ?? {}}
                  onAdd={() => void addCandidate(cam)}
                />
              ))}
            </ul>
          </div>
        )}

        <p className="text-right text-[11px] text-gray-600 dark:text-gray-400">
          <a
            href={creditUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded"
          >
            Webcams provided by windy.com
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </p>
      </DialogContent>
    </Dialog>
  )
}

function ResolutionLine({ result }: { result: CopWebcamNearbyResponse }) {
  const { resolution, center } = result
  if (!resolution) {
    return (
      <p className="text-xs text-gray-700 dark:text-gray-300">
        {center.source === 'session'
          ? "Around this COP's map center."
          : `Around ${center.label ?? `${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}`}.`}
      </p>
    )
  }
  return (
    <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
      <p className="flex flex-wrap items-center gap-1.5">
        <span>
          Near <span className="font-medium text-gray-900 dark:text-gray-100">{resolution.display_name}</span>
        </span>
        {resolution.ai_used && (
          <>
            <span className={`${badgeClass} gap-1 bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200`}>
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              AI
            </span>
            <span className="text-gray-600 dark:text-gray-400 break-all">
              {center.source === 'url' ? "read from this page's address" : <>read from &ldquo;{resolution.input}&rdquo;</>}
            </span>
          </>
        )}
      </p>
      <OsmCredit text={result.geocoder_attribution} url={result.geocoder_attribution_url} className="inline-block" />
      {resolution.ambiguous && (
        <p className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
          <span className="break-words min-w-0">
            Several places match &ldquo;{resolution.input}&rdquo;. Check this is the one you meant, or type a more specific name.
          </span>
        </p>
      )}
    </div>
  )
}

interface CandidateRowProps {
  cam: CopWebcamCandidate
  showPreview: boolean
  onPreviewError: () => void
  state: RowState
  onAdd: () => void
}

function CandidateRow({ cam, showPreview, onPreviewError, state, onAdd }: CandidateRowProps) {
  const detailUrl = isWindyHttpsUrl(cam.detail_url) ? cam.detail_url : null
  const previewUrl = showPreview && isWindyHttpsUrl(cam.preview_url) ? cam.preview_url : null
  const place = [cam.city, cam.country].filter(Boolean).join(', ')
  const inactive = cam.status !== 'active'

  const thumb = previewUrl ? (
    <img
      src={previewUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={onPreviewError}
      className="h-full w-full object-cover"
    />
  ) : (
    <ImageOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
  )

  return (
    <li className="flex items-start gap-2.5 rounded border border-gray-200 dark:border-gray-700 p-2">
      {detailUrl ? (
        <a
          href={detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          aria-label={`Open ${cam.title} on windy.com`}
          className="flex h-12 w-20 sm:h-14 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
        >
          {thumb}
        </a>
      ) : (
        <div className="flex h-12 w-20 sm:h-14 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800">{thumb}</div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 break-words">{cam.title}</p>
        <p className="text-[11px] text-gray-600 dark:text-gray-400">
          {formatKm(cam.distance_km)} away{place ? ` · ${place}` : ''}
        </p>
        <div className="flex flex-wrap gap-1">
          <span
            className={`${badgeClass} ${cam.live
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            {cam.live ? 'Live' : 'Time-lapse'}
          </span>
          {inactive && (
            <span className={`${badgeClass} bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200`}>
              Inactive on Windy
            </span>
          )}
        </div>
        {state.error && <p className="text-[11px] text-red-700 dark:text-red-400" role="alert">{state.error}</p>}
      </div>

      <div className="shrink-0">
        {cam.on_session ? (
          <span className={`${badgeClass} min-h-[44px] sm:min-h-0 bg-cyan-50 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200`}>
            On the COP
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAdd}
            disabled={state.adding}
            className="min-h-[44px] sm:min-h-0"
            aria-label={`Add ${cam.title}`}
          >
            {state.adding && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
            Add
          </Button>
        )}
      </div>
    </li>
  )
}
