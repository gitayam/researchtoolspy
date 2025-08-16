'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Globe, Search, Clock, ExternalLink, Copy, Download } from 'lucide-react'

interface UrlAnalysisResult {
  id: string
  url: string
  title?: string
  description?: string
  domain: string
  statusCode: number
  contentType?: string
  wordCount?: number
  language?: string
  reliabilityScore?: number
  domainReputation?: string
  archivedUrl?: string
  waybackUrl?: string
  processedAt: string
}

export default function UrlResearchTool() {
  const [url, setUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<UrlAnalysisResult[]>([])
  const [activeTab, setActiveTab] = useState('analyze')

  const handleAnalyze = async () => {
    if (!url.trim()) return

    setIsAnalyzing(true)
    
    try {
      // Mock analysis - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockResult: UrlAnalysisResult = {
        id: Date.now().toString(),
        url: url.trim(),
        title: 'Sample Page Title - Analysis Results',
        description: 'This is a sample description of the analyzed webpage content.',
        domain: new URL(url.trim()).hostname,
        statusCode: 200,
        contentType: 'text/html',
        wordCount: 1250,
        language: 'en',
        reliabilityScore: 8.5,
        domainReputation: 'trusted',
        archivedUrl: `https://web.archive.org/save/${url.trim()}`,
        waybackUrl: `https://web.archive.org/web/*/${url.trim()}`,
        processedAt: new Date().toISOString()
      }

      setResults(prev => [mockResult, ...prev])
      setUrl('')
      setActiveTab('results')
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getReputationColor = (reputation?: string) => {
    switch (reputation) {
      case 'trusted':
        return 'bg-green-100 text-green-800'
      case 'neutral':
        return 'bg-yellow-100 text-yellow-800'
      case 'suspicious':
        return 'bg-orange-100 text-orange-800'
      case 'malicious':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">URL Research Tool</h1>
        <p className="mt-2 text-gray-600">
          Analyze URLs for metadata, reliability, and archived versions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="results">Results ({results.length})</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                URL Analysis
              </CardTitle>
              <CardDescription>
                Enter a URL to analyze its content, metadata, and reliability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL to Analyze</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isAnalyzing}
                  />
                  <Button 
                    onClick={handleAnalyze}
                    disabled={!url.trim() || isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                  </Button>
                </div>
              </div>

              {isAnalyzing && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Analyzing URL content, checking archives, and assessing reliability...
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {results.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No analysis results yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Analyze some URLs to see results here
                </p>
              </CardContent>
            </Card>
          ) : (
            results.map((result) => (
              <Card key={result.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{result.title || 'Unknown Title'}</CardTitle>
                      <CardDescription className="mt-1">
                        {result.description || 'No description available'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(result.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Domain</Label>
                      <p className="text-sm text-gray-600">{result.domain}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status Code</Label>
                      <Badge 
                        variant={result.statusCode === 200 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {result.statusCode}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Content Type</Label>
                      <p className="text-sm text-gray-600">{result.contentType || 'Unknown'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Word Count</Label>
                      <p className="text-sm text-gray-600">{result.wordCount?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Language</Label>
                      <p className="text-sm text-gray-600">{result.language?.toUpperCase() || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Reliability Score</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {result.reliabilityScore ? `${result.reliabilityScore}/10` : 'N/A'}
                        </Badge>
                        {result.domainReputation && (
                          <Badge className={`text-xs ${getReputationColor(result.domainReputation)}`}>
                            {result.domainReputation}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium">Original URL</Label>
                    <p className="text-sm text-gray-600 break-all">{result.url}</p>
                  </div>

                  {(result.archivedUrl || result.waybackUrl) && (
                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium">Archive Links</Label>
                      <div className="flex gap-2 mt-2">
                        {result.waybackUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(result.waybackUrl, '_blank')}
                          >
                            Wayback Machine
                          </Button>
                        )}
                        {result.archivedUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(result.archivedUrl, '_blank')}
                          >
                            Archive Now
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400">
                    Analyzed on {new Date(result.processedAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk URL Analysis</CardTitle>
              <CardDescription>
                Analyze multiple URLs at once (Coming Soon)
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Bulk Analysis Feature</p>
              <p className="text-sm text-gray-400">
                Upload a CSV file with URLs or paste multiple URLs for batch processing
              </p>
              <Button variant="outline" className="mt-4" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}