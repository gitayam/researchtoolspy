import { Edit, Trash2, AlertTriangle, Calendar, User, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { MOMAssessment } from '@/types/entities'

interface MOMAssessmentCardProps {
  assessment: MOMAssessment
  actorName?: string
  eventName?: string
  onEdit?: () => void
  onDelete?: () => void
  compact?: boolean
}

export function MOMAssessmentCard({
  assessment,
  actorName,
  eventName,
  onEdit,
  onDelete,
  compact = false
}: MOMAssessmentCardProps) {

  const calculateOverallRisk = () => {
    const avgScore = (assessment.motive + assessment.opportunity + assessment.means) / 3
    const percentage = (avgScore / 5) * 100

    if (avgScore >= 4) {
      return { level: 'CRITICAL', percentage, color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-800' }
    } else if (avgScore >= 3) {
      return { level: 'HIGH', percentage, color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800' }
    } else if (avgScore >= 1.5) {
      return { level: 'MEDIUM', percentage, color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' }
    } else {
      return { level: 'LOW', percentage, color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800' }
    }
  }

  const risk = calculateOverallRisk()

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'bg-red-500'
    if (score >= 3) return 'bg-orange-500'
    if (score >= 2) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base">{assessment.scenario_description}</CardTitle>
              {(actorName || eventName) && (
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  {actorName && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {actorName}
                    </span>
                  )}
                  {eventName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {eventName}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Badge className={`${risk.bgColor} ${risk.textColor} ml-2`}>
              {risk.level}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Motive</div>
              <div className="font-semibold">{assessment.motive}/5</div>
            </div>
            <div>
              <div className="text-gray-500">Opportunity</div>
              <div className="font-semibold">{assessment.opportunity}/5</div>
            </div>
            <div>
              <div className="text-gray-500">Means</div>
              <div className="font-semibold">{assessment.means}/5</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(assessment.assessed_at).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{assessment.scenario_description}</CardTitle>
              {assessment.event_id && (
                <Badge variant="outline" className="text-xs">
                  Event Linked
                </Badge>
              )}
            </div>
            {(actorName || eventName) && (
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                {actorName && (
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {actorName}
                  </span>
                )}
                {eventName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {eventName}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${risk.bgColor} ${risk.textColor}`}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {risk.level} RISK
            </Badge>
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* MOM Scores */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">Motive</span>
              <span className="text-sm text-gray-600">{assessment.motive}/5</span>
            </div>
            <Progress
              value={(assessment.motive / 5) * 100}
              className={`h-2 ${getScoreColor(assessment.motive)}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">Opportunity</span>
              <span className="text-sm text-gray-600">{assessment.opportunity}/5</span>
            </div>
            <Progress
              value={(assessment.opportunity / 5) * 100}
              className={`h-2 ${getScoreColor(assessment.opportunity)}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">Means</span>
              <span className="text-sm text-gray-600">{assessment.means}/5</span>
            </div>
            <Progress
              value={(assessment.means / 5) * 100}
              className={`h-2 ${getScoreColor(assessment.means)}`}
            />
          </div>
        </div>

        {/* Overall Risk */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Overall Risk</span>
            <span className="text-sm text-gray-600">{risk.percentage.toFixed(0)}%</span>
          </div>
          <Progress value={risk.percentage} className="h-3" />
        </div>

        {/* Notes */}
        {assessment.notes && (
          <div className="pt-3 border-t">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Assessment Notes
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {assessment.notes}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-3 border-t text-xs text-gray-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Assessed: {new Date(assessment.assessed_at).toLocaleDateString()}
          </span>
          <span>
            Updated: {new Date(assessment.updated_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
