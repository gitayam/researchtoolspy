/**
 * Public COP View Page
 *
 * Read-only shared COP view at /public/cop/:token: the map plus the panels the
 * share link allows (brief, feed, questions, cams).
 *
 * Layout:
 *   - phones: the map fills the screen under a compact top bar; the panels open
 *     in a side menu (menu button, or drag right across the top bar).
 *   - tablet/desktop: panels in a side column beside the map.
 * Panels only appear when they have something to show or a real empty state;
 * there are no placeholder tabs. Key questions are starred RFIs, in one
 * Questions tab. When the share allows it (`evidence_form`), "Submit evidence"
 * opens the evidence form in place. Changes arrive through the public changes
 * feed (or a full reload every minute on servers without it).
 */

import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2,
  Layers,
  ClipboardList,
  HelpCircle,
  Star,
  Eye,
  Send,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Link2,
  Video,
  Menu,
  Newspaper,
  FilePlus2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import CopMap from '@/components/cop/CopMap'
import CopCamGrid from '@/components/cop/cams/CopCamGrid'
import { getLayerById } from '@/components/cop/CopLayerCatalog'
import CopSideMenu from '@/components/cop/shell/CopSideMenu'
import EvidenceSubmitSheet from '@/components/cop/shell/EvidenceSubmitSheet'
import { useIsPhone } from '@/components/cop/shell/useMediaQuery'
import { usePublicCopChanges, type ChangeMode } from '@/components/cop/shell/usePublicCopChanges'
import { splitKeyQuestions, type QuestionLike } from '@/components/cop/shell/key-questions'
import { RelationChip } from '@/components/cop/evidence-links/RelationChip'
import { cn } from '@/lib/utils'
import type {
  CopSession,
  CopFeatureCollection,
  CopLayerDef,
  CopPublicFiledEvidence,
  CopRfi,
  CopWebcam,
  EventFact,
} from '@/types/cop'
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  RFI_PRIORITY_COLORS,
} from '@/types/cop'

// ── Types ────────────────────────────────────────────────────────

/** Evidence filed under a question: the count always, the items only with the evidence panel. */
type FiledOnShare = { evidence_count?: number; evidence?: CopPublicFiledEvidence[] }
type PublicRfi = CopRfi & QuestionLike & { answer_count?: number } & FiledOnShare

/** A starred RFI as the share sends it with the `questions` panel. */
interface PublicKeyRfi extends FiledOnShare {
  id: string
  question: string
  status: CopRfi['status']
  priority: CopRfi['priority']
  answer_count?: number
}

/** An evidence item as the share sends it with the feed panel. */
interface PublicEvidence {
  id: string | number
  title: string
  description?: string | null
  source_url?: string | null
  source_channel?: string | null
  credibility?: string | null
  created_at?: string | null
}

interface PublicEvidenceForm {
  token: string
  title?: string | null
  require_location?: boolean
  require_contact?: boolean
}

interface PublicCopData {
  session: CopSession
  visible_panels: string[]
  allow_rfi_answers: boolean
  rfis?: PublicRfi[]
  key_rfis?: PublicKeyRfi[]
  evidence?: PublicEvidence[]
  evidence_form?: PublicEvidenceForm | null
  /** Present only when the share shows the cams panel. */
  webcams?: CopWebcam[]
}

type PanelId = 'brief' | 'feed' | 'questions' | 'cams'

// ── Template labels ──────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
}

/** Map layers that a change to an entity type can affect. */
const LAYERS_BY_ENTITY: Record<string, string[]> = {
  marker: ['cop-markers'],
  webcam: ['webcams'],
  poo: ['poo-estimates'],
  asset: ['assets'],
  evidence: ['places', 'events', 'actors', 'relationships'],
  persona: ['actors', 'relationships'],
}

const CHANNEL_LABELS: Record<string, string> = {
  signal: 'Signal room',
  drop: 'Evidence form',
  web: 'Analyst',
  scrape: 'Collected',
  api: 'Integration',
}

const isHttpsUrl = (url: string | null | undefined): url is string => {
  if (!url) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

const HIGHLIGHT_MS = 8_000

// ── Component ────────────────────────────────────────────────────

export default function PublicCopPage() {
  const { token } = useParams<{ token: string }>()
  const isPhone = useIsPhone()

  const [data, setData] = useState<PublicCopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [layerData, setLayerData] = useState<Record<string, CopFeatureCollection>>({})
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [focusCamId, setFocusCamId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [highlightEvidenceId, setHighlightEvidenceId] = useState<string | null>(null)

  // RFI answer form state
  const [answerFormRfiId, setAnswerFormRfiId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [answerSourceUrl, setAnswerSourceUrl] = useState('')
  const [responderName, setResponderName] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [answerError, setAnswerError] = useState<string | null>(null)

  // Expanded RFI tracking
  const [expandedRfis, setExpandedRfis] = useState<Set<string>>(new Set())

  const topBarRef = useRef<HTMLElement>(null)

  // ── Fetch shared data ──────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/cop/public/${token}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('This shared COP link is invalid or has expired.')
        throw new Error(`Failed to load (${res.status})`)
      }
      const json = (await res.json()) as PublicCopData
      setData(json)
      setError(null)
    } catch (err) {
      // Keep showing what loaded before; only a first load turns into the error screen.
      setError(err instanceof Error ? err.message : 'Failed to load shared COP')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Fetch layer data ───────────────────────────────────────────

  const sessionId = data?.session?.id
  const fetchLayerData = useCallback(
    async (layerDef: CopLayerDef) => {
      if (!sessionId) return
      if (layerDef.source.type === 'static') return
      try {
        // The share token lets layers load for a private session shared with this link.
        const endpoint = `/api/cop/${sessionId}${layerDef.source.endpoint}`
        const url = new URL(endpoint, window.location.origin)
        if (token) url.searchParams.set('share', token)
        const res = await fetch(`${url.pathname}${url.search}`)
        if (!res.ok) return
        const fc: CopFeatureCollection = await res.json()
        setLayerData(prev => ({ ...prev, [layerDef.id]: fc }))
      } catch {
        // Silently skip
      }
    },
    [sessionId, token]
  )

  const activeLayerKey = JSON.stringify(data?.session?.active_layers ?? [])
  const refetchLayers = useCallback(
    (only?: Set<string>) => {
      const ids: string[] = JSON.parse(activeLayerKey)
      return Promise.allSettled(
        ids
          .filter((id) => !only || only.has(id))
          .map(getLayerById)
          .filter((l): l is CopLayerDef => l != null)
          .map(fetchLayerData),
      )
    },
    [activeLayerKey, fetchLayerData],
  )

  useEffect(() => {
    if (sessionId) refetchLayers()
  }, [sessionId, refetchLayers])

  // ── Live changes ───────────────────────────────────────────────

  const { mode: changeMode } = usePublicCopChanges(token, !!data, (types) => {
    fetchData()
    if (types.has('*') || types.has('session')) {
      refetchLayers()
      return
    }
    const layers = new Set<string>()
    for (const type of types) for (const id of LAYERS_BY_ENTITY[type] ?? []) layers.add(id)
    if (layers.size) refetchLayers(layers)
  })

  // ── Submit RFI answer ──────────────────────────────────────────

  const handleSubmitAnswer = useCallback(async (rfiId: string) => {
    if (!token || !answerText.trim()) return
    setSubmittingAnswer(true)
    setAnswerError(null)
    try {
      const res = await fetch(`/api/cop/public/${token}/rfis/${rfiId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer_text: answerText.trim(),
          source_url: answerSourceUrl.trim() || undefined,
          responder_name: responderName.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? 'Failed to submit answer')
      }
      setAnswerText('')
      setAnswerSourceUrl('')
      setAnswerFormRfiId(null)
      fetchData()
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : 'Failed to submit answer')
    } finally {
      setSubmittingAnswer(false)
    }
  }, [token, answerText, answerSourceUrl, responderName, fetchData])

  const toggleRfiExpand = (rfiId: string) => {
    setExpandedRfis(prev => {
      const next = new Set(prev)
      if (next.has(rfiId)) next.delete(rfiId)
      else next.add(rfiId)
      return next
    })
  }

  // ── Derived panels ─────────────────────────────────────────────

  const visiblePanels = useMemo(() => data?.visible_panels ?? [], [data?.visible_panels])
  const session = data?.session
  const eventType = (session?.event_type ?? null) as keyof typeof EVENT_TYPE_LABELS | null
  const hasBrief = !!session && visiblePanels.includes('event')
    && !!(eventType || session.event_description || (session.event_facts?.length ?? 0) > 0)
  const evidence = Array.isArray(data?.evidence) ? data!.evidence : null
  const showsQuestions = visiblePanels.includes('rfi') || visiblePanels.includes('questions')
  const showsCams = visiblePanels.includes('cams')

  const questions = useMemo(() => {
    const rfis: PublicRfi[] = [...(data?.rfis ?? [])]
    // Starred RFIs the share sends with the questions panel, when the RFI list itself isn't shared.
    for (const keyRfi of data?.key_rfis ?? []) {
      if (!rfis.some((r) => r.id === keyRfi.id)) {
        rfis.push({ ...(keyRfi as unknown as PublicRfi), is_key: 1, answers: [] })
      }
    }
    const keyStrings = visiblePanels.includes('questions') ? (data?.session?.key_questions ?? []) : []
    return splitKeyQuestions(rfis, data?.key_rfis ? [] : keyStrings)
  }, [data, visiblePanels])
  const openQuestionCount = [...questions.key, ...questions.others].filter((r) => r.status === 'open').length

  const panels = useMemo(() => {
    const list: { id: PanelId; label: string; icon: typeof Layers; count?: number }[] = []
    if (hasBrief) list.push({ id: 'brief', label: 'Brief', icon: ClipboardList })
    if (evidence) list.push({ id: 'feed', label: 'Feed', icon: Newspaper, count: evidence.length })
    if (showsQuestions) list.push({ id: 'questions', label: 'Questions', icon: HelpCircle, count: openQuestionCount + questions.untracked.length })
    if (showsCams) list.push({ id: 'cams', label: 'Cams', icon: Video, count: data?.webcams?.length ?? 0 })
    return list
  }, [hasBrief, evidence, showsQuestions, openQuestionCount, questions.untracked.length, showsCams, data?.webcams?.length])

  // Until someone picks a tab, show the first panel with something in it.
  const defaultPanel = useMemo<PanelId | null>(() => {
    if (!panels.length) return null
    return (panels.find((p) => p.id === 'brief' || (p.count ?? 0) > 0) ?? panels[0]).id
  }, [panels])
  const shownPanel: PanelId | null = activePanel && panels.some((p) => p.id === activePanel) ? activePanel : defaultPanel

  // A just-submitted item stays highlighted for a few seconds once it shows up.
  useEffect(() => {
    if (!highlightEvidenceId) return
    const timer = setTimeout(() => setHighlightEvidenceId(null), HIGHLIGHT_MS + 30_000)
    return () => clearTimeout(timer)
  }, [highlightEvidenceId])

  // ── Loading / error ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-hidden="true" />
        <span className="sr-only">Loading the shared COP…</span>
      </div>
    )
  }

  if (!data || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-700">
          <CardContent className="p-6 text-center">
            <Eye className="h-12 w-12 text-gray-500 mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-gray-200 mb-2">Shared COP not found</h1>
            <p className="text-sm text-gray-400">{error ?? 'This link may have expired.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { allow_rfi_answers, webcams } = data
  const evidenceForm = data.evidence_form?.token ? data.evidence_form : null
  const hasPanels = panels.length > 0

  // ── Panels ─────────────────────────────────────────────────────

  function renderBrief() {
    if (!session) return null
    return (
      <div className="p-4 space-y-4">
        {eventType && (
          <Badge
            className="text-white text-xs"
            style={{ backgroundColor: EVENT_TYPE_COLORS[eventType] ?? '#6b7280' }}
          >
            {EVENT_TYPE_LABELS[eventType] ?? eventType}
          </Badge>
        )}
        {session.event_description && (
          <p className="text-sm text-gray-300 leading-relaxed">{session.event_description}</p>
        )}
        {(session.event_facts?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Key facts</h3>
            {(session.event_facts as EventFact[]).map((fact, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-gray-500 font-mono shrink-0 w-14">{fact.time}</span>
                <span className="text-gray-300">{fact.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderFeed() {
    if (!evidence?.length) {
      return (
        <EmptyState icon={Newspaper} title="No evidence yet">
          Links and photos posted in the Signal room{evidenceForm ? ', and anything sent with Submit evidence,' : ''} appear here as they arrive.
        </EmptyState>
      )
    }
    return (
      <ul className="p-3 space-y-2">
        {evidence.map((item) => {
          const highlighted = highlightEvidenceId != null && String(item.id) === highlightEvidenceId
          const channel = item.source_channel ? CHANNEL_LABELS[item.source_channel] ?? null : null
          return (
            <li
              key={item.id}
              ref={highlighted ? (el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : undefined}
              className={cn(
                'rounded-lg border bg-gray-800/50 p-3 transition-colors',
                highlighted ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-gray-700',
              )}
            >
              <p className="text-sm text-gray-100 leading-snug">{item.title}</p>
              {item.description && <p className="mt-1 text-xs text-gray-400 line-clamp-3">{item.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {channel && <span>{channel}</span>}
                {(!item.credibility || item.credibility === 'unverified') && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Unverified</span>
                )}
                {item.created_at && <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>}
                {isHttpsUrl(item.source_url) && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="inline-flex min-h-11 items-center gap-1 text-blue-400 hover:text-blue-300 md:min-h-0"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Source
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  /** What has been filed under a question: the items with the evidence panel, else the count. */
  function renderFiledEvidence(rfi: PublicRfi) {
    const count = rfi.evidence_count ?? 0
    if (!Array.isArray(rfi.evidence)) {
      return count > 0
        ? <p className="text-xs text-gray-400">{count} evidence item{count !== 1 ? 's' : ''} filed under this question.</p>
        : null
    }
    if (rfi.evidence.length === 0) return <p className="text-xs text-gray-500">No evidence filed under this question yet.</p>
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-300">Evidence filed under this question</p>
        <ul className="space-y-1.5">
          {rfi.evidence.map((item, i) => (
            <li key={`${item.created_at}-${i}`} className="flex items-start gap-2 rounded-md bg-gray-800 p-2">
              <RelationChip relation={item.relation} onDark className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-gray-200">{item.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {item.credibility && <span>{item.credibility}</span>}
                  {item.created_at && <span>{new Date(item.created_at).toLocaleString()}</span>}
                  {isHttpsUrl(item.url) && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex min-h-11 items-center gap-1 text-blue-400 hover:text-blue-300 sm:min-h-0"
                    >
                      <Link2 className="h-3 w-3" aria-hidden="true" />
                      Source
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {count > rfi.evidence.length && (
          <p className="text-xs text-gray-500">Showing the newest {rfi.evidence.length} of {count}.</p>
        )}
      </div>
    )
  }

  function renderRfi(rfi: PublicRfi, starred: boolean) {
    const isExpanded = expandedRfis.has(rfi.id)
    const priorityColor = RFI_PRIORITY_COLORS[rfi.priority] ?? '#6b7280'
    const answers = rfi.answers ?? []
    const answerCount = answers.length || rfi.answer_count || 0
    const canAnswer = allow_rfi_answers && rfi.status !== 'closed' && rfi.status !== 'accepted'
    const panelId = `rfi-${rfi.id}`

    return (
      <li key={rfi.id} className="rounded-lg border border-gray-700 bg-gray-800/50">
        <button
          type="button"
          onClick={() => toggleRfiExpand(rfi.id)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className="w-full min-h-11 flex items-start gap-2 p-3 text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-100 leading-snug">
              {starred && <Star className="inline h-3.5 w-3.5 mr-1 -mt-0.5 fill-amber-400 text-amber-400" aria-label="Key question" />}
              {rfi.question}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
              <span className="inline-flex items-center gap-1 text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: priorityColor }} aria-hidden="true" />
                {rfi.priority}
              </span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5',
                  rfi.status === 'accepted'
                    ? 'bg-green-500/20 text-green-300'
                    : rfi.status === 'answered'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-gray-700 text-gray-300',
                )}
              >
                {rfi.status}
              </span>
              {(rfi.evidence_count ?? 0) > 0 && (
                <span className="text-gray-300">{rfi.evidence_count} evidence</span>
              )}
              {answerCount > 0 && (
                <span className="text-gray-400">{answerCount} answer{answerCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div id={panelId} className="border-t border-gray-700 px-3 py-3 space-y-2">
            {renderFiledEvidence(rfi)}
            {answers.length === 0 && (
              <p className="text-xs text-gray-500">No answers yet.</p>
            )}
            {answers.map(answer => (
              <div key={answer.id} className="rounded-md bg-gray-800 p-2.5 space-y-1">
                <p className="text-sm text-gray-200">{answer.answer_text}</p>
                {isHttpsUrl(answer.source_url) && (
                  <a
                    href={answer.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Link2 className="h-3 w-3" aria-hidden="true" />
                    Source
                  </a>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{answer.responder_name ?? 'Anonymous'}</span>
                  <span>{new Date(answer.created_at).toLocaleString()}</span>
                  {answer.is_accepted === 1 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" aria-label="Accepted" />
                  )}
                </div>
              </div>
            ))}

            {canAnswer && (answerFormRfiId === rfi.id ? (
              <div className="space-y-2 pt-1">
                <label className="block text-xs text-gray-400" htmlFor={`${panelId}-name`}>Your name (optional)</label>
                <input
                  id={`${panelId}-name`}
                  type="text"
                  value={responderName}
                  onChange={e => setResponderName(e.target.value)}
                  autoComplete="nickname"
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-base md:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="block text-xs text-gray-400" htmlFor={`${panelId}-answer`}>Your answer</label>
                <textarea
                  id={`${panelId}-answer`}
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-base md:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <label className="block text-xs text-gray-400" htmlFor={`${panelId}-source`}>Source link (optional)</label>
                <input
                  id={`${panelId}-source`}
                  type="url"
                  inputMode="url"
                  value={answerSourceUrl}
                  onChange={e => setAnswerSourceUrl(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-base md:text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {answerError && <p className="text-xs text-red-400" role="alert">{answerError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSubmitAnswer(rfi.id)}
                    disabled={!answerText.trim() || submittingAnswer}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                  >
                    {submittingAnswer ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    Send answer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnswerFormRfiId(null)
                      setAnswerText('')
                      setAnswerSourceUrl('')
                      setAnswerError(null)
                    }}
                    className="min-h-11 rounded-lg px-4 text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAnswerFormRfiId(rfi.id); setAnswerError(null) }}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
              >
                Answer this question
              </button>
            ))}
          </div>
        )}
      </li>
    )
  }

  function renderQuestions() {
    const { key, others, untracked } = questions
    if (!key.length && !others.length && !untracked.length) {
      return (
        <EmptyState icon={HelpCircle} title="No questions yet">
          The operation's key questions, and questions asked in the Signal room with !question, appear here.
        </EmptyState>
      )
    }
    return (
      <div className="p-3 space-y-4">
        {(key.length > 0 || untracked.length > 0) && (
          <section aria-labelledby="key-questions-heading" className="space-y-2">
            <h3 id="key-questions-heading" className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              Key questions
            </h3>
            <ul className="space-y-2">
              {key.map((rfi) => renderRfi(rfi, true))}
              {untracked.map((q) => (
                <li key={q} className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                  <p className="text-sm text-gray-100 leading-snug">
                    <Star className="inline h-3.5 w-3.5 mr-1 -mt-0.5 fill-amber-400 text-amber-400" aria-label="Key question" />
                    {q}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {others.length > 0 && (
          <section aria-labelledby="other-questions-heading" className="space-y-2">
            <h3 id="other-questions-heading" className="text-sm font-semibold text-gray-200">
              {key.length || untracked.length ? 'Other questions' : 'Questions'}
            </h3>
            <ul className="space-y-2">{others.map((rfi) => renderRfi(rfi, false))}</ul>
          </section>
        )}
      </div>
    )
  }

  function renderCams() {
    if (!webcams?.length) {
      return (
        <EmptyState icon={Video} title="No cameras yet">
          Members add public webcams with !cop cam in the Signal room; they appear here and on the map.
        </EmptyState>
      )
    }
    return (
      <div className="p-3">
        <CopCamGrid cams={webcams} focusCamId={focusCamId} />
      </div>
    )
  }

  function renderPanel(id: PanelId | null) {
    switch (id) {
      case 'brief': return renderBrief()
      case 'feed': return renderFeed()
      case 'questions': return renderQuestions()
      case 'cams': return renderCams()
      default: return null
    }
  }

  const tabStrip = (
    <PanelTabs
      panels={panels}
      active={shownPanel}
      onSelect={(id) => setActivePanel(id)}
      idPrefix={isPhone ? 'menu' : 'side'}
    />
  )

  // With one panel there is no tab strip: the region is named by the panel itself.
  const panelA11y = (prefix: string) => panels.length > 1
    ? { role: 'tabpanel' as const, id: `${prefix}-panel-${shownPanel}`, 'aria-labelledby': `${prefix}-tab-${shownPanel}` }
    : { role: 'region' as const, 'aria-label': panels.find((p) => p.id === shownPanel)?.label ?? 'Panel' }

  const openEvidence = () => {
    setMenuOpen(false)
    setEvidenceOpen(true)
  }

  // ── Layout ─────────────────────────────────────────────────────

  return (
    <div className="dark fixed inset-0 flex flex-col bg-gray-950 text-gray-100">
      <header
        ref={topBarRef}
        className="flex items-center gap-1 md:gap-3 bg-gray-900 border-b border-gray-800 shrink-0 min-h-14 pl-1 pr-2 md:px-4 [touch-action:pan-y]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {isPhone && hasPanels && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open panels"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-200 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
            {openQuestionCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-gray-900" aria-hidden="true" />
            )}
          </button>
        )}
        <div className={cn('min-w-0 flex-1', isPhone && !hasPanels && 'pl-3')}>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="truncate text-[15px] md:text-sm font-semibold text-gray-100">{session.name}</h1>
            <Badge variant="secondary" className="hidden md:inline-flex shrink-0 text-[10px] bg-gray-800 text-gray-300">
              {TEMPLATE_LABELS[session.template_type] ?? session.template_type}
            </Badge>
            <Badge variant="secondary" className="hidden md:inline-flex shrink-0 text-[10px] bg-blue-500/20 text-blue-300">
              Shared view
            </Badge>
          </div>
          <LiveStatus mode={changeMode} stale={!!error} />
        </div>
        {evidenceForm && (
          <button
            type="button"
            onClick={openEvidence}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            <span>{isPhone ? 'Submit' : 'Submit evidence'}</span>
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isPhone && hasPanels && (
          <aside
            aria-label="COP panels"
            className={cn(
              'bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden shrink-0',
              shownPanel === 'cams' ? 'w-80 lg:w-96' : 'w-80',
            )}
          >
            {tabStrip}
            <div className="flex-1 overflow-y-auto overflow-x-hidden" {...panelA11y('side')}>
              {renderPanel(shownPanel)}
            </div>
          </aside>
        )}

        <main className="relative flex-1 min-h-0 overflow-hidden" aria-label="Map">
          <CopMap
            session={session}
            layers={layerData}
            onWebcamOpen={showsCams ? (camId) => {
              setActivePanel('cams')
              setFocusCamId(camId)
              if (isPhone) setMenuOpen(true)
            } : undefined}
          />
        </main>
      </div>

      {!isPhone && (
        <footer className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-1 font-medium">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {session.active_layers?.length ?? 0} map layers
          </span>
          {openQuestionCount > 0 && (
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {openQuestionCount} open question{openQuestionCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto text-gray-500">Powered by Research Tools</span>
        </footer>
      )}

      {isPhone && hasPanels && (
        <CopSideMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          title={session.name}
          subtitle={`${TEMPLATE_LABELS[session.template_type] ?? 'COP'} · shared view`}
          openGestureRef={topBarRef}
          rootClassName="dark"
          panelClassName="bg-gray-900 text-gray-100"
        >
          <div className="sticky top-0 z-10 bg-gray-900">{tabStrip}</div>
          <div {...panelA11y('menu')}>
            {renderPanel(shownPanel)}
          </div>
          {evidenceForm && (
            <div className="border-t border-gray-800 p-3">
              <button
                type="button"
                onClick={openEvidence}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Submit evidence
              </button>
            </div>
          )}
        </CopSideMenu>
      )}

      {evidenceForm && (
        <EvidenceSubmitSheet
          open={evidenceOpen}
          onOpenChange={setEvidenceOpen}
          dropToken={evidenceForm.token}
          formTitle={evidenceForm.title}
          rootClassName="dark"
          onSubmitted={(ingested) => {
            if (ingested?.evidence_id != null) {
              setHighlightEvidenceId(String(ingested.evidence_id))
              if (evidence) setActivePanel('feed')
            }
            fetchData()
            if (ingested?.marker_id) refetchLayers(new Set(['cop-markers']))
          }}
        />
      )}
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────

function PanelTabs({
  panels,
  active,
  onSelect,
  idPrefix,
}: {
  panels: { id: PanelId; label: string; icon: typeof Layers; count?: number }[]
  active: PanelId | null
  onSelect: (id: PanelId) => void
  idPrefix: string
}) {
  if (panels.length < 2) return null
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = panels.findIndex((p) => p.id === active)
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? panels.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + panels.length) % panels.length
    onSelect(panels[next].id)
    document.getElementById(`${idPrefix}-tab-${panels[next].id}`)?.focus()
  }
  return (
    // Equal columns, icon over label (an iOS tab bar): four tabs fit a 272 px menu.
    <div
      role="tablist"
      aria-label="Panels"
      className="grid border-b border-gray-800"
      style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }}
      onKeyDown={onKeyDown}
    >
      {panels.map((tab) => {
        const Icon = tab.icon
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            aria-label={tab.count ? `${tab.label}, ${tab.count}` : tab.label}
            className={cn(
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 border-b-2 px-1 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500',
              selected ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200',
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {!!tab.count && (
                <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-gray-600 px-1 text-center text-[10px] font-semibold leading-[18px] text-white" aria-hidden="true">
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function LiveStatus({ mode, stale }: { mode: ChangeMode; stale: boolean }) {
  const label = stale
    ? 'Reconnecting…'
    : mode === 'live'
      ? 'Live'
      : mode === 'fallback'
        ? 'Updates every minute'
        : 'Connecting…'
  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-400" aria-live="polite">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          stale ? 'bg-amber-400' : mode === 'live' ? 'bg-emerald-400 motion-safe:animate-pulse' : 'bg-gray-500',
        )}
        aria-hidden="true"
      />
      {label}
    </p>
  )
}

function EmptyState({ icon: Icon, title, children }: { icon: typeof Layers; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon className="h-6 w-6 text-gray-500" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-200">{title}</p>
      <p className="max-w-xs text-sm text-gray-400">{children}</p>
    </div>
  )
}
