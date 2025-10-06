import { useState, useEffect } from 'react'
import { Search, Link as LinkIcon, MapPin, Calendar, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { BehaviorMetadata } from '@/types/behavior'

interface BehaviorSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (behavior: BehaviorMetadata) => void
}

const COMPLEXITY_LABELS: Record<string, { label: string; color: string }> = {
  single_action: { label: 'Single Action', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  simple_sequence: { label: 'Simple Sequence', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  complex_process: { label: 'Complex Process', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  ongoing_practice: { label: 'Ongoing Practice', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' }
}

export function BehaviorSearchDialog({
  open,
  onOpenChange,
  onSelect
}: BehaviorSearchDialogProps) {
  const [search, setSearch] = useState('')
  const [behaviors, setBehaviors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    const fetchBehaviors = async () => {
      setLoading(true)
      try {
        // TODO: Create /api/behaviors/search endpoint
        // For now, get from framework sessions
        const response = await fetch('/api/frameworks?type=behavior&limit=50')
        if (response.ok) {
          const data = await response.json()
          setBehaviors(data.sessions || [])
        }
      } catch (error) {
        console.error('Failed to load behaviors:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBehaviors()
  }, [open])

  const filteredBehaviors = behaviors.filter(b => {
    const searchLower = search.toLowerCase()
    return (
      b.title?.toLowerCase().includes(searchLower) ||
      b.description?.toLowerCase().includes(searchLower)
    )
  })

  const handleSelect = (behavior: any) => {
    let behaviorData: any = {}
    let tags: any[] = []

    try {
      behaviorData = behavior.data ? JSON.parse(behavior.data) : {}
    } catch (e) {
      console.error('Failed to parse behavior data:', e, behavior.data)
      behaviorData = {}
    }

    try {
      tags = behavior.tags ? JSON.parse(behavior.tags) : []
    } catch (e) {
      console.error('Failed to parse behavior tags:', e, behavior.tags)
      tags = []
    }

    onSelect({
      id: behavior.id,
      title: behavior.title,
      description: behavior.description,
      location_context: behaviorData.location_context,
      settings: behaviorData.behavior_settings?.settings || [],
      complexity: behaviorData.complexity,
      category: behaviorData.category,
      tags,
      created_at: behavior.created_at,
      upvotes: 0,
      usage_count: 0
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Link Existing Behavior
          </DialogTitle>
          <DialogDescription>
            Search and link an existing behavior analysis to this timeline event
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search behaviors by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading behaviors...
            </div>
          ) : filteredBehaviors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No behaviors found matching your search' : 'No behaviors available'}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {filteredBehaviors.map((behavior) => {
                let data: any = {}
                try {
                  data = behavior.data ? JSON.parse(behavior.data) : {}
                } catch (e) {
                  console.error('Failed to parse behavior data:', e, behavior.data)
                  data = {}
                }
                const complexity = data.complexity
                const locations = data.location_context?.specific_locations || []
                const settings = data.behavior_settings?.settings || []

                return (
                  <div
                    key={behavior.id}
                    className="border rounded-lg p-4 hover:border-blue-500 cursor-pointer transition-colors"
                    onClick={() => handleSelect(behavior)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-lg mb-1 truncate">{behavior.title}</h4>

                        {behavior.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                            {behavior.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {complexity && COMPLEXITY_LABELS[complexity] && (
                            <Badge variant="outline" className={COMPLEXITY_LABELS[complexity].color}>
                              <Layers className="h-3 w-3 mr-1" />
                              {COMPLEXITY_LABELS[complexity].label}
                            </Badge>
                          )}

                          {locations.length > 0 && (
                            <Badge variant="outline">
                              <MapPin className="h-3 w-3 mr-1" />
                              {locations[0]}{locations.length > 1 && ` +${locations.length - 1}`}
                            </Badge>
                          )}

                          {settings.length > 0 && (
                            <Badge variant="outline">
                              {settings[0]}{settings.length > 1 && ` +${settings.length - 1}`}
                            </Badge>
                          )}

                          {data.temporal_context?.frequency_pattern && (
                            <Badge variant="outline">
                              <Calendar className="h-3 w-3 mr-1" />
                              {data.temporal_context.frequency_pattern.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Button size="sm" variant="outline">
                        Link
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
