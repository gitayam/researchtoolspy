/**
 * AddWebcamDialog -- paste a camera link, name it, and place it.
 *
 * The server decides what a link is (Windy, YouTube, or an allow-listed image or
 * HLS feed) and derives the player URL itself; this form only collects the link,
 * a label, a location (typed, or picked on the map) and an optional bearing.
 * The form state lives in the parent so it survives closing the dialog to pick
 * a point on the map.
 */

import { Loader2, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { WebcamDraft } from './webcam-draft'
import { looksLikeWindyLink } from './webcam-api'

interface AddWebcamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: WebcamDraft
  onDraftChange: (draft: WebcamDraft) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
  /** Close the dialog and let the analyst click the map; the parent reopens it. */
  onPickFromMap?: () => void
  /** Set when the server said the link is a page, not a camera feed. */
  unsupportedLink?: string | null
  /** Search for cameras near the place that page describes. */
  onFindNearLink?: (link: string) => void
}

const inputClass =
  'w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500'
const labelClass = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'

export default function AddWebcamDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  error,
  onPickFromMap,
  unsupportedLink,
  onFindNearLink,
}: AddWebcamDialogProps) {
  const set = (field: keyof WebcamDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onDraftChange({ ...draft, [field]: e.target.value })
  // Windy supplies its own title and position, so a Windy link needs neither.
  const windy = looksLikeWindyLink(draft.url)
  const canSubmit = draft.url.trim() !== '' && (windy || draft.label.trim() !== '') && !submitting
  const showFindNearLink = !!unsupportedLink && unsupportedLink === draft.url.trim() && !!onFindNearLink

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add webcam</DialogTitle>
          <DialogDescription>
            Paste a Windy webcam link (windy.com/webcams/&lt;id&gt;) or a YouTube video link. Image and HLS
            feeds are accepted from approved open-data hosts.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) onSubmit()
          }}
        >
          <div>
            <label htmlFor="cam-url" className={labelClass}>Camera link</label>
            <input
              id="cam-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={draft.url}
              onChange={set('url')}
              placeholder="https://www.windy.com/webcams/1706619137"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="cam-label" className={labelClass}>Label{windy ? ' (optional)' : ''}</label>
            <input
              id="cam-label"
              type="text"
              maxLength={120}
              value={draft.label}
              onChange={set('label')}
              placeholder={windy ? "Leave blank to use Windy's title" : "Palais d'Iéna, facing the Eiffel Tower"}
              className={inputClass}
              required={!windy}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cam-lat" className={labelClass}>Latitude</label>
              <input id="cam-lat" type="number" step="any" min={-90} max={90} value={draft.lat} onChange={set('lat')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="cam-lon" className={labelClass}>Longitude</label>
              <input id="cam-lon" type="number" step="any" min={-180} max={180} value={draft.lon} onChange={set('lon')} className={inputClass} />
            </div>
          </div>
          {onPickFromMap && (
            <Button type="button" variant="outline" size="sm" onClick={onPickFromMap} className="min-h-[44px] sm:min-h-0">
              <MapPin className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Pick on map
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cam-bearing" className={labelClass}>Bearing (°, optional)</label>
              <input id="cam-bearing" type="number" step={1} min={0} max={359} value={draft.bearing} onChange={set('bearing')} placeholder="0–359" className={inputClass} />
            </div>
            <div>
              <label htmlFor="cam-fov" className={labelClass}>Field of view (°, optional)</label>
              <input id="cam-fov" type="number" step={1} min={1} max={360} value={draft.fov} onChange={set('fov')} placeholder="60" className={inputClass} />
            </div>
          </div>

          {windy && (
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              Leave the position blank to use the one Windy lists for this camera.
            </p>
          )}

          {showFindNearLink ? (
            <div className="space-y-2 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5" role="alert">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">This page isn&apos;t a camera feed.</p>
              <p className="text-xs text-amber-900 dark:text-amber-200">
                It may show a camera from Windy or YouTube. Open it and copy that link, or search for public cameras near
                the place the page is about. The page itself is not opened.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { if (unsupportedLink) onFindNearLink?.(unsupportedLink) }}
                className="min-h-[44px] sm:min-h-0"
              >
                <Search className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Find cameras near this page&apos;s place
              </Button>
            </div>
          ) : (
            error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
              Add webcam
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
