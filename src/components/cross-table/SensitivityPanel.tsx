/**
 * SensitivityPanel — Tornado diagram and break-even table.
 *
 * Shows how changing each criterion's weight affects the top-ranked alternative's score.
 */

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCrossTable } from './cross-table-context'
import { computeRankings } from '@/lib/cross-table/engine/ranking'
import { tornadoData, breakEvenWeight } from '@/lib/cross-table/engine/sensitivity'

export function SensitivityPanel() {
  const { state } = useCrossTable()
  const { table, scores } = state
  const { rows, columns } = table.config

  // Compute base rankings
  const results = useMemo(() => {
    try {
      return computeRankings(table.config, scores)
    } catch {
      return []
    }
  }, [table.config, scores])

  const topRow = results[0]

  // Tornado data for top-ranked alternative
  const tornado = useMemo(() => {
    if (!topRow) return []
    try {
      return tornadoData(table.config, scores, topRow.row_id)
    } catch {
      return []
    }
  }, [table.config, scores, topRow])

  // Break-even analysis
  const breakEvens = useMemo(() => {
    return columns.map((col) => {
      try {
        const be = breakEvenWeight(table.config, scores, col.id)
        return { col_id: col.id, label: col.label, breakEven: be }
      } catch {
        return { col_id: col.id, label: col.label, breakEven: null }
      }
    })
  }, [table.config, scores, columns])

  const rowLabelMap = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, r.label])),
    [rows]
  )

  if (!topRow || tornado.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          Need results with at least 2 weighted criteria for sensitivity analysis.
        </p>
      </div>
    )
  }

  // Tornado chart data: offset bars from base
  const tornadoChart = tornado.map((t) => ({
    name: t.label,
    low: parseFloat((t.low - t.base).toFixed(4)),
    high: parseFloat((t.high - t.base).toFixed(4)),
    base: parseFloat(t.base.toFixed(4)),
  }))

  return (
    <div className="space-y-6">
      {/* Tornado Diagram */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#4F5BFF]" />
            Tornado Diagram
            <Badge variant="outline" className="text-[10px] font-normal ml-2">
              {rowLabelMap[topRow.row_id] ?? 'Top Alternative'}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Score swing when each criterion weight is perturbed by +/-50%.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, tornado.length * 40 + 40)}>
            <BarChart
              data={tornadoChart}
              layout="vertical"
              margin={{ left: 100, right: 20, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => (v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3))}
              />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [
                  value > 0 ? `+${value.toFixed(4)}` : value.toFixed(4),
                  'Score Change',
                ]}
                contentStyle={{ fontSize: 12 }}
              />
              <ReferenceLine x={0} stroke="#666" strokeWidth={1} />
              <Bar dataKey="low" stackId="range" radius={[4, 0, 0, 4]}>
                {tornadoChart.map((_, i) => (
                  <Cell key={i} fill="#ef4444" fillOpacity={0.7} />
                ))}
              </Bar>
              <Bar dataKey="high" stackId="range" radius={[0, 4, 4, 0]}>
                {tornadoChart.map((_, i) => (
                  <Cell key={i} fill="#22c55e" fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Break-even table */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Break-Even Analysis</CardTitle>
          <p className="text-xs text-muted-foreground">
            Weight change needed to flip the #1 ranked alternative.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-2 font-medium">Criterion</th>
                  <th className="text-right p-2 font-medium">Break-Even</th>
                  <th className="text-center p-2 font-medium">Stability</th>
                </tr>
              </thead>
              <tbody>
                {breakEvens.map((be) => {
                  const absVal = be.breakEven !== null ? Math.abs(be.breakEven) : null
                  const stable = absVal === null || absVal > 0.3

                  return (
                    <tr key={be.col_id} className="border-b border-slate-100">
                      <td className="p-2 font-medium">{be.label}</td>
                      <td className="p-2 text-right tabular-nums">
                        {be.breakEven !== null
                          ? `${be.breakEven > 0 ? '+' : ''}${(be.breakEven * 100).toFixed(0)}%`
                          : 'N/A'}
                      </td>
                      <td className="p-2 text-center">
                        <Badge
                          variant={stable ? 'default' : 'destructive'}
                          className="text-[9px]"
                        >
                          {stable ? 'Stable' : 'Sensitive'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
