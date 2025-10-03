import { useState } from 'react'
import { X, ChevronDown, ChevronRight, FileText, Users, Database, Calendar, ExternalLink, Trash2, Edit3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { LinkedEvidence, EvidenceEntityType, EvidenceLinkRelation } from '@/types/framework-evidence'
import type { EvidenceItem } from '@/types/evidence'

interface EvidencePanelProps {
  linkedEvidence: LinkedEvidence[]
  onUnlink: (entity_type: EvidenceEntityType, entity_id: string | number) => void
  onUpdateNotes?: (link_id: string, notes: string) => void
  onClose?: () => void
  title?: string
}

export function EvidencePanel({
  linkedEvidence,
  onUnlink,
  onUpdateNotes,
  onClose,
  title = 'Linked Evidence'
}: EvidencePanelProps) {
  const [selectedTab, setSelectedTab] = useState<EvidenceEntityType | 'all'>('all')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingNotes, setEditingNotes] = useState<string | null>(null)

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const filterByType = (evidence: LinkedEvidence[]) => {
    if (selectedTab === 'all') return evidence
    return evidence.filter(e => e.entity_type === selectedTab)
  }

  const getRelationBadge = (relation?: EvidenceLinkRelation) => {
    if (!relation) return null

    const styles = {
      supports: 'bg-green-100 text-green-800',
      contradicts: 'bg-red-100 text-red-800',
      neutral: 'bg-gray-100 text-gray-800',
      contextual: 'bg-blue-100 text-blue-800',
      referenced: 'bg-purple-100 text-purple-800'
    }

    return (
      <Badge className={styles[relation] || ''} variant="outline">
        {relation}
      </Badge>
    )
  }

  const getRiskBadge = (item: any) => {
    // EVE assessment (Data)
    if (item.eve_assessment?.overall_risk) {
      const risk = item.eve_assessment.overall_risk
      const colors = {
        LOW: 'bg-green-100 text-green-800',
        MEDIUM: 'bg-yellow-100 text-yellow-800',
        HIGH: 'bg-orange-100 text-orange-800',
        CRITICAL: 'bg-red-100 text-red-800'
      }
      return <Badge className={colors[risk]}>{risk}</Badge>
    }

    // MOM-POP (Actors)
    if (item.deception_profile?.mom) {
      const { motive, opportunity, means } = item.deception_profile.mom
      const avg = ((motive || 0) + (opportunity || 0) + (means || 0)) / 3
      if (avg >= 4) return <Badge className="bg-red-100 text-red-800">High Risk</Badge>
      if (avg >= 3) return <Badge className="bg-orange-100 text-orange-800">Med Risk</Badge>
      if (avg >= 1.5) return <Badge className="bg-yellow-100 text-yellow-800">Low Risk</Badge>
    }

    // MOSES (Sources)
    if (item.moses_assessment?.reliability) {
      const rel = item.moses_assessment.reliability
      return <Badge variant="outline">Rel: {rel}</Badge>
    }

    return null
  }

  const getItemKey = (link: LinkedEvidence) => `${link.entity_type}-${link.entity_id}`

  const renderEvidenceCard = (link: LinkedEvidence) => {
    const item = link.entity_data as any
    const itemKey = getItemKey(link)
    const isExpanded = expandedItems.has(itemKey)

    const getIcon = () => {
      const icons = {
        data: FileText,
        actor: Users,
        source: Database,
        event: Calendar
      }
      const Icon = icons[link.entity_type]
      return <Icon className="h-4 w-4" />
    }

    const getTitle = () => {
      if ('title' in item) return item.title
      if ('name' in item) return item.name
      return 'Untitled'
    }

    const getTypeBadge = () => {
      if (link.entity_type === 'data') return item.evidence_type
      if (link.entity_type === 'actor') return item.type
      if (link.entity_type === 'source') return item.type
      if (link.entity_type === 'event') return item.event_type
      return link.entity_type
    }

    return (
      <Card key={itemKey} className="mb-3">
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => toggleExpanded(itemKey)}
              className="flex-1 flex items-start gap-2 text-left hover:opacity-70"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getIcon()}
                  <span className="font-semibold text-sm truncate">{getTitle()}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{getTypeBadge()}</Badge>
                  {getRelationBadge(link.relation)}
                  {getRiskBadge(item)}
                </div>
              </div>
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUnlink(link.entity_type, link.entity_id)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="p-4 pt-0 space-y-3 border-t">
            {item.description && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Description</div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{item.description}</p>
              </div>
            )}

            {/* Data-specific fields */}
            {link.entity_type === 'data' && item.what && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">What</div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{item.what}</p>
              </div>
            )}

            {/* Actor-specific fields */}
            {link.entity_type === 'actor' && item.affiliation && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Affiliation</div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{item.affiliation}</p>
              </div>
            )}

            {/* Event-specific fields */}
            {link.entity_type === 'event' && item.date_start && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Date</div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(item.date_start).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Relevance score */}
            {link.relevance_score && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Relevance</div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i < link.relevance_score! ? 'bg-blue-500' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-gray-600 ml-1">{link.relevance_score}/10</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold text-gray-600">Notes</div>
                {link.link_id && onUpdateNotes && editingNotes !== link.link_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNotes(link.link_id!)}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {editingNotes === link.link_id ? (
                <div className="space-y-2">
                  <Textarea
                    defaultValue={link.notes || ''}
                    placeholder="Add notes about this evidence..."
                    rows={3}
                    onBlur={(e) => {
                      if (link.link_id && onUpdateNotes) {
                        onUpdateNotes(link.link_id, e.target.value)
                      }
                      setEditingNotes(null)
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  {link.notes || 'No notes added'}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const filteredEvidence = filterByType(linkedEvidence)
  const breakdown = {
    data: linkedEvidence.filter(e => e.entity_type === 'data').length,
    actor: linkedEvidence.filter(e => e.entity_type === 'actor').length,
    source: linkedEvidence.filter(e => e.entity_type === 'source').length,
    event: linkedEvidence.filter(e => e.entity_type === 'event').length,
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-xs text-gray-500">
            {linkedEvidence.length} item{linkedEvidence.length !== 1 ? 's' : ''} linked
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="p-4 border-b">
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as EvidenceEntityType | 'all')}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="text-xs">
              All ({linkedEvidence.length})
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              {breakdown.data}
            </TabsTrigger>
            <TabsTrigger value="actor" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {breakdown.actor}
            </TabsTrigger>
            <TabsTrigger value="source" className="text-xs">
              <Database className="h-3 w-3 mr-1" />
              {breakdown.source}
            </TabsTrigger>
            <TabsTrigger value="event" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {breakdown.event}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Evidence List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredEvidence.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No {selectedTab !== 'all' ? selectedTab : ''} evidence linked</p>
          </div>
        ) : (
          filteredEvidence.map(renderEvidenceCard)
        )}
      </div>
    </div>
  )
}
