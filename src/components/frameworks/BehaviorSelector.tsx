import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Link2, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BehaviorOption {
  id: string
  title: string
  description?: string
  created_at?: string
}

interface BehaviorSelectorProps {
  selectedBehaviorId?: string
  selectedBehaviorTitle?: string
  onSelect: (behaviorId: string, behaviorTitle: string) => void
  onClear: () => void
}

export function BehaviorSelector({
  selectedBehaviorId,
  selectedBehaviorTitle,
  onSelect,
  onClear
}: BehaviorSelectorProps) {
  const [searchParams] = useSearchParams()
  const [behaviors, setBehaviors] = useState<BehaviorOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSelector, setShowSelector] = useState(!selectedBehaviorId)

  // Check for URL parameters on mount
  useEffect(() => {
    const urlBehaviorId = searchParams.get('behavior_id')
    const urlBehaviorTitle = searchParams.get('behavior_title')

    if (urlBehaviorId && urlBehaviorTitle && !selectedBehaviorId) {
      onSelect(urlBehaviorId, decodeURIComponent(urlBehaviorTitle))
      setShowSelector(false)
    }
  }, [searchParams, selectedBehaviorId, onSelect])

  // Load behaviors from API
  useEffect(() => {
    const loadBehaviors = async () => {
      setLoading(true)
      try {
        // Get workspace from localStorage
        const workspaceId = localStorage.getItem('currentWorkspace')
        if (!workspaceId) {
          console.warn('No workspace selected')
          setBehaviors([])
          return
        }

        const token = localStorage.getItem('token')
        const response = await fetch(
          `/api/frameworks?type=behavior&workspace_id=${workspaceId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )

        if (response.ok) {
          const data = await response.json()
          setBehaviors(data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            created_at: item.created_at
          })))
        }
      } catch (error) {
        console.error('Error loading behaviors:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBehaviors()
  }, [])

  const filteredBehaviors = behaviors.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (selectedBehaviorId && !showSelector) {
    return (
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
            <Link2 className="h-5 w-5" />
            Linked Behavior Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 dark:text-green-100">{selectedBehaviorTitle}</h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                ID: {selectedBehaviorId}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/dashboard/analysis-frameworks/behavior/${selectedBehaviorId}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSelector(true)
                }}
              >
                Change
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClear()
                  setShowSelector(true)
                }}
              >
                Unlink
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Link to Behavior Analysis
        </CardTitle>
        <CardDescription>
          Select which Behavior Analysis this COM-B assessment is analyzing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search behaviors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading behaviors...</div>
        ) : filteredBehaviors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No behaviors found matching your search' : 'No Behavior Analyses found'}
            </p>
            <Button
              variant="outline"
              onClick={() => window.open('/dashboard/analysis-frameworks/behavior', '_blank')}
            >
              Create Behavior Analysis
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-64 border rounded-lg">
            <div className="p-2 space-y-2">
              {filteredBehaviors.map(behavior => (
                <button
                  key={behavior.id}
                  onClick={() => {
                    onSelect(behavior.id, behavior.title)
                    setShowSelector(false)
                  }}
                  className="w-full text-left p-3 rounded-lg border hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium">{behavior.title}</div>
                  {behavior.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {behavior.description}
                    </div>
                  )}
                  {behavior.created_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      Created {new Date(behavior.created_at).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
