'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Eye,
  Calendar,
  Target,
  Brain,
  BarChart3,
  Shield,
  MoreVertical
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'

// Mock data for reports
const mockReports = [
  {
    id: '1',
    title: 'Q1 2024 Strategic Review',
    framework: 'SWOT',
    status: 'completed',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
    author: 'Research Analyst',
    description: 'Quarterly SWOT analysis for strategic planning and decision making',
    tags: ['quarterly', 'strategic', 'planning'],
    export_count: 5,
    view_count: 23
  },
  {
    id: '2',
    title: 'Cyber Incident Attribution Analysis',
    framework: 'ACH',
    status: 'in_progress',
    created_at: '2024-01-12T00:00:00Z',
    updated_at: '2024-01-16T00:00:00Z',
    author: 'Research Analyst',
    description: 'Analysis of Competing Hypotheses for cyber incident attribution',
    tags: ['cyber', 'attribution', 'incident'],
    export_count: 2,
    view_count: 12
  },
  {
    id: '3',
    title: 'Regional Power Assessment',
    framework: 'DIME',
    status: 'draft',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-14T00:00:00Z',
    author: 'Research Analyst',
    description: 'DIME analysis of regional power dynamics',
    tags: ['regional', 'power', 'assessment'],
    export_count: 0,
    view_count: 8
  },
  {
    id: '4',
    title: 'Market Expansion Analysis',
    framework: 'SWOT',
    status: 'completed',
    created_at: '2024-01-08T00:00:00Z',
    updated_at: '2024-01-12T00:00:00Z',
    author: 'Research Analyst',
    description: 'Analysis of expansion into Southeast Asian markets',
    tags: ['market', 'expansion', 'asia'],
    export_count: 8,
    view_count: 34
  }
]

const frameworkIcons = {
  'SWOT': Target,
  'ACH': Search,
  'DIME': Shield,
  'COG': Brain,
  'PMESII-PT': BarChart3
}

const frameworkColors = {
  'SWOT': 'bg-blue-100 text-blue-800',
  'ACH': 'bg-orange-100 text-orange-800',
  'DIME': 'bg-red-100 text-red-800',
  'COG': 'bg-green-100 text-green-800',
  'PMESII-PT': 'bg-purple-100 text-purple-800'
}

const statusColors = {
  'completed': 'bg-green-100 text-green-800',
  'in_progress': 'bg-blue-100 text-blue-800',
  'draft': 'bg-gray-100 text-gray-800'
}

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterFramework, setFilterFramework] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const filteredReports = mockReports.filter(report => {
    const matchesSearch = searchTerm === '' || 
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesFramework = filterFramework === 'all' || report.framework === filterFramework
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus
    
    return matchesSearch && matchesFramework && matchesStatus
  })

  const getFrameworkIcon = (framework: string) => {
    const Icon = frameworkIcons[framework as keyof typeof frameworkIcons] || FileText
    return Icon
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Research Reports</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View, manage, and export your research analyses and reports
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search reports by title, description, or tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterFramework} onValueChange={setFilterFramework}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All frameworks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                <SelectItem value="SWOT">SWOT Analysis</SelectItem>
                <SelectItem value="ACH">ACH Analysis</SelectItem>
                <SelectItem value="DIME">DIME Analysis</SelectItem>
                <SelectItem value="COG">COG Analysis</SelectItem>
                <SelectItem value="PMESII-PT">PMESII-PT</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="grid gap-4">
        {filteredReports.map((report) => {
          const FrameworkIcon = getFrameworkIcon(report.framework)
          
          return (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Title and Framework */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <FrameworkIcon className="h-5 w-5 text-gray-600" />
                        <Link 
                          href={`/frameworks/${report.framework.toLowerCase()}/${report.id}`}
                          className="text-lg font-semibold hover:text-blue-600 transition-colors"
                        >
                          {report.title}
                        </Link>
                      </div>
                      <Badge className={frameworkColors[report.framework as keyof typeof frameworkColors]}>
                        {report.framework}
                      </Badge>
                      <Badge className={statusColors[report.status as keyof typeof statusColors]}>
                        {report.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 dark:text-gray-400">
                      {report.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {report.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Created {formatRelativeTime(report.created_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {report.view_count} views
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        {report.export_count} exports
                      </div>
                      <span>By {report.author}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/frameworks/${report.framework.toLowerCase()}/${report.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Export DOCX
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="h-4 w-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          Delete Report
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reports found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || filterFramework !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'Start creating framework analyses to see your reports here'
              }
            </p>
            {!searchTerm && filterFramework === 'all' && filterStatus === 'all' && (
              <Button asChild>
                <Link href="/frameworks">
                  <Target className="h-4 w-4 mr-2" />
                  Create Analysis
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}