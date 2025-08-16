'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Target, MoreVertical } from 'lucide-react'

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
    title: 'Competitor Strategic COG Analysis',
    description: 'Identifying the center of gravity for main competitor operations',
    cogElements: 12,
    vulnerabilities: 5,
    criticalFactors: 8,
    lastUpdated: '2024-01-15',
    status: 'active'
  },
  {
    id: '2',
    title: 'Regional Stability Assessment',
    description: 'COG analysis for regional power dynamics and stability factors',
    cogElements: 15,
    vulnerabilities: 7,
    criticalFactors: 10,
    lastUpdated: '2024-01-12',
    status: 'completed'
  },
  {
    id: '3',
    title: 'Supply Chain COG Analysis',
    description: 'Critical nodes and vulnerabilities in global supply chain',
    cogElements: 18,
    vulnerabilities: 9,
    criticalFactors: 12,
    lastUpdated: '2024-01-10',
    status: 'draft'
  }
]

export default function COGListPage() {
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
          <h1 className="text-3xl font-bold">Center of Gravity Analysis</h1>
          <p className="text-gray-600 mt-2">Identify critical capabilities and vulnerabilities</p>
        </div>
        <Link href="/frameworks/cog/create">
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
                    <Link href={`/frameworks/cog/${analysis.id}`}>
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
                    <div>
                      <span className="text-gray-500">COG Elements:</span>
                      <span className="ml-2 font-medium">{analysis.cogElements}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Vulnerabilities:</span>
                      <span className="ml-2 font-medium text-orange-600">{analysis.vulnerabilities}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Critical Factors:</span>
                      <span className="ml-2 font-medium text-blue-600">{analysis.criticalFactors}</span>
                    </div>
                    <div className="text-gray-500">
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
                      <Link href={`/frameworks/cog/${analysis.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/cog/${analysis.id}/edit`}>Edit</Link>
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
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first COG analysis'}
            </p>
            {!searchTerm && (
              <Link href="/frameworks/cog/create">
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