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
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Twitter, MessageCircle, Instagram, Hash, TrendingUp, Users, Download, Eye } from 'lucide-react'

interface SocialMediaPost {
  id: string
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok'
  author: string
  content: string
  timestamp: string
  engagement: {
    likes: number
    shares: number
    comments: number
  }
  sentiment: 'positive' | 'negative' | 'neutral'
  hashtags: string[]
  mentions: string[]
  url: string
}

interface SocialMediaJob {
  id: string
  name: string
  platform: string
  query: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startedAt?: string
  completedAt?: string
  results?: SocialMediaPost[]
  totalPosts: number
  settings: {
    maxPosts: number
    includeReplies: boolean
    includeRetweets: boolean
    sentiment: boolean
    hashtags: boolean
    timeRange: string
  }
}

export default function SocialMediaAnalysisTool() {
  const [activeTab, setActiveTab] = useState('search')
  const [jobs, setJobs] = useState<SocialMediaJob[]>([])
  const [currentJob, setCurrentJob] = useState<Partial<SocialMediaJob>>({
    name: '',
    platform: '',
    query: '',
    settings: {
      maxPosts: 100,
      includeReplies: false,
      includeRetweets: true,
      sentiment: true,
      hashtags: true,
      timeRange: '7d'
    }
  })

  const platforms = [
    { value: 'twitter', label: 'Twitter/X', icon: Twitter },
    { value: 'instagram', label: 'Instagram', icon: Instagram },
    { value: 'facebook', label: 'Facebook', icon: MessageCircle },
    { value: 'linkedin', label: 'LinkedIn', icon: Users },
  ]

  const handleStartAnalysis = async () => {
    if (!currentJob.name || !currentJob.platform || !currentJob.query) return

    const newJob: SocialMediaJob = {
      id: Date.now().toString(),
      name: currentJob.name,
      platform: currentJob.platform,
      query: currentJob.query,
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      totalPosts: 0,
      settings: currentJob.settings!
    }

    setJobs(prev => [newJob, ...prev])
    setActiveTab('jobs')

    // Simulate job progress
    const jobIndex = 0
    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise(resolve => setTimeout(resolve, 800))
      setJobs(prev => prev.map((job, index) => 
        index === jobIndex ? { ...job, progress } : job
      ))
    }

    // Complete job with mock data
    const mockResults: SocialMediaPost[] = Array.from({ length: 5 }, (_, i) => ({
      id: `post_${i}`,
      platform: currentJob.platform as any,
      author: `@user${i + 1}`,
      content: `Sample social media post content related to "${currentJob.query}". This would contain the actual post text from the platform.`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      engagement: {
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 50)
      },
      sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)] as any,
      hashtags: [`#${currentJob.query}`, '#example', '#social'],
      mentions: ['@mentioned_user'],
      url: `https://${currentJob.platform}.com/post/${i}`
    }))

    setJobs(prev => prev.map((job, index) => 
      index === jobIndex ? {
        ...job,
        status: 'completed',
        completedAt: new Date().toISOString(),
        results: mockResults,
        totalPosts: mockResults.length
      } : job
    ))

    // Reset form
    setCurrentJob({
      name: '',
      platform: '',
      query: '',
      settings: {
        maxPosts: 100,
        includeReplies: false,
        includeRetweets: true,
        sentiment: true,
        hashtags: true,
        timeRange: '7d'
      }
    })
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800'
      case 'negative':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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

  const exportResults = (job: SocialMediaJob) => {
    const data = JSON.stringify(job.results, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `social-media-analysis-${job.name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Social Media Analysis</h1>
        <p className="mt-2 text-gray-600">
          Monitor and analyze social media conversations, trends, and sentiment
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Social Media Search
              </CardTitle>
              <CardDescription>
                Search and analyze social media posts by keywords, hashtags, or users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobName">Analysis Name</Label>
                  <Input
                    id="jobName"
                    placeholder="Enter analysis name"
                    value={currentJob.name || ''}
                    onChange={(e) => setCurrentJob(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select
                    value={currentJob.platform}
                    onValueChange={(value) => setCurrentJob(prev => ({ ...prev, platform: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map((platform) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          <div className="flex items-center gap-2">
                            <platform.icon className="h-4 w-4" />
                            {platform.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="query">Search Query</Label>
                <Input
                  id="query"
                  placeholder="Enter keywords, hashtags, or @usernames"
                  value={currentJob.query || ''}
                  onChange={(e) => setCurrentJob(prev => ({ ...prev, query: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Posts</Label>
                  <Input
                    type="number"
                    value={currentJob.settings?.maxPosts || 100}
                    onChange={(e) => setCurrentJob(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, maxPosts: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select
                    value={currentJob.settings?.timeRange}
                    onValueChange={(value) => setCurrentJob(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, timeRange: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Analysis Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Include Replies</span>
                    <Switch
                      checked={currentJob.settings?.includeReplies}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, includeReplies: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Include Retweets/Shares</span>
                    <Switch
                      checked={currentJob.settings?.includeRetweets}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, includeRetweets: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sentiment Analysis</span>
                    <Switch
                      checked={currentJob.settings?.sentiment}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, sentiment: checked }
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Extract Hashtags</span>
                    <Switch
                      checked={currentJob.settings?.hashtags}
                      onCheckedChange={(checked) => setCurrentJob(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, hashtags: checked }
                      }))}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleStartAnalysis}
                disabled={!currentJob.name || !currentJob.platform || !currentJob.query}
                className="w-full"
              >
                Start Analysis
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No analysis jobs yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create a social media analysis to see results here
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
                        {job.platform} • "{job.query}" • Started {new Date(job.startedAt!).toLocaleString()}
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
                        <span>Analyzing posts...</span>
                        <span>{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} />
                    </div>
                  )}

                  {job.results && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{job.totalPosts}</div>
                          <div className="text-xs text-gray-500">Posts Found</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {job.results.filter(p => p.sentiment === 'positive').length}
                          </div>
                          <div className="text-xs text-gray-500">Positive</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {job.results.filter(p => p.sentiment === 'negative').length}
                          </div>
                          <div className="text-xs text-gray-500">Negative</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Recent Posts</Label>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {job.results.slice(0, 3).map((post) => (
                            <div key={post.id} className="bg-gray-50 p-3 rounded text-sm">
                              <div className="flex items-start justify-between mb-2">
                                <span className="font-medium">{post.author}</span>
                                <Badge className={getSentimentColor(post.sentiment)}>
                                  {post.sentiment}
                                </Badge>
                              </div>
                              <p className="text-gray-700 text-xs mb-2">{post.content}</p>
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                                <span>❤️ {post.engagement.likes} 🔄 {post.engagement.shares}</span>
                              </div>
                            </div>
                          ))}
                          {job.results.length > 3 && (
                            <div className="text-xs text-gray-500 text-center py-1">
                              +{job.results.length - 3} more posts
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending Topics
              </CardTitle>
              <CardDescription>
                Discover trending hashtags and topics across platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Trending Analysis</p>
              <p className="text-sm text-gray-400">
                Real-time trending analysis across multiple social media platforms
              </p>
              <Button variant="outline" className="mt-4" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Analytics Dashboard
              </CardTitle>
              <CardDescription>
                Comprehensive analytics and insights from your social media data
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Advanced Analytics</p>
              <p className="text-sm text-gray-400">
                Sentiment trends, engagement metrics, and audience insights
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