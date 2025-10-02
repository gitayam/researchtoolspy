import { useState, useEffect } from 'react'
import { Plus, Search, Upload, Tag, Clock, Shield, Globe, FileText, Link as LinkIcon, Image, Video, Music, MessageSquare, Mail, FileBarChart, MoreHorizontal, Trash2, Edit, Copy, Archive, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Dataset, DatasetFilter, DatasetStatistics } from '@/types/dataset'
import { DatasetType, DatasetStatus, CredibilityLevel } from '@/types/dataset'
import { cn } from '@/lib/utils'
import { DatasetForm } from '@/components/datasets/DatasetForm'

// Mock data - will be replaced with API calls
const mockDataset: Dataset[] = []

export function DatasetPage() {
  const [dataset, setDataset] = useState<Dataset[]>(mockDataset)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [filter, setFilter] = useState<DatasetFilter>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingDataset, setEditingDataset] = useState<any>(null)

  const loadDataset = async () => {
    try {
      const response = await fetch('/api/dataset')
      if (response.ok) {
        const data = await response.json()
        setDataset(data.dataset || [])
      }
    } catch (error) {
      console.error('Failed to load dataset:', error)
    }
  }

  useEffect(() => {
    loadDataset()
  }, [])

  const handleSaveDataset = async (data: any) => {
    try {
      const payload = {
        title: data.title,
        description: data.description,
        type: data.type,
        source_type: data.type,
        source_name: data.source,
        source_url: data.url || null,
        reliability: data.reliability || 'F',
        credibility: data.credibility || '6',
        tags: JSON.stringify(data.tags || []),
        status: 'pending'
      }

      if (formMode === 'edit' && editingDataset?.id) {
        const response = await fetch(`/api/dataset?id=${editingDataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!response.ok) throw new Error('Failed to update dataset')
      } else {
        const response = await fetch('/api/dataset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!response.ok) throw new Error('Failed to create dataset')
      }

      await loadDataset()
      setFormOpen(false)
      setEditingDataset(null)
    } catch (error) {
      console.error('Error saving dataset:', error)
      throw error
    }
  }

  const handleDeleteDataset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return

    try {
      const response = await fetch(`/api/dataset?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await loadDataset()
      }
    } catch (error) {
      console.error('Failed to delete dataset:', error)
      alert('Failed to delete dataset')
    }
  }

  const openCreateForm = () => {
    setFormMode('create')
    setEditingDataset(null)
    setFormOpen(true)
  }

  const openEditForm = (dataset: any) => {
    setFormMode('edit')
    setEditingDataset(dataset)
    setFormOpen(true)
  }

  const filteredDataset = dataset.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesType = !filter.type || item.type === filter.type
    const matchesStatus = !filter.status || item.status === filter.status
    const matchesCredibility = !filter.credibility || item.source.credibility === filter.credibility

    return matchesSearch && matchesType && matchesStatus && matchesCredibility
  })

  const getTypeIcon = (type: DatasetType) => {
    switch (type) {
      case DatasetType.DOCUMENT: return FileText
      case DatasetType.WEB_PAGE: return Globe
      case DatasetType.IMAGE: return Image
      case DatasetType.VIDEO: return Video
      case DatasetType.AUDIO: return Music
      case DatasetType.SOCIAL_MEDIA: return MessageSquare
      case DatasetType.EMAIL: return Mail
      case DatasetType.DATABASE: return FileBarChart
      case DatasetType.API: return LinkIcon
      case DatasetType.GOVERNMENT: return Shield
      default: return FileText
    }
  }

  const getStatusIcon = (status: DatasetStatus) => {
    switch (status) {
      case DatasetStatus.VERIFIED: return CheckCircle2
      case DatasetStatus.PENDING: return Clock
      case DatasetStatus.REJECTED: return XCircle
      case DatasetStatus.NEEDS_REVIEW: return AlertCircle
      default: return Clock
    }
  }

  const statistics: DatasetStatistics = {
    total: dataset.length,
    verified: dataset.filter(e => e.status === DatasetStatus.VERIFIED).length,
    pending: dataset.filter(e => e.status === DatasetStatus.PENDING).length,
    rejected: dataset.filter(e => e.status === DatasetStatus.REJECTED).length,
    by_type: Object.values(DatasetType).reduce((acc, type) => {
      acc[type] = dataset.filter(e => e.type === type).length
      return acc
    }, {} as Record<DatasetType, number>),
    by_credibility: Object.values(CredibilityLevel).reduce((acc, level) => {
      acc[level] = dataset.filter(e => e.source.credibility === level).length
      return acc
    }, {} as Record<CredibilityLevel, number>)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dataset Collector</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and organize dataset for your research analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              console.log('Import button clicked')
              alert('Import feature coming soon!')
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Dataset
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Dataset</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.total}</p>
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
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{statistics.verified}</p>
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
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{statistics.pending}</p>
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
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{statistics.rejected}</p>
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
            placeholder="Search dataset..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filter.type || 'all'} onValueChange={(value) => setFilter({ ...filter, type: value === 'all' ? undefined : value as DatasetType })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.values(DatasetType).map(type => (
              <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.status || 'all'} onValueChange={(value) => setFilter({ ...filter, status: value === 'all' ? undefined : value as DatasetStatus })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(DatasetStatus).map(status => (
              <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dataset List */}
      <div className="space-y-4">
        {filteredDataset.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No Dataset Found
            </h3>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
              {dataset.length === 0
                ? "Start building your dataset collection by adding your first piece of dataset."
                : "Try adjusting your search criteria or filters."
              }
            </p>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Dataset
            </Button>
          </Card>
        ) : (
          filteredDataset.map((item) => {
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
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{item.title}</h3>
                          <StatusIcon className={cn(
                            "h-4 w-4",
                            item.status === DatasetStatus.VERIFIED && "text-green-500",
                            item.status === DatasetStatus.PENDING && "text-yellow-500",
                            item.status === DatasetStatus.REJECTED && "text-red-500",
                            item.status === DatasetStatus.NEEDS_REVIEW && "text-orange-500"
                          )} />
                        </div>
                        {item.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-500 mb-3">
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
                        <DropdownMenuItem onClick={() => openEditForm(item)}>
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
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteDataset(item.id)}
                        >
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

      {/* Dataset Form Modal */}
      <DatasetForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingDataset(null)
        }}
        onSave={handleSaveDataset}
        initialData={editingDataset}
        mode={formMode}
      />
    </div>
  )
}
