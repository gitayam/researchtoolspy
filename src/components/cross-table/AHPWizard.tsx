/**
 * AHPWizard — Step-through dialog for pairwise comparisons.
 *
 * 1-9 scale slider per pair, progress indicator, running CR display.
 * Disabled if >12 criteria.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  createIdentityMatrix,
  setComparison,
  computeAHP,
  pairwiseCount,
} from '@/lib/cross-table/engine/ahp'
import type { CrossTableColumn } from '@/lib/cross-table/types'

// ── Saaty scale labels ──────────────────────────────────────────

const SCALE_LABELS: Record<number, string> = {
  1: 'Equal',
  2: 'Slight',
  3: 'Moderate',
  4: 'Moderate+',
  5: 'Strong',
  6: 'Strong+',
  7: 'Very Strong',
  8: 'Very Strong+',
  9: 'Extreme',
}

function scaleLabel(value: number): string {
  if (value >= 1) return SCALE_LABELS[Math.round(value)] ?? `${value.toFixed(1)}`
  const inv = Math.round(1 / value)
  return `1/${inv} (${SCALE_LABELS[inv] ?? inv})`
}

// ── Props ───────────────────────────────────────────────────────

interface AHPWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: CrossTableColumn[]
  initialMatrix?: number[][]
  onComplete: (weights: number[], matrix: number[][], cr: number) => void
}

// ── Component ───────────────────────────────────────────────────

export function AHPWizard({
  open,
  onOpenChange,
  columns,
  initialMatrix,
  onComplete,
}: AHPWizardProps) {
  const n = columns.length
  const totalPairs = pairwiseCount(n)

  // Build pairs list
  const pairs = useMemo(() => {
    const p: { i: number; j: number }[] = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        p.push({ i, j })
      }
    }
    return p
  }, [n])

  const [matrix, setMatrix] = useState<number[][]>(() =>
    initialMatrix && initialMatrix.length === n
      ? initialMatrix.map((row) => [...row])
      : createIdentityMatrix(n)
  )
  const [step, setStep] = useState(0)

  // Reset when dialog opens or columns change
  useEffect(() => {
    if (open) {
      setMatrix(
        initialMatrix && initialMatrix.length === n
          ? initialMatrix.map((row) => [...row])
          : createIdentityMatrix(n)
      )
      setStep(0)
    }
  }, [open, n, initialMatrix])

  // Running AHP result
  const ahpResult = useMemo(() => computeAHP(matrix), [matrix])

  const currentPair = pairs[step]

  // Slider value: we use a single axis from -8 to +8 where:
  //   -8 = j is 9x more important, 0 = equal, +8 = i is 9x more important
  const currentMatrixValue = currentPair ? matrix[currentPair.i][currentPair.j] : 1
  const sliderValue = currentMatrixValue >= 1
    ? currentMatrixValue - 1
    : -(1 / currentMatrixValue - 1)

  const handleSliderChange = useCallback(
    ([v]: number[]) => {
      if (!currentPair) return
      const actualValue = v >= 0 ? v + 1 : 1 / (-v + 1)
      setMatrix((prev) => setComparison(prev, currentPair.i, currentPair.j, actualValue))
    },
    [currentPair]
  )

  const handleComplete = () => {
    onComplete(ahpResult.weights, matrix, ahpResult.cr)
  }

  if (n > 12) return null

  const progress = totalPairs > 0 ? ((step + 1) / totalPairs) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AHP Pairwise Comparisons</DialogTitle>
          <DialogDescription>
            Compare each pair of criteria. {totalPairs} comparisons total.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of {totalPairs}</span>
            <div className="flex items-center gap-2">
              <span>CR: {(ahpResult.cr * 100).toFixed(1)}%</span>
              <Badge
                variant={ahpResult.consistent ? 'default' : 'destructive'}
                className="text-[10px]"
              >
                {ahpResult.consistent ? 'Consistent' : 'Inconsistent'}
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Comparison UI */}
        {currentPair && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Which criterion is more important?
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-right">
                  <p className={cn(
                    'text-sm font-semibold',
                    sliderValue > 0 && 'text-[#4F5BFF]'
                  )}>
                    {columns[currentPair.i].label}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">vs</span>
                <div className="flex-1 text-left">
                  <p className={cn(
                    'text-sm font-semibold',
                    sliderValue < 0 && 'text-[#4F5BFF]'
                  )}>
                    {columns[currentPair.j].label}
                  </p>
                </div>
              </div>
            </div>

            {/* Scale slider */}
            <div className="px-4">
              <Slider
                value={[sliderValue]}
                onValueChange={handleSliderChange}
                min={-8}
                max={8}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>9x {columns[currentPair.j].label.slice(0, 8)}</span>
                <span>Equal</span>
                <span>9x {columns[currentPair.i].label.slice(0, 8)}</span>
              </div>
            </div>

            {/* Current value label */}
            <div className="text-center">
              <Badge variant="outline" className="text-sm font-mono">
                {scaleLabel(currentMatrixValue)}
              </Badge>
            </div>
          </div>
        )}

        {/* CR warning */}
        {!ahpResult.consistent && step > 2 && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Consistency ratio exceeds 10%. Consider revising some comparisons.</span>
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {step < totalPairs - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleComplete}
              className="bg-[#4F5BFF] hover:bg-[#4F5BFF]/90"
            >
              <Check className="h-4 w-4 mr-1" />
              Apply Weights
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
