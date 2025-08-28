'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Lightbulb, Search, Calendar, User, Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import { SessionListSkeleton } from '@/components/loading/session-card-skeleton'

interface StarburstingSession {
  id: string
  title: string
  description?: string
  framework_type: 'starbursting'
  status: 'draft' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
  user_id: string
}

export default function StarburstingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<StarburstingSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await apiClient.get<StarburstingSession[]>('/frameworks/', {
          params: { framework_type: 'starbursting' }
        })
        setSessions(data)
      } catch (error: any) {
        console.warn('API not available, using empty data:', error.message)
        // Don't show error toast for missing API endpoints in development
        setSessions([])
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [toast])

  const handleCreateNew = () => {
    router.push('/frameworks/starbursting/create')
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Starbursting Framework</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Explore ideas through systematic questioning and 5W analysis
            </p>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </div>

        {/* Framework Description */}
        <Card className="border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Lightbulb className="h-5 w-5" />
              About Starbursting Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Starbursting is a brainstorming technique that focuses on generating questions rather than answers. 
              It helps systematically explore topics by asking Who, What, Where, When, Why, and How questions.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-blue-800 dark:text-blue-400">Central Idea</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Start with a topic or URL</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-blue-800 dark:text-blue-400">5W Questions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Who, What, Where, When, Why</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-blue-800 dark:text-blue-400">URL Processing</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Extract key insights from links</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Sessions */}
        <SessionListSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Starbursting Framework</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Explore ideas through systematic questioning and 5W analysis
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Description */}
      <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            About Starbursting Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            Starbursting is a brainstorming technique that focuses on generating questions rather than answers. 
            It helps systematically explore topics by asking Who, What, Where, When, Why, and How questions.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded-lg">
              <h4 className="font-medium text-blue-800">Central Idea</h4>
              <p className="text-sm text-gray-600">Start with a topic or URL</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <h4 className="font-medium text-blue-800">5W Questions</h4>
              <p className="text-sm text-gray-600">Who, What, Where, When, Why</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <h4 className="font-medium text-blue-800">URL Processing</h4>
              <p className="text-sm text-gray-600">Extract key insights from links</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg leading-tight text-gray-900 dark:text-gray-100">{session.title}</CardTitle>
                  <Badge className={statusColors[session.status]}>
                    {session.status.replace('_', ' ')}
                  </Badge>
                </div>
                {session.description && (
                  <CardDescription className="line-clamp-2">
                    {session.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatRelativeTime(session.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {formatRelativeTime(session.updated_at)}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => router.push(`/frameworks/starbursting/${session.id}`)}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push(`/frameworks/starbursting/${session.id}/edit`)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Starbursting Analyses</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first Starbursting analysis to start exploring ideas through systematic questioning.
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}