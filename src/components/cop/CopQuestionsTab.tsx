import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Star, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
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

// Build 5W1H questions — use session's key_questions as seeds, then fill
// gaps with defaults so every category has at least one question.
function buildQuestions(
  keyQuestions: string[],
  missionBrief?: string | null,
): Array<{ id: string; category: string; question: string; answer: string | null }> {
  const result: Array<{ id: string; category: string; question: string; answer: string | null }> = []

  // Classify each user question into a 5W1H category by keyword
  const lowerCats = ['who', 'what', 'when', 'where', 'why', 'how']
  const usedCategories = new Set<string>()

  keyQuestions.forEach((q, i) => {
    const lower = q.toLowerCase().trim()
    let cat = 'what' // default bucket
    for (const c of lowerCats) {
      if (lower.startsWith(c + ' ') || lower.startsWith(c + "'")) {
        cat = c
        break
      }
    }
    usedCategories.add(cat)
    result.push({ id: `q-user-${i}`, category: cat, question: q, answer: null })
  })

  // Fill empty categories with defaults
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
      setStarburst({
        id: String(data.id ?? id),
        questions: data.questions ?? data.entries ?? data.data?.entries ?? [],
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

  // Generate a new starbursting framework and link it
  const handleGenerateQuestions = async () => {
    setGenerating(true)
    setError(null)
    try {
      // Build questions from session's key_questions (or defaults)
      const questions = buildQuestions(
        session.key_questions ?? [],
        session.mission_brief,
      )

      const headers = getCopHeaders()

      // 1. Create framework session
      const createRes = await fetch('/api/frameworks', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `5W1H: ${session.name || 'Investigation'}`,
          description: `Starbursting analysis for COP session ${session.id}`,
          framework_type: 'starbursting',
          workspace_id: session.workspace_id,
          data: { entries: questions },
        }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error || `Failed to create framework (${createRes.status})`)
      }

      const { id: newFrameworkId } = await createRes.json()
      if (!newFrameworkId) throw new Error('No framework ID returned')

      // 2. Link framework to COP session
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

      // 3. Update local state — show the questions immediately
      setStarburst({
        id: String(newFrameworkId),
        questions,
      })

      // Also update session.linked_frameworks in-place so re-renders work
      session.linked_frameworks = updated

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
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

            {/* Open full view link */}
            <div className="pt-3">
              <a
                href={`/dashboard/analysis-frameworks/starbursting/${starburst.id}/view`}
                className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open full starbursting view
              </a>
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
                    Generating 5W1H...
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
              Generate 5W1H questions to guide the investigation systematically.
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
