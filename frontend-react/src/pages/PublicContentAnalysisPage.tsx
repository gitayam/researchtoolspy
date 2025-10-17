import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Copy, Download, Eye, ArrowLeft, ExternalLink, Link2, Mail, Archive, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface PublicContentAnalysis extends Omit<ContentAnalysis, 'user_id' | 'saved_link_id' | 'content_hash'> {
  view_count: number
}

export function PublicContentAnalysisPage() {
  const { token } = useParams<{ token: string }>()
  const [analysis, setAnalysis] = useState<PublicContentAnalysis | null>(null)
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
          {/* Word Frequency & Top Phrases */}
          {analysis.top_phrases && analysis.top_phrases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Phrases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.top_phrases.slice(0, 10).map((phrase, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex-1">{phrase.phrase}</span>
                      <Badge variant="outline">{phrase.count}×</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Keyphrases */}
          {analysis.keyphrases && analysis.keyphrases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Phrases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.keyphrases.slice(0, 15).map((kp, i) => (
                    <Badge key={i} variant="secondary">
                      {kp.phrase}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entities */}
          {analysis.entities && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Key Entities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.entities.people && analysis.entities.people.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">👤 People ({analysis.entities.people.length})</h4>
                      <div className="space-y-1">
                        {analysis.entities.people.slice(0, 8).map((person, i) => (
                          <div key={i} className="text-sm flex items-center justify-between">
                            <span>{person.name}</span>
                            <span className="text-muted-foreground">({person.count}×)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.entities.organizations && analysis.entities.organizations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">🏢 Organizations ({analysis.entities.organizations.length})</h4>
                      <div className="space-y-1">
                        {analysis.entities.organizations.slice(0, 8).map((org, i) => (
                          <div key={i} className="text-sm flex items-center justify-between">
                            <span>{org.name}</span>
                            <span className="text-muted-foreground">({org.count}×)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.entities.locations && analysis.entities.locations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">📍 Locations ({analysis.entities.locations.length})</h4>
                      <div className="space-y-1">
                        {analysis.entities.locations.slice(0, 8).map((loc, i) => (
                          <div key={i} className="text-sm flex items-center justify-between">
                            <span>{loc.name}</span>
                            <span className="text-muted-foreground">({loc.count}×)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.entities.dates && analysis.entities.dates.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">📅 Dates ({analysis.entities.dates.length})</h4>
                      <div className="space-y-1">
                        {analysis.entities.dates.slice(0, 8).map((date, i) => (
                          <div key={i} className="text-sm flex items-center justify-between">
                            <span>{date.name}</span>
                            <span className="text-muted-foreground">({date.count}×)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.entities.money && analysis.entities.money.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">💰 Money ({analysis.entities.money.length})</h4>
                      <div className="space-y-1">
                        {analysis.entities.money.slice(0, 8).map((money, i) => (
                          <div key={i} className="text-sm flex items-center justify-between">
                            <span>{money.name}</span>
                            <span className="text-muted-foreground">({money.count}×)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.entities.emails && analysis.entities.emails.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        Emails ({analysis.entities.emails.length})
                      </h4>
                      <div className="space-y-1">
                        {analysis.entities.emails.slice(0, 5).map((email, i) => (
                          <div key={i} className="text-sm">
                            <a
                              href={`mailto:${email.email}`}
                              className="text-blue-600 hover:underline flex items-center justify-between"
                            >
                              <span className="truncate">{email.email}</span>
                              <span className="text-muted-foreground ml-2">({email.count}×)</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
          {analysis.claim_analysis?.claims && analysis.claim_analysis.claims.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Claims Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.claim_analysis.claims.map((claim, i) => (
                    <div key={i} className="border-l-4 border-blue-500 pl-4 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm flex-1">{claim.claim}</p>
                        <div className="flex items-center gap-2">
                          <Badge>{claim.category}</Badge>
                          <Badge variant={
                            claim.deception_analysis.overall_risk === 'high' ? 'destructive' :
                            claim.deception_analysis.overall_risk === 'medium' ? 'default' : 'secondary'
                          }>
                            {claim.deception_analysis.overall_risk}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links Analysis */}
          {analysis.links_analysis && analysis.links_analysis.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Link Analysis ({analysis.links_analysis.length} unique links)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  All links found in the article body (excluding navigation, headers, and footers)
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Total Links</p>
                      <p className="text-2xl font-bold">{analysis.links_analysis.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">External</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {analysis.links_analysis.filter(l => l.is_external).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Internal</p>
                      <p className="text-2xl font-bold text-green-600">
                        {analysis.links_analysis.filter(l => !l.is_external).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Unique Domains</p>
                      <p className="text-2xl font-bold">
                        {new Set(analysis.links_analysis.map(l => l.domain)).size}
                      </p>
                    </div>
                  </div>

                  {/* Links List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {analysis.links_analysis.map((link, idx) => (
                      <div
                        key={idx}
                        className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm font-medium break-all flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              {link.url}
                            </a>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{link.domain}</Badge>
                              <Badge variant={link.is_external ? "default" : "secondary"} className="text-xs">
                                {link.is_external ? "External" : "Internal"}
                              </Badge>
                              <span className="text-xs text-gray-600">
                                Referenced {link.count}× in article
                              </span>
                            </div>
                            {link.anchor_text && link.anchor_text.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs font-semibold text-gray-500">Anchor text: </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {link.anchor_text.map((text, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      "{text}"
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Archive & Bypass URLs */}
          {(analysis.archive_urls || analysis.bypass_urls) && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Archive & Bypass Links
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Alternative ways to access this content
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.archive_urls && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Archive Services</h4>
                      {analysis.archive_urls.wayback && (
                        <a
                          href={analysis.archive_urls.wayback}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Globe className="h-4 w-4" />
                          Wayback Machine
                        </a>
                      )}
                      {analysis.archive_urls.archive_is && (
                        <a
                          href={analysis.archive_urls.archive_is}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Globe className="h-4 w-4" />
                          Archive.is
                        </a>
                      )}
                    </div>
                  )}
                  {analysis.bypass_urls && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Paywall Bypass</h4>
                      {analysis.bypass_urls['12ft'] && (
                        <a
                          href={analysis.bypass_urls['12ft']}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          12ft Ladder
                        </a>
                      )}
                    </div>
                  )}
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
