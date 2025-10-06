import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Download, Eye, FileDown, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ACHAnalysis } from '@/types/ach'
import { ACHMatrix } from '@/components/ach/ACHMatrix'

export function PublicACHPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState<ACHAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalysis()
  }, [token])

  const loadAnalysis = async () => {
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch(`/api/ach/public/${token}`)
      if (!response.ok) {
        throw new Error('Analysis not found or not public')
      }
      const data = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error('Failed to load analysis:', error)
      setError(error instanceof Error ? error.message : 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  const handleClone = async () => {
    if (!token) return

    setCloning(true)
    try {
      const response = await fetch(`/api/ach/public/${token}/clone`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to clone analysis')
      }

      const data = await response.json()
      // Navigate to the new cloned analysis
      navigate(`/dashboard/analysis-frameworks/ach-dashboard/${data.id}`)
    } catch (error) {
      console.error('Failed to clone analysis:', error)
      alert('Failed to clone analysis. Please make sure you are logged in.')
    } finally {
      setCloning(false)
    }
  }

  const handleExport = () => {
    if (!analysis) return

    // Export as JSON
    const dataStr = JSON.stringify(analysis, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${analysis.title.replace(/\s+/g, '_')}_ACH_Analysis.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-12">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading analysis...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Analysis Not Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || 'This analysis is not public or does not exist.'}
            </p>
            <Button onClick={() => navigate('/public/ach')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse Public Analyses
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Public ACH Analysis
              </Badge>
              {analysis.domain && (
                <Badge variant="secondary" className="text-xs">
                  {analysis.domain}
                </Badge>
              )}
              {analysis.tags?.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {analysis.title}
            </h1>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-3">
              <strong>Key Question:</strong> {analysis.question}
            </p>
            {analysis.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                {analysis.description}
              </p>
            )}
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{analysis.view_count || 0} views</span>
              </div>
              <div className="flex items-center gap-1">
                <Copy className="h-4 w-4" />
                <span>{analysis.clone_count || 0} clones</span>
              </div>
              {analysis.analyst && (
                <div>
                  <strong>Analyst:</strong> {analysis.analyst}
                </div>
              )}
              {analysis.organization && (
                <div>
                  <strong>Organization:</strong> {analysis.organization}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleClone} disabled={cloning}>
              <Copy className="h-4 w-4 mr-2" />
              {cloning ? 'Cloning...' : 'Clone & Analyze'}
            </Button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>📋 Public Analysis:</strong> This ACH analysis has been shared publicly.
            You can view the hypotheses and evidence below. Click "Clone & Analyze" to copy this
            analysis to your workspace where you can score the evidence independently.
          </p>
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hypotheses</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {analysis.hypotheses?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Evidence Items</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {analysis.evidence?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Scoring Scale</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
              {analysis.scale_type}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ACH Matrix (Read-only) */}
      <ACHMatrix
        analysis={analysis}
        onUpdateScore={async () => {}}
        onAddEvidence={() => {}}
        onRemoveEvidence={async () => {}}
      />

      {/* Clone CTA */}
      <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to Analyze This Intelligence Problem?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Clone this analysis to your workspace to independently score the evidence and
            generate your own conclusions using the ACH methodology.
          </p>
          <Button onClick={handleClone} disabled={cloning} size="lg">
            <Copy className="h-4 w-4 mr-2" />
            {cloning ? 'Cloning...' : 'Clone to My Workspace'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
