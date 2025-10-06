import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Link2, Loader2, FileText, BarChart3, Users, MessageSquare,
  Star, Save, ExternalLink, Archive, Clock, Bookmark, FolderOpen, Send, AlertCircle, BookOpen, Shield,
  Copy, Check
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { ContentAnalysis, ProcessingStatus, AnalysisTab, SavedLink, QuestionAnswer } from '@/types/content-intelligence'
import { extractCitationData, createCitationParams } from '@/utils/content-to-citation'

export default function ContentIntelligencePage() {
  const { toast } = useToast()
  const navigate = useNavigate()

  // State
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<'quick' | 'full' | 'forensic'>('full')
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<ProcessingStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null)
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview')
  const [bypassUrls, setBypassUrls] = useState<Record<string, string>>({})
  const [saveNote, setSaveNote] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([])
  const [loadingSavedLinks, setLoadingSavedLinks] = useState(false)

  // Q&A State
  const [question, setQuestion] = useState('')
  const [qaHistory, setQaHistory] = useState<QuestionAnswer[]>([])
  const [askingQuestion, setAskingQuestion] = useState(false)

  // VirusTotal State
  const [vtLoading, setVtLoading] = useState(false)
  const [vtData, setVtData] = useState<any>(null)
  const [showVtModal, setShowVtModal] = useState(false)

  // Citation State
  const [generatedCitation, setGeneratedCitation] = useState<string>('')
  const [showCitationCopied, setShowCitationCopied] = useState(false)

  // Country Origin State
  const [countryInfo, setCountryInfo] = useState<any>(null)
  const [countryLoading, setCountryLoading] = useState(false)

  // Load saved links
  useEffect(() => {
    loadSavedLinks()
  }, [])

  const loadSavedLinks = async () => {
    setLoadingSavedLinks(true)
    try {
      const response = await fetch('/api/content-intelligence/saved-links?limit=5')
      if (response.ok) {
        const data = await response.json()
        setSavedLinks(data.links || [])
      }
    } catch (error) {
      console.error('Failed to load saved links:', error)
    } finally {
      setLoadingSavedLinks(false)
    }
  }

  // Quick save link (without processing)
  const handleQuickSave = async () => {
    if (!url) {
      toast({ title: 'Error', description: 'Please enter a URL', variant: 'destructive' })
      return
    }

    try {
      const response = await fetch('/api/content-intelligence/saved-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          note: saveNote || undefined,
          tags: saveTags ? saveTags.split(',').map(t => t.trim()) : [],
          auto_analyze: false
        })
      })

      if (!response.ok) throw new Error('Failed to save link')

      const savedData = await response.json()

      toast({
        title: 'Success',
        description: 'Link saved to library. Scroll down to see Recently Saved Links section.'
      })
      setSaveNote('')
      setSaveTags('')
      loadSavedLinks() // Refresh saved links
    } catch (error) {
      console.error('Save error:', error)
      toast({ title: 'Error', description: 'Failed to save link', variant: 'destructive' })
    }
  }

  // Analyze URL
  const handleAnalyze = async () => {
    if (!url) {
      toast({ title: 'Error', description: 'Please enter a URL', variant: 'destructive' })
      return
    }

    // Clear previous analysis and bypass URLs
    setAnalysis(null)
    setQaHistory([])
    setProcessing(true)
    setStatus('extracting')
    setProgress(10)
    setCurrentStep('Extracting content...')

    try {
      // Generate bypass/archive URLs immediately
      const encoded = encodeURIComponent(url)
      setBypassUrls({
        '12ft': `https://12ft.io/proxy?q=${encoded}`,
        'outline': `https://outline.com/${url}`,
        'wayback': `https://web.archive.org/web/*/${url}`,
        'archive_is': `https://archive.is/${url}`,
        'google_cache': `https://webcache.googleusercontent.com/search?q=cache:${encoded}`
      })

      setProgress(30)
      setStatus('analyzing_words')
      setCurrentStep('Analyzing word frequency...')

      const response = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mode,
          save_link: true, // Always auto-save analyzed URLs
          link_note: saveNote || undefined,
          link_tags: saveTags ? saveTags.split(',').map(t => t.trim()) : []
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Analysis failed')
      }

      setProgress(70)
      setStatus('extracting_entities')
      setCurrentStep('Extracting entities...')

      const data = await response.json()

      setProgress(100)
      setStatus('complete')
      setCurrentStep('Complete!')
      setAnalysis(data)

      toast({ title: 'Success', description: 'Analysis complete!' })
    } catch (error) {
      console.error('Analysis error:', error)
      setStatus('error')
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  // Load Q&A history when analysis is available
  useEffect(() => {
    if (analysis?.id) {
      loadQAHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.id])

  const loadQAHistory = async () => {
    if (!analysis?.id) return

    try {
      const response = await fetch(`/api/content-intelligence/answer-question?analysis_id=${analysis.id}`)
      if (response.ok) {
        const data = await response.json()
        setQaHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to load Q&A history:', error)
    }
  }

  // Auto-generate citation inline
  const handleCreateCitation = (analysisData: ContentAnalysis) => {
    try {
      const citationData = extractCitationData(analysisData, url)
      const { generateCitation } = require('@/utils/citation-formatters')

      // Generate APA citation by default
      const { citation } = generateCitation(citationData.fields, citationData.sourceType, 'apa')

      setGeneratedCitation(citation)

      toast({
        title: 'Citation Generated',
        description: 'APA citation created and ready to copy'
      })

      // Scroll to citation section
      setTimeout(() => {
        document.getElementById('citation-section')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('Citation creation error:', error)
      toast({
        title: 'Error',
        description: 'Failed to create citation',
        variant: 'destructive'
      })
    }
  }

  // Copy citation to clipboard
  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(generatedCitation)
      setShowCitationCopied(true)
      toast({
        title: 'Copied!',
        description: 'Citation copied to clipboard'
      })
      setTimeout(() => setShowCitationCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy citation',
        variant: 'destructive'
      })
    }
  }

  // Save entity to evidence
  const saveEntityToEvidence = async (entityName: string, entityType: 'person' | 'organization' | 'location') => {
    try {
      const response = await fetch('/api/actors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: entityName,
          actor_type: entityType === 'person' ? 'INDIVIDUAL' :
                     entityType === 'organization' ? 'ORGANIZATION' : 'OTHER',
          description: `Auto-extracted from: ${analysis?.title || url}`,
          tags: [`content-intelligence`, entityType],
          source_url: url
        })
      })

      if (response.ok) {
        toast({
          title: 'Saved to Evidence',
          description: `${entityName} added to ${entityType === 'person' ? 'Actors' : entityType === 'location' ? 'Places' : 'Evidence'}`
        })
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to save ${entityName}`,
        variant: 'destructive'
      })
    }
  }

  // Save all entities to evidence
  const saveAllEntities = async () => {
    if (!analysis?.entities) return

    let saved = 0
    const allEntities = [
      ...(analysis.entities.people || []).map(p => ({ name: p.name, type: 'person' as const })),
      ...(analysis.entities.organizations || []).map(o => ({ name: o.name, type: 'organization' as const })),
      ...(analysis.entities.locations || []).map(l => ({ name: l.name, type: 'location' as const }))
    ]

    for (const entity of allEntities) {
      try {
        await saveEntityToEvidence(entity.name, entity.type)
        saved++
      } catch (error) {
        console.error(`Failed to save ${entity.name}:`, error)
      }
    }

    toast({
      title: 'Bulk Save Complete',
      description: `Saved ${saved} of ${allEntities.length} entities to evidence`
    })
  }

  // Country origin lookup
  const lookupCountryOrigin = async (urlToLookup: string) => {
    if (!urlToLookup) return

    setCountryLoading(true)
    try {
      const response = await fetch('/api/content-intelligence/domain-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToLookup })
      })

      const data = await response.json()

      if (data.success) {
        setCountryInfo(data)
      } else {
        setCountryInfo(null)
      }
    } catch (error) {
      console.error('Country lookup error:', error)
      setCountryInfo(null)
    } finally {
      setCountryLoading(false)
    }
  }

  // Auto-lookup country when URL is entered
  useEffect(() => {
    if (url && url.startsWith('http')) {
      const timer = setTimeout(() => {
        lookupCountryOrigin(url)
      }, 500) // Debounce
      return () => clearTimeout(timer)
    } else {
      setCountryInfo(null)
    }
  }, [url])

  // VirusTotal security lookup
  const handleVirusTotalLookup = async () => {
    if (!url) {
      toast({ title: 'Error', description: 'Please enter a URL first', variant: 'destructive' })
      return
    }

    setVtLoading(true)
    try {
      const response = await fetch('/api/content-intelligence/virustotal-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const data = await response.json()

      if (!response.ok && !data.directLink) {
        throw new Error(data.error || 'VirusTotal lookup failed')
      }

      // If we have data, show modal; otherwise open direct link
      if (data.stats || data.reputation !== undefined) {
        setVtData(data)
        setShowVtModal(true)
      } else {
        // Open VirusTotal directly if API fails
        window.open(data.directLink, '_blank', 'noopener,noreferrer')
        toast({
          title: 'Opening VirusTotal',
          description: data.message || 'View domain security report on VirusTotal'
        })
      }
    } catch (error) {
      console.error('VirusTotal lookup error:', error)

      // Fallback: open VirusTotal directly
      try {
        const domain = new URL(url).hostname
        window.open(`https://www.virustotal.com/gui/domain/${domain}`, '_blank', 'noopener,noreferrer')
        toast({
          title: 'Opening VirusTotal',
          description: 'API unavailable, opening direct link'
        })
      } catch {
        toast({
          title: 'Error',
          description: 'Invalid URL or VirusTotal unavailable',
          variant: 'destructive'
        })
      }
    } finally {
      setVtLoading(false)
    }
  }

  // Ask a question about the content
  const handleAskQuestion = async () => {
    if (!question.trim() || !analysis?.id) {
      toast({ title: 'Error', description: 'Please enter a question', variant: 'destructive' })
      return
    }

    setAskingQuestion(true)
    try {
      const response = await fetch('/api/content-intelligence/answer-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analysis.id,
          question: question.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to answer question')
      }

      const data = await response.json()
      setQaHistory(prev => [data, ...prev])
      setQuestion('')

      toast({
        title: 'Question answered',
        description: data.has_complete_answer
          ? 'Answer found with high confidence'
          : 'Partial answer found - some information may be missing'
      })
    } catch (error) {
      console.error('Q&A error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to answer question',
        variant: 'destructive'
      })
    } finally {
      setAskingQuestion(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Content Intelligence & Link Analysis
        </h1>
        <p className="text-muted-foreground">
          Analyze URLs, extract insights, preserve evidence, and ask questions
        </p>
      </div>

      {/* Input Section */}
      <Card className="p-6 space-y-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter URL to analyze..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              className="flex-1"
            />
            <Button onClick={handleQuickSave} variant="outline" disabled={processing}>
              <Save className="h-4 w-4 mr-2" />
              Quick Save
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add note (optional)..."
              value={saveNote}
              onChange={(e) => setSaveNote(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Tags (comma-separated)..."
              value={saveTags}
              onChange={(e) => setSaveTags(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex gap-2">
              <Button
                variant={mode === 'quick' ? 'default' : 'outline'}
                onClick={() => setMode('quick')}
                size="sm"
              >
                Quick
              </Button>
              <Button
                variant={mode === 'full' ? 'default' : 'outline'}
                onClick={() => setMode('full')}
                size="sm"
              >
                Full
              </Button>
              <Button
                variant={mode === 'forensic' ? 'default' : 'outline'}
                onClick={() => setMode('forensic')}
                size="sm"
              >
                Forensic
              </Button>
            </div>

            <Button onClick={handleAnalyze} disabled={processing} className="ml-auto">
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Analyze Content
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Country Origin Info - Auto-detected */}
      {countryInfo && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-300">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{countryInfo.flag}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Hosted in {countryInfo.country}
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-0.5">
                <p>Domain: {countryInfo.domain}</p>
                {countryInfo.ip && <p>IP: {countryInfo.ip}</p>}
                {countryInfo.city && countryInfo.region && (
                  <p>Location: {countryInfo.city}, {countryInfo.region}</p>
                )}
                {countryInfo.org && <p>Organization: {countryInfo.org}</p>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {countryLoading && (
        <Card className="p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up domain country...
          </div>
        </Card>
      )}

      {/* Quick Actions - Appear immediately when URL entered */}
      {(url && bypassUrls['12ft']) && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Quick Actions (Click while processing)</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVirusTotalLookup}
              disabled={vtLoading}
              className="bg-blue-50 dark:bg-blue-950 border-blue-300 hover:bg-blue-100"
            >
              {vtLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Shield className="h-3 w-3 mr-1" />
              )}
              VirusTotal Security
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={bypassUrls['12ft']} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                12ft.io Bypass
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={bypassUrls.archive_is} target="_blank" rel="noopener noreferrer">
                <Archive className="h-3 w-3 mr-1" />
                Archive.is
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={bypassUrls.wayback} target="_blank" rel="noopener noreferrer">
                <Clock className="h-3 w-3 mr-1" />
                Wayback Machine
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={bypassUrls.outline} target="_blank" rel="noopener noreferrer">
                <FileText className="h-3 w-3 mr-1" />
                Outline
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={bypassUrls.google_cache} target="_blank" rel="noopener noreferrer">
                <Bookmark className="h-3 w-3 mr-1" />
                Google Cache
              </a>
            </Button>
          </div>
        </Card>
      )}

      {/* Processing Status */}
      {processing && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{currentStep}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </Card>
      )}

      {/* Results */}
      {analysis && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalysisTab)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <FileText className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="word-analysis">
              <BarChart3 className="h-4 w-4 mr-2" />
              Word Analysis
            </TabsTrigger>
            <TabsTrigger value="entities">
              <Users className="h-4 w-4 mr-2" />
              Entities
            </TabsTrigger>
            <TabsTrigger value="qa">
              <MessageSquare className="h-4 w-4 mr-2" />
              Q&A
            </TabsTrigger>
            <TabsTrigger value="starbursting">
              <Star className="h-4 w-4 mr-2" />
              Starbursting
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{analysis.title || 'Untitled'}</h2>
                  {analysis.author && (
                    <p className="text-sm text-muted-foreground">By {analysis.author}</p>
                  )}
                  {analysis.publish_date && (
                    <p className="text-sm text-muted-foreground">Published: {analysis.publish_date}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateCitation(analysis)}
                  className="ml-4"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Create Citation
                </Button>
              </div>

              {analysis.summary && (
                <div>
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <p className="text-sm">{analysis.summary}</p>
                </div>
              )}

              {/* Citation Section */}
              {generatedCitation && (
                <div id="citation-section" className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Citation (APA)</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-sm font-serif">{generatedCitation}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyCitation}
                    className="mt-2"
                  >
                    {showCitationCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Citation
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Quick Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Word Count</p>
                    <p className="font-semibold">{analysis.word_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">People</p>
                    <p className="font-semibold">{analysis.entities?.people?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Organizations</p>
                    <p className="font-semibold">{analysis.entities?.organizations?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Locations</p>
                    <p className="font-semibold">{analysis.entities?.locations?.length || 0}</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="word-analysis" className="mt-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Top Phrases (2-10 words)</h3>
              <div className="space-y-2">
                {analysis.top_phrases.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-8">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{item.phrase}</span>
                        <span className="text-sm font-semibold">{item.count}×</span>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="entities" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Extracted Entities</h3>
              <Button onClick={saveAllEntities} variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save All to Evidence
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">👥 People ({analysis.entities?.people?.length || 0})</h3>
                <div className="space-y-2">
                  {(analysis.entities?.people || []).slice(0, 10).map((person, i) => (
                    <div key={i} className="text-sm flex justify-between items-center">
                      <div>
                        <span className="font-medium">{person.name}</span>
                        <span className="text-muted-foreground ml-2">({person.count}×)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEntityToEvidence(person.name, 'person')}
                        className="h-7 px-2"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!analysis.entities?.people || analysis.entities.people.length === 0) && (
                    <p className="text-sm text-muted-foreground">No people found</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">🏢 Organizations ({analysis.entities?.organizations?.length || 0})</h3>
                <div className="space-y-2">
                  {(analysis.entities?.organizations || []).slice(0, 10).map((org, i) => (
                    <div key={i} className="text-sm flex justify-between items-center">
                      <div>
                        <span className="font-medium">{org.name}</span>
                        <span className="text-muted-foreground ml-2">({org.count}×)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEntityToEvidence(org.name, 'organization')}
                        className="h-7 px-2"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!analysis.entities?.organizations || analysis.entities.organizations.length === 0) && (
                    <p className="text-sm text-muted-foreground">No organizations found</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3">📍 Locations ({analysis.entities?.locations?.length || 0})</h3>
                <div className="space-y-2">
                  {(analysis.entities?.locations || []).slice(0, 10).map((loc, i) => (
                    <div key={i} className="text-sm flex justify-between items-center">
                      <div>
                        <span className="font-medium">{loc.name}</span>
                        <span className="text-muted-foreground ml-2">({loc.count}×)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEntityToEvidence(loc.name, 'location')}
                        className="h-7 px-2"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!analysis.entities?.locations || analysis.entities.locations.length === 0) && (
                    <p className="text-sm text-muted-foreground">No locations found</p>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="qa" className="mt-4 space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Ask Questions About This Content</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ask questions and get AI-powered answers with source citations from the analyzed content
              </p>

              {/* Question Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="What would you like to know about this content?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="min-h-[60px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAskQuestion()
                    }
                  }}
                />
                <Button
                  onClick={handleAskQuestion}
                  disabled={askingQuestion || !question.trim()}
                  className="shrink-0"
                >
                  {askingQuestion ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </Card>

            {/* Q&A History */}
            {qaHistory.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Q&A History</h3>
                {qaHistory.map((qa) => (
                  <Card key={qa.id} className="p-6">
                    {/* Question */}
                    <div className="mb-4">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-600 shrink-0 mt-1" />
                        <div className="flex-1">
                          <p className="font-medium text-lg">{qa.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(qa.created_at).toLocaleString()} • {qa.search_method} search
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Answer */}
                    {qa.answer && (
                      <div className="ml-7 mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{qa.answer}</p>
                        {qa.confidence_score !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Confidence:</span>
                            <Progress value={qa.confidence_score * 100} className="w-24 h-2" />
                            <span className="text-xs font-medium">{Math.round(qa.confidence_score * 100)}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Source Excerpts */}
                    {qa.source_excerpts && qa.source_excerpts.length > 0 && (
                      <div className="ml-7 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Source Excerpts:</p>
                        {qa.source_excerpts.map((excerpt, i) => (
                          <div
                            key={i}
                            className="p-3 bg-gray-50 dark:bg-gray-800 rounded border-l-2 border-blue-500"
                          >
                            <p className="text-sm italic">"{excerpt.text}"</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-muted-foreground">
                                Paragraph {excerpt.paragraph}
                              </span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">
                                Relevance: {Math.round(excerpt.relevance * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Missing Data Warning */}
                    {!qa.has_complete_answer && qa.missing_data_notes && (
                      <div className="ml-7 mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                            Incomplete Answer
                          </p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                            {qa.missing_data_notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {qaHistory.length === 0 && !askingQuestion && (
              <Card className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No questions asked yet.</p>
                <p className="text-sm mt-1">Ask a question above to get started.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="starbursting" className="mt-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">🌟 Starbursting Analysis</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Launch deep-dive question analysis using the Starbursting framework
              </p>
              {/* TODO: Implement Starbursting launcher */}
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Saved Links Library */}
      <div id="saved-links" className="mt-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Recently Saved Links
            </h2>
            <Button variant="outline" size="sm" disabled title="Full library view coming soon">
              View All
            </Button>
          </div>

          {loadingSavedLinks ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading saved links...
            </div>
          ) : savedLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No saved links yet.</p>
              <p className="text-sm mt-1">Use "Quick Save" above to save links for later analysis.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedLinks.map((link) => (
                <div
                  key={link.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{link.title || 'Untitled'}</h3>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {link.url}
                      </a>
                      {link.note && (
                        <p className="text-sm text-muted-foreground mt-1">{link.note}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {link.tags && link.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {link.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(link.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUrl(link.url)
                          if (link.note) setSaveNote(link.note)
                          if (link.tags?.length) setSaveTags(link.tags.join(', '))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        {link.is_processed ? 'Re-analyze' : 'Analyze Now'}
                      </Button>
                      {link.is_processed && link.analysis_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              // Fetch the full analysis to create citation
                              const response = await fetch(`/api/content-intelligence/analyze-url`)
                              // For now, use the link data directly
                              const mockAnalysis: ContentAnalysis = {
                                id: link.analysis_id!,
                                user_id: 1,
                                url: link.url,
                                url_normalized: link.url,
                                content_hash: '',
                                title: link.title,
                                domain: link.domain || new URL(link.url).hostname,
                                is_social_media: link.is_social_media,
                                social_platform: link.social_platform,
                                extracted_text: '',
                                word_count: 0,
                                word_frequency: {},
                                top_phrases: [],
                                entities: { people: [], organizations: [], locations: [] },
                                archive_urls: {},
                                bypass_urls: {
                                  '12ft': '',
                                  'outline': '',
                                  'google_cache': ''
                                },
                                processing_mode: 'full',
                                processing_duration_ms: 0,
                                created_at: link.created_at,
                                updated_at: link.updated_at
                              }
                              handleCreateCitation(mockAnalysis)
                            } catch (error) {
                              toast({ title: 'Error', description: 'Failed to create citation', variant: 'destructive' })
                            }
                          }}
                          title="Create citation from this link"
                        >
                          <BookOpen className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* VirusTotal Security Modal */}
      <Dialog open={showVtModal} onOpenChange={setShowVtModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              VirusTotal Security Report
            </DialogTitle>
            <DialogDescription>
              Domain security analysis powered by VirusTotal
            </DialogDescription>
          </DialogHeader>

          {vtData && (
            <div className="space-y-6">
              {/* Domain Info */}
              <div>
                <h3 className="font-semibold text-lg mb-2">{vtData.domain}</h3>
                <p className="text-sm text-muted-foreground">
                  Last analyzed: {new Date(vtData.lastAnalysisDate).toLocaleString()}
                </p>
              </div>

              {/* Summary */}
              <div className={`p-4 rounded-lg ${
                vtData.riskLevel === 'safe' ? 'bg-green-50 dark:bg-green-950 border border-green-300' :
                vtData.riskLevel === 'low' ? 'bg-blue-50 dark:bg-blue-950 border border-blue-300' :
                vtData.riskLevel === 'medium' ? 'bg-yellow-50 dark:bg-yellow-950 border border-yellow-300' :
                vtData.riskLevel === 'high' ? 'bg-orange-50 dark:bg-orange-950 border border-orange-300' :
                'bg-red-50 dark:bg-red-950 border border-red-300'
              }`}>
                <p className="text-sm font-medium">{vtData.summary}</p>
              </div>

              {/* Safety Score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Safety Score</span>
                  <span className="text-2xl font-bold">{vtData.safetyScore}/100</span>
                </div>
                <Progress value={vtData.safetyScore} className="h-3" />
              </div>

              {/* Detection Stats */}
              <div>
                <h4 className="font-semibold mb-3">Security Vendor Analysis</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-xs text-muted-foreground">Harmless</p>
                    <p className="text-2xl font-bold text-green-600">{vtData.stats.harmless}</p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-xs text-muted-foreground">Malicious</p>
                    <p className="text-2xl font-bold text-red-600">{vtData.stats.malicious}</p>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <p className="text-xs text-muted-foreground">Suspicious</p>
                    <p className="text-2xl font-bold text-yellow-600">{vtData.stats.suspicious}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">Undetected</p>
                    <p className="text-2xl font-bold">{vtData.stats.undetected}</p>
                  </div>
                </div>
              </div>

              {/* Community Votes */}
              {vtData.votes && (vtData.votes.harmless > 0 || vtData.votes.malicious > 0) && (
                <div>
                  <h4 className="font-semibold mb-3">Community Votes</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">Harmless: {vtData.votes.harmless}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm">Malicious: {vtData.votes.malicious}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reputation */}
              {vtData.reputation !== 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Reputation Score</h4>
                  <p className="text-sm">
                    {vtData.reputation > 0 ? (
                      <span className="text-green-600 font-medium">+{vtData.reputation} (Positive)</span>
                    ) : (
                      <span className="text-red-600 font-medium">{vtData.reputation} (Negative)</span>
                    )}
                  </p>
                </div>
              )}

              {/* Categories */}
              {vtData.categories && Object.keys(vtData.categories).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(vtData.categories).slice(0, 5).map(([vendor, category]: [string, any]) => (
                      <span key={vendor} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* View Full Report */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(vtData.directLink, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Report on VirusTotal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
