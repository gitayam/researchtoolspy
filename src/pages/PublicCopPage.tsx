/**
 * Public COP View Page
 *
 * Read-only shared COP view at /public/cop/:token
 * Renders map + configurable panels based on share settings.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2,
  Layers,
  ClipboardList,
  HelpCircle,
  Star,
  ExternalLink,
  Eye,
  Send,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import CopMap from '@/components/cop/CopMap'
import { getLayerById } from '@/components/cop/CopLayerCatalog'
import type {
  CopSession,
  CopFeatureCollection,
  CopLayerDef,
  CopRfi,
  EventFact,
} from '@/types/cop'
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  RFI_PRIORITY_COLORS,
} from '@/types/cop'

// ── Types ────────────────────────────────────────────────────────

interface PublicCopData {
  session: CopSession
  visible_panels: string[]
  allow_rfi_answers: boolean
  rfis?: CopRfi[]
}

// ── Template labels ──────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
}

// ── Component ────────────────────────────────────────────────────

export default function PublicCopPage() {
  const { token } = useParams<{ token: string }>()

  const [data, setData] = useState<PublicCopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [layerData, setLayerData] = useState<Record<string, CopFeatureCollection>>({})
  const [activePanel, setActivePanel] = useState<string | null>(null)

  // RFI answer form state
  const [answerFormRfiId, setAnswerFormRfiId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [answerSourceUrl, setAnswerSourceUrl] = useState('')
  const [responderName, setResponderName] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  // Expanded RFI tracking
  const [expandedRfis, setExpandedRfis] = useState<Set<string>>(new Set())

  const timersRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch shared data ──────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/cop/public/${token}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('This shared COP link is invalid or has expired.')
        throw new Error(`Failed to load (${res.status})`)
      }
      const json = await res.json()
      setData(json)

      // Set first available panel as active
      if (!activePanel && json.visible_panels?.length > 1) {
        const nonMap = json.visible_panels.find((p: string) => p !== 'map')
        if (nonMap) setActivePanel(nonMap)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared COP')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Fetch layer data ───────────────────────────────────────────

  const fetchLayerData = useCallback(
    async (layerDef: CopLayerDef) => {
      if (!data?.session?.id) return
      if (layerDef.source.type === 'static') return
      try {
        const endpoint = `/api/cop/${data.session.id}${layerDef.source.endpoint}`
        const res = await fetch(endpoint)
        if (!res.ok) return
        const fc: CopFeatureCollection = await res.json()
        setLayerData(prev => ({ ...prev, [layerDef.id]: fc }))
      } catch {
        // Silently skip
      }
    },
    [data?.session?.id]
  )

  useEffect(() => {
    if (!data?.session) return
    const activeLayers = data.session.active_layers ?? []
    const promises = activeLayers
      .map(getLayerById)
      .filter((l): l is CopLayerDef => l != null)
      .map(fetchLayerData)
    Promise.allSettled(promises)
  }, [data?.session, fetchLayerData])

  // ── Auto-refresh every 60s ─────────────────────────────────────

  useEffect(() => {
    if (!data) return
    timersRef.current = setInterval(() => {
      fetchData()
    }, 60000)
    return () => {
      if (timersRef.current) clearInterval(timersRef.current)
    }
  }, [data, fetchData])

  // ── Submit RFI answer ──────────────────────────────────────────

  const handleSubmitAnswer = useCallback(async (rfiId: string) => {
    if (!token || !answerText.trim()) return
    setSubmittingAnswer(true)
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
      // Reset form and refresh
      setAnswerText('')
      setAnswerSourceUrl('')
      setAnswerFormRfiId(null)
      fetchData()
    } catch (err) {
      console.error('Failed to submit answer:', err)
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

  // ── Loading ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-700">
          <CardContent className="p-6 text-center">
            <Eye className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-200 mb-2">Shared COP Not Found</h2>
            <p className="text-sm text-gray-400">{error ?? 'This link may have expired.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { session, visible_panels, allow_rfi_answers, rfis } = data
  const hasSidePanels = visible_panels.some(p => p !== 'map')
  const eventType = session.event_type as keyof typeof EVENT_TYPE_LABELS | null

  // ── Render panels ──────────────────────────────────────────────

  function renderEventPanel() {
    return (
      <div className="p-3 space-y-4">
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
        {session.event_facts?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Key Facts</h4>
            {(session.event_facts as EventFact[]).map((fact, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-500 font-mono shrink-0 w-12">{fact.time}</span>
                <span className="text-gray-300">{fact.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderRfiPanel() {
    if (!rfis?.length) {
      return (
        <div className="p-4 text-center text-sm text-gray-500">
          No RFIs posted yet.
        </div>
      )
    }

    const openCount = rfis.filter(r => r.status === 'open').length

    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{rfis.length} RFI{rfis.length !== 1 ? 's' : ''}</span>
          {openCount > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-400">
              {openCount} open
            </Badge>
          )}
        </div>

        {rfis.map(rfi => {
          const isExpanded = expandedRfis.has(rfi.id)
          const priorityColor = RFI_PRIORITY_COLORS[rfi.priority] ?? '#6b7280'
          const answerCount = rfi.answers?.length ?? 0

          return (
            <div key={rfi.id} className="rounded-md border border-gray-700 bg-gray-800/50">
              <button
                type="button"
                onClick={() => toggleRfiExpand(rfi.id)}
                className="w-full flex items-start gap-2 p-2.5 text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 leading-relaxed">{rfi.question}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: priorityColor }}
                    />
                    <span className="text-[10px] text-gray-500 uppercase">{rfi.priority}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        rfi.status === 'accepted'
                          ? 'bg-green-500/20 text-green-400'
                          : rfi.status === 'answered'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {rfi.status}
                    </Badge>
                    {answerCount > 0 && (
                      <span className="text-[10px] text-gray-500">{answerCount} answer{answerCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-700 px-3 py-2 space-y-2">
                  {rfi.answers?.map(answer => (
                    <div key={answer.id} className="rounded bg-gray-800 p-2 space-y-1">
                      <p className="text-xs text-gray-300">{answer.answer_text}</p>
                      {answer.source_url && (
                        <a
                          href={answer.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                        >
                          <Link2 className="h-3 w-3" />
                          Source
                        </a>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{answer.responder_name ?? 'Anonymous'}</span>
                        <span>{new Date(answer.created_at).toLocaleString()}</span>
                        {answer.is_accepted === 1 && (
                          <CheckCircle2 className="h-3 w-3 text-green-400" />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Answer form for public viewers */}
                  {allow_rfi_answers && rfi.status !== 'closed' && rfi.status !== 'accepted' && (
                    <>
                      {answerFormRfiId === rfi.id ? (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={responderName}
                            onChange={e => setResponderName(e.target.value)}
                            placeholder="Your name (optional)"
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <textarea
                            value={answerText}
                            onChange={e => setAnswerText(e.target.value)}
                            placeholder="Your answer..."
                            rows={2}
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                          />
                          <input
                            type="url"
                            value={answerSourceUrl}
                            onChange={e => setAnswerSourceUrl(e.target.value)}
                            placeholder="Source URL (optional)"
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSubmitAnswer(rfi.id)}
                              disabled={!answerText.trim() || submittingAnswer}
                              className="text-xs h-7"
                            >
                              {submittingAnswer ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              Submit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAnswerFormRfiId(null)
                                setAnswerText('')
                                setAnswerSourceUrl('')
                              }}
                              className="text-xs h-7 text-gray-400"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAnswerFormRfiId(rfi.id)}
                          className="text-[10px] text-blue-400 hover:text-blue-300"
                        >
                          + Submit an answer
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderQuestionsPanel() {
    const questions = session.key_questions ?? []
    if (!questions.length) {
      return (
        <div className="p-4 text-center text-sm text-gray-500">
          No questions defined.
        </div>
      )
    }
    return (
      <div className="p-3 space-y-2">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Key Questions</h4>
        {questions.map((q, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-gray-500 font-mono shrink-0">{i + 1}.</span>
            <span className="text-gray-300">{q}</span>
          </div>
        ))}
      </div>
    )
  }

  // Panel tab config
  const panelTabs = visible_panels
    .filter(p => p !== 'map')
    .map(p => ({
      id: p,
      label: p === 'event' ? 'Event' : p === 'rfi' ? 'RFI' : p === 'questions' ? 'Questions' : p === 'claims' ? 'Claims' : p === 'network' ? 'Network' : p,
      icon: p === 'event' ? ClipboardList : p === 'rfi' ? HelpCircle : p === 'questions' ? Star : Layers,
    }))

  // ── Main layout ────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Eye className="h-4 w-4 text-gray-500 shrink-0" />
          <h1 className="font-semibold text-sm text-gray-200 truncate">{session.name}</h1>
          <Badge variant="secondary" className="shrink-0 text-[10px] bg-gray-800 text-gray-400">
            {TEMPLATE_LABELS[session.template_type] ?? session.template_type}
          </Badge>
          <Badge variant="secondary" className="shrink-0 text-[10px] bg-blue-500/20 text-blue-400">
            Shared View
          </Badge>
        </div>
        <span className="text-[10px] text-gray-500 flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          Auto-refreshes
        </span>
      </header>

      {/* Body: sidebar + map */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Side panel (only if panels beyond map exist) */}
        {hasSidePanels && (
          <aside className="w-72 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden shrink-0">
            {/* Tab strip */}
            {panelTabs.length > 1 && (
              <div className="flex border-b border-gray-700">
                {panelTabs.map(tab => {
                  const Icon = tab.icon
                  const isActive = activePanel === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePanel(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        isActive
                          ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'event' && renderEventPanel()}
              {activePanel === 'rfi' && renderRfiPanel()}
              {activePanel === 'questions' && renderQuestionsPanel()}
              {activePanel === 'claims' && (
                <div className="p-4 text-center text-sm text-gray-500">Claims view coming soon.</div>
              )}
              {activePanel === 'network' && (
                <div className="p-4 text-center text-sm text-gray-500">Network view coming soon.</div>
              )}
            </div>
          </aside>
        )}

        {/* Map */}
        <div className="flex-1 overflow-hidden" style={{ position: 'relative', minHeight: 0 }}>
          <CopMap session={session} layers={layerData} />
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-t border-gray-700 text-xs text-gray-500 shrink-0">
        <span className="flex items-center gap-1 font-medium text-gray-400">
          <Layers className="h-3.5 w-3.5" />
          {session.active_layers?.length ?? 0} layers
        </span>
        {rfis && rfis.length > 0 && (
          <>
            <span className="text-gray-700">|</span>
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              {rfis.filter(r => r.status === 'open').length} open RFIs
            </span>
          </>
        )}
        <span className="ml-auto text-[10px] text-gray-600">
          Powered by Research Tools
        </span>
      </footer>
    </div>
  )
}
