import { useState, useMemo } from 'react'
import { Plus, X, Info, Star, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ACHAnalysis, ACHHypothesis, ACHEvidenceLink, ACHScore } from '@/types/ach'
import { LOGARITHMIC_SCORES, LINEAR_SCORES, type ScoreOption } from '@/lib/ach-scoring'
import { calculateEvidenceQuality, getQualityColor, getQualityIcon, type EvidenceQuality } from '@/lib/evidence-quality'
import { cn } from '@/lib/utils'

interface ACHMatrixProps {
  analysis: ACHAnalysis
  onUpdateScore: (hypothesisId: string, evidenceId: string, score: number, notes?: string) => Promise<void>
  onAddEvidence: () => void
  onRemoveEvidence: (linkId: string) => void
}

export function ACHMatrix({
  analysis,
  onUpdateScore,
  onAddEvidence,
  onRemoveEvidence
}: ACHMatrixProps) {
  const [scoringCell, setScoringCell] = useState<{ hypothesisId: string; evidenceId: string } | null>(null)
  const [selectedScore, setSelectedScore] = useState<number>(0)
  const [scoreNotes, setScoreNotes] = useState('')

  const hypotheses = analysis.hypotheses || []
  const evidence = analysis.evidence || []
  const scores = analysis.scores || []

  const scaleOptions = analysis.scale_type === 'logarithmic' ? LOGARITHMIC_SCORES : LINEAR_SCORES

  // Calculate evidence quality for each piece of evidence
  const evidenceQuality = useMemo(() => {
    const qualityMap = new Map<string, EvidenceQuality>()
    evidence.forEach(ev => {
      qualityMap.set(ev.evidence_id, calculateEvidenceQuality(ev))
    })
    return qualityMap
  }, [evidence])

  const getScore = (hypothesisId: string, evidenceId: string): ACHScore | undefined => {
    return scores.find(s => s.hypothesis_id === hypothesisId && s.evidence_id === evidenceId)
  }

  const getScoreOption = (value: number): ScoreOption | undefined => {
    return scaleOptions.find(s => s.value === value)
  }

  const handleCellClick = (hypothesisId: string, evidenceId: string) => {
    const existingScore = getScore(hypothesisId, evidenceId)
    setScoringCell({ hypothesisId, evidenceId })
    setSelectedScore(existingScore?.score ?? 0)
    setScoreNotes(existingScore?.notes ?? '')
  }

  const handleSaveScore = async () => {
    if (!scoringCell) return

    await onUpdateScore(scoringCell.hypothesisId, scoringCell.evidenceId, selectedScore, scoreNotes)
    setScoringCell(null)
    setSelectedScore(0)
    setScoreNotes('')
  }

  // Calculate column totals (raw and weighted)
  const getColumnTotal = (hypothesisId: string): number => {
    return scores
      .filter(s => s.hypothesis_id === hypothesisId)
      .reduce((sum, s) => sum + s.score, 0)
  }

  const getWeightedColumnTotal = (hypothesisId: string): number => {
    return scores
      .filter(s => s.hypothesis_id === hypothesisId)
      .reduce((sum, s) => {
        const quality = evidenceQuality.get(s.evidence_id)
        const weight = quality?.weight ?? 1.0
        return sum + (s.score * weight)
      }, 0)
  }

  if (hypotheses.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Info className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
          No Hypotheses Yet
        </h3>
        <p className="text-gray-500 dark:text-gray-500">
          Add hypotheses to your analysis to begin scoring.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">How to use the ACH Matrix:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Click any cell to score how evidence supports or contradicts a hypothesis</li>
                <li>Positive scores = evidence supports hypothesis</li>
                <li>Negative scores = evidence contradicts hypothesis</li>
                <li>The hypothesis with the LEAST contradictory evidence is most likely correct</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Evidence Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Evidence vs. Hypotheses Matrix</h3>
        <Button onClick={onAddEvidence}>
          <Plus className="h-4 w-4 mr-2" />
          Add Evidence
        </Button>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border border-gray-300 dark:border-gray-700 p-3 min-w-[200px] text-left">
                Evidence
              </th>
              {hypotheses.map((hypothesis, index) => (
                <th
                  key={hypothesis.id}
                  className="border border-gray-300 dark:border-gray-700 p-3 min-w-[150px] text-center"
                >
                  <div className="font-semibold mb-1">H{index + 1}</div>
                  <div className="text-xs font-normal text-gray-600 dark:text-gray-400">
                    {hypothesis.text}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evidence.length === 0 ? (
              <tr>
                <td
                  colSpan={hypotheses.length + 1}
                  className="border border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400"
                >
                  No evidence linked yet. Click "Add Evidence" to start scoring.
                </td>
              </tr>
            ) : (
              evidence.map((ev) => {
                const quality = evidenceQuality.get(ev.evidence_id)
                return (
                <tr key={ev.link_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="border border-gray-300 dark:border-gray-700 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{ev.evidence_title}</div>
                          {quality && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                getQualityColor(quality.tier)
                              )}
                              title={`Quality: ${quality.tier.toUpperCase()}\nWeight: ${quality.weight.toFixed(2)}x\n${quality.breakdown}`}
                            >
                              {getQualityIcon(quality.tier)}
                              <span>{quality.weight.toFixed(2)}x</span>
                            </span>
                          )}
                        </div>
                        {ev.source && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {ev.source}
                          </div>
                        )}
                        {quality && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {quality.breakdown}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700"
                        onClick={() => onRemoveEvidence(ev.link_id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  {hypotheses.map((hypothesis) => {
                    const score = getScore(hypothesis.id, ev.evidence_id)
                    const scoreOption = score ? getScoreOption(score.score) : null
                    const weightedScore = quality && score ? score.score * quality.weight : score?.score

                    return (
                      <td
                        key={hypothesis.id}
                        className="border border-gray-300 dark:border-gray-700 p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => handleCellClick(hypothesis.id, ev.evidence_id)}
                      >
                        {scoreOption ? (
                          <div className={cn('p-2 rounded text-center', scoreOption.color)}>
                            <div className="font-bold">{scoreOption.value}</div>
                            <div className="text-xs">{scoreOption.label}</div>
                            {quality && quality.weight !== 1.0 && weightedScore && (
                              <div className="text-xs mt-1 font-semibold">
                                Weighted: {weightedScore.toFixed(1)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 p-2">
                            Click to score
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )})
            )}
          </tbody>
          {evidence.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <td className="border border-gray-300 dark:border-gray-700 p-3 font-medium">
                  Raw Total
                </td>
                {hypotheses.map((hypothesis) => {
                  const total = getColumnTotal(hypothesis.id)
                  return (
                    <td
                      key={hypothesis.id}
                      className={cn(
                        'border border-gray-300 dark:border-gray-700 p-3 text-center',
                        total > 0 && 'text-green-600 dark:text-green-400',
                        total < 0 && 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {total}
                    </td>
                  )
                })}
              </tr>
              <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                <td className="border border-gray-300 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-2">
                    <span>Weighted Total</span>
                    <span
                      className="text-xs text-gray-600 dark:text-gray-400 font-normal"
                      title="Weighted by evidence quality (credibility, source classification, confidence)"
                    >
                      <Info className="h-4 w-4" />
                    </span>
                  </div>
                </td>
                {hypotheses.map((hypothesis) => {
                  const weightedTotal = getWeightedColumnTotal(hypothesis.id)
                  return (
                    <td
                      key={hypothesis.id}
                      className={cn(
                        'border border-gray-300 dark:border-gray-700 p-3 text-center',
                        weightedTotal > 0 && 'text-green-600 dark:text-green-400',
                        weightedTotal < 0 && 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {weightedTotal.toFixed(1)}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Analysis Summary */}
      {evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Key Principle:</strong> The hypothesis with the LEAST contradictory evidence (highest score) is most likely correct.
              </p>
              <div className="space-y-3 mt-4">
                <div>
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Quality-Weighted Ranking:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hypotheses
                      .map((h, index) => ({ hypothesis: h, index, total: getWeightedColumnTotal(h.id) }))
                      .sort((a, b) => b.total - a.total)
                      .map(({ hypothesis, index, total }, rank) => (
                        <Badge
                          key={hypothesis.id}
                          variant={rank === 0 ? 'default' : 'secondary'}
                          className="text-sm"
                        >
                          H{index + 1}: {total.toFixed(1)} {rank === 0 && '⭐ Most Likely'}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Raw Scores (unweighted):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hypotheses
                      .map((h, index) => ({ hypothesis: h, index, total: getColumnTotal(h.id) }))
                      .sort((a, b) => b.total - a.total)
                      .map(({ hypothesis, index, total }) => (
                        <Badge
                          key={hypothesis.id}
                          variant="outline"
                          className="text-sm"
                        >
                          H{index + 1}: {total}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring Dialog */}
      <Dialog open={!!scoringCell} onOpenChange={() => setScoringCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Score Evidence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                How does this evidence relate to the hypothesis?
              </label>
              <Select
                value={selectedScore.toString()}
                onValueChange={(value) => setSelectedScore(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a score" />
                </SelectTrigger>
                <SelectContent>
                  {scaleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{option.value}</span>
                        <span>-</span>
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedScore !== 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  {getScoreOption(selectedScore)?.description}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Notes (optional)
              </label>
              <Textarea
                value={scoreNotes}
                onChange={(e) => setScoreNotes(e.target.value)}
                placeholder="Add reasoning for this score..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setScoringCell(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveScore}>
                Save Score
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
