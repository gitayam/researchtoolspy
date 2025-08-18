'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Shield, MoreVertical } from 'lucide-react'

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

export default function DIMEListPage() {
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">DIME Framework Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Diplomatic, Information, Military, and Economic instruments</p>
        </div>
        <Link href="/frameworks/dime/create">
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
                    <Link href={`/frameworks/dime/${analysis.id}`}>
                      <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                        {analysis.title}
                      </h3>
                    </Link>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                      {analysis.status}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{analysis.description}</p>
                  
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <p className="text-xs text-gray-600">Diplomatic</p>
                      <p className={`text-xl font-semibold ${getScoreColor(analysis.diplomatic)}`}>
                        {analysis.diplomatic}/10
                      </p>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <p className="text-xs text-gray-600">Information</p>
                      <p className={`text-xl font-semibold ${getScoreColor(analysis.information)}`}>
                        {analysis.information}/10
                      </p>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <p className="text-xs text-gray-600">Military</p>
                      <p className={`text-xl font-semibold ${getScoreColor(analysis.military)}`}>
                        {analysis.military}/10
                      </p>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <p className="text-xs text-gray-600">Economic</p>
                      <p className={`text-xl font-semibold ${getScoreColor(analysis.economic)}`}>
                        {analysis.economic}/10
                      </p>
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
                      <Link href={`/frameworks/dime/${analysis.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/dime/${analysis.id}/edit`}>Edit</Link>
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
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first DIME analysis'}
            </p>
            {!searchTerm && (
              <Link href="/frameworks/dime/create">
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