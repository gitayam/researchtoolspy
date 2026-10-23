/**
 * The COP's evidence filings, evidence items and questions, shared by every panel
 * that shows or edits them (the questions tab, the evidence feed, the task board).
 *
 * One small store per COP and resource: however many components mount, the list is
 * fetched once, refreshed once per `cop:changed` burst, and every subscriber sees
 * the same data. A server without the links routes reports `available: false`.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useCopChangeListener } from '@/hooks/useCopChanges'
import { copRequest, NOT_AVAILABLE } from '@/lib/cop-request'
import { fetchEvidenceLinks } from '@/lib/cop-evidence-links'
import type { CopEntityType, CopEvidenceLink, CopVoteValue } from '@/types/cop'

interface Snapshot<T> {
  data: T
  loaded: boolean
  available: boolean
  error: boolean
}

class Store<T> {
  private snapshot: Snapshot<T>
  private listeners = new Set<() => void>()
  private inFlight: Promise<void> | null = null
  private again = false
  private readonly load: () => Promise<{ ok: true; data: T } | { ok: false; unavailable: boolean }>

  constructor(empty: T, load: () => Promise<{ ok: true; data: T } | { ok: false; unavailable: boolean }>) {
    this.snapshot = { data: empty, loaded: false, available: true, error: false }
    this.load = load
  }

  get = () => this.snapshot

  /** Change the data in place (an optimistic update); the next refresh replaces it. */
  patch = (change: (data: T) => T) => {
    this.snapshot = { ...this.snapshot, data: change(this.snapshot.data) }
    for (const listener of this.listeners) listener()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Fetch now, or once more after the fetch already running (a change may have landed mid-flight). */
  refresh = (): Promise<void> => {
    if (this.inFlight) {
      this.again = true
      return this.inFlight
    }
    this.inFlight = (async () => {
      do {
        this.again = false
        const res = await this.load()
        this.snapshot = res.ok === true
          ? { data: res.data, loaded: true, available: true, error: false }
          : { ...this.snapshot, loaded: true, available: !res.unavailable, error: !res.unavailable }
        for (const listener of this.listeners) listener()
      } while (this.again)
    })().finally(() => { this.inFlight = null })
    return this.inFlight
  }
}

const stores = new Map<string, Store<unknown>>()

function storeFor<T>(key: string, empty: T, load: () => Promise<{ ok: true; data: T } | { ok: false; unavailable: boolean }>): Store<T> {
  let store = stores.get(key) as Store<T> | undefined
  if (!store) {
    store = new Store<T>(empty, load)
    stores.set(key, store as Store<unknown>)
  }
  return store
}

function useStore<T>(store: Store<T>, types: readonly CopEntityType[]) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get)
  useEffect(() => {
    if (!store.get().loaded) void store.refresh()
  }, [store])
  useCopChangeListener(types, () => { void store.refresh() })
  const refresh = useCallback(() => store.refresh(), [store])
  return { ...snapshot, refresh }
}

// ── Filings ──────────────────────────────────────────────────────

const EMPTY_LINKS: CopEvidenceLink[] = []

function linksStore(sessionId: string) {
  return storeFor<CopEvidenceLink[]>(`links:${sessionId}`, EMPTY_LINKS, async () => {
    const res = await fetchEvidenceLinks(sessionId)
    if (res.ok === true) return { ok: true, data: Array.isArray(res.data.links) ? res.data.links : [] }
    return { ok: false, unavailable: res.code === NOT_AVAILABLE || res.code === 'EVIDENCE_LINKS_UNAVAILABLE' }
  })
}

export function useCopEvidenceLinks(sessionId: string) {
  const state = useStore(linksStore(sessionId), ['evidence', 'rfi', 'task'])
  return { links: state.data, loaded: state.loaded, available: state.available, error: state.error, refresh: state.refresh }
}

/** Show one filing's votes now (before or after the server answers), for every panel showing it. */
export function setLinkVotes(sessionId: string, linkId: string, votes: { up: number; down: number; my_vote: CopVoteValue }) {
  linksStore(sessionId).patch((links) => links.map((l) => (l.id === linkId ? { ...l, ...votes } : l)))
}

// ── Evidence items (for titles and the "attach from this COP" picker) ──

export interface EvidenceSummary {
  id: string
  title: string
  source_url: string | null
  credibility: string | null
  evidence_type: string | null
  source_channel: string | null
  created_at: string
  /** Collaborators only: where the original lives (Silo / PeerTube) and the scan hold. */
  archive_url: string | null
  archived_in: string | null
  held: boolean
}

const EMPTY_EVIDENCE: EvidenceSummary[] = []

export function useCopEvidenceIndex(sessionId: string) {
  const store = storeFor<EvidenceSummary[]>(`evidence:${sessionId}`, EMPTY_EVIDENCE, async () => {
    const res = await copRequest<{ evidence?: Record<string, unknown>[] }>(`/api/cop/${encodeURIComponent(sessionId)}/evidence`)
    if (res.ok === false) return { ok: false, unavailable: false }
    const rows = Array.isArray(res.data.evidence) ? res.data.evidence : []
    return {
      ok: true,
      data: rows.map((r) => ({
        id: String(r.id),
        title: typeof r.title === 'string' && r.title.trim() ? r.title : 'Untitled evidence',
        source_url: typeof r.source_url === 'string' ? r.source_url : null,
        credibility: typeof r.credibility === 'string' ? r.credibility : null,
        evidence_type: typeof r.evidence_type === 'string' ? r.evidence_type : null,
        source_channel: typeof r.source_channel === 'string' ? r.source_channel : null,
        created_at: typeof r.created_at === 'string' ? r.created_at : '',
        archive_url: typeof r.archive_url === 'string' ? r.archive_url : null,
        archived_in: typeof r.archived_in === 'string' ? r.archived_in : null,
        held: r.held === true,
      })),
    }
  })
  const state = useStore(store, ['evidence', 'upload', 'submission'])
  return { items: state.data, loaded: state.loaded, refresh: state.refresh }
}

// ── Questions (for the feed's picker and filter) ─────────────────

export interface QuestionSummary {
  id: string
  question: string
  is_key: boolean
  status: string
  evidence_count: number
}

const EMPTY_QUESTIONS: QuestionSummary[] = []

export function useCopQuestions(sessionId: string) {
  const store = storeFor<QuestionSummary[]>(`questions:${sessionId}`, EMPTY_QUESTIONS, async () => {
    const res = await copRequest<{ rfis?: Record<string, unknown>[] }>(`/api/cop/${encodeURIComponent(sessionId)}/rfis`)
    if (res.ok === false) return { ok: false, unavailable: false }
    const rows = Array.isArray(res.data.rfis) ? res.data.rfis : []
    const questions = rows.map((r) => ({
      id: String(r.id),
      question: typeof r.question === 'string' ? r.question : '',
      is_key: Number(r.is_key) === 1,
      status: typeof r.status === 'string' ? r.status : 'open',
      evidence_count: Number(r.evidence_count) || 0,
    }))
    // Key questions first, then open before closed, keeping the server's order otherwise.
    questions.sort((a, b) => Number(b.is_key) - Number(a.is_key) || Number(a.status === 'closed') - Number(b.status === 'closed'))
    return { ok: true, data: questions }
  })
  const state = useStore(store, ['rfi', 'session'])
  return { questions: state.data, loaded: state.loaded, refresh: state.refresh }
}
