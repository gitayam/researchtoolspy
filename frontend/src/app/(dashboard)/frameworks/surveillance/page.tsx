'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Shield, AlertTriangle, MoreVertical } from 'lucide-react'

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
    title: 'Corporate Security Assessment',
    description: 'Comprehensive surveillance detection for corporate facilities and operations',
    indicators: 24,
    criticalIndicators: 3,
    counterMeasures: 12,
    riskLevel: 'elevated',
    lastUpdated: '2024-01-15',
    status: 'active'
  },
  {
    id: '2',
    title: 'Executive Protection Surveillance',
    description: 'Personal security surveillance detection for executive team',
    indicators: 18,
    criticalIndicators: 2,
    counterMeasures: 15,
    riskLevel: 'normal',
    lastUpdated: '2024-01-12',
    status: 'completed'
  },
  {
    id: '3',
    title: 'Facility TSCM Assessment',
    description: 'Technical surveillance countermeasures for sensitive facilities',
    indicators: 32,
    criticalIndicators: 5,
    counterMeasures: 20,
    riskLevel: 'critical',
    lastUpdated: '2024-01-10',
    status: 'draft'
  }
]

export default function SurveillanceAnalysisPage() {
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

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'normal': return 'bg-green-100 text-green-800'
      case 'elevated': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Surveillance Detection Analysis</h1>
          <p className="text-gray-600 mt-2">Identify and counter surveillance activities</p>
        </div>
        <Link href="/frameworks/surveillance/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What is Surveillance Detection?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Surveillance Detection is a systematic approach to identifying potential surveillance activities 
            targeting individuals, organizations, or facilities. It involves recognizing indicators, 
            patterns, and anomalies that may suggest hostile surveillance or intelligence gathering.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <p className="font-medium">Detect</p>
                <p className="text-sm text-gray-600">Identify surveillance indicators</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-1" />
              <div>
                <p className="font-medium">Assess</p>
                <p className="text-sm text-gray-600">Evaluate threat levels</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-green-600 mt-1" />
              <div>
                <p className="font-medium">Counter</p>
                <p className="text-sm text-gray-600">Implement countermeasures</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <p className="font-medium">Monitor</p>
                <p className="text-sm text-gray-600">Continuous observation</p>
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
                    <Link href={`/frameworks/surveillance/${analysis.id}`}>
                      <h3 className="text-xl font-semibold hover:text-blue-600 transition-colors">
                        {analysis.title}
                      </h3>
                    </Link>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                      {analysis.status}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(analysis.riskLevel)}`}>
                      Risk: {analysis.riskLevel}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{analysis.description}</p>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        <span className="font-medium">{analysis.indicators}</span> indicators
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-gray-600">
                        <span className="font-medium text-red-600">{analysis.criticalIndicators}</span> critical
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span className="text-gray-600">
                        <span className="font-medium">{analysis.counterMeasures}</span> countermeasures
                      </span>
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
                      <Link href={`/frameworks/surveillance/${analysis.id}`}>View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/frameworks/surveillance/${analysis.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Export Report</DropdownMenuItem>
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
            <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No analyses found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first surveillance analysis'}
            </p>
            {!searchTerm && (
              <Link href="/frameworks/surveillance/create">
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