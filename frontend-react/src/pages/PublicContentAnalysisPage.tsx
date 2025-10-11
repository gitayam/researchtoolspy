import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Copy, Download, Eye, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

interface ContentAnalysis {
  id: number
  title: string
  url: string
  domain: string
  author?: string
  publish_date?: string
  summary: string
  word_count: number
  is_social_media: boolean
  social_platform?: string
  word_frequency: Record<string, number>
  top_phrases: Array<{ phrase: string; count: number }>
  entities: {
    people?: string[]
    organizations?: string[]
    locations?: string[]
    dates?: string[]
    money?: string[]
    events?: string[]
  }
  sentiment_analysis?: {
    overall: string
    score: number
    confidence: number
  }
  keyphrases?: Array<{ phrase: string; score: number }>
  topics?: Array<{ name: string; keywords: string[]; coverage: number }>
  claim_analysis?: Array<{
    claim: string
    category: string
    probability: number
    supporting_evidence?: string[]
    counterevidence?: string[]
  }>
  view_count: number
  created_at: string
}

export function PublicContentAnalysisPage() {
  const { token } = useParams<{ token: string }>()
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadAnalysis()
  }, [token])

  const loadAnalysis = async () => {
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch(`/api/content-intelligence/public/${token}`)
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

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({ title: 'Link copied to clipboard!' })
  }

  const handleExport = () => {
    if (!analysis) return

    const dataStr = JSON.stringify(analysis, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${analysis.title?.replace(/\s+/g, '_') || 'analysis'}_Content_Analysis.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Loading analysis...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-destructive mb-4">{error || 'Analysis not found'}</p>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    <Eye className="mr-1 h-3 w-3" />
                    {analysis.view_count} views
                  </Badge>
                  {analysis.is_social_media && (
                    <Badge variant="outline">{analysis.social_platform}</Badge>
                  )}
                </div>
                <CardTitle className="text-2xl">{analysis.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {analysis.domain} • {new Date(analysis.created_at).toLocaleDateString()}
                </p>
                {analysis.author && (
                  <p className="text-sm text-muted-foreground">By {analysis.author}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopyUrl} variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-sm">{analysis.summary}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Word Count: {analysis.word_count.toLocaleString()}
            </div>
            {analysis.url && (
              <div>
                <a
                  href={analysis.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Original →
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Entities */}
          {analysis.entities && (
            <Card>
              <CardHeader>
                <CardTitle>Key Entities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.entities.people && analysis.entities.people.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">People</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.entities.people.slice(0, 10).map((person, i) => (
                        <Badge key={i} variant="secondary">{person}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.entities.organizations && analysis.entities.organizations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Organizations</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.entities.organizations.slice(0, 10).map((org, i) => (
                        <Badge key={i} variant="outline">{org}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.entities.locations && analysis.entities.locations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Locations</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.entities.locations.slice(0, 10).map((loc, i) => (
                        <Badge key={i} variant="outline">{loc}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sentiment */}
          {analysis.sentiment_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Overall Sentiment:</span>
                    <Badge>{analysis.sentiment_analysis.overall}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Score:</span>
                    <span className="text-sm font-semibold">
                      {analysis.sentiment_analysis.score.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Confidence:</span>
                    <span className="text-sm font-semibold">
                      {(analysis.sentiment_analysis.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Topics */}
          {analysis.topics && analysis.topics.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.topics.map((topic, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{topic.name}</h4>
                        <span className="text-xs text-muted-foreground">
                          {(topic.coverage * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {topic.keywords.slice(0, 5).map((kw, j) => (
                          <Badge key={j} variant="secondary" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Claims */}
          {analysis.claim_analysis && analysis.claim_analysis.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Claims Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.claim_analysis.map((claim, i) => (
                    <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm flex-1">{claim.claim}</p>
                        <div className="flex items-center gap-2">
                          <Badge>{claim.category}</Badge>
                          <Badge variant="outline">
                            {(claim.probability * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            <p>
              Shared via Research Tools • Analysis performed{' '}
              {new Date(analysis.created_at).toLocaleDateString()}
            </p>
            <p className="mt-2">
              <a href="/" className="text-blue-600 hover:underline">
                Create your own analysis →
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
