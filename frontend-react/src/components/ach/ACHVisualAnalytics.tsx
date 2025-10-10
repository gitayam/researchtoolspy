import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, TrendingUp, Target } from 'lucide-react'
import type { ACHAnalysis } from '@/types/ach'
import {
  calculateAllDiagnosticity,
  calculateHypothesisLikelihoods,
  getScoreColor,
  getDiagnosticityColor,
  formatScore
} from '@/lib/ach-diagnosticity'
import { cn } from '@/lib/utils'

interface ACHVisualAnalyticsProps {
  analysis: ACHAnalysis
}

export function ACHVisualAnalytics({ analysis }: ACHVisualAnalyticsProps) {
  const hypotheses = analysis.hypotheses || []
  const evidence = analysis.evidence || []
  const scores = analysis.scores || []

  if (hypotheses.length === 0 || evidence.length === 0 || scores.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Complete the scoring matrix to view visual analytics
          </p>
        </CardContent>
      </Card>
    )
  }

  const diagnosticity = calculateAllDiagnosticity(evidence, scores, hypotheses)
  const likelihoods = calculateHypothesisLikelihoods(hypotheses, scores, evidence)

  return (
    <div className="space-y-6">
      {/* Hypothesis Likelihood Ranking */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <CardTitle>Hypothesis Likelihood Ranking</CardTitle>
            </div>
            <Badge variant="outline">{hypotheses.length} hypotheses</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            In ACH methodology, the hypothesis with the <strong>least contradictory evidence</strong> (highest score) is typically most likely
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {likelihoods.map((l, index) => (
            <div key={l.hypothesisId} className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={l.isLeastContradicted ? 'default' : 'outline'}
                      className={cn(
                        "text-sm font-semibold",
                        l.isLeastContradicted && "bg-green-600"
                      )}
                    >
                      #{l.rank}
                    </Badge>
                    <span className={cn(
                      "font-medium",
                      l.isLeastContradicted && "text-green-700 dark:text-green-400"
                    )}>
                      {l.hypothesis}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Score: {formatScore(l.weightedScore)}</span>
                    <span className="text-green-600">+{l.supportingEvidence} support</span>
                    <span className="text-red-600">−{l.contradictingEvidence} contradict</span>
                    <span className="text-gray-500">{l.neutralEvidence} neutral</span>
                  </div>
                </div>
                <div className="text-right min-w-[80px]">
                  <div className="text-2xl font-bold">{l.likelihood.toFixed(0)}%</div>
                  <div className="text-xs text-muted-foreground">Likelihood</div>
                </div>
              </div>
              <Progress
                value={l.likelihood}
                className={cn(
                  "h-3",
                  l.isLeastContradicted && "[&>div]:bg-green-600"
                )}
              />
            </div>
          ))}

          {likelihoods.length > 0 && likelihoods[0].isLeastContradicted && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2">
                <Target className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    Most Likely Hypothesis:
                  </p>
                  <p className="text-green-800 dark:text-green-200 mt-1">
                    "{likelihoods[0].hypothesis}"
                  </p>
                  <p className="text-green-700 dark:text-green-300 text-xs mt-2">
                    This hypothesis has the least contradictory evidence ({likelihoods[0].contradictingEvidence} contradictions vs {likelihoods[0].supportingEvidence} supporting pieces)
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Diagnosticity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Evidence Diagnosticity Analysis</CardTitle>
            <Badge variant="outline">{evidence.length} pieces</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Which evidence best differentiates between hypotheses?
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {diagnosticity.slice(0, 10).map(diag => (
            <div key={diag.evidenceId} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{diag.evidenceTitle}</span>
                    <Badge className={getDiagnosticityColor(diag.score)}>
                      {diag.score.toFixed(0)}% diagnostic
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{diag.reasoning}</p>
                </div>
              </div>

              <Progress value={diag.score} className="h-2 mb-2" />

              {diag.isDiagnostic && diag.topHypothesis.id && (
                <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  <span className="text-muted-foreground">Most supports:</span>{' '}
                  <span className="font-medium">
                    {diag.topHypothesis.text} ({formatScore(diag.topHypothesis.score)})
                  </span>
                </div>
              )}
            </div>
          ))}

          {diagnosticity.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              No diagnosticity data available. Complete scoring matrix first.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence-Hypothesis Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence vs. Hypotheses Heatmap</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Color-coded matrix for quick pattern recognition
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 dark:border-gray-700 p-2 text-left text-xs font-semibold bg-gray-50 dark:bg-gray-800 min-w-[150px]">
                    Evidence
                  </th>
                  {hypotheses.map((h, i) => (
                    <th
                      key={h.id}
                      className="border border-gray-300 dark:border-gray-700 p-2 text-center text-xs font-semibold bg-gray-50 dark:bg-gray-800 min-w-[80px]"
                    >
                      H{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.map(ev => (
                  <tr key={ev.evidence_id}>
                    <td className="border border-gray-300 dark:border-gray-700 p-2 text-xs">
                      <div className="font-medium">{ev.evidence_title}</div>
                    </td>
                    {hypotheses.map(hyp => {
                      const score = scores.find(
                        s => s.hypothesis_id === hyp.id && s.evidence_id === ev.evidence_id
                      )
                      const scoreValue = score?.score ?? 0
                      const colorClass = getScoreColor(scoreValue)

                      return (
                        <td key={hyp.id} className="border border-gray-300 dark:border-gray-700 p-0">
                          <div
                            className={cn(
                              "w-full h-full flex items-center justify-center py-3 font-bold text-sm",
                              colorClass
                            )}
                            title={score?.notes || ''}
                          >
                            {formatScore(scoreValue)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold">Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded"></div>
              <span>Strong Support (+3 to +5)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-200 rounded"></div>
              <span>Weak Support (+1 to +2)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-200 rounded"></div>
              <span>Neutral (0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-200 rounded"></div>
              <span>Weak Contradiction (−1 to −2)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded"></div>
              <span>Strong Contradiction (−3 to −5)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
