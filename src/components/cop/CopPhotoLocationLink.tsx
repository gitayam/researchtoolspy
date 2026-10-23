/**
 * "Photo location" on a team evidence card: opens the map at the marker placed from the
 * photo's own GPS. Renders nothing without one (src/lib/cop-photo-location.ts); the
 * public share never receives the data it needs.
 */
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { focusCopMap, photoLocationLabel, type PhotoLocationLink } from '@/lib/cop-photo-location'

interface CopPhotoLocationLinkProps {
  location: PhotoLocationLink | null | undefined
  className?: string
}

export function CopPhotoLocationLink({ location, className }: CopPhotoLocationLinkProps) {
  if (!location) return null
  const { text, title } = photoLocationLabel(location)
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      <button
        type="button"
        title={title}
        onClick={(e) => {
          e.stopPropagation()
          focusCopMap({ lat: location.lat, lon: location.lon, markerId: location.markerId })
        }}
        className="inline-flex items-center gap-1 rounded text-blue-700 hover:underline dark:text-blue-400 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{text}</span>
        <span className="sr-only">: {title}</span>
      </button>
      {!location.confirmed && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400">possible · team only</span>
      )}
    </div>
  )
}
