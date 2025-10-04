import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, Trash2, Edit, FileText, Clock, CheckCircle2, AlertCircle, Grid3x3, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ACHAnalysis, AnalysisStatus } from '@/types/ach'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { ACHAnalysisForm, type ACHFormData } from '@/components/ach/ACHAnalysisForm'
import { frameworkDescriptions } from '@/config/framework-descriptions'

export function ACHPage() {
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<ACHAnalysis[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingAnalysis, setEditingAnalysis] = useState<ACHAnalysis | undefined>(undefined)

  const loadAnalyses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ach')
      if (response.ok) {
        const data = await response.json()
        setAnalyses(data.analyses || [])
      }
    } catch (error) {
      console.error('Failed to load ACH analyses:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalyses()
  }, [])

  const handleDeleteAnalysis = async (id: string) => {
    if (!confirm('Are you sure you want to delete this analysis? This will also delete all hypotheses, evidence links, and scores.')) return

    try {
      const response = await fetch(`/api/ach?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await loadAnalyses()
      }
    } catch (error) {
      console.error('Failed to delete analysis:', error)
      alert('Failed to delete analysis')
    }
  }

  const handleCreateAnalysis = () => {
    setFormMode('create')
    setEditingAnalysis(undefined)
    setFormOpen(true)
  }

  const handleEditAnalysis = async (id: string) => {
    try {
      const response = await fetch(`/api/ach?id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setFormMode('edit')
        setEditingAnalysis(data)
        setFormOpen(true)
      }
    } catch (error) {
      console.error('Failed to load analysis:', error)
      alert('Failed to load analysis')
    }
  }

  const handleSaveAnalysis = async (formData: ACHFormData) => {
    try {
      if (formMode === 'edit' && editingAnalysis?.id) {
        // Update existing analysis
        const response = await fetch(`/api/ach?id=${editingAnalysis.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            question: formData.question,
            analyst: formData.analyst,
            organization: formData.organization,
            scale_type: formData.scale_type,
            status: formData.status
          })
        })
        if (!response.ok) throw new Error('Failed to update analysis')

        // Update hypotheses
        // First, delete existing hypotheses that are not in the new list
        if (editingAnalysis.hypotheses) {
          for (const oldHyp of editingAnalysis.hypotheses) {
            const stillExists = formData.hypotheses.find(h => h.id === oldHyp.id)
            if (!stillExists) {
              await fetch(`/api/ach/hypotheses?id=${oldHyp.id}`, { method: 'DELETE' })
            }
          }
        }

        // Then, update or create hypotheses
        for (const hyp of formData.hypotheses) {
          if (hyp.id) {
            // Update existing
            await fetch(`/api/ach/hypotheses?id=${hyp.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(hyp)
            })
          } else {
            // Create new
            await fetch('/api/ach/hypotheses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...hyp,
                ach_analysis_id: editingAnalysis.id
              })
            })
          }
        }
      } else {
        // Create new analysis
        const response = await fetch('/api/ach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            question: formData.question,
            analyst: formData.analyst,
            organization: formData.organization,
            scale_type: formData.scale_type,
            status: formData.status
          })
        })
        if (!response.ok) throw new Error('Failed to create analysis')

        const newAnalysis = await response.json()

        // Create hypotheses
        for (const hyp of formData.hypotheses) {
          await fetch('/api/ach/hypotheses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...hyp,
              ach_analysis_id: newAnalysis.id
            })
          })
        }

        // Navigate to the new analysis
        navigate(`/dashboard/tools/ach/${newAnalysis.id}`)
      }

      await loadAnalyses()
      setFormOpen(false)
      setEditingAnalysis(undefined)
    } catch (error) {
      console.error('Error saving analysis:', error)
      throw error
    }
  }

  const handleOpenAnalysis = (id: string) => {
    navigate(`/dashboard/tools/ach/${id}`)
  }

  const filteredAnalyses = analyses.filter(analysis => {
    const matchesSearch = analysis.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         analysis.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         analysis.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: AnalysisStatus) => {
    switch (status) {
      case 'completed': return CheckCircle2
      case 'in_progress': return Clock
      case 'draft': return FileText
      default: return FileText
    }
  }

  const getStatusColor = (status: AnalysisStatus) => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400'
      case 'in_progress': return 'text-blue-600 dark:text-blue-400'
      case 'draft': return 'text-gray-600 dark:text-gray-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const statistics = {
    total: analyses.length,
    draft: analyses.filter(a => a.status === 'draft').length,
    in_progress: analyses.filter(a => a.status === 'in_progress').length,
    completed: analyses.filter(a => a.status === 'completed').length
  }

  const frameworkInfo = frameworkDescriptions['ach']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACH Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis of Competing Hypotheses - Structured intelligence methodology
          </p>
        </div>
        <Button onClick={handleCreateAnalysis}>
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Framework Context */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">{frameworkInfo.context}</p>

            {frameworkInfo.wikipediaUrl && (
              <a
                href={frameworkInfo.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Learn more on Wikipedia
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Good Use Cases
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {frameworkInfo.goodUseCases.map((useCase, idx) => (
                    <li key={idx}>{useCase}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Not Ideal For
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {frameworkInfo.notIdealFor.map((useCase, idx) => (
                    <li key={idx}>{useCase}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Analyses</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.total}</p>
              </div>
              <Grid3x3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Draft</p>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{statistics.draft}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{statistics.in_progress}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{statistics.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search analyses..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AnalysisStatus | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Analysis List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading analyses...</p>
          </Card>
        ) : filteredAnalyses.length === 0 ? (
          <Card className="p-12 text-center">
            <Grid3x3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No Analyses Found
            </h3>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
              {analyses.length === 0
                ? "Start your intelligence analysis by creating your first ACH matrix."
                : "Try adjusting your search criteria or filters."
              }
            </p>
            <Button onClick={handleCreateAnalysis}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Analysis
            </Button>
          </Card>
        ) : (
          filteredAnalyses.map((analysis) => {
            const StatusIcon = getStatusIcon(analysis.status)
            const statusColor = getStatusColor(analysis.status)

            return (
              <Card
                key={analysis.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleOpenAnalysis(analysis.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <Grid3x3 className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                            {analysis.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            <StatusIcon className={cn("h-3 w-3 mr-1", statusColor)} />
                            {analysis.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {analysis.scale_type}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {analysis.question}
                        </p>

                        {analysis.description && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                            {analysis.description}
                          </p>
                        )}

                        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                          {analysis.hypotheses && (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-4 w-4" />
                              <span>{analysis.hypotheses.length} hypotheses</span>
                            </div>
                          )}
                          {analysis.evidence && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              <span>{analysis.evidence.length} evidence</span>
                            </div>
                          )}
                          {analysis.analyst && (
                            <div>
                              Analyst: {analysis.analyst}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleOpenAnalysis(analysis.id)
                        }}>
                          <Grid3x3 className="h-4 w-4 mr-2" />
                          Open Matrix
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          handleEditAnalysis(analysis.id)
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAnalysis(analysis.id)
                          }}
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

      {/* Analysis Form Modal */}
      <ACHAnalysisForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingAnalysis(undefined)
        }}
        onSave={handleSaveAnalysis}
        initialData={editingAnalysis}
        mode={formMode}
      />
    </div>
  )
}
