'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Grid, List, Shield, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

interface DOTMLPFSession {
  id: string
  title: string
  description: string
  mission: string
  capabilities: Array<{
    domain: string
    capability: string
    currentState: string
    priority: string
  }>
  lastSaved: string
  status: 'draft' | 'in_progress' | 'completed'
}

export default function DOTMLPFListPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [localSessions, setLocalSessions] = useState<DOTMLPFSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLocalSessions()
  }, [])

  const loadLocalSessions = () => {
    try {
      const sessions: DOTMLPFSession[] = []
      
      // Load all DOTMLpf sessions from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('dotmlpf_session_')) {
          try {
            const sessionData = JSON.parse(localStorage.getItem(key) || '{}')
            if (sessionData.data) {
              sessions.push({
                id: key.replace('dotmlpf_session_', ''),
                title: sessionData.data.title || 'Untitled Analysis',
                description: sessionData.data.description || '',
                mission: sessionData.data.mission || '',
                capabilities: sessionData.data.capabilities || [],
                lastSaved: sessionData.lastSaved || new Date().toISOString(),
                status: sessionData.status || 'draft'
              })
            }
          } catch (error) {
            // Invalid session data, skip
          }
        }
      }
      
      // Sort by last saved, most recent first
      sessions.sort((a, b) => new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime())
      setLocalSessions(sessions)
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = (sessionId: string) => {
    if (confirm('Are you sure you want to delete this analysis?')) {
      localStorage.removeItem(`dotmlpf_session_${sessionId}`)
      loadLocalSessions()
    }
  }

  const getCapabilityCount = (session: DOTMLPFSession) => {
    const byDomain: Record<string, number> = {}
    session.capabilities.forEach(cap => {
      byDomain[cap.domain] = (byDomain[cap.domain] || 0) + 1
    })
    return byDomain
  }

  const getPriorityDistribution = (session: DOTMLPFSession) => {
    const priorities = { critical: 0, high: 0, medium: 0, low: 0 }
    session.capabilities.forEach(cap => {
      if (cap.priority && priorities.hasOwnProperty(cap.priority)) {
        priorities[cap.priority as keyof typeof priorities]++
      }
    })
    return priorities
  }

  const filteredSessions = localSessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.mission.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Shield className="h-8 w-8 animate-pulse text-purple-500 mx-auto mb-4" />
            <p className="text-gray-500">Loading DOTMLpf analyses...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="text-3xl font-bold">DOTMLpf Analysis</h1>
            <p className="text-gray-600">Capability-based assessment framework</p>
          </div>
        </div>
        <Link href="/frameworks/dotmlpf/create">
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search analyses..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? 'No analyses found' : 'No DOTMLpf Analyses Yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Get started by creating your first capability assessment'
              }
            </p>
            {!searchTerm && (
              <Link href="/frameworks/dotmlpf/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Analysis
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => {
            const capCount = getCapabilityCount(session)
            const priorities = getPriorityDistribution(session)
            
            return (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg line-clamp-1">
                      {session.title}
                    </CardTitle>
                    <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                      {session.status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {session.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {session.mission && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Mission</p>
                        <p className="text-sm line-clamp-2">{session.mission}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Capabilities</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(capCount).map(([domain, count]) => (
                          <Badge key={domain} variant="outline" className="text-xs">
                            {domain}: {count}
                          </Badge>
                        ))}
                        {session.capabilities.length === 0 && (
                          <span className="text-xs text-gray-400">No capabilities defined</span>
                        )}
                      </div>
                    </div>

                    {session.capabilities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Priority Distribution</p>
                        <div className="flex gap-2 text-xs">
                          {priorities.critical > 0 && (
                            <span className="text-red-600">Critical: {priorities.critical}</span>
                          )}
                          {priorities.high > 0 && (
                            <span className="text-orange-600">High: {priorities.high}</span>
                          )}
                          {priorities.medium > 0 && (
                            <span className="text-yellow-600">Medium: {priorities.medium}</span>
                          )}
                          {priorities.low > 0 && (
                            <span className="text-green-600">Low: {priorities.low}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(session.lastSaved)}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/frameworks/dotmlpf/create?session=${session.id}`}>
                          <Button size="sm" variant="outline">
                            Continue
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteSession(session.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const priorities = getPriorityDistribution(session)
            
            return (
              <Card key={session.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{session.title}</h3>
                        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                          {session.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-4">{session.description || 'No description'}</p>
                      
                      {session.mission && (
                        <div className="mb-3">
                          <span className="font-medium text-sm">Mission: </span>
                          <span className="text-sm text-gray-600">{session.mission}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">Total Capabilities:</span>
                          <span className="ml-2 font-medium">{session.capabilities.length}</span>
                        </div>
                        {priorities.critical > 0 && (
                          <div>
                            <span className="text-gray-500">Critical:</span>
                            <span className="ml-2 font-medium text-red-600">{priorities.critical}</span>
                          </div>
                        )}
                        {priorities.high > 0 && (
                          <div>
                            <span className="text-gray-500">High:</span>
                            <span className="ml-2 font-medium text-orange-600">{priorities.high}</span>
                          </div>
                        )}
                        <div className="text-gray-500">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {formatRelativeTime(session.lastSaved)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Link href={`/frameworks/dotmlpf/create?session=${session.id}`}>
                        <Button variant="outline">Continue</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteSession(session.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="mt-8 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-purple-600" />
            About DOTMLpf Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            DOTMLpf is a capability-based assessment framework used to identify gaps and solutions across eight domains:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="font-medium">• Doctrine</div>
            <div className="font-medium">• Organization</div>
            <div className="font-medium">• Training</div>
            <div className="font-medium">• Materiel</div>
            <div className="font-medium">• Leadership</div>
            <div className="font-medium">• Personnel</div>
            <div className="font-medium">• Facilities</div>
            <div className="font-medium">• Policy</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}