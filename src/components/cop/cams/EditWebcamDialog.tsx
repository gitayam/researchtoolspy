/**
 * EditWebcamDialog -- correct a camera's label, position, bearing and field of
 * view. "Estimate direction" asks the server what the camera faces: the AI reads
 * only the camera's title, a geocoder places that landmark, and the bearing is
 * computed from the two positions. Nothing is saved until the analyst saves.
 */

import { useState } from 'react'
import { Loader2, MapPin, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CopWebcam, CopWebcamBearingEstimate } from '@/types/cop'
import OsmCredit from '../OsmCredit'
import { camRequest, estimateErrorMessage } from './webcam-api'
import { buildWebcamPatch, compassPoint, type WebcamEditDraft } from './webcam-draft'

interface EditWebcamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  cam: CopWebcam | null
  draft: WebcamEditDraft
  onDraftChange: (draft: WebcamEditDraft) => void
  onSaved: (cam: CopWebcam) => void
  /** Close the dialog and let the analyst click the map; the parent reopens it. */
  onPickFromMap?: () => void
}

const inputClass =
  'w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'

function saveErrorMessage(status: number, error: string | null): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.'
  if (status === 403) return 'Only the session owner or an editor can edit webcams.'
  if (status === 404) return 'This webcam is no longer on the COP.'
  if (status === 405) return "Editing webcams isn't available on this server yet."
  return error ?? `The webcam could not be saved (HTTP ${status}).`
}

export default function EditWebcamDialog({
  open,
  onOpenChange,
  sessionId,
  cam,
  draft,
  onDraftChange,
  onSaved,
  onPickFromMap,
}: EditWebcamDialogProps) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [estimate, setEstimate] = useState<CopWebcamBearingEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [shownFor, setShownFor] = useState<string | null>(null)

  // A different camera starts with a clean slate.
  if (cam && cam.id !== shownFor) {
    setShownFor(cam.id)
    setSaveError(null)
    setEstimate(null)
    setEstimateError(null)
  }

  if (!cam) return null

  const set = (field: 'label' | 'lat' | 'lon' | 'fov') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onDraftChange({ ...draft, [field]: e.target.value })

  const savedPosition = cam.lat !== null && cam.lon !== null
  const positionEdited = draft.lat.trim() !== (cam.lat === null ? '' : String(cam.lat))
    || draft.lon.trim() !== (cam.lon === null ? '' : String(cam.lon))

  const handleEstimate = async () => {
    setEstimating(true)
    setEstimate(null)
    setEstimateError(null)
    const res = await camRequest<CopWebcamBearingEstimate>(
      `/api/cop/${sessionId}/webcams/${encodeURIComponent(cam.id)}/estimate-bearing`,
      { method: 'POST', body: {} },
    )
    setEstimating(false)
    if (res.ok === false) {
      setEstimateError(estimateErrorMessage(res))
      return
    }
    const bearing = Number(res.data.bearing_deg)
    if (!Number.isInteger(bearing) || bearing < 0 || bearing > 359 || !res.data.target) {
      setEstimateError('The estimate came back incomplete. Set the bearing by hand.')
      return
    }
    setEstimate(res.data)
  }

  const handleSave = async () => {
    const built = buildWebcamPatch(cam, draft)
    if ('error' in built) {
      setSaveError(built.error)
      return
    }
    if (Object.keys(built.patch).length === 0) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    setSaveError(null)
    const res = await camRequest<{ webcam: CopWebcam | null }>(
      `/api/cop/${sessionId}/webcams/${encodeURIComponent(cam.id)}`,
      { method: 'PATCH', body: built.patch },
    )
    setSaving(false)
    if (res.ok === false) {
      setSaveError(saveErrorMessage(res.status, res.error))
      return
    }
    onSaved(res.data.webcam ?? cam)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit webcam</DialogTitle>
          <DialogDescription>
            Correct where the camera is and which way it looks. The map draws its view from the bearing and field of view.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!saving) void handleSave()
          }}
        >
          <div>
            <label htmlFor="edit-cam-label" className={labelClass}>Label</label>
            <input id="edit-cam-label" type="text" maxLength={120} value={draft.label} onChange={set('label')} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="edit-cam-lat" className={labelClass}>Latitude</label>
              <input id="edit-cam-lat" type="number" step="any" min={-90} max={90} value={draft.lat} onChange={set('lat')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-cam-lon" className={labelClass}>Longitude</label>
              <input id="edit-cam-lon" type="number" step="any" min={-180} max={180} value={draft.lon} onChange={set('lon')} className={inputClass} />
            </div>
          </div>
          {cam.position_source === 'windy' && !positionEdited && (
            <p className="text-[11px] text-gray-600 dark:text-gray-400">This position came from Windy.</p>
          )}
          {onPickFromMap && (
            <Button type="button" variant="outline" size="sm" onClick={onPickFromMap} className="min-h-[44px] sm:min-h-0">
              <MapPin className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Pick on map
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="edit-cam-bearing" className={labelClass}>Bearing (°)</label>
              <input
                id="edit-cam-bearing"
                type="number"
                step={1}
                min={0}
                max={359}
                value={draft.bearing}
                onChange={(e) => onDraftChange({ ...draft, bearing: e.target.value, bearingSource: e.target.value.trim() ? 'user' : null })}
                placeholder="0–359"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-cam-fov" className={labelClass}>Field of view (°)</label>
              <input id="edit-cam-fov" type="number" step={1} min={1} max={180} value={draft.fov} onChange={set('fov')} placeholder="60" className={inputClass} />
            </div>
          </div>
          {draft.bearingSource === 'estimated' && draft.bearing.trim() !== '' && (
            <p className="text-[11px] text-amber-800 dark:text-amber-300">This bearing is an AI-assisted estimate. Check it against the camera's view.</p>
          )}

          <div className="space-y-2 rounded border border-gray-200 dark:border-gray-700 p-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleEstimate()}
              disabled={estimating || !savedPosition}
              className="min-h-[44px] sm:min-h-0"
            >
              {estimating
                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />
                : <Sparkles className="h-3.5 w-3.5 mr-1" aria-hidden="true" />}
              Estimate direction (AI)
            </Button>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              {!savedPosition
                ? 'Save a position first: the estimate starts from where the camera is.'
                : positionEdited
                  ? 'The estimate uses the saved position. Save the new position first to use it.'
                  : "The AI reads the camera's title for the landmark it faces; the bearing is computed from that landmark's position."}
            </p>
            <div role="status" aria-live="polite">
              {estimateError && <p className="text-xs text-red-700 dark:text-red-400">{estimateError}</p>}
              {estimate && (
                <div className="space-y-1.5 text-xs text-gray-800 dark:text-gray-200">
                  <p>
                    Faces <span className="font-semibold">{estimate.target.name}</span>,{' '}
                    {Number(estimate.target.distance_km).toFixed(1)} km away: bearing{' '}
                    <span className="font-semibold">{estimate.bearing_deg}° ({compassPoint(estimate.bearing_deg)})</span>.
                  </p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 break-words">{estimate.target.display_name}</p>
                  <OsmCredit text={estimate.geocoder_attribution} url={estimate.geocoder_attribution_url} className="block" />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onDraftChange({ ...draft, bearing: String(estimate.bearing_deg), bearingSource: 'estimated' })
                      setEstimate(null)
                    }}
                    className="min-h-[44px] sm:min-h-0"
                  >
                    Use this bearing
                  </Button>
                </div>
              )}
            </div>
          </div>

          {saveError && <p className="text-xs text-red-700 dark:text-red-400" role="alert">{saveError}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
