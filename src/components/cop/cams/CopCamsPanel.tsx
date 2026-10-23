/**
 * CopCamsPanel -- the workspace's webcams: the player grid, plus finding, adding,
 * editing and removing cameras for owners and editors (the server enforces who may).
 */

import { useCallback, useEffect, useState } from 'react'
import { useCopChangeListener } from '@/hooks/useCopChanges'
import { notifyCopChanged } from '@/lib/cop-request'
import { Loader2, Plus, Search } from 'lucide-react'
import { getCopHeaders } from '@/lib/cop-auth'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type { CopWebcam } from '@/types/cop'
import CopCamGrid from './CopCamGrid'
import AddWebcamDialog from './AddWebcamDialog'
import EditWebcamDialog from './EditWebcamDialog'
import FindWebcamsDialog from './FindWebcamsDialog'
import { camRequest } from './webcam-api'
import {
  EMPTY_WEBCAM_DRAFT,
  editDraftFrom,
  type WebcamDraft,
  type WebcamEditDraft,
} from './webcam-draft'

interface CopCamsPanelProps {
  sessionId: string
  focusCamId?: string | null
  /** Called after a webcam is added, edited or removed, to refresh the map layer. */
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

const headerButtonClass =
  'inline-flex min-h-[44px] sm:min-h-0 sm:h-7 items-center gap-1 rounded border border-gray-300 dark:border-gray-600 px-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500'

export default function CopCamsPanel({ sessionId, focusCamId, onChanged, onPickFromMap, pickedLocation }: CopCamsPanelProps) {
  const confirm = useConfirm()
  const [cams, setCams] = useState<CopWebcam[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<WebcamDraft>(EMPTY_WEBCAM_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [unsupportedLink, setUnsupportedLink] = useState<string | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findFromUrl, setFindFromUrl] = useState<string | null>(null)
  const [editCam, setEditCam] = useState<CopWebcam | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState<WebcamEditDraft | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pickingFor, setPickingFor] = useState<'add' | 'edit' | null>(null)
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

  // Live: cameras pinned from the Signal room or by other analysts appear here.
  useCopChangeListener(['webcam'], () => { void reload() })

  // A point picked on the map fills the form it was picked for and reopens it.
  if (pickedLocation !== seenPick) {
    setSeenPick(pickedLocation)
    if (pickedLocation && pickingFor) {
      const lat = pickedLocation.lat.toFixed(6)
      const lon = pickedLocation.lon.toFixed(6)
      if (pickingFor === 'add') {
        setDraft((d) => ({ ...d, lat, lon }))
        setDialogOpen(true)
      } else if (editDraft) {
        setEditDraft({ ...editDraft, lat, lon })
        setEditOpen(true)
      }
      setPickingFor(null)
    }
  }

  const openDialog = () => {
    setSubmitError(null)
    setUnsupportedLink(null)
    setDialogOpen(true)
  }

  const openFind = () => {
    setFindFromUrl(null)
    setFindOpen(true)
  }

  const pickFor = (target: 'add' | 'edit') => onPickFromMap
    ? () => {
        setPickingFor(target)
        if (target === 'add') setDialogOpen(false)
        else setEditOpen(false)
        onPickFromMap()
      }
    : undefined

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    setUnsupportedLink(null)
    const url = draft.url.trim()
    const label = draft.label.trim()
    try {
      const res = await camRequest<{ webcam: CopWebcam | null }>(`/api/cop/${sessionId}/webcams`, {
        method: 'POST',
        body: {
          url,
          // Blank lets the server use Windy's own title.
          label: label || undefined,
          lat: optionalNumber(draft.lat),
          lon: optionalNumber(draft.lon),
          bearing_deg: optionalNumber(draft.bearing),
          fov_deg: optionalNumber(draft.fov),
        },
      })
      if (res.ok === false) {
        if (res.code === 'WEBCAM_UNSUPPORTED_LINK') setUnsupportedLink(url)
        setSubmitError(
          res.code === 'WEBCAM_DUPLICATE' ? 'That camera is already on this COP.'
            : res.code === 'WEBCAM_LIMIT' ? 'This COP already holds its maximum number of cameras.'
              : res.status === 0 ? 'The webcam could not be added. Check your connection and try again.'
                : res.error ?? `The webcam could not be added (HTTP ${res.status}).`,
        )
        return
      }
      setDraft(EMPTY_WEBCAM_DRAFT)
      setDialogOpen(false)
      notifyCopChanged(['webcam'])
      await reload()
      onChanged?.()
    } finally {
      setSubmitting(false)
    }
  }

  const handleFindNearLink = (link: string) => {
    setDialogOpen(false)
    setFindFromUrl(link)
    setFindOpen(true)
  }

  const handleEdit = (cam: CopWebcam) => {
    setEditCam(cam)
    setEditDraft(editDraftFrom(cam))
    setEditOpen(true)
  }

  const handleSaved = (updated: CopWebcam) => {
    setCams((list) => list.map((c) => (c.id === updated.id ? updated : c)))
    setEditOpen(false)
    notifyCopChanged(['webcam'])
    onChanged?.()
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
      if (res.ok === false) {
        const json = await res.json().catch(() => null) as { error?: string } | null
        setLoadError(json?.error ?? `The webcam could not be removed (HTTP ${res.status}).`)
        return
      }
      notifyCopChanged(['webcam'])
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {loading ? 'Loading…' : `${cams.length} webcam${cams.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={openFind} className={headerButtonClass}>
            <Search className="h-3 w-3" aria-hidden="true" />
            Find cameras
          </button>
          <button type="button" onClick={openDialog} className={headerButtonClass}>
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add webcam
          </button>
        </div>
      </div>

      {loadError && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{loadError}</p>}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-500" /></div>
        ) : (
          <CopCamGrid cams={cams} focusCamId={focusCamId} onEdit={handleEdit} onDelete={handleDelete} deletingId={deletingId} />
        )}
      </div>

      <AddWebcamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={(next) => {
          setDraft(next)
          if (next.url !== draft.url) setUnsupportedLink(null)
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={submitError}
        onPickFromMap={pickFor('add')}
        unsupportedLink={unsupportedLink}
        onFindNearLink={handleFindNearLink}
      />

      <FindWebcamsDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        sessionId={sessionId}
        fromUrl={findFromUrl}
        onClearFromUrl={() => setFindFromUrl(null)}
        onAdded={() => {
          notifyCopChanged(['webcam'])
          void reload()
          onChanged?.()
        }}
      />

      {editDraft && (
        <EditWebcamDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          sessionId={sessionId}
          cam={editCam}
          draft={editDraft}
          onDraftChange={setEditDraft}
          onSaved={handleSaved}
          onPickFromMap={pickFor('edit')}
        />
      )}
    </div>
  )
}
