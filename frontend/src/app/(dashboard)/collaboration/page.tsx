'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Users, 
  Search, 
  Plus, 
  UserPlus,
  Settings,
  MessageSquare,
  Share2,
  Eye,
  Clock,
  Crown,
  Shield,
  User,
  MoreVertical,
  Activity,
  Mail
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRelativeTime } from '@/lib/utils'

// Mock data for teams and workspaces
const mockTeams: any[] = []

const mockCollaborators: any[] = []

const mockSharedAnalyses: any[] = []

const mockActivity: any[] = []

const statusColors = {
  'online': 'bg-green-500',
  'away': 'bg-yellow-500', 
  'offline': 'bg-gray-400'
}

const roleIcons = {
  'admin': Crown,
  'editor': Shield,
  'member': User,
  'viewer': Eye
}

export default function CollaborationPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCollaborators = mockCollaborators.filter(collaborator =>
    collaborator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    collaborator.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    collaborator.team.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collaboration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Work together on research analyses and manage team collaboration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Members
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        </div>
      </div>

      <Tabs defaultValue="teams" className="space-y-6">
        <TabsList>
          <TabsTrigger value="teams">Teams & Workspaces</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="shared">Shared Analyses</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-6">
          <div className="grid gap-4">
            {mockTeams.map((team) => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{team.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">{team.name}</h3>
                        <p className="text-gray-600 dark:text-gray-400">{team.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {team.members} members
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="h-4 w-4" />
                            {team.activeAnalyses} active analyses
                          </div>
                          <span>Created {formatRelativeTime(team.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        {team.role === 'admin' ? <Crown className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {team.role}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Manage Team
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Share2 className="h-4 w-4 mr-2" />
                            Invite Members
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Collaborators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or team..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredCollaborators.map((collaborator) => (
              <Card key={collaborator.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{collaborator.avatar}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${statusColors[collaborator.status as keyof typeof statusColors]} border-2 border-white`} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-medium">{collaborator.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{collaborator.role}</p>
                        <p className="text-sm text-gray-500">{collaborator.team}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="text-gray-600 dark:text-gray-400">{collaborator.contributions} contributions</p>
                        <p className="text-gray-500">Last active {formatRelativeTime(collaborator.lastActive)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                        <Button variant="outline" size="sm">
                          <Mail className="h-4 w-4 mr-2" />
                          Invite
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Shared Analyses Tab */}
        <TabsContent value="shared" className="space-y-6">
          <div className="grid gap-4">
            {mockSharedAnalyses.map((analysis) => (
              <Card key={analysis.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{analysis.title}</h3>
                        <Badge variant="outline">{analysis.framework}</Badge>
                        <Badge variant="secondary">{analysis.permissions}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Shared by {analysis.sharedBy}</span>
                        <span>•</span>
                        <span>With {analysis.sharedWith}</span>
                        <span>•</span>
                        <span>Last activity {formatRelativeTime(analysis.lastActivity)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MessageSquare className="h-4 w-4" />
                        {analysis.comments}
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Stay updated with what your team is working on
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {activity.user.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user}</span>{' '}
                        <span className="text-gray-600">{activity.action}</span>{' '}
                        <span className="font-medium">{activity.target}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Coming Soon Section */}
      <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Users className="h-12 w-12 text-blue-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Enhanced Collaboration Features Coming Soon</h3>
          <p className="text-gray-500 text-center mb-4">
            Real-time collaborative editing, advanced permissions, team analytics, and more
          </p>
          <Button variant="outline" disabled>
            <Settings className="h-4 w-4 mr-2" />
            Configure Team Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}