import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Star, ExternalLink, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CopSession } from '@/types/cop'
import { getCopHeaders } from '@/lib/cop-auth'

// ── 5W1H Categories ──────────────────────────────────────────────

interface Category {
  key: string
  label: string
  color: string
}

const CATEGORIES: Category[] = [
  { key: 'who', label: 'Who', color: '#8b5cf6' },
  { key: 'what', label: 'What', color: '#3b82f6' },
  { key: 'when', label: 'When', color: '#f59e0b' },
  { key: 'where', label: 'Where', color: '#22c55e' },
  { key: 'why', label: 'Why', color: '#ef4444' },
  { key: 'how', label: 'How', color: '#06b6d4' },
]

// ── Context-aware question builder ───────────────────────────────

interface EvidenceContext {
  titles: string[]
  summaries: string[]
  people: string[]
  organizations: string[]
  locations: string[]
  domains: string[]
}

/**
 * Build 5W1H questions from COP session context — key_questions,
 * evidence data (article titles, entities), and actors.
 * Only falls back to generic defaults when no context is available.
 */
function buildQuestions(
  keyQuestions: string[],
  context: EvidenceContext,
  missionBrief?: string | null,
): Array<{ id: string; category: string; question: string; answer: string | null }> {
  const result: Array<{ id: string; category: string; question: string; answer: string | null }> = []
  const lowerCats = ['who', 'what', 'when', 'where', 'why', 'how']
  const usedCategories = new Set<string>()

  // 1. Classify user's key_questions into 5W1H categories
  keyQuestions.forEach((q, i) => {
    const lower = q.toLowerCase().trim()
    let cat = 'what'
    for (const c of lowerCats) {
      if (lower.startsWith(c + ' ') || lower.startsWith(c + "'")) {
        cat = c
        break
      }
    }
    usedCategories.add(cat)
    result.push({ id: `q-user-${i}`, category: cat, question: q, answer: null })
  })

  // 2. Build contextual questions from evidence data
  const hasContext = context.titles.length > 0 || context.people.length > 0 || context.locations.length > 0

  if (hasContext) {
    let qi = 0
    const add = (cat: string, q: string) => {
      if (!usedCategories.has(cat)) usedCategories.add(cat)
      result.push({ id: `q-ctx-${qi++}`, category: cat, question: q, answer: null })
    }

    // WHO — from people and organizations found in evidence
    if (!usedCategories.has('who')) {
      if (context.people.length > 0) {
        const names = context.people.slice(0, 3).join(', ')
        add('who', `Who are ${names} and what are their roles in this situation?`)
      }
      if (context.organizations.length > 0) {
        const orgs = context.organizations.slice(0, 3).join(', ')
        add('who', `Who within ${orgs} is responsible for decision-making here?`)
      }
      if (context.people.length === 0 && context.organizations.length === 0) {
        add('who', 'Who are the key actors and decision-makers involved?')
      }
    }

    // WHAT — from article titles and summaries
    if (!usedCategories.has('what')) {
      if (context.titles.length > 0) {
        const primaryTitle = context.titles[0]
        add('what', `What are the key facts reported in "${primaryTitle.slice(0, 80)}"?`)
        add('what', 'What evidence corroborates or contradicts the reported claims?')
      } else {
        add('what', 'What are the primary events and their verified details?')
      }
    }

    // WHEN — from evidence
    if (!usedCategories.has('when')) {
      add('when', 'When did the reported events occur and what is the established timeline?')
      if (context.titles.length > 1) {
        add('when', 'When were the different source reports published relative to the events?')
      }
    }

    // WHERE — from locations found in evidence
    if (!usedCategories.has('where')) {
      if (context.locations.length > 0) {
        const locs = context.locations.slice(0, 3).join(', ')
        add('where', `Where exactly in ${locs} did the events take place?`)
        add('where', `Where are the nearest supporting resources or response capabilities to ${context.locations[0]}?`)
      } else {
        add('where', 'Where did the reported events take place and what is the geographic context?')
      }
    }

    // WHY — contextual
    if (!usedCategories.has('why')) {
      if (context.titles.length > 0) {
        add('why', 'Why did this situation develop and what were the contributing factors?')
        add('why', 'Why is this event significant for the broader investigation?')
      } else {
        add('why', 'Why did this activity occur and what motivated the key actors?')
      }
    }

    // HOW — contextual
    if (!usedCategories.has('how')) {
      add('how', 'How did the events unfold based on available evidence?')
      if (context.domains.length > 0) {
        add('how', `How reliable are the sources (${context.domains.slice(0, 3).join(', ')})?`)
      }
      add('how', 'How should the investigation proceed based on current evidence gaps?')
    }
  } else {
    // 3. Generic fallback only when no evidence context exists
    const defaults: Record<string, string[]> = {
      who: ['Who are the key actors involved?', 'Who are the target audiences?', 'Who benefits from this?'],
      what: ['What methods or tactics are being used?', 'What patterns indicate coordination?', 'What evidence exists?'],
      when: ['When did this activity begin?', 'When are the actors most active?'],
      where: ['Where is the activity concentrated?', 'Where are the operators located?', 'Where does funding flow?'],
      why: ['Why was this activity initiated?', 'Why these specific targets or methods?'],
      how: ['How is the operation structured?', 'How do they avoid detection?', 'How are resources acquired?'],
    }

    for (const cat of lowerCats) {
      if (!usedCategories.has(cat)) {
        defaults[cat].forEach((q, i) => {
          result.push({ id: `q-${cat}-${i}`, category: cat, question: q, answer: null })
        })
      }
    }
  }

  return result
}

// ── Types ────────────────────────────────────────────────────────

interface StarburstQuestion {
  id: string
  category: string
  question: string
  answer: string | null
}

interface StarburstData {
  id: string
  questions: StarburstQuestion[]
}

// ── Props ────────────────────────────────────────────────────────

interface CopQuestionsTabProps {
  session: CopSession
}

// ── Component ────────────────────────────────────────────────────

export default function CopQuestionsTab({ session }: CopQuestionsTabProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [starburst, setStarburst] = useState<StarburstData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find linked starbursting framework session
  const starburstId = (session.linked_frameworks ?? []).find(id =>
    typeof id === 'string' || typeof id === 'number'
  ) ?? null

  const fetchStarburst = useCallback(async (id: string | number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/frameworks/${id}`, {
        headers: getCopHeaders(),
      })
      if (!res.ok) return
      const data = await res.json()

      // Parse questions from framework data — supports both flat entries
      // and categorized (who/what/when/where/why/how) formats
      let questions: StarburstQuestion[] = []
      const fwData = data.data ?? {}

      if (Array.isArray(fwData.entries)) {
        questions = fwData.entries
      } else if (Array.isArray(data.questions)) {
        questions = data.questions
      } else if (Array.isArray(data.entries)) {
        questions = data.entries
      } else {
        // Categorized format: { who: [...], what: [...], ... }
        const cats = ['who', 'what', 'when', 'where', 'why', 'how']
        for (const cat of cats) {
          const catData = fwData[cat]
          if (Array.isArray(catData)) {
            for (const q of catData) {
              questions.push({
                id: q.id ?? `${cat}-${questions.length}`,
                category: cat,
                question: q.question ?? q.text ?? String(q),
                answer: q.answer ?? null,
              })
            }
          }
        }
      }

      setStarburst({
        id: String(data.id ?? id),
        questions,
      })
    } catch {
      // ignore — will fall through to key_questions view
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!starburstId) return
    fetchStarburst(starburstId)
  }, [starburstId, fetchStarburst])

  const toggleCategory = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  /**
   * Gather evidence context from the COP session, then generate
   * contextual 5W1H questions and create a linked framework.
   */
  const handleGenerateQuestions = async () => {
    setGenerating(true)
    setError(null)
    try {
      const headers = getCopHeaders()

      // 1. Fetch evidence items to get article context
      const evidenceContext: EvidenceContext = {
        titles: [], summaries: [], people: [],
        organizations: [], locations: [], domains: [],
      }

      try {
        const evRes = await fetch(`/api/cop/${session.id}/evidence`, { headers })
        if (evRes.ok) {
          const evData = await evRes.json()
          const items = evData.evidence ?? []
          for (const item of items) {
            if (item.title) evidenceContext.titles.push(item.title)
            if (item.description) evidenceContext.summaries.push(item.description)
            if (item.url) {
              try {
                evidenceContext.domains.push(new URL(item.url).hostname)
              } catch { /* skip */ }
            }
          }
        }
      } catch { /* evidence fetch optional */ }

      // 2. Fetch actors for entity context
      try {
        const actRes = await fetch(`/api/cop/${session.id}/personas`, { headers })
        if (actRes.ok) {
          const actData = await actRes.json()
          const personas = actData.personas ?? []
          for (const p of personas) {
            const name = p.name || p.handle
            if (!name) continue
            if (p.type === 'ORGANIZATION' || p.entity_type === 'organization') {
              evidenceContext.organizations.push(name)
            } else {
              evidenceContext.people.push(name)
            }
          }
        }
      } catch { /* actor fetch optional */ }

      // 3. Fetch content analysis entities if we have evidence IDs
      // (content_analysis table has richer entity data than evidence_items)
      try {
        const evRes = await fetch(`/api/cop/${session.id}/activity?limit=100`, { headers })
        if (evRes.ok) {
          const actData = await evRes.json()
          const activities = actData.activity ?? []
          // Extract location mentions from activity payload
          for (const act of activities) {
            try {
              const payload = typeof act.payload === 'string' ? JSON.parse(act.payload) : act.payload
              if (payload?.locations) {
                for (const loc of payload.locations) {
                  const name = typeof loc === 'string' ? loc : loc.name
                  if (name && !evidenceContext.locations.includes(name)) {
                    evidenceContext.locations.push(name)
                  }
                }
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* activity fetch optional */ }

      // 4. Build contextual questions
      const questions = buildQuestions(
        session.key_questions ?? [],
        evidenceContext,
        session.mission_brief,
      )

      // 5. Create framework session
      const createRes = await fetch('/api/frameworks', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `5W1H: ${session.name || 'Investigation'}`,
          description: `Starbursting analysis for COP session ${session.id}`,
          framework_type: 'starbursting',
          workspace_id: session.workspace_id,
          data: {
            entries: questions,
            central_topic: session.name || session.mission_brief || 'Investigation',
            source_titles: evidenceContext.titles.slice(0, 5),
            source_domains: evidenceContext.domains.slice(0, 5),
          },
        }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error || `Failed to create framework (${createRes.status})`)
      }

      const { id: newFrameworkId } = await createRes.json()
      if (!newFrameworkId) throw new Error('No framework ID returned')

      // 6. Link framework to COP session
      const existing = session.linked_frameworks ?? []
      const updated = [...existing, String(newFrameworkId)]

      const linkRes = await fetch(`/api/cop/sessions/${session.id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Workspace-ID': session.workspace_id || '',
        },
        body: JSON.stringify({ linked_frameworks: updated }),
      })

      if (!linkRes.ok) {
        throw new Error(`Failed to link framework to session (${linkRes.status})`)
      }

      // 7. Update local state
      setStarburst({
        id: String(newFrameworkId),
        questions,
      })
      session.linked_frameworks = updated

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  // Regenerate — unlinks old framework, creates new one with fresh context
  const handleRegenerateQuestions = async () => {
    // Clear current starburst so we can regenerate
    setStarburst(null)
    // Remove linked frameworks so handleGenerateQuestions creates fresh
    session.linked_frameworks = []
    const headers = getCopHeaders()
    try {
      await fetch(`/api/cop/sessions/${session.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json', 'X-Workspace-ID': session.workspace_id || '' },
        body: JSON.stringify({ linked_frameworks: [] }),
      })
    } catch { /* best effort */ }
    handleGenerateQuestions()
  }

  // Calculate completion per category
  function getCategoryStats(key: string) {
    if (!starburst?.questions) return { total: 0, answered: 0, pct: 0 }
    const catQuestions = starburst.questions.filter(
      q => q.category?.toLowerCase() === key.toLowerCase()
    )
    const answered = catQuestions.filter(q => q.answer && q.answer.trim().length > 0).length
    const total = catQuestions.length
    return {
      total,
      answered,
      pct: total > 0 ? Math.round((answered / total) * 100) : 0,
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          Questions
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-slate-400" />
            <span className="ml-2 text-xs text-slate-500">Loading questions...</span>
          </div>
        ) : starburst ? (
          <>
            {/* 5W1H Categories */}
            {CATEGORIES.map(cat => {
              const stats = getCategoryStats(cat.key)
              const isExpanded = expanded[cat.key] ?? false
              const catQuestions = starburst.questions?.filter(
                q => q.category?.toLowerCase() === cat.key.toLowerCase()
              ) ?? []

              return (
                <div key={cat.key}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-slate-500 shrink-0" />
                    )}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex-1 text-left">
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {stats.answered}/{stats.total}
                    </span>
                    {/* Progress bar */}
                    <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${stats.pct}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </button>

                  {/* Expanded questions */}
                  {isExpanded && catQuestions.length > 0 && (
                    <div className="ml-6 mb-1 space-y-1">
                      {catQuestions.map(q => (
                        <div
                          key={q.id}
                          className="text-xs text-slate-500 dark:text-slate-400 py-0.5 pl-2 border-l border-slate-200 dark:border-slate-700"
                        >
                          <span className={q.answer ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-400'}>
                            {q.question}
                          </span>
                          {q.answer && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {q.answer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && catQuestions.length === 0 && (
                    <p className="ml-6 mb-1 text-[10px] text-slate-400 dark:text-slate-600 py-0.5">
                      No questions in this category.
                    </p>
                  )}
                </div>
              )
            })}

            {/* Actions */}
            <div className="pt-3 flex items-center gap-2">
              <a
                href={`/dashboard/analysis-frameworks/starbursting/${starburst.id}/view`}
                className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open full starbursting view
              </a>
              <button
                type="button"
                onClick={handleRegenerateQuestions}
                disabled={generating}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-auto cursor-pointer"
                title="Regenerate questions from current evidence"
              >
                <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </>
        ) : session.key_questions?.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium px-1">
              Key Questions ({session.key_questions.length})
            </p>
            {session.key_questions.map((q, i) => (
              <div
                key={i}
                className="text-xs text-slate-600 dark:text-slate-300 py-1.5 px-2 border-l-2 border-blue-400 dark:border-blue-500 bg-slate-50 dark:bg-slate-800/50 rounded-r"
              >
                {q}
              </div>
            ))}
            <div className="pt-2">
              {error && (
                <p className="text-[10px] text-red-500 dark:text-red-400 mb-2">{error}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-xs cursor-pointer w-full"
                onClick={handleGenerateQuestions}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    Generating 5W1H from evidence...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    Expand into 5W1H Framework
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-3">
            <Star className="h-6 w-6 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500">
              No analysis framework linked yet.
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[250px] sm:max-w-[200px] mx-auto">
              Generate 5W1H questions from your evidence and key questions.
            </p>
            {error && (
              <p className="text-[10px] text-red-500 dark:text-red-400">{error}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs cursor-pointer"
              onClick={handleGenerateQuestions}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Generate Questions
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
