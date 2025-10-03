import { useState } from 'react'
import { Plus, Filter, SortAsc, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MOMAssessmentCard } from './MOMAssessmentCard'
import type { MOMAssessment } from '@/types/entities'

interface MOMAssessmentListProps {
  assessments: MOMAssessment[]
  actorNames?: Record<string, string>
  eventNames?: Record<string, string>
  onEdit?: (assessment: MOMAssessment) => void
  onDelete?: (assessment: MOMAssessment) => void
  onCreateNew?: () => void
  compact?: boolean
  showFilters?: boolean
}

export function MOMAssessmentList({
  assessments,
  actorNames = {},
  eventNames = {},
  onEdit,
  onDelete,
  onCreateNew,
  compact = false,
  showFilters = true
}: MOMAssessmentListProps) {
  const [sortBy, setSortBy] = useState<'date' | 'risk' | 'scenario'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterRisk, setFilterRisk] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')

  const calculateRiskLevel = (assessment: MOMAssessment): 'critical' | 'high' | 'medium' | 'low' => {
    const avgScore = (assessment.motive + assessment.opportunity + assessment.means) / 3
    if (avgScore >= 4) return 'critical'
    if (avgScore >= 3) return 'high'
    if (avgScore >= 1.5) return 'medium'
    return 'low'
  }

  const calculateRiskScore = (assessment: MOMAssessment): number => {
    return (assessment.motive + assessment.opportunity + assessment.means) / 3
  }

  // Filter assessments
  let filteredAssessments = assessments
  if (filterRisk !== 'all') {
    filteredAssessments = assessments.filter(a => calculateRiskLevel(a) === filterRisk)
  }

  // Sort assessments
  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'date':
        comparison = new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime()
        break
      case 'risk':
        comparison = calculateRiskScore(a) - calculateRiskScore(b)
        break
      case 'scenario':
        comparison = a.scenario_description.localeCompare(b.scenario_description)
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  const toggleSortOrder = () => {
    setSortOrder(current => current === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      {showFilters && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="risk">Risk Level</SelectItem>
                <SelectItem value="scenario">Scenario</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={toggleSortOrder}>
              {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            <Select value={filterRisk} onValueChange={(v: any) => setFilterRisk(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {onCreateNew && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              New MOM Assessment
            </Button>
          )}
        </div>
      )}

      {/* Assessment count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {sortedAssessments.length} assessment{sortedAssessments.length !== 1 ? 's' : ''}
        {filterRisk !== 'all' && ` (filtered by ${filterRisk} risk)`}
      </div>

      {/* Assessments list */}
      {sortedAssessments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 mb-4">No MOM assessments found</p>
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Assessment
            </Button>
          )}
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {sortedAssessments.map((assessment) => (
            <MOMAssessmentCard
              key={assessment.id}
              assessment={assessment}
              actorName={actorNames[assessment.actor_id]}
              eventName={assessment.event_id ? eventNames[assessment.event_id] : undefined}
              onEdit={onEdit ? () => onEdit(assessment) : undefined}
              onDelete={onDelete ? () => onDelete(assessment) : undefined}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}
