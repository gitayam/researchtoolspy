import { useState, useEffect } from 'react'
import { Search, Filter, X, Link2, FileText, Users, Database, Calendar, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import type { EvidenceItem } from '@/types/evidence'
import type { Actor, Source, Event } from '@/types/entities'

export type EvidenceEntityType = 'data' | 'actor' | 'source' | 'event'

export interface LinkedEvidence {
  entity_type: EvidenceEntityType
  entity_id: string | number
  entity_data: EvidenceItem | Actor | Source | Event
  relevance?: string
  notes?: string
}

interface EvidenceLinkerProps {
  open: boolean
  onClose: () => void
  onLink: (selected: LinkedEvidence[]) => void
  alreadyLinked?: LinkedEvidence[]
  title?: string
  description?: string
}

export function EvidenceLinker({
  open,
  onClose,
  onLink,
  alreadyLinked = [],
  title = 'Link Evidence',
  description = 'Search and select evidence to link to this analysis'
}: EvidenceLinkerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState<EvidenceEntityType>('data')
  const [selectedItems, setSelectedItems] = useState<Map<string, LinkedEvidence>>(new Map())
  const [loading, setLoading] = useState(false)

  // Mock data - will be replaced with API calls
  const [dataItems, setDataItems] = useState<EvidenceItem[]>([])
  const [actors, setActors] = useState<Actor[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, selectedTab])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load based on selected tab
      switch (selectedTab) {
        case 'data':
          const evidenceRes = await fetch('/api/evidence-items')
          if (evidenceRes.ok) {
            const data = await evidenceRes.json()
            setDataItems(data.evidence || [])
          }
          break
        case 'actor':
          const actorRes = await fetch('/api/actors?workspace_id=1')
          if (actorRes.ok) {
            const data = await actorRes.json()
            setActors(data.actors || [])
          }
          break
        case 'source':
          const sourceRes = await fetch('/api/sources?workspace_id=1')
          if (sourceRes.ok) {
            const data = await sourceRes.json()
            setSources(data.sources || [])
          }
          break
        case 'event':
          const eventRes = await fetch('/api/events?workspace_id=1')
          if (eventRes.ok) {
            const data = await eventRes.json()
            setEvents(data.events || [])
          }
          break
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const getItemKey = (type: EvidenceEntityType, id: string | number) => `${type}-${id}`

  const isSelected = (type: EvidenceEntityType, id: string | number) => {
    return selectedItems.has(getItemKey(type, id))
  }

  const isAlreadyLinked = (type: EvidenceEntityType, id: string | number) => {
    return alreadyLinked.some(
      item => item.entity_type === type && String(item.entity_id) === String(id)
    )
  }

  const toggleSelection = (type: EvidenceEntityType, id: string | number, data: any) => {
    const key = getItemKey(type, id)
    const newSelection = new Map(selectedItems)

    if (newSelection.has(key)) {
      newSelection.delete(key)
    } else {
      newSelection.set(key, {
        entity_type: type,
        entity_id: id,
        entity_data: data
      })
    }

    setSelectedItems(newSelection)
  }

  const handleLink = () => {
    onLink(Array.from(selectedItems.values()))
    setSelectedItems(new Map())
    onClose()
  }

  const filterItems = (items: any[], query: string) => {
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter(item => {
      const name = item.title || item.name || ''
      const description = item.description || ''
      return name.toLowerCase().includes(q) || description.toLowerCase().includes(q)
    })
  }

  const getRiskBadge = (item: any) => {
    // For Data items with EVE assessment
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

    // For Actors with MOM-POP deception profile
    if (item.deception_profile?.mom) {
      const { motive, opportunity, means } = item.deception_profile.mom
      const avg = ((motive || 0) + (opportunity || 0) + (means || 0)) / 3
      if (avg >= 4) return <Badge className="bg-red-100 text-red-800">High Risk</Badge>
      if (avg >= 3) return <Badge className="bg-orange-100 text-orange-800">Medium Risk</Badge>
      if (avg >= 1.5) return <Badge className="bg-yellow-100 text-yellow-800">Low Risk</Badge>
      return <Badge className="bg-green-100 text-green-800">Minimal Risk</Badge>
    }

    // For Sources with MOSES assessment
    if (item.moses_assessment?.reliability) {
      const rel = item.moses_assessment.reliability
      const colors = {
        A: 'bg-green-100 text-green-800',
        B: 'bg-blue-100 text-blue-800',
        C: 'bg-yellow-100 text-yellow-800',
        D: 'bg-orange-100 text-orange-800',
        E: 'bg-red-100 text-red-800',
        F: 'bg-gray-100 text-gray-800'
      }
      return <Badge className={colors[rel] || colors.F}>Reliability: {rel}</Badge>
    }

    return null
  }

  const renderItemCard = (item: any, type: EvidenceEntityType) => {
    const itemId = item.id
    const selected = isSelected(type, itemId)
    const alreadyLinked = isAlreadyLinked(type, itemId)

    return (
      <Card
        key={itemId}
        className={`cursor-pointer transition-all ${
          selected ? 'ring-2 ring-blue-500' : ''
        } ${alreadyLinked ? 'opacity-50' : 'hover:shadow-md'}`}
        onClick={() => !alreadyLinked && toggleSelection(type, itemId, item)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected}
              disabled={alreadyLinked}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm truncate">
                  {item.title || item.name}
                </h4>
                {alreadyLinked && (
                  <Badge variant="outline" className="shrink-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Linked
                  </Badge>
                )}
              </div>

              {item.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {type === 'data' && item.evidence_type}
                  {type === 'actor' && item.type}
                  {type === 'source' && item.type}
                  {type === 'event' && item.event_type}
                </Badge>
                {getRiskBadge(item)}
                {item.created_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getTabIcon = (type: EvidenceEntityType) => {
    const icons = {
      data: FileText,
      actor: Users,
      source: Database,
      event: Calendar
    }
    const Icon = icons[type]
    return <Icon className="h-4 w-4" />
  }

  const getCurrentItems = () => {
    switch (selectedTab) {
      case 'data': return filterItems(dataItems, searchQuery)
      case 'actor': return filterItems(actors, searchQuery)
      case 'source': return filterItems(sources, searchQuery)
      case 'event': return filterItems(events, searchQuery)
      default: return []
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs for entity types */}
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as EvidenceEntityType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="data" className="flex items-center gap-2">
                {getTabIcon('data')}
                Data
              </TabsTrigger>
              <TabsTrigger value="actor" className="flex items-center gap-2">
                {getTabIcon('actor')}
                Actors
              </TabsTrigger>
              <TabsTrigger value="source" className="flex items-center gap-2">
                {getTabIcon('source')}
                Sources
              </TabsTrigger>
              <TabsTrigger value="event" className="flex items-center gap-2">
                {getTabIcon('event')}
                Events
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 max-h-[400px] overflow-y-auto space-y-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : getCurrentItems().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No {selectedTab} items found
                </div>
              ) : (
                getCurrentItems().map(item => renderItemCard(item, selectedTab))
              )}
            </div>
          </Tabs>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleLink}
                disabled={selectedItems.size === 0}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Link Selected ({selectedItems.size})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
