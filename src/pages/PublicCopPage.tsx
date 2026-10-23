/**
 * Public COP View Page
 *
 * Read-only shared COP view at /public/cop/:token: the map plus the panels the
 * share link allows (brief, feed, questions, cams).
 *
 * Layout:
 *   - phones: the map fills the screen under a compact top bar; the panels open
 *     in a side menu (menu button, or drag right across the top bar). When visitors
 *     can help with the questions (answers or evidence allowed), a bar under the map
 *     ("8 open questions · Answer") opens them in a sheet.
 *   - tablet/desktop: panels in a side column beside the map; it opens on the
 *     Questions tab when visitors can help with them.
 * Panels only appear when they have something to show or a real empty state;
 * there are no placeholder tabs. Key questions are starred RFIs, in one
 * Questions tab. With `allow_rfi_answers`, each question has an Answer button that
 * opens AnswerSheet. When the share allows it (`evidence_form`), "Submit evidence"
 * opens the evidence form in place, and "+ Evidence" on a question opens it with that
 * question ticked. With both, the phone's Submit asks which. Changes arrive through
 * the public changes feed (or a full reload every minute on servers without it).
 */

import { useState, useEffect, useCallback, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2,
  Layers,
  ClipboardList,
  HelpCircle,
  Star,
  Eye,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  Link2,
  Video,
  Menu,
  Newspaper,
  FilePlus2,
  Plus,
  MessageSquareReply,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import CopMap from '@/components/cop/CopMap'
import CopCamGrid from '@/components/cop/cams/CopCamGrid'
import { getLayerById } from '@/components/cop/CopLayerCatalog'
import CopSideMenu from '@/components/cop/shell/CopSideMenu'
import CopSheet from '@/components/cop/shell/CopSheet'
import AnswerSheet, { type AnswerTarget } from '@/components/cop/shell/AnswerSheet'
import EvidenceSubmitSheet from '@/components/cop/shell/EvidenceSubmitSheet'
import { pickNextQuestion, takesAnswers } from '@/components/cop/shell/share-answers'
import { useIsPhone } from '@/components/cop/shell/useMediaQuery'
import { usePublicCopChanges, type ChangeMode } from '@/components/cop/shell/usePublicCopChanges'
import { splitKeyQuestions, type QuestionLike } from '@/components/cop/shell/key-questions'
import { RelationChip } from '@/components/cop/evidence-links/RelationChip'
import { VoteCounts } from '@/components/cop/evidence-links/VoteControl'
import { rankFiled } from '@/lib/cop-evidence-links'
import { cn, formatRelativeTime } from '@/lib/utils'
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
type FiledOnShare = { evidence_count?: number; unreviewed_count?: number; evidence?: CopPublicFiledEvidence[] }
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
/** Where a question list renders: the panel (side column or phone menu) or the phone's Questions sheet. */
type QuestionScope = 'panel' | 'list'

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`

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
  // The question "+ Add evidence" picked (null: opened generally); the nonce re-applies it.
  const [evidenceQuestion, setEvidenceQuestion] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 })
  const [highlightEvidenceId, setHighlightEvidenceId] = useState<string | null>(null)

  // Phones: the Questions sheet (from the bar under the map) and the Submit chooser.
  const [listOpen, setListOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  // The answer sheet and its question (the snapshot covers a question that drops out of the list).
  const [answerOpen, setAnswerOpen] = useState(false)
  const [answerSnapshot, setAnswerSnapshot] = useState<AnswerTarget | null>(null)
  // Desktop: "Answer a question" moves focus into the Questions panel.
  const [focusQuestionsNonce, setFocusQuestionsNonce] = useState(0)

  // Expanded RFI tracking
  const [expandedRfis, setExpandedRfis] = useState<Set<string>>(new Set())

  const topBarRef = useRef<HTMLElement>(null)
  const panelsButtonRef = useRef<HTMLButtonElement>(null)
  const asideRef = useRef<HTMLElement>(null)

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
    // The RFI list (rfi panel) carries no star; the key_rfis (questions panel) say which are key.
    const keyIds = new Set((data?.key_rfis ?? []).map((k) => k.id))
    const rfis: PublicRfi[] = (data?.rfis ?? []).map((r) => (keyIds.has(r.id) ? { ...r, is_key: 1 } : r))
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
  const keyOpenCount = questions.key.filter((r) => r.status === 'open').length
  const trackedQuestionCount = questions.key.length + questions.others.length

  // Questions as the answer sheet sees them: key ones first, in list order.
  const answerTargets = useMemo<AnswerTarget[]>(() => {
    const target = (rfi: PublicRfi, isKey: boolean): AnswerTarget => ({
      id: rfi.id,
      question: rfi.question,
      isKey,
      answerCount: rfi.answers?.length || rfi.answer_count || 0,
      status: rfi.status,
    })
    return [...questions.key.map((r) => target(r, true)), ...questions.others.map((r) => target(r, false))]
  }, [questions])

  // What a visitor can do with the questions: answer them (the share allows answers and
  // some still take them), file evidence under them (an evidence form; not on closed ones).
  const answering = !!data?.allow_rfi_answers && showsQuestions && answerTargets.some((t) => takesAnswers(t.status))
  const evidenceOn = !!data?.evidence_form?.token
  const evidenceOnQuestions = evidenceOn && showsQuestions && answerTargets.some((t) => t.status !== 'closed')
  const questionsActionable = answering || evidenceOnQuestions

  const panels = useMemo(() => {
    const list: { id: PanelId; label: string; icon: typeof Layers; count?: number }[] = []
    if (hasBrief) list.push({ id: 'brief', label: 'Brief', icon: ClipboardList })
    if (evidence) list.push({ id: 'feed', label: 'Feed', icon: Newspaper, count: evidence.length })
    if (showsQuestions) list.push({ id: 'questions', label: 'Questions', icon: HelpCircle, count: openQuestionCount + questions.untracked.length })
    if (showsCams) list.push({ id: 'cams', label: 'Cams', icon: Video, count: data?.webcams?.length ?? 0 })
    return list
  }, [hasBrief, evidence, showsQuestions, openQuestionCount, questions.untracked.length, showsCams, data?.webcams?.length])

  // Until someone picks a tab: the questions when visitors can help with them, else the
  // first panel with something in it.
  const defaultPanel = useMemo<PanelId | null>(() => {
    if (!panels.length) return null
    if (questionsActionable && panels.some((p) => p.id === 'questions')) return 'questions'
    return (panels.find((p) => p.id === 'brief' || (p.count ?? 0) > 0) ?? panels[0]).id
  }, [panels, questionsActionable])
  const shownPanel: PanelId | null = activePanel && panels.some((p) => p.id === activePanel) ? activePanel : defaultPanel

  // Desktop "Answer a question": focus the first Answer button in the Questions panel.
  useEffect(() => {
    if (!focusQuestionsNonce) return
    const aside = asideRef.current
    const target = aside?.querySelector<HTMLElement>('[data-answer-button]')
      ?? aside?.querySelector<HTMLElement>('[data-evidence-button]')
      ?? document.getElementById('side-tab-questions')
    target?.focus()
  }, [focusQuestionsNonce])

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

  const { webcams } = data
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
    // The server ranks them (team score, then newest); ranked again for older servers.
    const ranked = rankFiled(rfi.evidence, (item) => item.created_at)
    const voted = ranked.some((item) => (item.up ?? 0) + (item.down ?? 0) > 0)
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-300">
          Evidence filed under this question
          {voted && <span className="font-normal text-gray-500"> · ranked by the team’s votes</span>}
        </p>
        <ul className="space-y-1.5">
          {ranked.map((item, i) => (
            <li key={`${item.created_at}-${i}`} className="flex items-start gap-2 rounded-md bg-gray-800 p-2">
              {item.relation && <RelationChip relation={item.relation} onDark className="mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-gray-200">{item.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                  {typeof item.up === 'number' && <VoteCounts up={item.up} down={item.down ?? 0} />}
                  {item.relation === null
                    ? <span className="rounded bg-amber-500/15 px-1.5 py-px font-medium text-amber-300">Unverified</span>
                    : item.credibility && <span>{item.credibility}</span>}
                  {item.created_at && (
                    <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>
                      {formatRelativeTime(item.created_at)}
                    </time>
                  )}
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
        {(rfi.unreviewed_count ?? 0) > 0 && (
          <p className="text-xs text-gray-500">
            {rfi.unreviewed_count} unverified tip{rfi.unreviewed_count !== 1 ? 's are' : ' is'} listed but not counted until reviewed.
          </p>
        )}
        {count + (rfi.unreviewed_count ?? 0) > rfi.evidence.length && (
          <p className="text-xs text-gray-500">Showing the newest {rfi.evidence.length}.</p>
        )}
      </div>
    )
  }

  function renderRfi(rfi: PublicRfi, starred: boolean, scope: QuestionScope) {
    const isExpanded = expandedRfis.has(rfi.id)
    const priorityColor = RFI_PRIORITY_COLORS[rfi.priority] ?? '#6b7280'
    const answers = rfi.answers ?? []
    const answerCount = answers.length || rfi.answer_count || 0
    const canAnswer = answering && takesAnswers(rfi.status)
    // The form offers this share's open questions (the server checks the same list).
    const canAddEvidence = !!evidenceForm && rfi.status !== 'closed'
    const panelId = `${scope === 'list' ? 'list-' : ''}rfi-${rfi.id}`
    const shortQuestion = rfi.question.slice(0, 120)

    const evidenceButton = (
      <button
        type="button"
        data-evidence-button
        onClick={() => openEvidence(rfi.id)}
        aria-label={`Add evidence to: ${shortQuestion}`}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-emerald-500/40 px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Evidence
      </button>
    )

    return (
      <li key={rfi.id} className="@container rounded-lg border border-gray-700 bg-gray-800/50">
        <div className="flex items-start">
          <button
            type="button"
            onClick={() => toggleRfiExpand(rfi.id)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            className="min-w-0 flex-1 min-h-11 flex items-start gap-2 p-3 text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-100 leading-snug break-words">
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
                  <span className="text-gray-400">{plural(answerCount, 'answer')}</span>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Under the question, so it keeps the card's width: Answer and "+ Evidence", without opening the card. */}
        {(canAnswer || canAddEvidence) && (
          <div className="flex flex-wrap gap-2 px-3 pb-3 @min-[16.5rem]:pl-9">
            {canAnswer && (
              <button
                type="button"
                data-answer-button
                onClick={() => openAnswer(rfi, starred)}
                aria-label={`Answer: ${shortQuestion}`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              >
                <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
                Answer
              </button>
            )}
            {canAddEvidence && evidenceButton}
          </div>
        )}

        {isExpanded && (
          <div id={panelId} className="border-t border-gray-700 px-3 py-3 space-y-2">
            {renderFiledEvidence(rfi)}
            {answers.length === 0 && (
              <p className="text-xs text-gray-500">No answers yet.</p>
            )}
            {answers.map(answer => (
              <div key={answer.id} className="rounded-md bg-gray-800 p-2.5 space-y-1">
                <p className="text-sm text-gray-200 break-words">{answer.answer_text}</p>
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
          </div>
        )}
      </li>
    )
  }

  function renderQuestions(scope: QuestionScope) {
    const { key, others, untracked } = questions
    const idPrefix = scope === 'list' ? 'list-' : ''
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
          <section aria-labelledby={`${idPrefix}key-questions-heading`} className="space-y-2">
            <h3 id={`${idPrefix}key-questions-heading`} className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              Key questions
            </h3>
            <ul className="space-y-2">
              {key.map((rfi) => renderRfi(rfi, true, scope))}
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
          <section aria-labelledby={`${idPrefix}other-questions-heading`} className="space-y-2">
            <h3 id={`${idPrefix}other-questions-heading`} className="text-sm font-semibold text-gray-200">
              {key.length || untracked.length ? 'Other questions' : 'Questions'}
            </h3>
            <ul className="space-y-2">{others.map((rfi) => renderRfi(rfi, false, scope))}</ul>
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
      case 'questions': return renderQuestions('panel')
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

  // One overlay at a time: opening a sheet closes the menu or sheet it was opened from.
  const closeLaunchers = () => {
    setMenuOpen(false)
    setListOpen(false)
    setChooserOpen(false)
  }

  const openEvidence = (questionId: string | null = null) => {
    closeLaunchers()
    setEvidenceQuestion((prev) => ({ id: questionId, nonce: prev.nonce + 1 }))
    setEvidenceOpen(true)
  }

  const openAnswer = (rfi: PublicRfi, isKey: boolean) => {
    closeLaunchers()
    setAnswerSnapshot(answerTargets.find((t) => t.id === rfi.id)
      ?? { id: rfi.id, question: rfi.question, isKey, answerCount: rfi.answers?.length || rfi.answer_count || 0, status: rfi.status })
    setAnswerOpen(true)
  }

  /** The question list: a sheet on phones, the Questions panel (focused) beside the map elsewhere. */
  const openQuestionList = () => {
    closeLaunchers()
    if (isPhone) {
      setListOpen(true)
      return
    }
    setActivePanel('questions')
    setFocusQuestionsNonce((n) => n + 1)
  }

  const answerTarget = answerSnapshot ? answerTargets.find((t) => t.id === answerSnapshot.id) ?? answerSnapshot : null
  const nextAnswerTarget = answerTarget ? pickNextQuestion(answerTargets, answerTarget.id) : null

  // The bar under the phone map: open questions (key ones counted), or all of them when none is open.
  const barCount = openQuestionCount > 0 ? openQuestionCount : trackedQuestionCount
  const barLabel = plural(barCount, openQuestionCount > 0 ? 'open question' : 'question')
  const barKeyCount = openQuestionCount > 0 ? keyOpenCount : questions.key.length
  const showQuestionBar = isPhone && questionsActionable && trackedQuestionCount > 0

  // Phones: Submit asks which when both are allowed; Answer when only answers are.
  const phoneAction: { label: string; tone: 'answer' | 'evidence'; onClick: () => void } | null = !isPhone
    ? null
    : answering && evidenceForm
      ? { label: 'Submit', tone: 'evidence', onClick: () => setChooserOpen(true) }
      : answering
        ? { label: 'Answer', tone: 'answer', onClick: openQuestionList }
        : evidenceForm
          ? { label: 'Submit', tone: 'evidence', onClick: () => openEvidence() }
          : null

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
            ref={panelsButtonRef}
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
        {phoneAction && (
          <button
            type="button"
            onClick={phoneAction.onClick}
            aria-haspopup="dialog"
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              phoneAction.tone === 'answer'
                ? 'bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-400'
                : 'bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-400',
            )}
          >
            {phoneAction.tone === 'answer'
              ? <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
              : <FilePlus2 className="h-4 w-4" aria-hidden="true" />}
            <span>{phoneAction.label}</span>
          </button>
        )}
        {/* Wider screens have room for both, with no chooser in between. */}
        {!isPhone && answering && (
          <button
            type="button"
            onClick={openQuestionList}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
            <span>Answer a question</span>
          </button>
        )}
        {!isPhone && evidenceForm && (
          <button
            type="button"
            onClick={() => openEvidence()}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            <span>Submit evidence</span>
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isPhone && hasPanels && (
          <aside
            ref={asideRef}
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
          {openQuestionCount > 0 && (questionsActionable && hasPanels ? (
            <button
              type="button"
              onClick={openQuestionList}
              className="-my-1 flex min-h-8 items-center gap-1 rounded px-1.5 text-gray-300 underline-offset-2 hover:bg-gray-800 hover:text-gray-100 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {plural(openQuestionCount, 'open question')}
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {plural(openQuestionCount, 'open question')}
            </span>
          ))}
          <span className="ml-auto text-gray-500">Powered by Research Tools</span>
        </footer>
      )}

      {showQuestionBar && (
        <div
          className="shrink-0 border-t border-gray-800 bg-gray-900 px-3 pt-2"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={openQuestionList}
            aria-haspopup="dialog"
            aria-expanded={listOpen}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-gray-800 py-1.5 pl-3 pr-1.5 text-left hover:bg-gray-700/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <HelpCircle className="h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight text-gray-100">{barLabel}</span>
              {barKeyCount > 0 && (
                <span className="mt-0.5 flex items-center gap-1 text-xs leading-tight text-amber-300">
                  <span className="sr-only">, </span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {barKeyCount} key
                </span>
              )}
            </span>
            {answering ? (
              <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white">
                <span className="sr-only">. </span>
                <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
                Answer
              </span>
            ) : (
              <span className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-gray-300">
                <span className="sr-only">. </span>
                View
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </button>
        </div>
      )}

      {isPhone && showsQuestions && questionsActionable && (
        <CopSheet
          open={listOpen}
          onOpenChange={setListOpen}
          title="Questions"
          description={answering
            ? 'Tap Answer on a question you can help with. The team reviews answers before accepting them.'
            : 'Know something? Tap + Evidence on a question to send a photo, a link or what you saw.'}
          rootClassName="dark"
        >
          {renderQuestions('list')}
          {!answering && evidenceForm && (
            <div className="sticky bottom-0 border-t border-gray-800 bg-slate-900 p-3">
              <button
                type="button"
                onClick={() => openEvidence()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Submit evidence
              </button>
            </div>
          )}
        </CopSheet>
      )}

      {isPhone && answering && evidenceForm && (
        <CopSheet open={chooserOpen} onOpenChange={setChooserOpen} title="Send to the team" rootClassName="dark">
          <div className="space-y-2 p-4">
            <ChooserButton
              icon={MessageSquareReply}
              tone="answer"
              title="Answer a question"
              detail={openQuestionCount > 0 ? plural(openQuestionCount, 'open question') : plural(trackedQuestionCount, 'question')}
              onClick={openQuestionList}
            />
            <ChooserButton
              icon={FilePlus2}
              tone="evidence"
              title="Submit evidence"
              detail="A photo, a link or what you saw"
              onClick={() => openEvidence()}
            />
          </div>
        </CopSheet>
      )}

      {data.allow_rfi_answers && token && (
        <AnswerSheet
          open={answerOpen}
          onOpenChange={setAnswerOpen}
          token={token}
          question={answerTarget}
          next={nextAnswerTarget}
          onSent={() => { void fetchData() }}
          onAnswerNext={(next) => setAnswerSnapshot(next)}
          answersArePublic={Array.isArray(data.rfis)}
          rootClassName="dark"
        />
      )}

      {isPhone && hasPanels && (
        <CopSideMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          title={session.name}
          subtitle={`${TEMPLATE_LABELS[session.template_type] ?? 'COP'} · shared view`}
          openGestureRef={topBarRef}
          returnFocusRef={panelsButtonRef}
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
                onClick={() => openEvidence()}
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
          questionContext={token ? { share: token } : undefined}
          initialQuestionId={evidenceQuestion.id}
          preselectNonce={evidenceQuestion.nonce}
          onSubmitted={(ingested, filedUnder) => {
            if (filedUnder.length > 0 && showsQuestions) {
              // Show it where it was filed: those questions, opened.
              setExpandedRfis((prev) => new Set([...prev, ...filedUnder.map((q) => q.id)]))
              setActivePanel('questions')
            } else if (ingested?.evidence_id != null) {
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

/** One choice in the phone's "Send to the team" sheet. */
function ChooserButton({
  icon: Icon,
  tone,
  title,
  detail,
  onClick,
}: {
  icon: typeof Layers
  tone: 'answer' | 'evidence'
  title: string
  detail: string
  onClick: () => void
}) {
  const detailId = useId()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-describedby={detailId}
      className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-left hover:bg-gray-700/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          tone === 'answer' ? 'bg-blue-600/20 text-blue-300' : 'bg-emerald-600/20 text-emerald-300',
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-gray-100">{title}</span>
        <span id={detailId} className="block text-sm text-gray-400">{detail}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
    </button>
  )
}

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
