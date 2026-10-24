/**
 * The anonymous tip form's notice that photos keep their location (src/lib/tip-privacy.ts).
 * `inline`: the short form beside a file input; otherwise the banner's paragraph.
 */
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIP_PHOTO_LOCATION_HOWTO, TIP_PHOTO_LOCATION_NOTICE } from '@/lib/tip-privacy'

export function TipPhotoLocationNote({ inline = false, className }: { inline?: boolean; className?: string }) {
  return (
    <p
      data-tip-photo-location=""
      className={cn(
        'flex items-start gap-1.5 text-xs leading-relaxed',
        inline ? 'mt-1.5 text-amber-800 dark:text-amber-300' : 'mt-1.5 text-emerald-800 dark:text-emerald-300',
        className,
      )}
    >
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {TIP_PHOTO_LOCATION_NOTICE} {TIP_PHOTO_LOCATION_HOWTO}
      </span>
    </p>
  )
}
