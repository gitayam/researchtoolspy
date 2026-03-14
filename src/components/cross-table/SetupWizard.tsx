/**
 * SetupWizard — Optional AI-enhanced setup step between template selection
 * and table creation. Users can describe their decision context and get
 * AI-suggested criteria and alternatives before entering the editor.
 */

import { useState, useCallback } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  X,
  Lightbulb,
  SkipForward,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'
import type { TemplateType } from '@/lib/cross-table/types'

// ── Types ───────────────────────────────────────────────────────

interface Suggestion {
  label: string
  description: string
  selected: boolean
}

interface SetupWizardProps {
  templateType: TemplateType
  templateLabel: string
  onBack: () => void
  onCreate: (title: string, criteria: Suggestion[], rows: Suggestion[]) => void
  loading?: boolean
}

// ── Component ───────────────────────────────────────────────────

export function SetupWizard({
  templateType,
  templateLabel,
  onBack,
  onCreate,
  loading: createLoading,
}: SetupWizardProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // AI suggestions state
  const [criteria, setCriteria] = useState<Suggestion[]>([])
  const [rows, setRows] = useState<Suggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  // ── Fetch AI suggestions ────────────────────────────────────

  const fetchSuggestions = useCallback(async () => {
    if (!title.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/cross-table/ai/suggest-setup', {
        method: 'POST',
        headers: { ...getCopHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `${title.trim()}${description.trim() ? '. ' + description.trim() : ''}`,
          template_type: templateType,
        }),
      })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = await res.json()

      setCriteria(
        (data.criteria ?? []).map((c: any) => ({ ...c, selected: true }))
      )
      setRows(
        (data.rows ?? []).map((r: any) => ({ ...r, selected: true }))
      )
      setHasFetched(true)
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Failed to get suggestions')
    } finally {
      setAiLoading(false)
    }
  }, [title, description, templateType])

  // ── Toggle suggestion ───────────────────────────────────────

  const toggleCriterion = (idx: number) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c))
    )
  }

  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    )
  }

  // ── Create handler ──────────────────────────────────────────

  const handleCreate = () => {
    const finalTitle = title.trim() || 'Untitled Cross Table'
    onCreate(
      finalTitle,
      criteria.filter((c) => c.selected),
      rows.filter((r) => r.selected)
    )
  }

  const handleSkip = () => {
    onCreate(title.trim() || 'Untitled Cross Table', [], [])
  }

  const selectedCriteria = criteria.filter((c) => c.selected).length
  const selectedRows = rows.filter((r) => r.selected).length

  return (
    <div className="p-4 md:p-6 w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Templates</span>
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold truncate">Set Up Your Table</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px]">{templateLabel}</Badge>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Describe your decision for AI-suggested criteria
            </p>
          </div>
        </div>
      </div>

      {/* Context input */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#4F5BFF]" />
            Decision Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. Choosing a new office location"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Additional context <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              placeholder="e.g. Budget under $50k, team of 20, hybrid work model"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={fetchSuggestions}
              disabled={!title.trim() || aiLoading}
              className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90 text-sm"
              size="sm"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              {hasFetched ? 'Regenerate Suggestions' : 'Get AI Suggestions'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={createLoading}
              className="text-xs text-muted-foreground"
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Skip, use template defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Loading skeleton */}
      {aiLoading && !hasFetched && (
        <Card className="border border-slate-200">
          <CardContent className="py-6 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
            <Skeleton className="h-4 w-32 mt-4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/6" />
          </CardContent>
        </Card>
      )}

      {/* AI Error */}
      {aiError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {aiError}
        </div>
      )}

      {/* Suggested Criteria */}
      {hasFetched && criteria.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#4F5BFF]" />
                Suggested Criteria
              </span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {selectedCriteria}/{criteria.length} selected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <SuggestionRow
                  key={i}
                  label={c.label}
                  description={c.description}
                  selected={c.selected}
                  onToggle={() => toggleCriterion(i)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested Alternatives */}
      {hasFetched && rows.length > 0 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#D4673A]" />
                Suggested Alternatives
              </span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {selectedRows}/{rows.length} selected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <SuggestionRow
                  key={i}
                  label={r.label}
                  description={r.description}
                  selected={r.selected}
                  onToggle={() => toggleRow(i)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create button */}
      {(hasFetched || title.trim()) && (
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            onClick={handleCreate}
            disabled={createLoading || (!title.trim())}
            className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
          >
            {createLoading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-1.5" />
            )}
            Create Table
            {hasFetched && (selectedCriteria > 0 || selectedRows > 0) && (
              <span className="text-xs ml-1.5 opacity-80">
                ({selectedCriteria} criteria, {selectedRows} alternatives)
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Suggestion Row ──────────────────────────────────────────────

function SuggestionRow({
  label,
  description,
  selected,
  onToggle,
}: {
  label: string
  description: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer',
        selected
          ? 'border-[#4F5BFF]/30 bg-[#4F5BFF]/5'
          : 'border-slate-200 bg-transparent opacity-60'
      )}
    >
      <div
        className={cn(
          'mt-0.5 shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-colors',
          selected
            ? 'bg-[#4F5BFF] border-[#4F5BFF] text-white'
            : 'border-slate-300'
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        )}
      </div>
    </button>
  )
}
