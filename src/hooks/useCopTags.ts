/**
 * A COP session's tags: the vocabulary (`GET /tags`) and which items carry which
 * tag (`GET /item-tags`), loaded once and refetched whenever the page reports a
 * tag change (the window `cop:changed` event with 'tag' in its types).
 *
 * Writes go through here so every panel sees the same state, and each successful
 * write announces itself with `cop:changed` so other panels (and the change feed
 * poller) stay in step. `available` is false while the server has no tag routes
 * yet (404/405): callers then hide tag UI instead of showing errors.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copRequest, COP_CHANGED_EVENT, notifyCopChanged, NOT_AVAILABLE } from '@/lib/cop-request'
import { tagKey, uniqueTagNames } from '@/components/cop/tags/tag-names'
import type {
  CopChangedDetail, CopItemTagSource, CopItemTags, CopTag, CopTagTarget, CopTagTargetType,
} from '@/types/cop'

export type TagWriteResult = { ok: true } | { ok: false; message: string }

export interface UseCopTags {
  /** The session's vocabulary, most used first. */
  tags: CopTag[]
  /** Tags on one item (names as stored). */
  tagsFor: (targetType: CopTagTargetType, targetId: string | number) => string[]
  /** Items carrying a tag, as `type:id` keys, for filtering. */
  itemsWithTag: (name: string) => Set<string>
  loading: boolean
  /** False until the server has the tag routes. */
  available: boolean
  error: string | null
  refresh: () => Promise<void>
  createTag: (name: string, opts?: { color?: string; category?: string }) => Promise<CopTag | null>
  applyTags: (target: CopTagTarget, names: string[], source?: CopItemTagSource) => Promise<TagWriteResult>
  removeTag: (target: CopTagTarget, name: string) => Promise<TagWriteResult>
  bulk: (targets: CopTagTarget[], add: string[], remove: string[]) => Promise<TagWriteResult>
}

export const itemKey = (targetType: CopTagTargetType, targetId: string | number) => `${targetType}:${targetId}`

function failure(status: number, code: string | null, error: string | null): string {
  if (code === NOT_AVAILABLE) return 'Tags are not available on this server yet.'
  if (status === 403) return 'Only the session owner or an editor can change tags.'
  if (status === 429) return 'Too many changes at once. Try again in a minute.'
  if (status === 0) return 'Could not reach the server. Check your connection.'
  return error ?? `Tags could not be saved (HTTP ${status}).`
}

export function useCopTags(sessionId: string, opts: { enabled?: boolean } = {}): UseCopTags {
  const enabled = opts.enabled !== false && !!sessionId
  const [tags, setTags] = useState<CopTag[]>([])
  const [items, setItems] = useState<CopItemTags[]>([])
  const [loaded, setLoaded] = useState(false)
  const [available, setAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    const mine = ++generation.current
    const base = `/api/cop/${encodeURIComponent(sessionId)}`
    const [vocab, linked] = await Promise.all([
      copRequest<{ tags?: CopTag[] }>(`${base}/tags`),
      copRequest<{ items?: CopItemTags[] }>(`${base}/item-tags`),
    ])
    if (mine !== generation.current) return // a newer load won
    if ((vocab.ok === false && vocab.code === NOT_AVAILABLE) || (linked.ok === false && linked.code === NOT_AVAILABLE)) {
      setAvailable(false)
      setLoaded(true)
      return
    }
    setAvailable(true)
    if (vocab.ok === true) setTags(Array.isArray(vocab.data.tags) ? vocab.data.tags : [])
    if (linked.ok === true) setItems(Array.isArray(linked.data.items) ? linked.data.items : [])
    setError(vocab.ok === false ? failure(vocab.status, vocab.code, vocab.error)
      : linked.ok === false ? failure(linked.status, linked.code, linked.error) : null)
    setLoaded(true)
  }, [enabled, sessionId])

  useEffect(() => {
    if (!enabled) return
    // refresh() sets state only after its requests resolve, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<CopChangedDetail>).detail
      if (detail?.types?.includes('tag')) refresh()
    }
    window.addEventListener(COP_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(COP_CHANGED_EVENT, onChanged)
  }, [enabled, refresh])

  const byItem = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const entry of items) map.set(itemKey(entry.target_type, entry.target_id), entry.tags ?? [])
    return map
  }, [items])

  const byTag = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const entry of items) {
      for (const name of entry.tags ?? []) {
        const key = tagKey(name)
        if (!map.has(key)) map.set(key, new Set())
        map.get(key)!.add(itemKey(entry.target_type, entry.target_id))
      }
    }
    return map
  }, [items])

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name)),
    [tags],
  )

  const tagsFor = useCallback(
    (targetType: CopTagTargetType, targetId: string | number) => byItem.get(itemKey(targetType, String(targetId))) ?? [],
    [byItem],
  )
  const itemsWithTag = useCallback((name: string) => byTag.get(tagKey(name)) ?? new Set<string>(), [byTag])

  const base = `/api/cop/${encodeURIComponent(sessionId)}`

  /** Show a write at once, then let the refetch settle the truth. */
  const setItemTagsLocally = useCallback((target: CopTagTarget, next: (prev: string[]) => string[]) => {
    setItems(prev => {
      const key = itemKey(target.target_type, target.target_id)
      const found = prev.find(e => itemKey(e.target_type, e.target_id) === key)
      const updated = next(found?.tags ?? [])
      if (found) return prev.map(e => (e === found ? { ...e, tags: updated } : e))
      return [...prev, { target_type: target.target_type, target_id: String(target.target_id), tags: updated }]
    })
  }, [])

  const createTag = useCallback(async (name: string, extra: { color?: string; category?: string } = {}) => {
    const [clean] = uniqueTagNames([name], 1)
    if (!clean) return null
    const res = await copRequest<{ tag?: CopTag }>(`${base}/tags`, { method: 'POST', json: { name: clean, ...extra } })
    if (res.ok === false) {
      setError(failure(res.status, res.code, res.error))
      return null
    }
    notifyCopChanged(['tag'])
    return res.data.tag ?? null
  }, [base])

  const applyTags = useCallback(async (target: CopTagTarget, names: string[], source: CopItemTagSource = 'user'): Promise<TagWriteResult> => {
    const clean = uniqueTagNames(names)
    if (clean.length === 0) return { ok: true }
    setItemTagsLocally(target, prev => uniqueTagNames([...prev, ...clean], 100))
    const res = await copRequest<CopItemTags>(`${base}/item-tags`, {
      method: 'POST',
      json: { target_type: target.target_type, target_id: String(target.target_id), tags: clean, source },
    })
    if (res.ok === false) {
      await refresh()
      return { ok: false, message: failure(res.status, res.code, res.error) }
    }
    notifyCopChanged(['tag'])
    return { ok: true }
  }, [base, refresh, setItemTagsLocally])

  const removeTag = useCallback(async (target: CopTagTarget, name: string): Promise<TagWriteResult> => {
    setItemTagsLocally(target, prev => prev.filter(t => tagKey(t) !== tagKey(name)))
    const res = await copRequest<unknown>(`${base}/item-tags`, {
      method: 'DELETE',
      json: { target_type: target.target_type, target_id: String(target.target_id), tag: name },
    })
    if (res.ok === false) {
      await refresh()
      return { ok: false, message: failure(res.status, res.code, res.error) }
    }
    notifyCopChanged(['tag'])
    return { ok: true }
  }, [base, refresh, setItemTagsLocally])

  const bulk = useCallback(async (targets: CopTagTarget[], add: string[], remove: string[]): Promise<TagWriteResult> => {
    const addClean = uniqueTagNames(add)
    const removeClean = uniqueTagNames(remove)
    if (targets.length === 0 || (addClean.length === 0 && removeClean.length === 0)) return { ok: true }
    // The route takes 100 targets per call.
    for (let i = 0; i < targets.length; i += 100) {
      const chunk = targets.slice(i, i + 100).map(t => ({ target_type: t.target_type, target_id: String(t.target_id) }))
      const res = await copRequest<unknown>(`${base}/item-tags/bulk`, {
        method: 'POST',
        json: { targets: chunk, add: addClean, remove: removeClean },
      })
      if (res.ok === false) {
        await refresh()
        return { ok: false, message: failure(res.status, res.code, res.error) }
      }
    }
    notifyCopChanged(['tag'])
    return { ok: true }
  }, [base, refresh])

  return {
    tags: sortedTags, tagsFor, itemsWithTag, loading: enabled && !loaded, available, error, refresh,
    createTag, applyTags, removeTag, bulk,
  }
}
