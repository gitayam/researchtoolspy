import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Instagram, Youtube, Twitter, Smartphone, Facebook, Linkedin,
  Plus, Search, Download, BarChart3, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle2, Clock, XCircle, Loader2, ArrowLeft,
  FileDown, Trash2, Eye, Terminal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SocialMediaProfile {
  id: string
  platform: string
  username: string
  display_name?: string
  profile_url: string
  bio?: string
  profile_pic_url?: string
  followers_count: number
  following_count: number
  posts_count: number
  verified: boolean
  scraped_posts_count?: number
  last_scraped_at?: string
  is_active: boolean
}

interface SocialMediaPost {
  id: string
  profile_id: string
  platform: string
  post_url: string
  post_id: string
  post_type?: string
  caption?: string
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  posted_at?: string
  thumbnail_url?: string
  sentiment_score?: number
}

interface SocialMediaJob {
  id: string
  job_type: string
  platform: string
  target_username?: string
  target_url?: string
  status: string
  progress: number
  items_found: number
  items_processed: number
  error_message?: string
  created_at: string
}

interface Stats {
  profiles: number
  posts: number
  jobs_by_status: Array<{ status: string; count: number }>
}

const platformIcons: Record<string, any> = {
  INSTAGRAM: Instagram,
  YOUTUBE: Youtube,
  TWITTER: Twitter,
  TIKTOK: Smartphone,
  FACEBOOK: Facebook,
  LINKEDIN: Linkedin
}

const platformColors: Record<string, string> = {
  INSTAGRAM: 'bg-gradient-to-r from-purple-500 to-pink-500',
  YOUTUBE: 'bg-red-600',
  TWITTER: 'bg-blue-400',
  TIKTOK: 'bg-black',
  FACEBOOK: 'bg-blue-600',
  LINKEDIN: 'bg-blue-700'
}

export function SocialMediaPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [profiles, setProfiles] = useState<SocialMediaProfile[]>([])
  const [posts, setPosts] = useState<SocialMediaPost[]>([])
  const [jobs, setJobs] = useState<SocialMediaJob[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedProfile, setSelectedProfile] = useState<SocialMediaProfile | null>(null)

  // Add profile dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newProfile, setNewProfile] = useState({
    platform: 'INSTAGRAM',
    username: '',
    display_name: '',
    bio: ''
  })

  // Create job dialog
  const [jobDialogOpen, setJobDialogOpen] = useState(false)
  const [newJob, setNewJob] = useState({
    platform: 'INSTAGRAM',
    job_type: 'PROFILE_SCRAPE',
    target_username: '',
    target_url: ''
  })

  useEffect(() => {
    loadStats()
    loadProfiles()
    loadJobs()
  }, [])

  useEffect(() => {
    if (selectedProfile) {
      loadPosts(selectedProfile.id)
    }
  }, [selectedProfile])

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/social-media/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      const params = new URLSearchParams()
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform)
      }

      const response = await fetch(`/api/social-media/profiles?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setProfiles(data)
      }
    } catch (error) {
      console.error('Failed to load profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPosts = async (profileId: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/social-media/posts?profile_id=${profileId}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPosts(data)
      }
    } catch (error) {
      console.error('Failed to load posts:', error)
    }
  }

  const loadJobs = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/social-media/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setJobs(data)
      }
    } catch (error) {
      console.error('Failed to load jobs:', error)
    }
  }

  const handleAddProfile = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/social-media/profiles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProfile)
      })

      if (response.ok) {
        setAddDialogOpen(false)
        setNewProfile({ platform: 'INSTAGRAM', username: '', display_name: '', bio: '' })
        loadProfiles()
        loadStats()
      }
    } catch (error) {
      console.error('Failed to add profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateJob = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/social-media/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newJob)
      })

      if (response.ok) {
        setJobDialogOpen(false)
        setNewJob({ platform: 'INSTAGRAM', job_type: 'PROFILE_SCRAPE', target_username: '', target_url: '' })
        loadJobs()
      }
    } catch (error) {
      console.error('Failed to create job:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    try {
      const token = localStorage.getItem('auth_token')
      await fetch(`/api/social-media/profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      loadProfiles()
      loadStats()
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(null)
        setPosts([])
      }
    } catch (error) {
      console.error('Failed to delete profile:', error)
    }
  }

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getJobStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'COMPLETED': 'default',
      'RUNNING': 'secondary',
      'FAILED': 'destructive',
      'PENDING': 'outline'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Social Media Intelligence
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Scrape, analyze, and monitor social media content
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                New Scrape Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Scraping Job</DialogTitle>
                <DialogDescription>
                  Configure a new social media scraping task
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Platform</Label>
                  <Select
                    value={newJob.platform}
                    onValueChange={(value) => setNewJob({ ...newJob, platform: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="YOUTUBE">YouTube</SelectItem>
                      <SelectItem value="TWITTER">Twitter/X</SelectItem>
                      <SelectItem value="TIKTOK">TikTok</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Job Type</Label>
                  <Select
                    value={newJob.job_type}
                    onValueChange={(value) => setNewJob({ ...newJob, job_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROFILE_SCRAPE">Profile Scrape</SelectItem>
                      <SelectItem value="POST_SCRAPE">Post Scrape</SelectItem>
                      <SelectItem value="MEDIA_DOWNLOAD">Media Download</SelectItem>
                      <SelectItem value="SEARCH">Search</SelectItem>
                      <SelectItem value="MONITOR">Monitor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Username</Label>
                  <Input
                    placeholder="username"
                    value={newJob.target_username}
                    onChange={(e) => setNewJob({ ...newJob, target_username: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Target URL (optional)</Label>
                  <Input
                    placeholder="https://..."
                    value={newJob.target_url}
                    onChange={(e) => setNewJob({ ...newJob, target_url: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setJobDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateJob} disabled={!newJob.target_username && !newJob.target_url}>
                  Create Job
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Social Media Profile</DialogTitle>
                <DialogDescription>
                  Add a profile to track and analyze
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Platform</Label>
                  <Select
                    value={newProfile.platform}
                    onValueChange={(value) => setNewProfile({ ...newProfile, platform: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="YOUTUBE">YouTube</SelectItem>
                      <SelectItem value="TWITTER">Twitter/X</SelectItem>
                      <SelectItem value="TIKTOK">TikTok</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Username *</Label>
                  <Input
                    placeholder="username"
                    value={newProfile.username}
                    onChange={(e) => setNewProfile({ ...newProfile, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input
                    placeholder="Display Name"
                    value={newProfile.display_name}
                    onChange={(e) => setNewProfile({ ...newProfile, display_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bio/Description</Label>
                  <Textarea
                    placeholder="Profile bio or description"
                    value={newProfile.bio}
                    onChange={(e) => setNewProfile({ ...newProfile, bio: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddProfile} disabled={!newProfile.username}>
                  Add Profile
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.profiles}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.posts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.jobs_by_status.find(j => j.status === 'RUNNING')?.count || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Completed Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.jobs_by_status.find(j => j.status === 'COMPLETED')?.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="jobs">Scraping Jobs</TabsTrigger>
          <TabsTrigger value="tools">Integration Tools</TabsTrigger>
        </TabsList>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedPlatform} onValueChange={(value) => {
              setSelectedPlatform(value)
              setTimeout(loadProfiles, 0)
            }}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="YOUTUBE">YouTube</SelectItem>
                <SelectItem value="TWITTER">Twitter/X</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadProfiles}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => {
              const Icon = platformIcons[profile.platform] || Instagram
              const colorClass = platformColors[profile.platform] || 'bg-gray-600'

              return (
                <Card
                  key={profile.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedProfile(profile)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      {profile.verified && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-2">{profile.display_name || profile.username}</CardTitle>
                    <CardDescription>@{profile.username}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Followers</span>
                        <span className="font-semibold">{formatNumber(profile.followers_count)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Posts</span>
                        <span className="font-semibold">{formatNumber(profile.posts_count)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Scraped</span>
                        <span className="font-semibold">{profile.scraped_posts_count || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Last Scraped</span>
                        <span className="font-semibold">{formatDate(profile.last_scraped_at)}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(profile.profile_url, '_blank')
                          }}
                          className="flex-1"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProfile(profile.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {profiles.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Instagram className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No profiles yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Add social media profiles to start tracking and analyzing content
                </p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Profile
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {selectedProfile ? (
            <>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProfile(null)
                    setPosts([])
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to All Profiles
                </Button>
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {selectedProfile.display_name || selectedProfile.username}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {posts.length} posts scraped
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((post) => (
                  <Card key={post.id}>
                    {post.thumbnail_url && (
                      <div className="aspect-square w-full overflow-hidden">
                        <img
                          src={post.thumbnail_url}
                          alt="Post thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <Badge variant="outline" className="text-xs">
                          {post.post_type || 'Post'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(post.post_url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {post.caption && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                          {post.caption}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600 dark:text-gray-400">❤️</span>
                          <span>{formatNumber(post.likes_count)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600 dark:text-gray-400">💬</span>
                          <span>{formatNumber(post.comments_count)}</span>
                        </div>
                        {post.shares_count > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600 dark:text-gray-400">🔄</span>
                            <span>{formatNumber(post.shares_count)}</span>
                          </div>
                        )}
                        {post.views_count > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600 dark:text-gray-400">👁️</span>
                            <span>{formatNumber(post.views_count)}</span>
                          </div>
                        )}
                      </div>
                      {post.posted_at && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Posted: {formatDate(post.posted_at)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {posts.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No posts scraped yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Create a scraping job to collect posts from this profile
                    </p>
                    <Button onClick={() => setJobDialogOpen(true)}>
                      <Download className="h-4 w-4 mr-2" />
                      Start Scraping
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select a profile
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a profile from the Profiles tab to view its posts
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadJobs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="space-y-2">
            {jobs.map((job) => {
              const Icon = platformIcons[job.platform] || Instagram

              return (
                <Card key={job.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {job.job_type.replace(/_/g, ' ')}
                            </CardTitle>
                            {getJobStatusBadge(job.status)}
                          </div>
                          <CardDescription>
                            {job.target_username && `@${job.target_username}`}
                            {job.target_url && ` • ${job.target_url.substring(0, 50)}...`}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getJobStatusIcon(job.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {job.status === 'RUNNING' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Progress</span>
                            <span className="font-semibold">{job.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Found</div>
                          <div className="font-semibold">{job.items_found}</div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Processed</div>
                          <div className="font-semibold">{job.items_processed}</div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Created</div>
                          <div className="font-semibold">{formatDate(job.created_at)}</div>
                        </div>
                      </div>
                      {job.error_message && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                          {job.error_message}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {jobs.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Download className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No scraping jobs yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create a job to start scraping social media content
                </p>
                <Button onClick={() => setJobDialogOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Create Scraping Job
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Integration Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Tools & Setup</CardTitle>
              <CardDescription>
                External tools required for social media scraping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="border-l-4 border-blue-600 pl-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Instagram className="h-5 w-5" />
                    Instagram - Instaloader
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Download photos, videos, captions, and metadata from Instagram
                  </p>
                  <div className="mt-3 bg-gray-900 dark:bg-gray-800 rounded-lg p-4 text-sm">
                    <code className="text-green-400">
                      # Install instaloader
                      <br />pip install instaloader
                      <br /><br /># Download profile
                      <br />instaloader profile username
                      <br /><br /># Download profile with posts
                      <br />instaloader --no-videos --no-metadata-json username
                    </code>
                  </div>
                </div>

                <div className="border-l-4 border-red-600 pl-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Youtube className="h-5 w-5" />
                    YouTube - yt-dlp
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Download videos, metadata, and subtitles from YouTube and 1000+ sites
                  </p>
                  <div className="mt-3 bg-gray-900 dark:bg-gray-800 rounded-lg p-4 text-sm">
                    <code className="text-green-400">
                      # Install yt-dlp
                      <br />pip install yt-dlp
                      <br /><br /># Download video
                      <br />yt-dlp https://www.youtube.com/watch?v=VIDEO_ID
                      <br /><br /># Get metadata only
                      <br />yt-dlp --skip-download --write-info-json URL
                      <br /><br /># Download channel
                      <br />yt-dlp https://www.youtube.com/@channel
                    </code>
                  </div>
                </div>

                <div className="border-l-4 border-blue-400 pl-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Twitter className="h-5 w-5" />
                    Twitter/X - snscrape or twint
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Scrape tweets, profiles, and trends without API limits
                  </p>
                  <div className="mt-3 bg-gray-900 dark:bg-gray-800 rounded-lg p-4 text-sm">
                    <code className="text-green-400">
                      # Install snscrape
                      <br />pip install snscrape
                      <br /><br /># Scrape user tweets
                      <br />snscrape twitter-user username &gt; tweets.json
                      <br /><br /># Scrape search results
                      <br />snscrape twitter-search "keyword" &gt; results.json
                    </code>
                  </div>
                </div>

                <div className="border-l-4 border-black pl-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    TikTok - TikTok-Api or tiktok-scraper
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Download TikTok videos and user profiles
                  </p>
                  <div className="mt-3 bg-gray-900 dark:bg-gray-800 rounded-lg p-4 text-sm">
                    <code className="text-green-400">
                      # Install tiktok-scraper
                      <br />npm install -g tiktok-scraper
                      <br /><br /># Download user videos
                      <br />tiktok-scraper user USERNAME -d -n 50
                      <br /><br /># Download hashtag videos
                      <br />tiktok-scraper hashtag HASHTAG -d -n 20
                    </code>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                        Important Notes
                      </h4>
                      <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                        <li>These tools run locally or on your own servers</li>
                        <li>Respect platform terms of service and rate limits</li>
                        <li>Some platforms may require authentication</li>
                        <li>Use responsibly and ethically</li>
                        <li>Data can be uploaded to this platform via the API</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-2">
                    <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                        Integration Workflow
                      </h4>
                      <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                        <li>Install the appropriate scraping tool locally</li>
                        <li>Run the tool to collect social media data</li>
                        <li>Process and format the data (JSON recommended)</li>
                        <li>Upload to this platform via the API endpoints</li>
                        <li>Analyze and visualize the collected data</li>
                      </ol>
                    </div>
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
