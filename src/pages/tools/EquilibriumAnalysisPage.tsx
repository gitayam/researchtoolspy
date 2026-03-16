import { useState, useEffect, useCallback } from 'react'
import { Upload, TrendingUp, Brain, Trash2, Save, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import Papa from 'papaparse'
import { getCopHeaders } from '@/lib/cop-auth'
import type { EquilibriumAnalysis, TimeSeriesDataPoint, EquilibriumResult } from '@/types/equilibrium-analysis'

export function EquilibriumAnalysisPage() {
  const [analyses, setAnalyses] = useState<EquilibriumAnalysis[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<EquilibriumAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [timeColumn, setTimeColumn] = useState('')
  const [rateColumn, setRateColumn] = useState('')
  const [groupColumn, setGroupColumn] = useState('')

  // Load analyses on mount
  useEffect(() => {
    const controller = new AbortController()
    loadAnalyses(controller.signal)
    return () => controller.abort()
  }, [])

  const loadAnalyses = async (signal?: AbortSignal) => {
    try {
      const wsId = localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id') || ''
      const response = await fetch(`/api/equilibrium-analysis?workspace_id=${wsId}`, {
        headers: getCopHeaders(),
        signal,
      })
      const data = await response.json()
      setAnalyses(data.analyses || [])
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Failed to load analyses:', err)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvData(results.data as any[])
          setCsvHeaders(results.meta.fields || [])
          setError(null)
        }
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`)
      }
    })
  }

  const handleCreate = async () => {
    if (!title || csvData.length === 0 || !timeColumn || !rateColumn) {
      setError('Please provide a title, upload data, and select time/rate columns')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Transform CSV data to time series format
      const timeSeries: TimeSeriesDataPoint[] = csvData
        .filter(row => row[timeColumn] && row[rateColumn] !== null && row[rateColumn] !== undefined)
        .map(row => ({
          timestamp: String(row[timeColumn]),
          rate: Number(row[rateColumn]),
          group: groupColumn ? String(row[groupColumn]) : undefined
        }))

      const response = await fetch('/api/equilibrium-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCopHeaders()
        },
        body: JSON.stringify({
          title,
          description,
          workspace_id: localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id') || '',
          data_source: {
            type: 'csv_upload',
            filename: 'uploaded.csv',
            uploaded_at: new Date().toISOString(),
            original_headers: csvHeaders,
            row_count: csvData.length
          },
          time_series: timeSeries,
          variables: {
            time_column: timeColumn,
            rate_column: rateColumn,
            group_column: groupColumn || undefined
          }
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      // Reload and select the new analysis
      await loadAnalyses()
      const newAnalysis = await fetchAnalysis(data.id)
      setSelectedAnalysis(newAnalysis)

      // Reset form
      setTitle('')
      setDescription('')
      setCsvData([])
      setCsvHeaders([])
      setTimeColumn('')
      setRateColumn('')
      setGroupColumn('')
    } catch (err: any) {
      setError(err.message || 'Failed to create analysis')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalysis = async (id: string): Promise<EquilibriumAnalysis> => {
    const response = await fetch(`/api/equilibrium-analysis/${id}`, {
      headers: getCopHeaders()
    })
    const data = await response.json()
    return data.analysis
  }

  const handleRunAIAnalysis = async () => {
    if (!selectedAnalysis || !selectedAnalysis.time_series?.length) {
      setError('No data to analyze')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/equilibrium-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCopHeaders()
        },
        body: JSON.stringify({
          analysis_id: selectedAnalysis.id,
          time_series: selectedAnalysis.time_series,
          variables: selectedAnalysis.variables,
          behavior_context: selectedAnalysis.description
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      // Refresh the analysis
      const updated = await fetchAnalysis(selectedAnalysis.id!)
      setSelectedAnalysis(updated)
    } catch (err: any) {
      setError(err.message || 'AI analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this analysis?')) return

    try {
      await fetch(`/api/equilibrium-analysis/${id}`, {
        method: 'DELETE',
        headers: getCopHeaders()
      })
      await loadAnalyses()
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null)
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const getTrendColor = (trend?: string) => {
    switch (trend) {
      case 'approaching': return 'bg-green-500'
      case 'at_equilibrium': return 'bg-blue-500'
      case 'departing': return 'bg-orange-500'
      case 'oscillating': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equilibrium Analysis</h1>
          <p className="text-muted-foreground">
            Analyze longitudinal behavioral data to detect equilibrium states
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Create/List */}
        <div className="space-y-4">
          {/* Create New */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                New Analysis
              </CardTitle>
              <CardDescription>
                Upload CSV with time series data (crime rates, voting records, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., US Voter Turnout 2000-2024"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Context about the behavior being analyzed..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Upload CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </div>

              {csvHeaders.length > 0 && (
                <>
                  <div>
                    <Label>Time Column</Label>
                    <Select value={timeColumn} onValueChange={setTimeColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time column" />
                      </SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rate/Value Column</Label>
                    <Select value={rateColumn} onValueChange={setRateColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rate column" />
                      </SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Group Column (optional)</Label>
                    <Select value={groupColumn} onValueChange={setGroupColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select group column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {csvHeaders.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {csvData.length} rows loaded
                  </p>
                </>
              )}

              <Button
                onClick={handleCreate}
                disabled={loading || !title || csvData.length === 0}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Analysis'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Analyses */}
          <Card>
            <CardHeader>
              <CardTitle>Saved Analyses</CardTitle>
            </CardHeader>
            <CardContent>
              {analyses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No analyses yet</p>
              ) : (
                <div className="space-y-2">
                  {analyses.map(a => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-md border cursor-pointer hover:bg-accent ${
                        selectedAnalysis?.id === a.id ? 'border-primary bg-accent' : ''
                      }`}
                      onClick={() => fetchAnalysis(a.id!).then(setSelectedAnalysis).catch(console.error)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(a as any).time_series_count || 0} data points
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(a.id!)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Analysis View */}
        <div className="lg:col-span-2 space-y-4">
          {selectedAnalysis ? (
            <>
              {/* Header */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedAnalysis.title}</CardTitle>
                      <CardDescription>{selectedAnalysis.description}</CardDescription>
                    </div>
                    <Button
                      onClick={handleRunAIAnalysis}
                      disabled={analyzing}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Statistics */}
              {selectedAnalysis.statistics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Mean</p>
                        <p className="text-xl font-bold">{selectedAnalysis.statistics.mean}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Max</p>
                        <p className="text-xl font-bold">{selectedAnalysis.statistics.max}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Min</p>
                        <p className="text-xl font-bold">{selectedAnalysis.statistics.min}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Std Dev</p>
                        <p className="text-xl font-bold">{selectedAnalysis.statistics.std_deviation}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Trend</p>
                        <p className="text-xl font-bold">
                          {selectedAnalysis.statistics.trend_coefficient > 0 ? '+' : ''}
                          {selectedAnalysis.statistics.trend_coefficient}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Data Points</p>
                        <p className="text-xl font-bold">{selectedAnalysis.statistics.data_points}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Analysis Results */}
              {selectedAnalysis.equilibrium_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Equilibrium Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Equilibrium Rate</p>
                        <p className="text-2xl font-bold">
                          {selectedAnalysis.equilibrium_analysis.equilibrium_rate}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Current Rate</p>
                        <p className="text-2xl font-bold">
                          {selectedAnalysis.equilibrium_analysis.current_rate}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Delta</p>
                        <p className={`text-2xl font-bold ${
                          selectedAnalysis.equilibrium_analysis.rate_delta > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {selectedAnalysis.equilibrium_analysis.rate_delta > 0 ? '+' : ''}
                          {selectedAnalysis.equilibrium_analysis.rate_delta}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Trend</p>
                        <Badge className={getTrendColor(selectedAnalysis.equilibrium_analysis.trend)}>
                          {selectedAnalysis.equilibrium_analysis.trend}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Stability Score</p>
                        <Progress value={selectedAnalysis.equilibrium_analysis.stability_score} />
                        <p className="text-xs text-right">{selectedAnalysis.equilibrium_analysis.stability_score}/100</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="font-medium mb-2">AI Explanation</p>
                      <p className="text-sm">{selectedAnalysis.equilibrium_analysis.ai_explanation}</p>
                    </div>

                    {selectedAnalysis.equilibrium_analysis.hamilton_interpretation && (
                      <div>
                        <p className="font-medium mb-2">Hamilton's Rule Interpretation</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedAnalysis.equilibrium_analysis.hamilton_interpretation}
                        </p>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Resistors</p>
                        <ul className="space-y-1">
                          {selectedAnalysis.equilibrium_analysis.resistors?.map((r, i) => (
                            <li key={i} className="text-sm flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Enablers</p>
                        <ul className="space-y-1">
                          {selectedAnalysis.equilibrium_analysis.enablers?.map((e, i) => (
                            <li key={i} className="text-sm flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full" />
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Time</th>
                          <th className="text-left p-2">Rate</th>
                          {selectedAnalysis.variables?.group_column && (
                            <th className="text-left p-2">Group</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAnalysis.time_series?.slice(0, 20).map((point, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{point.timestamp}</td>
                            <td className="p-2">{point.rate}</td>
                            {selectedAnalysis.variables?.group_column && (
                              <td className="p-2">{point.group}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(selectedAnalysis.time_series?.length || 0) > 20 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Showing 20 of {selectedAnalysis.time_series?.length} rows
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Analysis Selected</p>
                <p className="text-muted-foreground">
                  Create a new analysis or select an existing one from the list
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default EquilibriumAnalysisPage
