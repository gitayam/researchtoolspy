/**
 * ResultsPanel — Ranked results with horizontal bar chart, radar chart for top 3,
 * and dominance indicators.
 */

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts'
import { Trophy, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useCrossTable } from './cross-table-context'
import { computeRankings, findDominatedRows } from '@/lib/cross-table/engine/ranking'

const RANK_COLORS = ['#4F5BFF', '#D4673A', '#3B2A23', '#6B7280', '#9CA3AF']
const RADAR_COLORS = ['#4F5BFF', '#D4673A', '#10B981']

export function ResultsPanel() {
  const { state } = useCrossTable()
  const { table, scores } = state
  const { rows, columns } = table.config

  // Compute rankings
  const results = useMemo(() => {
    try {
      return computeRankings(table.config, scores)
    } catch {
      return []
    }
  }, [table.config, scores])

  const dominated = useMemo(() => {
    try {
      return findDominatedRows(results)
    } catch {
      return new Set<string>()
    }
  }, [results])

  const rowLabelMap = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, r.label])),
    [rows]
  )

  const colLabelMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, c.label])),
    [columns]
  )

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Score at least one cell to see results.
        </p>
      </div>
    )
  }

  // ── Bar chart data ──────────────────────────────────────────

  const barData = results.map((r) => ({
    name: rowLabelMap[r.row_id] ?? r.row_id,
    score: parseFloat(r.weighted_score.toFixed(4)),
    rank: r.rank,
    dominated: dominated.has(r.row_id),
  }))

  // ── Radar chart data (top 3) ────────────────────────────────

  const top3 = results.slice(0, 3)
  const radarData = columns.map((col) => {
    const point: Record<string, string | number> = { criterion: col.label }
    top3.forEach((r, i) => {
      point[rowLabelMap[r.row_id] ?? `Alt ${i + 1}`] = parseFloat(
        (r.normalized_scores[col.id] ?? 0).toFixed(3)
      )
    })
    return point
  })

  return (
    <div className="space-y-6">
      {/* Ranked bar chart */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#4F5BFF]" />
            Ranked Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, results.length * 40 + 40)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [value.toFixed(4), 'Weighted Score']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="score"
                radius={[0, 4, 4, 0]}
                fill="#4F5BFF"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Rankings table */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-xs min-w-[300px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-1.5 sm:p-2 font-medium">Rank</th>
                  <th className="text-left p-1.5 sm:p-2 font-medium">Alternative</th>
                  <th className="text-right p-1.5 sm:p-2 font-medium">Score</th>
                  <th className="text-center p-1.5 sm:p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.row_id} className="border-b border-slate-100">
                    <td className="p-1.5 sm:p-2">
                      <Badge
                        variant={r.rank === 1 ? 'default' : 'outline'}
                        className="text-[10px] tabular-nums"
                      >
                        #{r.rank}
                      </Badge>
                    </td>
                    <td className="p-1.5 sm:p-2 font-medium max-w-[120px] sm:max-w-none truncate">{rowLabelMap[r.row_id] ?? r.row_id}</td>
                    <td className="p-1.5 sm:p-2 text-right tabular-nums">{r.weighted_score.toFixed(4)}</td>
                    <td className="p-1.5 sm:p-2 text-center">
                      {dominated.has(r.row_id) && (
                        <Badge variant="destructive" className="text-[9px]">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          Dominated
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Radar chart (top 3) */}
      {top3.length >= 2 && columns.length >= 3 && (
        <Card className="border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Top {top3.length} Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 8 }} />
                {top3.map((r, i) => (
                  <Radar
                    key={r.row_id}
                    name={rowLabelMap[r.row_id] ?? `Alt ${i + 1}`}
                    dataKey={rowLabelMap[r.row_id] ?? `Alt ${i + 1}`}
                    stroke={RADAR_COLORS[i]}
                    fill={RADAR_COLORS[i]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
