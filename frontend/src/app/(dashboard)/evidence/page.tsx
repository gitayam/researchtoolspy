'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Upload, Download, Tag, Clock, Shield, Globe, FileText, Link, Image, Video, Music, MessageSquare, Mail, FileBarChart, MoreHorizontal, Trash2, Edit, Copy, Archive, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Evidence, EvidenceType, EvidenceStatus, CredibilityLevel, EvidenceFilter, EvidenceStatistics } from '@/types/evidence'
import { cn } from '@/lib/utils'

// Empty evidence array - will be populated from API
const mockEvidence: Evidence[] = []

const credibilityColors = {
  [CredibilityLevel.VERY_HIGH]: 'bg-green-500',
  [CredibilityLevel.HIGH]: 'bg-blue-500',
  [CredibilityLevel.MEDIUM]: 'bg-yellow-500',
  [CredibilityLevel.LOW]: 'bg-orange-500',
  [CredibilityLevel.VERY_LOW]: 'bg-red-500',
  [CredibilityLevel.UNKNOWN]: 'bg-gray-400'
}

export default function EvidenceCollectorPage() {
  const [evidence, setEvidence] = useState<Evidence[]>(mockEvidence)
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [filter, setFilter] = useState<EvidenceFilter>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('list')

  // TODO: Replace with actual API calls
  const loadEvidence = async () => {
    // Placeholder for API integration
  }

  useEffect(() => {
    loadEvidence()
  }, [])

  const filteredEvidence = evidence.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesType = !filter.type || item.type === filter.type
    const matchesStatus = !filter.status || item.status === filter.status
    const matchesCredibility = !filter.credibility || item.source.credibility === filter.credibility
    
    return matchesSearch && matchesType && matchesStatus && matchesCredibility
  })

  const getTypeIcon = (type: EvidenceType) => {
    switch (type) {
      case EvidenceType.DOCUMENT: return FileText
      case EvidenceType.WEB_PAGE: return Globe
      case EvidenceType.IMAGE: return Image
      case EvidenceType.VIDEO: return Video
      case EvidenceType.AUDIO: return Music
      case EvidenceType.SOCIAL_MEDIA: return MessageSquare
      case EvidenceType.EMAIL: return Mail
      case EvidenceType.DATABASE: return FileBarChart
      case EvidenceType.API: return Link
      case EvidenceType.GOVERNMENT: return Shield
      default: return FileText
    }
  }

  const getStatusIcon = (status: EvidenceStatus) => {
    switch (status) {
      case EvidenceStatus.VERIFIED: return CheckCircle2
      case EvidenceStatus.PENDING: return Clock
      case EvidenceStatus.REJECTED: return XCircle
      case EvidenceStatus.NEEDS_REVIEW: return AlertCircle
      default: return Clock
    }
  }

  const statistics: EvidenceStatistics = {
    total: evidence.length,
    verified: evidence.filter(e => e.status === EvidenceStatus.VERIFIED).length,
    pending: evidence.filter(e => e.status === EvidenceStatus.PENDING).length,
    rejected: evidence.filter(e => e.status === EvidenceStatus.REJECTED).length,
    by_type: Object.values(EvidenceType).reduce((acc, type) => {
      acc[type] = evidence.filter(e => e.type === type).length
      return acc
    }, {} as Record<EvidenceType, number>),
    by_credibility: Object.values(CredibilityLevel).reduce((acc, level) => {
      acc[level] = evidence.filter(e => e.source.credibility === level).length
      return acc
    }, {} as Record<CredibilityLevel, number>)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evidence Collector</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and organize evidence for your research analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Evidence
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Evidence</p>
                <p className="text-2xl font-bold">{statistics.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Verified</p>
                <p className="text-2xl font-bold text-green-600">{statistics.verified}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{statistics.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search evidence..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filter.type || 'all'} onValueChange={(value) => setFilter({ ...filter, type: value === 'all' ? undefined : value as EvidenceType })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.values(EvidenceType).map(type => (
              <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.status || 'all'} onValueChange={(value) => setFilter({ ...filter, status: value === 'all' ? undefined : value as EvidenceStatus })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(EvidenceStatus).map(status => (
              <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Evidence List */}
      <div className="space-y-4">
        {filteredEvidence.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No Evidence Found
            </h3>
            <p className="text-gray-500 mb-4">
              {evidence.length === 0 
                ? "Start building your evidence collection by adding your first piece of evidence."
                : "Try adjusting your search criteria or filters."
              }
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Evidence
            </Button>
          </Card>
        ) : (
          filteredEvidence.map((item) => {
            const TypeIcon = getTypeIcon(item.type)
            const StatusIcon = getStatusIcon(item.status)
            
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{item.title}</h3>
                          <StatusIcon className={cn(
                            "h-4 w-4",
                            item.status === EvidenceStatus.VERIFIED && "text-green-500",
                            item.status === EvidenceStatus.PENDING && "text-yellow-500",
                            item.status === EvidenceStatus.REJECTED && "text-red-500",
                            item.status === EvidenceStatus.NEEDS_REVIEW && "text-orange-500"
                          )} />
                        </div>
                        {item.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <span>Source: {item.source.name}</span>
                          <span>•</span>
                          <span>Updated {new Date(item.updated_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          {item.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}