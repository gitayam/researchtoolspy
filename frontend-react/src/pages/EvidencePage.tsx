import { useState, useEffect } from 'react'
import { Plus, Search, Tag, Clock, FileText, MoreHorizontal, Trash2, Edit, Archive, CheckCircle2, XCircle, AlertCircle, Target, TrendingUp, Zap, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { EvidenceItem, EvidenceFilter, EvidenceStatistics } from '@/types/evidence'
import { EvidenceType, EvidenceStatus, EvidenceLevel, PriorityLevel } from '@/types/evidence'
import { cn } from '@/lib/utils'
import { EvidenceItemForm } from '@/components/evidence/EvidenceItemForm'
import { evidenceToCitation } from '@/utils/evidence-to-citation'
import { addCitation } from '@/utils/citation-library'
import { useTranslation } from 'react-i18next'

export function EvidencePage() {
  const { t } = useTranslation()
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [filter, setFilter] = useState<EvidenceFilter>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingEvidence, setEditingEvidence] = useState<any>(null)

  const loadEvidence = async () => {
    try {
      const response = await fetch('/api/evidence-items')
      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    }
  }

  useEffect(() => {
    loadEvidence()
  }, [])

  const handleSaveEvidence = async (data: any) => {
    try {
      if (formMode === 'edit' && editingEvidence?.id) {
        const response = await fetch(`/api/evidence-items?id=${editingEvidence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        if (!response.ok) throw new Error('Failed to update evidence')
      } else {
        const response = await fetch('/api/evidence-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        if (!response.ok) throw new Error('Failed to create evidence')
      }

      await loadEvidence()
      setFormOpen(false)
      setEditingEvidence(null)
    } catch (error) {
      console.error('Error saving evidence:', error)
      throw error
    }
  }

  const handleDeleteEvidence = async (id: number) => {
    if (!confirm(t('evidence.confirmDelete'))) return

    try {
      const response = await fetch(`/api/evidence-items?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await loadEvidence()
      }
    } catch (error) {
      console.error('Failed to delete evidence:', error)
      alert(t('evidence.deleteError'))
    }
  }

  const openCreateForm = () => {
    setFormMode('create')
    setEditingEvidence(null)
    setFormOpen(true)
  }

  const openEditForm = (evidence: any) => {
    setFormMode('edit')
    setEditingEvidence(evidence)
    setFormOpen(true)
  }

  const handleGenerateCitation = (item: EvidenceItem) => {
    try {
      const citation = evidenceToCitation(item, 'apa')
      addCitation(citation)
      alert(t('evidence.citationSuccess'))
    } catch (error) {
      console.error('Failed to generate citation:', error)
      alert(t('evidence.citationError'))
    }
  }

  const filteredEvidence = evidence.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.who?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.what?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesType = !filter.type || item.evidence_type === filter.type
    const matchesLevel = !filter.level || item.evidence_level === filter.level
    const matchesStatus = !filter.status || item.status === filter.status
    const matchesPriority = !filter.priority || item.priority === filter.priority

    return matchesSearch && matchesType && matchesLevel && matchesStatus && matchesPriority
  })

  const getLevelIcon = (level: EvidenceLevel) => {
    switch (level) {
      case 'tactical': return Target
      case 'operational': return TrendingUp
      case 'strategic': return Zap
      default: return Target
    }
  }

  const getStatusIcon = (status: EvidenceStatus) => {
    switch (status) {
      case 'verified': return CheckCircle2
      case 'pending': return Clock
      case 'rejected': return XCircle
      case 'needs_review': return AlertCircle
      default: return Clock
    }
  }

  const statistics: EvidenceStatistics = {
    total: evidence.length,
    verified: evidence.filter(e => e.status === 'verified').length,
    pending: evidence.filter(e => e.status === 'pending').length,
    rejected: evidence.filter(e => e.status === 'rejected').length,
    by_type: Object.values(EvidenceType).reduce((acc, type) => {
      acc[type] = evidence.filter(e => e.evidence_type === type).length
      return acc
    }, {} as Record<EvidenceType, number>),
    by_level: Object.values(EvidenceLevel).reduce((acc, level) => {
      acc[level] = evidence.filter(e => e.evidence_level === level).length
      return acc
    }, {} as Record<EvidenceLevel, number>),
    by_priority: Object.values(PriorityLevel).reduce((acc, priority) => {
      acc[priority] = evidence.filter(e => e.priority === priority).length
      return acc
    }, {} as Record<PriorityLevel, number>)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('evidence.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('evidence.subtitle')}
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          {t('evidence.addEvidence')}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('evidence.totalEvidence')}</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('evidence.verified')}</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('evidence.pending')}</p>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('evidence.rejected')}</p>
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
            placeholder={t('evidence.searchPlaceholder')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filter.level || 'all'} onValueChange={(value) => setFilter({ ...filter, level: value === 'all' ? undefined : value as EvidenceLevel })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('evidence.filterByLevel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('evidence.allLevels')}</SelectItem>
            {Object.values(EvidenceLevel).map(level => (
              <SelectItem key={level} value={level}>{level.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.priority || 'all'} onValueChange={(value) => setFilter({ ...filter, priority: value === 'all' ? undefined : value as PriorityLevel })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('evidence.filterByPriority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('evidence.allPriorities')}</SelectItem>
            {Object.values(PriorityLevel).map(priority => (
              <SelectItem key={priority} value={priority}>{priority.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.status || 'all'} onValueChange={(value) => setFilter({ ...filter, status: value === 'all' ? undefined : value as EvidenceStatus })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('evidence.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('evidence.allStatuses')}</SelectItem>
            {Object.values(EvidenceStatus).map(status => (
              <SelectItem key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</SelectItem>
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
              {t('evidence.noEvidenceFound')}
            </h3>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
              {evidence.length === 0
                ? t('evidence.emptyStateMessage')
                : t('evidence.emptyFilterMessage')
              }
            </p>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              {t('evidence.addFirstEvidence')}
            </Button>
          </Card>
        ) : (
          filteredEvidence.map((item) => {
            const LevelIcon = getLevelIcon(item.evidence_level)
            const StatusIcon = getStatusIcon(item.status)

            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <LevelIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{item.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {item.evidence_level}
                          </Badge>
                          <Badge variant={item.priority === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                            {item.priority}
                          </Badge>
                          <StatusIcon className={cn(
                            "h-4 w-4",
                            item.status === 'verified' && "text-green-500",
                            item.status === 'pending' && "text-yellow-500",
                            item.status === 'rejected' && "text-red-500",
                            item.status === 'needs_review' && "text-orange-500"
                          )} />
                        </div>
                        {item.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3">{item.description}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mb-3">
                          {item.who && <div><span className="font-medium">{t('evidence.who')}</span> {item.who}</div>}
                          {item.what && <div><span className="font-medium">{t('evidence.what')}</span> {item.what}</div>}
                          {item.when_occurred && <div><span className="font-medium">{t('evidence.when')}</span> {item.when_occurred}</div>}
                          {item.where_location && <div><span className="font-medium">{t('evidence.where')}</span> {item.where_location}</div>}
                          {item.why_purpose && <div><span className="font-medium">{t('evidence.why')}</span> {item.why_purpose}</div>}
                          {item.how_method && <div><span className="font-medium">{t('evidence.how')}</span> {item.how_method}</div>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
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
                          {t('evidence.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGenerateCitation(item)}>
                          <BookOpen className="h-4 w-4 mr-2" />
                          {t('evidence.generateCitation')}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          {t('evidence.archive')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteEvidence(item.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('evidence.delete')}
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

      {/* Evidence Form Modal */}
      <EvidenceItemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingEvidence(null)
        }}
        onSave={handleSaveEvidence}
        initialData={editingEvidence}
        mode={formMode}
      />
    </div>
  )
}
