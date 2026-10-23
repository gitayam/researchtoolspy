/**
 * CopCamsPanel -- the workspace's webcams: the player grid, plus adding and
 * removing cameras for owners and editors (the server enforces who may).
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { getCopHeaders } from '@/lib/cop-auth'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { CopWebcam } from '@/types/cop'
import CopCamGrid from './CopCamGrid'
import AddWebcamDialog from './AddWebcamDialog'
import { EMPTY_WEBCAM_DRAFT, type WebcamDraft } from './webcam-draft'

interface CopCamsPanelProps {
  sessionId: string
  focusCamId?: string | null
  /** Called after a webcam is added or removed, to refresh the map layer. */
  onChanged?: () => void
  /** Enter map pick mode; the chosen point arrives as pickedLocation. */
  onPickFromMap?: () => void
  pickedLocation?: { lat: number; lon: number } | null
}

async function fetchWebcams(sessionId: string, signal?: AbortSignal): Promise<CopWebcam[]> {
  const res = await fetch(`/api/cop/${sessionId}/webcams`, { headers: getCopHeaders(), signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { webcams?: CopWebcam[] }
  return json.webcams ?? []
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}

export default function CopCamsPanel({ sessionId, focusCamId, onChanged, onPickFromMap, pickedLocation }: CopCamsPanelProps) {
  const confirm = useConfirm()
  const [cams, setCams] = useState<CopWebcam[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<WebcamDraft>(EMPTY_WEBCAM_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [seenPick, setSeenPick] = useState(pickedLocation)

  useEffect(() => {
    const controller = new AbortController()
    fetchWebcams(sessionId, controller.signal)
      .then((list) => {
        setCams(list)
        setLoadError(null)
      })
      .catch((err) => {
        if ((err as Error)?.name !== 'AbortError') setLoadError('Webcams could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [sessionId])

  const reload = useCallback(async () => {
    try {
      setCams(await fetchWebcams(sessionId))
      setLoadError(null)
    } catch {
      setLoadError('Webcams could not be loaded.')
    }
  }, [sessionId])

  // A point picked on the map fills the form and reopens the dialog.
  if (pickedLocation !== seenPick) {
    setSeenPick(pickedLocation)
    if (pickedLocation && picking) {
      setPicking(false)
      setDraft((d) => ({ ...d, lat: pickedLocation.lat.toFixed(6), lon: pickedLocation.lon.toFixed(6) }))
      setDialogOpen(true)
    }
  }

  const openDialog = () => {
    setSubmitError(null)
    setDialogOpen(true)
  }

  const handlePick = onPickFromMap
    ? () => {
        setPicking(true)
        setDialogOpen(false)
        onPickFromMap()
      }
    : undefined

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/cop/${sessionId}/webcams`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          url: draft.url.trim(),
          label: draft.label.trim(),
          lat: optionalNumber(draft.lat),
          lon: optionalNumber(draft.lon),
          bearing_deg: optionalNumber(draft.bearing),
          fov_deg: optionalNumber(draft.fov),
        }),
      })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) {
        setSubmitError(json?.error ?? `The webcam could not be added (HTTP ${res.status}).`)
        return
      }
      setDraft(EMPTY_WEBCAM_DRAFT)
      setDialogOpen(false)
      await reload()
      onChanged?.()
    } catch {
      setSubmitError('The webcam could not be added. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (cam: CopWebcam) => {
    const ok = await confirm({
      title: 'Remove webcam',
      description: `"${cam.label}" leaves this COP's map and camera grid.`,
      confirmLabel: 'Remove webcam',
    })
    if (!ok) return
    setDeletingId(cam.id)
    try {
      const res = await fetch(`/api/cop/${sessionId}/webcams/${encodeURIComponent(cam.id)}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null) as { error?: string } | null
        setLoadError(json?.error ?? `The webcam could not be removed (HTTP ${res.status}).`)
        return
      }
      await reload()
      onChanged?.()
    } catch {
      setLoadError('The webcam could not be removed. Check your connection and try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col gap-2 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {loading ? 'Loading…' : `${cams.length} webcam${cams.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex min-h-[44px] sm:min-h-0 sm:h-7 items-center gap-1 rounded border border-gray-300 dark:border-gray-600 px-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add webcam
        </button>
      </div>

      {loadError && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{loadError}</p>}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-500" /></div>
        ) : (
          <CopCamGrid cams={cams} focusCamId={focusCamId} onDelete={handleDelete} deletingId={deletingId} />
        )}
      </div>

      <AddWebcamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={submitError}
        onPickFromMap={handlePick}
      />
    </div>
  )
}
