'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Grid3x3, MoreVertical } from 'lucide-react'

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
const mockAnalyses = [
  {
    id: '1',
    title: 'Q1 2024 Strategic Review',
    description: 'Quarterly SWOT analysis for strategic planning and decision making',
    strengths: 5,
    weaknesses: 4,
    opportunities: 6,
    threats: 3,
    lastUpdated: '2024-01-15',
    status: 'completed'
  },
  {
    id: '2',
    title: 'Product Launch Analysis',
    description: 'SWOT analysis for new product line entering competitive market',
    strengths: 7,
    weaknesses: 3,
    opportunities: 8,
    threats: 5,
    lastUpdated: '2024-01-12',
    status: 'active'
  },
  {
    id: '3',
    title: 'Market Expansion Assessment',
    description: 'Analysis of expansion into Southeast Asian markets',
    strengths: 4,
    weaknesses: 6,
    opportunities: 9,
    threats: 4,
    lastUpdated: '2024-01-10',
    status: 'draft'
  }
]

export default function SWOTListPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredAnalyses = mockAnalyses.filter(analysis =>
    analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">SWOT Analysis</h1>
          <p className="text-gray-600 mt-2">Strengths, Weaknesses, Opportunities, and Threats</p>
        </div>
        <Link href="/frameworks/swot/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

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
                    <Link href={`/frameworks/swot/${analysis.id}`}>
                      <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                        {analysis.title}
                      </h3>
                    </Link>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                      {analysis.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{analysis.description}</p>
                  
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <p className="text-sm text-gray-600">Strengths</p>
                      <p className="text-xl font-semibold text-green-600">{analysis.strengths}</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <p className="text-sm text-gray-600">Weaknesses</p>
                      <p className="text-xl font-semibold text-red-600">{analysis.weaknesses}</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <p className="text-sm text-gray-600">Opportunities</p>
                      <p className="text-xl font-semibold text-blue-600">{analysis.opportunities}</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded">
                      <p className="text-sm text-gray-600">Threats</p>
                      <p className="text-xl font-semibold text-orange-600">{analysis.threats}</p>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Updated {new Date(analysis.lastUpdated).toLocaleDateString()}
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
                      <Link href={`/frameworks/swot/${analysis.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/swot/${analysis.id}/edit`}>Edit</Link>
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
            <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first SWOT analysis'}
            </p>
            {!searchTerm && (
              <Link href="/frameworks/swot/create">
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