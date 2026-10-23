/**
 * CopCamGrid -- click-to-load webcam players for a COP.
 *
 * Each camera plays in its provider's own player, loaded by this browser:
 * nothing is proxied or recorded. A camera loads only when the viewer clicks it
 * (loading contacts the provider, who sees the viewer's IP), unloads while
 * scrolled off-screen, and at most MAX_LIVE_PLAYERS video players run at once.
 *
 * The COP pages carry a CSP that allows the Windy and YouTube players and the
 * allow-listed HLS hosts (public/_headers). An in-app navigation keeps the CSP of
 * the page first loaded; CopPlayersCspGate reloads into a COP document, and this
 * grid's "Reload page" button is the fallback if that could not happen.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Pencil, Play, RotateCw, Square, Trash2, Video } from 'lucide-react'
import type { CopWebcam } from '@/types/cop'
import { camPlayersAllowedHere, MAX_LIVE_PLAYERS } from './cam-players'
import { CopItemTags } from '@/components/cop/CopItemTags'
import { TagFilterNote } from '@/components/cop/CopTagFilter'
import { useCopTagFilter } from '@/components/cop/tag-filter-context'

const MIN_IMAGE_REFRESH_S = 30

// The server derives Windy embeds as …/player/<id>/day, or …/<id>/live when Windy lists a live view.
const WINDY_EMBED = /^https:\/\/webcams\.windy\.com\/webcams\/public\/embed\/player\/(\d{6,12})\/(day|live)$/
const YOUTUBE_EMBED_PREFIX = 'https://www.youtube-nocookie.com/embed/'

const PROVIDER_LABELS: Record<string, string> = {
  windy: 'Windy',
  youtube: 'YouTube',
  image: 'Image feed',
  hls: 'Video stream',
}
const DELIVERY_LABELS: Record<string, string> = {
  live: 'Live',
  timelapse: 'Time-lapse',
  snapshot: 'Snapshot',
}

const badgeClass = 'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium'

const isHttps = (url: string | null | undefined): url is string => !!url && /^https:\/\//i.test(url)

function needsFrameCsp(cam: CopWebcam): boolean {
  return cam.provider !== 'image'
}

// ── Players ─────────────────────────────────────────────────────

function windyEmbed(cam: CopWebcam): { url: string; live: boolean } | null {
  const match = cam.embed_url ? WINDY_EMBED.exec(cam.embed_url) : null
  if (!match || (cam.provider_ref && match[1] !== cam.provider_ref)) return null
  return { url: match[0], live: match[2] === 'live' }
}

function WindyPlayer({ cam }: { cam: CopWebcam }) {
  const embed = windyEmbed(cam)
  if (!embed) return <PlayerError message="This camera has no player." />
  return (
    <iframe
      src={embed.url}
      title={`${cam.label} (Windy ${embed.live ? 'live webcam' : 'webcam time-lapse'})`}
      className="absolute inset-0 h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  )
}

function YouTubePlayer({ cam }: { cam: CopWebcam }) {
  if (!cam.embed_url?.startsWith(YOUTUBE_EMBED_PREFIX)) return <PlayerError message="This camera has no player." />
  return (
    <iframe
      src={`${cam.embed_url}?autoplay=1&mute=1&playsinline=1`}
      title={`${cam.label} (YouTube)`}
      className="absolute inset-0 h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
      // YouTube refuses to play without a Referer (player error 153). strict-origin
      // sends only this site's origin: never the path, so never a share token.
      referrerPolicy="strict-origin"
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  )
}

function ImagePlayer({ cam }: { cam: CopWebcam }) {
  const refreshS = Math.max(MIN_IMAGE_REFRESH_S, cam.refresh_s ?? 60)
  const [tick, setTick] = useState(() => Date.now())
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), refreshS * 1000)
    return () => clearInterval(timer)
  }, [refreshS])

  if (!isHttps(cam.image_url)) return <PlayerError message="This camera has no image." />
  const src = `${cam.image_url}${cam.image_url.includes('?') ? '&' : '?'}_=${tick}`
  return (
    <>
      <img
        src={src}
        alt={cam.label}
        className="absolute inset-0 h-full w-full object-contain bg-black"
        referrerPolicy="no-referrer"
        onLoad={() => setFailed(false)}
        onError={() => setFailed(true)}
      />
      {failed && <PlayerError message="The image did not load. It will retry." overlay />}
    </>
  )
}

function HlsPlayer({ cam }: { cam: CopWebcam }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHttps(cam.stream_url)) return
    const url = cam.stream_url
    let destroyed = false
    let hls: { destroy(): void } | null = null

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari plays HLS natively.
      video.src = url
    } else {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed) return
          if (!Hls.isSupported()) {
            setError('This browser cannot play the stream.')
            return
          }
          const instance = new Hls({ enableWorker: true, lowLatencyMode: false })
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setError('The stream stopped. Load it again to retry.')
          })
          instance.loadSource(url)
          instance.attachMedia(video)
          hls = instance
        })
        .catch(() => setError('The stream player failed to load.'))
    }

    return () => {
      destroyed = true
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [cam.stream_url])

  if (!isHttps(cam.stream_url)) return <PlayerError message="This camera has no stream." />
  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        muted
        playsInline
        autoPlay
        controls
        aria-label={cam.label}
        onError={() => setError('The stream did not play.')}
      />
      {error && <PlayerError message={error} overlay />}
    </>
  )
}

function PlayerError({ message, overlay = false }: { message: string; overlay?: boolean }) {
  return (
    <div
      className={`${overlay ? 'absolute inset-x-0 bottom-0' : 'absolute inset-0 flex items-center justify-center'} bg-black/70 px-2 py-1 text-[11px] text-gray-200`}
      role="status"
    >
      {message}
    </div>
  )
}

function CamPlayer({ cam }: { cam: CopWebcam }) {
  switch (cam.provider) {
    case 'windy': return <WindyPlayer cam={cam} />
    case 'youtube': return <YouTubePlayer cam={cam} />
    case 'image': return <ImagePlayer cam={cam} />
    case 'hls': return <HlsPlayer cam={cam} />
    default: return <PlayerError message="Unsupported camera." />
  }
}

// ── Card ────────────────────────────────────────────────────────

function Attribution({ cam }: { cam: CopWebcam }) {
  if (cam.provider === 'windy') {
    // Windy's terms: credit windy.com and link the camera's page.
    return isHttps(cam.page_url) ? (
      <a
        href={cam.page_url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded"
      >
        Webcams provided by windy.com
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    ) : <span>Webcams provided by windy.com</span>
  }
  if (cam.provider === 'youtube') return null
  return cam.attribution ? <span>{cam.attribution}</span> : null
}

function CamBadges({ cam }: { cam: CopWebcam }) {
  const offline = cam.windy_status === 'inactive'
  const unavailable = !!cam.windy_status && cam.windy_status !== 'active' && !offline
  const fromWindy = cam.position_source === 'windy' && cam.lat !== null
  const estimated = cam.bearing_source === 'estimated' && cam.bearing_deg !== null
  if (!offline && !unavailable && !fromWindy && !estimated) return null
  return (
    <div className="flex flex-wrap gap-1 px-2.5 pb-1.5">
      {offline && <span className={`${badgeClass} bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200`}>Offline on Windy</span>}
      {unavailable && <span className={`${badgeClass} bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200`}>No longer on Windy</span>}
      {fromWindy && <span className={`${badgeClass} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`}>Position from Windy</span>}
      {estimated && (
        <span
          className={`${badgeClass} bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200`}
          title="An AI-assisted estimate from the camera's title; check it against the view."
        >
          Direction estimated
        </span>
      )}
    </div>
  )
}

function OperatorLink({ cam }: { cam: CopWebcam }) {
  if (!isHttps(cam.source_url)) return null
  return (
    <a
      href={cam.source_url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded"
    >
      Camera operator
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  )
}

interface CamCardProps {
  cam: CopWebcam
  armed: boolean
  focused: boolean
  framesAllowed: boolean
  onArm: () => void
  onDisarm: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleting?: boolean
}

function CamCard({ cam, armed, focused, framesAllowed, onArm, onDisarm, onEdit, onDelete, deleting }: CamCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(true)

  // Unload the player while it is scrolled out of view; it comes back on return.
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '100px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (focused) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focused])

  const blocked = needsFrameCsp(cam) && !framesAllowed

  return (
    <div
      ref={cardRef}
      data-cam-id={cam.id}
      className={`rounded border bg-gray-50 dark:bg-gray-800/40 overflow-hidden ${
        focused ? 'border-cyan-500 ring-2 ring-cyan-500/40' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start gap-2 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-200 truncate" title={cam.label}>{cam.label}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {PROVIDER_LABELS[cam.provider] ?? cam.provider} · {DELIVERY_LABELS[cam.delivery] ?? cam.delivery}
          </p>
        </div>
        {armed && (
          <button
            type="button"
            onClick={onDisarm}
            className="inline-flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
            aria-label={`Stop ${cam.label}`}
            title="Stop"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
            aria-label={`Edit ${cam.label}`}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded text-gray-500 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
            aria-label={`Remove ${cam.label}`}
            title="Remove"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <CamBadges cam={cam} />

      <div className="relative aspect-video bg-gray-900">
        {armed && onScreen && !blocked ? (
          <CamPlayer cam={cam} />
        ) : armed && !onScreen ? (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400">Paused off-screen</div>
        ) : blocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-[11px] text-gray-300">
            <span>This page was opened before the camera players were allowed.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded border border-gray-600 px-3 text-xs text-gray-100 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reload page
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onArm}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-gray-300 hover:bg-gray-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-500"
            aria-label={`Load ${cam.label}`}
          >
            <Play className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs font-medium">Load camera</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 min-h-[24px]">
        <Attribution cam={cam} />
        <OperatorLink cam={cam} />
      </div>
      <CopItemTags targetType="webcam" targetId={cam.id} label="webcam" max={3} editable={!!onEdit} className="px-2.5 pb-1.5 mt-0" />
    </div>
  )
}

// ── Grid ────────────────────────────────────────────────────────

interface CopCamGridProps {
  cams: CopWebcam[]
  focusCamId?: string | null
  onEdit?: (cam: CopWebcam) => void
  onDelete?: (cam: CopWebcam) => void
  deletingId?: string | null
}

export default function CopCamGrid({ cams: allCams, focusCamId, onEdit, onDelete, deletingId }: CopCamGridProps) {
  // The page's tag filter (a no-op on the public share, which has no tags).
  const tagFilter = useCopTagFilter()
  const cams = tagFilter.filtering ? allCams.filter((c) => tagFilter.passes('webcam', c.id)) : allCams
  // Armed cameras, oldest first. Video players (not still images) are capped.
  const [armed, setArmed] = useState<string[]>([])
  const [framesAllowed] = useState(camPlayersAllowedHere)

  const arm = useCallback((cam: CopWebcam) => {
    setArmed((prev) => {
      // Drop the camera itself and any camera that has since been removed.
      const next = prev.filter((id) => id !== cam.id && cams.some((c) => c.id === id))
      if (cam.provider !== 'image') {
        const live = next.filter((id) => cams.find((c) => c.id === id)?.provider !== 'image')
        if (live.length >= MAX_LIVE_PLAYERS) {
          const oldest = live[0]
          return [...next.filter((id) => id !== oldest), cam.id]
        }
      }
      return [...next, cam.id]
    })
  }, [cams])

  const disarm = useCallback((camId: string) => {
    setArmed((prev) => prev.filter((id) => id !== camId))
  }, [])

  if (cams.length === 0 && allCams.length > 0) {
    return <TagFilterNote shown={0} total={allCams.length} />
  }

  if (cams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-6 text-center text-xs text-gray-500">
        <Video className="h-5 w-5" aria-hidden="true" />
        No webcams yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-amber-700 dark:text-amber-300" role="note">
        Loading a camera contacts its provider directly; they see your IP.
      </p>
      <TagFilterNote shown={cams.length} total={allCams.length} />
      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))]">
        {cams.map((cam) => (
          <CamCard
            key={cam.id}
            cam={cam}
            armed={armed.includes(cam.id)}
            focused={focusCamId === cam.id}
            framesAllowed={framesAllowed}
            onArm={() => arm(cam)}
            onDisarm={() => disarm(cam.id)}
            onEdit={onEdit ? () => onEdit(cam) : undefined}
            onDelete={onDelete ? () => onDelete(cam) : undefined}
            deleting={deletingId === cam.id}
          />
        ))}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Up to {MAX_LIVE_PLAYERS} video players run at once; loading another stops the oldest.
      </p>
    </div>
  )
}
