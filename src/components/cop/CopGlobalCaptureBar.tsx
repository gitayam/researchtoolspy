import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  Link, Brain, Loader2, Sparkles, MapPin, ClipboardList, HelpCircle, ListChecks, Clock, Paperclip, X, Check, ImageUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ENTITY_TYPE_FOR_KIND, HYPOTHESIS_CONFIDENCE, localKindHint, MARKER_CONFIDENCE, MAX_BATCH_LINES, noteTitle, PANEL_FOR_KIND,
  PANEL_LABEL_FOR_KIND, parseCapture, PREFIX_FOR_SUGGESTION, splitCaptureLines, SUGGESTION_LABEL, TAG_TARGET_FOR_KIND,
  withKindPrefix, type CaptureKind, type ParsedCapture,
} from '@/lib/cop-capture'
import { copRequest, createdItemId, notifyCopChanged, NOT_AVAILABLE } from '@/lib/cop-request'
import { MAX_FILES_PER_DROP, pinPhotoPosition, UPLOAD_ACCEPT, uploadProblem, uploadToCop } from '@/lib/cop-upload'
import type { PhotoPosition } from '@/lib/photo-gps'
import TagChips from '@/components/cop/tags/TagChips'
import { tagKey, uniqueTagNames } from '@/components/cop/tags/tag-names'
import type { CopGeocodeResponse, CopSuggestKind, CopSuggestResponse, CopTag } from '@/types/cop'

interface CopGlobalCaptureBarProps {
  sessionId: string
  /** The session's real workspace. A COP session's id and workspace_id are only
   *  the same value for sessions created through /api/cop/sessions; ones created
   *  through /api/workspaces get a UUID workspace and a `cop-` prefixed id. Half
   *  the sessions in production are the second kind, and sending the session id
   *  as the workspace made checkWorkspaceAccess look up a workspace that does not
   *  exist -- so every write from this panel was refused. */
  workspaceId?: string
  onSuccess?: (type: CaptureKind) => void
  /** Bring the panel a capture landed in into view. */
  onJumpToPanel?: (panelId: string) => void
  /** Kept for callers; place pins now come from "Suggest" (a real geocoder), not a regex. */
  onLocationDetected?: (location: string, evidenceId: string) => void
}

type SubmitOutcome =
  | { ok: true; kind: CaptureKind; id: string | null; duplicate: boolean; tagNote: string | null; analysisFailed: boolean; shareUrl: string | null }
  | { ok: false; message: string }

interface RecentCapture {
  kind: CaptureKind
  text: string
  at: number
  tags: string[]
  duplicate: boolean
}

interface UploadRow {
  key: string
  name: string
  status: 'uploading' | 'done' | 'error'
  message?: string
}

interface PhotoOffer {
  key: string
  position: PhotoPosition
  label: string
  evidenceId: string | null
}

interface BatchLine {
  text: string
  status: 'ready' | 'sending' | 'done' | 'error'
  message?: string
}

interface PlaceResult {
  text: string
  displayName: string
  lat: number
  lon: number
  credit: string
}

function captureFailure(status: number, code: string | null, error: string | null): string {
  if (code === NOT_AVAILABLE) return "That isn't available on this server yet."
  if (status === 401) return 'Sign in again to add to this COP.'
  if (status === 403) return 'Only the session owner or an editor can add to this COP.'
  if (status === 404) return 'This COP was not found. It may have been removed, or your access ended.'
  if (status === 429) return 'Too many requests at once. Try again in a minute.'
  if (status === 0) return 'Could not reach the server. Check your connection.'
  return error ?? `Could not add it (HTTP ${status}).`
}

/** What a line becomes, short enough for a phone. */
const KIND_SHORT: Record<CaptureKind, string> = {
  rfi: 'Question', nai: 'Map', task: 'Task', timeline: 'Timeline', survey: 'Form', url: 'Link', hypothesis: 'Hypothesis', note: 'Note',
}

const KIND_ICON: Record<CaptureKind, typeof Link> = {
  rfi: HelpCircle, nai: MapPin, task: ListChecks, timeline: Clock, survey: ClipboardList, url: Link, hypothesis: Brain, note: Sparkles,
}
const KIND_ICON_CLASS: Record<CaptureKind, string> = {
  rfi: 'text-amber-600 dark:text-amber-400',
  nai: 'text-rose-600 dark:text-rose-400',
  task: 'text-indigo-600 dark:text-indigo-400',
  timeline: 'text-sky-600 dark:text-sky-400',
  survey: 'text-cyan-600 dark:text-cyan-400',
  url: 'text-blue-600 dark:text-blue-400',
  hypothesis: 'text-emerald-600 dark:text-emerald-400',
  note: 'text-purple-600 dark:text-purple-400',
}
const KIND_BUTTON_CLASS: Record<CaptureKind, string> = {
  rfi: 'bg-amber-600 hover:bg-amber-700',
  nai: 'bg-rose-600 hover:bg-rose-700',
  task: 'bg-indigo-600 hover:bg-indigo-700',
  timeline: 'bg-sky-600 hover:bg-sky-700',
  survey: 'bg-cyan-600 hover:bg-cyan-700',
  hypothesis: 'bg-emerald-600 hover:bg-emerald-700',
  url: 'bg-blue-600 hover:bg-blue-700',
  note: 'bg-blue-600 hover:bg-blue-700',
}

/** The `#partial` word the caret is in, if any. */
function hashtagAtCaret(text: string, caret: number): { start: number; prefix: string } | null {
  const match = /(?:^|\s)#([\p{L}\p{N}_.-]*)$/u.exec(text.slice(0, caret))
  if (!match) return null
  return { start: caret - match[1].length - 1, prefix: match[1] }
}

export default function CopGlobalCaptureBar({ sessionId, workspaceId, onSuccess, onJumpToPanel }: CopGlobalCaptureBarProps) {
  const copWorkspaceId = workspaceId ?? sessionId
  const base = `/api/cop/${encodeURIComponent(sessionId)}`
  const [input, setInput] = useState('')
  const [caret, setCaret] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** What this analyst has just put in, newest first. A live picture is built
   *  from a stream of small entries, and without a record of the last few there
   *  is no way to tell a capture that worked from one that silently did not. */
  const [captured, setCaptured] = useState<RecentCapture[]>([])
  const [batch, setBatch] = useState<{ raw: string; lines: BatchLine[]; truncated: number } | null>(null)
  const [suggestion, setSuggestion] = useState<CopSuggestResponse | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestAvailable, setSuggestAvailable] = useState(true)
  const [place, setPlace] = useState<PlaceResult | null>(null)
  const [uploads, setUploads] = useState<UploadRow[]>([])
  const [photoOffers, setPhotoOffers] = useState<PhotoOffer[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [vocabulary, setVocabulary] = useState<CopTag[] | null>(null)
  /** Tags chosen from suggestions, added to the next capture alongside its #tags. */
  const [pendingTags, setPendingTags] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = parseCapture(input)
  const kind = parsed?.kind
  const KindIcon = loading ? Loader2 : KIND_ICON[kind ?? 'note']

  // ── Writing one capture ────────────────────────────────────────

  const submitOne = useCallback(async (route: ParsedCapture): Promise<SubmitOutcome> => {
    let endpoint: string
    let body: Record<string, unknown>
    let analysisFailed = false
    const headers = getCopHeaders()

    switch (route.kind) {
      case 'nai': {
        // Two steps, because a named area needs real coordinates and the
        // resolver already understands lat/lon, MGRS and map links.
        const resolved = await fetch('/api/surveys/resolve-location', {
          method: 'POST',
          headers,
          body: JSON.stringify({ input: route.location }),
        }).then(r => r.json()).catch(() => null)
        if (!resolved || typeof resolved.lat !== 'number' || typeof resolved.lon !== 'number') {
          return { ok: false, message: `Could not place "${route.location}". Try 34.05,-118.24, an MGRS grid, or a map link.` }
        }
        endpoint = `${base}/markers`
        body = {
          lat: resolved.lat,
          lon: resolved.lon,
          label: route.body,
          // A reference point, not an area: the marker store holds points.
          cot_type: 'b-m-p-w',
          description: `Named area of interest — ${route.body}`,
          confidence: route.credibility ? MARKER_CONFIDENCE[route.credibility] : 'POSSIBLE',
          source_type: 'MANUAL',
          rationale: 'Captured from the COP capture bar',
          // A named area stays until someone removes it; the route otherwise
          // makes a marker stale after 5 minutes and it drops off the map.
          stale_minutes: null,
        }
        break
      }
      case 'task':
        endpoint = `${base}/tasks`
        body = { title: noteTitle(route.body), description: route.body, priority: route.priority, status: 'todo' }
        break
      case 'timeline':
        endpoint = `${base}/timeline`
        body = {
          title: noteTitle(route.body),
          description: route.body,
          ...(route.eventDate ? { event_date: route.eventDate } : {}),
          category: 'event',
          importance: route.priority === 'critical' ? 'high' : 'normal',
        }
        break
      case 'rfi':
        endpoint = `${base}/rfis`
        body = { question: route.body, priority: route.priority, is_blocker: route.isBlocker }
        break
      case 'survey':
        endpoint = '/api/surveys'
        body = { title: route.body, status: 'active', cop_session_id: sessionId }
        break
      case 'hypothesis':
        endpoint = `${base}/hypotheses`
        body = {
          statement: route.body,
          ...(route.credibility ? { confidence: HYPOTHESIS_CONFIDENCE[route.credibility] } : {}),
        }
        break
      case 'url': {
        // Analyse, then SAVE it to the COP's evidence. Analysis alone used to be
        // all this did, so a link captured here never reached the COP. When the
        // analysis fails the link is still saved; it is the analyst's input.
        let analysis: Record<string, unknown> | null
        try {
          const res = await fetch('/api/content-intelligence/analyze-url', {
            method: 'POST',
            headers: { ...headers, 'X-Workspace-ID': copWorkspaceId },
            body: JSON.stringify({ url: route.url, workspace_id: copWorkspaceId }),
          })
          analysis = res.ok ? await res.json().catch(() => null) : null
        } catch {
          analysis = null
        }
        analysisFailed = !analysis
        const title = typeof analysis?.title === 'string' && analysis.title.trim() ? analysis.title.trim() : route.url!
        const summary = [analysis?.summary, analysis?.description].find(v => typeof v === 'string') as string | undefined
        endpoint = `${base}/evidence`
        body = {
          title: title.slice(0, 300),
          content: summary ?? '',
          url: route.url,
          source_type: 'document',
          confidence: 'medium',
          ...(route.credibility ? { credibility: route.credibility } : {}),
        }
        break
      }
      case 'note':
        // COP-scoped evidence, not the global /api/evidence.
        endpoint = `${base}/evidence`
        body = {
          // The first line, not the first fifty characters: an analyst writes
          // the gist and then the detail, and the gist is the title.
          title: noteTitle(route.body),
          content: route.body,
          source_type: 'observation',
          confidence: 'medium',
          ...(route.credibility ? { credibility: route.credibility } : {}),
        }
        break
    }

    const res = await copRequest<Record<string, unknown>>(endpoint, { method: 'POST', json: body })
    if (res.ok === false) return { ok: false, message: captureFailure(res.status, res.code, res.error) }
    const data = res.data

    let shareUrl: string | null = null
    if (route.kind === 'survey' && typeof data.share_token === 'string') {
      shareUrl = `${window.location.origin}/drop/${encodeURIComponent(data.share_token)}`
      navigator.clipboard.writeText(shareUrl).catch(() => {})
    }

    const id = createdItemId(data)
    const target = TAG_TARGET_FOR_KIND[route.kind]
    let tagNote: string | null = null
    let tagged = false
    if (route.tags?.length && target && id) {
      const tagRes = await copRequest<unknown>(`${base}/item-tags`, {
        method: 'POST',
        newRoute: true,
        json: { target_type: target, target_id: id, tags: route.tags, source: 'user' },
      })
      if (tagRes.ok === true) tagged = true
      else tagNote = tagRes.code === NOT_AVAILABLE ? 'Saved; tags are not available on this server yet.' : `Saved, but the tags were not: ${captureFailure(tagRes.status, tagRes.code, tagRes.error)}`
    }

    notifyCopChanged(tagged ? [ENTITY_TYPE_FOR_KIND[route.kind], 'tag'] : [ENTITY_TYPE_FOR_KIND[route.kind]])
    return { ok: true, kind: route.kind, id, duplicate: data.duplicate === true, tagNote, analysisFailed, shareUrl }
  }, [base, copWorkspaceId, sessionId])

  const remember = (route: ParsedCapture, duplicate: boolean) => {
    setCaptured(prev => [
      { kind: route.kind, text: route.body, at: Date.now() + Math.random(), tags: route.tags ?? [], duplicate },
      ...prev,
    ].slice(0, 4))
  }

  const handleCapture = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return
    const route = parseCapture(trimmed)
    if (!route) {
      setError('Nothing to capture: a prefix or tags on their own need something with them.')
      return
    }
    if (route.problem) {
      setError(route.problem)
      return
    }
    if (pendingTags.length && TAG_TARGET_FOR_KIND[route.kind]) {
      route.tags = uniqueTagNames([...(route.tags ?? []), ...pendingTags])
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    const outcome = await submitOne(route)
    setLoading(false)
    if (outcome.ok === false) {
      setError(outcome.message)
      return
    }
    setInput('')
    setSuggestion(null)
    setPlace(null)
    setPendingTags([])
    remember(route, outcome.duplicate)
    const notes = [
      outcome.duplicate ? 'That link is already in this COP.' : null,
      outcome.analysisFailed ? 'Saved the link; the page could not be analysed.' : null,
      outcome.shareUrl ? `Form link copied: ${outcome.shareUrl}` : null,
      outcome.tagNote,
    ].filter(Boolean)
    setNotice(notes.length ? notes.join(' ') : null)
    onSuccess?.(route.kind)
  }, [input, pendingTags, submitOne, onSuccess])

  // ── Several lines pasted at once ───────────────────────────────

  const runBatch = async () => {
    if (!batch) return
    setLoading(true)
    setError(null)
    let added = 0
    const lines = [...batch.lines]
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].status === 'done') continue
      const route = parseCapture(lines[i].text)
      if (!route || route.problem) {
        lines[i] = { ...lines[i], status: 'error', message: route?.problem ?? 'Nothing to capture on this line.' }
        continue
      }
      lines[i] = { ...lines[i], status: 'sending' }
      setBatch(b => (b ? { ...b, lines: [...lines] } : b))
      const outcome = await submitOne(route)
      if (outcome.ok === true) {
        lines[i] = { ...lines[i], status: 'done', message: outcome.duplicate ? 'already in this COP' : outcome.tagNote ?? undefined }
        added++
        remember(route, outcome.duplicate)
      } else {
        lines[i] = { ...lines[i], status: 'error', message: outcome.message }
      }
      setBatch(b => (b ? { ...b, lines: [...lines] } : b))
    }
    setLoading(false)
    const failed = lines.filter(l => l.status === 'error').length
    if (failed === 0) {
      setBatch(null)
      setNotice(`Added ${added} item${added === 1 ? '' : 's'}.`)
    } else {
      setNotice(`Added ${added}; ${failed} line${failed === 1 ? '' : 's'} could not be added. Fix or remove them, then try again.`)
    }
  }

  // ── Files ───────────────────────────────────────────────────────

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setNotice(null)
    const chosen = files.slice(0, MAX_FILES_PER_DROP)
    const problems = chosen.map(uploadProblem).filter((p): p is string => !!p)
    const ok = chosen.filter(f => !uploadProblem(f))
    if (files.length > MAX_FILES_PER_DROP) problems.push(`Only the first ${MAX_FILES_PER_DROP} files were taken.`)
    if (problems.length) setError(problems.join(' '))
    if (ok.length === 0) return

    // Text already typed becomes the caption (title and tags) of what is dropped.
    const caption = parseCapture(input)
    const captionTitle = caption && caption.kind === 'note' ? noteTitle(caption.body) : undefined
    const captionTags = uniqueTagNames([...(caption?.tags ?? []), ...pendingTags])

    for (const file of ok) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setUploads(prev => [{ key, name: file.name, status: 'uploading' as const }, ...prev].slice(0, 6))
      const res = await uploadToCop(sessionId, file, {
        title: ok.length === 1 ? captionTitle : undefined,
        tags: captionTags,
        evidence: true,
      })
      if (res.ok === false) {
        const message = res.code === NOT_AVAILABLE
          ? "Photo and PDF uploads aren't available on this server yet."
          : captureFailure(res.status, res.code, res.error)
        setUploads(prev => prev.map(u => (u.key === key ? { ...u, status: 'error', message } : u)))
        continue
      }
      setUploads(prev => prev.map(u => (u.key === key ? { ...u, status: 'done' } : u)))
      if (res.data.placedMarker) {
        setNotice(`"${captionTitle ?? file.name}" is on the map as a possible photo location (from its GPS, team only until confirmed).`)
      } else if (res.data.position) {
        setPhotoOffers(prev => [...prev, {
          key,
          position: res.data.position!,
          label: captionTitle ?? file.name,
          evidenceId: res.data.evidenceId,
        }])
      }
    }
    if (caption && ok.length === 1 && caption.kind === 'note') setInput('')
    setPendingTags([])
    onSuccess?.('note')
  }

  const pinOffer = async (offer: PhotoOffer) => {
    const res = await pinPhotoPosition(sessionId, offer.position, offer.label, offer.evidenceId)
    setPhotoOffers(prev => prev.filter(o => o.key !== offer.key))
    if (res.ok === false) setError(captureFailure(res.status, res.code, res.error))
    else setNotice(`Pinned "${offer.label}" where the photo was taken.`)
  }

  // ── Suggestions ─────────────────────────────────────────────────

  const plainText = parsed?.explicit === false && parsed.kind === 'note' ? parsed.body : null
  const localHint = plainText ? localKindHint(plainText) : null

  const askSuggestion = async () => {
    if (!plainText) return
    setSuggesting(true)
    setError(null)
    const res = await copRequest<CopSuggestResponse>(`${base}/suggest`, {
      method: 'POST',
      newRoute: true,
      json: { text: input.trim().slice(0, 2000), want: ['kind', 'tags', 'places'] },
    })
    setSuggesting(false)
    if (res.ok === false) {
      if (res.code === NOT_AVAILABLE) {
        setSuggestAvailable(false)
        setNotice("Suggestions aren't available on this server yet.")
      } else {
        setError(res.status === 429 ? 'Suggestions are busy. Try again in a minute.' : captureFailure(res.status, res.code, res.error))
      }
      return
    }
    setSuggestion({
      kind: res.data.kind ?? null,
      tags: Array.isArray(res.data.tags) ? res.data.tags.slice(0, 5) : [],
      places: Array.isArray(res.data.places) ? res.data.places.slice(0, 3) : [],
    })
  }

  const applyKind = (k: CopSuggestKind) => {
    setInput(prev => withKindPrefix(prev, k))
    setSuggestion(null)
    inputRef.current?.focus()
  }

  const addSuggestedTag = (name: string) => {
    setPendingTags(prev => uniqueTagNames([...prev, name]))
    inputRef.current?.focus()
  }

  const lookUpPlace = async (p: { text: string; query: string }) => {
    setError(null)
    const res = await copRequest<CopGeocodeResponse>(`${base}/geocode?q=${encodeURIComponent(p.query)}`, { newRoute: true })
    if (res.ok === false) {
      setError(res.code === NOT_AVAILABLE ? "Place search isn't available on this server yet." : captureFailure(res.status, res.code, res.error))
      return
    }
    const top = res.data.results?.[0]
    if (!top || !Number.isFinite(top.lat) || !Number.isFinite(top.lon)) {
      setError(`Could not find "${p.text}" on the map.`)
      return
    }
    setPlace({
      text: p.text,
      displayName: top.display_name,
      lat: top.lat,
      lon: top.lon,
      credit: res.data.geocoder_attribution ?? '© OpenStreetMap contributors',
    })
  }

  const pinPlace = async () => {
    if (!place) return
    const res = await copRequest<unknown>(`${base}/markers`, {
      method: 'POST',
      json: {
        lat: place.lat,
        lon: place.lon,
        label: place.text.slice(0, 120),
        description: place.displayName.slice(0, 500),
        cot_type: 'b-m-p-w',
        confidence: 'POSSIBLE',
        source_type: 'MANUAL',
        rationale: 'Place named in a capture, found with the map search',
        stale_minutes: null,
      },
    })
    if (res.ok === false) {
      setError(captureFailure(res.status, res.code, res.error))
      return
    }
    notifyCopChanged(['marker'])
    setNotice(`Put "${place.text}" on the map.`)
    setPlace(null)
  }

  // ── #tag autocomplete from the session's vocabulary ─────────────

  const tagAtCaret = hashtagAtCaret(input, caret)
  const loadVocabulary = useCallback(async () => {
    if (vocabulary) return
    const res = await copRequest<{ tags?: CopTag[] }>(`${base}/tags`, { newRoute: true })
    setVocabulary(res.ok === true && Array.isArray(res.data.tags) ? res.data.tags : [])
  }, [base, vocabulary])

  const tagMatches = useMemo(() => {
    if (!tagAtCaret || !vocabulary?.length) return []
    const needle = tagAtCaret.prefix.toLowerCase()
    return vocabulary
      // A name with a space cannot be written as a #word; those are added with the tag picker.
      .filter(t => !/\s/.test(t.name) && t.name.toLowerCase().startsWith(needle) && tagKey(t.name) !== needle)
      .slice(0, 6)
  }, [tagAtCaret, vocabulary])

  const completeTag = (name: string) => {
    if (!tagAtCaret) return
    const token = `#${name} `
    const next = input.slice(0, tagAtCaret.start) + token + input.slice(caret)
    setInput(next)
    const at = tagAtCaret.start + token.length
    setCaret(at)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(at, at)
    })
  }

  // ── Input events ────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends; Shift+Enter is the newline, as in every chat client.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCapture()
    }
    if (e.key === 'Escape') inputRef.current?.blur()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files ?? [])
    if (files.length) {
      e.preventDefault()
      handleFiles(files)
      return
    }
    const text = e.clipboardData.getData('text/plain')
    const lines = splitCaptureLines(text)
    const el = e.currentTarget
    const replacingAll = !input.trim() || (el.selectionStart === 0 && el.selectionEnd === input.length)
    if (lines.length >= 2 && replacingAll) {
      // Several lines: ask whether they are separate items or one note.
      e.preventDefault()
      setBatch({
        raw: text,
        lines: lines.slice(0, MAX_BATCH_LINES).map(t => ({ text: t, status: 'ready' as const })),
        truncated: Math.max(0, lines.length - MAX_BATCH_LINES),
      })
      setError(null)
      setNotice(null)
    }
  }

  // "/" focuses the bar, as long as the analyst is not already typing somewhere.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (typing) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

  return (
    <div
      className="sticky top-0 z-30 border-b border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:px-4"
      onDragEnter={e => { if (hasFiles(e)) { e.preventDefault(); setDragActive(true) } }}
      onDragOver={e => { if (hasFiles(e)) e.preventDefault() }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragActive(false) }}
      onDrop={e => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setDragActive(false)
        handleFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="relative mx-auto flex max-w-5xl flex-col gap-1.5">
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-500 bg-blue-50 text-sm font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            Drop photos or PDFs to add them as evidence
          </div>
        )}

        <div className="relative flex items-center gap-2">
          <div className="pointer-events-none absolute left-3 flex items-center">
            <KindIcon className={cn('h-4 w-4', loading ? 'animate-spin text-blue-600' : KIND_ICON_CLASS[kind ?? 'note'])} aria-hidden="true" />
          </div>

          {/* A textarea: an observation is often two sentences. It grows to a few
              lines and then scrolls. */}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setCaret(e.target.selectionStart ?? e.target.value.length)
              setSuggestion(null)
              if (/(?:^|\s)#[\p{L}\p{N}_.-]*$/u.test(e.target.value.slice(0, e.target.selectionStart ?? undefined))) loadVocabulary()
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            aria-label="Capture to the COP"
            aria-describedby="cop-capture-help"
            placeholder="Note, link, photo, #tag"
            className={cn(
              'max-h-32 min-h-11 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-[7.5rem] text-base text-gray-900 placeholder:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400 sm:text-sm',
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                handleFiles(files)
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Add a photo or PDF"
              title="Add a photo or PDF (or paste / drop one)"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-300 dark:hover:bg-gray-700 after:absolute after:-inset-1 after:content-['']"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>
            <Button
              size="sm"
              onClick={handleCapture}
              disabled={loading || !input.trim()}
              className={cn(
                'relative h-9 cursor-pointer px-3 text-xs font-semibold text-white sm:h-8 after:absolute after:-inset-1 after:content-[\'\']',
                KIND_BUTTON_CLASS[kind ?? 'note'],
              )}
            >
              {loading ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>

        {tagMatches.length > 0 && (
          <div className="ml-10 flex flex-wrap items-center gap-1.5" role="group" aria-label="Tags in this COP">
            {tagMatches.map(t => (
              <button
                key={t.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => completeTag(t.name)}
                className="inline-flex min-h-9 items-center rounded-full border border-gray-300 px-3 text-xs text-gray-800 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                #{t.name}
                <span className="ml-1 tabular-nums text-gray-500 dark:text-gray-400">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="ml-10 text-xs font-medium text-red-700 dark:text-red-400" role="alert">{error}</p>
        )}
        {notice && !error && (
          <p className="ml-10 text-xs text-gray-700 dark:text-gray-300" role="status">{notice}</p>
        )}

        {parsed && !loading && !batch && (
          <div id="cop-capture-help" className="ml-10 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Goes to: <span className="font-semibold text-gray-800 dark:text-gray-200">{parsed.label}</span>
            </span>
            {parsed.tags && parsed.tags.length > 0 && <TagChips tags={parsed.tags} />}
            {pendingTags.length > 0 && TAG_TARGET_FOR_KIND[parsed.kind] && (
              <TagChips tags={pendingTags} onRemove={name => setPendingTags(prev => prev.filter(t => tagKey(t) !== tagKey(name)))} />
            )}
            {parsed.problem && (
              <span className="text-xs font-medium text-amber-800 dark:text-amber-400">{parsed.problem}</span>
            )}
            <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">Enter adds · Shift+Enter new line</span>
          </div>
        )}
        {!parsed && <span id="cop-capture-help" className="sr-only">Type a note, paste a link or photo, or start with rfi:, task:, t: or nai:. Add #tags anywhere.</span>}

        {/* One-tap ways to file plain text as something more specific. Nothing
            is routed until the analyst taps and then adds. */}
        {plainText && !loading && !batch && (localHint || suggestAvailable || suggestion) && (
          <div className="ml-10 flex flex-wrap items-center gap-1.5">
            {localHint && PREFIX_FOR_SUGGESTION[localHint] && suggestion?.kind?.value !== localHint && (
              <SuggestChip onClick={() => applyKind(localHint)}>{SUGGESTION_LABEL[localHint]}?</SuggestChip>
            )}
            {suggestion?.kind && PREFIX_FOR_SUGGESTION[suggestion.kind.value] && (
              <SuggestChip onClick={() => applyKind(suggestion.kind!.value)} ai>{SUGGESTION_LABEL[suggestion.kind.value]}</SuggestChip>
            )}
            {suggestion?.tags.map(name => (
              <SuggestChip key={name} onClick={() => addSuggestedTag(name)} ai>+#{name}</SuggestChip>
            ))}
            {suggestion?.places.map(p => (
              <SuggestChip key={p.query} onClick={() => lookUpPlace(p)} ai>
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Find "{p.text}"
              </SuggestChip>
            ))}
            {suggestion && !suggestion.kind && suggestion.tags.length === 0 && suggestion.places.length === 0 && (
              <span className="text-xs text-gray-600 dark:text-gray-400">No suggestion: it reads as a plain note.</span>
            )}
            {suggestAvailable && !suggestion && (
              <button
                type="button"
                onClick={askSuggestion}
                disabled={suggesting}
                title="Ask for a kind, matching tags from this COP, and places to pin (uses AI)"
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-purple-800 hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500 disabled:opacity-60 dark:text-purple-300 dark:hover:bg-purple-950"
              >
                {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                Suggest
              </button>
            )}
          </div>
        )}

        {place && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-200 sm:ml-10">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
              <span className="font-semibold">{place.text}</span>: {place.displayName}{' '}
              <span className="tabular-nums">({place.lat.toFixed(5)}, {place.lon.toFixed(5)})</span>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="ml-2 underline decoration-dotted"
              >
                {place.credit}
              </a>
            </span>
            <button type="button" onClick={pinPlace} className="min-h-9 rounded-md bg-emerald-700 px-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
              Put on the map
            </button>
            <IconButton label="Dismiss" onClick={() => setPlace(null)}><X className="h-4 w-4" aria-hidden="true" /></IconButton>
          </div>
        )}

        {batch && (
          <section className="rounded-lg border sm:ml-10 border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800" aria-label="Pasted lines">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {batch.lines.length} lines pasted. Add each line as its own item?
            </p>
            {batch.truncated > 0 && (
              <p className="text-xs text-amber-800 dark:text-amber-400">Only the first {MAX_BATCH_LINES} lines; {batch.truncated} more were left out.</p>
            )}
            <ol className="mt-1.5 max-h-56 space-y-1 overflow-y-auto">
              {batch.lines.map((line, i) => {
                const route = parseCapture(line.text)
                return (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-20 shrink-0 font-semibold text-gray-700 dark:text-gray-300">
                      {route ? KIND_SHORT[route.kind] : 'Nothing'}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-gray-900 dark:text-gray-100">
                      {route?.body ?? line.text}
                      {route?.tags?.length ? <TagChips tags={route.tags} className="mt-0.5" /> : null}
                      {line.message && (
                        <span className={cn('block', line.status === 'error' ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400')}>{line.message}</span>
                      )}
                    </span>
                    <span className="shrink-0" aria-label={line.status}>
                      {line.status === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden="true" />}
                      {line.status === 'done' && <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />}
                      {line.status === 'error' && <X className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />}
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runBatch}
                disabled={loading}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Add {batch.lines.filter(l => l.status !== 'done').length} items
              </button>
              <button
                type="button"
                onClick={() => { setInput(batch.raw.trim()); setBatch(null); inputRef.current?.focus() }}
                disabled={loading}
                className="min-h-11 rounded-md px-3 text-sm text-gray-800 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Paste as one note
              </button>
              <button
                type="button"
                onClick={() => setBatch(null)}
                disabled={loading}
                className="min-h-11 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {(uploads.length > 0 || photoOffers.length > 0) && (
          <div className="space-y-1 sm:ml-10">
            {uploads.map(u => (
              <div key={u.key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                {u.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" aria-hidden="true" />}
                {u.status === 'done' && <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />}
                {u.status === 'error' && <X className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />}
                <span className="truncate">{u.name}</span>
                <span className={cn('shrink-0', u.status === 'error' && 'text-red-700 dark:text-red-400')}>
                  {u.status === 'uploading' ? 'adding…' : u.status === 'done' ? 'added to evidence' : u.message}
                </span>
              </div>
            ))}
            {photoOffers.map(offer => (
              <div key={offer.key} className="flex flex-wrap items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs text-sky-950 dark:border-sky-500/40 dark:bg-sky-950 dark:text-sky-100" role="status">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
                  "{offer.label}" says where it was taken
                  <span className="tabular-nums"> ({offer.position.lat.toFixed(5)}, {offer.position.lon.toFixed(5)})</span>.
                  Pin it on the map? The team's copy keeps its location; share links never show it.
                </span>
                <button type="button" onClick={() => pinOffer(offer)} className="min-h-9 rounded-md bg-sky-700 px-3 font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                  Pin it
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoOffers(prev => prev.filter(o => o.key !== offer.key))}
                  className="min-h-9 rounded-md px-3 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 dark:hover:bg-sky-900"
                >
                  No
                </button>
              </div>
            ))}
          </div>
        )}

        {/* The prefixes, shown rather than described. */}
        {!input.trim() && !loading && !batch && (
          <div className="-mx-2 flex items-center gap-2 overflow-x-auto px-2 pb-0.5 sm:mx-0 sm:ml-10 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label="Shortcuts">
            {[
              { prefix: 'rfi:', meaning: 'question', extra: '! or !! to raise priority' },
              { prefix: 'nai:', meaning: 'named area', extra: 'start with 34.05,-118.24, an MGRS grid, or a map link' },
              { prefix: 'task:', meaning: 'task', extra: '! or !! to raise priority' },
              { prefix: 't:', meaning: 'timeline', extra: 'optionally lead with YYYY-MM-DD' },
              { prefix: 'hyp:', meaning: 'hypothesis' },
              { prefix: 'survey:', meaning: 'collection form' },
              { prefix: '~confirmed', meaning: 'how corroborated', extra: 'end any capture with ~confirmed, ~probable, ~possible or ~doubtful' },
              { prefix: '#tag', meaning: 'tag it', extra: 'add #words anywhere; they become tags on what you add' },
            ].map(hint => (
              <button
                key={hint.prefix}
                type="button"
                onClick={() => {
                  // Qualifiers go at the end of what is already written; every
                  // other hint starts a line.
                  setInput(prev => (hint.prefix.startsWith('~') || hint.prefix.startsWith('#'))
                    ? `${prev.trimEnd()} ${hint.prefix.startsWith('#') ? '#' : hint.prefix + ' '}`.trimStart()
                    : `${hint.prefix} `)
                  inputRef.current?.focus()
                }}
                title={hint.extra ? `${hint.meaning}: ${hint.extra}` : hint.meaning}
                className="min-h-9 shrink-0 rounded border border-gray-300 px-2 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200 sm:min-h-0 sm:px-1.5 sm:py-0.5"
              >
                <span className="font-mono font-semibold">{hint.prefix}</span>{' '}
                <span>{hint.meaning}</span>
              </button>
            ))}
          </div>
        )}

        {/* What just went in, each linking to the panel it landed in. */}
        {captured.length > 0 && (
          <ul className="ml-10 space-y-0.5" aria-label="Recently added">
            {captured.map(entry => (
              <li key={entry.at}>
                <button
                  type="button"
                  onClick={() => onJumpToPanel?.(PANEL_FOR_KIND[entry.kind])}
                  disabled={!onJumpToPanel}
                  title={`Go to ${PANEL_LABEL_FOR_KIND[entry.kind]}`}
                  className={cn(
                    'flex min-h-8 w-full items-center gap-2 rounded px-1 text-left text-xs text-gray-600 dark:text-gray-400',
                    onJumpToPanel && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  <span className={cn('shrink-0 font-semibold uppercase', KIND_ICON_CLASS[entry.kind])}>{entry.kind}</span>
                  <span className="truncate">{entry.text}</span>
                  {entry.tags.length > 0 && <TagChips tags={entry.tags} max={2} className="hidden shrink-0 sm:flex" />}
                  {entry.duplicate && <span className="shrink-0 text-amber-800 dark:text-amber-400">already there</span>}
                  {onJumpToPanel && (
                    <span className="ml-auto hidden shrink-0 text-gray-500 dark:text-gray-500 sm:inline">
                      {PANEL_LABEL_FOR_KIND[entry.kind]} &rarr;
                    </span>
                  )}
                  <time className={cn('shrink-0 tabular-nums', !onJumpToPanel && 'ml-auto')} dateTime={new Date(entry.at).toISOString()}>
                    {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SuggestChip({ children, onClick, ai }: { children: React.ReactNode; onClick: () => void; ai?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={ai ? 'Suggested by AI from this COP; check it' : 'Suggested from the wording'}
      className={cn(
        'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
        ai
          ? 'border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-950 dark:text-purple-100 dark:hover:bg-purple-900'
          : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
      )}
    >
      {ai && <Sparkles className="h-3 w-3" aria-hidden="true" />}
      {children}
    </button>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-white/10"
    >
      {children}
    </button>
  )
}
