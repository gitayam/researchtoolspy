'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Users, Target, TrendingUp, AlertTriangle, MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mock data for demonstration
const mockAnalyses: any[] = []

export default function StakeholderAnalysisPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredAnalyses = mockAnalyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'archived': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Stakeholder Analysis</h1>
          <p className="text-gray-600 mt-2">Map influence, interest, and engagement strategies</p>
        </div>
        <Link href="/frameworks/stakeholder/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What is Stakeholder Analysis?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Stakeholder Analysis is a systematic method for identifying and analyzing individuals or groups 
            who can affect or are affected by a project, decision, or initiative. It helps map stakeholder 
            influence, interest levels, and develop appropriate engagement strategies.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <p className="font-medium">Identify</p>
                <p className="text-sm text-gray-600">Map all relevant stakeholders</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-green-600 mt-1" />
              <div>
                <p className="font-medium">Assess</p>
                <p className="text-sm text-gray-600">Evaluate influence & interest</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <p className="font-medium">Strategize</p>
                <p className="text-sm text-gray-600">Develop engagement plans</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-1" />
              <div>
                <p className="font-medium">Manage</p>
                <p className="text-sm text-gray-600">Address concerns & risks</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search analyses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredAnalyses.map((analysis) => (
          <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link href={`/frameworks/stakeholder/${analysis.id}`}>
                      <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                        {analysis.title}
                      </h3>
                    </Link>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                      {analysis.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{analysis.description}</p>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{analysis.stakeholderCount}</span> stakeholders
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      <span className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{analysis.highInfluence}</span> high influence
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{analysis.champions}</span> champions
                      </span>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      Updated {new Date(analysis.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/stakeholder/${analysis.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/stakeholder/${analysis.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Export</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAnalyses.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first stakeholder analysis'}
            </p>
            {!searchTerm && (
              <Link href="/frameworks/stakeholder/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Analysis
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}