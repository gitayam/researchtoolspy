'use client'

import { useState } from 'react'
import { 
  Calculator, 
  Info, 
  ChevronDown,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ScaleType,
  ScoreOption,
  EvidenceWeight,
  ACHScore,
  LOGARITHMIC_SCORES,
  LINEAR_SCORES,
  getScoreOption,
  calculateEffectiveStrength
} from '@/lib/ach-scoring'

interface ACHEnhancedScoringProps {
  hypothesisId: string
  hypothesisText: string
  evidenceId: string
  evidenceText: string
  currentScore?: number
  currentWeight?: EvidenceWeight
  evidenceCredibility?: number
  scaleType: ScaleType
  onScoreChange: (score: ACHScore) => void
}

export function ACHEnhancedScoring({
  hypothesisId,
  hypothesisText,
  evidenceId,
  evidenceText,
  currentScore = 0,
  currentWeight = { credibility: 3, relevance: 3 },
  evidenceCredibility,
  scaleType,
  onScoreChange
}: ACHEnhancedScoringProps) {
  const [selectedScore, setSelectedScore] = useState(currentScore)
  const [weight, setWeight] = useState<EvidenceWeight>(currentWeight)
  const [showWeightControls, setShowWeightControls] = useState(false)

  const scoreOptions = scaleType === 'logarithmic' ? LOGARITHMIC_SCORES : LINEAR_SCORES
  const currentOption = getScoreOption(selectedScore, scaleType)

  const handleScoreSelect = (value: number) => {
    setSelectedScore(value)
    onScoreChange({
      hypothesisId,
      evidenceId,
      score: value,
      weight
    })
  }

  const handleWeightChange = (newWeight: EvidenceWeight) => {
    setWeight(newWeight)
    onScoreChange({
      hypothesisId,
      evidenceId,
      score: selectedScore,
      weight: newWeight
    })
  }

  const getScoreIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />
    if (value < 0) return <TrendingDown className="h-4 w-4" />
    return <Minus className="h-4 w-4" />
  }

  const getScoreColor = (value: number) => {
    if (value > 8) return 'text-green-700 dark:text-green-300'
    if (value > 3) return 'text-green-600 dark:text-green-400'
    if (value > 0) return 'text-green-500 dark:text-green-400'
    if (value < -8) return 'text-red-700 dark:text-red-300'
    if (value < -3) return 'text-red-600 dark:text-red-400'
    if (value < 0) return 'text-red-500 dark:text-red-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  return (
    <div className="space-y-4">
      {/* Score Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Consistency Score</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  Rate how this evidence relates to the hypothesis using a 
                  {scaleType === 'logarithmic' ? ' logarithmic (Fibonacci)' : ' linear'} scale
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between",
                currentOption && currentOption.color
              )}
            >
              <span className="flex items-center gap-2">
                {getScoreIcon(selectedScore)}
                {currentOption?.label || 'Select Score'}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-lg" align="start" side="bottom" sideOffset={4}>
            <div className="max-h-96 overflow-y-auto">
              {scoreOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleScoreSelect(option.value)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors",
                    "border-b border-gray-100 dark:border-gray-600 last:border-b-0",
                    selectedScore === option.value && "bg-gray-50 dark:bg-slate-700"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className={cn(
                        "font-medium flex items-center gap-2",
                        // Better contrast for dark mode - use explicit colors based on score value
                        option.value > 8 && "text-green-700 dark:text-green-300",
                        option.value > 3 && option.value <= 8 && "text-green-600 dark:text-green-400",
                        option.value > 0 && option.value <= 3 && "text-green-500 dark:text-green-400",
                        option.value === 0 && "text-gray-600 dark:text-gray-300",
                        option.value < 0 && option.value >= -3 && "text-red-500 dark:text-red-400",
                        option.value < -3 && option.value >= -8 && "text-red-600 dark:text-red-400",
                        option.value < -8 && "text-red-700 dark:text-red-300"
                      )}>
                        {getScoreIcon(option.value)}
                        <span className="truncate">{option.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{option.description}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn("ml-2 shrink-0", getScoreColor(option.value))}
                    >
                      {option.value > 0 ? '+' : ''}{option.value}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Evidence Weight Controls */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowWeightControls(!showWeightControls)}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Evidence Weight
          </span>
          <Badge variant="secondary">
            {((weight.credibility * weight.relevance) / 25 * 100).toFixed(0)}%
          </Badge>
        </Button>

        {showWeightControls && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Credibility</Label>
                  <span className="text-sm text-gray-500">{weight.credibility}/5</span>
                </div>
                <Slider
                  value={[weight.credibility]}
                  onValueChange={([value]) => handleWeightChange({ ...weight, credibility: value })}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  How reliable is this evidence source?
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Relevance</Label>
                  <span className="text-sm text-gray-500">{weight.relevance}/5</span>
                </div>
                <Slider
                  value={[weight.relevance]}
                  onValueChange={([value]) => handleWeightChange({ ...weight, relevance: value })}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  How directly related is this evidence to the hypothesis?
                </p>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Combined Weight</span>
                  <Badge variant="default">
                    {((weight.credibility * weight.relevance) / 25 * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Effective Strength Display */}
      {evidenceCredibility && selectedScore !== 0 && (
        <div className="mt-4">
          <Card className="border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Effective Evidence Strength
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    {(() => {
                      const strength = calculateEffectiveStrength(selectedScore, evidenceCredibility, scaleType)
                      return strength.strengthDescription
                    })()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                    {(() => {
                      const strength = calculateEffectiveStrength(selectedScore, evidenceCredibility, scaleType)
                      const effective = strength.effectiveScore
                      return `${effective > 0 ? '+' : ''}${effective.toFixed(1)}`
                    })()}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    vs {selectedScore > 0 ? '+' : ''}{selectedScore} claimed
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-600">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Evidence credibility: {evidenceCredibility}/13 
                  ({evidenceCredibility >= 8 ? 'High' : evidenceCredibility >= 5 ? 'Medium' : 'Low'})
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

interface ACHScaleSelectionProps {
  currentScale: ScaleType
  onScaleChange: (scale: ScaleType) => void
}

export function ACHScaleSelection({ currentScale, onScaleChange }: ACHScaleSelectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Scoring Scale
        </CardTitle>
        <CardDescription>
          Choose between logarithmic (human perception) or linear (organizational) scaling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={currentScale} onValueChange={(value) => onScaleChange(value as ScaleType)}>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <RadioGroupItem value="logarithmic" className="mt-1" />
              <div className="space-y-1">
                <div className="font-medium">Logarithmic Scale (Fibonacci)</div>
                <p className="text-sm text-gray-500">
                  Uses values: 1, 3, 5, 8, 13 - Better matches human perception of differences
                </p>
                <div className="flex gap-2 mt-2">
                  {[1, 3, 5, 8, 13].map(val => (
                    <Badge key={val} variant="outline" className="text-xs bg-white dark:bg-slate-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                      {val}
                    </Badge>
                  ))}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <RadioGroupItem value="linear" className="mt-1" />
              <div className="space-y-1">
                <div className="font-medium">Linear Scale</div>
                <p className="text-sm text-gray-500">
                  Uses values: 1, 2, 3, 4, 5 - Standard organizational requirement
                </p>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <Badge key={val} variant="outline" className="text-xs bg-white dark:bg-slate-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                      {val}
                    </Badge>
                  ))}
                </div>
              </div>
            </label>
          </div>
        </RadioGroup>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Logarithmic scaling better represents how humans perceive 
              differences in evidence strength, while linear scaling may be required by 
              organizational standards.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}