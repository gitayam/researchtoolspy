import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Star, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CopSession } from '@/types/cop'

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

  // Find linked starbursting framework session
  const starburstId = (session.linked_frameworks ?? []).find(id =>
    typeof id === 'string' && id.length > 0
  ) ?? null

  useEffect(() => {
    if (!starburstId) return
    let cancelled = false

    async function fetchStarburst() {
      setLoading(true)
      try {
        const res = await fetch(`/api/frameworks/${starburstId}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setStarburst({
          id: data.id ?? starburstId!,
          questions: data.questions ?? data.entries ?? [],
        })
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStarburst()
    return () => { cancelled = true }
  }, [starburstId])

  const toggleCategory = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
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
      <div className="px-3 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
          Questions
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {loading ? (
          <p className="text-xs text-gray-500 text-center py-4">Loading questions...</p>
        ) : starburstId ? (
          <>
            {/* 5W1H Categories */}
            {CATEGORIES.map(cat => {
              const stats = getCategoryStats(cat.key)
              const isExpanded = expanded[cat.key] ?? false
              const catQuestions = starburst?.questions?.filter(
                q => q.category?.toLowerCase() === cat.key.toLowerCase()
              ) ?? []

              return (
                <div key={cat.key}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-gray-500 shrink-0" />
                    )}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-medium text-gray-200 flex-1 text-left">
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {stats.pct}%
                    </span>
                    {/* Progress bar */}
                    <div className="w-10 h-1 rounded-full bg-gray-700 overflow-hidden shrink-0">
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
                          className="text-xs text-gray-400 py-0.5 pl-2 border-l border-gray-700"
                        >
                          <span className={q.answer ? 'text-gray-400' : 'text-amber-400'}>
                            {q.question}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && catQuestions.length === 0 && (
                    <p className="ml-6 mb-1 text-[10px] text-gray-600 py-0.5">
                      No questions in this category.
                    </p>
                  )}
                </div>
              )
            })}

            {/* Open full view link */}
            <div className="pt-3">
              <a
                href={`/dashboard/frameworks/${starburstId}`}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open full starbursting view
              </a>
            </div>
          </>
        ) : (
          <div className="text-center py-6 space-y-3">
            <Star className="h-6 w-6 text-gray-600 mx-auto" />
            <p className="text-xs text-gray-500">
              No starbursting session linked.
            </p>
            <Button size="sm" variant="outline" className="text-xs" disabled>
              Generate Questions
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
