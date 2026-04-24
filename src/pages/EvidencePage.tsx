import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Tag, Clock, FileText, MoreHorizontal, Trash2, Edit, Archive, CheckCircle2, XCircle, AlertCircle, Target, TrendingUp, Zap, BookOpen, Network, Globe, Filter, CircleDashed, User, MapPin, Calendar, HelpCircle, Shield, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { EvidenceItem, EvidenceFilter, EvidenceStatistics } from '@/types/evidence'
import { EvidenceType, EvidenceStatus, EvidenceLevel, PriorityLevel } from '@/types/evidence'
import { cn } from '@/lib/utils'
import { EvidenceItemForm } from '@/components/evidence/EvidenceItemForm'
import { evidenceToCitation } from '@/utils/evidence-to-citation'
import { addCitation } from '@/utils/citation-library'
import { useTranslation } from 'react-i18next'
import { getCopHeaders } from '@/lib/cop-auth'

// --- Completeness scoring ---

interface EvidenceCompleteness {
  score: number       // 0-100
  total: number       // total checkable fields
  filled: number      // filled fields
  gaps: string[]      // human-readable gap labels
}

function getCompleteness(item: EvidenceItem): EvidenceCompleteness {
  const checks: [boolean, string][] = [
    [!!item.description, 'Description'],
    [!!item.source_url, 'Source URL'],
    [!!item.source_name, 'Source name'],
    [!!item.who, 'Who'],
    [!!item.what, 'What'],
    [!!item.when_occurred, 'When'],
    [!!item.where_location, 'Where'],
    [!!item.why_purpose, 'Why'],
    [!!item.how_method, 'How'],
    [item.status === 'verified', 'Verified'],
  ]

  const filled = checks.filter(([ok]) => ok).length
  const gaps = checks.filter(([ok]) => !ok).map(([, label]) => label)

  return {
    score: Math.round((filled / checks.length) * 100),
    total: checks.length,
    filled,
    gaps,
  }
}

type GapFilter = 'all' | 'has_gaps' | 'no_source' | 'no_details' | 'unverified' | 'complete'

const GAP_FILTERS: { value: GapFilter; label: string; icon: typeof Filter }[] = [
  { value: 'all',         label: 'All',            icon: FileText },
  { value: 'has_gaps',    label: 'Has Gaps',        icon: CircleDashed },
  { value: 'no_source',   label: 'No Source',       icon: Globe },
  { value: 'no_details',  label: 'Missing Details',  icon: HelpCircle },
  { value: 'unverified',  label: 'Unverified',      icon: Clock },
  { value: 'complete',    label: 'Complete',         icon: CheckCircle2 },
]

function matchesGapFilter(item: EvidenceItem, gap: GapFilter): boolean {
  if (gap === 'all') return true
  const c = getCompleteness(item)
  switch (gap) {
    case 'has_gaps':    return c.score < 100
    case 'no_source':   return !item.source_url && !item.source_name
    case 'no_details':  return !item.who && !item.what && !item.when_occurred && !item.where_location
    case 'unverified':  return item.status !== 'verified'
    case 'complete':    return c.score === 100
    default:            return true
  }
}

// --- Completeness bar component ---

function CompletenessBar({ completeness }: { completeness: EvidenceCompleteness }) {
  const color = completeness.score === 100
    ? 'bg-green-500'
    : completeness.score >= 60
      ? 'bg-blue-500'
      : completeness.score >= 30
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${completeness.score}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{completeness.score}%</span>
    </div>
  )
}

// --- Gap pills (shows what's missing) ---

function GapPills({ gaps, onEdit }: { gaps: string[]; onEdit: () => void }) {
  if (gaps.length === 0) return null
  // Show first 3 gaps, then "+N more"
  const shown = gaps.slice(0, 3)
  const remaining = gaps.length - shown.length

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map(gap => (
        <button
          key={gap}
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
        >
          <CircleDashed className="h-2.5 w-2.5" />
          {gap}
        </button>
      ))}
      {remaining > 0 && (
        <button
          onClick={onEdit}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          +{remaining} more
        </button>
      )}
    </div>
  )
}

// --- Main page ---

export function EvidencePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [gapFilter, setGapFilter] = useState<GapFilter>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingEvidence, setEditingEvidence] = useState<any>(null)

  const loadEvidence = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/evidence-items', { headers: getCopHeaders(), signal })
      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence || [])
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Failed to load evidence:', error)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadEvidence(controller.signal)
    return () => controller.abort()
  }, [])

  const handleSaveEvidence = async (data: any) => {
    try {
      if (formMode === 'edit' && editingEvidence?.id) {
        const response = await fetch(`/api/evidence-items?id=${editingEvidence.id}`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify(data)
        })
        if (response.status === 401) throw new Error('Session expired. Please refresh to continue.')
        if (!response.ok) throw new Error('Failed to update evidence')
      } else {
        const response = await fetch('/api/evidence-items', {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify(data)
        })
        if (response.status === 401) throw new Error('Session expired. Please refresh to continue.')
        if (!response.ok) throw new Error('Failed to create evidence')
      }

      await loadEvidence()
      setFormOpen(false)
      setEditingEvidence(null)
    } catch (error) {
      console.error('Error saving evidence:', error)
      throw error
    }
  }

  const handleDeleteEvidence = async (id: number) => {
    if (!confirm(t('evidence.confirmDelete'))) return
    try {
      const response = await fetch(`/api/evidence-items?id=${id}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      if (response.ok) await loadEvidence()
    } catch (error) {
      console.error('Failed to delete evidence:', error)
      alert(t('evidence.deleteError'))
    }
  }

  const openCreateForm = () => {
    setFormMode('create')
    setEditingEvidence(null)
    setFormOpen(true)
  }

  const openEditForm = (evidence: any) => {
    setFormMode('edit')
    setEditingEvidence(evidence)
    setFormOpen(true)
  }

  const handleGenerateCitation = (item: EvidenceItem) => {
    try {
      const citation = evidenceToCitation(item, 'apa')
      addCitation(citation)
      alert(t('evidence.citationSuccess'))
    } catch (error) {
      console.error('Failed to generate citation:', error)
      alert(t('evidence.citationError'))
    }
  }

  // --- Filtering ---
  const filteredEvidence = useMemo(() => {
    return evidence.filter(item => {
      // Text search
      const term = searchTerm.toLowerCase()
      const matchesSearch = !term ||
        item.title.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.who?.toLowerCase().includes(term) ||
        item.what?.toLowerCase().includes(term) ||
        item.source_name?.toLowerCase().includes(term) ||
        item.tags.some(tag => tag.toLowerCase().includes(term))

      // Gap filter
      const matchesGap = matchesGapFilter(item, gapFilter)

      // Type filter
      const matchesType = typeFilter === 'all' || item.evidence_type === typeFilter

      return matchesSearch && matchesGap && matchesType
    })
  }, [evidence, searchTerm, gapFilter, typeFilter])

  // --- Stats ---
  const stats = useMemo(() => {
    const total = evidence.length
    const withGaps = evidence.filter(e => getCompleteness(e).score < 100).length
    const verified = evidence.filter(e => e.status === 'verified').length
    const noSource = evidence.filter(e => !e.source_url && !e.source_name).length
    const avgCompleteness = total > 0
      ? Math.round(evidence.reduce((sum, e) => sum + getCompleteness(e).score, 0) / total)
      : 0

    return { total, withGaps, verified, noSource, avgCompleteness }
  }, [evidence])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':     return CheckCircle2
      case 'pending':      return Clock
      case 'rejected':     return XCircle
      case 'needs_review': return AlertCircle
      default:             return Clock
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':     return 'text-green-500'
      case 'pending':      return 'text-yellow-500'
      case 'rejected':     return 'text-red-500'
      case 'needs_review': return 'text-orange-500'
      default:             return 'text-gray-500'
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('evidence.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {stats.total} items &middot; {stats.avgCompleteness}% avg completeness &middot; {stats.withGaps} with gaps
          </p>
        </div>
        <Button onClick={openCreateForm} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('evidence.addEvidence')}
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setGapFilter('all')}
          className={cn(
            'p-3 rounded-lg border text-left transition-colors',
            gapFilter === 'all' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-border hover:border-gray-400 dark:hover:border-gray-600'
          )}
        >
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </button>
        <button
          onClick={() => setGapFilter('has_gaps')}
          className={cn(
            'p-3 rounded-lg border text-left transition-colors',
            gapFilter === 'has_gaps' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-border hover:border-gray-400 dark:hover:border-gray-600'
          )}
        >
          <p className="text-xs text-muted-foreground">Research Debt</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.withGaps}</p>
        </button>
        <button
          onClick={() => setGapFilter('unverified')}
          className={cn(
            'p-3 rounded-lg border text-left transition-colors',
            gapFilter === 'unverified' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' : 'border-border hover:border-gray-400 dark:hover:border-gray-600'
          )}
        >
          <p className="text-xs text-muted-foreground">Unverified</p>
          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.total - stats.verified}
          </p>
        </button>
        <button
          onClick={() => setGapFilter('complete')}
          className={cn(
            'p-3 rounded-lg border text-left transition-colors',
            gapFilter === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border hover:border-gray-400 dark:hover:border-gray-600'
          )}
        >
          <p className="text-xs text-muted-foreground">Complete</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {stats.total - stats.withGaps}
          </p>
        </button>
      </div>

      {/* Search + filter chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={t('evidence.searchPlaceholder')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Gap filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {GAP_FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setGapFilter(value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors',
                gapFilter === value
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
              {value !== 'all' && (
                <span className="font-mono">
                  {evidence.filter(e => matchesGapFilter(e, value)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence List */}
      <div className="space-y-2">
        {filteredEvidence.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-1">
              {t('evidence.noEvidenceFound')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              {evidence.length === 0
                ? t('evidence.emptyStateMessage')
                : t('evidence.emptyFilterMessage')
              }
            </p>
            {evidence.length === 0 && (
              <Button onClick={openCreateForm} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('evidence.addFirstEvidence')}
              </Button>
            )}
          </Card>
        ) : (
          filteredEvidence.map((item) => {
            const completeness = getCompleteness(item)
            const StatusIcon = getStatusIcon(item.status)

            return (
              <Card
                key={item.id}
                className="hover:shadow-sm transition-shadow cursor-pointer group"
                onClick={() => openEditForm(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <StatusIcon className={cn('h-4 w-4 mt-1 flex-shrink-0', getStatusColor(item.status))} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {item.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                          {item.evidence_type.replace(/_/g, ' ')}
                        </Badge>
                        {item.priority === 'critical' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                            critical
                          </Badge>
                        )}
                        {item.priority === 'high' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 text-orange-600 dark:text-orange-400">
                            high
                          </Badge>
                        )}
                      </div>

                      {/* Description (truncated) */}
                      {item.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{item.description}</p>
                      )}

                      {/* Inline metadata chips */}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 flex-wrap">
                        {item.who && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.who}
                          </span>
                        )}
                        {item.when_occurred && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {item.when_occurred}
                          </span>
                        )}
                        {item.where_location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.where_location}
                          </span>
                        )}
                        {item.source_name && (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {item.source_name}
                          </span>
                        )}
                        {item.source_url && !item.source_name && (
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">
                              {(() => { try { return new URL(item.source_url).hostname } catch { return item.source_url } })()}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {item.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Gap pills (research debt) */}
                      {completeness.gaps.length > 0 && (
                        <GapPills gaps={completeness.gaps} onEdit={() => openEditForm(item)} />
                      )}
                    </div>

                    {/* Right side: completeness + actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16">
                        <CompletenessBar completeness={completeness} />
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => navigate('/dashboard/network-graph', {
                            state: {
                              highlightEntities: [`evidence_${item.id}`],
                              source: 'evidence',
                              title: item.title
                            }
                          })}>
                            <Network className="h-4 w-4 mr-2" />
                            View in Network
                          </DropdownMenuItem>
                          {item.source_url && (
                            <DropdownMenuItem onClick={() => window.open(item.source_url, '_blank')}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Source
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditForm(item)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('evidence.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerateCitation(item)}>
                            <BookOpen className="h-4 w-4 mr-2" />
                            {t('evidence.generateCitation')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteEvidence(item.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('evidence.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Evidence Form Modal */}
      <EvidenceItemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingEvidence(null)
        }}
        onSave={handleSaveEvidence}
        initialData={editingEvidence}
        mode={formMode}
      />
    </div>
  )
}
