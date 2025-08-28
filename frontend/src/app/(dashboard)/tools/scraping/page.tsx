'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Download, Settings, Play, Pause, Eye, Code, FileText, ExternalLink, Image, Link as LinkIcon } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface ScrapingJob {
  job_id: number
  status: string
  progress_percentage: number
  current_step?: string
  started_at?: string
  estimated_completion?: string
  message: string
  name?: string
  urls?: string[]
  results?: ScrapingResult[]
}

interface ScrapingResult {
  url: string
  title?: string
  content: string
  content_length?: number
  images?: string[]
  links?: Array<{ url: string; text: string }>
  metadata?: Record<string, any>
  status_code?: number
  headers?: Record<string, any>
  error?: string
}

interface ScrapingRequest {
  url: string
  extract_images: boolean
  extract_links: boolean
  follow_redirects: boolean
  max_depth: number
  delay_seconds: number
  user_agent?: string
}

interface BatchScrapingRequest {
  urls: string[]
  extract_images: boolean
  extract_links: boolean
  follow_redirects: boolean
  delay_seconds: number
}

export default function WebScrapingTool() {
  const [activeTab, setActiveTab] = useState('create')
  const [jobs, setJobs] = useState<ScrapingJob[]>([])
  const [loading, setLoading] = useState(false)
  const [pollingJobId, setPollingJobId] = useState<number | null>(null)
  const { toast } = useToast()
  
  // Form state
  const [jobName, setJobName] = useState('')
  const [urls, setUrls] = useState<string[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [extractImages, setExtractImages] = useState(true)
  const [extractLinks, setExtractLinks] = useState(true)
  const [followRedirects, setFollowRedirects] = useState(true)
  const [maxDepth, setMaxDepth] = useState(1)
  const [delaySeconds, setDelaySeconds] = useState(1.0)
  const [userAgent, setUserAgent] = useState('')

  // Load jobs on component mount
  useEffect(() => {
    loadJobs()
  }, [])

  // Poll job status for running jobs
  useEffect(() => {
    if (pollingJobId) {
      const interval = setInterval(async () => {
        try {
          const response = await apiClient.get<ScrapingJob>(`/tools/scraping/jobs/${pollingJobId}/status`)
          const updatedJob = response
          
          setJobs(prev => prev.map(job => 
            job.job_id === pollingJobId ? updatedJob : job
          ))

          // Stop polling if job is completed or failed
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            setPollingJobId(null)
            if (updatedJob.status === 'completed') {
              loadJobResults(pollingJobId)
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error)
          setPollingJobId(null)
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [pollingJobId])

  const loadJobs = async () => {
    try {
      const response = await apiClient.get<ScrapingJob[]>('/tools/scraping/jobs')
      setJobs(response)
    } catch (error) {
      console.error('Error loading jobs:', error)
      toast({
        title: 'Error',
        description: 'Failed to load scraping jobs',
        variant: 'destructive'
      })
    }
  }

  const loadJobResults = async (jobId: number) => {
    try {
      const response = await apiClient.get(`/tools/scraping/jobs/${jobId}/results`)
      setJobs(prev => prev.map(job => 
        job.job_id === jobId ? { ...job, results: response.results } : job
      ))
    } catch (error) {
      console.error('Error loading job results:', error)
    }
  }

  const handleAddUrl = () => {
    if (urlInput.trim() && !urls.includes(urlInput.trim())) {
      setUrls(prev => [...prev, urlInput.trim()])
      setUrlInput('')
    }
  }

  const removeUrl = (urlToRemove: string) => {
    setUrls(prev => prev.filter(url => url !== urlToRemove))
  }

  const handleStartJob = async () => {
    if (!jobName.trim() || urls.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a job name and at least one URL',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      let response: ScrapingJob

      if (urls.length === 1) {
        // Single URL scraping
        const request: ScrapingRequest = {
          url: urls[0],
          extract_images: extractImages,
          extract_links: extractLinks,
          follow_redirects: followRedirects,
          max_depth: maxDepth,
          delay_seconds: delaySeconds,
          user_agent: userAgent || undefined
        }
        
        response = await apiClient.post<ScrapingJob>('/tools/scraping/scrape', request)
      } else {
        // Batch URL scraping
        const request: BatchScrapingRequest = {
          urls: urls,
          extract_images: extractImages,
          extract_links: extractLinks,
          follow_redirects: followRedirects,
          delay_seconds: delaySeconds
        }
        
        response = await apiClient.post<ScrapingJob>('/tools/scraping/scrape/batch', request)
      }

      // Add job name and urls for display
      const newJob = { 
        ...response, 
        name: jobName,
        urls: urls
      }
      
      setJobs(prev => [newJob, ...prev])
      setPollingJobId(response.job_id)
      setActiveTab('jobs')

      // Reset form
      setJobName('')
      setUrls([])
      setUrlInput('')
      setExtractImages(true)
      setExtractLinks(true)
      setFollowRedirects(true)
      setMaxDepth(1)
      setDelaySeconds(1.0)
      setUserAgent('')

      toast({
        title: 'Success',
        description: 'Scraping job started successfully',
      })

    } catch (error: any) {
      console.error('Error starting scraping job:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to start scraping job',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const exportResults = (job: ScrapingJob) => {
    if (!job.results) {
      toast({
        title: 'No Results',
        description: 'This job has no results to export',
        variant: 'destructive'
      })
      return
    }

    const data = JSON.stringify(job.results, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scraping-results-${job.name || job.job_id}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Success',
      description: 'Results exported successfully',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'Running'
      case 'pending':
        return 'Pending'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Web Scraping Tool</h1>
        <p className="mt-2 text-gray-600">
          Extract data from websites with customizable scraping jobs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Create Job</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Create Scraping Job
              </CardTitle>
              <CardDescription>
                Set up a new web scraping job with custom settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jobName">Job Name</Label>
                <Input
                  id="jobName"
                  placeholder="Enter job name"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Target URLs</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
                  />
                  <Button onClick={handleAddUrl} disabled={!urlInput.trim()}>
                    Add URL
                  </Button>
                </div>
                {urls.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {urls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm truncate">{url}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUrl(url)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delay (seconds)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(parseFloat(e.target.value) || 1.0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Depth</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Extraction Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Follow Redirects</span>
                    <Switch
                      checked={followRedirects}
                      onCheckedChange={setFollowRedirects}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Extract Images</span>
                    <Switch
                      checked={extractImages}
                      onCheckedChange={setExtractImages}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Extract Links</span>
                    <Switch
                      checked={extractLinks}
                      onCheckedChange={setExtractLinks}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>User Agent (optional)</Label>
                <Input
                  placeholder="Research Tools Web Scraper 1.0"
                  value={userAgent}
                  onChange={(e) => setUserAgent(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleStartJob}
                disabled={!jobName.trim() || urls.length === 0 || loading}
                className="w-full"
              >
                {loading ? 'Starting...' : 'Start Scraping Job'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No scraping jobs yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create a scraping job to see results here
                </p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.job_id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{job.name || `Job ${job.job_id}`}</CardTitle>
                      <CardDescription>
                        {job.urls?.length || 0} URLs • {job.message}
                        {job.started_at && ` • Started ${new Date(job.started_at).toLocaleString()}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusLabel(job.status)}
                      </Badge>
                      {job.status === 'completed' && job.results && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportResults(job)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.current_step && (
                    <div className="text-sm text-gray-600">
                      <strong>Current step:</strong> {job.current_step}
                    </div>
                  )}

                  {(job.status === 'in_progress' || job.status === 'pending') && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{job.progress_percentage}%</span>
                      </div>
                      <Progress value={job.progress_percentage} />
                    </div>
                  )}

                  {job.results && job.results.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Scraped Content</Label>
                      <div className="text-sm text-gray-600">
                        Successfully scraped {job.results.length} pages
                      </div>
                      <div className="max-h-80 overflow-y-auto space-y-3">
                        {job.results.map((result, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{result.title || 'Untitled'}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {result.url}
                                  </a>
                                </div>
                              </div>
                              {result.status_code && (
                                <Badge variant="outline" className="text-xs">
                                  {result.status_code}
                                </Badge>
                              )}
                            </div>
                            
                            {result.content && (
                              <div className="text-xs">
                                <div className="text-gray-600 mb-1">Content preview:</div>
                                <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 max-h-20 overflow-y-auto">
                                  {result.content.substring(0, 200)}
                                  {result.content.length > 200 && '...'}
                                </div>
                                {result.content_length && (
                                  <div className="text-gray-500 mt-1">
                                    {result.content_length.toLocaleString()} characters
                                  </div>
                                )}
                              </div>
                            )}

                            {result.images && result.images.length > 0 && (
                              <div className="text-xs">
                                <div className="flex items-center gap-1 text-gray-600 mb-1">
                                  <Image className="h-3 w-3" />
                                  {result.images.length} images found
                                </div>
                              </div>
                            )}

                            {result.links && result.links.length > 0 && (
                              <div className="text-xs">
                                <div className="flex items-center gap-1 text-gray-600 mb-1">
                                  <LinkIcon className="h-3 w-3" />
                                  {result.links.length} links found
                                </div>
                              </div>
                            )}

                            {result.error && (
                              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                Error: {result.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Scraping Information
              </CardTitle>
              <CardDescription>
                Learn about web scraping capabilities and limitations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <strong>Scraping Features:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• Extract text content, images, and links</li>
                      <li>• Follow HTTP redirects automatically</li>
                      <li>• Configurable delays to respect server limits</li>
                      <li>• Support for single URL and batch processing</li>
                      <li>• Real-time progress tracking</li>
                      <li>• Content metadata extraction</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Alert>
                  <AlertDescription>
                    <strong>Limitations:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• Maximum 50 URLs per batch job</li>
                      <li>• Maximum depth of 5 levels for recursive scraping</li>
                      <li>• Delay between requests: 0.5-10 seconds</li>
                      <li>• Content limited to 10,000 characters per page</li>
                      <li>• No JavaScript execution (static content only)</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm">
                    <strong className="text-blue-800">Best Practices:</strong>
                    <ul className="mt-2 space-y-1 text-blue-700">
                      <li>• Always respect website robots.txt files</li>
                      <li>• Use appropriate delays to avoid overloading servers</li>
                      <li>• Check website terms of service before scraping</li>
                      <li>• Consider rate limiting for large-scale operations</li>
                      <li>• Monitor for changes in website structure</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}