import { useState } from 'react'
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { CriticalVulnerability, ScoringSystem } from '@/types/cog-analysis'
import { calculateVulnerabilityCompositeScore } from '@/types/cog-analysis'

interface COGQuickScoreProps {
  open: boolean
  onClose: () => void
  vulnerabilities: CriticalVulnerability[]
  onUpdate: (vulnerabilities: CriticalVulnerability[]) => void
  scoringSystem: ScoringSystem
}

type ScorePreset = 'high' | 'medium' | 'low' | 'custom'

const SCORE_PRESETS = {
  high: {
    name: 'High Priority',
    description: 'Critical vulnerability requiring immediate action',
    icon: TrendingUp,
    color: 'text-red-600',
    scores: { linear: { impact_on_cog: 5, attainability: 4, follow_up_potential: 5 } },
  },
  medium: {
    name: 'Medium Priority',
    description: 'Important vulnerability for medium-term planning',
    icon: Minus,
    color: 'text-yellow-600',
    scores: { linear: { impact_on_cog: 3, attainability: 3, follow_up_potential: 3 } },
  },
  low: {
    name: 'Low Priority',
    description: 'Monitor but not immediate priority',
    icon: TrendingDown,
    color: 'text-green-600',
    scores: { linear: { impact_on_cog: 2, attainability: 2, follow_up_potential: 2 } },
  },
}

export function COGQuickScore({ open, onClose, vulnerabilities, onUpdate, scoringSystem }: COGQuickScoreProps) {
  const [workingVulns, setWorkingVulns] = useState<CriticalVulnerability[]>(vulnerabilities)
  const [selectedPreset, setSelectedPreset] = useState<ScorePreset>('custom')

  const applyPreset = (vulnId: string, preset: ScorePreset) => {
    if (preset === 'custom') return

    const presetScores = SCORE_PRESETS[preset].scores.linear
    const updated = workingVulns.map((v) => {
      if (v.id === vulnId && scoringSystem !== 'custom') {
        const newVuln = {
          ...v,
          scoring: presetScores,
          composite_score: calculateVulnerabilityCompositeScore({ ...v, scoring: presetScores }),
        }
        return newVuln
      }
      return v
    })
    setWorkingVulns(updated)
  }

  const updateScore = (vulnId: string, field: 'impact_on_cog' | 'attainability' | 'follow_up_potential', value: number) => {
    const updated = workingVulns.map((v) => {
      if (v.id === vulnId && v.scoring) {
        const newScoring = { ...v.scoring, [field]: value }
        return {
          ...v,
          scoring: newScoring,
          composite_score: calculateVulnerabilityCompositeScore({ ...v, scoring: newScoring }),
        }
      }
      return v
    })
    setWorkingVulns(updated)
  }

  const handleSave = () => {
    onUpdate(workingVulns)
    onClose()
  }

  const getSortedVulns = () => {
    return [...workingVulns].sort((a, b) => b.composite_score - a.composite_score)
  }

  const getScoreColor = (score: number): string => {
    if (score >= 12) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
    if (score >= 9) return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
    if (score >= 6) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
  }

  if (scoringSystem === 'custom') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick-Score Mode</DialogTitle>
            <DialogDescription>
              Quick-Score mode is currently only available for linear and logarithmic scoring systems.
              Please use the advanced form for custom scoring criteria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick-Score Mode
          </DialogTitle>
          <DialogDescription>
            Rapidly score all vulnerabilities using presets or custom values. Sorted by composite score in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset Legend */}
          <Card className="bg-blue-50 dark:bg-blue-950">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Score Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(SCORE_PRESETS) as [ScorePreset, typeof SCORE_PRESETS.high][]).map(([key, preset]) => {
                  const Icon = preset.icon
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <Icon className={`h-4 w-4 ${preset.color}`} />
                      <div>
                        <div className="font-semibold">{preset.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{preset.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Vulnerabilities Table */}
          <div className="space-y-2">
            {getSortedVulns().map((vuln, index) => (
              <Card key={vuln.id} className="bg-gray-50 dark:bg-gray-900">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <Badge className={getScoreColor(vuln.composite_score)}>
                            Score: {vuln.composite_score}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{vuln.vulnerability}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                          {vuln.description}
                        </p>
                      </div>
                      <Select value="custom" onValueChange={(value: ScorePreset) => applyPreset(vuln.id, value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Apply preset..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom...</SelectItem>
                          <SelectItem value="high">🔴 High Priority</SelectItem>
                          <SelectItem value="medium">🟡 Medium Priority</SelectItem>
                          <SelectItem value="low">🟢 Low Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Scoring Sliders */}
                    {vuln.scoring && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Impact (I)</span>
                            <Badge variant="outline" className="text-xs">
                              {vuln.scoring.impact_on_cog}
                            </Badge>
                          </div>
                          <Slider
                            value={[vuln.scoring.impact_on_cog]}
                            onValueChange={([v]) => updateScore(vuln.id, 'impact_on_cog', v)}
                            min={1}
                            max={scoringSystem === 'linear' ? 5 : 12}
                            step={1}
                            className="cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Attainability (A)</span>
                            <Badge variant="outline" className="text-xs">
                              {vuln.scoring.attainability}
                            </Badge>
                          </div>
                          <Slider
                            value={[vuln.scoring.attainability]}
                            onValueChange={([v]) => updateScore(vuln.id, 'attainability', v)}
                            min={1}
                            max={scoringSystem === 'linear' ? 5 : 12}
                            step={1}
                            className="cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Follow-up (F)</span>
                            <Badge variant="outline" className="text-xs">
                              {vuln.scoring.follow_up_potential}
                            </Badge>
                          </div>
                          <Slider
                            value={[vuln.scoring.follow_up_potential]}
                            onValueChange={([v]) => updateScore(vuln.id, 'follow_up_potential', v)}
                            min={1}
                            max={scoringSystem === 'linear' ? 5 : 12}
                            step={1}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {workingVulns.length === 0 && (
              <Card>
                <CardContent className="text-center py-8 text-gray-500">
                  No vulnerabilities to score
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Zap className="h-4 w-4 mr-2" />
            Apply Scores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
