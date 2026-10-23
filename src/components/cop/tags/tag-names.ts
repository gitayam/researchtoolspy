/**
 * Tag names and colours, shared by every tag component and the capture bar.
 *
 * The rules mirror the server's (`cop_tags.name_key`): trimmed, at most 40
 * characters, letters, digits, space, `_`, `.` and `-`, compared without case.
 * Checking here only saves a round trip; the server decides.
 */

export const TAG_MAX_LENGTH = 40
/** The most tags one request may add (`POST /item-tags`). */
export const TAG_MAX_PER_ITEM = 10

const TAG_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u

/** Collapse inner whitespace and trim. Returns '' for nothing usable. */
export function normalizeTagName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** The case-insensitive key two names are compared by. */
export function tagKey(name: string): string {
  return normalizeTagName(name).toLowerCase()
}

export function isValidTagName(raw: string): boolean {
  const name = normalizeTagName(raw)
  return name.length > 0 && name.length <= TAG_MAX_LENGTH && TAG_NAME.test(name)
}

/** Unique (by key), valid names, in first-seen order, capped. */
export function uniqueTagNames(names: readonly string[], max = TAG_MAX_PER_ITEM): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = normalizeTagName(raw)
    if (!isValidTagName(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

/**
 * The colours a tag may take. A palette, not free CSS: the server's `color` is
 * matched against these names and anything else is ignored, so nothing stored
 * in a tag ends up in a class list or a style.
 */
export const TAG_PALETTE = ['slate', 'blue', 'emerald', 'amber', 'rose', 'violet', 'cyan', 'orange'] as const
export type TagPaletteName = typeof TAG_PALETTE[number]

const CHIP_CLASSES: Record<TagPaletteName, string> = {
  slate: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-500/40',
  blue: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/40',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/40',
  amber: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40',
  rose: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/40',
  violet: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-500/40',
  cyan: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-500/40',
  orange: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-500/40',
}

/** A stable palette entry for a name, so an uncoloured tag keeps its colour everywhere. */
export function paletteForName(name: string): TagPaletteName {
  let hash = 0
  for (const ch of tagKey(name)) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return TAG_PALETTE[hash % TAG_PALETTE.length]
}

/** The palette entry for a tag: its stored colour when that is a palette name, else by name. */
export function tagPalette(name: string, color?: string | null): TagPaletteName {
  const stored = (color ?? '').toLowerCase()
  return (TAG_PALETTE as readonly string[]).includes(stored) ? stored as TagPaletteName : paletteForName(name)
}

export function tagChipClasses(name: string, color?: string | null): string {
  return CHIP_CLASSES[tagPalette(name, color)]
}

/** Does an item pass a tag filter? `itemTags` are the item's tag names. */
export function matchesTagFilter(itemTags: readonly string[], active: readonly string[], match: 'any' | 'all' = 'any'): boolean {
  if (active.length === 0) return true
  const keys = new Set(itemTags.map(tagKey))
  return match === 'all' ? active.every(a => keys.has(tagKey(a))) : active.some(a => keys.has(tagKey(a)))
}
