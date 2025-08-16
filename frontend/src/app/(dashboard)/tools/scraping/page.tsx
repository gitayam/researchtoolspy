'use client'

import { useState } from 'react'
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
import { Download, Settings, Play, Pause, Eye, Code, FileText } from 'lucide-react'

interface ScrapingJob {
  id: string
  name: string
  urls: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startedAt?: string
  completedAt?: string
  results?: ScrapingResult[]
  settings: ScrapingSettings
}

interface ScrapingResult {
  url: string
  title?: string
  content: string
  images: string[]
  links: string[]
  metadata: Record<string, any>
  scrapedAt: string
}

interface ScrapingSettings {
  respectRobots: boolean
  delay: number
  maxPages: number
  extractText: boolean
  extractImages: boolean
  extractLinks: boolean
  customSelectors: string
}

export default function WebScrapingTool() {
  const [activeTab, setActiveTab] = useState('create')
  const [jobs, setJobs] = useState<ScrapingJob[]>([])
  const [currentJob, setCurrentJob] = useState<Partial<ScrapingJob>>({
    name: '',
    urls: [],
    settings: {
      respectRobots: true,
      delay: 1000,
      maxPages: 50,
      extractText: true,
      extractImages: true,
      extractLinks: true,
      customSelectors: ''
    }
  })
  const [urlInput, setUrlInput] = useState('')

  const handleAddUrl = () => {
    if (urlInput.trim() && !currentJob.urls?.includes(urlInput.trim())) {
      setCurrentJob(prev => ({
        ...prev,
        urls: [...(prev.urls || []), urlInput.trim()]
      }))
      setUrlInput('')
    }
  }

  const removeUrl = (urlToRemove: string) => {
    setCurrentJob(prev => ({
      ...prev,
      urls: prev.urls?.filter(url => url !== urlToRemove) || []
    }))
  }

  const handleStartJob = async () => {
    if (!currentJob.name || !currentJob.urls?.length) return

    const newJob: ScrapingJob = {
      id: Date.now().toString(),
      name: currentJob.name,
      urls: currentJob.urls,
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      settings: currentJob.settings!
    }

    setJobs(prev => [newJob, ...prev])
    setActiveTab('jobs')

    // Simulate job progress
    const jobIndex = 0
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 500))
      setJobs(prev => prev.map((job, index) => 
        index === jobIndex ? { ...job, progress } : job
      ))
    }

    // Complete job
    setJobs(prev => prev.map((job, index) => 
      index === jobIndex ? {
        ...job,
        status: 'completed',
        completedAt: new Date().toISOString(),
        results: currentJob.urls?.map(url => ({
          url,
          title: `Sample Title for ${new URL(url).hostname}`,
          content: 'Sample scraped content would appear here...',
          images: [`${url}/image1.jpg`, `${url}/image2.jpg`],
          links: [`${url}/page1`, `${url}/page2`],
          metadata: { wordCount: 500, lastModified: new Date().toISOString() },
          scrapedAt: new Date().toISOString()
        }))
      } : job
    ))

    // Reset form
    setCurrentJob({
      name: '',
      urls: [],
      settings: {
        respectRobots: true,
        delay: 1000,
        maxPages: 50,
        extractText: true,
        extractImages: true,
        extractLinks: true,
        customSelectors: ''
      }
    })
  }

  const exportResults = (job: ScrapingJob) => {
    const data = JSON.stringify(job.results, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scraping-results-${job.name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
                  value={currentJob.name || ''}
                  onChange={(e) => setCurrentJob(prev => ({ ...prev, name: e.target.value }))}
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
                {currentJob.urls && currentJob.urls.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {currentJob.urls.map((url, index) => (
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
                  <Label>Delay (ms)</Label>
                  <Input
                    type="number"
                    value={currentJob.settings?.delay || 1000}
                    onChange={(e) => setCurrentJob(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, delay: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Pages</Label>
                  <Input
                    type="number"
                    value={currentJob.settings?.maxPages || 50}
                    onChange={(e) => setCurrentJob(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, maxPages: parseInt(e.target.value) }
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Extraction Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Extract Text</span>
                    <Switch
                      checked={currentJob.settings?.extractText}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, extractText: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Extract Images</span>
                    <Switch
                      checked={currentJob.settings?.extractImages}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, extractImages: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Extract Links</span>
                    <Switch
                      checked={currentJob.settings?.extractLinks}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, extractLinks: checked }
                      }))}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleStartJob}
                disabled={!currentJob.name || !currentJob.urls?.length}
                className="w-full"
              >
                Start Scraping Job
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
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{job.name}</CardTitle>
                      <CardDescription>
                        {job.urls.length} URLs • Started {new Date(job.startedAt!).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                      {job.status === 'completed' && (
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
                  {job.status === 'running' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} />
                    </div>
                  )}

                  {job.results && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Results</Label>
                      <div className="text-sm text-gray-600">
                        Successfully scraped {job.results.length} pages
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {job.results.slice(0, 3).map((result, index) => (
                          <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                            <div className="font-medium">{result.title}</div>
                            <div className="text-gray-500">{result.url}</div>
                          </div>
                        ))}
                        {job.results.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            +{job.results.length - 3} more results
                          </div>
                        )}
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
                Scraping Settings
              </CardTitle>
              <CardDescription>
                Configure default scraping behavior and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Respect robots.txt</Label>
                    <p className="text-xs text-gray-500">Follow website crawling guidelines</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">User Agent</Label>
                  <Input 
                    placeholder="Custom user agent string"
                    defaultValue="ResearchTools Web Scraper 1.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Custom Selectors</Label>
                  <Textarea
                    placeholder="CSS selectors for custom data extraction (one per line)"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Output Format</Label>
                  <Select defaultValue="json">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="w-full" variant="outline">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}