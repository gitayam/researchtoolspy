import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Network, Database, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExportButton } from '@/components/reports/ExportButton'
import { CommentThread } from '@/components/comments/CommentThread'
import { SwotInsights } from './SwotInsights'

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: number
}

interface SwotData {
  id: string
  title: string
  description: string
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  created_at?: string
  updated_at?: string
}

interface SwotViewProps {
  data: SwotData
  onEdit: () => void
  onDelete: () => void
}

export function SwotView({ data, onEdit, onDelete }: SwotViewProps) {
  const navigate = useNavigate()

  const QuadrantView = ({
    title,
    items,
    color,
    bgColor,
    icon
  }: {
    title: string
    items: SwotItem[]
    color: string
    bgColor: string
    icon: string
  }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          {title}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No {title.toLowerCase()} identified
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => {
              const evidenceCount = item.evidence_ids?.length || 0
              const hasEvidence = evidenceCount > 0
              const confidence = item.confidence || (hasEvidence ? 50 + (evidenceCount * 10) : 0)

              return (
                <li
                  key={item.id}
                  className={`p-3 rounded-lg ${bgColor} text-sm`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {index + 1}.
                      </span>{' '}
                      {item.text}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasEvidence && (
                        <>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {evidenceCount}
                          </Badge>
                          {confidence >= 75 && (
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {confidence}%
                            </Badge>
                          )}
                          {confidence >= 50 && confidence < 75 && (
                            <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                              {confidence}%
                            </Badge>
                          )}
                        </>
                      )}
                      {!hasEvidence && (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          No evidence
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/analysis-frameworks/swot-dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.title}
            </h1>
            {data.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {data.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Extract any entity IDs that might be in SWOT data
              const entityIds: string[] = []

              // Helper to extract entity IDs from text (looks for patterns like actor_xxx, source_xxx, event_xxx)
              const extractEntityIds = (text: string) => {
                const matches = text.match(/(actor|source|event|place)_[a-zA-Z0-9]+/g)
                if (matches) {
                  entityIds.push(...matches)
                }
              }

              // Check all SWOT sections
              ;[...data.strengths, ...data.weaknesses, ...data.opportunities, ...data.threats].forEach(item => {
                extractEntityIds(item.text)
              })

              // Remove duplicates
              const uniqueEntityIds = [...new Set(entityIds)]

              navigate('/dashboard/network-graph', {
                state: {
                  highlightEntities: uniqueEntityIds,
                  source: 'swot',
                  title: data.title
                }
              })
            }}
          >
            <Network className="h-4 w-4 mr-2" />
            View in Network
          </Button>
          <ExportButton
            frameworkType="swot"
            frameworkTitle="SWOT Analysis"
            data={data}
            analysisId={data.id}
          />
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metadata */}
      {(data.created_at || data.updated_at) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
              {data.created_at && (
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(data.created_at).toLocaleDateString()}
                </div>
              )}
              {data.updated_at && (
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {new Date(data.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {data.strengths.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Strengths
              </div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {data.weaknesses.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Weaknesses
              </div>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {data.opportunities.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Opportunities
              </div>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {data.threats.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Threats
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SWOT Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuadrantView
          title="Strengths"
          items={data.strengths}
          color="border-green-500"
          bgColor="bg-green-50 dark:bg-green-900/20"
          icon="💪"
        />
        <QuadrantView
          title="Weaknesses"
          items={data.weaknesses}
          color="border-red-500"
          bgColor="bg-red-50 dark:bg-red-900/20"
          icon="⚠️"
        />
        <QuadrantView
          title="Opportunities"
          items={data.opportunities}
          color="border-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          icon="🎯"
        />
        <QuadrantView
          title="Threats"
          items={data.threats}
          color="border-orange-500"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
          icon="⚡"
        />
      </div>

      {/* Strategic Insights & TOWS Analysis */}
      <SwotInsights
        strengths={data.strengths}
        weaknesses={data.weaknesses}
        opportunities={data.opportunities}
        threats={data.threats}
      />

      {/* Comments Section */}
      <CommentThread
        entityType="framework"
        entityId={data.id}
      />
    </div>
  )
}
