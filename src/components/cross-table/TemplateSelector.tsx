/**
 * TemplateSelector — Card-based picker for cross-table templates.
 * Shows all 8 templates with descriptions and scoring method badges.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target,
  Route,
  BarChart3,
  GitCompare,
  AlertTriangle,
  SlidersHorizontal,
  ListOrdered,
  LayoutGrid,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTemplates } from '@/lib/cross-table/engine/templates'
import type { TemplateConfig, TemplateType } from '@/lib/cross-table/types'

// ── Icon mapping per template type ──────────────────────────────

const TEMPLATE_ICONS: Record<TemplateType, typeof Target> = {
  carvar: Target,
  coa: Route,
  weighted: BarChart3,
  pugh: GitCompare,
  risk: AlertTriangle,
  'kepner-tregoe': SlidersHorizontal,
  prioritization: ListOrdered,
  blank: LayoutGrid,
}

// ── Scoring method display labels ───────────────────────────────

const SCORING_LABELS: Record<string, string> = {
  numeric: 'Numeric',
  likert: 'Likert Scale',
  traffic: 'Traffic Light',
  ternary: '+/0/-',
  binary: 'Yes/No',
  ach: 'ACH',
}

interface TemplateSelectorProps {
  onSelect: (templateType: TemplateType) => void
  loading?: boolean
}

export function TemplateSelector({ onSelect, loading }: TemplateSelectorProps) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<TemplateType | null>(null)
  const templates = getTemplates()

  const handleSelect = (t: TemplateConfig) => {
    setSelected(t.type)
    onSelect(t.type)
  }

  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/tools/cross-table')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Choose a Template</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a template to get started, or create a blank matrix.
          </p>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {templates.map((t) => {
          const Icon = TEMPLATE_ICONS[t.type] ?? LayoutGrid
          const isSelected = selected === t.type
          const isLoading = loading && isSelected

          return (
            <Card
              key={t.type}
              className={cn(
                'cursor-pointer border border-slate-200 transition-all duration-300',
                isSelected
                  ? 'ring-2 ring-[#4F5BFF] border-[#4F5BFF] shadow-lg'
                  : 'hover:shadow-xl hover:scale-[1.02]',
                isLoading && 'opacity-70 pointer-events-none'
              )}
              onClick={() => !loading && handleSelect(t)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#4F5BFF]/10 p-2.5 shrink-0">
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 text-[#4F5BFF] animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5 text-[#4F5BFF]" />
                    )}
                  </div>
                  <CardTitle className="text-sm font-semibold">{t.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs line-clamp-2 mb-3">
                  {t.description}
                </CardDescription>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {SCORING_LABELS[t.scoring.method] ?? t.scoring.method}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {t.default_columns.length} criteria
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {t.weighting.method}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
