/**
 * COP share links: the checks every route that honours a share token applies.
 *
 * A share token is the only credential an unauthenticated visitor holds, so the
 * public page, its RFI answers and the map layers all decide from the same rules:
 * the link has not expired, it shows the panel being used, and the session is not
 * archived.
 */

/** True when the share has an expiry (migration 114) that has passed or can't be read. */
export function shareExpired(share: { expires_at?: unknown }): boolean {
  if (share.expires_at === undefined || share.expires_at === null || share.expires_at === '') return false
  const at = Date.parse(String(share.expires_at))
  return !Number.isFinite(at) || at <= Date.now()
}

/** The panels a share shows. A row that can't be read shows only the map. */
export function sharePanels(share: { visible_panels?: unknown }): string[] {
  try {
    const parsed = JSON.parse(String(share.visible_panels ?? '["map"]'))
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : ['map']
  } catch {
    return ['map']
  }
}

export function sessionArchived(session: { status?: unknown } | null | undefined): boolean {
  return String(session?.status ?? '').toUpperCase() === 'ARCHIVED'
}

/**
 * The `active_layers` ids (src/components/cop/CopLayerCatalog.ts) each layer
 * endpoint serves. A share may read a layer only when the session shows it.
 */
const LAYER_IDS: Record<string, readonly string[]> = {
  places: ['places'],
  events: ['events'],
  actors: ['actors'],
  relationships: ['relationships'],
  acled: ['acled'],
  gdelt: ['gdelt'],
  'poo-estimates': ['poo-estimates'],
  assets: ['assets'],
  markers: ['cop-markers', 'markers'],
  analysis: ['deception-risk', 'framework-overlay'],
}

/**
 * May a share read this map layer of its session? Only a layer the session has
 * switched on, never `assets` (human sources and their positions) unless a panel
 * explicitly shares it, and never on an archived session.
 */
export function shareMayReadLayer(
  session: { status?: unknown; active_layers?: unknown },
  layer: string | undefined,
  panels: readonly string[],
  url: URL,
): boolean {
  if (!layer || sessionArchived(session)) return false
  if (layer === 'assets' && !panels.includes('assets')) return false
  let ids = LAYER_IDS[layer] ?? []
  if (layer === 'analysis') {
    const type = url.searchParams.get('type')
    if (type === 'deception') ids = ['deception-risk']
    else if (type === 'framework') ids = ['framework-overlay']
  }
  let active: unknown
  try {
    active = JSON.parse(String(session.active_layers ?? '[]'))
  } catch {
    active = []
  }
  return Array.isArray(active) && ids.some((id) => active.includes(id))
}
