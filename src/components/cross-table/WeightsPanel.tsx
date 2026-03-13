/**
 * WeightsPanel — Manual weight sliders with live normalization,
 * equal distribution button, weight bar chart, AHP wizard trigger.
 */

import { useMemo, useState } from 'react'
import { Scale, Equal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useCrossTable } from './cross-table-context'
import { AHPWizard } from './AHPWizard'
import { normalizeWeights, getWeights } from '@/lib/cross-table/engine/weighting'
import type { WeightingMethod } from '@/lib/cross-table/types'

const METHOD_LABELS: Record<WeightingMethod, string> = {
  equal: 'Equal Weights',
  manual: 'Manual Weights',
  ahp: 'AHP Weights',
}

export function WeightsPanel() {
  const { state, dispatch } = useCrossTable()
  const { columns, weighting } = state.table.config
  const [ahpOpen, setAhpOpen] = useState(false)

  const sortedCols = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns]
  )

  const normalizedWeights = useMemo(
    () => getWeights(sortedCols, weighting),
    [sortedCols, weighting]
  )

  const maxWeight = Math.max(...normalizedWeights, 0.01)

  // ── Set weighting method ──────────────────────────────────

  const setMethod = (method: WeightingMethod) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      config: { weighting: { ...weighting, method } },
    })
  }

  // ── Equal distribution ────────────────────────────────────

  const distributeEqual = () => {
    const equalW = 1
    const updated = columns.map((c) => ({ ...c, weight: equalW }))
    dispatch({
      type: 'UPDATE_CONFIG',
      config: {
        columns: updated,
        weighting: { ...weighting, method: 'equal' as WeightingMethod },
      },
    })
  }

  // ── Update a single column weight ─────────────────────────

  const updateWeight = (colId: string, rawWeight: number) => {
    const updated = columns.map((c) =>
      c.id === colId ? { ...c, weight: rawWeight } : c
    )
    dispatch({
      type: 'UPDATE_CONFIG',
      config: {
        columns: updated,
        weighting: { ...weighting, method: 'manual' as WeightingMethod },
      },
    })
  }

  // ── AHP complete callback ─────────────────────────────────

  const handleAHPComplete = (weights: number[], matrix: number[][], cr: number) => {
    const updated = columns.map((c, i) => {
      const idx = sortedCols.findIndex((sc) => sc.id === c.id)
      return { ...c, weight: weights[idx >= 0 ? idx : i] ?? c.weight }
    })
    dispatch({
      type: 'UPDATE_CONFIG',
      config: {
        columns: updated,
        weighting: {
          method: 'ahp' as WeightingMethod,
          ahp_matrix: matrix,
          ahp_cr: cr,
        },
      },
    })
    setAhpOpen(false)
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Scale className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Add criteria in the Matrix tab to set weights.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Method selector + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {METHOD_LABELS[weighting.method] ?? weighting.method}
          </Badge>
          {weighting.method === 'ahp' && weighting.ahp_cr !== undefined && (
            <Badge
              variant={weighting.ahp_cr <= 0.1 ? 'default' : 'destructive'}
              className="text-[10px]"
            >
              CR: {(weighting.ahp_cr * 100).toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={distributeEqual}>
            <Equal className="h-4 w-4 mr-1" />
            Equal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAhpOpen(true)}
            disabled={columns.length > 12}
            title={columns.length > 12 ? 'AHP supports at most 12 criteria' : 'Run AHP Wizard'}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            AHP Wizard
          </Button>
        </div>
      </div>

      {/* Weight sliders */}
      <div className="space-y-4">
        {sortedCols.map((col, idx) => {
          const norm = normalizedWeights[idx] ?? 0
          const pct = (norm * 100).toFixed(1)
          const barWidth = maxWeight > 0 ? (norm / maxWeight) * 100 : 0

          return (
            <div key={col.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate max-w-[200px]">{col.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
              </div>

              {/* Slider */}
              <Slider
                value={[col.weight]}
                onValueChange={([v]) => updateWeight(col.id, v)}
                min={0}
                max={10}
                step={0.5}
                className="w-full"
              />

              {/* Bar visualization */}
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4F5BFF] rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Total check */}
      <div className="text-xs text-muted-foreground text-center">
        Weights are automatically normalized to sum to 100%.
      </div>

      {/* AHP Wizard Dialog */}
      <AHPWizard
        open={ahpOpen}
        onOpenChange={setAhpOpen}
        columns={sortedCols}
        initialMatrix={weighting.ahp_matrix}
        onComplete={handleAHPComplete}
      />
    </div>
  )
}
