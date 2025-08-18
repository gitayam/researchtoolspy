/**
 * Public COG Analysis Landing Page
 * 
 * Shows recent sessions and provides easy access to create new analysis
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Target, Clock, FileText, Trash2, Brain, Zap, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { autoSaveService } from '@/services/auto-save'
// import { useIsAuthenticated } from '@/stores/auth' // Temporarily disabled
import { formatRelativeTime } from '@/lib/utils'
import type { FrameworkSession } from '@/services/auto-save'

export default function PublicCOGPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [localSessions, setLocalSessions] = useState<FrameworkSession[]>([])
  const isAuthenticated = false // Temporarily disabled to prevent infinite loop
  
  useEffect(() => {
    // Load local sessions for anonymous users
    if (!isAuthenticated) {
      const sessions = autoSaveService.getAnonymousSessions('cog')
      setLocalSessions(sessions)
    }
  }, [isAuthenticated])
  
  const filteredSessions = localSessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const key = `omnicore_framework_cog_${sessionId}`
      localStorage.removeItem(key)
      
      // Refresh sessions
      const sessions = autoSaveService.getAnonymousSessions('cog')
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
              COG Analysis
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Center of Gravity Analysis - Identify key strengths and vulnerabilities
            </p>
            
            {!isAuthenticated && localSessions.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  📝 You have {localSessions.length} saved analysis session{localSessions.length !== 1 ? 's' : ''} from previous visits
                </p>
              </div>
            )}
          </div>
          
          <Link href="/frameworks/cog/create">
            <Button size="lg" className="bg-green-600 hover:bg-green-700">
              <Plus className="h-5 w-5 mr-2" />
              New COG Analysis
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
                          <Link href={`/frameworks/cog/create?resume=${session.id}`}>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors cursor-pointer">
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
                            COG Analysis
                          </div>
                        </div>
                        
                        {/* COG Preview */}
                        {session.data && (
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                              <p className="text-red-700 dark:text-red-300 font-medium">Centers of Gravity</p>
                              <p className="text-red-800 dark:text-red-200">
                                {session.data.centers_of_gravity?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                              <p className="text-blue-700 dark:text-blue-300 font-medium">Capabilities</p>
                              <p className="text-blue-800 dark:text-blue-200">
                                {session.data.critical_capabilities?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                              <p className="text-green-700 dark:text-green-300 font-medium">Requirements</p>
                              <p className="text-green-800 dark:text-green-200">
                                {session.data.critical_requirements?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                              <p className="text-orange-700 dark:text-orange-300 font-medium">Vulnerabilities</p>
                              <p className="text-orange-800 dark:text-orange-200">
                                {session.data.critical_vulnerabilities?.length || 0}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/frameworks/cog/create?resume=${session.id}`}>
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
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-gray-900 dark:text-gray-100">
              Start Your COG Analysis
            </CardTitle>
            <CardDescription>
              Identify Centers of Gravity, Critical Capabilities, Requirements, and Vulnerabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/frameworks/cog/create">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
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
              What is COG Analysis?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Center of Gravity (COG) analysis identifies the source of power that provides moral or physical strength, 
              freedom of action, or will to act. It systematically examines critical capabilities, requirements, 
              and vulnerabilities to understand strategic advantages and weaknesses.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              When to Use COG Analysis
            </h3>
            <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1">
              <li>• Strategic military planning and operations</li>
              <li>• Competitive business analysis</li>
              <li>• Organizational strength assessment</li>
              <li>• Risk and vulnerability evaluation</li>
              <li>• Resource allocation and prioritization</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}