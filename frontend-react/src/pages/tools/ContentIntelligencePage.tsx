import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import {
  Link2, Loader2, FileText, BarChart3, Users, MessageSquare,
  Star, Save, ExternalLink, Archive, Clock, Bookmark, FolderOpen, Send, AlertCircle, BookOpen, Shield,
  Copy, Check, Video, Download, Play, Info, Image, FileDown, Globe, SmileIcon, FrownIcon, MehIcon, Grid3x3
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { ContentAnalysis, ProcessingStatus, AnalysisTab, SavedLink, QuestionAnswer } from '@/types/content-intelligence'
import { extractCitationData, createCitationParams } from '@/utils/content-to-citation'
import { addCitation, generateCitationId } from '@/utils/citation-library'

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
  const [citationSaved, setCitationSaved] = useState(false)
  const [currentCitationData, setCurrentCitationData] = useState<any>(null)

  // Country Origin State
  const [countryInfo, setCountryInfo] = useState<any>(null)
  const [countryLoading, setCountryLoading] = useState(false)

  // Social Media Extraction State
  const [socialMediaData, setSocialMediaData] = useState<any>(null)
  const [socialExtractLoading, setSocialExtractLoading] = useState(false)

  // Duplicate Detection State
  const [existingActors, setExistingActors] = useState<Record<string, { id: string, name: string }>>({})
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)

  // Starbursting Background Processing State
  const [starburstingSession, setStarburstingSession] = useState<any>(null)
  const [starburstingStatus, setStarburstingStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle')
  const [starburstingError, setStarburstingError] = useState<string | null>(null)

  // Word Analysis View State
  const [wordCloudView, setWordCloudView] = useState<'words' | 'phrases' | 'entities'>('words')

  // Text View State (Summary vs Full Text)
  const [textView, setTextView] = useState<'summary' | 'fulltext'>('summary')

  // Format full text for better readability
  const formatFullText = (text: string): string => {
    if (!text) return ''

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Add paragraph breaks at common separators
      .replace(/\. ([A-Z])/g, '.\n\n$1')
      // Clean up common artifacts
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // Export comprehensive report
  const exportFullReport = () => {
    if (!analysis) return

    // Create a new window with the report
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) {
      toast({
        title: 'Error',
        description: 'Please allow popups to export the report',
        variant: 'destructive'
      })
      return
    }

    // Build comprehensive HTML report
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${analysis.title || 'Content Intelligence Report'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #333; }
          h1 { color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-bottom: 30px; }
          h2 { color: #2563eb; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
          h3 { color: #4b5563; margin-top: 30px; margin-bottom: 15px; }
          .metadata { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .metadata p { margin: 8px 0; }
          .metadata strong { color: #1f2937; }
          .citation { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; font-family: 'Georgia', serif; }
          .summary { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .qa-item { background: #ffffff; border: 1px solid #e5e7eb; padding: 15px; margin: 10px 0; border-radius: 6px; }
          .qa-question { font-weight: 600; color: #1f2937; margin-bottom: 8px; }
          .qa-answer { color: #4b5563; margin-left: 20px; }
          .entity-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; }
          .entity-item { background: #f3f4f6; padding: 10px; border-radius: 4px; }
          .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-card { background: #fefce8; padding: 15px; border-radius: 8px; border-left: 4px solid #eab308; }
          .stat-label { font-size: 0.875rem; color: #78350f; font-weight: 500; }
          .stat-value { font-size: 1.875rem; font-weight: bold; color: #713f12; margin-top: 5px; }
          .link-button { background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0; }
          .link-button:hover { background: #2563eb; }
          @media print { .no-print { display: none; } }
          @page { margin: 2cm; }
        </style>
      </head>
      <body>
        <h1>Content Intelligence Report</h1>

        <!-- Metadata -->
        <div class="metadata">
          <p><strong>Title:</strong> ${analysis.title || 'Untitled'}</p>
          <p><strong>URL:</strong> <a href="${analysis.url}" target="_blank">${analysis.url}</a></p>
          ${analysis.author ? `<p><strong>Author:</strong> ${analysis.author}</p>` : ''}
          ${analysis.publish_date ? `<p><strong>Published:</strong> ${analysis.publish_date}</p>` : ''}
          <p><strong>Domain:</strong> ${analysis.domain}</p>
          <p><strong>Analysis Date:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Word Count:</strong> ${analysis.word_count.toLocaleString()}</p>
          ${analysis.is_social_media ? `<p><strong>Platform:</strong> ${analysis.social_platform?.toUpperCase()}</p>` : ''}
        </div>

        <!-- Citation -->
        ${generatedCitation ? `
          <h2>Citation (APA)</h2>
          <div class="citation">${generatedCitation}</div>
        ` : ''}

        <!-- Summary -->
        ${analysis.summary ? `
          <h2>Summary</h2>
          <div class="summary">${analysis.summary}</div>
        ` : ''}

        <!-- Quick Stats -->
        <h2>Analysis Overview</h2>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Total Words</div>
            <div class="stat-value">${analysis.word_count.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Unique Words</div>
            <div class="stat-value">${Object.keys(analysis.word_frequency || {}).length.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">People Identified</div>
            <div class="stat-value">${analysis.entities?.people?.length || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Organizations</div>
            <div class="stat-value">${analysis.entities?.organizations?.length || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Locations</div>
            <div class="stat-value">${analysis.entities?.locations?.length || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Top Phrases</div>
            <div class="stat-value">${analysis.top_phrases?.length || 0}</div>
          </div>
        </div>

        <!-- Entities -->
        ${analysis.entities ? `
          <h2>Extracted Entities</h2>

          ${analysis.entities.people && analysis.entities.people.length > 0 ? `
            <h3>People (${analysis.entities.people.length})</h3>
            <div class="entity-list">
              ${analysis.entities.people.slice(0, 20).map((p: any) =>
                `<div class="entity-item">${p.name} ${p.count > 1 ? `(${p.count}×)` : ''}</div>`
              ).join('')}
            </div>
          ` : ''}

          ${analysis.entities.organizations && analysis.entities.organizations.length > 0 ? `
            <h3>Organizations (${analysis.entities.organizations.length})</h3>
            <div class="entity-list">
              ${analysis.entities.organizations.slice(0, 20).map((o: any) =>
                `<div class="entity-item">${o.name} ${o.count > 1 ? `(${o.count}×)` : ''}</div>`
              ).join('')}
            </div>
          ` : ''}

          ${analysis.entities.locations && analysis.entities.locations.length > 0 ? `
            <h3>Locations (${analysis.entities.locations.length})</h3>
            <div class="entity-list">
              ${analysis.entities.locations.slice(0, 20).map((l: any) =>
                `<div class="entity-item">${l.name} ${l.count > 1 ? `(${l.count}×)` : ''}</div>`
              ).join('')}
            </div>
          ` : ''}
        ` : ''}

        <!-- Q&A History -->
        ${qaHistory && qaHistory.length > 0 ? `
          <h2>Questions & Answers</h2>
          ${qaHistory.map((qa, index) => `
            <div class="qa-item">
              <div class="qa-question">Q${index + 1}: ${qa.question}</div>
              <div class="qa-answer">A: ${qa.answer}</div>
            </div>
          `).join('')}
        ` : ''}

        <!-- Top Phrases -->
        ${analysis.top_phrases && analysis.top_phrases.length > 0 ? `
          <h2>Top Phrases</h2>
          <div class="entity-list">
            ${analysis.top_phrases.slice(0, 20).map((p: any) =>
              `<div class="entity-item">${p.phrase} (${p.count}×)</div>`
            ).join('')}
          </div>
        ` : ''}

        <!-- Starbursting Link -->
        ${starburstingSession && starburstingStatus === 'complete' ? `
          <h2>Starbursting Analysis</h2>
          <p>A comprehensive 5W1H (Who, What, When, Where, Why, How) analysis has been generated for this content.</p>
          <a href="/dashboard/analysis-frameworks/starbursting/${starburstingSession.session_id}/view" class="link-button no-print">
            View Starbursting Analysis →
          </a>
          <p class="no-print" style="font-size: 0.875rem; color: #6b7280; margin-top: 10px;">
            Direct link: ${window.location.origin}/dashboard/analysis-frameworks/starbursting/${starburstingSession.session_id}/view
          </p>
        ` : ''}

        <!-- Print Instructions -->
        <div class="no-print" style="margin-top: 40px; padding: 20px; background: #f3f4f6; border-radius: 8px;">
          <p><strong>To save this report:</strong></p>
          <ul>
            <li>Press Ctrl+P (Windows) or Cmd+P (Mac) to print</li>
            <li>Select "Save as PDF" as the destination</li>
            <li>Click Save</li>
          </ul>
          <button onclick="window.print()" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">
            Print / Save as PDF
          </button>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center;">
          Generated by Content Intelligence Tool • ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `

    reportWindow.document.write(reportHTML)
    reportWindow.document.close()

    toast({
      title: 'Report Generated',
      description: 'Report opened in new window. You can print or save as PDF.'
    })
  }

  // Export word cloud as image
  const exportWordCloud = async (format: 'png' | 'jpeg', includeMetadata: boolean) => {
    const container = document.getElementById('word-cloud-container')
    if (!container || !analysis) {
      toast({
        title: 'Error',
        description: 'Word cloud not found',
        variant: 'destructive'
      })
      return
    }

    try {
      console.log('[Export] Starting word cloud export...')

      // Create a wrapper div with metadata if requested
      const exportContainer = document.createElement('div')
      exportContainer.style.padding = '40px'
      exportContainer.style.background = 'white'
      exportContainer.style.width = 'fit-content'
      exportContainer.style.maxWidth = '1200px'

      if (includeMetadata) {
        const metadata = document.createElement('div')
        metadata.style.marginBottom = '20px'
        metadata.style.color = '#000'
        metadata.innerHTML = `
          <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">${wordCloudView.charAt(0).toUpperCase() + wordCloudView.slice(1)} Word Cloud</h2>
          <p style="font-size: 14px; color: #666; margin-bottom: 4px;"><strong>Source:</strong> ${analysis.title || 'Untitled'}</p>
          <p style="font-size: 14px; color: #666;"><strong>URL:</strong> ${analysis.url}</p>
        `
        exportContainer.appendChild(metadata)
      }

      // Clone the word cloud container
      const clone = container.cloneNode(true) as HTMLElement
      // Remove the id to avoid conflicts
      clone.removeAttribute('id')

      exportContainer.appendChild(clone)

      // Temporarily add to DOM for rendering (position off-screen)
      exportContainer.style.position = 'absolute'
      exportContainer.style.left = '-9999px'
      exportContainer.style.top = '-9999px'
      document.body.appendChild(exportContainer)

      // Strip all Tailwind classes and apply plain RGB colors
      // This completely avoids oklch color issues
      const stripTailwindAndApplyRgb = (element: HTMLElement) => {
        // Get computed style BEFORE removing class
        const computedStyle = window.getComputedStyle(element)
        const color = computedStyle.color
        const backgroundColor = computedStyle.backgroundColor
        const fontSize = computedStyle.fontSize
        const fontWeight = computedStyle.fontWeight
        const opacity = computedStyle.opacity

        // Remove ALL classes to avoid Tailwind
        element.className = ''

        // Apply computed styles as inline RGB
        if (color && !color.includes('oklch')) {
          element.style.color = color
        } else if (color) {
          // Fallback to black if still has oklch
          element.style.color = 'rgb(0, 0, 0)'
        }

        if (backgroundColor && !backgroundColor.includes('oklch') && backgroundColor !== 'rgba(0, 0, 0, 0)') {
          element.style.backgroundColor = backgroundColor
        }

        element.style.fontSize = fontSize
        element.style.fontWeight = fontWeight
        element.style.opacity = opacity

        // Process all children recursively
        Array.from(element.children).forEach(child => {
          if (child instanceof HTMLElement) {
            stripTailwindAndApplyRgb(child)
          }
        })
      }

      // Strip classes and apply RGB colors
      stripTailwindAndApplyRgb(clone)

      // Replace the gradient background with plain colors
      clone.style.background = 'linear-gradient(135deg, rgb(239, 246, 255) 0%, rgb(250, 245, 255) 100%)'
      clone.style.borderRadius = '8px'
      clone.style.padding = '32px'
      clone.style.minHeight = '300px'
      clone.style.display = 'flex'
      clone.style.flexWrap = 'wrap'
      clone.style.alignItems = 'center'
      clone.style.justifyContent = 'center'
      clone.style.gap = '16px'

      // Force white background on container
      exportContainer.style.setProperty('background-color', '#ffffff', 'important')

      console.log('[Export] Rendering canvas...')
      // Capture as canvas with minimal options
      const canvas = await html2canvas(exportContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      })

      // Remove temporary element
      document.body.removeChild(exportContainer)

      console.log('[Export] Canvas rendered, creating download...')
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({
            title: 'Error',
            description: 'Failed to create image blob',
            variant: 'destructive'
          })
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const viewName = wordCloudView.charAt(0).toUpperCase() + wordCloudView.slice(1)
        link.download = `wordcloud-${viewName}-${new Date().getTime()}.${format}`
        link.href = url
        link.click()
        URL.revokeObjectURL(url)

        console.log('[Export] Download triggered successfully')
        toast({
          title: 'Success',
          description: `Word cloud exported as ${format.toUpperCase()}`
        })
      }, `image/${format}`, 0.95)

    } catch (error) {
      console.error('[Export] Failed:', error)
      toast({
        title: 'Error',
        description: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      })
    }
  }

  // Load saved links and check for pending URL from landing page
  useEffect(() => {
    loadSavedLinks()

    // Check if user came from landing page with a URL to analyze
    const pendingUrl = localStorage.getItem('pending_url_analysis')
    if (pendingUrl) {
      setUrl(pendingUrl)
      localStorage.removeItem('pending_url_analysis')
      // Auto-start analysis after a brief delay to allow state to update
      setTimeout(() => {
        const analyzeButton = document.querySelector('[data-analyze-button]') as HTMLButtonElement
        if (analyzeButton) {
          analyzeButton.click()
        }
      }, 800)
    }
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

  // Quick save link (fetches title first, then saves without full analysis)
  const handleQuickSave = async () => {
    if (!url) {
      toast({ title: 'Error', description: 'Please enter a URL', variant: 'destructive' })
      return
    }

    try {
      // First, do a quick analysis to fetch the title
      toast({ title: 'Fetching page title...', description: 'Please wait', variant: 'default' })

      const analyzeResponse = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mode: 'quick',
          save_link: true,
          link_note: saveNote || undefined,
          link_tags: saveTags ? saveTags.split(',').map(t => t.trim()) : []
        })
      })

      if (!analyzeResponse.ok) {
        // If quick analysis fails, fallback to saving without title
        console.warn('Quick analysis failed, saving without title')

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

        if (!response.ok) {
          // Handle 409 Conflict (link already saved)
          if (response.status === 409) {
            toast({
              title: 'Link Already Saved',
              description: 'This link has already been saved to your library.',
              variant: 'default'
            })
            loadSavedLinks() // Refresh to show the existing link
            return
          }
          throw new Error('Failed to save link')
        }
      }

      toast({
        title: 'Success',
        description: 'Link saved with title to library. Scroll down to see Recently Saved Links section.'
      })
      setSaveNote('')
      setSaveTags('')
      setUrl('') // Clear the URL input
      loadSavedLinks() // Refresh saved links
    } catch (error) {
      console.error('Save error:', error)
      toast({ title: 'Error', description: 'Failed to save link', variant: 'destructive' })
    }
  }

  // Analyze URL
  const handleAnalyze = async (urlToAnalyze?: string) => {
    const targetUrl = urlToAnalyze || url
    if (!targetUrl) {
      toast({ title: 'Error', description: 'Please enter a URL', variant: 'destructive' })
      return
    }

    // If URL was passed in, update the state to reflect it in the UI
    if (urlToAnalyze) {
      setUrl(urlToAnalyze)
    }

    // Clear previous analysis and bypass URLs
    setAnalysis(null)
    setQaHistory([])
    setProcessing(true)
    setStatus('extracting')
    setProgress(10)

    // Detect social media platform for custom progress messages
    const isSocialMedia = /youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|reddit\.com/i.test(targetUrl)
    const socialPlatform = isSocialMedia
      ? targetUrl.match(/(youtube|twitter|x\.com|facebook|instagram|tiktok|linkedin|reddit)/i)?.[0] || 'social media'
      : null

    setCurrentStep(isSocialMedia
      ? `Extracting ${socialPlatform} content (video/audio transcripts may take longer)...`
      : 'Extracting content...'
    )

    try {
      // Generate bypass/archive URLs immediately
      const encoded = encodeURIComponent(targetUrl)
      setBypassUrls({
        '12ft': `https://12ft.io/proxy?q=${encoded}`,
        'wayback': `https://web.archive.org/web/*/${targetUrl}`,
        'archive_is': `https://archive.is/${targetUrl}`
      })

      setProgress(30)
      setStatus('analyzing_words')
      setCurrentStep(isSocialMedia
        ? `Analyzing ${socialPlatform} content and engagement patterns...`
        : 'Analyzing word frequency...'
      )

      const response = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
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

      // Check for duplicate entities in the background
      if (data.entities) {
        checkEntityDuplicates(data.entities)
      }

      // Start Starbursting analysis in the background
      if (data.id) {
        startStarburstingInBackground(data.id)
      }

      toast({ title: 'Success', description: 'Analysis complete!' })
    } catch (error) {
      console.error('Analysis error:', error)
      setStatus('error')

      // Show user-friendly error message
      let errorMessage = 'Unknown error'
      let errorDescription = ''

      if (error instanceof Error) {
        if (error.message.includes('blocked access')) {
          errorMessage = 'Website Blocked Access'
          errorDescription = 'The website blocked automated access. Scroll down to see Bypass URLs that may help.'
        } else if (error.message.includes('timeout') || error.message.includes('took too long')) {
          errorMessage = 'Request Timeout'
          errorDescription = 'The website took too long to respond. Try a bypass URL or try again later.'
        } else if (error.message.includes('not found')) {
          errorMessage = 'Page Not Found'
          errorDescription = 'The URL may be incorrect or the page may have been removed.'
        } else {
          errorMessage = 'Analysis Failed'
          errorDescription = error.message
        }
      }

      toast({
        title: errorMessage,
        description: errorDescription,
        variant: 'destructive'
      })

      // Even on error, show bypass URLs if they were generated
      if (!bypassUrls || Object.keys(bypassUrls).length === 0) {
        const encoded = encodeURIComponent(url)
        setBypassUrls({
          '12ft': `https://12ft.io/proxy?q=${encoded}`,
          'wayback': `https://web.archive.org/web/*/${url}`,
          'archive_is': `https://archive.is/${url}`
        })
      }
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
      const { citation, inTextCitation } = generateCitation(citationData.fields, citationData.sourceType, 'apa')

      setGeneratedCitation(citation)
      setCurrentCitationData({ citationData, citation, inTextCitation })
      setCitationSaved(false) // Reset saved state

      toast({
        title: 'Citation Generated',
        description: 'APA citation created and ready to copy'
      })

      // Scroll to citation section
      setTimeout(() => {
        document.getElementById('citation-section')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('Citation generation error:', error)
    }
  }

  // Create ACH from Content Intelligence
  const handleCreateACH = async (analysisData: ContentAnalysis) => {
    try {
      setProcessing(true)
      setStatus('analyzing_words')
      setCurrentStep('Creating ACH analysis...')

      const response = await fetch('/api/ach/from-content-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analysisData.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create ACH')
      }

      const data = await response.json()

      toast({
        title: 'ACH Analysis Created',
        description: `Created with ${data.hypotheses_count} hypotheses and linked evidence`
      })

      // Navigate to ACH analysis
      navigate(`/dashboard/analysis-frameworks/ach/${data.ach_id}`)
    } catch (error) {
      console.error('ACH creation error:', error)
      toast({
        title: 'Failed to Create ACH',
        description: 'Could not create ACH analysis from this content',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
      setStatus('complete')
      setCurrentStep('')
    }
  }

  // Old handlers remain (for backward compatibility)
  const handleCitationOld = () => {
    if (!analysis) return
    try {
      handleCreateCitation(analysis)
    } catch (error) {
      console.error('Citation creation error:', error)
      toast({
        title: 'Error',
        description: 'Failed to create citation',
        variant: 'destructive'
      })
    }
  }

  // Save citation to library
  const saveCitationToLibrary = () => {
    if (!currentCitationData) return

    try {
      const savedCitation = {
        id: generateCitationId(),
        citation: currentCitationData.citation,
        inTextCitation: currentCitationData.inTextCitation,
        citationStyle: 'apa' as const,
        sourceType: currentCitationData.citationData.sourceType,
        fields: currentCitationData.citationData.fields,
        addedAt: new Date().toISOString(),
        tags: ['content-intelligence']
      }

      addCitation(savedCitation)
      setCitationSaved(true)

      toast({
        title: 'Citation Saved!',
        description: 'Added to your citation library. Open Citation Generator to view all saved citations.'
      })
    } catch (error) {
      console.error('Citation save error:', error)
      toast({
        title: 'Error',
        description: 'Failed to save citation',
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
      // Use hash-based authentication
      const userHash = localStorage.getItem('omnicore_user_hash')

      if (!userHash) {
        // Prompt user to login and return to this page
        const shouldLogin = window.confirm(
          'You need to be logged in to save entities.\n\nWould you like to login or create an account now?'
        )

        if (shouldLogin) {
          // Save current URL to return after login
          localStorage.setItem('redirect_after_login', window.location.pathname + window.location.search)
          navigate('/login')
        }
        return
      }

      // Check if entity already exists for this user
      const actorType = entityType === 'person' ? 'PERSON' :
                        entityType === 'organization' ? 'ORGANIZATION' : 'OTHER'

      const checkResponse = await fetch(
        `/api/actors/search?workspace_id=1&name=${encodeURIComponent(entityName)}&type=${actorType}`,
        {
          headers: { 'Authorization': `Bearer ${userHash}` }
        }
      )

      if (!checkResponse.ok) {
        console.warn(`Duplicate check failed for ${entityName}: ${checkResponse.status}`)
        // Continue with save if duplicate check fails
      } else {
        const contentType = checkResponse.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`Non-JSON response from duplicate check for ${entityName}`)
          // Continue with save if response is not JSON
        } else {
          const checkData = await checkResponse.json()

          if (checkData.exists) {
        // Entity exists - show alert with options
        const choice = window.confirm(
          `"${entityName}" already exists in your entities.\n\n` +
          `Click OK to view the existing entity, or Cancel to update the name and save as a new entity.`
        )

        if (choice) {
          // Navigate to existing entity
          navigate(`/dashboard/entities/actors/${checkData.actor.id}`)
          return
        } else {
          // Prompt for new name
          const newName = window.prompt(
            `Enter a different name for this entity:`,
            entityName + ' (2)'
          )

          if (!newName || newName.trim() === '') {
            // User cancelled
            return
          }

          // Use the new name
          entityName = newName.trim()
        }
      }
        }
      }

      const response = await fetch('/api/actors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userHash}`
        },
        body: JSON.stringify({
          name: entityName,
          type: actorType,
          workspace_id: '1', // Default workspace
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

        // Refresh duplicate check
        if (analysis?.entities) {
          await checkEntityDuplicates(analysis.entities)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to save ${entityName}`,
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

  // Check if entities already exist in Actors database
  const checkEntityDuplicates = async (entities: any) => {
    if (!entities) return

    setCheckingDuplicates(true)
    const userHash = localStorage.getItem('omnicore_user_hash')

    if (!userHash) {
      setCheckingDuplicates(false)
      return
    }

    const allEntities = [
      ...(entities.people || []).map((p: any) => ({ name: p.name, type: 'PERSON' as const })),
      ...(entities.organizations || []).map((o: any) => ({ name: o.name, type: 'ORGANIZATION' as const })),
      ...(entities.locations || []).map((l: any) => ({ name: l.name, type: 'LOCATION' as const }))
    ]

    const existingMap: Record<string, { id: string, name: string }> = {}

    for (const entity of allEntities) {
      try {
        const response = await fetch(
          `/api/actors/search?workspace_id=1&name=${encodeURIComponent(entity.name)}&type=${entity.type}`,
          {
            headers: {
              'Authorization': `Bearer ${userHash}`
            }
          }
        )

        if (response.ok) {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json()
            if (data.exists && data.actor) {
              existingMap[entity.name] = { id: data.actor.id, name: data.actor.name }
            }
          } else {
            console.warn(`Non-JSON response for ${entity.name}:`, await response.text())
          }
        } else {
          console.warn(`Failed to check duplicate for ${entity.name}: ${response.status}`)
        }
      } catch (error) {
        console.error(`Failed to check duplicate for ${entity.name}:`, error)
      }
    }

    setExistingActors(existingMap)
    setCheckingDuplicates(false)
  }

  // Start Starbursting analysis in the background
  const startStarburstingInBackground = async (analysisId: number) => {
    if (!analysisId) return

    console.log('[Starbursting] Starting background analysis for content ID:', analysisId)
    setStarburstingStatus('processing')
    setStarburstingError(null)

    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/content-intelligence/starbursting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          analysis_ids: [analysisId],
          use_ai_questions: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create Starbursting session')
      }

      const data = await response.json()

      // Parse the framework data if it's a string
      if (data.framework_data?.data && typeof data.framework_data.data === 'string') {
        try {
          data.framework_data.data = JSON.parse(data.framework_data.data)
        } catch (e) {
          console.error('[Starbursting] Failed to parse framework data:', e)
        }
      }

      setStarburstingSession(data)
      setStarburstingStatus('complete')
    } catch (error) {
      console.error('[Starbursting] Background processing error:', error)
      setStarburstingError(error instanceof Error ? error.message : 'Unknown error')
      setStarburstingStatus('error')
    }
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

  // Social Media Extraction
  const handleSocialExtract = async (extractMode: 'metadata' | 'download' | 'stream' | 'transcript' | 'full') => {
    if (!url) {
      toast({ title: 'Error', description: 'Please enter a URL', variant: 'destructive' })
      return
    }

    setSocialExtractLoading(true)
    setSocialMediaData(null)

    try {
      toast({
        title: `Extracting ${extractMode === 'full' ? 'complete data' : extractMode}...`,
        description: 'This may take a moment'
      })

      const response = await fetch('/api/content-intelligence/social-media-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          platform: analysis?.social_platform,
          mode: extractMode
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Social media extraction failed')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Extraction failed')
      }

      setSocialMediaData(data)

      toast({
        title: 'Extraction Complete!',
        description: `Successfully extracted ${data.platform} content`
      })

      // Scroll to results
      setTimeout(() => {
        document.getElementById('social-media-results')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)

    } catch (error) {
      console.error('Social media extraction error:', error)
      toast({
        title: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'Failed to extract social media content',
        variant: 'destructive'
      })
    } finally {
      setSocialExtractLoading(false)
    }
  }

  // Get platform features description
  const getPlatformFeatures = (platform: string): string => {
    const features: Record<string, string> = {
      youtube: 'Video downloads (multiple qualities), transcripts, engagement metrics, thumbnails',
      instagram: 'Post media (images/videos), captions, likes/comments, carousel support',
      tiktok: 'Video downloads, metadata extraction, engagement metrics',
      twitter: 'Tweet text, media URLs, embed codes, author information',
      facebook: 'Post data, media links, engagement metrics',
      reddit: 'Post content, comments, upvotes, media links'
    }
    return features[platform.toLowerCase()] || 'Basic metadata extraction'
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Content Research & Link Analysis
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

            <Button onClick={() => handleAnalyze()} disabled={processing} className="ml-auto" data-analyze-button>
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

      {/* Processing Status - Prominent placement */}
      {processing && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border-2 border-blue-400 dark:border-blue-600">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-100">
                  {currentStep}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  This may take 10-30 seconds depending on content size
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {progress}%
                </div>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </Card>
      )}

      {/* Country Origin Info - Auto-detected (only when not processing) */}
      {!processing && countryInfo && (
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

      {!processing && countryLoading && (
        <Card className="p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up domain country...
          </div>
        </Card>
      )}

      {/* Social Media Detection Card */}
      {url && analysis?.is_social_media && analysis.social_platform && (
        <Card className="p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-orange-950/30 border-2 border-purple-300">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-600 rounded-full shrink-0">
              <Video className="h-6 w-6 text-white" />
            </div>

            <div className="flex-1">
              <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-1">
                {analysis.social_platform.toUpperCase()} Content Detected
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Use specialized extraction tools for videos, images, transcripts, and more.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  onClick={() => handleSocialExtract('metadata')}
                  disabled={socialExtractLoading}
                  size="sm"
                  variant="default"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {socialExtractLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Info className="h-4 w-4 mr-2" />
                  )}
                  Quick Info
                </Button>

                <Button
                  onClick={() => handleSocialExtract('download')}
                  disabled={socialExtractLoading}
                  size="sm"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Media
                </Button>

                <Button
                  onClick={() => handleSocialExtract('stream')}
                  disabled={socialExtractLoading}
                  size="sm"
                  variant="outline"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Stream/Embed
                </Button>

                {analysis.social_platform === 'youtube' && (
                  <Button
                    onClick={() => handleSocialExtract('transcript')}
                    disabled={socialExtractLoading}
                    size="sm"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Get Transcript
                  </Button>
                )}

                <Button
                  onClick={() => handleSocialExtract('full')}
                  disabled={socialExtractLoading}
                  size="sm"
                  variant="outline"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Full Extract
                </Button>
              </div>

              {/* Platform Features Info */}
              <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Available:</strong> {getPlatformFeatures(analysis.social_platform)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Social Media Extraction Results */}
      {socialMediaData && (
        <Card id="social-media-results" className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-600" />
            {socialMediaData.platform.toUpperCase()} Extraction Results
          </h3>

          {/* Media Preview */}
          {socialMediaData.mediaUrls?.video && (
            <div className="mb-4">
              <video controls className="w-full max-h-96 rounded-lg bg-black">
                <source src={socialMediaData.mediaUrls.video} />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Images Grid */}
          {socialMediaData.mediaUrls?.images && socialMediaData.mediaUrls.images.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Media ({socialMediaData.mediaUrls.images.length} {socialMediaData.mediaUrls.images.length === 1 ? 'image' : 'images'})</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {socialMediaData.mediaUrls.images.map((imgUrl: string, idx: number) => {
                  // Use proxy for Twitter images to handle CORS
                  const proxiedUrl = socialMediaData.platform === 'twitter'
                    ? `/api/content-intelligence/twitter-image-proxy?url=${encodeURIComponent(imgUrl)}`
                    : imgUrl

                  return (
                    <a
                      key={idx}
                      href={imgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                      <img
                        src={proxiedUrl}
                        alt={`Media ${idx + 1}`}
                        className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Download Options */}
          {socialMediaData.downloadOptions && socialMediaData.downloadOptions.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Download Options</h4>
              <div className="grid md:grid-cols-2 gap-2">
                {socialMediaData.downloadOptions.map((option: any, idx: number) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(option.url, '_blank')}
                    className="justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {option.quality} ({option.format})
                    {option.size && ` - ${(option.size / 1024 / 1024).toFixed(1)}MB`}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Stream/Embed */}
          {socialMediaData.streamUrl && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Stream URL</h4>
              <div className="flex gap-2">
                <Input value={socialMediaData.streamUrl} readOnly />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(socialMediaData.streamUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Embed Code */}
          {socialMediaData.embedCode && (
            <div className="mb-4">
              <h4 className="font-semibold mb-2">Embed Code</h4>
              <Textarea
                value={socialMediaData.embedCode}
                readOnly
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Metadata */}
          {socialMediaData.metadata && (
            <div>
              <h4 className="font-semibold mb-2">Metadata</h4>

              {/* Twitter-specific: Show tweet text prominently if available */}
              {socialMediaData.platform === 'twitter' && socialMediaData.metadata.text && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-semibold text-blue-900 dark:text-blue-100">Tweet Text</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(socialMediaData.metadata.text)
                        toast({ title: 'Copied!', description: 'Tweet text copied to clipboard' })
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                    {socialMediaData.metadata.text}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-4 text-sm">
                {/* Twitter-specific fields */}
                {socialMediaData.metadata.authorName && (
                  <div>
                    <p className="text-muted-foreground">Author</p>
                    <p className="font-semibold">{socialMediaData.metadata.authorName}</p>
                    {socialMediaData.metadata.authorHandle && (
                      <p className="text-xs text-blue-600">{socialMediaData.metadata.authorHandle}</p>
                    )}
                  </div>
                )}
                {socialMediaData.metadata.tweetId && (
                  <div>
                    <p className="text-muted-foreground">Tweet ID</p>
                    <p className="font-mono text-xs">{socialMediaData.metadata.tweetId}</p>
                  </div>
                )}
                {socialMediaData.metadata.hasMedia !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Has Media</p>
                    <p className="font-semibold">
                      {socialMediaData.metadata.hasMedia ?
                        `Yes (${socialMediaData.metadata.mediaCount || 1} item${socialMediaData.metadata.mediaCount > 1 ? 's' : ''})` :
                        'No'}
                    </p>
                  </div>
                )}

                {/* Generic fields */}
                {socialMediaData.metadata.title && !socialMediaData.metadata.tweetId && (
                  <div>
                    <p className="text-muted-foreground">Title</p>
                    <p className="font-semibold">{socialMediaData.metadata.title}</p>
                  </div>
                )}
                {socialMediaData.metadata.author && !socialMediaData.metadata.authorName && (
                  <div>
                    <p className="text-muted-foreground">Author</p>
                    <p className="font-semibold">{socialMediaData.metadata.author}</p>
                  </div>
                )}
                {socialMediaData.metadata.viewCount !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Views</p>
                    <p className="font-semibold">{socialMediaData.metadata.viewCount.toLocaleString()}</p>
                  </div>
                )}
                {socialMediaData.metadata.likeCount !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Likes</p>
                    <p className="font-semibold">{socialMediaData.metadata.likeCount.toLocaleString()}</p>
                  </div>
                )}
                {socialMediaData.metadata.replyCount !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Replies</p>
                    <p className="font-semibold">{socialMediaData.metadata.replyCount.toLocaleString()}</p>
                  </div>
                )}
                {socialMediaData.metadata.repostCount !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Reposts</p>
                    <p className="font-semibold">{socialMediaData.metadata.repostCount.toLocaleString()}</p>
                  </div>
                )}
                {socialMediaData.metadata.commentCount !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Comments</p>
                    <p className="font-semibold">{socialMediaData.metadata.commentCount.toLocaleString()}</p>
                  </div>
                )}
                {socialMediaData.metadata.extractedVia && (
                  <div className="md:col-span-3">
                    <p className="text-muted-foreground text-xs">Extracted via</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{socialMediaData.metadata.extractedVia}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transcript */}
          {socialMediaData.transcript && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Transcript</h4>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {socialMediaData.transcript.split(' ').length} words
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(socialMediaData.transcript || '')
                      toast({ title: 'Copied!', description: 'Transcript copied to clipboard' })
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-96 overflow-y-auto border">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{socialMediaData.transcript}</p>
              </div>
            </div>
          )}

          {/* Full Content from Analysis */}
          {analysis?.extracted_text && (
            <div className="mt-4">
              <details className="group">
                <summary className="cursor-pointer font-semibold p-3 bg-blue-50 dark:bg-blue-950 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 flex items-center justify-between">
                  <span>📄 View Full Analyzed Content</span>
                  <Badge variant="outline" className="text-xs">
                    {analysis.word_count.toLocaleString()} words
                  </Badge>
                </summary>
                <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-96 overflow-y-auto border">
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(analysis.extracted_text)
                        toast({ title: 'Copied!', description: 'Full content copied to clipboard' })
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.extracted_text}</p>
                </div>
              </details>
            </div>
          )}
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
            <TabsTrigger value="sentiment">
              <SmileIcon className="h-4 w-4 mr-2" />
              Sentiment
            </TabsTrigger>
            <TabsTrigger value="entities">
              <Users className="h-4 w-4 mr-2" />
              Entities
            </TabsTrigger>
            <TabsTrigger value="qa">
              <MessageSquare className="h-4 w-4 mr-2" />
              Q&A
            </TabsTrigger>
            <TabsTrigger value="starbursting" className="relative">
              <Star className="h-4 w-4 mr-2" />
              Starbursting
              {starburstingStatus === 'processing' && (
                <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processing
                </Badge>
              )}
              {starburstingStatus === 'complete' && (
                <Badge variant="default" className="ml-2 bg-green-100 text-green-700">
                  <Check className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
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
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateCitation(analysis)}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Create Citation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateACH(analysis)}
                    disabled={processing}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Create ACH
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const citationData = extractCitationData(analysis, url)
                      const params = createCitationParams(citationData)
                      navigate(`/dashboard/tools/citations-generator?${params.toString()}`)
                    }}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Open in Generator
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={exportFullReport}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>

              {/* Text Content with Toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Content</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={textView === 'summary' ? 'default' : 'outline'}
                      onClick={() => setTextView('summary')}
                    >
                      Summary
                    </Button>
                    <Button
                      size="sm"
                      variant={textView === 'fulltext' ? 'default' : 'outline'}
                      onClick={() => setTextView('fulltext')}
                    >
                      Full Text
                    </Button>
                  </div>
                </div>

                {textView === 'summary' && analysis.summary && (
                  <div className="text-sm leading-relaxed">
                    {analysis.summary}
                  </div>
                )}

                {textView === 'fulltext' && analysis.extracted_text && (
                  <div className="max-h-[600px] overflow-y-auto">
                    <div className="text-sm leading-relaxed whitespace-pre-line bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      {formatFullText(analysis.extracted_text)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {analysis.extracted_text.length.toLocaleString()} characters • {analysis.word_count.toLocaleString()} words
                    </p>
                  </div>
                )}

                {textView === 'fulltext' && !analysis.extracted_text && (
                  <div className="text-sm text-muted-foreground italic">
                    No full text available for this analysis.
                  </div>
                )}
              </div>

              {/* Citation Section */}
              {generatedCitation && (
                <div id="citation-section" className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Citation (APA)</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-sm font-serif">{generatedCitation}</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyCitation}
                    >
                      {showCitationCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={saveCitationToLibrary}
                      disabled={citationSaved}
                    >
                      {citationSaved ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save to Library
                        </>
                      )}
                    </Button>
                  </div>
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

          <TabsContent value="word-analysis" className="mt-4 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Words</p>
                <p className="text-2xl font-bold">{analysis.word_count.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Unique Words</p>
                <p className="text-2xl font-bold">{Object.keys(analysis.word_frequency || {}).length.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Top Phrases</p>
                <p className="text-2xl font-bold">{analysis.top_phrases?.length || 0}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Avg. Word Length</p>
                <p className="text-2xl font-bold">
                  {analysis.word_frequency ?
                    Math.round(Object.keys(analysis.word_frequency).reduce((sum, word) => sum + word.length, 0) / Object.keys(analysis.word_frequency).length)
                    : 0}
                </p>
              </Card>
            </div>

            {/* Word Cloud */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-semibold">Word Cloud</h3>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={wordCloudView === 'words' ? 'default' : 'outline'}
                      onClick={() => setWordCloudView('words')}
                    >
                      Words
                    </Button>
                    <Button
                      size="sm"
                      variant={wordCloudView === 'phrases' ? 'default' : 'outline'}
                      onClick={() => setWordCloudView('phrases')}
                    >
                      Phrases
                    </Button>
                    <Button
                      size="sm"
                      variant={wordCloudView === 'entities' ? 'default' : 'outline'}
                      onClick={() => setWordCloudView('entities')}
                    >
                      Entities
                    </Button>
                  </div>

                  {/* Export Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Image className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Export Word Cloud</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => exportWordCloud('png', false)}>
                        PNG (Image only)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportWordCloud('png', true)}>
                        PNG (With title & URL)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => exportWordCloud('jpeg', false)}>
                        JPEG (Image only)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportWordCloud('jpeg', true)}>
                        JPEG (With title & URL)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-8 min-h-[300px] flex flex-wrap items-center justify-center gap-4" id="word-cloud-container">
                {wordCloudView === 'words' && (() => {
                  const singleWords = Object.entries(analysis.word_frequency || {})
                    .filter(([word]) => !word.includes(' ')) // Only single words
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)

                  if (singleWords.length === 0) {
                    return <p className="text-muted-foreground italic">No single words found in analysis</p>
                  }

                  const maxCount = Math.max(...singleWords.map(([, c]) => c))

                  return singleWords.map(([word, count], index) => {
                    const minSize = 20
                    const maxSize = 56
                    const fontSize = minSize + ((count / maxCount) * (maxSize - minSize))

                    const colors = [
                      'text-blue-600 dark:text-blue-400',
                      'text-purple-600 dark:text-purple-400',
                      'text-green-600 dark:text-green-400',
                      'text-orange-600 dark:text-orange-400',
                      'text-pink-600 dark:text-pink-400',
                      'text-indigo-600 dark:text-indigo-400'
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <span
                        key={word}
                        className={`font-bold ${colorClass} hover:scale-110 transition-transform cursor-default select-none`}
                        style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                        title={`${word}: ${count} times`}
                      >
                        {word}
                      </span>
                    )
                  })
                })()}

                {wordCloudView === 'phrases' && analysis.top_phrases
                  .slice(0, 10)
                  .map((item, index) => {
                    const maxCount = Math.max(...analysis.top_phrases.map(p => p.count))
                    const minSize = 16
                    const maxSize = 48
                    const fontSize = minSize + ((item.count / maxCount) * (maxSize - minSize))

                    const colors = [
                      'text-blue-600 dark:text-blue-400',
                      'text-purple-600 dark:text-purple-400',
                      'text-green-600 dark:text-green-400',
                      'text-orange-600 dark:text-orange-400',
                      'text-pink-600 dark:text-pink-400',
                      'text-indigo-600 dark:text-indigo-400'
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <span
                        key={index}
                        className={`font-bold ${colorClass} hover:scale-110 transition-transform cursor-default select-none text-center`}
                        style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                        title={`${item.phrase}: ${item.count} times`}
                      >
                        {item.phrase}
                      </span>
                    )
                  })}

                {wordCloudView === 'entities' && (() => {
                  // Combine all entities with their types
                  const allEntities = [
                    ...(analysis.entities?.people || []).map(e => ({ ...e, type: 'person' })),
                    ...(analysis.entities?.organizations || []).map(e => ({ ...e, type: 'organization' })),
                    ...(analysis.entities?.locations || []).map(e => ({ ...e, type: 'location' }))
                  ]
                  // Sort by count and take top 10
                  const topEntities = allEntities.sort((a, b) => b.count - a.count).slice(0, 10)
                  const maxCount = Math.max(...topEntities.map(e => e.count), 1)

                  return topEntities.map((entity) => {
                    const minSize = 18
                    const maxSize = 52
                    const fontSize = minSize + ((entity.count / maxCount) * (maxSize - minSize))

                    const colorClass = entity.type === 'person'
                      ? 'text-blue-600 dark:text-blue-400'
                      : entity.type === 'organization'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-orange-600 dark:text-orange-400'

                    const typeLabel = entity.type === 'person'
                      ? 'Person'
                      : entity.type === 'organization'
                      ? 'Organization'
                      : 'Location'

                    return (
                      <span
                        key={`${entity.type}-${entity.name}`}
                        className={`font-bold ${colorClass} hover:scale-110 transition-transform cursor-default select-none`}
                        style={{ fontSize: `${fontSize}px`, lineHeight: 1.3 }}
                        title={`${entity.name} (${typeLabel}): ${entity.count} mentions`}
                      >
                        {entity.name}
                      </span>
                    )
                  })
                })()}
              </div>

              {/* Legend and description */}
              {wordCloudView === 'entities' ? (
                <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                    <span className="text-muted-foreground">People</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-600 dark:bg-green-400"></div>
                    <span className="text-muted-foreground">Organizations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-orange-600 dark:bg-orange-400"></div>
                    <span className="text-muted-foreground">Locations</span>
                  </div>
                </div>
              ) : wordCloudView === 'phrases' ? (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-center flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                      <span className="text-muted-foreground">Rank 1-2</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-purple-600 dark:bg-purple-400"></div>
                      <span className="text-muted-foreground">Rank 3-4</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-green-600 dark:bg-green-400"></div>
                      <span className="text-muted-foreground">Rank 5-6</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-orange-600 dark:bg-orange-400"></div>
                      <span className="text-muted-foreground">Rank 7-8</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-pink-600 dark:bg-pink-400"></div>
                      <span className="text-muted-foreground">Rank 9-10</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Top 10 most common phrases (size = frequency)
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Top 10 most frequent single words (size = frequency)
                </p>
              )}
            </Card>

            {/* Top Phrases */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Top Phrases (2-10 words)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {analysis.top_phrases.slice(0, 20).map((item, index) => (
                  <div key={index} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-bold text-muted-foreground/50 min-w-[32px]">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-sm font-medium break-words">{item.phrase}</span>
                          <span className="text-sm font-bold text-primary shrink-0">{item.count}×</span>
                        </div>
                        <div className="space-y-1">
                          <Progress value={(item.count / analysis.top_phrases[0].count) * 100} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">
                            {item.count} {item.count === 1 ? 'occurrence' : 'occurrences'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {analysis.top_phrases.length > 20 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing top 20 of {analysis.top_phrases.length} phrases
                </p>
              )}
            </Card>

            {/* Keyphrases (TextRank) */}
            {analysis.keyphrases && analysis.keyphrases.length > 0 && (
              <Card className="p-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>Key Concepts & Terminology</CardTitle>
                    <Badge variant="secondary">{analysis.keyphrases.length} keyphrases</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Important concepts extracted using TextRank-style analysis (centrality, domain relevance, importance)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-3">
                    {analysis.keyphrases
                      .sort((a, b) => b.score - a.score)
                      .map((kp, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{kp.phrase}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  kp.category === 'technology' ? 'border-blue-300 text-blue-700' :
                                  kp.category === 'concept' ? 'border-purple-300 text-purple-700' :
                                  kp.category === 'event' ? 'border-orange-300 text-orange-700' :
                                  kp.category === 'location' ? 'border-green-300 text-green-700' :
                                  'border-gray-300 text-gray-700'
                                }`}
                              >
                                {kp.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={kp.score * 100}
                                className="h-1.5 flex-1"
                              />
                              <span className="text-xs text-muted-foreground shrink-0">
                                {(kp.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Relevance: {kp.relevance}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Topic Modeling (LDA) */}
            {analysis.topics && analysis.topics.length > 0 && (
              <Card className="p-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>Topic Analysis (LDA)</CardTitle>
                    <Badge variant="secondary">{analysis.topics.length} topics</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Main themes identified using Latent Dirichlet Allocation (coherence, coverage, keywords)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.topics
                    .sort((a, b) => b.coverage - a.coverage)
                    .map((topic, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg border bg-gradient-to-r from-card to-accent/20"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-base">{topic.name}</span>
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                Topic {i + 1}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{topic.description}</p>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">Coherence</span>
                              <span className="text-xs font-semibold">{(topic.coherence * 100).toFixed(0)}%</span>
                            </div>
                            <Progress value={topic.coherence * 100} className="h-2" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">Coverage</span>
                              <span className="text-xs font-semibold">{(topic.coverage * 100).toFixed(0)}%</span>
                            </div>
                            <Progress value={topic.coverage * 100} className="h-2 bg-green-100" />
                          </div>
                        </div>

                        <div>
                          <span className="text-xs font-medium text-muted-foreground block mb-2">Keywords:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {topic.keywords.map((keyword, ki) => (
                              <Badge
                                key={ki}
                                variant="secondary"
                                className="text-xs bg-primary/5 hover:bg-primary/10"
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sentiment" className="mt-4">
            {analysis.sentiment_analysis ? (
              <div className="space-y-6">
                {/* Overall Sentiment Card */}
                <Card className="p-6">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      {analysis.sentiment_analysis.overall === 'positive' && <SmileIcon className="h-6 w-6 text-green-600" />}
                      {analysis.sentiment_analysis.overall === 'negative' && <FrownIcon className="h-6 w-6 text-red-600" />}
                      {(analysis.sentiment_analysis.overall === 'neutral' || analysis.sentiment_analysis.overall === 'mixed') && <MehIcon className="h-6 w-6 text-yellow-600" />}
                      Overall Sentiment: {analysis.sentiment_analysis.overall.charAt(0).toUpperCase() + analysis.sentiment_analysis.overall.slice(1)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Sentiment Score</span>
                        <span className="font-semibold">{analysis.sentiment_analysis.score.toFixed(2)}</span>
                      </div>
                      <Progress
                        value={(analysis.sentiment_analysis.score + 1) * 50}
                        className={`h-3 ${
                          analysis.sentiment_analysis.score > 0.3 ? 'bg-green-200' :
                          analysis.sentiment_analysis.score < -0.3 ? 'bg-red-200' :
                          'bg-yellow-200'
                        }`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Very Negative (-1.0)</span>
                        <span>Neutral (0)</span>
                        <span>Very Positive (+1.0)</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Confidence</span>
                        <span className="font-semibold">{(analysis.sentiment_analysis.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={analysis.sentiment_analysis.confidence * 100} className="h-2 mt-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* Emotion Breakdown Card */}
                {analysis.sentiment_analysis.emotions && (
                  <Card className="p-6">
                    <CardHeader className="pb-4">
                      <CardTitle>Emotion Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(analysis.sentiment_analysis.emotions).map(([emotion, value]) => (
                        <div key={emotion}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm capitalize">{emotion}</span>
                            <span className="text-sm font-semibold">{value}%</span>
                          </div>
                          <Progress
                            value={value as number}
                            className={`h-2 ${
                              emotion === 'joy' ? 'bg-green-200' :
                              emotion === 'anger' ? 'bg-red-200' :
                              emotion === 'fear' ? 'bg-purple-200' :
                              emotion === 'sadness' ? 'bg-blue-200' :
                              'bg-orange-200'
                            }`}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Key Insights */}
                {analysis.sentiment_analysis.keyInsights && analysis.sentiment_analysis.keyInsights.length > 0 && (
                  <Card className="p-6">
                    <CardHeader className="pb-4">
                      <CardTitle>Key Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.sentiment_analysis.keyInsights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Info className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                            <span className="text-sm">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Controversial Claims */}
                {analysis.sentiment_analysis.controversialClaims && analysis.sentiment_analysis.controversialClaims.length > 0 && (
                  <Card className="p-6 border-red-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        Controversial Claims Detected
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis.sentiment_analysis.controversialClaims.map((claim, i) => (
                        <div key={i} className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <p className="text-sm font-semibold mb-2 text-red-900">{claim.text}</p>
                          <div className="flex gap-4 text-xs text-red-700">
                            <span>Sentiment: {claim.sentiment}</span>
                            <span>•</span>
                            <span>{claim.reason}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="p-6">
                <p className="text-center text-muted-foreground">
                  Sentiment analysis not available for this content
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="entities" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Extracted Entities</h3>
              <Button onClick={saveAllEntities} variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save All to Evidence
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* People */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>👥</span>
                  <span>People ({analysis.entities?.people?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
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
                        title="Save to Actors"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!analysis.entities?.people || analysis.entities.people.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Organizations */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>🏢</span>
                  <span>Organizations ({analysis.entities?.organizations?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
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
                        title="Save to Actors"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!analysis.entities?.organizations || analysis.entities.organizations.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Locations */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>📍</span>
                  <span>Locations ({analysis.entities?.locations?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
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
                        title="Save to Places"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!analysis.entities?.locations || analysis.entities.locations.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Dates */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Dates ({analysis.entities?.dates?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(analysis.entities?.dates || []).slice(0, 10).map((date, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{date.name}</span>
                      <span className="text-muted-foreground ml-2">({date.count}×)</span>
                    </div>
                  ))}
                  {(!analysis.entities?.dates || analysis.entities.dates.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Money */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>💰</span>
                  <span>Money ({analysis.entities?.money?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(analysis.entities?.money || []).slice(0, 10).map((money, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{money.name}</span>
                      <span className="text-muted-foreground ml-2">({money.count}×)</span>
                    </div>
                  ))}
                  {(!analysis.entities?.money || analysis.entities.money.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Events */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  <span>Events ({analysis.entities?.events?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(analysis.entities?.events || []).slice(0, 10).map((event, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{event.name}</span>
                      <span className="text-muted-foreground ml-2">({event.count}×)</span>
                    </div>
                  ))}
                  {(!analysis.entities?.events || analysis.entities.events.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Products */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>📦</span>
                  <span>Products ({analysis.entities?.products?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(analysis.entities?.products || []).slice(0, 10).map((product, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground ml-2">({product.count}×)</span>
                    </div>
                  ))}
                  {(!analysis.entities?.products || analysis.entities.products.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
                  )}
                </div>
              </Card>

              {/* Percentages */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>📊</span>
                  <span>Percentages ({analysis.entities?.percentages?.length || 0})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(analysis.entities?.percentages || []).slice(0, 10).map((pct, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{pct.name}</span>
                      <span className="text-muted-foreground ml-2">({pct.count}×)</span>
                    </div>
                  ))}
                  {(!analysis.entities?.percentages || analysis.entities.percentages.length === 0) && (
                    <p className="text-sm text-muted-foreground">None found</p>
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

              {/* Processing State */}
              {starburstingStatus === 'processing' && (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-lg font-medium">Generating Starbursting Questions...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This may take a moment. We're creating deep-dive 5W1H questions from your content.
                  </p>
                </div>
              )}

              {/* Complete State */}
              {starburstingStatus === 'complete' && starburstingSession && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-900 dark:text-green-100">
                          Starbursting Session Created!
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {starburstingSession.central_topic}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          {starburstingSession.sources_count} source{starburstingSession.sources_count !== 1 ? 's' : ''} analyzed
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Full Q&A Preview */}
                  {starburstingSession.framework_data?.data && (
                    <div className="space-y-4">
                      {/* New format with who/what/when categories */}
                      {starburstingSession.framework_data.data.who && (
                        <>
                          {['who', 'what', 'when', 'where', 'why', 'how'].map(category => {
                            const questions = starburstingSession.framework_data.data[category] || []
                            if (questions.length === 0) return null

                            const categoryColors: Record<string, { bg: string; badge: string }> = {
                              who: { bg: 'bg-purple-50 dark:bg-purple-900/20', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
                              what: { bg: 'bg-blue-50 dark:bg-blue-900/20', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
                              when: { bg: 'bg-green-50 dark:bg-green-900/20', badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
                              where: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
                              why: { bg: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
                              how: { bg: 'bg-pink-50 dark:bg-pink-900/20', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' }
                            }

                            const colors = categoryColors[category] || categoryColors.who

                            return (
                              <Card key={category} className={`${colors.bg} border-none`}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="flex items-center gap-2 text-lg">
                                    <Badge variant="secondary" className={colors.badge}>{category.toUpperCase()}</Badge>
                                    <span className="text-sm text-muted-foreground">
                                      {questions.filter((q: any) => q.answer && q.answer.trim() !== '').length} answered / {questions.length} total
                                    </span>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <ul className="space-y-3">
                                    {questions.map((item: any, index: number) => (
                                      <li key={item.id || index} className="space-y-1">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">
                                          <span className="text-gray-600 dark:text-gray-400">{index + 1}.</span> Q: {item.question}
                                        </div>
                                        <div className="text-gray-700 dark:text-gray-300 ml-5">
                                          A: {item.answer && item.answer.trim() !== '' ? (
                                            item.answer
                                          ) : (
                                            <span className="italic text-gray-500 dark:text-gray-400">No answer provided</span>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </>
                      )}

                      {/* Fallback format with flat questions array */}
                      {starburstingSession.framework_data.data.questions && !starburstingSession.framework_data.data.who && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Generated Questions</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-3">
                              {starburstingSession.framework_data.data.questions.map((item: any, index: number) => (
                                <li key={item.id || index} className="space-y-1">
                                  <div className="flex items-start gap-2">
                                    {item.category && (
                                      <Badge variant="outline" className="mt-0.5">{item.category.toUpperCase()}</Badge>
                                    )}
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900 dark:text-gray-100">
                                        <span className="text-gray-600 dark:text-gray-400">{index + 1}.</span> Q: {item.question}
                                      </div>
                                      <div className="text-gray-700 dark:text-gray-300 ml-5">
                                        A: {item.answer && item.answer.trim() !== '' ? (
                                          item.answer
                                        ) : (
                                          <span className="italic text-gray-500 dark:text-gray-400">No answer provided</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    onClick={() => navigate(`/dashboard/analysis-frameworks/starbursting/${starburstingSession.session_id}/view`)}
                    className="w-full"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Open Starbursting Analysis
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* Error State */}
              {starburstingStatus === 'error' && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-100">
                        Failed to Create Starbursting Session
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {starburstingError}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => analysis?.id && startStarburstingInBackground(analysis.id)}
                        className="mt-3"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle State */}
              {starburstingStatus === 'idle' && !analysis && (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Analyze content first to generate Starbursting questions</p>
                </div>
              )}
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
                        onClick={async () => {
                          setUrl(link.url)
                          if (link.note) setSaveNote(link.note)
                          if (link.tags?.length) setSaveTags(link.tags.join(', '))

                          // If already processed, load existing analysis
                          if (link.is_processed && link.analysis_id) {
                            try {
                              setProcessing(true)
                              const response = await fetch(`/api/content-intelligence/analyze-url`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  url: link.url,
                                  load_existing: true,
                                  analysis_id: link.analysis_id
                                })
                              })

                              if (response.ok) {
                                const data = await response.json()
                                setAnalysis(data.analysis)
                                setActiveTab('overview')
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                                toast({ title: 'Success', description: 'Loaded existing analysis' })
                              } else {
                                throw new Error('Failed to load analysis')
                              }
                            } catch (error) {
                              console.error('Load analysis error:', error)
                              toast({
                                title: 'Error',
                                description: 'Failed to load analysis. Click Analyze to create new one.',
                                variant: 'destructive'
                              })
                            } finally {
                              setProcessing(false)
                            }
                          } else {
                            // Not processed yet - trigger analysis automatically
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                            // Pass the URL directly to avoid state update timing issues
                            handleAnalyze(link.url)
                          }
                        }}
                      >
                        {link.is_processed ? 'Load Analysis' : 'Analyze Now'}
                      </Button>
                      {link.is_processed && link.analysis_id && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                // Launch Starbursting analysis with this content
                                toast({ title: 'Creating Starbursting session...', variant: 'default' })

                                const response = await fetch('/api/content-intelligence/starbursting', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    analysis_ids: [link.analysis_id],
                                    title: link.title || 'Content Analysis'
                                  })
                                })

                                if (!response.ok) {
                                  throw new Error('Failed to create Starbursting session')
                                }

                                const data = await response.json()

                                toast({ title: 'Success', description: 'Launching Starbursting analysis...' })

                                // Navigate to Starbursting page with the session
                                navigate(`/dashboard/analysis-frameworks/starbursting/${data.session_id}/view`)
                              } catch (error) {
                                console.error('Starbursting launch error:', error)
                                toast({
                                  title: 'Error',
                                  description: 'Failed to launch Starbursting analysis',
                                  variant: 'destructive'
                                })
                              }
                            }}
                            title="Launch Starbursting deep-dive analysis"
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Starbursting
                          </Button>
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
                                    '12ft': ''
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
                        </>
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
