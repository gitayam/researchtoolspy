/**
 * What the anonymous tip form (drop mode of PublicIntakeForm) promises, kept true.
 *
 * Since 2026-10-23 a research COP keeps a tip photo's GPS position and capture time for
 * its team (functions/api/surveys/public/[token]/drop-submit.ts, keepLocation), so the
 * form says so before submit and next to every file input. What is still never
 * recorded: the tipster's IP address, device (no user agent; a photo's make, model and
 * serials are removed) or identity.
 */

/** The banner's promise: still true. */
export const TIP_IDENTITY_PROMISE = "Your identity is protected. We don't record your IP address, your device or who you are."

/**
 * Shown in the banner and next to every file/photo input. The team copy keeps the GPS
 * position (latitude, longitude, altitude) and the capture date, time and UTC offset
 * (functions/api/_shared/photo-location.ts).
 */
export const TIP_PHOTO_LOCATION_NOTICE =
  "Photos keep where and when they were taken (GPS position, altitude, date, time and time zone) so the team can place them on the map. Remove this from the photo first if you don't want to share it."

/** How, briefly. A screenshot has no GPS position but can still carry a date (XMP). */
export const TIP_PHOTO_LOCATION_HOWTO =
  "Most phones' share options can leave the location out. A screenshot has no GPS position, but may still carry the date and time it was taken."

/**
 * Whether the submitted screen offers everyone's answers ("View all responses"). Never
 * for the anonymous tip form: its tips are the team's to review (and the results route
 * answers 404 for tip forms and COP-linked forms).
 */
export function offersPublicResults(isDropMode: boolean): boolean {
  return !isDropMode
}
