/**
 * Public SWOT Analysis Landing Page
 * 
 * Shows recent sessions and provides easy access to create new analysis
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Grid3x3, Clock, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { autoSaveService } from '@/services/auto-save'
import { useIsAuthenticated } from '@/stores/auth'
import { formatRelativeTime } from '@/lib/utils'
import type { FrameworkSession } from '@/services/auto-save'

export default function PublicSWOTPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [localSessions, setLocalSessions] = useState<FrameworkSession[]>([])
  const isAuthenticated = useIsAuthenticated()
  
  useEffect(() => {
    // Load local sessions for anonymous users
    if (!isAuthenticated) {
      const sessions = autoSaveService.getAnonymousSessions('swot')
      setLocalSessions(sessions)
    }
  }, [isAuthenticated])
  
  const filteredSessions = localSessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const key = `omnicore_framework_swot_${sessionId}`
      localStorage.removeItem(key)
      
      // Refresh sessions
      const sessions = autoSaveService.getAnonymousSessions('swot')
      setLocalSessions(sessions)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-12 px-4 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              SWOT Analysis
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Analyze Strengths, Weaknesses, Opportunities, and Threats
            </p>
            
            {!isAuthenticated && localSessions.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  📝 You have {localSessions.length} saved analysis session{localSessions.length !== 1 ? 's' : ''} from previous visits
                </p>
              </div>
            )}
          </div>
          
          <Link href="/frameworks/swot/create">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-5 w-5 mr-2" />
              New SWOT Analysis
            </Button>
          </Link>
        </div>
        
        {/* Recent Sessions */}
        {!isAuthenticated && localSessions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Your Recent Work
              </h2>
              
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="grid gap-4">
              {filteredSessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link href={`/frameworks/swot/create?resume=${session.id}`}>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
                              {session.title}
                            </h3>
                          </Link>
                          <Badge variant="outline" className="text-xs">
                            Local Draft
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatRelativeTime(session.lastModified)}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            SWOT Analysis
                          </div>
                        </div>
                        
                        {/* SWOT Preview */}
                        {session.data && (
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                              <p className="text-green-700 dark:text-green-300 font-medium">Strengths</p>
                              <p className="text-green-800 dark:text-green-200">
                                {session.data.strengths?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                              <p className="text-red-700 dark:text-red-300 font-medium">Weaknesses</p>
                              <p className="text-red-800 dark:text-red-200">
                                {session.data.weaknesses?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                              <p className="text-blue-700 dark:text-blue-300 font-medium">Opportunities</p>
                              <p className="text-blue-800 dark:text-blue-200">
                                {session.data.opportunities?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                              <p className="text-orange-700 dark:text-orange-300 font-medium">Threats</p>
                              <p className="text-orange-800 dark:text-orange-200">
                                {session.data.threats?.length || 0}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/frameworks/swot/create?resume=${session.id}`}>
                          <Button variant="outline" size="sm">
                            Continue
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSession(session.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredSessions.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No sessions found matching "{searchTerm}"
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Getting Started */}
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Grid3x3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-gray-900 dark:text-gray-100">
              Start Your SWOT Analysis
            </CardTitle>
            <CardDescription>
              Create a comprehensive analysis of internal strengths & weaknesses 
              and external opportunities & threats
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/frameworks/swot/create">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-5 w-5 mr-2" />
                Create New Analysis
              </Button>
            </Link>
            
            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              <p>
                ✨ Your work is automatically saved as you type
                {!isAuthenticated && ' • Sign in to save to the cloud and access from any device'}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Framework Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              What is SWOT Analysis?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              SWOT Analysis is a strategic planning framework used to evaluate the 
              <strong> Strengths</strong>, <strong>Weaknesses</strong>, 
              <strong> Opportunities</strong>, and <strong>Threats</strong> involved 
              in a project, business, or situation. It provides a structured approach 
              to assess both internal and external factors that can impact success.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              When to Use SWOT
            </h3>
            <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1">
              <li>• Strategic planning and decision making</li>
              <li>• Market entry and competitive analysis</li>
              <li>• Product development and positioning</li>
              <li>• Organizational assessment and improvement</li>
              <li>• Risk assessment and opportunity identification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}