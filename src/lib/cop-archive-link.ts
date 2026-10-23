/**
 * The link to an evidence item's original, as the COP API gives it to collaborators
 * (`archive_url` + `archived_in`, functions/api/_shared/cop-archive.ts), and whether the
 * item is held pending a virus scan.
 *
 * Only an https URL is ever linked. A Silo original opens the community portal, which
 * lets a signed-in member of the room download it; a saved video opens PeerTube.
 */

export type ArchiveKind = 'silo' | 'peertube'

export interface ArchiveLink {
  href: string
  kind: ArchiveKind
  label: string
  /** For the link's title: who can open it. */
  hint: string
}

interface ArchiveFields {
  archive_url?: unknown
  archived_in?: unknown
  held?: unknown
}

export const HELD_LABEL = 'Held pending a virus scan'

export function isHeld(item: ArchiveFields | null | undefined): boolean {
  return item?.held === true
}

export function archiveLinkFor(item: ArchiveFields | null | undefined): ArchiveLink | null {
  if (!item || isHeld(item)) return null
  const kind = item.archived_in === 'silo' || item.archived_in === 'peertube' ? item.archived_in : null
  if (!kind || typeof item.archive_url !== 'string') return null
  let url: URL
  try {
    url = new URL(item.archive_url)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  return kind === 'silo'
    ? {
        href: url.href,
        kind,
        label: 'Original in Silo — room members',
        hint: 'Opens the community portal. Members of the room who have linked their portal account with !linkme can download the original (location data included).',
      }
    : { href: url.href, kind, label: 'Video on PeerTube', hint: 'Opens the video on PeerTube.' }
}
