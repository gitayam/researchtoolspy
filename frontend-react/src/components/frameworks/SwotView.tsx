import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Network, Database, CheckCircle, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExportButton } from '@/components/reports/ExportButton'
import { CommentThread } from '@/components/comments/CommentThread'
import { SwotInsights } from './SwotInsights'
import { ShareButton } from './ShareButton'

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: 'low' | 'medium' | 'high'
  tags?: string[]
  appliesTo?: string[]  // Which option(s) this item applies to
}

interface SwotData {
  id: string
  title: string
  description: string
  goal?: string  // Overall goal or decision being made
  options?: string[]  // Options being considered
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  created_at?: string
  updated_at?: string
  is_public?: boolean
  share_token?: string
  tags?: string[]
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

              return (
                <li
                  key={item.id}
                  className={`p-3 rounded-lg ${bgColor} text-sm space-y-2`}
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
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {evidenceCount}
                        </Badge>
                      )}
                      {item.confidence === 'high' && (
                        <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          High
                        </Badge>
                      )}
                      {item.confidence === 'medium' && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          Medium
                        </Badge>
                      )}
                      {item.confidence === 'low' && (
                        <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                          Low
                        </Badge>
                      )}
                      {!hasEvidence && !item.confidence && (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          No evidence
                        </Badge>
                      )}
                    </div>
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      {item.tags.map((tagIdx, idx) => (
                        <Badge
                          key={idx}
                          className="text-xs px-2.5 py-0.5 font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                        >
                          🏷️ {tagIdx}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {item.appliesTo && item.appliesTo.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Applies to:</span>
                      {item.appliesTo.map((option, idx) => (
                        <Badge
                          key={idx}
                          className="text-xs px-2.5 py-0.5 font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700"
                        >
                          ✓ {option}
                        </Badge>
                      ))}
                    </div>
                  )}
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
            {data.goal && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">🎯 Goal: </span>
                <span className="text-sm text-blue-800 dark:text-blue-300">{data.goal}</span>
              </div>
            )}
            {data.options && data.options.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 mr-1">Options Considered:</span>
                {data.options.map((option, idx) => (
                  <Badge
                    key={idx}
                    className="text-sm px-3 py-1 font-medium bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200 shadow-sm"
                  >
                    ✓ {option}
                  </Badge>
                ))}
              </div>
            )}
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 mr-1">Tags:</span>
                {data.tags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    className="text-sm px-3 py-1 font-medium bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 shadow-sm"
                  >
                    <Tag className="h-3.5 w-3.5 mr-1.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
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
          <ShareButton
            frameworkId={data.id}
            frameworkType="swot"
            isPublic={data.is_public || false}
            shareToken={data.share_token}
          />
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
        goal={data.goal}
        options={data.options}
      />

      {/* Comments Section */}
      <CommentThread
        entityType="framework"
        entityId={data.id}
      />
    </div>
  )
}
